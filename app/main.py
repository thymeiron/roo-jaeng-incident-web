import re
import os
import json
import hmac
import hashlib
import time
from datetime import datetime

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Float, JSON, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session


DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}/{DB_NAME}"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
)

SessionLocal = sessionmaker(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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


class CommentDB(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"))
    comment = Column(Text)
    created_by = Column(String)
    created_at = Column(DateTime)


Base.metadata.create_all(bind=engine)

app = FastAPI()


class TicketCreate(BaseModel):
    title: str
    detail: str = ""
    severity: str = "Medium"
    host: str = ""
    source: str = "manual"
    assigned_to: str = ""
    work_hours: float | None = None
    work_count: int | None = 1


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
def get_tickets():
    db = SessionLocal()
    try:
        rows = db.query(TicketDB).order_by(TicketDB.id.desc()).all()

        return [
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
            "work_hours": r.work_hours,
            "work_count": r.work_count,
                "created_at": str(r.created_at),
                "updated_at": str(r.updated_at),
            }
            for r in rows
        ]
    finally:
        db.close()






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

        closed_ids = []
        now = datetime.now()

        for ticket in matched_tickets:
            ticket.status = "Closed"
            ticket.updated_at = now
            closed_ids.append(ticket.id)

            comment = CommentDB(
                ticket_id=ticket.id,
                comment="Auto closed by Zabbix resolved alert.\n\n" + resolved_detail,
                created_at=now,
            )
            db.add(comment)

        db.commit()
        return closed_ids

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
        existing_ticket = (
            db.query(TicketDB)
            .filter(TicketDB.external_id == external_id)
            .first()
        )

        if existing_ticket:
            return {
                "ok": True,
                "duplicate": True,
                "ticket_id": existing_ticket.id,
            }

        now = datetime.now()

        ticket = TicketDB(
            title=parsed.get("title") or "Zabbix Alert",
            detail=parsed.get("detail") or text,
            severity=parsed.get("severity") or "Medium",
            status="New",
            host=parsed.get("host") or "-",
            source="slack_zabbix",
            assigned_to="",
            work_hours=None,
            work_count=1,
            external_id=external_id,
            slack_channel=channel,
            slack_ts=ts,
            raw_payload=payload,
            created_at=now,
            updated_at=now,
        )

        db.add(ticket)
        db.commit()
        db.refresh(ticket)

        return {
            "ok": True,
            "ticket_id": ticket.id,
            "external_id": external_id,
        }
    finally:
        db.close()
