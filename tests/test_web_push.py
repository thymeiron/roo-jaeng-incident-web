import importlib
import os
import sys
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def application(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("ZABBIX_WEBHOOK_TOKEN", "test-webhook-token")
    monkeypatch.setenv("VAPID_PUBLIC_KEY", "test-public-key")
    monkeypatch.setenv("VAPID_PRIVATE_KEY", "test-private-key")
    monkeypatch.setenv("VAPID_SUBJECT", "mailto:test@example.com")
    monkeypatch.setenv("WEB_PUSH_ENABLED", "true")
    sys.modules.pop("main", None)
    app_path = os.path.abspath("app")
    sys.path.insert(0, app_path)
    module = importlib.import_module("main")
    yield module
    module.engine.dispose()
    sys.modules.pop("main", None)
    sys.path.remove(app_path)


def add_user_and_session(application, username):
    db = application.SessionLocal()
    user = application.UserDB(
        username=username,
        password_hash="not-used",
        role="viewer",
        is_active=1,
        created_at=datetime.now(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = f"session-{username}"
    db.add(
        application.SessionDB(
            token_hash=application.hash_session_token(token),
            user_id=user.id,
            expires_at=datetime.now() + timedelta(days=1),
            created_at=datetime.now(),
        ),
    )
    db.commit()
    db.close()
    return user.id, token


def subscription(endpoint):
    return {
        "endpoint": endpoint,
        "expirationTime": None,
        "keys": {"p256dh": "p" * 32, "auth": "a" * 16},
    }


def zabbix_problem(event_id="1001"):
    return {
        "event_id": event_id,
        "event_status": "PROBLEM",
        "event_value": "1",
        "event_name": "Filesystem usage 90%",
        "trigger_id": "9001",
        "host": "HSVCSP01",
        "host_ip": "192.0.2.10",
        "severity": "High",
        "detail": "Filesystem /sap/CSP usage 90%",
        "event_date": "2026-07-31",
        "event_time": "12:00:00",
    }


def test_push_routes_require_login(application):
    client = TestClient(application.app, base_url="https://testserver")
    assert client.get("/api/push/public-key").status_code == 401
    assert client.get("/api/push/status").status_code == 401
    assert client.post(
        "/api/push/subscribe",
        json=subscription("https://push.example.test/anonymous"),
    ).status_code == 401
    assert client.post("/api/push/test").status_code == 401
    assert client.post(
        "/api/push/unsubscribe",
        json={"endpoint": "https://push.example.test/anonymous"},
    ).status_code == 401


def test_subscribe_is_idempotent_and_supports_multiple_devices(application):
    _, token = add_user_and_session(application, "first")
    client = TestClient(application.app, base_url="https://testserver")
    client.cookies.set(application.AUTH_COOKIE_NAME, token)
    first = subscription("https://push.example.test/device-1")
    assert client.post("/api/push/subscribe", json=first).status_code == 200
    assert client.post("/api/push/subscribe", json=first).status_code == 200
    assert client.post(
        "/api/push/subscribe",
        json=subscription("https://push.example.test/device-2"),
    ).status_code == 200
    db = application.SessionLocal()
    assert db.query(application.PushSubscriptionDB).count() == 2
    db.close()


def test_subscribe_updates_status_for_current_user(application):
    _, token = add_user_and_session(application, "status-user")
    client = TestClient(application.app, base_url="https://testserver")
    client.cookies.set(application.AUTH_COOKIE_NAME, token)

    before = client.get("/api/push/status")
    assert before.status_code == 200
    assert before.json()["subscription_count"] == 0

    response = client.post(
        "/api/push/subscribe",
        json=subscription("https://push.example.test/status-device"),
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True

    after = client.get("/api/push/status")
    assert after.status_code == 200
    assert after.json()["subscribed"] is True
    assert after.json()["subscription_count"] == 1


def test_subscribe_existing_endpoint_is_upserted(application):
    first_id, first_token = add_user_and_session(application, "upsert-first")
    second_id, second_token = add_user_and_session(application, "upsert-second")
    endpoint = "https://push.example.test/upsert-device"
    first = TestClient(application.app, base_url="https://testserver")
    first.cookies.set(application.AUTH_COOKIE_NAME, first_token)
    assert first.post("/api/push/subscribe", json=subscription(endpoint)).status_code == 200

    replacement = subscription(endpoint)
    replacement["keys"] = {"p256dh": "q" * 32, "auth": "b" * 16}
    second = TestClient(application.app, base_url="https://testserver")
    second.cookies.set(application.AUTH_COOKIE_NAME, second_token)
    assert second.post("/api/push/subscribe", json=replacement).status_code == 200

    db = application.SessionLocal()
    stored = db.query(application.PushSubscriptionDB).one()
    assert stored.user_id == second_id
    assert stored.user_id != first_id
    assert stored.p256dh == "q" * 32
    assert stored.auth == "b" * 16
    db.close()


def test_push_test_without_subscription_is_clear(application):
    _, token = add_user_and_session(application, "no-subscription")
    client = TestClient(application.app, base_url="https://testserver")
    client.cookies.set(application.AUTH_COOKIE_NAME, token)

    response = client.post("/api/push/test")
    assert response.status_code == 404
    assert response.json()["detail"] == "No Push subscription for this user"


def test_push_test_sends_current_users_subscription(application, monkeypatch):
    user_id, token = add_user_and_session(application, "push-test")
    db = application.SessionLocal()
    db.add(
        application.PushSubscriptionDB(
            user_id=user_id,
            endpoint="https://push.example.test/test-device",
            p256dh="p" * 32,
            auth="a" * 16,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        ),
    )
    db.commit()
    db.close()
    captured = []

    def fake_send(db, subscriptions, payload):
        captured.extend(subscriptions)
        assert payload == {
            "title": "🔔 Test",
            "body": "Roo-Jaeng notification OK",
            "data": {"url": "/"},
        }
        return {"sent": 1, "failed": 0, "expired": 0}

    monkeypatch.setattr(application, "send_web_push_notification", fake_send)
    client = TestClient(application.app, base_url="https://testserver")
    client.cookies.set(application.AUTH_COOKIE_NAME, token)

    response = client.post("/api/push/test")
    assert response.status_code == 200
    assert response.json()["push"]["sent"] == 1
    assert len(captured) == 1
    assert captured[0].user_id == user_id


def test_user_cannot_unsubscribe_another_users_device(application):
    first_id, first_token = add_user_and_session(application, "first")
    _, second_token = add_user_and_session(application, "second")
    endpoint = "https://push.example.test/owned-by-first"
    first = TestClient(application.app, base_url="https://testserver")
    first.cookies.set(application.AUTH_COOKIE_NAME, first_token)
    assert first.post("/api/push/subscribe", json=subscription(endpoint)).status_code == 200

    second = TestClient(application.app, base_url="https://testserver")
    second.cookies.set(application.AUTH_COOKIE_NAME, second_token)
    response = second.post("/api/push/unsubscribe", json={"endpoint": endpoint})
    assert response.status_code == 200
    assert response.json()["unsubscribed"] is False
    db = application.SessionLocal()
    stored = db.query(application.PushSubscriptionDB).one()
    assert stored.user_id == first_id
    db.close()


def test_new_zabbix_event_pushes_once_but_duplicate_does_not(application, monkeypatch):
    payloads = []

    def fake_push(db, ticket, event, recovered=False):
        payloads.append(application.ticket_push_payload(ticket, event, recovered))
        return {"sent": 1, "failed": 0, "expired": 0}

    monkeypatch.setattr(application, "send_ticket_web_push", fake_push)
    client = TestClient(application.app, base_url="https://testserver")
    headers = {"X-Webhook-Token": "test-webhook-token"}
    first = client.post("/api/zabbix/webhook", json=zabbix_problem(), headers=headers)
    duplicate = client.post("/api/zabbix/webhook", json=zabbix_problem(), headers=headers)
    assert first.status_code == 200
    assert first.json()["action"] == "created"
    ticket_id = first.json()["ticket_id"]
    assert duplicate.status_code == 200
    assert duplicate.json()["duplicate"] is True
    assert payloads == [{
        "title": "🔴 Problem",
        "body": "HSVCSP01 | High | Filesystem usage 90%",
        "data": {"url": f"/tickets/{ticket_id}"},
    }]


def test_zabbix_recovery_push_has_recovered_format(application, monkeypatch):
    payloads = []

    def fake_push(db, ticket, event, recovered=False):
        payloads.append(application.ticket_push_payload(ticket, event, recovered))
        return {"sent": 1, "failed": 0, "expired": 0}

    monkeypatch.setattr(application, "send_ticket_web_push", fake_push)
    client = TestClient(application.app, base_url="https://testserver")
    headers = {"X-Webhook-Token": "test-webhook-token"}
    problem = client.post("/api/zabbix/webhook", json=zabbix_problem("recovery-1"), headers=headers)
    recovery_event = zabbix_problem("recovery-2")
    recovery_event.update({"event_status": "OK", "event_value": "0"})
    recovery = client.post("/api/zabbix/webhook", json=recovery_event, headers=headers)

    assert problem.status_code == 200
    assert recovery.status_code == 200
    assert recovery.json()["action"] == "closed"
    assert payloads[-1] == {
        "title": "✅ Recovered",
        "body": "HSVCSP01 | Filesystem usage 90% normal",
        "data": {"url": f"/tickets/{problem.json()['ticket_id']}"},
    }


def test_ticket_push_payload_truncates_long_trigger(application):
    ticket = type("Ticket", (), {
        "id": 42,
        "host": "HOST-01",
        "title": "fallback",
        "severity": "High",
    })()
    event = {"event_name": "A" * 150}

    payload = application.ticket_push_payload(ticket, event)

    trigger = payload["body"].split(" | ", 2)[2]
    assert len(trigger) == application.PUSH_TRIGGER_MAX_LENGTH
    assert len(trigger) <= 70
    assert trigger.endswith("…")


def test_ticket_push_payload_keeps_short_text_and_ticket_url_in_data(application):
    ticket = type("Ticket", (), {
        "id": 42,
        "host": "HOST-01",
        "title": "fallback",
        "severity": "High",
    })()
    event = {
        "host": "HOST-01",
        "severity": "High",
        "event_name": "Filesystem usage 90%",
    }

    problem = application.ticket_push_payload(ticket, event)
    recovered = application.ticket_push_payload(ticket, event, recovered=True)

    assert problem == {
        "title": "🔴 Problem",
        "body": "HOST-01 | High | Filesystem usage 90%",
        "data": {"url": "/tickets/42"},
    }
    assert recovered == {
        "title": "✅ Recovered",
        "body": "HOST-01 | Filesystem usage 90% normal",
        "data": {"url": "/tickets/42"},
    }
    assert problem["data"]["url"] not in problem["title"] + problem["body"]
    assert recovered["data"]["url"] not in recovered["title"] + recovered["body"]


def test_push_failure_does_not_rollback_ticket(application, monkeypatch):
    monkeypatch.setattr(
        application,
        "send_ticket_web_push",
        lambda *args, **kwargs: {"sent": 0, "failed": 1, "expired": 0},
    )
    client = TestClient(application.app, base_url="https://testserver")
    response = client.post(
        "/api/zabbix/webhook",
        json=zabbix_problem("1002"),
        headers={"X-Webhook-Token": "test-webhook-token"},
    )
    assert response.status_code == 200
    db = application.SessionLocal()
    assert db.query(application.TicketDB).filter_by(external_id="zabbix:1002").one()
    db.close()


def test_expired_subscription_is_removed(application, monkeypatch):
    user_id, _ = add_user_and_session(application, "first")
    db = application.SessionLocal()
    stored = application.PushSubscriptionDB(
        user_id=user_id,
        endpoint="https://push.example.test/expired",
        p256dh="p" * 32,
        auth="a" * 16,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(stored)
    db.commit()

    class FakeResponse:
        status_code = 410

    class FakeWebPushException(Exception):
        response = FakeResponse()

    def fake_webpush(**kwargs):
        raise FakeWebPushException()

    fake_module = type(
        "FakePyWebPush",
        (),
        {"WebPushException": FakeWebPushException, "webpush": staticmethod(fake_webpush)},
    )
    monkeypatch.setitem(sys.modules, "pywebpush", fake_module)
    result = application.send_web_push_notification(
        db,
        [stored],
        {"title": "Test", "body": "Test", "url": "/"},
    )
    assert result["expired"] == 1
    assert db.query(application.PushSubscriptionDB).count() == 0
    db.close()


def test_zabbix_webhook_does_not_call_line(application, monkeypatch):
    monkeypatch.setattr(
        application,
        "send_line_push_message",
        lambda message: pytest.fail("LINE must not be called"),
    )
    monkeypatch.setattr(
        application,
        "send_ticket_web_push",
        lambda *args, **kwargs: {"sent": 0, "failed": 0, "expired": 0},
    )
    client = TestClient(application.app, base_url="https://testserver")
    response = client.post(
        "/api/zabbix/webhook",
        json=zabbix_problem("1003"),
        headers={"X-Webhook-Token": "test-webhook-token"},
    )
    assert response.status_code == 200
