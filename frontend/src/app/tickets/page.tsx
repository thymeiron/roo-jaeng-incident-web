async function getTickets() {
  const res = await fetch("http://incident-api:8000/api/tickets", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch tickets");
  }

  return res.json();
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; assigned_to?: string }>;
}) {
  const params = await searchParams;
  const tickets = await getTickets();

  const statusFilter = params.status || "";
  const assignedFilter = params.assigned_to || "";

  const filteredTickets = tickets.filter((ticket: any) => {
    const matchStatus = statusFilter ? ticket.status === statusFilter : true;
    const matchAssigned = assignedFilter ? ticket.assigned_to === assignedFilter : true;
    return matchStatus && matchAssigned;
  });

  const title = statusFilter
    ? `Tickets - ${statusFilter}`
    : assignedFilter
      ? `Tickets - ${assignedFilter}`
      : "Tickets";

  return (
    <main style={{ padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p>
            <a href="/">← Back to Dashboard</a>
          </p>
          <h1>{title}</h1>
          <p style={{ color: "#475569" }}>
            Showing {filteredTickets.length} of {tickets.length} tickets
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <a href="/tickets" style={secondaryButtonStyle}>All</a>
          <a href="/tickets?status=New" style={secondaryButtonStyle}>New</a>
          <a href="/tickets?status=In%20Progress" style={secondaryButtonStyle}>In Progress</a>
          <a href="/tickets?status=Closed" style={secondaryButtonStyle}>Closed</a>
          <a href="/reports" style={secondaryButtonStyle}>Monthly Report</a>
          <a href="/tickets/new" style={primaryButtonStyle}>+ Create Ticket</a>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "16px" }}>
        <thead>
          <tr>
            <th style={thStyle}>ID</th>
            <th style={thStyle}>Title</th>
            <th style={thStyle}>Host</th>
            <th style={thStyle}>Severity</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Assigned</th>
            <th style={thStyle}>Source</th>
          </tr>
        </thead>

        <tbody>
          {filteredTickets.map((ticket: any) => (
            <tr key={ticket.id}>
              <td style={tdStyle}>
                <a href={`/tickets/${ticket.id}`}>{ticket.id}</a>
              </td>
              <td style={tdStyle}>
                <a href={`/tickets/${ticket.id}`}>{ticket.title}</a>
              </td>
              <td style={tdStyle}>{ticket.host || "-"}</td>
              <td style={tdStyle}>{ticket.severity || "-"}</td>
              <td style={tdStyle}>{ticket.status || "-"}</td>
              <td style={tdStyle}>{ticket.assigned_to || "-"}</td>
              <td style={tdStyle}>{ticket.source || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

const primaryButtonStyle = {
  background: "#111827",
  color: "white",
  padding: "10px 16px",
  borderRadius: "10px",
  textDecoration: "none",
  fontWeight: "600",
};

const secondaryButtonStyle = {
  background: "white",
  color: "#111827",
  padding: "10px 16px",
  borderRadius: "10px",
  textDecoration: "none",
  fontWeight: "600",
  border: "1px solid #d1d5db",
};

const thStyle = {
  borderBottom: "1px solid #ddd",
  textAlign: "left" as const,
  padding: "8px",
};

const tdStyle = {
  borderBottom: "1px solid #eee",
  padding: "8px",
};
