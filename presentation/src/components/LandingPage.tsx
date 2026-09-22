import type { ReactNode } from "react";
import { Icon } from "./Icons";

const appUrl = "https://roo-jaeng.com";

function Brand() {
  return <span className="brand"><span className="brand-icon"><Icon name="bell" /></span><span><strong>Roo-Jaeng</strong><small>Incident Workflow</small></span></span>;
}

export function Navbar() {
  return <header className="navbar"><nav className="container nav-inner" aria-label="Main navigation"><a href="#top" aria-label="Roo-Jaeng homepage"><Brand /></a><div className="nav-links"><a href="#how-it-works">How it works</a><a href="#quick-guide">Quick Guide</a><a className="button button-small" href={appUrl}>Open Roo-Jaeng <Icon name="arrow-right" /></a></div></nav></header>;
}

function FlowLabel() {
  return <p className="flow-label"><span>Zabbix</span><span aria-hidden="true">→</span><strong>Roo-Jaeng</strong><span aria-hidden="true">→</span><span>iPhone</span></p>;
}

export function NotificationPreview({ incident = false }: { incident?: boolean }) {
  return <article className={`notification ${incident ? "notification-incident" : ""}`} aria-label="Example Roo-Jaeng notification"><div className="notification-header"><span className="notification-icon"><Icon name="bell" /></span><strong>Roo-Jaeng</strong><small>just now</small></div><div className="notification-body"><h3><span className="warning-symbol" aria-hidden="true">⚠</span> {incident ? "Problem Detected" : "Zabbix Alert"}</h3><p>Host: <strong>HSVECP01</strong></p>{incident && <p>Severity: <span className="warning-text">Warning</span></p>}<p className="notification-message">/var filesystem usage reached 95%</p>{incident ? <a className="incident-link" href={appUrl}>View Incident <Icon name="arrow-right" /></a> : <small className="warning-text">Warning <span className="muted">• just now</span></small>}</div></article>;
}

export function Hero() {
  return <section className="container hero" aria-labelledby="hero-title"><div className="hero-copy"><p className="eyebrow"><span className="orange-dot" /> INFRASTRUCTURE. IN REACH.</p><h1 id="hero-title">Zabbix Alerts.<br />Right on your<br /><span>iPhone.</span></h1><p className="hero-description" lang="th">เมื่อ Infrastructure มีปัญหา Roo-Jaeng รับ Alert จาก Zabbix และส่ง Notification ถึงผู้รับผิดชอบได้ทันที</p><a className="button" href="#quick-guide">ดูวิธีเปิดใช้งาน <span aria-hidden="true">↓</span></a><FlowLabel /></div><figure className="phone-stage"><div className="phone"><div className="phone-status" aria-hidden="true"><span>9:41</span><span>▂▄▆ ▰</span></div><div className="phone-island" aria-hidden="true" /><div className="phone-date" aria-hidden="true">Tuesday, September 22<strong>09:41</strong></div><NotificationPreview /><div className="phone-bottom" aria-hidden="true"><Icon name="shield" /><span /></div></div><figcaption><span className="orange-dot" /> ตัวอย่าง Notification บน iPhone</figcaption></figure></section>;
}

export function AlertFlow() {
  const cards = [
    { icon: "chart" as const, title: "Zabbix Alert", text: "ระบบ Monitoring ตรวจพบปัญหา", label: "DETECT" },
    { icon: "ticket" as const, title: "Roo-Jaeng Webhook", text: "รับ Alert และประมวลผล Incident", label: "PROCESS" },
    { icon: "bell" as const, title: "iPhone Notification", text: "แจ้งเตือนผู้รับผิดชอบทันที", label: "NOTIFY" },
  ];
  return <section id="how-it-works" className="section flow-section" aria-labelledby="flow-title"><div className="container"><div className="section-heading"><p className="eyebrow">HOW IT WORKS</p><h2 id="flow-title">From Alert to Action</h2><p>ลดขั้นตอนจาก Monitoring Alert ไปถึงผู้รับผิดชอบ</p></div><ol className="flow-cards">{cards.map((card, index) => <li key={card.title}><div className="flow-card-top"><span className="outline-icon"><Icon name={card.icon} /></span><small>0{index + 1} / {card.label}</small></div><h3>{card.title}</h3><p>{card.text}</p>{index < 2 && <span className="connector" aria-hidden="true">→</span>}</li>)}</ol></div></section>;
}

