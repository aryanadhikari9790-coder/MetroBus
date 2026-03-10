import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";

export default function Register() {
  const nav = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const onRegister = async () => {
    setErr("");
    setOk("");
    try {
      await api.post("/api/auth/register/", {
        full_name: fullName,
        phone,
        email: email || null,
        password,
      });
      setOk("Registered! Please login.");
      setTimeout(() => nav("/auth/login"), 700);
    } catch (e) {
      setErr("Register failed. Check fields or phone/email already exists.");
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-brand-bg dark:text-brand-text">
      <div className="mx-auto max-w-md px-5 py-10">
        <h1 className="text-2xl font-bold">Register</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-brand-muted">
          Create your MetroBus account.
        </p>

        {err ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {err}
          </div>
        ) : null}

        {ok ? (
          <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-200">
            {ok}
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          <input
            className="w-full rounded-2xl border p-3 dark:border-slate-700 dark:bg-brand-card"
            placeholder="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <input
            className="w-full rounded-2xl border p-3 dark:border-slate-700 dark:bg-brand-card"
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            className="w-full rounded-2xl border p-3 dark:border-slate-700 dark:bg-brand-card"
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            onClick={onRegister}
          >
            Register
          </button>
        </div>

        <p className="mt-6 text-sm text-slate-600 dark:text-brand-muted">
          Already have an account?{" "}
          <Link className="font-semibold underline" to="/auth/login">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
