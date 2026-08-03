"use client";

import { useEffect } from "react";

const SERVICE_WORKER_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(
      () => reject(new Error(message)),
      SERVICE_WORKER_TIMEOUT_MS,
    );
    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (reason) => {
        window.clearTimeout(timeoutId);
        reject(reason);
      },
    );
  });
}

export async function getReadyServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("ไม่พบ Service Worker ใน Browser นี้");
  }

  await withTimeout(
    navigator.serviceWorker.register("/sw.js", { scope: "/" }),
    "ลงทะเบียน Service Worker ไม่สำเร็จภายในเวลาที่กำหนด",
  );
  return withTimeout(
    navigator.serviceWorker.ready,
    "Service Worker ยังไม่พร้อมใช้งาน กรุณาปิดและเปิด Roo-Jaeng ใหม่",
  );
}

export default function RegisterServiceWorker() {
  useEffect(() => {
    getReadyServiceWorker().catch((reason) => {
      console.error("Service Worker registration failed", {
        name: reason instanceof Error ? reason.name : "UnknownError",
        message: reason instanceof Error ? reason.message : "Unknown error",
      });
    });
  }, []);

  return null;
}
