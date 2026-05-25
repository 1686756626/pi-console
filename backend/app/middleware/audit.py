import logging
import re
import time
from datetime import datetime

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("pi_console.audit")

SENSITIVE_PATTERNS = [
    (re.compile(r"(Bearer\s+)\S+", re.I), r"\1***"),
    (re.compile(r"(sk-)\w{4}\w+"), r"\1****"),
    (re.compile(r"(api[_-]?key[\"'\s:=]+)\S+", re.I), r"\1***"),
    (re.compile(r"(Authorization[\"'\s:=]+)\S+"), r"\1***"),
    (re.compile(r"(token[\"'\s:=]+)\S{8,}", re.I), r"\1***"),
]

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def sanitize(text: str) -> str:
    for pattern, repl in SENSITIVE_PATTERNS:
        text = pattern.sub(repl, text)
    return text


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        duration_ms = int((time.time() - start) * 1000)

        method = request.method
        path = request.url.path

        if path.startswith("/assets") or path == "/" or path.endswith(".js") or path.endswith(".css"):
            return response

        log_data = {
            "time": datetime.utcnow().isoformat(),
            "method": method,
            "path": path,
            "status": response.status_code,
            "duration_ms": duration_ms,
        }

        if method in WRITE_METHODS:
            log_data["type"] = "write"
            logger.info(f"[AUDIT] {method} {path} -> {response.status_code} ({duration_ms}ms)")
        else:
            logger.debug(f"[AUDIT] {method} {path} -> {response.status_code} ({duration_ms}ms)")

        return response


class SanitizeLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        return response
