import TicketActions from "./TicketActions";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  "http://incident-api:8000";

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
  comments?: any[];
};


function commentText(c: any) {
  return c?.comment || c?.body || c?.note || c?.detail || "-";
}

function commentBy(c: any) {
  return c?.created_by || c?.author || c?.user || c?.by || "system";
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

function statusPillStyle(status?: string | null) {
  const s = (status || "").toLowerCase();

  if (s === "closed") {
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  if (s === "in progress") {
    return {
      background: "#ffedd5",
      color: "#c2410c",
      border: "1px solid #fed7aa",
    };
  }

  if (s === "new") {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
      border: "1px solid #bfdbfe",
    };
  }

  return {
    background: "#f1f5f9",
    color: "#475569",
    border: "1px solid #cbd5e1",
  };
}

function severityColor(severity?: string | null) {
  const s = (severity || "").toLowerCase();

  if (s.includes("critical") || s.includes("disaster") || s.includes("high")) {
    return "#dc2626";
  }

  if (s.includes("major") || s.includes("warning")) {
    return "#ea580c";
  }

  return "#2563eb";
}

async function getTicket(id: string): Promise<Ticket | null> {
  try {
    const res = await fetch(`${API_BASE}/api/tickets/${id}`, {
      cache: "no-store",
    });

    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    console.error("Failed to fetch ticket", err);
    return null;
  }
}

export default async function TicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tabParam = sp?.tab || "timeline";
  const activeTab = ["detail", "timeline", "notes", "worklog", "related"].includes(tabParam)
    ? tabParam
    : "timeline";

  const ticket = await getTicket(id);

  if (!ticket) {
    return (
      <main className="rj-light-page" style={{ padding: "24px" }}>
        <a href="/tickets" className="rj-light-link">← Back to Tickets</a>
        <section className="rj-light-panel" style={{ padding: "24px", marginTop: "20px" }}>
          <h1 className="rj-light-title">Ticket not found</h1>
        </section>
      </main>
    );
  }

  const statusStyle = statusPillStyle(ticket.status);
  const sevColor = severityColor(ticket.severity);

  return (
    <main className="rj-light-page" style={{ padding: "24px" }}>
      <a href="/tickets" className="rj-light-link">← Back to Tickets</a>

      <div className="rj-detail-grid" style={{ marginTop: "20px" }}>
        <section className="rj-detail-card">
          <div className="rj-detail-head">
            <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
              <div className="rj-detail-id">#{ticket.id}</div>
              <div>
                <h1 className="rj-detail-title">{ticket.title || "Untitled"}</h1>
                <div style={{ color: "#64748b", fontWeight: 800, marginTop: "6px" }}>
                  Host: {ticket.host || "-"}
                </div>
              </div>
            </div>

            <span style={{
              height: "fit-content",
              padding: "8px 12px",
              borderRadius: "999px",
              fontWeight: 900,
              fontSize: "13px",
              ...statusStyle,
            }}>
              {ticket.status || "Unknown"}
            </span>
          </div>

          <div className="rj-info-grid">
            <InfoCell label="Host" value={ticket.host || "-"} />
            <InfoCell label="Severity" value={ticket.severity || "-"} color={sevColor} />
            <InfoCell label="Source" value={ticket.source || "-"} />
            <InfoCell label="Created" value={formatDate(ticket.created_at)} />
            <InfoCell label="Assigned To" value={ticket.assigned_to || "Unassigned"} />
            <InfoCell label="Work Hours" value={String(ticket.work_hours ?? "-")} />
            <InfoCell label="Work Count" value={String(ticket.work_count ?? "-")} />
            <InfoCell label="Updated" value={formatDate(ticket.updated_at)} />
          </div>

            <div className="rj-tabs">
              <a className={`rj-tab ${activeTab === "detail" ? "rj-tab-active" : ""}`} href={`/tickets/${ticket.id}?tab=detail`}>
                Detail
              </a>
              <a className={`rj-tab ${activeTab === "timeline" ? "rj-tab-active" : ""}`} href={`/tickets/${ticket.id}?tab=timeline`}>
                Timeline
              </a>
              <a className={`rj-tab ${activeTab === "notes" ? "rj-tab-active" : ""}`} href={`/tickets/${ticket.id}?tab=notes`}>
                Notes
              </a>
              <a className={`rj-tab ${activeTab === "worklog" ? "rj-tab-active" : ""}`} href={`/tickets/${ticket.id}?tab=worklog`}>
                Work Log
              </a>
              <a className={`rj-tab ${activeTab === "related" ? "rj-tab-active" : ""}`} href={`/tickets/${ticket.id}?tab=related`}>
                Related Tickets
              </a>
            </div>

            {activeTab === "timeline" && (
              <div className="rj-timeline">
                <TimelineRow
                  time={formatDate(ticket.updated_at)}
                  text={`Status: ${ticket.status || "Unknown"}`}
                  by={ticket.assigned_to || "system"}
                />
                <TimelineRow
                  time={formatDate(ticket.created_at)}
                  text="Ticket created from Roo-Jaeng / Slack-Zabbix"
                  by="system"
                />

                {[...(ticket.comments || [])]
                  .sort((a: any, b: any) => {
                    const da = new Date(a.created_at || 0).getTime();
                    const db = new Date(b.created_at || 0).getTime();
                    return db - da;
                  })
                  .map((c: any) => (
                    <TimelineRow
                      key={c.id || `${c.created_at}-${commentText(c)}`}
                      time={formatDate(c.created_at)}
                      text={commentText(c)}
                      by={commentBy(c)}
                    />
                  ))}
              </div>
            )}

            {activeTab === "detail" && (
              <div style={{ padding: "18px" }}>
                <div className="rj-disabled-box" style={{ whiteSpace: "pre-wrap" }}>
                  {ticket.detail || "No detail"}
                </div>
              </div>
            )}

            {activeTab === "notes" && (
              <div style={{ padding: "18px" }}>
                {ticket.comments && ticket.comments.length > 0 ? (
                  <div className="rj-timeline">
                    {ticket.comments.map((c: any) => (
                      <TimelineRow
                        key={c.id}
                        time={formatDate(c.created_at)}
                        text={c.body || c.comment || c.note || c.detail || "-"}
                        by={c.created_by || c.author || c.user || c.by || "system"}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rj-disabled-box">No notes found</div>
                )}
              </div>
            )}

            {activeTab === "worklog" && (
              <div style={{ padding: "18px" }}>
                <div className="rj-disabled-box">
                  Current summary: {ticket.work_hours ?? 0} hour(s) / {ticket.work_count ?? 0} count
                </div>
              </div>
            )}

            {activeTab === "related" && (
              <div style={{ padding: "18px" }}>
                <div className="rj-disabled-box">Related tickets will be shown here.</div>
              </div>
            )}


        </section>

        <TicketActions ticket={ticket} />
      </div>
    </main>
  );
}

function InfoCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rj-info-cell">
      <div className="rj-info-label">{label}</div>
      <div className="rj-info-value" style={{ color: color || "#0f172a" }}>
        {value}
      </div>
    </div>
  );
}

function TimelineRow({
  time,
  text,
  by,
}: {
  time: string;
  text: string;
  by: string;
}) {
  return (
    <div className="rj-timeline-row">
      <div className="rj-timeline-dot" />
      <div style={{ color: "#475569", fontWeight: 800 }}>{time}</div>
      <div style={{ color: "#0f172a", fontWeight: 900 }}>{text}</div>
      <div style={{ color: "#64748b" }}>by {by}</div>
    </div>
  );
}
