import os
import json
import hmac
import hashlib
import time
from datetime import datetime

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    JSON,
)
from sqlalchemy.orm import declarative_base, sessionmaker


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


class StatusUpdate(BaseModel):
    status: str


class AssignUpdate(BaseModel):
    assigned_to: str


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
                "created_at": str(r.created_at),
                "updated_at": str(r.updated_at),
            }
            for r in rows
        ]
    finally:
        db.close()


@app.get("/api/tickets/{ticket_id}")
def get_ticket(ticket_id: int):
    db = SessionLocal()
    try:
        ticket = db.query(TicketDB).filter(TicketDB.id == ticket_id).first()

        if not ticket:
            raise HTTPException(status_code=404, detail="ticket not found")

        comments = (
            db.query(CommentDB)
            .filter(CommentDB.ticket_id == ticket_id)
            .order_by(CommentDB.id.asc())
            .all()
        )

        return {
            "id": ticket.id,
            "title": ticket.title,
            "detail": ticket.detail,
            "severity": ticket.severity,
            "status": ticket.status,
            "host": ticket.host,
            "source": ticket.source,
            "assigned_to": ticket.assigned_to,
            "created_at": str(ticket.created_at),
            "updated_at": str(ticket.updated_at),
            "comments": [
                {
                    "id": c.id,
                    "comment": c.comment,
                    "created_by": c.created_by,
                    "created_at": str(c.created_at),
                }
                for c in comments
            ],
        }
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
        ticket.updated_at = datetime.now()

        db.commit()

        return {
            "id": ticket.id,
            "assigned_to": ticket.assigned_to,
            "message": "assigned updated",
        }
    finally:
        db.close()


@app.post("/api/tickets/{ticket_id}/comments")
def add_comment(ticket_id: int, data: CommentCreate):
    db = SessionLocal()
    try:
        ticket = db.query(TicketDB).filter(TicketDB.id == ticket_id).first()

        if not ticket:
            raise HTTPException(status_code=404, detail="ticket not found")

        row = CommentDB(
            ticket_id=ticket_id,
            comment=data.comment,
            created_by=data.created_by,
            created_at=datetime.now(),
        )

        ticket.updated_at = datetime.now()

        db.add(row)
        db.commit()
        db.refresh(row)

        return {
            "id": row.id,
            "message": "comment added",
        }
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

    if event.get("type") != "message":
        return {"ok": True}

    subtype = event.get("subtype")

    ignored_subtypes = [
        "message_changed",
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

    text = extract_slack_message_text(event)
    channel = event.get("channel", "")
    ts = event.get("ts", "")

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
