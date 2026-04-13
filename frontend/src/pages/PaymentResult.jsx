import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { api } from "../api";
import { clearToken, getToken, getRefreshToken } from "../auth";

import PaymentErrorView from "../components/payment/PaymentErrorView";
import PaymentPendingView from "../components/payment/PaymentPendingView";

function normalizeResultStatus(status) {
  const value = String(status || "").toUpperCase();
  if (value === "SUCCESS" || value === "COMPLETED") return "success";
  if (value === "PENDING" || value === "INITIATED") return "pending";
  return "failed";
}

function isTokenInvalidError(err) {
  const detail = err?.response?.data?.detail;
  const code = err?.response?.data?.code;
  return code === "token_not_valid" || detail === "Given token not valid for any token type";
}

export default function PaymentResult() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const query = useMemo(() => new URLSearchParams(search), [search]);

  const initialStatus = normalizeResultStatus(query.get("status") || "unknown");
  const method = (query.get("method") || "").toLowerCase();
  const bookingId = query.get("booking") || "";
  const paymentId = query.get("payment") || "";
  
  const [status, setStatus] = useState(initialStatus);
  const [payment, setPayment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // If the URL already says success (non-Khalti or pre-verified), redirect immediately.
  useEffect(() => {
    if (initialStatus === "success" && method !== "khalti") {
      navigate("/passenger", { replace: true });
    }
  }, [initialStatus, method, navigate]);

  const verifyKhaltiStatus = useCallback(async () => {
    if (method !== "khalti" || !paymentId) return;
    setBusy(true);
    setError("");
    try {
      const response = await api.post(`/api/payments/khalti/verify/${paymentId}/`);
      const nextPayment = response.data.payment || null;
      setPayment(nextPayment);
      const nextStatus = normalizeResultStatus(nextPayment?.status || "unknown");
      setStatus(nextStatus);
      // On successful Khalti verification, go straight to the passenger dashboard.
      if (nextStatus === "success") {
        navigate("/passenger", { replace: true });
      }
    } catch (err) {
      if (isTokenInvalidError(err)) {
        clearToken();
        setError("Your MetroBus session expired. Sign in again to refresh payment status.");
      } else {
        setError(err?.response?.data?.detail || "Unable to refresh status.");
      }
      setStatus("failed");
    } finally {
      setBusy(false);
    }
  }, [method, navigate, paymentId]);

  useEffect(() => {
    if (method === "khalti" && paymentId && (getToken() || getRefreshToken())) {
      verifyKhaltiStatus();
    }
  }, [method, paymentId, verifyKhaltiStatus]);

  // While verifying Khalti payment, show a pending/loading screen.
  if (busy || (method === "khalti" && status === "pending" && !error)) {
    return <PaymentPendingView />;
  }

  // If for some reason status resolved to success without redirecting, redirect now.
  if (status === "success") {
    navigate("/passenger", { replace: true });
    return <PaymentPendingView />;
  }

  // Handle errors or failed/cancelled status.
  const errorType = query.get("status") === "cancelled" ? "cancelled" : "failed";
  return (
    <PaymentErrorView 
      payment={payment} 
      bookingId={bookingId} 
      errorType={errorType} 
      errorMessage={error}
    />
  );
}
