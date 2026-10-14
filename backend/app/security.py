"""Small ASGI boundary: reject excessive bodies before multipart parsing."""

import json
import logging
import time

from app.config import production

logger = logging.getLogger("aftertone.http")
MAX_REQUEST_BYTES = 12 * 1024 * 1024


class SecurityMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        started = time.monotonic()
        headers = dict(scope.get("headers", []))
        try:
            declared = int(headers.get(b"content-length", b"0"))
        except ValueError:
            declared = MAX_REQUEST_BYTES + 1
        if declared > MAX_REQUEST_BYTES:
            await send(
                {
                    "type": "http.response.start",
                    "status": 413,
                    "headers": [(b"content-type", b"application/json")],
                }
            )
            await send({"type": "http.response.body", "body": b'{"detail":"Request too large."}'})
            return
        # Bound buffering before delegating, including chunked requests with no length.
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body.extend(message.get("body", b""))
            if len(body) > MAX_REQUEST_BYTES:
                await send(
                    {
                        "type": "http.response.start",
                        "status": 413,
                        "headers": [(b"content-type", b"application/json")],
                    }
                )
                await send(
                    {"type": "http.response.body", "body": b'{"detail":"Request too large."}'}
                )
                return
            if not message.get("more_body", False):
                break
        delivered = False

        async def bounded_receive():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        async def secured_send(message):
            if message["type"] == "http.response.start":
                extra = [
                    (b"x-content-type-options", b"nosniff"),
                    (b"x-frame-options", b"DENY"),
                    (b"referrer-policy", b"no-referrer"),
                    (b"permissions-policy", b"camera=(), microphone=(), geolocation=()"),
                ]
                if production():
                    extra.extend(
                        [
                            (
                                b"content-security-policy",
                                b"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
                            ),
                        ]
                    )
                    extra.append((b"strict-transport-security", b"max-age=31536000"))
                if scope["path"].startswith("/api/"):
                    extra.append((b"cache-control", b"no-store"))
                message["headers"] = list(message.get("headers", [])) + extra
                # No query strings, cookies, credentials, filenames or request bodies.
                logger.info(
                    json.dumps(
                        {
                            "event": "http_request",
                            "method": scope["method"],
                            "status": message["status"],
                            "duration_ms": round((time.monotonic() - started) * 1000),
                        }
                    )
                )
            await send(message)

        await self.app(scope, bounded_receive, secured_send)
