import NewTicketForm from "./NewTicketForm";

export default function NewTicketPage() {
  return (
    <main className="rj-light-page" style={{ padding: "24px" }}>
      <p>
        <a href="/tickets">← Back to Tickets</a>
      </p>

      <h1>Create Ticket</h1>
      <p style={{ color: "#475569" }}>
        ใช้สำหรับบันทึกงาน manual เช่น support, change, troubleshooting, backup, network, Zabbix หรือ incident อื่น ๆ
      </p>

      <div className="rj-light-panel" style={{
        background: "white",
        border: "1px solid #dbe4ef",
        borderRadius: "12px",
        padding: "20px",
        marginTop: "20px",
      }}>
        <NewTicketForm />
      </div>
    </main>
  );
}
