import { Link } from "react-router-dom";
import { MetroBusMark, MetroBusWordmark } from "../passenger/PassengerUI";

/**
 * Premium Payment Error View
 * Features: High-visibility error icon, retry options, and clear next steps.
 */
export default function PaymentErrorView({ payment, bookingId, errorType }) {
  const resolvedId = payment?.booking || bookingId;
  const reason = errorType === "cancelled" ? "Cancelled by user" : "Transaction failed";
  const status = payment?.gateway_status || "Failed";

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff1f2_0%,#ffffff_100%)] px-4 py-12 text-[#2e1a1c]">
      <div className="mx-auto max-w-md">
        {/* Branding */}
        <div className="mb-12 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.4rem] bg-white shadow-[0_14px_30px_rgba(0,0,0,0.05)]">
            <div className="grid h-12 w-12 place-items-center rounded-[0.9rem] bg-[linear-gradient(135deg,#f43f5e,#34155d)] text-white shadow-[0_10px_22px_rgba(244,63,94,0.2)]">
              <MetroBusMark className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 opacity-80 scale-90 origin-center">
            <MetroBusWordmark />
          </div>
        </div>

        {/* Error Card */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-white p-8 shadow-[0_24px_50px_rgba(244,63,94,0.12)] border border-rose-50">
          {/* Error Icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse rounded-full bg-rose-100 opacity-30"></div>
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-rose-50 text-rose-500 shadow-inner">
                <svg
                  className="h-12 w-12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-[2.2rem] font-black leading-tight text-[#111827]">Payment Failed</h1>
            <p className="mt-3 text-lg font-medium text-rose-600/80">{reason}</p>
            <p className="mt-6 text-base leading-relaxed text-slate-500">
              The payment process did not complete successfully. No funds have been deducted, or they will be refunded shortly if they were.
            </p>
          </div>

          {/* Details */}
          <div className="mt-10 space-y-3">
            <div className="rounded-[1.2rem] bg-slate-50 px-5 py-4 flex justify-between items-center">
              <span className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-slate-400">Gateway Status</span>
              <span className="text-sm font-black text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-100">{status}</span>
            </div>
            
            <div className="rounded-[1.2rem] bg-slate-50 px-5 py-4">
              <span className="block text-[0.65rem] font-black uppercase tracking-[0.2em] text-slate-400">Booking Reference</span>
              <span className="mt-1 block text-base font-black text-[#1f2937]">#{resolvedId || "--"}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-10 space-y-3">
            <Link
              to={resolvedId ? `/passenger?view=checkout&bookingId=${resolvedId}` : "/passenger"}
              className="flex w-full items-center justify-center gap-2 rounded-[1.4rem] bg-[linear-gradient(135deg,#f43f5e,#e11d48)] px-8 py-5 text-lg font-black text-white shadow-[0_12px_28px_rgba(244,63,94,0.3)] hover:shadow-[0_16px_32px_rgba(244,63,94,0.4)] transition-all active:scale-[0.98]"
            >
              Try Again
            </Link>
            
            <Link
              to="/passenger"
              className="flex w-full items-center justify-center gap-2 rounded-[1.4rem] border-2 border-slate-100 bg-white px-8 py-5 text-lg font-black text-slate-600 transition-all hover:bg-slate-50 active:scale-[0.98]"
            >
              Go to Home
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-sm font-bold text-slate-400/80 uppercase tracking-[0.15em]">
          MetroBus • Secure Payment
        </p>
      </div>
    </div>
  );
}
