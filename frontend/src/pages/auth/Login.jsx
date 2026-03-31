import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { setToken } from "../../auth";
import { useAuth } from "../../AuthContext";
import { useTheme } from "../../ThemeContext";
import { themeTokens } from "../../lib/theme";

const roleToHome = {
  PASSENGER: "/passenger",
  DRIVER: "/driver",
  HELPER: "/helper",
  ADMIN: "/admin",
};

export default function Login() {
  const nav = useNavigate();
  const { refreshMe } = useAuth();
  const { isDark } = useTheme();
  const t = themeTokens(isDark);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const onLogin = async () => {
    setErr("");
    try {
      const res = await api.post("/api/auth/login/", { phone, password });
      setToken(res.data.access);
      const me = await refreshMe();
      const destination = roleToHome[me?.role] || "/passenger";
      nav(destination, { replace: true });
    } catch {
      setErr("Login failed. Check your phone number and password.");
    }
  };

  return (
    <div className={`min-h-screen ${t.page}`}>
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(2,132,199,0.14),transparent_28%)]" />

        <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-5 py-10 lg:px-8">
          <div className="grid w-full gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <section className={`rounded-[32px] border p-6 lg:p-8 ${t.card}`}>
              <p className={`text-xs font-bold uppercase tracking-[0.35em] ${t.label}`}>MetroBus Pokhara</p>
              <h1 className={`mt-4 text-3xl font-black ${t.text}`}>One login page, role-based access after sign-in.</h1>
              <p className={`mt-4 text-sm leading-6 ${t.textSub}`}>
                Passengers can self-register. Drivers, helpers, and admins receive their accounts directly from the admin panel and log in here with their phone number and password.
              </p>

              <div className={`mt-6 rounded-[28px] border p-5 ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/80"}`}>
                <p className={`text-sm font-semibold ${t.text}`}>Role access</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "Passenger", desc: "Can create a personal account from the public registration page." },
                    { label: "Driver", desc: "Created by admin. Starts trips and publishes live location." },
                    { label: "Helper", desc: "Created by admin. Handles offline boarding and cash verification." },
                    { label: "Admin", desc: "Created by admin or superuser. Manages routes, buses, schedules, and staff." },
                  ].map((item) => (
                    <div key={item.label} className={`rounded-2xl border p-4 ${isDark ? "border-white/10 bg-[#111827]" : "border-slate-200 bg-slate-50"}`}>
                      <p className={`text-sm font-semibold ${t.text}`}>{item.label}</p>
                      <p className={`mt-1 text-sm ${t.textSub}`}>{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className={`rounded-[32px] border p-6 lg:p-8 ${t.card}`}>
              <p className={`text-xs font-bold uppercase tracking-[0.35em] ${t.label}`}>Sign In</p>
              <h2 className={`mt-3 text-2xl font-black ${t.text}`}>Access your MetroBus workspace</h2>
              <p className={`mt-2 text-sm ${t.textSub}`}>Use your Nepal phone number and password.</p>

              {err ? <div className={`mt-5 rounded-3xl border px-4 py-3 text-sm ${t.errBanner}`}>{err}</div> : null}

              <div className="mt-6 space-y-3">
                <input
                  className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${t.input}`}
                  placeholder="Phone number (+977 98XXXXXXXX)"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
                <input
                  className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${t.input}`}
                  placeholder="Password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  className={`w-full rounded-[24px] px-4 py-4 text-sm font-bold transition ${isDark ? "bg-sky-400 text-slate-950 hover:bg-sky-300" : "bg-slate-900 text-white hover:bg-slate-800"}`}
                  onClick={onLogin}
                >
                  Login
                </button>
              </div>

              <div className={`mt-6 rounded-[24px] border px-4 py-4 ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"}`}>
                <p className={`text-sm font-semibold ${t.text}`}>Passenger-only registration</p>
                <p className={`mt-1 text-sm ${t.textSub}`}>
                  New passengers can create an account after OTP verification and location setup.
                </p>
                <Link
                  className={`mt-4 inline-flex rounded-2xl px-4 py-3 text-sm font-semibold transition ${isDark ? "bg-white text-slate-950 hover:bg-slate-100" : "bg-sky-600 text-white hover:bg-sky-500"}`}
                  to="/auth/register"
                >
                  Create passenger account
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
