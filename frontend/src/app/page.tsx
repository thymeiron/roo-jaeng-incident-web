import ZabbixMonthlyTrend from "./ZabbixMonthlyTrend";
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
  created_at?: string | null;
  updated_at?: string | null;
};

type DashboardSummary = {
  total: number;
  new: number;
  in_progress: number;
  closed: number;
  open_zabbix: number;
  manual_pending: number;
};

type RiskLevel = "critical" | "high" | "medium";

function cleanTitle(title?: string | null) {
  if (!title) return "Unknown Alert";

  return title
    .replace(/^Problem:\s*/i, "")
    .replace(/^Resolved.*?:\s*/i, "")
    .replace(/\s+on\s+[A-Z0-9_-]+$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHost(host?: string | null) {
  if (!host || host.trim() === "" || host.trim() === "-") return "Unknown";
  return host.replace(/\[.*?\]/g, "").trim();
}

function isCurrentMonth(dateText?: string | null) {
  if (!dateText) return false;

  const d = new Date(dateText);
  if (Number.isNaN(d.getTime())) return false;

  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function countBy<T extends string>(items: T[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {});
}

function topEntries(obj: Record<string, number>, limit = 5) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function pct(value: number, max: number) {
  if (!max) return 0;
  return Math.max(6, Math.round((value / max) * 100));
}

function q(value: string) {
  return encodeURIComponent(value);
}

function severityRank(sev?: string | null) {
  const s = (sev || "").toLowerCase();
  if (s.includes("disaster")) return 5;
  if (s.includes("critical")) return 5;
  if (s.includes("major")) return 4;
  if (s.includes("high")) return 4;
  if (s.includes("average")) return 3;
  if (s.includes("warning")) return 2;
  if (s.includes("medium")) return 2;
  if (s.includes("info")) return 1;
  return 0;
}

function riskLevel(count: number, index: number): RiskLevel {
  if (index === 0 || count >= 50) return "critical";
  if (count >= 15) return "high";
  return "medium";
}

function riskByText(title: string, count: number, index: number): RiskLevel {
  const lower = title.toLowerCase();

  if (lower.includes("disk i/o") || lower.includes("free disk")) {
    if (count >= 10 || index === 0) return "critical";
    return "high";
  }

  if (lower.includes("cpu") && count >= 50) return "critical";
  return riskLevel(count, index);
}

function riskStyle(level: RiskLevel) {
  if (level === "critical") {
    return {
      name: "CRITICAL",
      icon: "⚠",
      accent: "#dc2626",
      accent2: "#ef4444",
      soft: "#fef2f2",
      border: "#fecaca",
      text: "#7f1d1d",
      pillBg: "#fee2e2",
      pillText: "#b91c1c",
      shadow: "0 10px 24px rgba(220, 38, 38, 0.13)",
    };
  }

  if (level === "high") {
    return {
      name: "HIGH",
      icon: "▲",
      accent: "#ea580c",
      accent2: "#f97316",
      soft: "#fff7ed",
      border: "#fed7aa",
      text: "#7c2d12",
      pillBg: "#ffedd5",
      pillText: "#c2410c",
      shadow: "0 10px 24px rgba(234, 88, 12, 0.11)",
    };
  }

  return {
    name: "MEDIUM",
    icon: "i",
    accent: "#2563eb",
    accent2: "#3b82f6",
    soft: "#eff6ff",
    border: "#bfdbfe",
    text: "#1e3a8a",
    pillBg: "#dbeafe",
    pillText: "#1d4ed8",
    shadow: "0 10px 24px rgba(37, 99, 235, 0.10)",
  };
}

function badgeStyle(status?: string | null) {
  const st = (status || "").toLowerCase();

  if (st === "closed") {
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
      fontWeight: 900,
    };
  }

  if (st === "in progress") {
    return {
      background: "#ffedd5",
      color: "#c2410c",
      border: "1px solid #fed7aa",
      fontWeight: 900,
    };
  }

  if (st === "new") {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
      border: "1px solid #bfdbfe",
      fontWeight: 900,
    };
  }

  return {
    background: "#f1f5f9",
    color: "#475569",
    border: "1px solid #cbd5e1",
    fontWeight: 900,
  };
}

async function getTickets(): Promise<Ticket[]> {
  try {
    const res = await authenticatedApiFetch("/api/tickets?limit=500", {
      cache: "no-store",
    });

    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch tickets", err);
    return [];
  }
}

async function getSummary(): Promise<DashboardSummary> {
  const emptySummary: DashboardSummary = {
    total: 0,
    new: 0,
    in_progress: 0,
    closed: 0,
    open_zabbix: 0,
    manual_pending: 0,
  };

  try {
    const res = await authenticatedApiFetch("/api/dashboard/summary", {
      cache: "no-store",
    });

    if (!res.ok) return emptySummary;
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch dashboard summary", err);
    return emptySummary;
  }
}

export default async function DashboardPage() {
  const [tickets, summary] = await Promise.all([
    getTickets(),
    getSummary(),
  ]);

  const total = summary.total;
  const newCount = summary.new;
  const inProgressCount = summary.in_progress;
  const closedCount = summary.closed;

  const zabbixTickets = tickets.filter((t) => t.source === "slack_zabbix");
  const zabbixThisMonth = zabbixTickets.filter((t) => isCurrentMonth(t.created_at));

  const openZabbix = zabbixTickets.filter((t) => t.status !== "Closed");
  const manualOpen = tickets
    .filter((t) => t.source !== "slack_zabbix" && t.status !== "Closed")
    .sort((a, b) => {
      const ar = severityRank(a.severity);
      const br = severityRank(b.severity);
      if (br !== ar) return br - ar;
      return (b.id || 0) - (a.id || 0);
    })
    .slice(0, 8);

  const alertCounts = countBy(
    zabbixThisMonth.map((t) => `${normalizeHost(t.host)} | ${cleanTitle(t.title)}`)
  );

  const hostCounts = countBy(
    zabbixThisMonth.map((t) => normalizeHost(t.host))
  );

  const topAlerts = topEntries(alertCounts, 6);
  const topHosts = topEntries(hostCounts, 6);

  const maxAlert = topAlerts[0]?.[1] || 0;
  const maxHost = topHosts[0]?.[1] || 0;

  const repeatedRisk = topAlerts.filter(([, count]) => count >= 3).length;
  const openManualRisk = summary.manual_pending;
  const openZabbixRisk = summary.open_zabbix;

  return (
    <main className="dashboard-page" style={pageStyle}>
      <section className="dashboard-hero" style={heroStyle}>
        <div>
          <div style={eyebrow}>IDS Support / Roo-Jaeng</div>
          <h1 className="dashboard-title" style={titleStyle}>
            Roo-Jaeng Incident Dashboard
          </h1>
          <p className="dashboard-subtitle" style={subtitleStyle}>
            Monthly risk summary from Slack/Zabbix and manual pending cases
          </p>
        </div>

        <div className="dashboard-actions" style={actionsStyle}>
          <a href="/tickets/new" style={primaryButton}>+ Create Ticket</a>
          <a href="/tickets" style={secondaryButton}>View All Tickets</a>
          <a href="/reports" style={secondaryButton}>Monthly Report</a>
        </div>
      </section>

      <section className="dashboard-summary-grid" style={summaryGrid}>
        <a href="/tickets" style={plainLink}>
          <SummaryCard title="Total Tickets" value={total} />
        </a>
        <a href="/tickets?status=New" style={plainLink}>
          <SummaryCard title="New" value={newCount} />
        </a>
        <a href="/tickets?status=In%20Progress" style={plainLink}>
          <SummaryCard title="In Progress" value={inProgressCount} />
        </a>
        <a href="/tickets?status=Closed" style={plainLink}>
          <SummaryCard title="Closed" value={closedCount} />
        </a>
      </section>

      <section className="dashboard-risk-grid" style={riskGrid}>
        <a href="/zabbix-risk" style={plainLink}>
          <RiskCard
            title="Repeated Zabbix Risk"
            value={repeatedRisk}
            detail="Alert patterns repeated 3+ times this month"
            level={repeatedRisk > 0 ? "warning" : "ok"}
          />
        </a>
        <a href="/tickets?source=slack_zabbix&status_not=Closed" style={plainLink}>
          <RiskCard
            title="Open Zabbix Cases"
            value={openZabbixRisk}
            detail="Zabbix alerts not closed yet"
            level={openZabbixRisk > 0 ? "warning" : "ok"}
          />
        </a>
        <a href="/tickets?source=manual&status_not=Closed" style={plainLink}>
          <RiskCard
            title="Manual Pending"
            value={openManualRisk}
            detail="Manual / imported cases still open"
            level={openManualRisk > 0 ? "danger" : "ok"}
          />
        </a>
      </section>

      <section className="dashboard-panel-grid" style={panelGrid}>
        <div className="dashboard-panel" style={panel}>
          <div style={panelHeader}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div style={sectionIconCritical}>⚠</div>
              <div>
                <h2 style={panelTitle}>
                    Top Zabbix Alerts —{" "}
                    {new Intl.DateTimeFormat("en-US", {
                      month: "long",
                      year: "numeric",
                      timeZone: "Asia/Bangkok",
                    }).format(new Date())}
                  </h2>
                <p style={panelSubTitle}>What alert happens most often and on which host</p>
              </div>
            </div>
            <a href="/tickets?source=slack_zabbix" style={smallLink}>Open tickets →</a>
          </div>

          {topAlerts.length === 0 ? (
            <EmptyText text="No Zabbix alerts found this month." />
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {topAlerts.map(([key, count], index) => {
                const [host, title] = key.split(" | ");
                const level = riskByText(title, count, index);
                const style = riskStyle(level);

                return (
                  <AlertRow
                    key={key}
                    rank={index + 1}
                    title={title}
                    host={host}
                    count={count}
                    percent={pct(count, maxAlert)}
                    href={`/tickets?source=slack_zabbix&host=${q(host)}&title=${q(title.toLowerCase())}`}
                    styleData={style}
                    type="alert"
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className="dashboard-panel" style={panel}>
          <div style={panelHeader}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div style={sectionIconHost}>▣</div>
              <div>
                <h2 style={panelTitle}>
                    Top Risk Hosts —{" "}
                    {new Intl.DateTimeFormat("en-US", {
                      month: "long",
                      year: "numeric",
                      timeZone: "Asia/Bangkok",
                    }).format(new Date())}
                  </h2>
                <p style={panelSubTitle}>Hosts with most Zabbix alerts this month</p>
              </div>
            </div>
          </div>

          {topHosts.length === 0 ? (
            <EmptyText text="No host alert data this month." />
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {topHosts.map(([host, count], index) => {
                const level = riskLevel(count, index);
                const style = riskStyle(level);

                return (
                  <AlertRow
                    key={host}
                    rank={index + 1}
                    title={host}
                    host="Zabbix monitored host"
                    count={count}
                    percent={pct(count, maxHost)}
                    href={`/tickets?source=slack_zabbix&host=${q(host)}`}
                    styleData={style}
                    type="host"
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>

        <ZabbixMonthlyTrend />


      <section style={panel}>
        <div style={panelHeader}>
          <div>
            <h2 style={panelTitle}>Manual Pending Cases</h2>
            <p style={panelSubTitle}>
              Manual / imported cases that still need follow-up
            </p>
          </div>
          <a href="/tickets" style={smallLink}>View all →</a>
        </div>

        {manualOpen.length === 0 ? (
          <EmptyText text="No manual pending cases." />
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {manualOpen.map((t) => (
              <a
                key={t.id}
                href={`/tickets/${t.id}`}
                className="manual-row"
                style={manualRow}
              >
                <b>#{t.id}</b>
                <div>
                  <div style={{ fontWeight: 800 }}>{t.title || "Untitled"}</div>
                  <div style={{ fontSize: "13px", color: "#64748b", marginTop: "3px" }}>
                    Host: {normalizeHost(t.host)} | Assigned: {t.assigned_to || "-"}
                  </div>
                </div>
                <span style={dangerStatusPill}>
                  {t.severity || "None"}
                </span>
                <span style={{
                  justifySelf: "start",
                  padding: "6px 10px",
                  borderRadius: "999px",
                  fontSize: "13px",
                  ...badgeStyle(t.status),
                }}>
                  {t.status || "Unknown"}
                </span>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function AlertRow({
  rank,
  title,
  host,
  count,
  percent,
  href,
  styleData,
  type,
}: {
  rank: number;
  title: string;
  host: string;
  count: number;
  percent: number;
  href: string;
  styleData: ReturnType<typeof riskStyle>;
  type: "alert" | "host";
}) {
  return (
    <a
      href={href}
      className="alert-row"
      style={{
        display: "grid",
        gridTemplateColumns: "42px 42px 1fr 58px",
        gap: "10px",
        alignItems: "center",
        padding: "9px 10px",
        borderRadius: "16px",
        border: `1px solid ${styleData.border}`,
        background: `linear-gradient(90deg, ${styleData.soft} 0%, #ffffff 72%)`,
        color: "#0f172a",
        textDecoration: "none",
        boxShadow: styleData.shadow,
        borderLeft: `6px solid ${styleData.accent}`,
      }}
    >
      <div style={{
        height: "42px",
        borderRadius: "14px",
        display: "grid",
        placeItems: "center",
        background: styleData.accent,
        color: "#ffffff",
        fontWeight: 900,
        fontSize: "18px",
      }}>
        {rank}
      </div>

      <div className="alert-icon" style={{
        height: "38px",
        width: "38px",
        borderRadius: "16px",
        display: "grid",
        placeItems: "center",
        background: styleData.pillBg,
        color: styleData.pillText,
        border: `1px solid ${styleData.border}`,
        fontWeight: 900,
        fontSize: "18px",
      }}>
        {type === "host" ? "▤" : styleData.icon}
      </div>

      <div>
        <div className="alert-title" style={{ fontWeight: 900, fontSize: "14px", color: styleData.text }}>
          {title}
        </div>
        <div className="alert-meta" style={{ color: "#475569", fontSize: "11px", marginTop: "2px" }}>
          Host: {host}
        </div>
        <div style={barBg}>
          <div style={{
            height: "100%",
            width: `${percent}%`,
            borderRadius: "999px",
            background: `linear-gradient(90deg, ${styleData.accent}, ${styleData.accent2})`,
          }} />
        </div>
      </div>

      <div>
        <div className="alert-count" style={{
          minWidth: "58px",
          padding: "10px 8px",
          borderRadius: "16px",
          textAlign: "center",
          background: styleData.pillBg,
          color: styleData.pillText,
          border: `1px solid ${styleData.border}`,
          fontWeight: 900,
          fontSize: "18px",
        }}>
          {count}
        </div>
        <div style={{
          marginTop: "5px",
          textAlign: "center",
          color: styleData.pillText,
          fontSize: "10px",
          fontWeight: 900,
          letterSpacing: "0.04em",
        }}>
          {styleData.name}
        </div>
      </div>
    </a>
  );
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="dashboard-card" style={summaryCard}>
      <div style={{ color: "#475569", fontSize: "14px", fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: "26px", fontWeight: 900, marginTop: "8px", color: "#0f172a" }}>{value}</div>
    </div>
  );
}

function RiskCard({
  title,
  value,
  detail,
  level,
}: {
  title: string;
  value: number;
  detail: string;
  level: "ok" | "warning" | "danger";
}) {
  const color =
    level === "danger"
      ? { bg: "#fee2e2", text: "#991b1b", border: "#fecaca" }
      : level === "warning"
      ? { bg: "#fef3c7", text: "#92400e", border: "#fde68a" }
      : { bg: "#dcfce7", text: "#166534", border: "#bbf7d0" };

  return (
    <div className="dashboard-card" style={summaryCard}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
        <div>
          <div style={{ color: "#475569", fontSize: "14px", fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: "26px", fontWeight: 900, marginTop: "8px", color: "#0f172a" }}>{value}</div>
          <div style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>{detail}</div>
        </div>
        <span style={{
          height: "fit-content",
          padding: "6px 10px",
          borderRadius: "999px",
          background: color.bg,
          color: color.text,
          border: `1px solid ${color.border}`,
          fontSize: "12px",
          fontWeight: 900,
        }}>
          {level.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <div style={{
      padding: "24px",
      border: "1px dashed #cbd5e1",
      borderRadius: "14px",
      color: "#64748b",
      textAlign: "center",
      background: "#ffffff",
    }}>
      {text}
    </div>
  );
}

const pageStyle = {
  padding: "14px",
  background: "linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%)",
  minHeight: "100vh",
  maxWidth: "1460px",
  margin: "0 auto",
};

const heroStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "24px",
};

const eyebrow = {
  color: "#2563eb",
  fontSize: "13px",
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  marginBottom: "8px",
};

const titleStyle = {
  margin: 0,
  fontSize: "28px",
  fontWeight: 900,
  color: "#0f172a",
};

const subtitleStyle = {
  marginTop: "8px",
  color: "#334155",
  fontSize: "15px",
};

const actionsStyle = {
  display: "flex",
  gap: "10px",
};

const plainLink = {
  textDecoration: "none",
  color: "inherit",
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "10px",
  marginBottom: "20px",
};

const riskGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "10px",
  marginBottom: "20px",
};

const panelGrid = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr",
  gap: "14px",
  marginBottom: "20px",
};

const primaryButton = {
  padding: "12px 16px",
  borderRadius: "12px",
  background: "#0f172a",
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 900,
  border: "1px solid #0f172a",
  boxShadow: "0 8px 20px rgba(15,23,42,0.16)",
};

const secondaryButton = {
  padding: "12px 16px",
  borderRadius: "12px",
  background: "#ffffff",
  color: "#0f172a",
  textDecoration: "none",
  fontWeight: 900,
  border: "1px solid #cbd5e1",
};

const smallLink = {
  color: "#2563eb",
  fontWeight: 900,
  textDecoration: "none",
  whiteSpace: "nowrap" as const,
};

const summaryCard = {
  background: "#ffffff",
  border: "1px solid #dbe4ef",
  borderRadius: "16px",
  padding: "14px",
  boxShadow: "0 10px 26px rgba(15, 23, 42, 0.07)",
};

const panel = {
  background: "#ffffff",
  border: "1px solid #dbe4ef",
  borderRadius: "16px",
  padding: "16px",
  boxShadow: "0 14px 36px rgba(15, 23, 42, 0.08)",
};

const panelHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  marginBottom: "18px",
};

const panelTitle = {
  margin: 0,
  fontSize: "18px",
  fontWeight: 900,
  color: "#0f172a",
};

const panelSubTitle = {
  margin: "5px 0 0 0",
  color: "#475569",
  fontSize: "14px",
};

const sectionIconCritical = {
  height: "48px",
  width: "48px",
  display: "grid",
  placeItems: "center",
  borderRadius: "16px",
  background: "#fee2e2",
  color: "#dc2626",
  border: "1px solid #fecaca",
  fontWeight: 900,
  fontSize: "24px",
};

const sectionIconHost = {
  height: "48px",
  width: "48px",
  display: "grid",
  placeItems: "center",
  borderRadius: "16px",
  background: "#ffedd5",
  color: "#ea580c",
  border: "1px solid #fed7aa",
  fontWeight: 900,
  fontSize: "18px",
};

const barBg = {
  height: "9px",
  background: "#e2e8f0",
  borderRadius: "999px",
  overflow: "hidden",
  marginTop: "10px",
};

const manualRow = {
  display: "grid",
  gridTemplateColumns: "90px 1fr 130px 130px",
  gap: "12px",
  alignItems: "center",
  padding: "14px",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  textDecoration: "none",
  color: "#0f172a",
  background: "#ffffff",
};

const dangerStatusPill = {
  justifySelf: "start",
  padding: "6px 10px",
  borderRadius: "999px",
  background: "#fee2e2",
  color: "#b91c1c",
  border: "1px solid #fecaca",
  fontSize: "13px",
  fontWeight: 900,
};
