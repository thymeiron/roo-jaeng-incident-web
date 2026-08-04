import type { ReactNode } from "react";

export function BrowserMockup({ children, label = "roo-jaeng.com" }: { children: ReactNode; label?: string }) {
  return (
    <div className="browser">
      <div className="browser-bar">
        <span className="browser-dots"><i /><i /><i /></span>
        <span className="browser-address">🔒 {label}</span>
        <span className="browser-menu">•••</span>
      </div>
      <div className="browser-body">{children}</div>
    </div>
  );
}

export function AppHeader() {
  return (
    <div className="app-header">
      <strong>Roo-Jaeng</strong>
      <div><span>ทีม Support</span><span className="role">USER</span><button>การแจ้งเตือน</button></div>
    </div>
  );
}

export function LoginMockup() {
  return (
    <BrowserMockup label="roo-jaeng.com/login">
      <div className="login-canvas">
        <div className="login-card">
          <div className="login-logo">RJ</div>
          <h3>Roo-Jaeng Login</h3>
          <p>Sign in to access the incident dashboard</p>
          <label>Username<input value="support.user" readOnly /></label>
          <label>Password<input value="••••••••••" readOnly /></label>
          <button className="primary">Sign in</button>
        </div>
      </div>
    </BrowserMockup>
  );
}

const statuses = [
  ["New", "new"], ["In Progress", "progress"], ["Closed", "closed"],
] as const;

export function StatusBadge({ status }: { status: "New" | "In Progress" | "Closed" }) {
  const cls = statuses.find(([name]) => name === status)?.[1] || "new";
  return <span className={`status ${cls}`}>{status}</span>;
}

export function DashboardMockup() {
  const trend = [38, 55, 46, 72, 58, 88];
  return (
    <BrowserMockup>
      <AppHeader />
      <div className="mock-page dashboard-mock">
        <div className="mock-title-row"><div><small>IDS SUPPORT / ROO-JAENG</small><h3>Roo-Jaeng Incident Dashboard</h3></div><button className="primary">+ Create Ticket</button></div>
        <div className="stat-grid focus-ring">
          {[['Total Tickets','128'],['New','14'],['In Progress','26'],['Closed','88']].map(([k,v]) => <div className="stat" key={k}><span>{k}</span><strong>{v}</strong></div>)}
        </div>
        <div className="dash-grid">
          <div className="mock-panel focus-ring"><div className="panel-title">Monthly Trend <span>6 เดือนล่าสุด</span></div><div className="mini-chart">{trend.map((h,i)=><i key={i} style={{height:`${h}%`}} />)}</div></div>
          <div className="mock-panel focus-ring"><div className="panel-title">Recent Activity <span>อัปเดตล่าสุด</span></div>{['#1048 • DB-PROD-01','#1047 • BACKUP-02','#1046 • WEB-APP-03'].map((t,i)=><div className="activity" key={t}><b>{t}</b><StatusBadge status={statuses[i][0]} /></div>)}</div>
        </div>
        <div className="dash-grid compact">
          <RiskList title="Top Risk Hosts" items={['DB-PROD-01','BACKUP-02','WEB-APP-03']} />
          <RiskList title="Repeated Alerts" items={['Disk space low','Backup job failed','High CPU usage']} />
        </div>
      </div>
    </BrowserMockup>
  );
}

function RiskList({ title, items }: { title: string; items: string[] }) {
  return <div className="mock-panel focus-ring"><div className="panel-title">{title}<span>เดือนนี้</span></div>{items.map((x,i)=><div className="risk-row" key={x}><i>{i+1}</i><b>{x}</b><strong>{[12,8,5][i]}</strong></div>)}</div>;
}

const tickets = [
  ["1048", "Disk space low on database volume", "DB-PROD-01", "New", "Thyme"],
  ["1047", "Backup job failed", "BACKUP-02", "In Progress", "Tun"],
  ["1046", "ตรวจสอบ Network latency", "CORE-SW-01", "Closed", "Champ"],
] as const;

