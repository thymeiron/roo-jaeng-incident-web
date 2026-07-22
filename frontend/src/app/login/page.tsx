"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorText, setErrorText] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setLoading(true);
      setErrorText("");

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          username,
          password,
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);

        throw new Error(
          result?.detail || "Username or password is incorrect",
        );
      }

      router.replace("/");
      router.refresh();
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : "Unable to login",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.logo}>RJ</div>

        <h1 style={styles.title}>Roo-Jaeng Login</h1>

        <p style={styles.subtitle}>
          Sign in to access the incident dashboard
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Username

            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
              autoFocus
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            Password

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              style={styles.input}
            />
          </label>

          {errorText ? (
            <div style={styles.error}>
              {errorText}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading ? 0.65 : 1,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "24px",
    boxSizing: "border-box" as const,
    background:
      "linear-gradient(135deg, #eff6ff 0%, #f8fafc 50%, #fff7ed 100%)",
  },

  card: {
    width: "100%",
    maxWidth: "420px",
    padding: "32px",
    boxSizing: "border-box" as const,
    border: "1px solid #dbe4ef",
    borderRadius: "20px",
    background: "#ffffff",
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.12)",
  },

  logo: {
    width: "58px",
    height: "58px",
    display: "grid",
    placeItems: "center",
    margin: "0 auto 18px",
    borderRadius: "18px",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: "20px",
    fontWeight: 900,
  },

  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: "26px",
    fontWeight: 900,
    textAlign: "center" as const,
  },

  subtitle: {
    margin: "8px 0 24px",
    color: "#64748b",
    fontSize: "14px",
    textAlign: "center" as const,
  },

  form: {
    display: "grid",
    gap: "16px",
  },

  label: {
    display: "grid",
    gap: "7px",
    color: "#334155",
    fontSize: "14px",
    fontWeight: 800,
  },

  input: {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "12px 13px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    outline: "none",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: "15px",
  },

  error: {
    padding: "10px 12px",
    border: "1px solid #fecaca",
    borderRadius: "10px",
    background: "#fef2f2",
    color: "#b91c1c",
    fontSize: "13px",
    fontWeight: 700,
  },

  button: {
    width: "100%",
    padding: "12px 16px",
    border: 0,
    borderRadius: "10px",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 900,
  },
} as const;
