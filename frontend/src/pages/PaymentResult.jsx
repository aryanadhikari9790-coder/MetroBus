import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { api } from "../api";
import { MetroBusMark, MetroBusWordmark } from "../components/passenger/PassengerUI";

function paymentStatusTone(status) {
  if (status === "success") {
    return {
      badge: "bg-emerald-100 text-emerald-700",
      title: "Payment Successful",
      body: "MetroBus verified your payment and attached it to this booking.",
    };
  }
  if (status === "pending") {
    return {
      badge: "bg-amber-100 text-amber-700",
      title: "Payment Pending",
      body: "MetroBus is still waiting for Khalti to finish or confirm the payment.",
    };
  }
  return {
    badge: "bg-rose-100 text-rose-700",
    title: "Payment Failed",
    body: "The payment did not complete. You can go back to MetroBus and try again on the same booking.",
  };
}

function normalizeResultStatus(status) {
  const value = String(status || "").toUpperCase();
  if (value === "SUCCESS" || value === "COMPLETED") return "success";
  if (value === "PENDING" || value === "INITIATED") return "pending";
  return "failed";
}

export default function PaymentResult() {
  const { search } = useLocation();
  const query = useMemo(() => new URLSearchParams(search), [search]);

  const initialStatus = normalizeResultStatus(query.get("status") || "unknown");
  const method = (query.get("method") || "").toLowerCase();
  const bookingId = query.get("booking") || "";
  const paymentId = query.get("payment") || "";
  const [status, setStatus] = useState(initialStatus);
  const [payment, setPayment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const verifyKhaltiStatus = useCallback(async () => {
    if (method !== "khalti" || !paymentId) return;
    setBusy(true);
    setError("");
    try {
      const response = await api.post(`/api/payments/khalti/verify/${paymentId}/`);
      const nextPayment = response.data.payment || null;
      setPayment(nextPayment);
      setStatus(normalizeResultStatus(nextPayment?.status || "unknown"));
    } catch (err) {
      setError(err?.response?.data?.detail || "Unable to refresh the Khalti payment status right now.");
    } finally {
      setBusy(false);
    }
  }, [method, paymentId]);

  useEffect(() => {
    if (method === "khalti" && paymentId) verifyKhaltiStatus();
  }, [method, paymentId, verifyKhaltiStatus]);

  const tone = paymentStatusTone(status);
  const resolvedBookingId = payment?.booking || bookingId;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbf3f6_0%,#f6edf3_45%,#f1e7ef_100%)] px-4 py-8 text-[#27133f]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
        <div className="text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-white shadow-[0_24px_48px_rgba(46,18,79,0.12)]">
            <div className="grid h-14 w-14 place-items-center rounded-[1.2rem] bg-[linear-gradient(135deg,#34155d,#ff6b73)] text-white shadow-[0_16px_32px_rgba(52,21,93,0.2)]">
              <MetroBusMark className="h-8 w-8" />
            </div>
          </div>
          <div className="mt-5">
            <MetroBusWordmark />
          </div>
          <p className="mt-3 text-lg font-medium text-[#6f607f]">Secure payment return</p>
        </div>

        <div className="mt-8 rounded-[2.4rem] bg-white p-6 shadow-[0_30px_80px_rgba(46,18,79,0.12)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#34155d]">
                {method ? `${method.toUpperCase()} Payment` : "MetroBus Payment"}
              </p>
              <h1 className="mt-2 text-[2.2rem] font-black leading-tight text-[#27133f]">{tone.title}</h1>
            </div>
            <span className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] ${tone.badge}`}>
              {busy ? "Checking" : status}
            </span>
          </div>

          <p className="mt-4 text-base leading-7 text-[#6f607f]">{tone.body}</p>

          {error ? (
            <div className="mt-4 rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-6 grid gap-3">
            <div className="rounded-[1.6rem] bg-[#f7f1f7] px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8b7b99]">Booking</p>
              <p className="mt-2 text-lg font-black text-[#27133f]">{resolvedBookingId ? `#${resolvedBookingId}` : "--"}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[1.6rem] bg-[#f7f1f7] px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8b7b99]">Gateway Status</p>
                <p className="mt-2 text-base font-black text-[#34155d]">{payment?.gateway_status || query.get("status") || "--"}</p>
              </div>
              <div className="rounded-[1.6rem] bg-[#f7f1f7] px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8b7b99]">Amount</p>
                <p className="mt-2 text-base font-black text-[#27133f]">
                  {payment?.amount != null ? `NPR ${Number(payment.amount).toLocaleString()}` : "--"}
                </p>
              </div>
            </div>
            <div className="rounded-[1.6rem] bg-[#f7f1f7] px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8b7b99]">Khalti pidx</p>
              <p className="mt-2 break-all text-sm font-black text-[#34155d]">{payment?.reference || "--"}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[1.6rem] bg-[#f7f1f7] px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8b7b99]">Order ID</p>
                <p className="mt-2 break-all text-sm font-black text-[#27133f]">{payment?.gateway_order_id || "--"}</p>
              </div>
              <div className="rounded-[1.6rem] bg-[#f7f1f7] px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8b7b99]">Transaction ID</p>
                <p className="mt-2 break-all text-sm font-black text-[#27133f]">{payment?.gateway_transaction_id || "--"}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {method === "khalti" ? (
              <button
                type="button"
                onClick={verifyKhaltiStatus}
                disabled={busy || !paymentId}
                className="w-full rounded-full border border-[#eddff2] bg-[#f7f1f7] px-6 py-4 text-base font-black text-[#34155d] disabled:opacity-60"
              >
                {busy ? "Refreshing Status..." : "Refresh Khalti Status"}
              </button>
            ) : null}

            <Link
              to="/passenger"
              className="block w-full rounded-full bg-[linear-gradient(135deg,#ff6b73,#ff8a5b)] px-6 py-4 text-center text-base font-black text-white shadow-[0_18px_36px_rgba(255,107,115,0.24)]"
            >
              Return to MetroBus
            </Link>
          </div>

          <p className="mt-5 text-center text-sm leading-6 text-[#7d6a8a]">
            If the payment is still pending, keep MetroBus open and try refreshing once more before retrying the payment.
          </p>
        </div>
      </div>
    </div>
  );
}