export function TicketsMockup() {
  return <BrowserMockup label="roo-jaeng.com/tickets"><AppHeader /><div className="mock-page"><div className="mock-title-row"><div><h3>Tickets</h3><p>Showing 1–50 of 128 tickets</p></div><button className="primary">+ Create Ticket</button></div><div className="filter-row focus-ring"><input value="ค้นหา Ticket, Host, Detail..." readOnly /><button className="primary">Search</button></div><div className="filter-chips focus-ring"><span>สถานะ ▾</span><span>Source ▾</span><span>Host ▾</span><span>Assigned user ▾</span></div><div className="table-wrap focus-ring"><table><thead><tr><th>ID</th><th>Title</th><th>Host</th><th>Status</th><th>Assigned</th></tr></thead><tbody>{tickets.map(t=><tr key={t[0]}><td><b className="link">#{t[0]}</b></td><td><b>{t[1]}</b></td><td>{t[2]}</td><td><StatusBadge status={t[3]} /></td><td>{t[4]}</td></tr>)}</tbody></table></div><div className="pagination focus-ring"><button>Previous</button><b>1</b><button>2</button><button>3</button><button>Next</button></div></div></BrowserMockup>;
}

export function CreateTicketMockup() {
  return <BrowserMockup label="roo-jaeng.com/tickets/new"><AppHeader /><div className="mock-page form-page"><h3>Create Ticket</h3><p>บันทึกงาน Manual หรือ Incident ที่ต้องติดตาม</p><div className="form-card focus-ring"><label>Title<input value="ตรวจสอบ Backup Job ประจำวัน" readOnly /></label><div className="form-grid"><label>Host<input value="BACKUP-02" readOnly /></label><label>Severity<select defaultValue="High"><option>High</option></select></label></div><label>Assigned To<select defaultValue="Tun"><option>Tun</option></select></label><label>Detail<textarea value="ตรวจสอบ Job ที่ Failed และดำเนินการแก้ไข" readOnly /></label><div><button className="primary save-pulse">Create Ticket</button><button>Cancel</button></div></div></div></BrowserMockup>;
}

export function TicketDetailMockup() {
  return <BrowserMockup label="roo-jaeng.com/tickets/1047"><AppHeader /><div className="mock-page"><div className="detail-grid"><div className="detail-card"><div className="detail-head"><b>#1047</b><div><h3>Backup job failed</h3><span>Host: BACKUP-02</span></div><StatusBadge status="In Progress" /></div><div className="info-grid"><Info label="Severity" value="High"/><Info label="Assigned To" value="Tun"/><Info label="Source" value="Zabbix"/><Info label="Created" value="04 ส.ค. 2026"/></div><div className="tabs focus-ring"><b>Detail</b><b className="active">Timeline</b><b>Notes</b><b>Work Log</b><b>Related</b></div><div className="timeline"><p><i/> <b>กำลังตรวจสอบ Backup log</b> · โดย Tun</p><p><i/> เปลี่ยนสถานะเป็น In Progress</p><p><i/> Ticket created from Zabbix</p></div></div><div className="action-stack"><div className="action-card focus-ring"><b>เปลี่ยนสถานะ</b><div><button className="blue">New</button><button className="orange">In Progress</button><button className="green">Closed</button></div></div><div className="action-card"><b>Assigned To</b><select defaultValue="Tun"><option>Tun</option></select><button>Save</button></div><div className="action-card"><b>Work Log / Notes</b><textarea value="บันทึกสิ่งที่ตรวจสอบและผลลัพธ์" readOnly /></div></div></div></div></BrowserMockup>;
}

function Info({label,value}:{label:string;value:string}) { return <div><span>{label}</span><b>{value}</b></div>; }

export function ReportsMockup() {
  const rows = [['Thyme','18','7','4','6','15'],['Tun','14','11','3','8','14'],['Champ','12','9','7','5','9']];
  return <BrowserMockup label="roo-jaeng.com/reports"><AppHeader/><div className="mock-page"><div className="mock-title-row"><div><h3>Monthly Incident Summary</h3><p>รายงานเดือน สิงหาคม 2026</p></div><button>เลือกเดือน ▾</button></div><div className="report-cards focus-ring"><div><span>Ticket Source</span><b>Manual 44 · Zabbix 27</b></div><div><span>Status Summary</span><b>New 14 · Progress 19 · Closed 38</b></div></div><h4>งานของแต่ละคนในทีม</h4><div className="table-wrap focus-ring"><table><thead><tr><th>Assigned To</th><th>Manual</th><th>Zabbix</th><th>New</th><th>In Progress</th><th>Closed</th></tr></thead><tbody>{rows.map(r=><tr key={r[0]}>{r.map((c,i)=><td key={i}><b>{c}</b></td>)}</tr>)}</tbody></table></div></div></BrowserMockup>;
}

export function ZabbixRiskMockup() {
  return <BrowserMockup label="roo-jaeng.com/zabbix-risk"><AppHeader/><div className="mock-page"><div className="mock-title-row"><div><h3>Repeated Zabbix Risk</h3><p>Alert patterns repeated 3+ times this month</p></div><button>Open Zabbix</button></div><div className="stat-grid three"><div className="stat"><span>Repeated Risk Patterns</span><strong>6</strong></div><div className="stat"><span>Total Repeated Tickets</span><strong>31</strong></div><div className="stat"><span>Still Open</span><strong>9</strong></div></div><div className="table-wrap focus-ring"><table><thead><tr><th>Risk</th><th>Host</th><th>Alert</th><th>Count</th><th>Open</th><th>Action</th></tr></thead><tbody>{[['1','DB-PROD-01','Disk space low','12','4'],['2','BACKUP-02','Backup job failed','8','3'],['3','WEB-APP-03','High CPU usage','5','2']].map(r=><tr key={r[0]}>{r.map((c,i)=><td key={i}><b className={i===1?'link':''}>{c}</b></td>)}<td><b className="link">View tickets →</b></td></tr>)}</tbody></table></div></div></BrowserMockup>;
}

export function IphoneMockup({ children, notification }: { children: ReactNode; notification?: boolean }) {
  return <div className="iphone"><div className="iphone-top"><i/></div><div className="iphone-screen">{notification && <div className="push-banner"><span className="mini-logo">RJ</span><div><b>Roo-Jaeng</b><small>BACKUP-02: Backup job failed</small></div><time>ตอนนี้</time></div>}{children}</div><div className="home-indicator"/></div>;
}

export function IphoneHomeMockup() {
  return <IphoneMockup><div className="ios-home"><div className="ios-time">9:41</div><div className="app-icons"><div><span className="safari">◉</span><small>Safari</small></div><div className="focus-app"><span className="rj-icon">RJ</span><small>Roo-Jaeng</small></div></div><div className="share-sheet"><b>เพิ่ม Roo-Jaeng ไปยังหน้าจอโฮม</b><div>□ แชร์</div><div className="highlight-row">＋ Add to Home Screen</div><button className="primary">Add</button></div></div></IphoneMockup>;
}

export function NotificationMockup() {
  return <IphoneMockup notification><div className="mobile-app"><div className="mobile-header"><b>Roo-Jaeng</b><span>🔔</span></div><div className="notification-panel"><h4>Notification Settings</h4><p>Browser support <b className="ok">รองรับ</b></p><p>Standalone mode <b className="ok">Yes</b></p><p>Permission <b className="ok">Allowed</b></p><p>สถานะ <b className="ok">Subscribed</b></p><p>Registered device <b>1</b></p><button className="primary">Enable Notifications</button><button>Test Notification</button><div className="success-box">Successful 1 · Failed 0</div></div></div></IphoneMockup>;
}
