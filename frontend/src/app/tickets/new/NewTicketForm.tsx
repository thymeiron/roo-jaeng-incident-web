"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeAssignedTo } from "@/lib/assignees";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  "";

function normalizeBeforeSubmit(value: string) {
  const normalized = normalizeAssignedTo(value);
  if (normalized === "Unassigned") return null;
  return normalized;
}

export default function NewTicketForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [host, setHost] = useState("");
  const [severity, setSeverity] = useState("Medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [workHours, setWorkHours] = useState("0.5");
  const [workCount, setWorkCount] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (loading) return;

    setError("");
    setSuccess("");

    if (!title.trim()) {
      setError("Please input title");
      return;
    }

    setLoading(true);
    let createdOk = false;

    try {
      const res = await fetch(`${API_BASE}/api/tickets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          detail: detail.trim(),
          host: host.trim(),
          severity,
          status: "New",
          source: "manual",
          assigned_to: normalizeBeforeSubmit(assignedTo),
          work_hours: workHours === "" ? null : Number(workHours),
          work_count: workCount === "" ? 1 : Number(workCount),
        }),
      });

      if (!res.ok) {
        throw new Error("Create ticket failed");
      }

      createdOk = true;
      setSuccess("Created ticket successfully. Redirecting to ticket list...");

      setTimeout(() => {
        router.push("/tickets");
        router.refresh();
      }, 1200);
    } catch (err) {
      console.error(err);
      setError("Create ticket failed");
    } finally {
      // If created successfully, keep button disabled until redirect to prevent duplicate create.
      if (!createdOk) {
        setLoading(false);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      {error && <div style={errorStyle}>{error}</div>}

      <label style={labelStyle}>Title</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="เช่น ตรวจสอบ Backup Job / Support User / Change Firewall"
        style={inputStyle}
      />

      <label style={labelStyle}>Detail</label>
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="รายละเอียดงานที่ทำ / สิ่งที่ตรวจสอบ / ผลลัพธ์"
        rows={8}
        style={textareaStyle}
      />

      <label style={labelStyle}>Host / System</label>
      <input
        value={host}
        onChange={(e) => setHost(e.target.value)}
        placeholder="เช่น HSVECP02 / Commvault / Zabbix / Network"
        style={inputStyle}
      />

      <label style={labelStyle}>Severity</label>
      <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={inputStyle}>
        <option value="Low">Low</option>
        <option value="Medium">Medium</option>
        <option value="High">High</option>
        <option value="Major">Major</option>
        <option value="Critical">Critical</option>
      </select>

      <div className="rj-light-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <div>
          <label style={labelStyle}>จำนวน ชม ต่อวัน</label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={workHours}
            onChange={(e) => setWorkHours(e.target.value)}
            placeholder="เช่น 0.5 / 1 / 2 / 8"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>จำนวนงานต่อวัน</label>
          <input
            type="number"
            step="1"
            min="1"
            value={workCount}
            onChange={(e) => setWorkCount(e.target.value)}
            placeholder="เช่น 1"
            style={inputStyle}
          />
        </div>
      </div>

      <label style={labelStyle}>Assigned To</label>
      <input
        list="assignee-options"
        value={assignedTo}
        onChange={(e) => setAssignedTo(e.target.value)}
        placeholder="พิมพ์หรือเลือก: Thyme / Tun / Champ"
        style={inputStyle}
      />

      <datalist id="assignee-options">
        <option value="Thyme" />
        <option value="Tun" />
        <option value="Champ" />
        <option value="thyme" />
        <option value="tun" />
        <option value="champ" />
      </datalist>

      <div className="rj-light-actions" style={{ marginTop: "18px", display: "flex", gap: "10px" }}>
        <button type="submit" disabled={loading} style={primaryButtonStyle}>
          {loading ? "Creating..." : "Create Ticket"}
        </button>

        <a href="/tickets" style={secondaryButtonStyle}>
          Cancel
        </a>
      </div>
    </form>
  );
}

const formStyle = {
  marginTop: "24px",
  maxWidth: "860px",
  padding: "24px",
  border: "1px solid #dbe4ef",
  borderRadius: "12px",
  background: "#ffffff",
};

const successStyle = {
  padding: "14px",
  borderRadius: "14px",
  background: "#dcfce7",
  color: "#166534",
  border: "1px solid #bbf7d0",
  fontWeight: 900,
  marginBottom: "16px",
};

const errorStyle = {
  marginBottom: "16px",
  padding: "12px",
  borderRadius: "8px",
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: 700,
};

const labelStyle = {
  display: "block",
  marginTop: "14px",
  marginBottom: "8px",
  fontWeight: 800,
  color: "#0f172a",
};

const inputStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "14px",
};

const textareaStyle = {
  ...inputStyle,
  resize: "vertical" as const,
};

const primaryButtonStyle = {
  padding: "12px 18px",
  borderRadius: "8px",
  border: "1px solid #020617",
  background: "#020617",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  padding: "12px 18px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 800,
  textDecoration: "none",
};
