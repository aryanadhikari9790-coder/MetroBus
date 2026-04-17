export default function AdminHeader({ title = "MetroBus Admin" }) {
  return (
    <header className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Dashboard</p>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <input className="w-72 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400" placeholder="Search drivers, buses, routes" />
        <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">+ Quick Add</button>
      </div>
    </header>
  );
}
