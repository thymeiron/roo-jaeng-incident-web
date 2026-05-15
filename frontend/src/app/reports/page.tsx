const TEAM_MEMBERS = [
  "Thyme",
  "Champ",
  "Tun",
  "Nut",
  "Sam",
];

async function getTickets() {
  const res = await fetch("http://incident-api:8000/api/tickets", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch tickets");
  }

  return res.json();
}

function isCurrentMonth(dateText: string) {
  if (!dateText) return false;

  const d = new Date(dateText);
  const now = new Date();

  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default async function ReportsPage() {
  const tickets = await getTickets();
  const monthlyTickets = tickets.filter((t: any) => isCurrentMonth(t.created_at));

  const summary = TEAM_MEMBERS.map((name) => {
    const myTickets = monthlyTickets.filter((t: any) => t.assigned_to === name);

    return {
      name,
      total: myTickets.length,
      newCount: myTickets.filter((t: any) => t.status === "New").length,
      inProgressCount: myTickets.filter((t: any) => t.status === "In Progress").length,
      closedCount: myTickets.filter((t: any) => t.status === "Closed").length,
      tickets: myTickets,
    };
  });

  const unassignedTickets = monthlyTickets.filter((t: any) => !t.assigned_to);

  return (
    <main style={{ padding: "24px", background: "#f3f4f6", minHeight: "100vh" }}>
      <p>
        <a href="/">← Back to Dashboard</a>
      </p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1>Monthly Work Report</h1>
          <p style={{ color: "#475569" }}>
            สรุปงานรายเดือน แยกตามคน จาก Assigned To
          </p>
        </div>

        <a href="/tickets/new" style={primaryButtonStyle}>
          + Create Ticket
        </a>
      </div>

      <section style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: "12px",
        marginTop: "20px",
      }}>
        {summary.map((item) => (
          <a
            key={item.name}
            href={`#${item.name}`}
            style={{
              background: "white",
              padding: "16px",
              borderRadius: "12px",
              textDecoration: "none",
              color: "inherit",
              border: "1px solid #e5e7eb",
            }}
          >
            <h2 style={{ margin: 0 }}>{item.name}</h2>
            <p style={{ margin: "8px 0 0", color: "#475569" }}>Total</p>
            <h1 style={{ margin: 0 }}>{item.total}</h1>
            <p style={{ margin: "8px 0 0", fontSize: "13px" }}>
              New: {item.newCount} | Doing: {item.inProgressCount} | Closed: {item.closedCount}
            </p>
          </a>
        ))}
      </section>

      {summary.map((item) => (
        <section
          key={item.name}
          id={item.name}
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "20px",
            marginTop: "20px",
          }}
        >
          <h2>{item.name}</h2>

          {item.tickets.length === 0 ? (
            <p style={{ color: "#64748b" }}>No tickets this month</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Host/System</th>
                  <th style={thStyle}>Severity</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Created</th>
                </tr>
              </thead>
              <tbody>
                {item.tickets.map((ticket: any) => (
                  <tr key={ticket.id}>
                    <td style={tdStyle}>
                      <a href={`/tickets/${ticket.id}`}>#{ticket.id}</a>
                    </td>
                    <td style={tdStyle}>
                      <a href={`/tickets/${ticket.id}`}>{ticket.title}</a>
                    </td>
                    <td style={tdStyle}>{ticket.host || "-"}</td>
                    <td style={tdStyle}>{ticket.severity || "-"}</td>
                    <td style={tdStyle}>{ticket.status || "-"}</td>
                    <td style={tdStyle}>{ticket.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}

      <section style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "20px",
        marginTop: "20px",
      }}>
        <h2>Unassigned</h2>

        {unassignedTickets.length === 0 ? (
          <p style={{ color: "#64748b" }}>No unassigned tickets this month</p>
        ) : (
          <ul>
            {unassignedTickets.map((ticket: any) => (
              <li key={ticket.id}>
                <a href={`/tickets/${ticket.id}`}>#{ticket.id} {ticket.title}</a>
              </li>
            ))}
          </ul>
        )}
      </section>
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

const thStyle = {
  borderBottom: "1px solid #ddd",
  textAlign: "left" as const,
  padding: "8px",
};

const tdStyle = {
  borderBottom: "1px solid #eee",
  padding: "8px",
};
