from __future__ import annotations

from io import BytesIO
from pathlib import Path
from uuid import uuid4

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


def save_cover(upload: UploadFile) -> str:
    if upload.content_type not in ALLOWED_CONTENT_TYPES:
        raise CoverError("Cover must be a JPEG, PNG, or WebP image.")
    data = upload.file.read(MAX_COVER_BYTES + 1)
    if len(data) > MAX_COVER_BYTES:
        raise CoverError("Cover image must be 10 MB or smaller.", status_code=413)
    try:
        with Image.open(BytesIO(data)) as verification_image:
            verification_image.verify()
        with Image.open(BytesIO(data)) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
            image.thumbnail((MAX_COVER_DIMENSION, MAX_COVER_DIMENSION))
    except (UnidentifiedImageError, OSError, ValueError) as error:
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


def remove_cover_file(filename: str | None) -> None:
    if not filename:
        return
    path = cover_dir() / Path(filename).name
    try:
        path.unlink()
    except FileNotFoundError:
        pass
