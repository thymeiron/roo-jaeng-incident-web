"use client";

import { useEffect, useMemo, useState } from "react";

type MonthItem = {
  month: number;
  month_key: string;
  count: number;
};

type TrendData = {
  year: number;
  total: number;
  highest_month: number;
  highest_count: number;
  months: MonthItem[];
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const FULL_MONTHS = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

export default function ZabbixMonthlyTrend() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);

        const response = await fetch(
          `/api/dashboard/zabbix-monthly-trend?year=${year}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result: TrendData = await response.json();

        if (!cancelled) {
          setData(result);
        }
      } catch (error) {
        console.error(error);

        if (!cancelled) {
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [year]);

  const maxCount = useMemo(() => {
    if (!data) return 1;
    return Math.max(...data.months.map((item) => item.count), 1);
  }, [data]);

  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>
            Zabbix Alert Monthly Trend — {year}
          </h2>
          <p style={styles.subtitle}>
            Monthly Zabbix alert comparison
          </p>
        </div>

        <select
          value={year}
          onChange={(event) => setYear(Number(event.target.value))}
          style={styles.select}
        >
          {[0, 1, 2, 3, 4].map((offset) => {
            const optionYear = currentYear - offset;

            return (
              <option key={optionYear} value={optionYear}>
                {optionYear}
              </option>
            );
          })}
        </select>
      </div>

      {loading ? (
        <div style={styles.message}>Loading...</div>
      ) : !data ? (
        <div style={styles.error}>
          Unable to load monthly alert data
        </div>
      ) : (
        <>
          <div style={styles.summary}>
            <div style={styles.summaryBox}>
              <span style={styles.label}>Total alerts</span>
              <strong style={styles.value}>
                {data.total.toLocaleString()}
              </strong>
            </div>

            <div style={styles.summaryBox}>
              <span style={styles.label}>Highest month</span>
              <strong style={styles.value}>
                {FULL_MONTHS[data.highest_month - 1]} {year}
              </strong>
            </div>

            <div style={styles.summaryBox}>
              <span style={styles.label}>Highest count</span>
              <strong style={styles.value}>
                {data.highest_count.toLocaleString()}
              </strong>
            </div>
          </div>

          <div style={styles.scroll}>
            <div style={styles.chart}>
              {data.months.map((item) => {
                const highest =
                  item.month === data.highest_month &&
                  item.count > 0;

                const height =
                  item.count === 0
                    ? 3
                    : Math.max(
                        Math.round((item.count / maxCount) * 100),
                        8,
                      );

                return (
                  <div key={item.month_key} style={styles.column}>
                    <div style={styles.count}>
                      {item.count.toLocaleString()}
                    </div>

                    <div style={styles.barArea}>
                      <div
                        title={`${MONTHS[item.month - 1]} ${year}: ${item.count} alerts`}
                        style={{
                          ...styles.bar,
                          height: `${height}%`,
                          background: highest
                            ? "#dc2626"
                            : "#f97316",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        ...styles.month,
                        color: highest ? "#dc2626" : "#64748b",
                      }}
                    >
                      {MONTHS[item.month - 1]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

const styles = {
  panel: {
    width: "100%",
    boxSizing: "border-box" as const,
    margin: "18px 0",
    padding: "18px",
    background: "#ffffff",
    border: "1px solid #dbe4ef",
    borderRadius: "16px",
    boxShadow: "0 14px 36px rgba(15,23,42,0.08)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  title: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 900,
    color: "#0f172a",
  },
  subtitle: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: "14px",
  },
  select: {
    padding: "8px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "9px",
    background: "#ffffff",
    fontWeight: 800,
  },
  summary: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: "10px",
    marginTop: "18px",
  },
  summaryBox: {
    padding: "12px 14px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
  },
  label: {
    display: "block",
    color: "#64748b",
    fontSize: "12px",
  },
  value: {
    display: "block",
    marginTop: "5px",
    color: "#0f172a",
    fontSize: "19px",
  },
  scroll: {
    overflowX: "auto" as const,
    marginTop: "22px",
  },
  chart: {
    minWidth: "760px",
    height: "280px",
    display: "grid",
    gridTemplateColumns: "repeat(12,1fr)",
    gap: "12px",
    borderBottom: "1px solid #cbd5e1",
  },
  column: {
    display: "grid",
    gridTemplateRows: "25px 1fr 30px",
    textAlign: "center" as const,
  },
  count: {
    color: "#475569",
    fontSize: "12px",
    fontWeight: 800,
  },
  barArea: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  bar: {
    width: "65%",
    maxWidth: "44px",
    minHeight: "3px",
    borderRadius: "8px 8px 2px 2px",
  },
  month: {
    paddingTop: "8px",
    fontSize: "12px",
    fontWeight: 800,
  },
  message: {
    padding: "80px 20px",
    textAlign: "center" as const,
    color: "#64748b",
  },
  error: {
    padding: "80px 20px",
    textAlign: "center" as const,
    color: "#dc2626",
  },
} as const;
