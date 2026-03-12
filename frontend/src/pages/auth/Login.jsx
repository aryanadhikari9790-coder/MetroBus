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
      setErr("Login failed. Check phone/password.");
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-brand-bg dark:text-brand-text">
      <div className="mx-auto max-w-md px-5 py-10">
        <h1 className="text-2xl font-bold">Login</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-brand-muted">
          MetroBus account required.
        </p>

        {err ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {err}
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          <input
            className="w-full rounded-2xl border p-3 dark:border-slate-700 dark:bg-brand-card"
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            className="w-full rounded-2xl border p-3 dark:border-slate-700 dark:bg-brand-card"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            className="w-full rounded-2xl bg-brand-accent px-4 py-3 font-semibold text-slate-900"
            onClick={onLogin}
          >
            Login
          </button>
        </div>

        <p className="mt-6 text-sm text-slate-600 dark:text-brand-muted">
          New here?{" "}
          <Link className="font-semibold underline" to="/auth/register">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
