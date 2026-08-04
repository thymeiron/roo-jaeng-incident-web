import { slides } from "@/data/slides";
import { Icon } from "./Icons";
import { DashboardMockup, IPhoneMockup, NotificationSettingsMockup, ReportsMockup, TicketDetailMockup, TicketListMockup } from "./Mockups";
import SlideShell from "./SlideShell";

const slide = (id: number) => slides[id - 1];
const shell = (id: number, content: React.ReactNode, compact = false) => {
  const s = slide(id);
  return <SlideShell number={id} eyebrow={s.eyebrow} title={s.title} description={s.description} compact={compact}>{content}</SlideShell>;
};

export function SlideContent({ id }: { id: number }) {
  switch (id) {
    case 1: return <Cover/>;
    case 2: return <IncidentFlow/>;
    case 3: return <Comparison/>;
    case 4: return <Dashboard/>;
    case 5: return <NotificationExperience/>;
    case 6: return <Ownership/>;
    case 7: return <TopAlerts/>;
    case 8: return <TopHosts/>;
    case 9: return <MobileOperations/>;
    case 10: return <MonthlyReport/>;
    case 11: return <IPhoneEnablement/>;
    case 12: return <Benefits/>;
    default: return <Closing/>;
  }
}

function ProblemNotification({ recovered = false }: { recovered?: boolean }) {
  return <div className={`exec-notification ${recovered ? "is-recovered" : "is-problem"}`}><div className="exec-notification-head"><span>{recovered ? "✓" : "!"}</span><b>{recovered ? "Recovered" : "Problem"}</b><small>now</small></div><strong>Host: HSVCRP01</strong>{recovered ? <><p>/var filesystem usage recovered</p><div className="before-after"><b>95%</b><i>→</i><strong>43%</strong></div><small>Ticket #4342 closed</small></> : <><p>Severity: Warning</p><div>/var filesystem usage reached 95%</div><small>Ticket #4342 · Tap to open</small></>}</div>;
}

function IncidentTicket() {
  return <div className="exec-ticket"><div><span>TICKET</span><b>#4342</b><em>Closed</em></div><h4>/var filesystem usage</h4><p>HSVCRP01 · Zabbix · Assigned to Thyme</p><div className="exec-ticket-values"><span>Before <b>95%</b></span><i>→</i><span>After <strong>43%</strong></span></div></div>;
}

function Cover() {
  const benefits = ["Push Notification ตรงถึง iPhone", "ไม่ผูกกับโควตาข้อความของแชต", "กดแจ้งเตือนแล้วเปิด Ticket ได้ทันที", "Dashboard เบา เปิดเร็ว และดูปัญหาซ้ำได้"];
  return <section className="executive-cover" aria-labelledby="slide-title-1"><div className="executive-cover-copy"><div className="eyebrow"><span>RJ</span>ROO-JAENG INCIDENT NOTIFICATION</div><h1 id="slide-title-1"><em>หยุดพึ่ง LINE</em><br/>Incident ต้อง<br/><strong>ไปถึงคนรับผิดชอบ</strong></h1><p>Roo-Jaeng ส่ง Push Notification ตรงถึง iPhone พร้อมสร้าง Ticket มอบหมาย ติดตาม และปิดงานในระบบเดียว <b>โดยไม่ผูกกับโควตาข้อความของแพลตฟอร์มแชต</b></p><div className="executive-benefits">{benefits.map((x,i)=><div key={x}><span>0{i+1}</span><b>{x}</b></div>)}</div></div><div className="executive-hero"><div className="hero-dashboard"><DashboardMockup/></div><div className="hero-phone"><IPhoneMockup><div className="phone-wallpaper executive-wallpaper"><ProblemNotification/><ProblemNotification recovered/></div></IPhoneMockup></div><div className="hero-ticket"><IncidentTicket/></div><div className="hero-link link-alert">ALERT</div><div className="hero-link link-ticket">TICKET</div></div></section>;
}

function IncidentFlow() {
  const problem = ["Zabbix พบ /var = 95%", "Roo-Jaeng รับ Alert", "สร้าง Ticket #4342", "ส่ง Push ถึง iPhone", "แตะเปิด Ticket", "Assign ให้ Thyme", "เริ่มตรวจสอบ", "In Progress"];
  const recovered = ["Zabbix พบ /var = 43%", "อัปเดต Ticket เดิม", "ส่ง Recovered Push", "เพิ่ม Recovery ใน Timeline", "ปิด Ticket อัตโนมัติ"];
  return shell(2,<div className="incident-flow-layout"><div className="flow-lanes"><FlowLane label="FLOW A · PROBLEM" tone="problem" items={problem}/><FlowLane label="FLOW B · RECOVERED" tone="recovered" items={recovered}/></div><div className="recovery-detail"><span>RECOVERY DETAIL</span><h3>HSVCRP01 <small>/var</small></h3><div><p>Before<b>95%</b></p><i>→</i><p>After<strong>43%</strong></p></div><ul><li>Duration <b>18 minutes</b></li><li>Result <strong>Recovered</strong></li><li>Ticket Status <strong>Closed</strong></li></ul></div></div>,true);
}

function FlowLane({ label, tone, items }: { label: string; tone: string; items: string[] }) {
  return <div className={`flow-lane ${tone}`}><div className="flow-lane-label">{label}</div><div className="flow-nodes">{items.map((x,i)=><div key={x}><span>{String(i+1).padStart(2,"0")}</span><b>{x}</b>{i<items.length-1&&<i>→</i>}</div>)}</div></div>;
}

function Comparison() {
  const chat = ["ข้อความเลื่อนหาย", "อ่านแล้วแต่ไม่มีผู้รับผิดชอบ", "ไม่รู้ว่างานปิดหรือยัง", "ต้องค้นหาข้อความย้อนหลัง", "ผูกกับโควตาหรือแพ็กเกจ", "รายงานและวิเคราะห์ปัญหาซ้ำยาก"];
  const roo = ["Push ตรงถึง iPhone", "กดแล้วเปิด Ticket ได้ทันที", "มีผู้รับผิดชอบและ Status", "เก็บ Timeline และรายละเอียดการแก้ไข", "Recovery อัปเดต Ticket เดิม", "ปิดงานอัตโนมัติและดูรายงานได้"];
  return shell(3,<div className="comparison-layout"><ComparePanel title="แจ้งเตือนผ่าน LINE / Chat" label="BEFORE" items={chat} tone="before"/><div className="comparison-pivot"><span>จาก</span><Icon name="bell"/><i>→</i><Icon name="ticket"/><b>ข้อความ</b><strong>งานที่ติดตามได้</strong></div><ComparePanel title="แจ้งเตือนผ่าน Roo-Jaeng" label="AFTER" items={roo} tone="after"/><div className="comparison-summary">LINE เหมาะกับการสนทนา <b>แต่ Roo-Jaeng เหมาะกับการจัดการ Incident</b></div></div>,true);
}

function ComparePanel({ title, label, items, tone }: { title: string; label: string; items: string[]; tone: string }) {
  return <div className={`compare-panel ${tone}`}><span>{label}</span><h3>{title}</h3><ul>{items.map(x=><li key={x}><i>{tone==="after" ? "✓" : "—"}</i>{x}</li>)}</ul></div>;
}

function Dashboard() {
  const questions = ["วันนี้มี Incident กี่งาน", "งานไหนยังไม่ปิด", "ใครรับผิดชอบ", "Alert ไหนเกิดบ่อย", "Host ไหนเสี่ยงสูง", "แนวโน้มเพิ่มหรือลด", "มี Recovery แล้วหรือยัง"];
  return shell(4,<div className="dashboard-executive"><div className="dashboard-screen"><DashboardMockup/><div className="dashboard-callout c1">Total · New · In Progress · Closed</div><div className="dashboard-callout c2">Monthly Trend</div><div className="dashboard-callout c3">Top Risk Hosts · Top Alerts</div></div><div className="question-panel"><span>7 คำถามที่ตอบได้ทันที</span>{questions.map((x,i)=><div key={x}><b>{String(i+1).padStart(2,"0")}</b><p>{x}</p></div>)}<strong>เบา · เปิดเร็ว · เหมาะกับมือถือ</strong></div></div>,true);
}

function NotificationExperience() {
  return shell(5,<div className="notification-experience"><div className="dual-phones"><IPhoneMockup label="PROBLEM"><div className="phone-wallpaper executive-wallpaper"><div className="phone-date">16:02<small>Tuesday, 4 August</small></div><ProblemNotification/></div></IPhoneMockup><div className="notification-transform"><span>18 นาที</span><i>→</i><b>แก้ไขแล้ว</b></div><IPhoneMockup label="RECOVERED"><div className="phone-wallpaper recovered-wallpaper"><div className="phone-date">16:20<small>Tuesday, 4 August</small></div><ProblemNotification recovered/></div></IPhoneMockup></div><div className="notification-points">{["แยก Problem และ Recovered ชัดเจน", "เห็น Host, Severity, Detail และ Ticket ID", "กดแล้วเปิด Ticket ที่เกี่ยวข้องทันที", "ไม่ต้องกลับไปค้นหาใน Dashboard หรือ LINE"].map(x=><div key={x}><Icon name="check"/><b>{x}</b></div>)}</div></div>,true);
}

function Ownership() {
  return shell(6,<div className="ownership-layout"><div className="ownership-screen"><TicketDetailMockup/></div><div className="ownership-proof"><span>ONE ALERT · ONE OWNER · ONE HISTORY</span><div className="ownership-tags">{["Ownership","Accountability","Audit trail","Resolution history"].map((x,i)=><div key={x}><b>0{i+1}</b>{x}</div>)}</div><ol>{["16:02 — Alert received", "16:02 — Ticket #4342 created", "16:03 — Push notification sent", "16:05 — Assigned to Thyme", "16:08 — Investigation started", "16:20 — /var 95% → 43%", "16:20 — Recovery received", "16:20 — Ticket closed"].map(x=><li key={x}>{x}</li>)}</ol></div></div>,true);
}

const alertData = [
  ["HSVCRP01","CPU Utilization Reach Up 85%",84], ["HSVCRP01","Disk I/O is overloaded",29], ["HSVCSP01","CPU Utilization Reach Up 95%",24], ["HSVBWP01","CPU Utilization Reach Up 95%",12], ["HSPCMV02","BITS service not running",12],
] as const;

function TopAlerts() {
  return shell(7,<div className="risk-insight-layout"><div className="ranked-list"><div className="ranked-head"><span>TOP RECURRING ALERTS</span><b>ครั้ง / เดือน</b></div>{alertData.map(([host,issue,count],i)=><div className="ranked-row" key={`${host}-${issue}`}><span>{String(i+1).padStart(2,"0")}</span><b>{host}</b><p>{issue}</p><i style={{"--bar":`${count}%`} as React.CSSProperties}/><strong>{count}</strong></div>)}</div><div className="root-actions"><span>จาก Alert ซ้ำ → Preventive Action</span>{[["Disk I/O · 29 ครั้ง","ตรวจ Storage / Workload"],["CPU · 84 ครั้ง","ตรวจ Capacity / Process"],["Agent unavailable ซ้ำ","ตรวจ Service / Network"]].map(([a,b])=><div key={a}><Icon name="chart"/><p><b>{a}</b><small>{b}</small></p></div>)}<strong>ไม่ใช่แค่ปิด Alert<br/>แต่ช่วยหาเรื่องที่ควรแก้จากต้นเหตุ</strong></div></div>,true);
}

const hosts = [["HSVCRP01",116,"Critical"],["HSVCSP01",30,"High"],["HSVBWP01",13,"Medium"],["HSPCMV01",12,"Medium"],["HSPCMV02",12,"Medium"]] as const;

function TopHosts() {
  return shell(8,<div className="host-risk-layout"><div className="host-podium">{hosts.map(([host,count,risk],i)=><div className={`host-card rank-${i+1}`} key={host}><span>#{i+1}</span><div><b>{host}</b><small>{risk}</small></div><strong>{count}<small>alerts</small></strong><i style={{width:`${Math.max(20,count/1.16)}%`}}/></div>)}</div><div className="risk-outcomes"><div className="risk-orbit"><span>116</span><b>ALERTS</b><small>HSVCRP01</small></div><ul>{["เรียงลำดับ Host ตามจำนวน Alert", "เห็นความเสี่ยงของแต่ละเครื่อง", "ช่วยวางแผน Preventive Action", "ลดการแก้ปัญหาแบบวันต่อวัน"].map(x=><li key={x}><Icon name="check"/>{x}</li>)}</ul></div></div>,true);
}

function MobileOperations() {
  return shell(9,<div className="mobile-operations"><div className="mobile-device"><IPhoneMockup><div className="mobile-dashboard-view"><div className="mobile-rj"><span>RJ</span><b>Dashboard</b><i>●</i></div><div className="mobile-metrics">{[["Total","286"],["New","18"],["In Progress","9"],["Closed","259"]].map(([a,b])=><div key={a}><small>{a}</small><b>{b}</b></div>)}</div><div className="mobile-list"><b>Recent Activity</b>{["#4342 · /var filesystem", "#4341 · Disk I/O overloaded", "#4340 · Backup Job Failed"].map((x,i)=><div key={x}><span>{x}</span><i>{i===0?"Closed":"Open"}</i></div>)}<small>100 / Total 3,248　 ‹ 1 2 3 ›</small></div></div></IPhoneMockup></div><div className="mobile-browser-view"><TicketListMockup/></div><div className="lightweight-principles"><span>โหลดเท่าที่จำเป็น</span>{[["01","Summary Endpoint"],["02","Pagination 100 / Total"],["03","ข้อมูลสำคัญก่อน"],["04","iPhone · iPad · PWA"]].map(([n,x])=><div key={x}><b>{n}</b><p>{x}</p></div>)}<strong>เปิดจาก Home Screen ได้</strong></div></div>,true);
}

function MonthlyReport() {
  return shell(10,<div className="monthly-report"><div className="report-screen"><ReportsMockup/></div><div className="report-value"><span>MONTHLY MANAGEMENT PACK</span><h3>พร้อมใช้ทันที</h3><p>ไม่ต้องคัดลอกข้อมูล<br/>และรวม Excel ด้วยมือ</p><div>{["Total incidents", "Zabbix / Manual / Commvault", "New / In Progress / Closed", "Workload per team member", "Top recurring issues", "Monthly trend"].map(x=><b key={x}><Icon name="check"/>{x}</b>)}</div></div></div>,true);
}

function IPhoneEnablement() {
  const groupA = ["เปิด Safari", "เข้า roo-jaeng.com", "Login", "กด Share", "เลือก Add to Home Screen", "กด Add", "เปิด Roo-Jaeng จาก Home Screen"];
  const groupB = ["เปิด Notification Settings", "ตรวจ Browser Support", "Standalone Mode = Yes", "กด Enable Notifications", "กด Allow", "ตรวจ Subscribed / Device ≥ 1", "กด Test Notification", "Successful 1 · Failed 0"];
  return shell(11,<div className="enablement-layout"><SetupGroup label="A" title="Add Roo-Jaeng to Home Screen" items={groupA}/><div className="enablement-phone"><IPhoneMockup compact><div className="settings-phone"><NotificationSettingsMockup/></div></IPhoneMockup><div className="setup-success"><Icon name="check"/><b>Subscribed</b><span>Device 1</span></div></div><SetupGroup label="B" title="Enable Notification" items={groupB}/></div>,true);
}

function SetupGroup({ label, title, items }: { label: string; title: string; items: string[] }) {
  return <div className="enablement-group"><div><span>GROUP {label}</span><h3>{title}</h3></div><ol>{items.map((x,i)=><li key={x}><b>{i+1}</b><p>{x}</p></li>)}</ol></div>;
}

function Benefits() {
  const benefits = ["ไม่ต้องพึ่ง LINE สำหรับ Incident Alert", "Push ตรงถึง iPhone", "ทุก Alert มี Ticket ID", "มีผู้รับผิดชอบชัดเจน", "Problem และ Recovered อยู่ในงานเดียวกัน", "Recovery ปิดงานและเก็บรายละเอียดได้", "วิเคราะห์ Alert ซ้ำได้", "จัดลำดับ Top Risk Hosts ได้", "Dashboard เบาและรองรับมือถือ", "รายงานพร้อมใช้", "เก็บประวัติการแก้ไขครบ", "รองรับ Zabbix, Commvault และ Manual Ticket"];
  return shell(12,<div className="benefits-layout"><div className="benefit-grid">{benefits.map((x,i)=><div key={x}><span>{String(i+1).padStart(2,"0")}</span><Icon name={i%3===0?"bell":i%3===1?"ticket":"check"}/><b>{x}</b></div>)}</div><div className="benefit-statement"><span>INCIDENT NOTIFICATION & OPERATIONS PLATFORM</span><p>Roo-Jaeng ไม่ได้แค่รับแจ้งเตือน</p><h3>แต่เปลี่ยน Alert ให้เป็นงานที่<br/><em>รับผิดชอบ · วัดผล · เรียนรู้ได้</em></h3></div></div>,true);
}

function Closing() {
  return <section className="executive-closing" aria-labelledby="slide-title-13"><div className="closing-backdrop"><DashboardMockup/></div><div className="closing-phone"><IPhoneMockup compact><div className="phone-wallpaper executive-wallpaper"><ProblemNotification recovered/></div></IPhoneMockup></div><div className="closing-content"><div className="eyebrow"><span>13</span>ROO-JAENG EXECUTIVE SUMMARY</div><h1 id="slide-title-13"><span>From Alert</span><span>To Ownership</span><strong>To Resolution</strong></h1><p>ทุก Alert ไปถึงคนที่ต้องรับผิดชอบ<br/>ทุกงานมีสถานะ · ทุกปัญหามีประวัติ<br/>และทุกข้อมูลนำไปใช้ปรับปรุงระบบได้</p><div className="closing-brand"><i>RJ</i><div><b>Roo-Jaeng</b><span>Incident Notification &amp; Operations Platform</span></div></div></div></section>;
}
