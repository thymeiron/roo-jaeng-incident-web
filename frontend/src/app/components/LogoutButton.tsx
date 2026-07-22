"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    try {
      setLoading(true);

      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.replace("/login");
      router.refresh();
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      style={{
        padding: "8px 13px",
        border: "1px solid #fecaca",
        borderRadius: "10px",
        background: "#ffffff",
        color: "#b91c1c",
        fontSize: "13px",
        fontWeight: 900,
        cursor: loading ? "wait" : "pointer",
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? "Signing out..." : "Logout"}
    </button>
  );
}
