export default function PassengerHome() {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-brand-bg dark:text-brand-text">
      <div className="mx-auto max-w-md px-5 py-6">
        <h1 className="text-xl font-bold">Passenger</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-brand-muted">
          Search destination → select bus → book seats.
        </p>

        <div className="mt-5 rounded-3xl border p-4 dark:border-slate-800 dark:bg-brand-card">
          <input
            className="w-full rounded-2xl border p-3 dark:border-slate-700 dark:bg-brand-bg"
            placeholder="Where to? (destination)"
          />
          <button className="mt-3 w-full rounded-2xl bg-brand-accent px-4 py-3 font-semibold text-slate-900">
            Search (next step)
          </button>
        </div>
      </div>
    </div>
  );
}
