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
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbf3f6,#f5ebf2)] text-[#27133f]">
      <div className="mx-auto max-w-md px-5 py-10">
        <h1 className="text-2xl font-bold text-[#34155d]">{title}</h1>

        <div className="mt-4 rounded-3xl border border-[#eddff2] bg-white p-4 shadow-[0_18px_40px_rgba(46,18,79,0.08)]">
          <div className="text-sm">
            <div><b>Status:</b> {status}</div>
            {method ? <div className="mt-1"><b>Method:</b> {method}</div> : null}
            {booking ? <div className="mt-1"><b>Booking:</b> #{booking}</div> : null}
          </div>

          <div className="mt-4 flex gap-2">
            <Link
              to="/passenger"
              className="flex-1 rounded-2xl bg-[linear-gradient(135deg,#ff6b73,#ff8a5b)] px-4 py-3 text-center font-semibold text-white"
            >
              Back to Passenger
            </Link>
            <Link
              to="/helper"
              className="flex-1 rounded-2xl border border-[#eddff2] px-4 py-3 text-center font-semibold text-[#34155d]"
            >
              Helper
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
