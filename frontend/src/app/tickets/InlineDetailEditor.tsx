"use client";

import { useState } from "react";

type Props = {
  ticketId: number;
  initialDetail?: string | null;
  status?: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

function accentByStatus(status?: string | null) {
  const s = (status || "").toLowerCase();

  if (s === "closed") {
    return {
      solid: "#16a34a",
      soft: "#dcfce7",
      border: "#86efac",
      text: "#166534",
    };
  }

  if (s === "in progress") {
    return {
      solid: "#ea580c",
      soft: "#ffedd5",
      border: "#fdba74",
      text: "#c2410c",
    };
  }

  return {
    solid: "#2563eb",
    soft: "#dbeafe",
    border: "#93c5fd",
    text: "#1d4ed8",
  };
}

export default function InlineDetailEditor({ ticketId, initialDetail, status }: Props) {
  const [detail, setDetail] = useState(initialDetail || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const accent = accentByStatus(status);

  async function saveDetail() {
    try {
      setSaving(true);
      setMessage("");

      const cleanDetail = detail.trim();

      const res = await fetch(`${API_BASE}/api/tickets/${ticketId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          detail: cleanDetail,
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const timelineText = `Detail updated from ticket list | ${cleanDetail || "No detail"}`;

      const commentRes = await fetch(`${API_BASE}/api/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: timelineText,
          created_by: "IDS Support",
          body: timelineText,
          author: "IDS Support",
        }),
      });

      if (!commentRes.ok) {
        throw new Error(await commentRes.text());
      }

      setMessage("Saved");
    } catch (err) {
      console.error(err);
      setMessage("Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: "6px",
        alignItems: "start",
        width: "100%",
      }}
    >
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="Description / Detail"
        style={{
          width: "100%",
          minHeight: "42px",
          height: "42px",
          maxHeight: "90px",
          padding: "7px 9px",
          borderRadius: "8px",
          border: `1px solid ${accent.border}`,
          fontSize: "12px",
          lineHeight: 1.35,
          color: "#0f172a",
          background: "#ffffff",
          resize: "vertical",
          boxSizing: "border-box",
        }}
      />

      <button
        type="button"
        onClick={saveDetail}
        disabled={saving}
        style={{
          border: "none",
          borderRadius: "8px",
          padding: "7px 10px",
          background: saving ? "#94a3b8" : accent.solid,
          color: "#ffffff",
          fontWeight: 800,
          fontSize: "12px",
          cursor: saving ? "not-allowed" : "pointer",
          minWidth: "52px",
          height: "32px",
        }}
      >
        {saving ? "..." : "Save"}
      </button>

      {message && (
        <span
          style={{
            gridColumn: "1 / 3",
            fontSize: "11px",
            fontWeight: 800,
            color: message === "Saved" ? accent.text : "#b91c1c",
          }}
        >
          {message}
        </span>
      )}
    </div>
  );
}
