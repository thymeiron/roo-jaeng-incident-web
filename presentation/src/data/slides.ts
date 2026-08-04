export type SlideDefinition = {
  id: number;
  eyebrow: string;
  title: string;
  description: string;
  shortTitle: string;
};

export const slides: SlideDefinition[] = [
  { id: 1, eyebrow: "ROO-JAENG INCIDENT NOTIFICATION", title: "หยุดพึ่ง LINE — Incident ต้องไปถึงคนรับผิดชอบ", description: "Push ตรงถึง iPhone พร้อมสร้าง มอบหมาย ติดตาม และปิด Ticket ในระบบเดียว", shortTitle: "Incident ถึงคนรับผิดชอบ" },
  { id: 2, eyebrow: "END-TO-END INCIDENT FLOW", title: "Alert เข้า → แจ้งเตือน → เปิดงาน → แก้ไข → Recovery → ปิดงาน", description: "Problem และ Recovered เชื่อมอยู่ใน Ticket เดียวตั้งแต่ต้นจนจบ", shortTitle: "Incident Flow" },
  { id: 3, eyebrow: "BEFORE VS AFTER", title: "LINE เหมาะกับการสนทนา — Roo-Jaeng เหมาะกับการจัดการ Incident", description: "เปลี่ยนข้อความที่เลื่อนหาย ให้เป็นงานที่มีเจ้าของ สถานะ และหลักฐาน", shortTitle: "เหนือกว่า Chat Alert" },
  { id: 4, eyebrow: "EXECUTIVE OPERATIONS VIEW", title: "Dashboard ตอบคำถามสำคัญได้ทันที", description: "เห็นสถานการณ์ เจ้าของงาน ความเสี่ยง และแนวโน้มจากหน้าจอเดียว", shortTitle: "Dashboard" },
  { id: 5, eyebrow: "CLEAR MOBILE NOTIFICATION", title: "Problem และ Recovered ชัดเจนตั้งแต่หน้าจอล็อก", description: "เห็น Host, Severity, รายละเอียด และ Ticket ID พร้อมแตะเพื่อเปิดงาน", shortTitle: "Problem & Recovered" },
  { id: 6, eyebrow: "OWNERSHIP & TRACEABILITY", title: "ทุก Alert มีเจ้าของและมีหลักฐาน", description: "หนึ่ง Ticket รวมผู้รับผิดชอบ Timeline, Notes, Work Log และประวัติการแก้ไข", shortTitle: "Ticket Ownership" },
  { id: 7, eyebrow: "RECURRING PROBLEM INTELLIGENCE", title: "Top Alerts เผยปัญหาที่เกิดซ้ำ", description: "ไม่ใช่แค่ปิด Alert แต่ช่วยหาเรื่องที่ควรแก้จากต้นเหตุ", shortTitle: "Top Alerts" },
  { id: 8, eyebrow: "RISK-BASED PRIORITIZATION", title: "รู้ว่าเครื่องไหนควรได้รับการแก้ไขก่อน", description: "จัดลำดับ Host ตามจำนวน Alert เพื่อวาง Preventive Action ได้ตรงจุด", shortTitle: "Top Risk Hosts" },
  { id: 9, eyebrow: "LIGHTWEIGHT MOBILE OPERATIONS", title: "เว็บเบา เปิดเร็ว ใช้งานได้จากมือถือ", description: "ออกแบบให้โหลดข้อมูลเท่าที่จำเป็น และแสดงสิ่งสำคัญก่อน", shortTitle: "Lightweight & Mobile" },
  { id: 10, eyebrow: "READY-TO-USE REPORTING", title: "รายงานพร้อมใช้ ไม่ต้องรวม Excel เอง", description: "สรุป Incident, Source, Status, Workload และปัญหาซ้ำในมุมมองรายเดือน", shortTitle: "Monthly Report" },
  { id: 11, eyebrow: "iPHONE ENABLEMENT", title: "ติดตั้งครั้งเดียว พร้อมรับ Incident บน iPhone", description: "เพิ่ม Roo-Jaeng ไปยัง Home Screen แล้วเปิด Notification ตามขั้นตอน", shortTitle: "ตั้งค่า iPhone" },
  { id: 12, eyebrow: "OPERATIONAL OUTCOMES", title: "ประโยชน์ที่มากกว่าเว็บเปิด Ticket", description: "Roo-Jaeng เปลี่ยน Alert ให้เป็นงานที่รับผิดชอบ วัดผล และเรียนรู้ได้", shortTitle: "Operational Benefits" },
  { id: 13, eyebrow: "ROO-JAENG EXECUTIVE SUMMARY", title: "From Alert · To Ownership · To Resolution", description: "ทุก Alert ไปถึงคนที่ต้องรับผิดชอบ และทุกข้อมูลนำไปใช้ปรับปรุงระบบได้", shortTitle: "Executive Closing" },
];

export const ticketRows = [
  { id: "#4342", title: "/var filesystem usage reached 95%", host: "HSVCRP01", severity: "Warning", source: "Zabbix", owner: "Thyme", status: "Closed" },
  { id: "#4341", title: "Disk I/O is overloaded", host: "HSVCRP01", severity: "High", source: "Zabbix", owner: "Narin", status: "In Progress" },
  { id: "#4340", title: "Backup Job Failed", host: "HSPCMV01", severity: "High", source: "Commvault", owner: "Kanda", status: "New" },
  { id: "#4339", title: "BITS service not running", host: "HSPCMV02", severity: "Average", source: "Manual", owner: "Preecha", status: "Closed" },
];

export const riskRows = [
  { host: "HSVCRP01", trigger: "CPU Utilization Reach Up 85%", count: 84, open: 3 },
  { host: "HSVCRP01", trigger: "Disk I/O is overloaded", count: 29, open: 2 },
  { host: "HSVCSP01", trigger: "CPU Utilization Reach Up 95%", count: 24, open: 1 },
];
