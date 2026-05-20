import Link from "next/link";

export const dynamic = "force-dynamic";

type Ticket = {
  id: number;
  title: string;
  status: string;
  host?: string;
  source?: string;
  assigned_to?: string;
  created_at?: string;
};

type StaffSummaryRow = {
  assigned_to: string;
  manual: number;
  zabbix: number;
  New: number;
  "In Progress": number;
  Closed: number;
  Total: number;
  latest_created_at?: string;
};

type TopIncidentRow = {
  title: string;
  host: string;
  source: string;
  count: number;
  latest_created_at?: string;
};

async function getTickets(): Promise<Ticket[]> {
  const apiBase = process.env.INTERNAL_API_URL || "http://incident-api:8000";

  const res = await fetch(`${apiBase}/api/tickets`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch tickets");
  }

  return res.json();
}

function isCurrentMonth(dateText?: string) {
  if (!dateText) return false;

  const date = new Date(dateText);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function normalizeSource(source?: string) {
  const value = (source || "").toLowerCase();

  if (value.includes("zabbix")) return "zabbix";
  return "manual";
}

function formatDateTime(value?: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isNewer(a?: string, b?: string) {
  if (!a) return false;
  if (!b) return true;

  return new Date(a).getTime() > new Date(b).getTime();
}

function assignedTicketsLink(name: string) {
  return `/tickets?assigned_to=${encodeURIComponent(name)}`;
}

export default async function ReportsPage() {
  const tickets = await getTickets();

  const monthlyTickets = tickets.filter((ticket) =>
    isCurrentMonth(ticket.created_at)
  );

  const staffMap = new Map<string, StaffSummaryRow>();

  for (const ticket of monthlyTickets) {
    const assignee = ticket.assigned_to?.trim() || "Unassigned";
    const source = normalizeSource(ticket.source);

    if (!staffMap.has(assignee)) {
      staffMap.set(assignee, {
        assigned_to: assignee,
        manual: 0,
        zabbix: 0,
        New: 0,
        "In Progress": 0,
        Closed: 0,
        Total: 0,
        latest_created_at: ticket.created_at,
      });
    }

    const row = staffMap.get(assignee)!;

    if (source === "zabbix") row.zabbix += 1;
    else row.manual += 1;

    if (ticket.status === "New") row.New += 1;
    if (ticket.status === "In Progress") row["In Progress"] += 1;
    if (ticket.status === "Closed") row.Closed += 1;

    row.Total += 1;

    if (isNewer(ticket.created_at, row.latest_created_at)) {
      row.latest_created_at = ticket.created_at;
    }
  }

  const staffRows = Array.from(staffMap.values()).sort((a, b) =>
    a.assigned_to.localeCompare(b.assigned_to)
  );

  const incidentMap = new Map<string, TopIncidentRow>();

  for (const ticket of monthlyTickets) {
    const title = ticket.title || "Untitled";
    const host = ticket.host || "-";
    const source = normalizeSource(ticket.source);
    const key = `${title}__${host}__${source}`;

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

  const now = new Date();
  const monthLabel = now.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <main style={{ padding: "24px", fontFamily: "Arial, sans-serif", background: "#f6f7fb", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "30px" }}>Monthly Team Report</h1>
          <p style={{ color: "#666", marginTop: "8px" }}>
            Report month: {monthLabel}
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <Link href="/" style={buttonStyle}>Dashboard</Link>
          <Link href="/tickets" style={darkButtonStyle}>View Tickets</Link>
        </div>
      </div>

      <h2 style={sectionTitleStyle}>1. Summary by Staff</h2>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Assigned To</th>
            <th style={thStyle}>Manual</th>
            <th style={thStyle}>Zabbix</th>
            <th style={thStyle}>New</th>
            <th style={thStyle}>In Progress</th>
            <th style={thStyle}>Closed</th>
            <th style={thStyle}>Total</th>
            <th style={thStyle}>Latest Created</th>
          </tr>
        </thead>
        <tbody>
          {staffRows.length === 0 ? (
            <tr>
              <td style={tdStyle} colSpan={8}>
                No tickets found for this month.
              </td>
            </tr>
          ) : (
            staffRows.map((row) => (
              <tr key={row.assigned_to}>
                <td style={tdStyle}>
                  <Link
                    href={assignedTicketsLink(row.assigned_to)}
                    style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none" }}
                  >
                    {row.assigned_to}
                  </Link>
                </td>
                <td style={tdStyle}>
                  <Link href={`/tickets?assigned_to=${encodeURIComponent(row.assigned_to)}&source=manual`} style={countLinkStyle}>
                    {row.manual}
                  </Link>
                </td>
                <td style={tdStyle}>
                  <Link href={`/tickets?assigned_to=${encodeURIComponent(row.assigned_to)}&source=slack_zabbix`} style={countLinkStyle}>
                    {row.zabbix}
                  </Link>
                </td>
                <td style={tdStyle}>
                  <Link href={`/tickets?assigned_to=${encodeURIComponent(row.assigned_to)}&status=New`} style={countLinkStyle}>
                    {row.New}
                  </Link>
                </td>
                <td style={tdStyle}>
                  <Link href={`/tickets?assigned_to=${encodeURIComponent(row.assigned_to)}&status=In%20Progress`} style={countLinkStyle}>
                    {row["In Progress"]}
                  </Link>
                </td>
                <td style={tdStyle}>
                  <Link href={`/tickets?assigned_to=${encodeURIComponent(row.assigned_to)}&status=Closed`} style={countLinkStyle}>
                    {row.Closed}
                  </Link>
                </td>
                <td style={tdStyle}>{row.Total}</td>
                <td style={tdStyle}>{formatDateTime(row.latest_created_at)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <h2 style={sectionTitleStyle}>2. Top Incident / Alert</h2>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Incident / Alert</th>
            <th style={thStyle}>Host</th>
            <th style={thStyle}>Source</th>
            <th style={thStyle}>Count</th>
            <th style={thStyle}>Latest Created</th>
          </tr>
        </thead>
        <tbody>
          {topIncidents.length === 0 ? (
            <tr>
              <td style={tdStyle} colSpan={5}>
                No incident data found for this month.
              </td>
            </tr>
          ) : (
            topIncidents.map((row) => (
              <tr key={`${row.title}-${row.host}-${row.source}`}>
                <td style={tdStyle}>{row.title}</td>
                <td style={tdStyle}>{row.host}</td>
                <td style={tdStyle}>{row.source}</td>
                <td style={tdStyle}>{row.count}</td>
                <td style={tdStyle}>{formatDateTime(row.latest_created_at)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </main>
  );
}

const sectionTitleStyle = {
  marginTop: "28px",
  marginBottom: "12px",
  fontSize: "22px",
  fontWeight: "700",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse" as const,
  background: "#fff",
  borderRadius: "14px",
  overflow: "hidden",
  boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
};

const thStyle = {
  textAlign: "left" as const,
  padding: "14px",
  background: "#f1f3f5",
  borderBottom: "1px solid #e5e7eb",
  fontSize: "14px",
};

const tdStyle = {
  padding: "14px",
  borderBottom: "1px solid #eee",
  fontSize: "14px",
};

const buttonStyle = {
  padding: "10px 16px",
  background: "#fff",
  color: "#111827",
  border: "1px solid #ddd",
  borderRadius: "10px",
  textDecoration: "none",
  fontWeight: "600",
};

const darkButtonStyle = {
  ...buttonStyle,
  background: "#111827",
  color: "#fff",
};

const countLinkStyle = {
  color: "#2563eb",
  fontWeight: 700,
  textDecoration: "none",
};
