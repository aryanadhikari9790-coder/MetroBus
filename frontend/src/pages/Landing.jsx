import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-brand-bg dark:text-brand-text">
      <div className="mx-auto max-w-md px-5 py-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-brand-accent" />
          <div>
            <h1 className="text-2xl font-bold">MetroBus</h1>
            <p className="text-sm text-slate-500 dark:text-brand-muted">
              Public bus booking & tracking (Pokhara)
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-brand-card">
          <p className="text-sm text-slate-600 dark:text-brand-muted">
            Login is required to search routes, view buses, and book seats.
          </p>

          <div className="mt-5 flex gap-3">
            <Link
              to="/auth/login"
              className="flex-1 rounded-2xl bg-brand-accent px-4 py-3 text-center font-semibold text-slate-900"
            >
              Login
            </Link>
            <Link
              to="/auth/register"
              className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-center font-semibold dark:border-slate-700"
            >
              Register
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Link to="/passenger" className="rounded-2xl border p-3 dark:border-slate-700">
              Passenger (demo)
            </Link>
            <Link to="/driver" className="rounded-2xl border p-3 dark:border-slate-700">
              Driver (demo)
            </Link>
            <Link to="/helper" className="rounded-2xl border p-3 dark:border-slate-700">
              Helper (demo)
            </Link>
            <Link to="/admin" className="rounded-2xl border p-3 dark:border-slate-700">
              Admin (demo)
            </Link>
          </div>
        </div>

        <button
          className="mt-6 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800"
          onClick={() => {
            document.documentElement.classList.toggle("dark");
          }}
        >
          Toggle Dark Mode
        </button>
      </div>
    </div>
  );
}
