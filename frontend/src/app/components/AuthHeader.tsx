"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import LogoutButton from "./LogoutButton";

type UserData = {
  id: number;
  username: string;
  role: string;
};

export default function AuthHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    if (pathname === "/login") return;

    fetch("/api/auth/me", {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return null;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
      })
      .then((result) => {
        if (result) setUser(result);
      })
      .catch((error) => {
        console.error("Auth check failed:", error);
      });
  }, [pathname, router]);

  if (pathname === "/login") {
    return null;
  }

  return (
    <header style={styles.header}>
      <a href="/" style={styles.brand}>
        Roo-Jaeng
      </a>

      <div style={styles.right}>
        {user ? (
          <div style={styles.user}>
            <span style={styles.username}>{user.username}</span>
            <span style={styles.role}>{user.role}</span>
          </div>
        ) : (
          <span style={styles.loading}>Checking session...</span>
        )}

        <LogoutButton />
      </div>
    </header>
  );
}

const styles = {
  header: {
    minHeight: "58px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    padding: "0 24px",
    borderBottom: "1px solid #e2e8f0",
    background: "#ffffff",
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
  },
  brand: {
    color: "#0f172a",
    fontSize: "18px",
    fontWeight: 900,
    textDecoration: "none",
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  user: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
  },
  username: {
    color: "#0f172a",
    fontSize: "14px",
    fontWeight: 900,
  },
  role: {
    padding: "4px 8px",
    borderRadius: "999px",
    background: "#dbeafe",
    color: "#1d4ed8",
    fontSize: "11px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  loading: {
    color: "#64748b",
    fontSize: "13px",
  },
} as const;
