import os
import re
from datetime import datetime, timedelta

from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter()

LOG_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "audit.log")


class AuditEntry(BaseModel):
    time: str
    method: str
    path: str
    status: int
    duration_ms: int
    type: str = "read"


@router.get("/audit/logs")
async def get_audit_logs(
    hours: int = Query(default=24, ge=1, le=168),
    method: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
):
    entries = []
    cutoff = datetime.utcnow() - timedelta(hours=hours)

    if not os.path.isfile(LOG_FILE):
        return {"entries": [], "total": 0}

    with open(LOG_FILE, "r", encoding="utf-8", errors="replace") as f:
        lines = f.readlines()

    for line in reversed(lines):
        line = line.strip()
        if not line:
            continue

        match = re.search(
            r'\[(AUDIT\w*)\]\s+(\w+)\s+(\S+)\s+->\s+(\d+)\s+\((\d+)ms\)',
            line,
        )
        if not match:
            continue

        level, method_str, path, status_str, duration_str = match.groups()

        time_match = re.search(r'(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})', line)
        if time_match:
            try:
                entry_time = datetime.fromisoformat(time_match.group(1))
                if entry_time < cutoff:
                    continue
            except ValueError:
                continue

        entry_type = "write" if method_str in ("POST", "PUT", "PATCH", "DELETE") else "read"
        if method and method.upper() != method_str:
            continue

        entries.append({
            "time": time_match.group(1) if time_match else "",
            "method": method_str,
            "path": path,
            "status": int(status_str),
            "duration_ms": int(duration_str),
            "type": entry_type,
        })

        if len(entries) >= limit:
            break

    return {"entries": entries, "total": len(entries)}
