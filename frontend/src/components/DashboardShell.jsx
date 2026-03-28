import { NavLink } from "react-router-dom";

const ROLE_LINKS = {
  PASSENGER: [{ to: "/passenger", label: "Passenger" }],
  DRIVER: [{ to: "/driver", label: "Driver" }],
  HELPER: [{ to: "/helper", label: "Helper" }],
  ADMIN: [{ to: "/admin", label: "Admin" }],
};

function buildLinks(user) {
  if (!user) return [];
  if (user.is_superuser) {
    return [
      { to: "/passenger", label: "Passenger" },
      { to: "/driver", label: "Driver" },
      { to: "/helper", label: "Helper" },
      { to: "/admin", label: "Admin" },
    ];
  }
  return ROLE_LINKS[user.role] || [];
}

export default function DashboardShell({
  user,
  title,
  subtitle,
  actions,
  children,
}) {
  const links = buildLinks(user);

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-900">
      <div className="mx-auto flex max-w-[1500px] gap-6 px-4 py-6 lg:px-6">
        <aside className="hidden w-64 flex-shrink-0 lg:block">
          <div className="sticky top-6 space-y-4">
            <div className="border-b border-slate-200 px-1 pb-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">MetroBus</div>
              <div className="mt-2 text-2xl font-bold text-slate-950">{title}</div>
              <div className="mt-2 text-sm text-slate-500">{user?.full_name || "User"}</div>
            </div>

            <nav className="px-1">
              <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Navigation
              </div>
              <div className="mt-1 space-y-1">
                {links.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `block border-l-2 px-3 py-3 text-sm font-medium transition ${
                        isActive ? "border-slate-900 text-slate-950" : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">
          <header className="border-b border-slate-200 px-1 pb-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">MetroBus</div>
                <div className="mt-1 text-3xl font-bold text-slate-950">{title}</div>
                {subtitle ? <div className="mt-2 text-sm text-slate-500">{subtitle}</div> : null}
              </div>
              {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
            </div>

            {links.length > 1 ? (
              <div className="mt-4 flex flex-wrap gap-2 lg:hidden">
                {links.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `border-b-2 px-3 py-2 text-sm font-medium transition ${
                        isActive ? "border-slate-900 text-slate-950" : "border-transparent text-slate-600"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ) : null}
          </header>

          {children}
        </main>
      </div>
    </div>
  );
}
