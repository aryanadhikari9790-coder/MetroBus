import { Link } from "react-router-dom";

export default function Login() {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-brand-bg dark:text-brand-text">
      <div className="mx-auto max-w-md px-5 py-10">
        <h1 className="text-2xl font-bold">Login</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-brand-muted">
          MetroBus account required.
        </p>

        <div className="mt-6 space-y-3">
          <input className="w-full rounded-2xl border p-3 dark:border-slate-700 dark:bg-brand-card"
            placeholder="Phone or Email" />
          <input className="w-full rounded-2xl border p-3 dark:border-slate-700 dark:bg-brand-card"
            placeholder="Password" type="password" />
          <button className="w-full rounded-2xl bg-brand-accent px-4 py-3 font-semibold text-slate-900">
            Login (UI only)
          </button>
        </div>

        <p className="mt-6 text-sm text-slate-600 dark:text-brand-muted">
          New here? <Link className="font-semibold underline" to="/auth/register">Create account</Link>
        </p>
      </div>
    </div>
  );
}
