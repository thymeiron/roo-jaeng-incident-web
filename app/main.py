import re
import os
import json
import hmac
import hashlib
import time
import secrets
import base64
import logging
import urllib.error
import urllib.request
from datetime import timedelta
from datetime import datetime

from fastapi import FastAPI, Request, Response, HTTPException, Depends, Cookie
from fastapi.responses import PlainTextResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Float, JSON, text, or_, cast, func
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.exc import IntegrityError


DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}/{DB_NAME}"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=60,
    pool_size=5,
    max_overflow=5,
    pool_timeout=10,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
        raise
    finally:
        try:
            db.close()
        except Exception:
            engine.dispose()


Base = declarative_base()


class TicketDB(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    detail = Column(Text)
    severity = Column(String)
    status = Column(String)
    host = Column(String)
    source = Column(String)
    assigned_to = Column(String)
    work_hours = Column(Float)
    work_count = Column(Integer, default=1)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

    external_id = Column(Text, nullable=True)
    slack_channel = Column(Text, nullable=True)
    slack_ts = Column(Text, nullable=True)
    raw_payload = Column(JSON, nullable=True)


# AUTH_SYSTEM_V1
class UserDB(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    role = Column(String, nullable=False, default="viewer")
    is_active = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, default=datetime.now)


class SessionDB(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    token_hash = Column(String, unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)


class CommentDB(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"))
    comment = Column(Text)
    created_by = Column(String)
    created_at = Column(DateTime)


Base.metadata.create_all(bind=engine)

app = FastAPI()
logger = logging.getLogger("uvicorn.error")


class TicketCreate(BaseModel):
    title: str
    detail: str = ""
    severity: str = "Medium"
    host: str = ""
    source: str = "manual"
    assigned_to: str = ""
    work_hours: float | None = None
    work_count: int | None = 1



class LoginRequest(BaseModel):
    username: str
    password: str


class StatusUpdate(BaseModel):
    status: str


class AssignUpdate(BaseModel):
    assigned_to: str
    work_hours: float | None = None
    work_count: int | None = 1


class CommentCreate(BaseModel):
    comment: str
    created_by: str = "IDS Support"


def verify_slack_signature(
    signing_secret: str,
    timestamp: str,
    body: bytes,
    slack_signature: str,
) -> bool:
    # For local test only. Replace with real Slack Signing Secret later.
    if not signing_secret or signing_secret == "change-me":
        return True

    if not timestamp or not slack_signature:
        return False

    try:
        req_time = int(timestamp)
    except ValueError:
        return False

    # Reject replay request older than 5 minutes
    if abs(time.time() - req_time) > 60 * 5:
        return False

    base_string = b"v0:" + timestamp.encode("utf-8") + b":" + body
    my_signature = "v0=" + hmac.new(
        signing_secret.encode("utf-8"),
        base_string,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(my_signature, slack_signature)


def create_ticket_record(db: Session, **values):
    """Create and commit a ticket. Unique external IDs are returned as duplicates."""
    external_id = values.get("external_id")
    if external_id:
        existing = db.query(TicketDB).filter(TicketDB.external_id == external_id).first()
        if existing:
            return existing, True

    now = datetime.now()
    ticket = TicketDB(
        title=values.get("title") or "Alert",
        detail=values.get("detail") or "",
        severity=values.get("severity") or "Medium",
        status="New",
        host=values.get("host") or "-",
        source=values.get("source") or "manual",
        assigned_to="",
        work_hours=None,
        work_count=1,
        external_id=external_id,
        slack_channel=values.get("slack_channel"),
        slack_ts=values.get("slack_ts"),
        raw_payload=values.get("extra"),
        created_at=now,
        updated_at=now,
    )
    db.add(ticket)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if not external_id:
            raise
        existing = db.query(TicketDB).filter(TicketDB.external_id == external_id).first()
        if not existing:
            raise
        return existing, True
    db.refresh(ticket)
    return ticket, False


def close_tickets(db: Session, tickets: list[TicketDB], detail: str, extra: dict | None = None):
    """Close existing tickets and commit before any downstream notification."""
    now = datetime.now()
    closed = []
    for ticket in tickets:
        if ticket.status == "Closed":
            continue
        ticket.status = "Closed"
        ticket.updated_at = now
        if extra is not None:
            stored = dict(ticket.raw_payload or {})
            stored["recovery"] = extra
            ticket.raw_payload = stored
        db.add(CommentDB(
            ticket_id=ticket.id,
            comment="Auto closed by Zabbix resolved alert.\n\n" + detail,
            created_at=now,
        ))
        closed.append(ticket)
    db.commit()
    return closed


def verify_line_signature(channel_secret: str, raw_body: bytes, signature: str) -> bool:
    if not channel_secret or not signature:
        return False
    expected = base64.b64encode(
        hmac.new(channel_secret.encode("utf-8"), raw_body, hashlib.sha256).digest()
    ).decode("ascii")
    return hmac.compare_digest(expected, signature)


def send_line_push_message(message: str) -> bool:
    enabled = os.getenv("LINE_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}
    target_id = os.getenv("LINE_TARGET_ID", "").strip()
    access_token = os.getenv("LINE_CHANNEL_ACCESS_TOKEN", "").strip()
    if not enabled or not target_id:
        logger.info("Skipping LINE push: LINE is disabled or LINE_TARGET_ID is empty")
        return False
    if not access_token:
        logger.error("LINE push failed: LINE_CHANNEL_ACCESS_TOKEN is not configured")
        return False

    body = json.dumps({"to": target_id, "messages": [{"type": "text", "text": message}]}).encode("utf-8")
    request = urllib.request.Request(
        "https://api.line.me/v2/bot/message/push",
        data=body,
        headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return 200 <= response.status < 300
    except urllib.error.HTTPError as exc:
        logger.error("LINE push failed with HTTP status %s", exc.code)
    except Exception as exc:
        logger.error("LINE push failed: %s", type(exc).__name__)
    return False


def ticket_url(ticket_id: int) -> str:
    base_url = os.getenv("ROO_JAENG_BASE_URL", "https://roo-jaeng.com").rstrip("/")
    return f"{base_url}/tickets/{ticket_id}"


def send_problem_notification(ticket: TicketDB, event: dict) -> bool:
    return send_line_push_message(
        "🔴 Zabbix Problem\n"
        f"Ticket: #{ticket.id}\nHost: {event.get('host', '')}\n"
        f"Problem: {event.get('event_name', '')}\nSeverity: {event.get('severity', '')}\n"
        f"Time: {event.get('event_date', '')} {event.get('event_time', '')}\n"
        f"{ticket_url(ticket.id)}"
    )


def format_ticket_duration(ticket: TicketDB) -> str:
    if not ticket.created_at or not ticket.updated_at:
        return "Unknown"

    duration_seconds = int((ticket.updated_at - ticket.created_at).total_seconds())
    if duration_seconds < 0:
        return "Unknown"

    days, remainder = divmod(duration_seconds, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, seconds = divmod(remainder, 60)
    parts = []
    if days:
        parts.append(f"{days}d")
    if hours:
        parts.append(f"{hours}h")
    if minutes:
        parts.append(f"{minutes}m")
    if seconds or not parts:
        parts.append(f"{seconds}s")
    return " ".join(parts)


def send_recovery_notification(ticket: TicketDB, event: dict) -> bool:
    return send_line_push_message(
        "🟢 Zabbix Recovery\n"
        f"Ticket: #{ticket.id}\nHost: {event.get('host', '')}\n"
        f"Problem: {event.get('event_name', '')}\nStatus: Closed\n"
        f"Duration: {format_ticket_duration(ticket)}\n"
        f"{ticket_url(ticket.id)}"
    )

def extract_slack_message_text(event: dict) -> str:
    parts = []

    # Normal Slack text
    text = event.get("text", "")
    if text:
        parts.append(text)

    # Slack attachments from Zabbix
    for attachment in event.get("attachments", []):
        fallback = attachment.get("fallback")
        pretext = attachment.get("pretext")
        title = attachment.get("title")
        text = attachment.get("text")

        if fallback:
            parts.append(fallback)
        if pretext:
            parts.append(pretext)
        if title:
            parts.append(f"Problem: {title}")
        if text:
            parts.append(text)

        for field in attachment.get("fields", []):
            field_title = field.get("title", "")
            field_value = field.get("value", "")

            if field_title or field_value:
                parts.append(f"{field_title}: {field_value}")

    # Slack blocks
    for block in event.get("blocks", []):
        block_text = block.get("text", {})
        if isinstance(block_text, dict):
            value = block_text.get("text")
            if value:
                parts.append(value)

        for element in block.get("elements", []):
            if isinstance(element, dict):
                value = element.get("text")
                if value:
                    parts.append(value)

    return "\n".join([p for p in parts if p])

def get_slack_message_event(event: dict) -> dict:
    """
    Slack normal message:
      event.attachments

    Slack edited message:
      event.subtype = message_changed
      event.message.attachments
    """
    if not event:
        return {}

    if event.get("subtype") == "message_changed" and isinstance(event.get("message"), dict):
        return event.get("message") or {}

    return event


def parse_zabbix_slack_text(text: str) -> dict:
    result = {
        "event_id": None,
        "title": None,
        "detail": text,
        "severity": None,
        "host": None,
    }

    lines = [line.strip() for line in text.splitlines() if line.strip()]

    for line in lines:
        lower = line.lower()

        if lower.startswith("event id:"):
            result["event_id"] = line.split(":", 1)[1].strip()

        elif lower.startswith("host:"):
            result["host"] = line.split(":", 1)[1].strip()

        elif lower.startswith("severity:"):
            result["severity"] = line.split(":", 1)[1].strip()

        elif lower.startswith("problem:"):
            result["title"] = line.split(":", 1)[1].strip()

        elif lower.startswith("resolved:"):
            result["title"] = line.split(":", 1)[1].strip()

        elif lower.startswith("recovery:"):
            result["title"] = line.split(":", 1)[1].strip()

        elif lower.startswith("ok:"):
            result["title"] = line.split(":", 1)[1].strip()

        elif lower.startswith("trigger:") and not result["title"]:
            result["title"] = line.split(":", 1)[1].strip()

    if not result["title"]:
        result["title"] = lines[0][:150] if lines else "Zabbix Alert"

    if not result["host"]:
        result["host"] = "-"

    if not result["severity"]:
        result["severity"] = "Medium"

    sev_lower = result["severity"].lower()

    if "disaster" in sev_lower or "critical" in sev_lower:
        result["severity"] = "Critical"
    elif "high" in sev_lower:
        result["severity"] = "High"
    elif "average" in sev_lower or "warning" in sev_lower:
        result["severity"] = "Medium"
    elif "info" in sev_lower:
        result["severity"] = "Low"

    return result


@app.get("/")
def home():
    return {
        "system": "Roo-Jaeng Incident Workflow",
        "status": "running",
    }


@app.get("/api/tickets")
def get_tickets(
    request: Request,
    q: str | None = None,
    status: str | None = None,
    status_not: str | None = None,
    source: str | None = None,
    host: str | None = None,
    title: str | None = None,
    assigned_to: str | None = None,
    risk: str | None = None,
    page: int = 1,
    page_size: int = 100,
    paginated: bool = False,
    limit: int = 500,
    db: Session = Depends(get_db),
):
    page = max(1, page)
    page_size = max(1, min(page_size, 200))
    limit = max(1, min(limit, 1000))

    query = db.query(TicketDB)
    normalized_host = func.lower(
        func.btrim(func.regexp_replace(func.coalesce(TicketDB.host, ""), r"\[.*?\]", "", "g"))
    )
    normalized_title = func.lower(func.btrim(func.coalesce(TicketDB.title, "")))
    normalized_title = func.regexp_replace(normalized_title, r"^problem:\s*", "", "i")
    normalized_title = func.regexp_replace(normalized_title, r"^resolved.*?:\s*", "", "i")
    normalized_title = func.regexp_replace(normalized_title, r"\s+on\s+[a-z0-9_-]+$", "", "i")
    normalized_title = func.regexp_replace(normalized_title, r"\s+", " ", "g")

    # Filter status in database before applying limit
    if status:
        query = query.filter(TicketDB.status.ilike(status.strip()))

    if status_not:
        query = query.filter(~TicketDB.status.ilike(status_not.strip()))

    if q:
        keyword = f"%{q.strip()}%"
        query = query.filter(
            or_(
                cast(TicketDB.id, String).ilike(keyword),
                TicketDB.title.ilike(keyword),
                TicketDB.detail.ilike(keyword),
                TicketDB.severity.ilike(keyword),
                TicketDB.status.ilike(keyword),
                TicketDB.host.ilike(keyword),
                TicketDB.source.ilike(keyword),
                TicketDB.assigned_to.ilike(keyword),
            )
        )

    if source:
        source_value = source.strip()
        if source_value.lower() == "zabbix":
            query = query.filter(TicketDB.source.in_(["zabbix", "slack_zabbix"]))
        else:
            query = query.filter(TicketDB.source.ilike(source_value))

    if host:
        query = query.filter(normalized_host == host.strip().lower())

    if title:
        query = query.filter(normalized_title == title.strip().lower())

    if assigned_to is not None:
        assigned_value = assigned_to.strip()
        if assigned_value:
            query = query.filter(TicketDB.assigned_to.ilike(assigned_value))
        else:
            query = query.filter(
                or_(TicketDB.assigned_to.is_(None), func.btrim(TicketDB.assigned_to) == "")
            )

    if risk == "repeated":
        repeated_groups = (
            query.with_entities(
                normalized_host.label("normalized_host"),
                normalized_title.label("normalized_title"),
            )
            .filter(TicketDB.source.in_(["zabbix", "slack_zabbix"]))
            .group_by(normalized_host, normalized_title)
            .having(func.count(TicketDB.id) >= 3)
            .subquery()
        )
        query = query.filter(
            TicketDB.source.in_(["zabbix", "slack_zabbix"]),
            db.query(repeated_groups)
            .filter(
                repeated_groups.c.normalized_host == normalized_host,
                repeated_groups.c.normalized_title == normalized_title,
            )
            .exists(),
        )

    use_pagination = paginated or "page" in request.query_params or "page_size" in request.query_params
    total = query.order_by(None).count() if use_pagination else None
    ordered_query = query.order_by(TicketDB.created_at.desc().nullslast(), TicketDB.id.desc())
    if use_pagination:
        rows = ordered_query.offset((page - 1) * page_size).limit(page_size).all()
    else:
        rows = ordered_query.limit(limit).all()

    result = [
        {
            "id": r.id,
            "title": r.title,
            "detail": r.detail,
            "severity": r.severity,
            "status": r.status,
            "host": r.host,
            "source": r.source,
            "assigned_to": r.assigned_to,
            "work_hours": r.work_hours,
            "work_count": r.work_count,
            "created_at": str(r.created_at),
            "updated_at": str(r.updated_at),
        }
        for r in rows
    ]

    db.rollback()
    if not use_pagination:
        return result

    return {
        "items": result,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": (total + page_size - 1) // page_size,
    }


@app.put("/api/tickets/{ticket_id}")
async def update_ticket(ticket_id: int, payload: dict):
    db = SessionLocal()
    try:
        row = db.execute(
            text("SELECT id FROM tickets WHERE id = :id"),
            {"id": ticket_id},
        ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Ticket not found")

        allowed_fields = [
            "title",
            "detail",
            "severity",
            "status",
            "host",
            "source",
            "assigned_to",
            "work_hours",
            "work_count",
        ]

        update_fields = [field for field in allowed_fields if field in payload]

        if update_fields:
            set_clause = ", ".join([f"{field} = :{field}" for field in update_fields])
            set_clause = set_clause + ", updated_at = :updated_at"

            params = {field: payload[field] for field in update_fields}
            params["id"] = ticket_id
            params["updated_at"] = datetime.utcnow()

            db.execute(
                text(f"UPDATE tickets SET {set_clause} WHERE id = :id"),
                params,
            )
            db.commit()

        result = db.execute(
            text("""
                SELECT id, title, detail, severity, status, host, source,
                       assigned_to, work_hours, work_count, created_at, updated_at
                FROM tickets
                WHERE id = :id
            """),
            {"id": ticket_id},
        ).mappings().fetchone()

        return dict(result)
    finally:
        db.close()

@app.get("/api/tickets/{ticket_id}")
async def get_ticket(ticket_id: int):
    db = SessionLocal()
    try:
        ticket = db.execute(
            text("""
                SELECT id, title, detail, severity, status, host, source,
                       assigned_to, work_hours, work_count, created_at, updated_at
                FROM tickets
                WHERE id = :id
            """),
            {"id": ticket_id},
        ).mappings().fetchone()

        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")

        comments = db.execute(
            text("""
                SELECT id, ticket_id, comment, created_by, created_at
                FROM comments
                WHERE ticket_id = :ticket_id
                ORDER BY created_at DESC
            """),
            {"ticket_id": ticket_id},
        ).mappings().fetchall()

        data = dict(ticket)
        data["comments"] = [dict(c) for c in comments]
        return data
    finally:
        db.close()

@app.post("/api/tickets")
def create_ticket(ticket: TicketCreate):
    db = SessionLocal()
    try:
        now = datetime.now()

        row = TicketDB(
            title=ticket.title,
            detail=ticket.detail,
            severity=ticket.severity,
            status="New",
            host=ticket.host,
            source=ticket.source,
            assigned_to=ticket.assigned_to,
            work_hours=ticket.work_hours,
            work_count=ticket.work_count or 1,
            created_at=now,
            updated_at=now,
        )

        db.add(row)
        db.commit()
        db.refresh(row)

        return {
            "id": row.id,
            "message": "ticket created",
        }
    finally:
        db.close()


@app.put("/api/tickets/{ticket_id}/status")
def update_status(ticket_id: int, data: StatusUpdate):
    db = SessionLocal()
    try:
        ticket = db.query(TicketDB).filter(TicketDB.id == ticket_id).first()

        if not ticket:
            raise HTTPException(status_code=404, detail="ticket not found")

        ticket.status = data.status
        ticket.updated_at = datetime.now()

        db.commit()

        return {
            "id": ticket.id,
            "status": ticket.status,
            "message": "status updated",
        }
    finally:
        db.close()


@app.put("/api/tickets/{ticket_id}/assign")
def update_assign(ticket_id: int, data: AssignUpdate):
    db = SessionLocal()
    try:
        ticket = db.query(TicketDB).filter(TicketDB.id == ticket_id).first()

        if not ticket:
            raise HTTPException(status_code=404, detail="ticket not found")

        ticket.assigned_to = data.assigned_to
        if hasattr(data, 'work_hours'):
            ticket.work_hours = data.work_hours
        if hasattr(data, 'work_count'):
            ticket.work_count = data.work_count or 1
        ticket.updated_at = datetime.now()

        db.commit()

        return {
            "id": ticket.id,
            "assigned_to": ticket.assigned_to,
            "work_hours": ticket.work_hours,
            "work_count": ticket.work_count,
            "message": "assigned updated",
        }
    finally:
        db.close()



@app.post("/api/tickets/{ticket_id}/comments")
async def add_ticket_comment(ticket_id: int, payload: dict):
    db = SessionLocal()
    try:
        row = db.execute(
            text("SELECT id FROM tickets WHERE id = :id"),
            {"id": ticket_id},
        ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Ticket not found")

        comment = (
            payload.get("comment")
            or payload.get("body")
            or payload.get("note")
            or ""
        )

        created_by = (
            payload.get("created_by")
            or payload.get("author")
            or "IDS Support"
        )

        comment = str(comment).strip()
        created_by = str(created_by).strip() or "IDS Support"

        if not comment:
            raise HTTPException(status_code=400, detail="Comment is required")

        db.execute(
            text("""
                INSERT INTO comments (ticket_id, comment, created_by, created_at)
                VALUES (:ticket_id, :comment, :created_by, :created_at)
            """),
            {
                "ticket_id": ticket_id,
                "comment": comment,
                "created_by": created_by,
                "created_at": datetime.utcnow(),
            },
        )

        db.execute(
            text("UPDATE tickets SET updated_at = :updated_at WHERE id = :id"),
            {
                "id": ticket_id,
                "updated_at": datetime.utcnow(),
            },
        )

        db.commit()

        result = db.execute(
            text("""
                SELECT id, ticket_id, comment, created_by, created_at
                FROM comments
                WHERE ticket_id = :ticket_id
                ORDER BY created_at DESC
                LIMIT 1
            """),
            {"ticket_id": ticket_id},
        ).mappings().fetchone()

        return dict(result)
    finally:
        db.close()

@app.post("/api/slack/webhook")
def slack_webhook(payload: dict):
    db = SessionLocal()
    try:
        now = datetime.now()

        title = payload.get("problem") or payload.get("title") or "Slack Alert"
        host = payload.get("host", "")
        severity = payload.get("severity", "Medium")

        row = TicketDB(
            title=title,
            detail=str(payload),
            severity=severity,
            status="New",
            host=host,
            source="slack",
            assigned_to="",
            work_hours=None,
            work_count=1,
            created_at=now,
            updated_at=now,
        )

        db.add(row)
        db.commit()
        db.refresh(row)

        return {
            "message": "case created from slack",
            "ticket_id": row.id,
        }
    finally:
        db.close()
def normalize_zabbix_title(title: str) -> str:
    if not title:
        return ""

    clean = str(title).replace("*", "").strip()

    # Remove common Zabbix prefixes
    # Problem: XXX -> XXX
    # Resolved: XXX -> XXX
    clean = re.sub(r"^(problem|resolved|recovery|ok)\s*:\s*", "", clean, flags=re.IGNORECASE)

    # Example:
    # Resolved in 2m 0s: Problem: HSVCRP01 - CPU Utilization Reach Up 85%
    # -> Problem: HSVCRP01 - CPU Utilization Reach Up 85%
    if clean.lower().startswith("resolved in ") and ":" in clean:
        clean = clean.split(":", 1)[1].strip()

    # Remove prefix again after "Resolved in ..."
    clean = re.sub(r"^(problem|resolved|recovery|ok)\s*:\s*", "", clean, flags=re.IGNORECASE)

    # Remove bracket text:
    # HSVCRP01 [HSVCRP01] -> HSVCRP01
    clean = re.sub(r"\s*\[[^\]]+\]\s*", " ", clean)

    # Support title format:
    # HSVCRP01 - CPU Utilization Reach Up 85%
    # -> CPU Utilization Reach Up 85%
    clean = re.sub(r"^[A-Za-z0-9._-]+\s*-\s*", "", clean)

    # Support title format:
    # Disk I/O is overloaded on HSVCRP01
    # -> Disk I/O is overloaded
    clean = re.sub(r"\s+on\s+[A-Za-z0-9._-]+\s*$", "", clean, flags=re.IGNORECASE)

    clean = clean.replace("%", " percent")
    clean = re.sub(r"\s+", " ", clean).strip().lower()

    return clean


def normalize_zabbix_host(host: str) -> str:
    if not host:
        return ""

    clean = str(host).replace("*", "").strip()

    # Example:
    # HSVCRP01 [HSVCRP01] -> HSVCRP01
    clean = re.sub(r"\s*\[[^\]]+\]\s*", "", clean)

    # Use first token only
    clean = clean.strip().split()[0] if clean.strip() else ""

    return clean.upper()


def is_zabbix_resolved_alert(full_text: str) -> bool:
    if not full_text:
        return False

    text = full_text.lower()

    resolved_keywords = [
        "resolved:",
        "resolved in ",
        "recovery:",
        "problem has been resolved",
        "event value: ok",
        "trigger status: ok",
        "ok:",
    ]

    return any(keyword in text for keyword in resolved_keywords)


def close_open_tickets_by_host_title(host: str, title: str, resolved_detail: str):
    normalized_host = normalize_zabbix_host(host)
    normalized_title = normalize_zabbix_title(title)

    if not normalized_host or not normalized_title:
        return []

    db = SessionLocal()
    try:
        open_tickets = (
            db.query(TicketDB)
            .filter(TicketDB.status != "Closed")
            .filter(TicketDB.source.in_(["zabbix", "slack_zabbix"]))
            .all()
        )

        matched_tickets = []

        for ticket in open_tickets:
            ticket_host = normalize_zabbix_host(ticket.host or "")
            ticket_title = normalize_zabbix_title(ticket.title or "")

            host_match = (
                ticket_host == normalized_host
                or normalized_host in ticket_host
                or ticket_host in normalized_host
            )

            title_match = (
                ticket_title == normalized_title
                or normalized_title in ticket_title
                or ticket_title in normalized_title
            )

            if host_match and title_match:
                matched_tickets.append(ticket)

        closed = close_tickets(db, matched_tickets, resolved_detail)
        return [ticket.id for ticket in closed]

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


@app.post("/api/slack/events")
async def slack_events(request: Request):
    raw_body = await request.body()

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Slack URL verification
    if payload.get("type") == "url_verification":
        return PlainTextResponse(payload.get("challenge", ""))

    signing_secret = os.getenv("SLACK_SIGNING_SECRET", "change-me")
    timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
    slack_signature = request.headers.get("X-Slack-Signature", "")

    if not verify_slack_signature(
        signing_secret,
        timestamp,
        raw_body,
        slack_signature,
    ):
        raise HTTPException(status_code=401, detail="Invalid Slack signature")

    if payload.get("type") != "event_callback":
        return {"ok": True}

    event = payload.get("event", {})
    message_event = get_slack_message_event(event)

    if event.get("type") != "message":
        return {"ok": True}

    subtype = event.get("subtype")

    ignored_subtypes = [
        "message_deleted",
        "channel_join",
        "channel_leave",
        "group_join",
        "group_leave",
        "member_joined_channel",
        "member_left_channel",
    ]

    if subtype in ignored_subtypes:
        return {"ok": True, "ignored": subtype}

    text = extract_slack_message_text(message_event)
    channel = message_event.get("channel") or event.get("channel", "")
    ts = message_event.get("ts") or event.get("ts", "")

    if not text.strip():
        return {"ok": True, "ignored": "empty_text"}

    lower_text = text.lower()

    non_alert_keywords = [
        "has joined the channel",
        "was added to",
        "joined the channel",
        "left the channel",
    ]

    if any(keyword in lower_text for keyword in non_alert_keywords):
        return {"ok": True, "ignored": "non_alert_message"}

    zabbix_keywords = [
        "problem",
        "resolved",
        "host",
        "severity",
        "event time",
        "opdata",
        "operational data",
        "trigger description",
        "event tags",
    ]

    if not any(keyword in lower_text for keyword in zabbix_keywords):
        return {"ok": True, "ignored": "not_zabbix_alert"}

    zabbix_channel_id = os.getenv("SLACK_ZABBIX_CHANNEL_ID", "")
    if zabbix_channel_id and channel != zabbix_channel_id:
        return {"ok": True, "ignored": "wrong_channel"}

    parsed = parse_zabbix_slack_text(text)
    closed_ticket_ids = []

    alert_title = parsed.get("title") or "Zabbix Alert"
    alert_host = parsed.get("host") or "-"
    alert_detail = parsed.get("detail") or text

    if is_zabbix_resolved_alert(text):
        print("============================", flush=True)

        closed_ticket_ids = close_open_tickets_by_host_title(
            alert_host,
            alert_title,
            alert_detail,
        )

        return {
            "ok": True,
            "action": "auto_closed_by_resolved_alert",
            "closed_ticket_ids": closed_ticket_ids,
            "closed_count": len(closed_ticket_ids),
            "host": normalize_zabbix_host(alert_host),
            "title": normalize_zabbix_title(alert_title),
        }

    if parsed.get("event_id"):
        external_id = f"zabbix:{parsed['event_id']}"
    else:
        external_id = f"slack:{channel}:{ts}"

    db = SessionLocal()
    try:
        ticket, duplicate = create_ticket_record(
            db,
            title=parsed.get("title") or "Zabbix Alert",
            detail=parsed.get("detail") or text,
            severity=parsed.get("severity") or "Medium",
            host=parsed.get("host") or "-",
            source="slack_zabbix",
            external_id=external_id,
            slack_channel=channel,
            slack_ts=ts,
            extra=payload,
        )

        if duplicate:
            return {
                "ok": True,
                "duplicate": True,
                "ticket_id": ticket.id,
            }

        return {
            "ok": True,
            "ticket_id": ticket.id,
            "external_id": external_id,
        }
    finally:
        db.close()


def require_webhook_token(request: Request):
    configured = os.getenv("ZABBIX_WEBHOOK_TOKEN", "")
    supplied = request.headers.get("X-Webhook-Token", "")
    if not configured or not supplied or not secrets.compare_digest(configured, supplied):
        raise HTTPException(status_code=401, detail="Invalid webhook token")


@app.post("/api/line/webhook")
async def line_webhook(request: Request):
    raw_body = await request.body()
    signature = request.headers.get("x-line-signature", "")
    if not verify_line_signature(os.getenv("LINE_CHANNEL_SECRET", ""), raw_body, signature):
        raise HTTPException(status_code=401, detail="Invalid LINE signature")
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="Invalid JSON")

    for event in payload.get("events", []):
        source = event.get("source") or {}
        logger.info(
            "LINE webhook source: type=%s groupId=%s userId=%s",
            source.get("type"), source.get("groupId"), source.get("userId"),
        )
    return {"ok": True}


@app.post("/api/line/test")
async def line_test(request: Request):
    require_webhook_token(request)
    return {"ok": True, "line_sent": send_line_push_message("Roo-Jaeng LINE notification test")}


def validate_zabbix_payload(payload: dict):
    required = [
        "event_id", "event_status", "event_value", "event_name", "trigger_id",
        "host", "host_ip", "severity", "detail", "event_date", "event_time",
    ]
    missing = [name for name in required if payload.get(name) is None]
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing fields: {', '.join(missing)}")


def is_recovery_event(payload: dict) -> bool:
    values = {str(payload.get("event_status", "")).upper(), str(payload.get("event_value", "")).upper()}
    return bool(values & {"RESOLVED", "RECOVERY", "OK", "0"})


def find_zabbix_recovery_ticket(db: Session, payload: dict):
    external_id = f"zabbix:{payload['event_id']}"
    ticket = db.query(TicketDB).filter(TicketDB.external_id == external_id).first()
    if ticket:
        return ticket

    trigger_id = str(payload["trigger_id"])
    normalized_host = normalize_zabbix_host(payload["host"])
    candidates = (
        db.query(TicketDB)
        .filter(TicketDB.source == "zabbix", TicketDB.status != "Closed")
        .order_by(TicketDB.created_at.desc())
        .all()
    )
    for candidate in candidates:
        zabbix = (candidate.raw_payload or {}).get("zabbix", {})
        if (
            str(zabbix.get("trigger_id", "")) == trigger_id
            and normalize_zabbix_host(candidate.host or "") == normalized_host
        ):
            return candidate
    return None


@app.post("/api/zabbix/webhook")
async def zabbix_webhook(request: Request):
    require_webhook_token(request)
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="JSON object required")
    validate_zabbix_payload(payload)

    db = SessionLocal()
    try:
        if is_recovery_event(payload):
            ticket = find_zabbix_recovery_ticket(db, payload)
            if not ticket:
                return {"ok": True, "action": "recovery_ticket_not_found", "line_sent": False}
            recovery = dict(payload)
            recovery["received_at"] = datetime.now().isoformat()
            closed = close_tickets(db, [ticket], str(payload.get("detail", "")), recovery)
            if not closed:
                return {"ok": True, "action": "already_closed", "ticket_id": ticket.id, "line_sent": False}
            line_sent = send_recovery_notification(ticket, payload)
            return {"ok": True, "action": "closed", "ticket_id": ticket.id, "line_sent": line_sent}

        status_values = {str(payload.get("event_status", "")).upper(), str(payload.get("event_value", "")).upper()}
        if "PROBLEM" not in status_values and "1" not in status_values:
            raise HTTPException(status_code=422, detail="Unsupported Zabbix event status")

        ticket, duplicate = create_ticket_record(
            db,
            title=str(payload["event_name"]),
            detail=str(payload["detail"]),
            severity=str(payload["severity"]),
            host=str(payload["host"]),
            source="zabbix",
            external_id=f"zabbix:{payload['event_id']}",
            extra={"zabbix": payload},
        )
        if duplicate:
            return {"ok": True, "duplicate": True, "ticket_id": ticket.id, "line_sent": False}
        line_sent = send_problem_notification(ticket, payload)
        return {"ok": True, "action": "created", "ticket_id": ticket.id, "line_sent": line_sent}
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.error("Zabbix webhook processing failed: %s", type(exc).__name__)
        raise HTTPException(status_code=500, detail="Webhook processing failed")
    finally:
        db.close()


@app.get("/api/dashboard/summary")
def dashboard_summary(db: Session = Depends(get_db)):
    result = db.execute(
        text("""
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'New') AS new,
                COUNT(*) FILTER (WHERE status = 'In Progress') AS in_progress,
                COUNT(*) FILTER (WHERE status = 'Closed') AS closed,
                COUNT(*) FILTER (
                    WHERE source IN ('zabbix', 'slack_zabbix')
                      AND status != 'Closed'
                ) AS open_zabbix,
                COUNT(*) FILTER (
                    WHERE source = 'manual'
                      AND status != 'Closed'
                ) AS manual_pending
            FROM tickets
        """)
    ).mappings().one()

    data = dict(result)
    db.rollback()
    return data

# ZABBIX_MONTHLY_TREND_API_V1
@app.get("/api/dashboard/zabbix-monthly-trend")
def zabbix_monthly_trend(
    year: int = datetime.now().year,
    db: Session = Depends(get_db),
):
    if year < 2000 or year > 2100:
        raise HTTPException(status_code=400, detail="Invalid year")

    rows = db.execute(
        text("""
            SELECT
                EXTRACT(MONTH FROM created_at)::INTEGER AS month,
                COUNT(*)::INTEGER AS count
            FROM tickets
            WHERE source IN ('zabbix', 'slack_zabbix')
              AND created_at IS NOT NULL
              AND EXTRACT(YEAR FROM created_at)::INTEGER = :year
            GROUP BY EXTRACT(MONTH FROM created_at)
            ORDER BY month
        """),
        {"year": year},
    ).mappings().all()

    count_by_month = {
        int(row["month"]): int(row["count"])
        for row in rows
    }

    months = [
        {
            "month": month,
            "month_key": f"{year}-{month:02d}",
            "count": count_by_month.get(month, 0),
        }
        for month in range(1, 13)
    ]

    highest = max(months, key=lambda item: item["count"])

    return {
        "year": year,
        "total": sum(item["count"] for item in months),
        "highest_month": highest["month"],
        "highest_count": highest["count"],
        "months": months,
    }


@app.get("/api/dashboard/analytics")
def dashboard_analytics(db: Session = Depends(get_db)):
    rows = db.execute(
        text("""
            WITH months AS (
                SELECT generate_series(
                    date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok') - interval '5 months',
                    date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok'),
                    interval '1 month'
                ) AS month_start
            )
            SELECT
                to_char(months.month_start, 'YYYY-MM') AS month_key,
                COUNT(t.id)::INTEGER AS total,
                COUNT(t.id) FILTER (
                    WHERE t.source IN ('zabbix', 'slack_zabbix')
                )::INTEGER AS zabbix,
                COUNT(t.id) FILTER (
                    WHERE t.source NOT IN ('zabbix', 'slack_zabbix') OR t.source IS NULL
                )::INTEGER AS manual
            FROM months
            LEFT JOIN tickets t
              ON t.created_at >= months.month_start
             AND t.created_at < months.month_start + interval '1 month'
            GROUP BY months.month_start
            ORDER BY months.month_start
        """)
    ).mappings().all()

    current_month_start = "date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')"
    top_hosts = db.execute(
        text(f"""
            SELECT COALESCE(NULLIF(BTRIM(host), ''), 'Unknown') AS host,
                   COUNT(*)::INTEGER AS alerts
            FROM tickets
            WHERE source IN ('zabbix', 'slack_zabbix')
              AND created_at >= {current_month_start}
              AND created_at < {current_month_start} + interval '1 month'
            GROUP BY COALESCE(NULLIF(BTRIM(host), ''), 'Unknown')
            ORDER BY alerts DESC, host ASC
            LIMIT 10
        """)
    ).mappings().all()

    severity_rows = db.execute(
        text(f"""
            SELECT severity_group, COUNT(*)::INTEGER AS count
            FROM (
                SELECT CASE
                    WHEN LOWER(BTRIM(COALESCE(severity, ''))) IN ('critical', 'disaster') THEN 'Critical'
                    WHEN LOWER(BTRIM(COALESCE(severity, ''))) IN ('high', 'major') THEN 'High'
                    WHEN LOWER(BTRIM(COALESCE(severity, ''))) IN ('average', 'medium') THEN 'Average'
                    WHEN LOWER(BTRIM(COALESCE(severity, ''))) IN ('warning', 'low', 'very low') THEN 'Warning'
                    WHEN LOWER(BTRIM(COALESCE(severity, ''))) IN ('information', 'info') THEN 'Information'
                    ELSE 'Unknown'
                END AS severity_group
                FROM tickets
                WHERE created_at >= {current_month_start}
                  AND created_at < {current_month_start} + interval '1 month'
            ) current_tickets
            GROUP BY severity_group
        """)
    ).mappings().all()

    source_row = db.execute(
        text(f"""
            SELECT
                COUNT(*)::INTEGER AS total,
                COUNT(*) FILTER (
                    WHERE source IN ('zabbix', 'slack_zabbix')
                )::INTEGER AS zabbix,
                COUNT(*) FILTER (
                    WHERE source NOT IN ('zabbix', 'slack_zabbix') OR source IS NULL
                )::INTEGER AS manual
            FROM tickets
            WHERE created_at >= {current_month_start}
              AND created_at < {current_month_start} + interval '1 month'
        """)
    ).mappings().one()

    recent_rows = db.execute(
        text("""
            SELECT id, host, title, status, created_at, updated_at,
                   GREATEST(
                       COALESCE(updated_at, created_at),
                       COALESCE(created_at, updated_at)
                   ) AS latest_at
            FROM tickets
            ORDER BY latest_at DESC NULLS LAST, id DESC
            LIMIT 10
        """)
    ).mappings().all()

    severity_counts = {row["severity_group"]: int(row["count"]) for row in severity_rows}
    severity_order = ["Critical", "High", "Average", "Warning", "Information", "Unknown"]
    total = int(source_row["total"])

    data = {
        "monthly_trend": [dict(row) for row in rows],
        "top_risk_hosts": [dict(row) for row in top_hosts],
        "severity_summary": [
            {"severity": severity, "count": severity_counts.get(severity, 0)}
            for severity in severity_order
        ],
        "source_summary": {
            "total": total,
            "zabbix": int(source_row["zabbix"]),
            "manual": int(source_row["manual"]),
        },
        "recent_activity": [
            {
                **dict(row),
                "created_at": str(row["created_at"]) if row["created_at"] else None,
                "updated_at": str(row["updated_at"]) if row["updated_at"] else None,
                "latest_at": str(row["latest_at"]) if row["latest_at"] else None,
            }
            for row in recent_rows
        ],
    }
    db.rollback()
    return data


# ============================================================
# AUTH_SYSTEM_V1
# ============================================================

AUTH_COOKIE_NAME = "incident_session"
AUTH_SESSION_DAYS = 7


def hash_password(password: str, salt: bytes | None = None) -> str:
    if not password or len(password) < 8:
        raise ValueError("Password must contain at least 8 characters")

    salt = salt or secrets.token_bytes(16)

    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        310000,
    )

    return (
        "pbkdf2_sha256$310000$"
        + base64.b64encode(salt).decode("ascii")
        + "$"
        + base64.b64encode(digest).decode("ascii")
    )


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt_text, digest_text = stored_hash.split("$", 3)

        if algorithm != "pbkdf2_sha256":
            return False

        salt = base64.b64decode(salt_text)
        expected = base64.b64decode(digest_text)

        actual = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            int(iterations),
        )

        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_current_user_optional(
    incident_session: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if not incident_session:
        return None

    token_hash = hash_session_token(incident_session)

    row = (
        db.query(SessionDB, UserDB)
        .join(UserDB, UserDB.id == SessionDB.user_id)
        .filter(
            SessionDB.token_hash == token_hash,
            SessionDB.expires_at > datetime.now(),
            UserDB.is_active == 1,
        )
        .first()
    )

    if not row:
        return None

    _, user = row
    return user


def require_user(
    user: UserDB | None = Depends(get_current_user_optional),
):
    if not user:
        raise HTTPException(status_code=401, detail="Login required")

    return user


def require_admin(
    user: UserDB = Depends(require_user),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin permission required")

    return user


@app.post("/api/auth/login")
def auth_login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    username = payload.username.strip().lower()

    user = (
        db.query(UserDB)
        .filter(UserDB.username == username)
        .first()
    )

    if (
        not user
        or user.is_active != 1
        or not verify_password(payload.password, user.password_hash)
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    token = secrets.token_urlsafe(48)
    expires_at = datetime.now() + timedelta(days=AUTH_SESSION_DAYS)

    db.query(SessionDB).filter(
        SessionDB.expires_at <= datetime.now()
    ).delete(synchronize_session=False)

    session = SessionDB(
        token_hash=hash_session_token(token),
        user_id=user.id,
        expires_at=expires_at,
        created_at=datetime.now(),
    )

    db.add(session)
    db.commit()

    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        max_age=AUTH_SESSION_DAYS * 86400,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )

    return {
        "ok": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role,
        },
    }


@app.post("/api/auth/logout")
def auth_logout(
    response: Response,
    incident_session: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if incident_session:
        db.query(SessionDB).filter(
            SessionDB.token_hash == hash_session_token(incident_session)
        ).delete(synchronize_session=False)

        db.commit()

    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        path="/",
        secure=True,
        httponly=True,
        samesite="lax",
    )

    return {"ok": True}


@app.get("/api/auth/me")
def auth_me(
    user: UserDB = Depends(require_user),
):
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
    }


# ============================================================
# API_SECURITY_MIDDLEWARE_V1
# ============================================================

PUBLIC_API_PATHS = {
    "/api/auth/login",
    "/api/auth/logout",
    "/api/slack/webhook",
    "/api/slack/events",
    "/api/line/webhook",
    "/api/line/test",
    "/api/zabbix/webhook",
}

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def resolve_user_from_token(db: Session, token: str | None):
    if not token:
        return None

    token_hash = hash_session_token(token)

    row = (
        db.query(SessionDB, UserDB)
        .join(UserDB, UserDB.id == SessionDB.user_id)
        .filter(
            SessionDB.token_hash == token_hash,
            SessionDB.expires_at > datetime.now(),
            UserDB.is_active == 1,
        )
        .first()
    )

    if not row:
        return None

    return row[1]


@app.middleware("http")
async def api_security_middleware(request: Request, call_next):
    path = request.url.path
    method = request.method.upper()

    # ไม่เกี่ยวกับ API
    if not path.startswith("/api/"):
        return await call_next(request)

    # Login/Logout และ Slack Webhook
    if path in PUBLIC_API_PATHS:
        return await call_next(request)

    token = request.cookies.get(AUTH_COOKIE_NAME)
    db = SessionLocal()

    try:
        user = resolve_user_from_token(db, token)

        if not user:
            return JSONResponse(
                status_code=401,
                content={"detail": "Login required"},
            )

        # Viewer อ่านได้อย่างเดียว
        if method not in SAFE_METHODS and user.role != "admin":
            return JSONResponse(
                status_code=403,
                content={"detail": "Admin permission required"},
            )

        request.state.current_user = user
        return await call_next(request)

    finally:
        db.close()
