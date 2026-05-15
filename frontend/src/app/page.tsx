async function getTickets() {
  const res = await fetch("http://incident-api:8000/api/tickets", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch tickets");
  }

  return res.json();
}

export default async function HomePage() {
  const tickets = await getTickets();

  const total = tickets.length;
  const newCount = tickets.filter((t: any) => t.status === "New").length;
  const inProgressCount = tickets.filter((t: any) => t.status === "In Progress").length;
  const closedCount = tickets.filter((t: any) => t.status === "Closed").length;

  return (
    <main style={{ padding: "32px", background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700", margin: 0 }}>
            Roo-Jaeng Incident Dashboard
          </h1>
          <p style={{ marginTop: "6px", color: "#334155" }}>
            Incident workflow from Slack to case management
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <a href="/tickets/new" style={primaryButtonStyle}>
            + Create Ticket
          </a>

          <a href="/tickets" style={secondaryButtonStyle}>
            View All Tickets
          </a>

          <a href="/reports" style={secondaryButtonStyle}>
            Monthly Report
          </a>
        </div>
      </div>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "16px",
          marginTop: "28px",
        }}
      >
        <a href="/tickets" style={cardLinkStyle}>
          <p style={labelStyle}>Total</p>
          <h2 style={numberStyle}>{total}</h2>
        </a>

        <a href="/tickets?status=New" style={cardLinkStyle}>
          <p style={labelStyle}>New</p>
          <h2 style={numberStyle}>{newCount}</h2>
        </a>

        <a href="/tickets?status=In%20Progress" style={cardLinkStyle}>
          <p style={labelStyle}>In Progress</p>
          <h2 style={numberStyle}>{inProgressCount}</h2>
        </a>

        <a href="/tickets?status=Closed" style={cardLinkStyle}>
          <p style={labelStyle}>Closed</p>
          <h2 style={numberStyle}>{closedCount}</h2>
        </a>
      </section>

      <section
        style={{
          background: "white",
          padding: "20px",
          borderRadius: "14px",
          marginTop: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Latest Tickets</h2>
          <a href="/tickets" style={{ textDecoration: "none", fontWeight: "600" }}>
            See all →
          </a>
        </div>

        <div style={{ marginTop: "18px", display: "grid", gap: "12px" }}>
          {tickets.slice(0, 10).map((ticket: any) => (
            <a
              key={ticket.id}
              href={`/tickets/${ticket.id}`}
              style={{
                display: "block",
                border: "1px solid #d1d5db",
                borderRadius: "10px",
                padding: "16px",
                textDecoration: "none",
                color: "inherit",
                background: "white",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                <div>
                  <h3 style={{ margin: 0 }}>
                    #{ticket.id} {ticket.title}
                  </h3>

                  <p style={{ margin: "8px 0", color: "#334155" }}>
                    Host: {ticket.host || "-"} | Assigned: {ticket.assigned_to || "-"}
                  </p>

                  <p style={{ margin: 0, color: "#0f172a" }}>
                    {ticket.detail}
                  </p>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "start" }}>
                  <span style={severityStyle}>{ticket.severity || "-"}</span>
                  <span style={statusStyle}>{ticket.status || "-"}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}

const cardLinkStyle = {
  background: "white",
  padding: "18px",
  borderRadius: "12px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  textDecoration: "none",
  color: "inherit",
};

const labelStyle = {
  margin: 0,
  color: "#475569",
  fontSize: "14px",
};

const numberStyle = {
  margin: "6px 0 0",
  fontSize: "24px",
};

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

const severityStyle = {
  background: "#fee2e2",
  color: "#b91c1c",
  padding: "6px 12px",
  borderRadius: "999px",
  whiteSpace: "nowrap" as const,
};

const statusStyle = {
  background: "#dbeafe",
  color: "#1d4ed8",
  padding: "6px 12px",
  borderRadius: "999px",
  whiteSpace: "nowrap" as const,
};
