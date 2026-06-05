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
  created_at?: string | null;
  updated_at?: string | null;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  "http://incident-api:8000";

function cleanTitle(value?: string | null) {
  if (!value) return "Unknown Alert";

  return value
    .replace(/^Problem:\s*/i, "")
    .replace(/^Resolved.*?:\s*/i, "")
    .replace(/\s+on\s+[A-Z0-9_-]+$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanHost(value?: string | null) {
  if (!value || value.trim() === "" || value.trim() === "-") return "Unknown";
  return value.replace(/\[.*?\]/g, "").trim();
}

function isCurrentMonth(dateText?: string | null) {
  if (!dateText) return false;

  const d = new Date(dateText);
  if (Number.isNaN(d.getTime())) return false;

  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function formatDate(value?: string | null) {
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

async function getTickets(): Promise<Ticket[]> {
  try {
    const res = await fetch(`${API_BASE}/api/tickets`, {
      cache: "no-store",
    });

    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch tickets", err);
    return [];
  }
}

export default async function ZabbixRiskPage() {
  const tickets = await getTickets();

  const zabbixThisMonth = tickets.filter(
    (t) => t.source === "slack_zabbix" && isCurrentMonth(t.created_at)
  );

  const groups: Record<string, {
    host: string;
    title: string;
    count: number;
    open: number;
    latestId: number;
    latestAt?: string | null;
    severity?: string | null;
  }> = {};

  for (const t of zabbixThisMonth) {
    const host = cleanHost(t.host);
    const title = cleanTitle(t.title);
    const key = `${host}|${title}`;

    if (!groups[key]) {
      groups[key] = {
        host,
        title,
        count: 0,
        open: 0,
        latestId: t.id,
        latestAt: t.created_at,
        severity: t.severity,
      };
    }

    groups[key].count += 1;

    if (t.status !== "Closed") {
      groups[key].open += 1;
    }

    if ((t.id || 0) > groups[key].latestId) {
      groups[key].latestId = t.id;
      groups[key].latestAt = t.created_at;
      groups[key].severity = t.severity;
    }
  }

  const repeatedGroups = Object.values(groups)
    .filter((g) => g.count >= 3)
    .sort((a, b) => b.count - a.count);

  return (
    <main className="rj-light-page" style={{ padding: "28px", background: "#f8fbff", minHeight: "100vh" }}>
      <a href="/" style={{ color: "#0f172a", textDecoration: "none" }}>
        ← Back to Dashboard
      </a>

      <section style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "16px",
        marginTop: "20px",
        marginBottom: "24px",
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800 }}>
            Repeated Zabbix Risk
          </h1>
          <p style={{ marginTop: "8px", color: "#475569" }}>
            Alert patterns repeated 3+ times this month. Showing {repeatedGroups.length} risk patterns.
          </p>
        </div>

        <div className="rj-light-actions" style={{ display: "flex", gap: "10px" }}>
          <a href="/tickets?source=slack_zabbix" style={buttonStyle}>All Zabbix Tickets</a>
          <a href="/tickets?source=slack_zabbix&status_not=Closed" style={buttonStyle}>Open Zabbix</a>
        </div>
      </section>

      <section style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: "14px",
        marginBottom: "20px",
      }}>
        <SummaryCard title="Repeated Risk Patterns" value={repeatedGroups.length} />
        <SummaryCard title="Total Repeated Tickets" value={repeatedGroups.reduce((sum, g) => sum + g.count, 0)} />
        <SummaryCard title="Still Open" value={repeatedGroups.reduce((sum, g) => sum + g.open, 0)} />
      </section>

      <section className="rj-light-panel rj-light-table-wrap rj-risk-table" style={panelStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
              <th style={thStyle}>Risk</th>
              <th style={thStyle}>Host</th>
              <th style={thStyle}>Alert</th>
              <th style={thStyle}>Count</th>
              <th style={thStyle}>Open</th>
              <th style={thStyle}>Severity</th>
              <th style={thStyle}>Latest</th>
              <th style={thStyle}>Action</th>
            </tr>
          </thead>

          <tbody>
            {repeatedGroups.map((g, index) => (
              <tr key={`${g.host}-${g.title}`} style={{ borderBottom: "1px solid #edf2f7" }}>
                <td style={tdStyle}>
                  <b>#{index + 1}</b>
                </td>
                <td style={tdStyle}>
                  <a href={`/tickets?source=slack_zabbix&host=${encodeURIComponent(g.host)}`} style={linkStyle}>
                    {g.host}
                  </a>
                </td>
                <td style={tdStyle}>
                  <b>{g.title}</b>
                </td>
                <td style={tdStyle}>
                  <span style={countPill}>{g.count}</span>
                </td>
                <td style={tdStyle}>
                  <span style={g.open > 0 ? dangerPill : okPill}>{g.open}</span>
                </td>
                <td style={tdStyle}>{g.severity || "-"}</td>
                <td style={tdStyle}>{formatDate(g.latestAt)}</td>
                <td style={tdStyle}>
                  <a
                    href={`/tickets?source=slack_zabbix&host=${encodeURIComponent(g.host)}&title=${encodeURIComponent(g.title.toLowerCase())}`}
                    style={linkStyle}
                  >
                    View tickets →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {repeatedGroups.length === 0 && (
          <div style={{
            padding: "32px",
            textAlign: "center",
            color: "#64748b",
          }}>
            No repeated Zabbix risk found this month.
          </div>
        )}
      </section>
    </main>
  );
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <div style={{
      background: "#ffffff",
      border: "1px solid #dbe4ef",
      borderRadius: "16px",
      padding: "18px",
    }}>
      <div style={{ color: "#475569", fontSize: "14px" }}>{title}</div>
      <div style={{ fontSize: "30px", fontWeight: 800, marginTop: "8px" }}>{value}</div>
    </div>
  );
}

const panelStyle = {
  background: "#ffffff",
  border: "1px solid #dbe4ef",
  borderRadius: "18px",
  padding: "20px",
};

const thStyle = {
  textAlign: "left" as const,
  padding: "12px 8px",
  fontWeight: 800,
  color: "#0f172a",
};

const tdStyle = {
  padding: "14px 8px",
  color: "#0f172a",
  verticalAlign: "top" as const,
};

const buttonStyle = {
  padding: "12px 16px",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#0f172a",
  textDecoration: "none",
  fontWeight: 800,
  border: "1px solid #cbd5e1",
};

const linkStyle = {
  color: "#2563eb",
  textDecoration: "none",
  fontWeight: 800,
};

const countPill = {
  display: "inline-block",
  minWidth: "34px",
  textAlign: "center" as const,
  padding: "6px 10px",
  borderRadius: "999px",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontWeight: 800,
};

const dangerPill = {
  display: "inline-block",
  minWidth: "34px",
  textAlign: "center" as const,
  padding: "6px 10px",
  borderRadius: "999px",
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: 800,
};

const okPill = {
  display: "inline-block",
  minWidth: "34px",
  textAlign: "center" as const,
  padding: "6px 10px",
  borderRadius: "999px",
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 800,
};
