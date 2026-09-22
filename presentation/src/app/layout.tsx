import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roo-Jaeng — Zabbix Alerts on iPhone",
  description: "รับ Zabbix Alert บน iPhone ผ่าน Roo-Jaeng พร้อมคู่มือติดตั้งบน Home Screen และเปิด Notification",
  icons: { icon: "./icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
