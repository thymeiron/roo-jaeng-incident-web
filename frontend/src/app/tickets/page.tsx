import InlineDetailEditor from "./InlineDetailEditor";
import PageSizeSelect from "./PageSizeSelect";
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

type TicketsResponse = {
  items: Ticket[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

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


function shortDetail(value?: string | null) {
  if (!value) return "-";
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > 120 ? clean.slice(0, 120) + "..." : clean;
}


function statusAccent(status?: string | null) {
  const s = (status || "").toLowerCase();

  if (s === "closed") return "#16a34a";
  if (s === "in progress") return "#ea580c";
  return "#2563eb";
}

function statusAccentSoft(status?: string | null) {
  const s = (status || "").toLowerCase();

  if (s === "closed") return "#dcfce7";
  if (s === "in progress") return "#ffedd5";
  return "#dbeafe";
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

function buildTitle(params: {
  status?: string;
  assigned_to?: string;
  source?: string;
  host?: string;
  title?: string;
  risk?: string;
  status_not?: string;
  q?: string;
}) {
  const parts: string[] = [];

  if (params.q) parts.push(`Search: ${params.q}`);
  if (params.status) parts.push(`Status: ${params.status}`);
  if (params.status_not) parts.push(`Status not: ${params.status_not}`);
  if (params.assigned_to) parts.push(`Assigned: ${params.assigned_to}`);
  if (params.source) parts.push(`Source: ${params.source}`);
  if (params.host) parts.push(`Host: ${params.host}`);
  if (params.title) parts.push(`Alert: ${params.title}`);
  if (params.risk === "repeated") parts.push("Repeated Zabbix Risk");

  if (parts.length === 0) return "Tickets";
  return `Tickets - ${parts.join(" | ")}`;
}

async function getTickets(params: URLSearchParams): Promise<TicketsResponse> {
  try {
    params.set("paginated", "true");
    const url = `/api/tickets?${params.toString()}`;

    const res = await authenticatedApiFetch(url, {
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`Ticket API returned ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch tickets", err);
    return { items: [], page: 1, page_size: 100, total: 0, total_pages: 0 };
  }
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function paginationPages(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = new Set([1, total, current - 1, current, current + 1]);
  const valid = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  valid.forEach((page, index) => {
    if (index > 0 && page - valid[index - 1] > 1) result.push("ellipsis");
    result.push(page);
  });
  return result;
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};

  const status = typeof sp.status === "string" ? sp.status : undefined;
  const statusNot = typeof sp.status_not === "string" ? sp.status_not : undefined;
  const assignedTo = typeof sp.assigned_to === "string" ? sp.assigned_to : undefined;
  const source = typeof sp.source === "string" ? sp.source : undefined;
  const host = typeof sp.host === "string" ? sp.host : undefined;
  const title = typeof sp.title === "string" ? sp.title : undefined;
  const risk = typeof sp.risk === "string" ? sp.risk : undefined;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const requestedPage = positiveInteger(typeof sp.page === "string" ? sp.page : undefined, 1);
  const requestedPageSize = positiveInteger(typeof sp.page_size === "string" ? sp.page_size : undefined, 100);
  const pageSize = [50, 100, 200].includes(requestedPageSize) ? requestedPageSize : 100;

  const apiParams = new URLSearchParams();
  const filters = { q, status, status_not: statusNot, assigned_to: assignedTo, source, host, title, risk };
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined) apiParams.set(key, value);
  });
  apiParams.set("page", String(requestedPage));
  apiParams.set("page_size", String(pageSize));

  const response = await getTickets(apiParams);
  const tickets = response.items;
  const currentPage = response.page;
  const totalPages = response.total_pages;

  function ticketsUrl(overrides: Record<string, string | number | undefined>, clearFilters = false) {
    const params = new URLSearchParams();
    if (!clearFilters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.set(key, value);
      });
    }
    params.set("page", String(overrides.page ?? 1));
    params.set("page_size", String(overrides.page_size ?? pageSize));
    Object.entries(overrides).forEach(([key, value]) => {
      if (key === "page" || key === "page_size") return;
      if (value === undefined) params.delete(key);
      else params.set(key, String(value));
    });
    return `/tickets?${params.toString()}`;
  }

  const allUrl = ticketsUrl({}, true);
  const newUrl = ticketsUrl({ status: "New" }, true);
  const inProgressUrl = ticketsUrl({ status: "In Progress" }, true);
  const closedUrl = ticketsUrl({ status: "Closed" }, true);
  const showingFrom = response.total === 0 ? 0 : (currentPage - 1) * response.page_size + 1;
  const showingTo = Math.min(currentPage * response.page_size, response.total);

  return (
    <main className="rj-page" style={{ padding: "28px", background: "#ffffff", minHeight: "100vh" }}>
      <a href="/" style={{ color: "#0f172a", textDecoration: "none" }}>
        ← Back to Dashboard
      </a>

      <section
        className="rj-header rj-header-main"
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "16px",
          alignItems: "flex-start",
          marginTop: "20px",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "24px" }}>
            {buildTitle({
              status,
              assigned_to: assignedTo,
              source,
              host,
              title,
              risk,
              status_not: statusNot,
              q,
            })}
          </h1>

          <p style={{ marginTop: "8px", color: "#334155" }}>
            Showing {showingFrom.toLocaleString("en-US")}–{showingTo.toLocaleString("en-US")} of {response.total.toLocaleString("en-US")} tickets
          </p>
        </div>

        <div className="rj-actions" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <a href={allUrl} style={buttonStyle}>All</a>
          <a href={newUrl} style={newFilterButtonStyle}>New</a>
          <a href={inProgressUrl} style={inProgressFilterButtonStyle}>In Progress</a>
          <a href={closedUrl} style={closedFilterButtonStyle}>Closed</a>
          <a href="/reports" style={buttonStyle}>Monthly Report</a>
          <a href="/tickets/new" style={primaryButtonStyle}>+ Create Ticket</a>
        </div>
      </section>

      <form
        action="/tickets"
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: "18px",
          padding: "14px",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          background: "#f8fafc",
        }}
      >
        {status && <input type="hidden" name="status" value={status} />}
        {statusNot && <input type="hidden" name="status_not" value={statusNot} />}
        {assignedTo !== undefined && <input type="hidden" name="assigned_to" value={assignedTo} />}
        {source && <input type="hidden" name="source" value={source} />}
        {host && <input type="hidden" name="host" value={host} />}
        {title && <input type="hidden" name="title" value={title} />}
        {risk && <input type="hidden" name="risk" value={risk} />}
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="page_size" value={pageSize} />

        <input
          name="q"
          defaultValue={q || ""}
          placeholder="Search ID, title, host, detail, status, assigned..."
          style={{
            flex: "1 1 320px",
            minWidth: "240px",
            padding: "12px 14px",
            borderRadius: "10px",
            border: "1px solid #cbd5e1",
            color: "#0f172a",
            background: "#ffffff",
            fontWeight: 600,
          }}
        />

        <button type="submit" style={primaryButtonStyle}>
          Search
        </button>

        {q && (
          <a href={ticketsUrl({ q: undefined })} style={buttonStyle}>
            Clear
          </a>
        )}
      </form>

      <div style={paginationBarStyle}>
        <PageSizeSelect value={pageSize} />
        <nav aria-label="Ticket pagination" style={paginationNavStyle}>
          <a aria-disabled={currentPage <= 1} href={currentPage > 1 ? ticketsUrl({ page: currentPage - 1 }) : undefined} style={currentPage <= 1 ? disabledPageStyle : pageLinkStyle}>Previous</a>
          {paginationPages(currentPage, totalPages).map((item, index) =>
            item === "ellipsis" ? (
              <span key={`ellipsis-${index}`} style={ellipsisStyle}>…</span>
            ) : (
              <a key={item} aria-current={item === currentPage ? "page" : undefined} href={ticketsUrl({ page: item })} style={item === currentPage ? activePageStyle : pageLinkStyle}>{item}</a>
            )
          )}
          <a aria-disabled={currentPage >= totalPages} href={currentPage < totalPages ? ticketsUrl({ page: currentPage + 1 }) : undefined} style={currentPage >= totalPages ? disabledPageStyle : pageLinkStyle}>Next</a>
        </nav>
      </div>

      <div className="rj-table-wrap" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
              <th style={{ ...thStyle, width: "58px" }}>ID</th>
              <th style={{ ...thStyle, width: "34%" }}>Title</th>
              <th style={{ ...thStyle, width: "11%" }}>Host</th>
              <th style={{ ...thStyle, width: "18%" }}>Detail</th>
              <th style={{ ...thStyle, width: "95px" }}>Status</th>
              <th style={{ ...thStyle, width: "90px" }}>Assigned</th>
              <th style={{ ...thStyle, width: "50px" }}>ชม/วัน</th>
              <th style={{ ...thStyle, width: "50px" }}>งาน/วัน</th>
              <th style={{ ...thStyle, width: "85px" }}>Source</th>
              <th style={{ ...thStyle, width: "100px" }}>Created</th>
            </tr>
          </thead>

          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id} style={{ borderBottom: "1px solid #edf2f7", background: "#ffffff" }}>
                <td
                    style={{
                      ...tdStyle,
                      borderLeft: `4px solid ${statusAccent(ticket.status)}`,
                      paddingLeft: "10px",
                    }}
                  >
                    <a
                      href={`/tickets/${ticket.id}`}
                      style={{
                        textDecoration: "none",
                        fontWeight: 800,
                        color: statusAccent(ticket.status),
                      }}
                    >
                      {ticket.id}
                    </a>
                  </td>
                <td style={tdStyle}>
                  <a href={`/tickets/${ticket.id}`} style={{ color: "#0f172a", textDecoration: "none" }}>
                    {ticket.title}
                  </a>
                </td>
                <td style={{ ...tdStyle, whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.35 }}>{ticket.host || "-"}</td>
                <td style={{ ...tdStyle, whiteSpace: "normal", verticalAlign: "top" }}>
                    <InlineDetailEditor ticketId={ticket.id} initialDetail={ticket.detail} status={ticket.status} />
                  </td>
                <td style={tdStyle}>
                  <span style={{ ...statusPillBase, ...statusPillStyle(ticket.status) }}>
                    {ticket.status || "Unknown"}
                  </span>
                </td>
                <td style={tdStyle}>
                  <a
                    href={ticketsUrl(
                      { assigned_to: ticket.assigned_to || "" },
                      true
                    )}
                    style={{
                        textDecoration: "none",
                        fontWeight: 700,
                        color: statusAccent(ticket.status),
                      }}
                  >
                    {ticket.assigned_to || "Unassigned"}
                  </a>
                </td>
                <td style={tdStyle}>{ticket.work_hours ?? "-"}</td>
                <td style={tdStyle}>{ticket.work_count ?? "-"}</td>
                <td style={tdStyle}>{ticket.source || "-"}</td>
                <td style={tdStyle}>{formatDate(ticket.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

const thStyle = {
  textAlign: "left" as const,
  padding: "12px 8px",
  fontWeight: 800,
  color: "#0f172a",
};

const tdStyle = {
  padding: "12px 8px",
  color: "#0f172a",
  verticalAlign: "top" as const,
};

const paginationBarStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap" as const,
  gap: "12px",
  marginBottom: "16px",
};

const paginationNavStyle = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap" as const,
  gap: "6px",
};

const pageLinkStyle = {
  padding: "8px 11px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  color: "#0f172a",
  background: "#ffffff",
  textDecoration: "none",
  fontWeight: 700,
};

const activePageStyle = {
  ...pageLinkStyle,
  color: "#ffffff",
  background: "#0f172a",
  borderColor: "#0f172a",
};

const disabledPageStyle = {
  ...pageLinkStyle,
  color: "#94a3b8",
  background: "#f1f5f9",
  pointerEvents: "none" as const,
};

const ellipsisStyle = {
  padding: "8px 3px",
  color: "#64748b",
};

const linkStyle = {
  color: "#1d4ed8",
  textDecoration: "none",
  fontWeight: 700,
};

const buttonStyle = {
  padding: "12px 16px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  textDecoration: "none",
  color: "#0f172a",
  fontWeight: 800,
  background: "#ffffff",
};


const newFilterButtonStyle = {
  ...buttonStyle,
  border: "1px solid #93c5fd",
  color: "#1d4ed8",
  background: "#dbeafe",
};

const inProgressFilterButtonStyle = {
  ...buttonStyle,
  border: "1px solid #fdba74",
  color: "#c2410c",
  background: "#ffedd5",
};

const closedFilterButtonStyle = {
  ...buttonStyle,
  border: "1px solid #86efac",
  color: "#166534",
  background: "#dcfce7",
};


const primaryButtonStyle = {
  padding: "12px 16px",
  borderRadius: "8px",
  border: "1px solid #020617",
  textDecoration: "none",
  color: "#ffffff",
  fontWeight: 800,
  background: "#020617",
};


const statusPillBase = {
  display: "inline-block",
  minWidth: "96px",
  textAlign: "center" as const,
  padding: "6px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 900,
};
