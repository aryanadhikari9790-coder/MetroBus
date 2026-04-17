export default function BarChart({ items = [] }) {
  const max = Math.max(...items.map((item) => Number(item.value || 0)), 1);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">Route-wise Occupancy</p>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
              <span>{item.label}</span>
              <span>{item.value}%</span>
            </div>
            <div
              role="progressbar"
              aria-label={`${item.label} occupancy`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.max(0, Math.min(100, Number(item.value || 0)))}
              className="h-2 rounded-full bg-slate-100"
            >
              <div className="h-2 rounded-full bg-slate-900" style={{ width: `${Math.max(5, Math.round((Number(item.value || 0) / max) * 100))}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
