import os
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

PUBLIC_PATHS = {
    "/docs", "/openapi.json", "/redoc",
}
PUBLIC_PREFIXES = (
    "/assets/",
)


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        for prefix in PUBLIC_PREFIXES:
            if path.startswith(prefix):
                return await call_next(request)

        if path in PUBLIC_PATHS:
            return await call_next(request)

        api_token = os.getenv("PI_API_TOKEN", "")
        if not api_token:
            return await call_next(request)

        if path.startswith("/api/internal/worker"):
            return await call_next(request)

        if path.startswith("/api/webhook/"):
            return await call_next(request)

        token = request.headers.get("X-API-Token", "") or request.query_params.get("token", "")
        if token == api_token:
            return await call_next(request)

        return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
