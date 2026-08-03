"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getReadyServiceWorker } from "./RegisterServiceWorker";

type PermissionState = NotificationPermission | "unsupported";

function isStandalone() {
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    iosNavigator.standalone === true
  );
}

function isIOS() {
  return (
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent)
  );
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function responseJson(response: Response, action: string) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof data.detail === "string" ? `: ${data.detail}` : "";
    const loginHint = response.status === 401 ? " กรุณาเข้าสู่ระบบใหม่ใน PWA" : "";
    throw new Error(
      `${action} ไม่สำเร็จ (HTTP ${response.status})${detail}${loginHint}`,
    );
  }
  return data;
}

function reportPushError(action: string, reason: unknown) {
  console.error("Web Push operation failed", {
    action,
    name: reason instanceof Error ? reason.name : "UnknownError",
    message: reason instanceof Error ? reason.message : "Unknown error",
  });
}

export default function NotificationSettings() {
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<PermissionState>("unsupported");
  const [standalone, setStandalone] = useState(false);
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refreshStatus = useCallback(async () => {
    const browserSupported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    const currentStandalone = isStandalone();

    setSupported(browserSupported);
    setStandalone(currentStandalone);
    setPermission(
      "Notification" in window ? Notification.permission : "unsupported",
    );
    setSubscribed(false);
    setSubscriptionCount(0);

    if (!browserSupported) return;

    const response = await fetch("/api/push/status", {
      credentials: "include",
      cache: "no-store",
    });
    const data = await responseJson(response, "ตรวจสอบสถานะจาก Backend");
    setSubscriptionCount(data.subscription_count || 0);

    const registration = await getReadyServiceWorker();
    const currentSubscription =
      await registration.pushManager.getSubscription();
    setSubscribed(Boolean(currentSubscription));
  }, []);

  const closeSettings = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeSettings();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeSettings, open]);

  function toggleSettings() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      setError("");
      refreshStatus().catch((reason) => {
        reportPushError("refresh-status", reason);
        setError(reason instanceof Error ? reason.message : "ตรวจสอบสถานะไม่ได้");
      });
    }
  }

  async function enableNotifications() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!("serviceWorker" in navigator)) {
        throw new Error("Browser นี้ไม่รองรับ Service Worker");
      }
      if (!("PushManager" in window) || !("Notification" in window)) {
        throw new Error("Browser นี้ไม่รองรับ Web Push");
      }
      if (isIOS() && !isStandalone()) {
        throw new Error(
          "กรุณาเพิ่ม Roo-Jaeng ไปยังหน้าจอโฮม แล้วเปิดจากไอคอน Roo-Jaeng เพื่อเปิดการแจ้งเตือน",
        );
      }

      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        throw new Error(
          nextPermission === "denied"
            ? "การแจ้งเตือนถูกปฏิเสธ กรุณาเปิดสิทธิ์ในการตั้งค่าของอุปกรณ์"
            : "ยังไม่ได้อนุญาตการแจ้งเตือน",
        );
      }

      const registration = await getReadyServiceWorker().catch((reason) => {
        throw new Error(
          `เตรียม Service Worker ไม่สำเร็จ: ${reason instanceof Error ? reason.message : "Unknown error"}`,
        );
      });
      const publicKeyResponse = await fetch("/api/push/public-key", {
        credentials: "include",
        cache: "no-store",
      });
      const { public_key: publicKey } = await responseJson(
        publicKeyResponse,
        "ดึง VAPID public key",
      );
      if (typeof publicKey !== "string" || !publicKey.trim()) {
        throw new Error("ดึง VAPID public key ไม่สำเร็จ: Backend คืนค่าไม่ถูกต้อง");
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        try {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey.trim()),
          });
        } catch (reason) {
          throw new Error(
            `PushManager.subscribe ล้มเหลว: ${reason instanceof Error ? `${reason.name}: ${reason.message}` : "Unknown error"}`,
          );
        }
      }

      await responseJson(
        await fetch("/api/push/subscribe", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        }),
        "Backend บันทึก subscription",
      );
      setMessage("เปิดการแจ้งเตือนบนอุปกรณ์นี้แล้ว");
      await refreshStatus();
    } catch (reason) {
      reportPushError("enable-notifications", reason);
      setError(
        reason instanceof Error ? reason.message : "เปิดการแจ้งเตือนไม่สำเร็จ",
      );
    } finally {
      setBusy(false);
    }
  }

  async function testNotifications() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await responseJson(
        await fetch("/api/push/test", {
          method: "POST",
          credentials: "include",
        }),
        "ส่งการแจ้งเตือนทดสอบ",
      );
      const sent = Number(result.push?.sent || 0);
      const failed = Number(result.push?.failed || 0);
      const expired = Number(result.push?.expired || 0);
      setMessage(`ผลทดสอบ: ส่งสำเร็จ ${sent}, ล้มเหลว ${failed}, หมดอายุ ${expired}`);
    } catch (reason) {
      reportPushError("test-notifications", reason);
      setError(
        reason instanceof Error ? reason.message : "ทดสอบการแจ้งเตือนไม่สำเร็จ",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disableNotifications() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const registration = await getReadyServiceWorker();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await responseJson(
          await fetch("/api/push/unsubscribe", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          }),
          "Backend ยกเลิก subscription",
        );
        await subscription.unsubscribe();
      }
      setMessage("ปิดการแจ้งเตือนบนอุปกรณ์นี้แล้ว");
      await refreshStatus();
    } catch (reason) {
      reportPushError("disable-notifications", reason);
      setError(
        reason instanceof Error ? reason.message : "ปิดการแจ้งเตือนไม่สำเร็จ",
      );
    } finally {
      setBusy(false);
    }
  }

  const iosNeedsInstallation = isIOS() && !standalone;

  return (
    <div className="notification-settings">
      <button type="button" onClick={toggleSettings} style={styles.trigger}>
        การแจ้งเตือน
      </button>
      {open &&
        createPortal(
          <div
            className="notification-settings-overlay"
            onClick={closeSettings}
            role="presentation"
          >
            <section
              className="notification-settings-panel"
              aria-label="Notification settings"
              aria-modal="true"
              role="dialog"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="notification-settings-close"
                aria-label="ปิด Notification Settings"
                onClick={closeSettings}
              >
                ×
              </button>
              <strong className="notification-settings-title">
                Notification Settings
              </strong>
              <div>Browser รองรับ: {supported ? "รองรับ" : "ไม่รองรับ"}</div>
              <div>PWA / standalone: {standalone ? "ใช่" : "ไม่ใช่"}</div>
              <div>Permission: {permission}</div>
              <div>
                อุปกรณ์นี้: {subscribed ? "สมัครแล้ว" : "ยังไม่สมัคร"}{" "}
                (บัญชีนี้ทั้งหมด {subscriptionCount} อุปกรณ์)
              </div>
              {iosNeedsInstallation && (
                <p style={styles.hint}>
                  กรุณาเพิ่ม Roo-Jaeng ไปยังหน้าจอโฮมด้วย Add to Home Screen
                  แล้วเปิดจากไอคอน Roo-Jaeng เพื่อเปิดการแจ้งเตือน
                </p>
              )}
              {message && <p style={styles.success}>{message}</p>}
              {error && <p style={styles.error}>{error}</p>}
              <div className="notification-settings-actions">
                <button
                  type="button"
                  disabled={busy || !supported || iosNeedsInstallation}
                  onClick={enableNotifications}
                >
                  เปิดการแจ้งเตือน
                </button>
                <button
                  type="button"
                  disabled={busy || !subscribed}
                  onClick={testNotifications}
                >
                  ทดสอบการแจ้งเตือน
                </button>
                <button
                  type="button"
                  disabled={busy || !subscribed}
                  onClick={disableNotifications}
                >
                  ปิดการแจ้งเตือน
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </div>
  );
}

const styles = {
  trigger: {
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "8px 10px",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 700,
    cursor: "pointer",
  },
  hint: { color: "#92400e", background: "#fef3c7", padding: "8px", borderRadius: "8px" },
  success: { color: "#166534" },
  error: { color: "#b91c1c" },
} as const;
