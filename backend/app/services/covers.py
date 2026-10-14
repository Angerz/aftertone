from __future__ import annotations

import ipaddress
import socket
import time
import warnings
from contextlib import suppress
from io import BytesIO
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from uuid import uuid4

import httpx
from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import cover_dir

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_COVER_BYTES = 10 * 1024 * 1024
MAX_COVER_DIMENSION = 1200


class CoverError(ValueError):
    def __init__(self, message: str, status_code: int = 422) -> None:
        super().__init__(message)
        self.status_code = status_code


def save_cover_data(data: bytes, content_type: str | None) -> str:
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise CoverError("Cover must be a JPEG, PNG, or WebP image.")
    if len(data) > MAX_COVER_BYTES:
        raise CoverError("Cover image must be 10 MB or smaller.", status_code=413)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as probe:
                if probe.width * probe.height > 16_000_000:
                    raise CoverError("Image must contain at most 16 million pixels.")
        with Image.open(BytesIO(data)) as verification_image:
            verification_image.verify()
        with Image.open(BytesIO(data)) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
            image.thumbnail((MAX_COVER_DIMENSION, MAX_COVER_DIMENSION))
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombWarning,
        Image.DecompressionBombError,
    ) as error:
        raise CoverError("The uploaded file is not a valid image.") from error
    filename = f"{uuid4().hex}.webp"
    directory = cover_dir()
    target = directory / filename
    temporary = directory / f".{filename}.tmp"
    try:
        directory.mkdir(parents=True, exist_ok=True)
        image.save(temporary, format="WEBP", quality=90, method=6)
        temporary.replace(target)
    except OSError as error:
        temporary.unlink(missing_ok=True)
        raise CoverError("Could not store the cover image.", status_code=500) from error
    return filename


def save_cover(upload: UploadFile) -> str:
    return save_cover_data(upload.file.read(MAX_COVER_BYTES + 1), upload.content_type)


def _validate_remote_url(url: str) -> str:
    try:
        parsed = urlsplit(url)
        port = parsed.port
    except ValueError as error:
        raise CoverError("Invalid image URL.") from error
    if parsed.username or parsed.password or port not in {None, 80, 443}:
        raise CoverError("Image URL credentials and nonstandard ports are forbidden.")
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise CoverError("Cover URL must use http or https.")
    try:
        addresses = socket.getaddrinfo(
            parsed.hostname,
            parsed.port or (443 if parsed.scheme == "https" else 80),
            type=socket.SOCK_STREAM,
        )
        resolved = {ipaddress.ip_address(item[4][0]) for item in addresses}
    except (OSError, ValueError) as error:
        raise CoverError("Cover URL host could not be resolved.") from error
    if not resolved or any(not address.is_global for address in resolved):
        raise CoverError("Cover URL must not point to a local or private address.")
    return str(sorted(resolved, key=str)[0])


def download_cover_from_url(url: str, client: httpx.Client | None = None) -> str:
    """Download a public image, revalidating each redirect before local storage."""
    current_url = url.strip()
    own_client = client is None
    active_client = client or httpx.Client(timeout=httpx.Timeout(10.0), trust_env=False)
    deadline = time.monotonic() + 30
    try:
        for _ in range(4):
            address = _validate_remote_url(current_url)
            original = httpx.URL(current_url)
            # Connect to the validated numeric address. Host and TLS SNI retain
            # the original hostname, including normal certificate verification.
            target = original.copy_with(host=address) if own_client else original
            with active_client.stream(
                "GET",
                target,
                headers={"Host": original.netloc.decode()},
                extensions={"sni_hostname": original.host},
                follow_redirects=False,
            ) as response:
                if 300 <= response.status_code < 400:
                    location = response.headers.get("location")
                    if not location:
                        raise CoverError("Cover URL redirect has no destination.")
                    current_url = urljoin(current_url, location)
                    continue
                if response.status_code >= 400:
                    raise CoverError(f"Cover URL returned HTTP {response.status_code}.")
                content_type = response.headers.get("content-type", "").split(";", 1)[0].lower()
                if content_type not in ALLOWED_CONTENT_TYPES:
                    raise CoverError("Cover URL did not return a JPEG, PNG, or WebP image.")
                content_length = response.headers.get("content-length")
                if content_length:
                    try:
                        if int(content_length) > MAX_COVER_BYTES:
                            raise CoverError(
                                "Cover image must be 10 MB or smaller.", status_code=413
                            )
                    except ValueError as error:
                        raise CoverError("Cover URL returned an invalid content length.") from error
                data = bytearray()
                for chunk in response.iter_bytes(chunk_size=65536):
                    if time.monotonic() > deadline:
                        raise CoverError("Image download exceeded its time limit.")
                    data.extend(chunk)
                    if len(data) > MAX_COVER_BYTES:
                        raise CoverError("Cover image must be 10 MB or smaller.", status_code=413)
                return save_cover_data(bytes(data), content_type)
        raise CoverError("Cover URL redirected too many times.")
    except httpx.TimeoutException as error:
        raise CoverError("Cover URL request timed out.") from error
    except httpx.HTTPError as error:
        raise CoverError("Could not download the cover URL.") from error
    finally:
        if own_client:
            active_client.close()


def remove_cover_file(filename: str | None) -> None:
    if not filename:
        return
    path = cover_dir() / Path(filename).name
    with suppress(FileNotFoundError):
        path.unlink()
