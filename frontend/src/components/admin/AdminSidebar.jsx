import { NavLink } from "react-router-dom";

export default function AdminSidebar({ items = [] }) {
  return (
    <aside className="sticky top-0 h-screen w-64 border-r border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">MetroBus</p>
        <p className="mt-1 text-xl font-bold text-slate-900">Admin</p>
      </div>
      <nav className="space-y-1.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
