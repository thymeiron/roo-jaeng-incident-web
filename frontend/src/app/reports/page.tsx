import Link from "next/link";
import { ASSIGNEES, normalizeAssignedTo } from "@/lib/assignees";
import { authenticatedApiFetch } from "@/lib/server-api";

export const dynamic = "force-dynamic";

type Ticket = {
  id: number;
  title: string;
  detail?: string | null;
  severity?: string | null;
  status?: string | null;
  host?: string | null;
  source?: string | null;
  assigned_to?: string | null;
  work_hours?: number | null;
  work_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type StaffRow = {
  assigned_to: string;
  manual: number;
  zabbix: number;
  work_hours: number;
  work_count: number;
  New: number;
  "In Progress": number;
  Closed: number;
  Total: number;
  latest_created_at?: string | null;
};

type IncidentRow = {
  title: string;
  host: string;
  source: string;
  count: number;
  latest_created_at?: string | null;
};

async function getTickets(): Promise<Ticket[]> {
  const res = await authenticatedApiFetch("/api/tickets", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch tickets");
  }

  return res.json();
}

function getCurrentMonthParam() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function isValidMonth(value?: string) {
  return !!value && /^\d{4}-\d{2}$/.test(value);
}

function isTicketInMonth(dateText?: string | null, month?: string) {
  if (!dateText || !month) return false;

  const d = new Date(dateText);
  if (Number.isNaN(d.getTime())) return false;

  const ticketMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return ticketMonth === month;
}

function monthLabel(month: string) {
  const [year, monthNo] = month.split("-").map(Number);
  const d = new Date(year, monthNo - 1, 1);

  return d.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function addMonth(month: string, diff: number) {
  const [year, monthNo] = month.split("-").map(Number);
  const d = new Date(year, monthNo - 1 + diff, 1);

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthOptions(selectedMonth: string) {
  const options = new Set<string>();

  for (let i = -6; i <= 3; i++) {
    options.add(addMonth(selectedMonth, i));
  }

  return Array.from(options).sort().reverse();
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleString("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isNewer(a?: string | null, b?: string | null) {
  if (!a) return false;
  if (!b) return true;

  return new Date(a).getTime() > new Date(b).getTime();
}

function normalizeSource(source?: string | null) {
  if (source === "slack_zabbix") return "zabbix";
  return "manual";
}

function cleanTitle(title?: string | null) {
  if (!title) return "Unknown";

  return title
    .replace(/^Problem:\s*/i, "")
    .replace(/^Resolved.*?:\s*/i, "")
    .replace(/\s+on\s+[A-Z0-9_-]+$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanHost(host?: string | null) {
  if (!host || host.trim() === "" || host.trim() === "-") return "Unknown";
  return host.replace(/\[.*?\]/g, "").trim();
}

function assignedTicketsLink(name: string) {
  if (name === "Unassigned") return "/tickets?assigned_to=";
  return `/tickets?assigned_to=${encodeURIComponent(name)}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const monthParam = typeof sp.month === "string" && isValidMonth(sp.month)
    ? sp.month
    : getCurrentMonthParam();

  const reportMonthLabel = monthLabel(monthParam);
  const prevMonth = addMonth(monthParam, -1);
  const nextMonth = addMonth(monthParam, 1);
  const monthOptions = buildMonthOptions(monthParam);

  const tickets = await getTickets();
  const monthlyTickets = tickets.filter((ticket) =>
    isTicketInMonth(ticket.created_at, monthParam)
  );

  const staffMap = new Map<string, StaffRow>();

  [...ASSIGNEES, "Unassigned"].forEach((name) => {
    staffMap.set(name, {
      assigned_to: name,
      manual: 0,
      zabbix: 0,
      work_hours: 0,
      work_count: 0,
      New: 0,
      "In Progress": 0,
      Closed: 0,
      Total: 0,
      latest_created_at: undefined,
    });
  });

  for (const ticket of monthlyTickets) {
    const assignee = normalizeAssignedTo(ticket.assigned_to);

    if (!staffMap.has(assignee)) {
      staffMap.set(assignee, {
        assigned_to: assignee,
        manual: 0,
        zabbix: 0,
        work_hours: 0,
        work_count: 0,
        New: 0,
        "In Progress": 0,
        Closed: 0,
        Total: 0,
        latest_created_at: undefined,
      });
    }

    const row = staffMap.get(assignee)!;
    const source = normalizeSource(ticket.source);

    if (source === "zabbix") row.zabbix += 1;
    else row.manual += 1;

    if (ticket.status === "New") row.New += 1;
    if (ticket.status === "In Progress") row["In Progress"] += 1;
    if (ticket.status === "Closed") row.Closed += 1;

    row.Total += 1;
    row.work_hours += Number(ticket.work_hours || 0);
    row.work_count += Number(ticket.work_count || 0);

    if (isNewer(ticket.created_at, row.latest_created_at)) {
      row.latest_created_at = ticket.created_at;
    }
  }

  const staffRows = Array.from(staffMap.values());

  const incidentMap = new Map<string, IncidentRow>();

  for (const ticket of monthlyTickets) {
    const title = cleanTitle(ticket.title);
    const host = cleanHost(ticket.host);
    const source = normalizeSource(ticket.source);
    const key = `${title}|${host}|${source}`;

    if (!incidentMap.has(key)) {
      incidentMap.set(key, {
        title,
        host,
        source,
        count: 0,
        latest_created_at: ticket.created_at,
      });
    }

    const row = incidentMap.get(key)!;
    row.count += 1;

    if (isNewer(ticket.created_at, row.latest_created_at)) {
      row.latest_created_at = ticket.created_at;
    }
  }

  const topIncidents = Array.from(incidentMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <main className="rj-light-page" style={{ padding: "20px", background: "#f8fbff", minHeight: "100vh" }}>
      <section className="rj-light-header rj-light-panel" style={{ ...headerStyle, padding: "20px", marginBottom: "20px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "32px", fontWeight: 500 }}>
            Monthly Team Report
          </h1>
          <p style={{ marginTop: "12px", color: "#475569" }}>
            Report month: {reportMonthLabel}
          </p>
        </div>

        <div className="rj-light-actions" style={{ display: "flex", gap: "10px" }}>
          <Link href="/" style={secondaryButtonStyle}>Dashboard</Link>
          <Link href="/tickets" style={primaryButtonStyle}>View Tickets</Link>
        </div>
      </section>

      <section className="rj-light-panel" style={filterPanelStyle}>
        <div>
          <div style={{ fontWeight: 800, marginBottom: "8px" }}>Report Month</div>

          <form action="/reports" method="GET" style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <select name="month" defaultValue={monthParam} style={selectStyle}>
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {monthLabel(month)}
                </option>
              ))}
            </select>

            <button type="submit" style={primaryButtonStyle}>
              View Report
            </button>

            <Link href={`/reports?month=${prevMonth}`} style={secondaryButtonStyle}>
              ← Previous Month
            </Link>

            <Link href={`/reports?month=${nextMonth}`} style={secondaryButtonStyle}>
              Next Month →
            </Link>
          </form>
        </div>
      </section>

      <h2 style={{ marginTop: "28px" }}>1. Summary by Staff</h2>

      <section className="rj-light-panel rj-light-table-wrap" style={tablePanelStyle}>
        <table style={tableStyle}>
          <thead>
            <tr style={headerRowStyle}>
              <th style={thStyle}>Assigned To</th>
              <th style={thStyle}>Manual</th>
              <th style={thStyle}>Zabbix</th>
              <th style={thStyle}>ชม/วัน</th>
              <th style={thStyle}>งาน/วัน</th>
              <th style={thStyle}>New</th>
              <th style={thStyle}>In Progress</th>
              <th style={thStyle}>Closed</th>
              <th style={thStyle}>Total</th>
              <th style={thStyle}>Latest Created</th>
            </tr>
          </thead>

          <tbody>
            {staffRows.map((row) => (
              <tr key={row.assigned_to} style={bodyRowStyle}>
                <td style={tdStyle}>
                  <Link href={assignedTicketsLink(row.assigned_to)} style={countLinkStyle}>
                    {row.assigned_to}
                  </Link>
                </td>

                <td style={tdStyle}>
                  <Link href={`${assignedTicketsLink(row.assigned_to)}&source=manual`} style={countLinkStyle}>
                    {row.manual}
                  </Link>
                </td>

                <td style={tdStyle}>
                  <Link href={`${assignedTicketsLink(row.assigned_to)}&source=slack_zabbix`} style={countLinkStyle}>
                    {row.zabbix}
                  </Link>
                </td>

                <td style={tdStyle}>{row.work_hours}</td>
                <td style={tdStyle}>{row.work_count}</td>

                <td style={tdStyle}>
                  <Link href={`${assignedTicketsLink(row.assigned_to)}&status=New`} style={countLinkStyle}>
                    {row.New}
                  </Link>
                </td>

                <td style={tdStyle}>
                  <Link href={`${assignedTicketsLink(row.assigned_to)}&status=In%20Progress`} style={countLinkStyle}>
                    {row["In Progress"]}
                  </Link>
                </td>

                <td style={tdStyle}>
                  <Link href={`${assignedTicketsLink(row.assigned_to)}&status=Closed`} style={countLinkStyle}>
                    {row.Closed}
                  </Link>
                </td>

                <td style={tdStyle}>{row.Total}</td>
                <td style={tdStyle}>{formatDateTime(row.latest_created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2 style={{ marginTop: "28px" }}>2. Top Incidents / Work Items</h2>

      <section className="rj-light-panel rj-light-table-wrap" style={tablePanelStyle}>
        <table style={tableStyle}>
          <thead>
            <tr style={headerRowStyle}>
              <th style={thStyle}>Title</th>
              <th style={thStyle}>Host / System</th>
              <th style={thStyle}>Source</th>
              <th style={thStyle}>Count</th>
              <th style={thStyle}>Latest Created</th>
            </tr>
          </thead>

          <tbody>
            {topIncidents.map((row) => (
              <tr key={`${row.title}-${row.host}-${row.source}`} style={bodyRowStyle}>
                <td style={tdStyle}>{row.title}</td>
                <td style={tdStyle}>{row.host}</td>
                <td style={tdStyle}>{row.source}</td>
                <td style={tdStyle}>{row.count}</td>
                <td style={tdStyle}>{formatDateTime(row.latest_created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {topIncidents.length === 0 && (
          <div style={{ padding: "28px", color: "#64748b", textAlign: "center" }}>
            No data for {reportMonthLabel}
          </div>
        )}
      </section>
    </main>
  );
}

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
};

const filterPanelStyle = {
  marginTop: "20px",
  padding: "18px",
  border: "1px solid #dbe4ef",
  borderRadius: "16px",
  background: "#ffffff",
};

const tablePanelStyle = {
  overflowX: "auto" as const,
  background: "#ffffff",
  borderRadius: "14px",
  boxShadow: "0 10px 25px rgba(15,23,42,0.06)",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse" as const,
};

const headerRowStyle = {
  background: "#f1f5f9",
  borderBottom: "1px solid #e2e8f0",
};

const bodyRowStyle = {
  borderBottom: "1px solid #e5e7eb",
};

const thStyle = {
  textAlign: "left" as const,
  padding: "16px",
  fontWeight: 800,
};

const tdStyle = {
  padding: "16px",
  color: "#0f172a",
};

const countLinkStyle = {
  color: "#2563eb",
  textDecoration: "none",
  fontWeight: 800,
};

const primaryButtonStyle = {
  display: "inline-block",
  padding: "12px 18px",
  borderRadius: "10px",
  border: "1px solid #020617",
  background: "#020617",
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  display: "inline-block",
  padding: "12px 18px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  textDecoration: "none",
  fontWeight: 800,
};

const selectStyle = {
  minWidth: "220px",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  fontWeight: 700,
};
