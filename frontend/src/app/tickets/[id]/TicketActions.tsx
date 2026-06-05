"use client";

import { useState } from "react";

type Ticket = {
  id: number;
  detail?: string | null;
  status?: string | null;
  assigned_to?: string | null;
  work_hours?: number | null;
  work_count?: number | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export default function TicketActions({ ticket }: { ticket: Ticket }) {
  const [assignedTo, setAssignedTo] = useState(ticket.assigned_to || "Thyme");
  const [hours, setHours] = useState("");
  const [workNote, setWorkNote] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  const currentHours = Number(ticket.work_hours || 0);
  const currentCount = Number(ticket.work_count || 0);

  async function updateTicket(payload: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/api/tickets/${ticket.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    return res.json();
  }

  async function addComment(text: string) {
    const res = await fetch(`${API_BASE}/api/tickets/${ticket.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comment: text,
        created_by: assignedTo || "IDS Support",
        body: text,
        author: assignedTo || "IDS Support",
      }),
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    return res.json();
  }

  async function changeStatus(nextStatus: string) {
    try {
      setMessage("");
      await updateTicket({ status: nextStatus });
      await addComment(`Status changed to ${nextStatus}`);
      window.location.href = `/tickets/${ticket.id}?tab=timeline`;
    } catch (err) {
      console.error(err);
      setMessage("Update status failed");
    }
  }

  async function saveAssignedTo() {
    try {
      setMessage("");
      await updateTicket({ assigned_to: assignedTo });
      await addComment(`Assigned to ${assignedTo || "Unassigned"}`);
      window.location.href = `/tickets/${ticket.id}?tab=timeline`;
    } catch (err) {
      console.error(err);
      setMessage("Update assigned failed");
    }
  }

  async function addWorkLog() {
    try {
      setMessage("");

      const h = Number(hours);
      if (!Number.isFinite(h) || h <= 0) {
        setMessage("Please input valid work hours");
        return;
      }

      const nextHours = currentHours + h;
      const nextCount = currentCount + 1;
      const workDetail = workNote.trim() || "-";

      await updateTicket({
        work_hours: nextHours,
        work_count: nextCount,
      });

      await addComment(`Work Log | ${h} hour(s) | ${workDetail}`);

      setHours("");
      setWorkNote("");
      window.location.href = `/tickets/${ticket.id}?tab=timeline`;
    } catch (err) {
      console.error(err);
      setMessage("Add work log failed");
    }
  }

  async function addNote() {
    try {
      setMessage("");

      const text = note.trim();
      if (!text) {
        setMessage("Please input note");
        return;
      }

      await addComment(text);

      setNote("");
      window.location.href = `/tickets/${ticket.id}?tab=timeline`;
    } catch (err) {
      console.error(err);
      setMessage("Add note failed");
    }
  }

  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {message && (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: "12px",
            background: "#ecfeff",
            border: "1px solid #67e8f9",
            color: "#155e75",
            fontWeight: 900,
          }}
        >
          {message}
        </div>
      )}

      <section className="rj-light-panel" style={{ padding: "22px" }}>
        <h2 style={sectionTitleStyle}>Action Buttons</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
          <button type="button" onClick={() => changeStatus("New")} style={{ ...actionButtonStyle, background: "#2563eb" }}>
            New
          </button>
          <button type="button" onClick={() => changeStatus("In Progress")} style={{ ...actionButtonStyle, background: "#ea580c" }}>
            In Progress
          </button>
          <button type="button" onClick={() => changeStatus("Closed")} style={{ ...actionButtonStyle, background: "#16a34a" }}>
            Closed
          </button>
        </div>
      </section>

      <section className="rj-light-panel" style={{ padding: "22px" }}>
        <h2 style={sectionTitleStyle}>Assign To</h2>
        <div style={{ display: "flex", gap: "10px" }}>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            style={inputStyle}
          >
            <option value="Thyme">Thyme</option>
            <option value="Tun">Tun</option>
            <option value="Champ">Champ</option>
            <option value="">Unassigned</option>
          </select>
          <button type="button" onClick={saveAssignedTo} style={darkButtonStyle}>
            Save
          </button>
        </div>
      </section>

      <section className="rj-light-panel" style={{ padding: "22px" }}>
        <h2 style={sectionTitleStyle}>Work Log</h2>

        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px", gap: "10px" }}>
          <input
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="Hours"
            type="number"
            step="0.25"
            min="0"
            style={inputStyle}
          />
          <input
            value={workNote}
            onChange={(e) => setWorkNote(e.target.value)}
            placeholder="เช่น ตรวจสอบ iowait / log / network path"
            style={inputStyle}
          />
          <button type="button" onClick={addWorkLog} style={{ ...actionButtonStyle, background: "#2563eb" }}>
            Add
          </button>
        </div>

        <div
          style={{
            marginTop: "14px",
            padding: "14px",
            borderRadius: "12px",
            background: "#dcfce7",
            border: "1px solid #86efac",
            color: "#166534",
            fontWeight: 900,
            textAlign: "center",
          }}
        >
          Current summary: {ticket.work_hours ?? 0} hour(s) / {ticket.work_count ?? 0} count
        </div>
      </section>

      <section className="rj-light-panel" style={{ padding: "22px" }}>
        <h2 style={sectionTitleStyle}>Notes & Attachments</h2>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Update note / action taken / result"
          style={{
            ...inputStyle,
            minHeight: "120px",
            resize: "vertical",
            width: "100%",
          }}
        />

        <button
          type="button"
          onClick={addNote}
          style={{
            ...actionButtonStyle,
            background: "#2563eb",
            width: "100%",
            marginTop: "10px",
          }}
        >
          Add Note
        </button>
      </section>
    </aside>
  );
}

const sectionTitleStyle = {
  margin: "0 0 14px",
  fontSize: "18px",
  fontWeight: 900,
  color: "#020617",
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #cbd5e1",
  fontSize: "14px",
  background: "#ffffff",
  color: "#020617",
};

const actionButtonStyle = {
  border: "none",
  borderRadius: "12px",
  padding: "12px 16px",
  color: "#ffffff",
  fontWeight: 900,
  fontSize: "15px",
  cursor: "pointer",
};

const darkButtonStyle = {
  border: "none",
  borderRadius: "12px",
  padding: "12px 18px",
  color: "#ffffff",
  background: "#0f172a",
  fontWeight: 900,
  fontSize: "15px",
  cursor: "pointer",
};