export function GuideStep({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return <li className="guide-step"><span className="step-number" aria-hidden="true">{number}</span><div><h4>{title}</h4><div className="step-description">{children}</div></div></li>;
}

export function QuickGuide() {
  return <section id="quick-guide" className="container section" aria-labelledby="guide-title"><div className="section-heading"><p className="eyebrow">QUICK GUIDE</p><h2 id="guide-title">เริ่มใช้งาน Roo-Jaeng บน iPhone</h2><p>ติดตั้ง Roo-Jaeng บน Home Screen และเปิด Notification เพียงไม่กี่ขั้นตอน</p></div><div className="guides"><article className="guide-panel"><div className="guide-heading"><span className="outline-icon"><Icon name="plus" /></span><p className="eyebrow">GUIDE 01 · INSTALL</p><h3>Add Roo-Jaeng<br />to Home Screen</h3><p>เพิ่มทางลัด เพื่อเปิดใช้งานได้ทันที</p></div><ol className="steps"><GuideStep number={1} title="เปิด Safari">เปิด Safari บน iPhone</GuideStep><GuideStep number={2} title="เข้า Roo-Jaeng">เปิด <a href={appUrl}>roo-jaeng.com <span aria-hidden="true">↗</span></a></GuideStep><GuideStep number={3} title="Login">Login ด้วย User ของ Roo-Jaeng</GuideStep><GuideStep number={4} title="กด Share">กดปุ่ม Share ของ Safari <Icon name="share" /></GuideStep><GuideStep number={5} title="Add to Home Screen">เลือก <strong>Add to Home Screen</strong></GuideStep><GuideStep number={6} title="กด Add">ตรวจสอบชื่อ <strong>Roo-Jaeng</strong> แล้วกด <strong>Add</strong></GuideStep><GuideStep number={7} title="เปิด Roo-Jaeng">เปิด Roo-Jaeng จาก Icon บน Home Screen</GuideStep></ol><aside className="info-callout"><span aria-hidden="true">ⓘ</span><div><strong>สำคัญ</strong><p>หลังจาก Add to Home Screen แล้ว ให้เปิด Roo-Jaeng ผ่าน Icon บน Home Screen แทนการเปิดจาก Safari</p></div></aside></article><article className="guide-panel notification-guide"><div className="guide-heading"><span className="outline-icon"><Icon name="bell" /></span><p className="eyebrow">GUIDE 02 · ENABLE</p><h3>เปิด Notification<br />เพื่อรับ Zabbix Alert</h3><p>หลังจากติดตั้ง Roo-Jaeng บน Home Screen แล้ว ให้เปิด Notification เพื่อรับ Alert จาก Zabbix</p></div><ol className="steps"><GuideStep number={1} title="เปิด Roo-Jaeng">เปิด Roo-Jaeng จาก Home Screen</GuideStep><GuideStep number={2} title="Login">Login ด้วย User ของ Roo-Jaeng</GuideStep><GuideStep number={3} title="Enable Notifications">กด <strong>Enable Notifications</strong></GuideStep><GuideStep number={4} title="Allow">กด <strong>Allow</strong> เพื่ออนุญาตการแจ้งเตือน</GuideStep><GuideStep number={5} title="ตรวจสอบสถานะ">ตรวจสอบสถานะ <strong>Notifications Enabled</strong></GuideStep></ol><div className="enabled-preview"><span className="enabled-badge"><Icon name="check" /> Notifications Enabled</span><p>ตัวอย่างสถานะเมื่อเปิดการแจ้งเตือนสำเร็จ</p></div></article></div></section>;
}

export function Success() {
  return <section className="success-section section" aria-labelledby="success-title"><div className="container success-grid"><div><p className="eyebrow"><Icon name="check" /> YOU’RE ALL SET</p><h2 id="success-title">พร้อมรับ Alert</h2><p className="success-description">เมื่อ Zabbix ตรวจพบปัญหา Roo-Jaeng จะรับ Event ผ่าน Webhook และส่ง Notification ไปยัง iPhone ของผู้ใช้งาน</p><FlowLabel /></div><div className="success-preview"><p className="preview-label">ตัวอย่างการแจ้งเตือน</p><NotificationPreview incident /></div></div></section>;
}

export function Troubleshooting() {
  const checks = [<>Roo-Jaeng ถูก Add ไว้บน Home Screen แล้ว</>, <>เปิด Roo-Jaeng จาก Home Screen</>, <>Login สำเร็จแล้ว</>, <>Notification อยู่ในสถานะ Enabled</>, <>ตรวจสอบ <strong>Settings → Notifications → Roo-Jaeng</strong></>, <>ตรวจสอบว่า <strong>Allow Notifications</strong> เปิดอยู่</>];
  return <section className="container troubleshooting section" aria-labelledby="help-title"><div><p className="eyebrow">NEED A HAND?</p><h2 id="help-title">ไม่ได้รับ Notification?</h2><p>ตรวจสอบขั้นตอนเหล่านี้อีกครั้ง</p></div><ul>{checks.map((item, index) => <li key={index}><Icon name="check" /><span>{item}</span></li>)}</ul></section>;
}

export function Footer() {
  return <footer className="footer"><div className="container footer-inner"><div><strong>Roo-Jaeng</strong><p>Incident Workflow System for IDS Support</p></div><FlowLabel /></div></footer>;
}
