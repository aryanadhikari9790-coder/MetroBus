import { useLocation, Link } from "react-router-dom";

export default function PaymentResult() {
  const { search } = useLocation();
  const q = new URLSearchParams(search);

  const status = q.get("status") || "unknown";
  const method = q.get("method") || "";
  const booking = q.get("booking") || "";

  const title =
    status === "success"
      ? "Payment Successful"
      : status === "pending"
      ? "Payment Pending"
      : "Payment Failed";

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-brand-bg dark:text-brand-text">
      <div className="mx-auto max-w-md px-5 py-10">
        <h1 className="text-2xl font-bold">{title}</h1>

        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-brand-card">
          <div className="text-sm">
            <div><b>Status:</b> {status}</div>
            {method ? <div className="mt-1"><b>Method:</b> {method}</div> : null}
            {booking ? <div className="mt-1"><b>Booking:</b> #{booking}</div> : null}
          </div>

          <div className="mt-4 flex gap-2">
            <Link
              to="/passenger"
              className="flex-1 rounded-2xl bg-brand-accent px-4 py-3 text-center font-semibold text-slate-900"
            >
              Back to Passenger
            </Link>
            <Link
              to="/helper"
              className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-center font-semibold dark:border-slate-800"
            >
              Helper
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
