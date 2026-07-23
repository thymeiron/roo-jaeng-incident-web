type MonthItem = {
  month_key: string;
  total: number;
  zabbix: number;
  manual: number;
};

const series = [
  { key: "total", label: "Total", color: "#2563eb" },
  { key: "zabbix", label: "Zabbix", color: "#f97316" },
  { key: "manual", label: "Manual", color: "#16a34a" },
] as const;

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export default function ZabbixMonthlyTrend({ data }: { data: MonthItem[] }) {
  const maxCount = Math.max(...data.map((item) => item.total), 1);

  return (
    <section className="trend-panel" style={styles.panel}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Monthly Trend</h2>
          <p style={styles.subtitle}>Tickets created during the last 6 months</p>
        </div>
        <div className="trend-legend" style={styles.legend}>
          {series.map((item) => (
            <span key={item.key} style={styles.legendItem}>
              <i style={{ ...styles.legendDot, background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div style={styles.message}>No ticket trend data available.</div>
      ) : (
        <div className="trend-chart" style={styles.chart}>
          {data.map((item) => (
            <div key={item.month_key} style={styles.column}>
              <div style={styles.values}>
                {series.map((entry) => (
                  <span key={entry.key} style={{ color: entry.color }}>
                    {item[entry.key].toLocaleString()}
                  </span>
                ))}
              </div>
              <div style={styles.barArea}>
                {series.map((entry) => {
                  const value = item[entry.key];
                  const height = value ? Math.max((value / maxCount) * 100, 4) : 2;
                  return (
                    <div
                      key={entry.key}
                      title={`${entry.label} ${monthLabel(item.month_key)}: ${value}`}
                      style={{
                        ...styles.bar,
                        height: `${height}%`,
                        background: entry.color,
                        opacity: value ? 1 : 0.25,
                      }}
                    />
                  );
                })}
              </div>
              <div style={styles.month}>{monthLabel(item.month_key)}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const styles = {
  panel: {
    width: "100%",
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
  title: { margin: 0, fontSize: "18px", fontWeight: 900, color: "#0f172a" },
  subtitle: { margin: "5px 0 0", color: "#64748b", fontSize: "14px" },
  legend: { display: "flex", gap: "12px", flexWrap: "wrap" as const },
  legendItem: { display: "flex", alignItems: "center", gap: "5px", color: "#475569", fontSize: "12px", fontWeight: 800 },
  legendDot: { width: "9px", height: "9px", borderRadius: "999px" },
  chart: {
    height: "260px",
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: "12px",
    marginTop: "24px",
    borderBottom: "1px solid #cbd5e1",
  },
  column: { display: "grid", gridTemplateRows: "28px 1fr 34px", minWidth: 0 },
  values: { display: "flex", justifyContent: "center", gap: "6px", fontSize: "11px", fontWeight: 900 },
  barArea: { display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "4px" },
  bar: { width: "22%", maxWidth: "30px", minHeight: "2px", borderRadius: "7px 7px 2px 2px" },
  month: { paddingTop: "8px", textAlign: "center" as const, color: "#64748b", fontSize: "12px", fontWeight: 800 },
  message: { padding: "70px 20px", textAlign: "center" as const, color: "#64748b" },
} as const;
