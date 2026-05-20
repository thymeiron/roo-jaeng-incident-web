import Link from "next/link";

export const dynamic = "force-dynamic";

type Ticket = {
  id: number;
  title: string;
  detail?: string;
  severity?: string;
  status: string;
  host?: string;
  source?: string;
  assigned_to?: string;
  created_at?: string;
  updated_at?: string;
};

type PageProps = {
  searchParams?: Promise<{
    status?: string;
    assigned_to?: string;
    source?: string;
  }> | {
    status?: string;
    assigned_to?: string;
    source?: string;
  };
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

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}

export default async function TicketsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const selectedStatus = params?.status || "";
  const selectedAssignedTo = params?.assigned_to || "";
  const selectedSource = params?.source || "";

  const tickets = await getTickets();

  const filteredTickets = tickets.filter((ticket) => {
    if (selectedStatus && ticket.status !== selectedStatus) return false;

    if (selectedAssignedTo) {
      const assignee = ticket.assigned_to?.trim() || "Unassigned";
      if (assignee !== selectedAssignedTo) return false;
    }

    if (selectedSource) {
      const source = ticket.source || "";
      if (source !== selectedSource) return false;
    }

    return true;
  });

  const titleParts = ["Tickets"];
  if (selectedStatus) titleParts.push(selectedStatus);
  if (selectedAssignedTo) titleParts.push(`Assigned: ${selectedAssignedTo}`);
  if (selectedSource) titleParts.push(`Source: ${selectedSource}`);

  return (
    <main style={{ padding: "24px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
        <div>
          <Link href="/" style={{ color: "#111827", textDecoration: "none" }}>
            ← Back to Dashboard
          </Link>
          <h1 style={{ margin: "10px 0 4px", fontSize: "22px" }}>
            {titleParts.join(" - ")}
          </h1>
          <p style={{ margin: 0, color: "#475569" }}>
            Showing {filteredTickets.length} of {tickets.length} tickets
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Link href="/tickets" style={buttonStyle}>All</Link>
          <Link href="/tickets?status=New" style={buttonStyle}>New</Link>
          <Link href="/tickets?status=In%20Progress" style={buttonStyle}>In Progress</Link>
          <Link href="/tickets?status=Closed" style={buttonStyle}>Closed</Link>
          <Link href="/reports" style={buttonStyle}>Monthly Report</Link>
          <Link href="/tickets/new" style={darkButtonStyle}>+ Create Ticket</Link>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
        <thead>
          <tr>
            <th style={thStyle}>ID</th>
            <th style={thStyle}>Title</th>
            <th style={thStyle}>Host</th>
            <th style={thStyle}>Severity</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Assigned</th>
            <th style={thStyle}>Source</th>
            <th style={thStyle}>Created</th>
          </tr>
        </thead>
        <tbody>
          {filteredTickets.map((ticket) => (
            <tr key={ticket.id}>
              <td style={tdStyle}>
                <Link href={`/tickets/${ticket.id}`} style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
                  {ticket.id}
                </Link>
              </td>
              <td style={tdStyle}>
                <Link href={`/tickets/${ticket.id}`} style={{ color: "#111827", textDecoration: "none" }}>
                  {ticket.title}
                </Link>
              </td>
              <td style={tdStyle}>{ticket.host || "-"}</td>
              <td style={tdStyle}>{ticket.severity || "-"}</td>
              <td style={tdStyle}>{ticket.status}</td>
              <td style={tdStyle}>
                {ticket.assigned_to ? (
                  <Link
                    href={`/tickets${buildQuery({ assigned_to: ticket.assigned_to })}`}
                    style={{ color: "#2563eb", textDecoration: "none" }}
                  >
                    {ticket.assigned_to}
                  </Link>
                ) : (
                  <Link
                    href="/tickets?assigned_to=Unassigned"
                    style={{ color: "#2563eb", textDecoration: "none" }}
                  >
                    Unassigned
                  </Link>
                )}
              </td>
              <td style={tdStyle}>{ticket.source || "-"}</td>
              <td style={tdStyle}>{formatDateTime(ticket.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

const thStyle = {
  textAlign: "left" as const,
  padding: "12px 8px",
  borderBottom: "1px solid #ddd",
  fontWeight: 700,
};

const tdStyle = {
  padding: "10px 8px",
  borderBottom: "1px solid #eee",
  verticalAlign: "top" as const,
};

const buttonStyle = {
  padding: "10px 16px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  color: "#111827",
  textDecoration: "none",
  fontWeight: 700,
  background: "#fff",
};

const darkButtonStyle = {
  ...buttonStyle,
  background: "#0f172a",
  color: "#fff",
};
