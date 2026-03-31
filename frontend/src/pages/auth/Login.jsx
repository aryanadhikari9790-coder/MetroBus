import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { setToken } from "../../auth";
import { useAuth } from "../../AuthContext";

const roleToHome = {
  PASSENGER: "/passenger",
  DRIVER: "/driver",
  HELPER: "/helper",
  ADMIN: "/admin",
};

function MetroBusMark() {
  return (
    <svg viewBox="0 0 72 72" className="h-12 w-12" aria-hidden="true">
      <defs>
        <linearGradient id="metrobus-login-gradient" x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#5f0c84" />
          <stop offset="100%" stopColor="#be3fff" />
        </linearGradient>
      </defs>
      <rect x="17" y="9" width="33" height="52" rx="10" fill="url(#metrobus-login-gradient)" />
      <rect x="23" y="18" width="21" height="28" rx="4" fill="#fff" opacity="0.95" />
      <rect x="28" y="12" width="10" height="3" rx="1.5" fill="#fff" />
      <rect x="10" y="27" width="8" height="4" rx="2" fill="url(#metrobus-login-gradient)" />
      <rect x="15" y="34" width="8" height="4" rx="2" fill="url(#metrobus-login-gradient)" />
      <rect x="17" y="41" width="8" height="4" rx="2" fill="url(#metrobus-login-gradient)" />
      <path d="M22 29h12l10 10-10 10H22l8-10z" fill="#fff" />
      <path d="M26 32h9l7 7-7 7h-9l5-7z" fill="url(#metrobus-login-gradient)" />
      <path d="M49 31c5 0 9 4 9 9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M49 24c8 0 15 7 15 16" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="28" cy="56" r="3" fill="#fff" />
      <circle cx="42" cy="56" r="3" fill="#fff" />
      <rect x="48" y="24" width="8" height="16" rx="3" fill="url(#metrobus-login-gradient)" />
    </svg>
  );
}

export default function Login() {
  const nav = useNavigate();
  const { refreshMe } = useAuth();
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

  const roleCards = [
    {
      label: "Passenger",
      desc: "Can create a personal account and book live routes from the public side.",
    },
    {
      label: "Driver",
      desc: "Admin-created account for trip start, live tracking, and bus control.",
    },
    {
      label: "Helper",
      desc: "Admin-created account for boarding, cash verification, and route ops.",
    },
    {
      label: "Admin",
      desc: "Manages routes, buses, schedules, staff, and operations.",
    },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff8fd,#fff3f9_48%,#f7e4fb)] text-[#2b1637]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(182,65,255,0.16),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,79,216,0.14),transparent_34%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-5 py-8 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <section className="relative overflow-hidden rounded-[38px] border border-white/70 bg-[linear-gradient(160deg,rgba(255,255,255,0.82),rgba(255,240,249,0.92))] p-6 shadow-[0_26px_70px_rgba(141,18,235,0.12)] lg:p-8">
            <div className="absolute -right-20 top-10 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(190,63,255,0.18),transparent_68%)]" />
            <div className="absolute -left-12 bottom-0 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(255,79,216,0.16),transparent_68%)]" />

            <div className="relative">
              <div className="flex items-center gap-3">
                <div className="grid h-16 w-16 place-items-center rounded-[24px] bg-white shadow-[0_18px_42px_rgba(141,18,235,0.18)]">
                  <MetroBusMark />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.34em] text-[#8d12eb]">MetroBus Pokhara</p>
                  <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-[#4f146d]">
                    Smart transit access for every MetroBus role.
                  </h1>
                </div>
              </div>

              <p className="mt-6 max-w-xl text-sm leading-7 text-[#6f587d]">
                Sign in with your phone number and password. Passenger accounts can be created from the public signup flow,
                while drivers, helpers, and admins receive their credentials directly from MetroBus administration.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {roleCards.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[26px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(251,235,249,0.92))] p-4 shadow-[0_12px_28px_rgba(141,18,235,0.08)]"
                  >
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-[#8d12eb]">{item.label}</p>
                    <p className="mt-2 text-sm leading-6 text-[#6f587d]">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-7 rounded-[30px] bg-[linear-gradient(135deg,#8d12eb,#c243ff)] p-5 text-white shadow-[0_22px_40px_rgba(141,18,235,0.22)]">
                <p className="text-xs font-black uppercase tracking-[0.26em] text-white/72">Login rule</p>
                <p className="mt-3 text-2xl font-black">Phone number + password</p>
                <p className="mt-2 text-sm leading-6 text-white/78">
                  Use your Nepal number format such as <span className="font-black">+977 98XXXXXXXX</span> or your existing saved phone login.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[38px] border border-white/70 bg-white/86 p-6 shadow-[0_26px_70px_rgba(141,18,235,0.14)] backdrop-blur-xl lg:p-8">
            <p className="text-xs font-black uppercase tracking-[0.34em] text-[#8d12eb]">Sign In</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#25122f]">Access your MetroBus workspace</h2>
            <p className="mt-2 text-sm leading-6 text-[#6f587d]">
              Passengers, drivers, helpers, and admins all sign in here. Passenger registration stays separate.
            </p>

            {err ? (
              <div className="mt-5 rounded-[26px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {err}
              </div>
            ) : null}

            <div className="mt-7 space-y-3">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-[#8d12eb]">Phone number</span>
                <input
                  className="w-full rounded-[24px] border border-[#ead4f2] bg-[#fff9fd] px-4 py-3.5 text-sm font-medium text-[#25122f] outline-none transition placeholder:text-[#9f8ca7] focus:border-[#b641ff] focus:ring-2 focus:ring-[#edd2ff]"
                  placeholder="+977 98XXXXXXXX"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-[#8d12eb]">Password</span>
                <input
                  className="w-full rounded-[24px] border border-[#ead4f2] bg-[#fff9fd] px-4 py-3.5 text-sm font-medium text-[#25122f] outline-none transition placeholder:text-[#9f8ca7] focus:border-[#b641ff] focus:ring-2 focus:ring-[#edd2ff]"
                  placeholder="Password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>

              <button
                type="button"
                className="w-full rounded-[26px] bg-[linear-gradient(135deg,#8d12eb,#b641ff)] px-4 py-4 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_18px_32px_rgba(141,18,235,0.24)] transition hover:translate-y-[-1px]"
                onClick={onLogin}
              >
                Login
              </button>
            </div>

            <div className="mt-6 rounded-[28px] border border-[#eed8f4] bg-[linear-gradient(180deg,#fff,#fff4fb)] px-5 py-4">
              <p className="text-sm font-black text-[#25122f]">Passenger-only registration</p>
              <p className="mt-1 text-sm leading-6 text-[#6f587d]">
                New passengers can create an account after OTP verification and location setup. Staff accounts are created by admin.
              </p>
              <Link
                className="mt-4 inline-flex rounded-full bg-[#f3dcff] px-4 py-3 text-sm font-black text-[#8d12eb] transition hover:bg-[#edd2ff]"
                to="/auth/register"
              >
                Create passenger account
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
