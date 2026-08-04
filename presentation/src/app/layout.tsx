import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roo-Jaeng — Incident Notification & Operations Platform",
  description: "Roo-Jaeng เปลี่ยนทุก Alert ให้เป็นงานที่มีผู้รับผิดชอบ ติดตาม และปิดงานได้",
  icons: { icon: "./icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07111f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
