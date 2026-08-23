import type { AdminAnalytics } from "./admin.types";
export function SalesChart({ rows }: { rows: AdminAnalytics["dailySales"] }) {
  if (rows.length === 0)
    return <p className="muted-copy">No daily sales in this period.</p>;
  const max = Math.max(...rows.map((row) => Number(row.netGross)), 1);
  return (
    <div className="sales-chart" role="img" aria-label="Daily net sales chart">
      {rows.map((row) => {
        const value = Number(row.netGross);
        return (
          <div
            className="sales-bar"
            key={`${row.day}-${row.currency}`}
            title={`${row.day}: ${row.netGross} ${row.currency}`}
          >
            <span style={{ height: `${Math.max(2, (value / max) * 100)}%` }} />
            <small>
              {new Date(`${row.day}T00:00:00Z`).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </small>
          </div>
        );
      })}
    </div>
  );
}
