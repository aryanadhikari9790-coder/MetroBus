import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MetroBusMark, MetroBusWordmark } from "../passenger/PassengerUI";

/**
 * Premium Payment Success View
 * Features: Animated checkmark, vibrant gradients, and clear transaction summary.
 */
export default function PaymentSuccessView({ payment, bookingId }) {
  const navigate = useNavigate();
  const resolvedId = payment?.booking || bookingId;
  const amount = payment?.amount != null ? Number(payment.amount).toLocaleString() : "--";
  const reference = payment?.reference || "--";

  useEffect(() => {
    // Automatically redirect to the passenger home page after 5 seconds.
    // This allows the user to see the success message but returns them
    // to their active ride dashboard efficiently.
    const timer = setTimeout(() => {
      navigate("/passenger");
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f0fdf4_0%,#ffffff_100%)] px-4 py-12 text-[#1a2e1a]">
      <div className="mx-auto max-w-md">
        {/* Branding */}
        <div className="mb-12 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.4rem] bg-white shadow-[0_14px_30px_rgba(0,0,0,0.05)]">
            <div className="grid h-12 w-12 place-items-center rounded-[0.9rem] bg-[linear-gradient(135deg,#10b981,#34155d)] text-white shadow-[0_10px_22px_rgba(16,185,129,0.2)]">
              <MetroBusMark className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 opacity-80 scale-90 origin-center">
            <MetroBusWordmark />
          </div>
        </div>

        {/* Success Card */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-white p-8 shadow-[0_24px_50px_rgba(16,185,129,0.12)] border border-emerald-50">
          {/* Animated Checkmark Circle */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-emerald-100 opacity-20"></div>
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 shadow-inner">
                <svg
                  className="h-12 w-12 animate-[success-check_0.6s_ease-out_forwards]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-[2.2rem] font-black leading-tight text-[#111827]">Payment Verified!</h1>
            <p className="mt-3 text-lg font-medium text-emerald-600/80">Your ride is ready to board</p>
            <p className="mt-6 text-base leading-relaxed text-slate-500">
              MetroBus has successfully verified your payment. Keep your ticket ready for the helper.
            </p>
          </div>

          {/* Transaction Metadata */}
          <div className="mt-10 space-y-3">
            <div className="flex items-center justify-between rounded-[1.2rem] bg-slate-50 px-5 py-4">
              <span className="text-sm font-bold uppercase tracking-widest text-slate-400">Amount Paid</span>
              <span className="text-xl font-black text-emerald-600">NPR {amount}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[1.2rem] bg-slate-50 px-5 py-4">
                <span className="block text-[0.65rem] font-black uppercase tracking-[0.2em] text-slate-400">Booking ID</span>
                <span className="mt-1 block text-base font-black text-[#1f2937]">#{resolvedId}</span>
              </div>
              <div className="rounded-[1.2rem] bg-slate-50 px-5 py-4">
                <span className="block text-[0.65rem] font-black uppercase tracking-[0.2em] text-slate-400">Method</span>
                <span className="mt-1 block text-base font-black text-[#1f2937] capitalize">{payment?.method || "Online"}</span>
              </div>
            </div>

            <div className="rounded-[1.2rem] bg-slate-50 px-5 py-4">
              <span className="block text-[0.65rem] font-black uppercase tracking-[0.2em] text-slate-400">Reference / pidx</span>
              <span className="mt-1 block break-all text-[0.85rem] font-black text-slate-600 font-mono tracking-tighter line-clamp-1">{reference}</span>
            </div>
          </div>

          {/* OK Button */}
          <div className="mt-10">
            <Link
              to="/passenger"
              className="flex w-full items-center justify-center gap-2 rounded-[1.4rem] bg-[linear-gradient(135deg,#10b981,#059669)] px-8 py-5 text-lg font-black text-white shadow-[0_12px_28px_rgba(16,185,129,0.3)] hover:shadow-[0_16px_32px_rgba(16,185,129,0.4)] transition-all active:scale-[0.98]"
            >
              OK, Got it
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-sm font-bold text-slate-400/80 uppercase tracking-[0.15em]">
          Thank you for choosing MetroBus
        </p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes success-check {
          0% { stroke-dasharray: 0 100; stroke-dashoffset: 0; opacity: 0; transform: scale(0.6); }
          100% { stroke-dasharray: 100 0; stroke-dashoffset: 0; opacity: 1; transform: scale(1); }
        }
      `}} />
    </div>
  );
}
