import re
from pathlib import Path


SERVICE_WORKER = Path(__file__).parents[1] / "frontend" / "public" / "sw.js"


def service_worker_source():
    return SERVICE_WORKER.read_text(encoding="utf-8")


def event_handler(source, event_name):
    start = source.index(f'self.addEventListener("{event_name}"')
    next_handler = source.find("self.addEventListener(", start + 1)
    return source[start:] if next_handler == -1 else source[start:next_handler]


def test_show_notification_uses_only_title_body_and_data():
    push_handler = event_handler(service_worker_source(), "push")
    call = re.search(
        r"showNotification\(title,\s*\{(?P<options>.*?)\}\)",
        push_handler,
        re.DOTALL,
    )

    assert call is not None
    options = call.group("options")
    assert re.search(r"\bbody\s*,", options)
    assert re.search(r"\bdata\s*,", options)
    assert not re.search(r"\b(icon|badge|tag)\s*[:,]", options)


def test_notification_click_navigates_existing_client_or_opens_ticket_url():
    click_handler = event_handler(service_worker_source(), "notificationclick")

    assert "event.notification.close()" in click_handler
    assert "event.notification.data?.url" in click_handler
    assert 'typeof url !== "string" || !url.trim()' in click_handler
    assert "return;" in click_handler
    assert 'matchAll({ type: "window", includeUncontrolled: true })' in click_handler
    assert "rooJaengClient.navigate(url)" in click_handler
    assert "rooJaengClient.focus()" in click_handler
    assert "self.clients.openWindow(url)" in click_handler
