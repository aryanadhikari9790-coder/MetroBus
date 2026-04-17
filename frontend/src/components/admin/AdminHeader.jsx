export default function AdminHeader({ title = "MetroBus Admin", onSearchChange, onQuickAdd }) {
  return (
    <header className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Dashboard</p>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <input aria-label="Search drivers, buses, and routes" onChange={(event) => onSearchChange?.(event.target.value)} className="w-72 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-500/40" placeholder="Search drivers, buses, routes" />
        <button aria-label="Quick add" type="button" onClick={() => onQuickAdd?.()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">+ Quick Add</button>
      </div>
    </header>
  );
}
