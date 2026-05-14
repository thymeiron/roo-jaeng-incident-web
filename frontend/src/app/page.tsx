type Ticket = {
  id: number;
  title: string;
  detail: string;
  severity: string;
  status: string;
  host: string;
  source: string;
  assigned_to: string;
  created_at: string;
};

async function getTickets(): Promise<Ticket[]> {
  const res = await fetch("https://roo-jaeng.com/api/tickets", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch tickets");
  }

  return res.json();
}

export default async function DashboardPage() {
  const tickets = await getTickets();

  const total = tickets.length;
  const newCount = tickets.filter((t) => t.status === "New").length;
  const inProgressCount = tickets.filter((t) => t.status === "In Progress").length;
  const closedCount = tickets.filter((t) => t.status === "Closed").length;

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Roo-Jaeng Incident Dashboard</h1>
          <p className="text-gray-600">Incident workflow from Slack to case management</p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card title="Total" value={total} />
          <Card title="New" value={newCount} />
          <Card title="In Progress" value={inProgressCount} />
          <Card title="Closed" value={closedCount} />
        </div>

        <div className="rounded-xl bg-white p-4 shadow">
          <h2 className="mb-4 text-lg font-semibold">Latest Tickets</h2>

          <div className="space-y-3">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="rounded-lg border p-4 hover:bg-gray-50"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-semibold">
                      #{ticket.id} {ticket.title}
                    </div>
                    <div className="text-sm text-gray-600">
                      Host: {ticket.host || "-"} | Assigned: {ticket.assigned_to || "-"}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <span className="rounded-full bg-red-100 px-3 py-1 text-sm text-red-700">
                      {ticket.severity}
                    </span>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
                      {ticket.status}
                    </span>
                  </div>
                </div>

                <p className="mt-2 text-sm text-gray-700">{ticket.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
