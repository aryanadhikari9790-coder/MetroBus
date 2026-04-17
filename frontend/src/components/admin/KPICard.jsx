export default function KPICard({ label, value, subtitle }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}
