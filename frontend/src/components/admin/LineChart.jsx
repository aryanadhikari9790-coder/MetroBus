export default function LineChart({ points = [] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">Revenue Trend (7 days)</p>
      <div className="mt-3 grid grid-cols-7 gap-2 text-center text-xs text-slate-600">
        {points.map((point, index) => (
          <div key={`${point.label}-${index}`} className="rounded-lg bg-slate-50 px-2 py-3">
            <p className="font-semibold text-slate-800">{point.value}</p>
            <p className="mt-1">{point.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
