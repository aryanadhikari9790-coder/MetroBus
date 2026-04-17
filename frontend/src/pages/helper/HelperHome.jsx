import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../AuthContext";
import { clearToken } from "../../auth";
import MetroSeatBoard from "../../components/shared/MetroSeatBoard";
import { useTheme } from "../../ThemeContext";

const LIGHT = {
  "--bg": "#f7efe7",
  "--bg-soft": "#fff7f0",
  "--surface": "rgba(255,255,255,0.92)",
  "--surface-strong": "rgba(255,255,255,0.98)",
  "--border": "rgba(73,39,94,0.10)",
  "--text": "#2d1838",
  "--muted": "#756681",
  "--primary": "#4b2666",
  "--accent": "#ff8a1f",
  "--accent-soft": "#fff1df",
  "--success": "#17a567",
  "--danger": "#db3d4f",
  "--header": "rgba(255,250,245,0.88)",
  "--footer": "rgba(255,251,247,0.96)",
  "--shadow": "0 20px 38px rgba(73,39,94,0.12)",
  "--shadow-strong": "0 24px 44px rgba(75,38,102,0.18)",
};

const DARK = {
  "--bg": "#190f24",
  "--bg-soft": "#24152f",
  "--surface": "rgba(37,24,49,0.90)",
  "--surface-strong": "rgba(44,27,58,0.96)",
  "--border": "rgba(255,255,255,0.09)",
  "--text": "#fff5ef",
  "--muted": "#c8b8c7",
  "--primary": "#8d5abf",
  "--accent": "#ff962d",
  "--accent-soft": "rgba(255,150,45,0.16)",
  "--success": "#1fcf81",
  "--danger": "#ff6474",
  "--header": "rgba(25,15,36,0.84)",
  "--footer": "rgba(27,17,39,0.95)",
  "--shadow": "0 22px 42px rgba(0,0,0,0.28)",
  "--shadow-strong": "0 26px 48px rgba(0,0,0,0.34)",
};

const TABS = [
  { id: "home", label: "Home", icon: "home" },
  { id: "riders", label: "Riders", icon: "users" },
  { id: "payments", label: "Payments", icon: "wallet" },
  { id: "account", label: "Account", icon: "account" },
];

function Icon({ name, className = "h-5 w-5" }) {
  const common = { className, fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24" };
  switch (name) {
    case "home": return <svg {...common}><path d="M4 10.5 12 4l8 6.5" /><path d="M7 10v8h10v-8" /></svg>;
    case "users": return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="3" /><path d="M20 21v-2a4 4 0 0 0-3-3.87" /><path d="M16.5 4.13a3 3 0 0 1 0 5.74" /></svg>;
    case "wallet": return <svg {...common}><rect x="4" y="6" width="16" height="12" rx="3" /><path d="M14 11h6" /><path d="M16.5 11h.01" /></svg>;
    case "account": return <svg {...common}><circle cx="12" cy="8" r="3.2" /><path d="M5 19a7 7 0 0 1 14 0" /></svg>;
    case "play": return <svg {...common}><path d="m8 6 10 6-10 6V6Z" /></svg>;
    case "stop": return <svg {...common}><rect x="7" y="7" width="10" height="10" rx="2" /></svg>;
    case "money": return <svg {...common}><path d="M4 7h16v10H4z" /><path d="M8 12h8" /><path d="M9 9v6" /><path d="M15 9v6" /></svg>;
    case "shield": return <svg {...common}><path d="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6l-7-3Z" /><path d="m9.5 12 1.7 1.7 3.3-3.7" /></svg>;
    case "ticket": return <svg {...common}><path d="M5 9a2 2 0 0 0 0 6v3h14v-3a2 2 0 0 0 0-6V6H5v3Z" /><path d="M12 6v12" /></svg>;
    case "back": return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>;
  }
}

function LogoMark() {
  return (
    <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[1.1rem] bg-[linear-gradient(180deg,#4b2666_0%,#6d3d9b_50%,#ff8a1f_100%)] shadow-[0_14px_30px_rgba(75,38,102,0.24)]">
      <div className="absolute right-1 top-1 h-8 w-8 rounded-full border-[6px] border-[rgba(255,143,31,0.95)] border-l-transparent border-b-transparent rotate-[28deg]" />
      <div className="relative text-white">
        <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <rect x="5" y="7" width="14" height="10" rx="3" />
          <path d="M7 12h10" />
          <path d="M8 17v2" />
          <path d="M16 17v2" />
          <path d="M3 9h2" />
          <path d="M1 13h4" />
        </svg>
      </div>
    </div>
  );
}

function SurfaceCard({ children, className = "" }) {
  return <section className={`rounded-[1.8rem] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)] backdrop-blur-xl ${className}`}>{children}</section>;
}

function StatusPill({ children, tone = "default" }) {
  const tones = {
    default: "bg-[var(--accent-soft)] text-[var(--primary)]",
    live: "bg-[rgba(23,165,103,0.14)] text-[var(--success)]",
    waiting: "bg-[rgba(255,150,45,0.16)] text-[var(--accent)]",
    danger: "bg-[rgba(219,61,79,0.12)] text-[var(--danger)]",
  };
  return <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.16em] ${tones[tone] || tones.default}`}>{children}</span>;
}

function ActionButton({ children, tone = "primary", className = "", ...props }) {
  const tones = {
    primary: "bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-white shadow-[var(--shadow-strong)]",
    secondary: "border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text)]",
    danger: "bg-[linear-gradient(135deg,#a92b3c,#ff6e55)] text-white shadow-[var(--shadow-strong)]",
  };
  return <button type="button" className={`inline-flex items-center justify-center gap-2 rounded-[1.2rem] px-5 py-4 text-sm font-black tracking-[0.04em] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-55 ${tones[tone] || tones.primary} ${className}`} {...props}>{children}</button>;
}

function SelectField({ label, value, onChange, options, disabled = false }) {
  return (
    <div>
      <label className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--muted)]">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="w-full rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3.5 text-sm font-semibold text-[var(--text)] outline-none disabled:opacity-60">
        {options.map((option) => <option key={`${option.value}-${option.label}`} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

function PlaceholderPanel({ tabLabel }) {
  return (
    <SurfaceCard className="mt-4 p-6">
      <p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[var(--primary)]">Helper Navigation</p>
      <h2 className="mt-3 text-[2rem] font-black leading-tight text-[var(--text)]">{tabLabel} page is ready for the next step</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--muted)]">The helper footer navigation is in place now. We can design this page next when you are ready.</p>
    </SurfaceCard>
  );
}

const fmtTime = (value) => {
  if (!value) return "--";
  try { return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch { return value; }
};

const fmtDateTime = (value) => {
  if (!value) return "--";
  try { return new Date(value).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return value; }
};

const initials = (name) => {
  if (!name) return "HP";
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "HP";
};

const getStopName = (stops, order) => stops.find((item) => String(item.stop_order) === String(order))?.stop?.name || "--";
const sanitizeOtp = (value) => String(value || "").replace(/\D/g, "").slice(0, 4);

const helperPaymentState = (booking) => {
  const status = booking?.payment_status || booking?.payment?.status || "UNPAID";
  if (status === "SUCCESS") return { label: "Paid", tone: "live" };
  if (status === "PENDING") return { label: "Pending Payment", tone: "waiting" };
  if (status === "FAILED" || status === "CANCELLED") return { label: "Payment Retry", tone: "danger" };
  return { label: "Unpaid", tone: "default" };
};

const helperJourneyLabel = (booking) => {
  if (!booking) return "Waiting for OTP details";
  if (booking.completed_at) return "Ride completed";
  if (booking.checked_in_at) return "Passenger onboard";
  if (booking.accepted_by_helper_at) return "Ready to board";
  if (booking.scanned_at) return "OTP scanned";
  return "Waiting for helper action";
};

export default function HelperHome() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const { isDark } = useTheme();
  const theme = useMemo(() => (isDark ? DARK : LIGHT), [isDark]);
  const shell = "enterprise-mobile-shell";

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [seatBusy, setSeatBusy] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("home");
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [routeStops, setRouteStops] = useState([]);
  const [seats, setSeats] = useState([]);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [fromOrder, setFromOrder] = useState("");
  const [toOrder, setToOrder] = useState("");
  const [seatSheet, setSeatSheet] = useState(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpBooking, setOtpBooking] = useState(null);

  const activeTrip = dashboard?.active_trip ?? null;
  const pendingTrip = dashboard?.pending_trip ?? null;
  const trip = activeTrip || pendingTrip;
  const seatLayoutTripId = trip?.id ?? null;
  const showSeatLayout = tab === "home" && Boolean(activeTrip);
  const schedules = dashboard?.schedules ?? [];
  const helperBookings = dashboard?.helper_bookings ?? {};

  useEffect(() => {
    if (!msg) return undefined;
    const timer = setTimeout(() => setMsg(""), 4000);
    return () => clearTimeout(timer);
  }, [msg]);

  const selectedSchedule = useMemo(() => {
    const preferred = trip?.schedule_id ? String(trip.schedule_id) : selectedScheduleId;
    if (preferred) {
      const matched = schedules.find((item) => String(item.id) === preferred);
      if (matched) return matched;
    }
    return schedules.find((item) => item.driver_assignment_accepted) || schedules[0] || null;
  }, [trip?.schedule_id, schedules, selectedScheduleId]);

  const seatBookingList = useMemo(() => [
    ...(helperBookings.needs_acceptance ?? []),
    ...(helperBookings.awaiting_payment ?? []),
    ...(helperBookings.ready_to_board ?? []),
    ...(helperBookings.onboard ?? []),
  ], [helperBookings.awaiting_payment, helperBookings.needs_acceptance, helperBookings.onboard, helperBookings.ready_to_board]);

  const bookingById = useMemo(() => Object.fromEntries(seatBookingList.map((booking) => [booking.id, booking])), [seatBookingList]);
  const selectedBooking = seatSheet?.booking_id ? bookingById[seatSheet.booking_id] || null : null;
  const otpLoadedBooking = otpBooking?.id ? bookingById[otpBooking.id] || otpBooking : otpBooking;
  const otpPayment = helperPaymentState(otpLoadedBooking);
  const availableSeats = seats.filter((seat) => seat.available).length;
  const occupiedSeats = seats.length - availableSeats;
  const paidSeats = seats.filter((seat) => !seat.available && seat.payment_verified).length;
  const stopOptions = routeStops.map((stop) => ({ value: String(stop.stop_order), label: `${stop.stop_order}. ${stop.stop?.name || "--"}` }));
  const selectedFromName = getStopName(routeStops, fromOrder);
  const selectedToName = getStopName(routeStops, toOrder);

  const homeStatus = activeTrip
    ? "Trip Live"
    : pendingTrip
      ? pendingTrip.helper_start_confirmed
        ? "Waiting for Driver"
        : pendingTrip.driver_start_confirmed
          ? "Ready to Confirm"
          : "Start Pending"
      : selectedSchedule
        ? selectedSchedule.driver_assignment_accepted
          ? "Ready to Start"
          : "Waiting for Driver"
        : "Standby";

  const startLabel = pendingTrip?.driver_start_confirmed && !pendingTrip.helper_start_confirmed
    ? "Confirm Start Ride"
    : pendingTrip?.helper_start_confirmed
      ? "Waiting for Driver"
      : "Start Ride";

  const endLabel = activeTrip?.driver_end_confirmed
    ? "Confirm End Trip"
    : activeTrip?.helper_end_confirmed
      ? "Waiting for Driver"
      : "End Trip";

  const loadDashboard = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get("/api/trips/helper/dashboard/");
      setDashboard(response.data);
      setErr("");
    } catch (error) {
      setErr(error?.response?.data?.detail || "Failed to load helper dashboard.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadTripContext = useCallback(async (tripId, { clearIfMissing = false } = {}) => {
    if (!tripId) {
      if (clearIfMissing) {
        setRouteStops([]);
        setSeats([]);
        setSeatSheet(null);
      }
      return;
    }
    try {
      const response = await api.get(`/api/trips/${tripId}/`);
      setRouteStops(response.data.route_stops || []);
      setErr("");
    } catch {
      if (clearIfMissing) {
        setRouteStops([]);
        setSeats([]);
        setSeatSheet(null);
      }
    }
  }, []);

  const loadSeats = useCallback(async (tripId, from = "", to = "", { silent = false } = {}) => {
    if (!tripId) {
      if (!silent) {
        setSeats([]);
        setSeatSheet(null);
      }
      return;
    }
    setLoadingSeats(true);
    try {
      const query = from && to ? `?from=${from}&to=${to}` : "";
      const response = await api.get(`/api/bookings/trips/${tripId}/availability/${query}`);
      setSeats(response.data.seats || []);
      if (response.data.from_stop_order) setFromOrder(String(response.data.from_stop_order));
      if (response.data.to_stop_order) setToOrder(String(response.data.to_stop_order));
      setErr("");
    } catch (error) {
      if (!silent) {
        setErr(error?.response?.data?.detail || "Unable to load seat layout.");
        setSeats([]);
      }
    } finally {
      setLoadingSeats(false);
    }
  }, []);

  const refreshAfterSeatAction = useCallback(async () => {
    await Promise.all([
      loadDashboard({ silent: true }),
      loadTripContext(seatLayoutTripId, { clearIfMissing: true }),
      loadSeats(seatLayoutTripId, fromOrder, toOrder, { silent: true }),
    ]);
  }, [fromOrder, loadDashboard, loadSeats, loadTripContext, seatLayoutTripId, toOrder]);

  const runTripAction = useCallback(async (requestFn, successMessage) => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const response = await requestFn();
      setMsg(response?.data?.message || successMessage);
      await loadDashboard({ silent: true });
      if (response?.data?.trip?.id) await loadTripContext(response.data.trip.id, { clearIfMissing: true });
      return response;
    } catch (error) {
      setErr(error?.response?.data?.detail || "Trip action failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }, [loadDashboard, loadTripContext]);

  const runSeatAction = useCallback(async (requestFn, successMessage, { closeSheet = false } = {}) => {
    setSeatBusy(true);
    setErr("");
    setMsg("");
    try {
      const response = await requestFn();
      setMsg(response?.data?.message || successMessage);
      if (closeSheet) setSeatSheet(null);
      await refreshAfterSeatAction();
      return response;
    } catch (error) {
      setErr(error?.response?.data?.detail || "Seat action failed.");
      return null;
    } finally {
      setSeatBusy(false);
    }
  }, [refreshAfterSeatAction]);

  const loadOtpBookingDetails = useCallback(async () => {
    const reference = sanitizeOtp(otpCode);
    if (reference.length !== 4) {
      setErr("Enter the passenger 4-digit ride OTP.");
      return;
    }
    setOtpBusy(true);
    setErr("");
    setMsg("");
    try {
      const response = await api.post("/api/bookings/otp/verify/", { reference });
      setOtpBooking(response.data.booking || null);
      setOtpCode(reference);
      setMsg(response.data.message || "Passenger ride details loaded.");
      await loadDashboard({ silent: true });
    } catch (error) {
      setOtpBooking(null);
      setErr(error?.response?.data?.detail || "Unable to load passenger ride details.");
    } finally {
      setOtpBusy(false);
    }
  }, [loadDashboard, otpCode]);

  const runOtpBoardingAction = useCallback(async (requestPayment) => {
    if (!otpLoadedBooking?.id) {
      setErr("Load the passenger OTP first.");
      return null;
    }
    setOtpBusy(true);
    setErr("");
    setMsg("");
    try {
      const response = await api.post(`/api/bookings/${otpLoadedBooking.id}/board/`, { request_payment: requestPayment });
      setOtpBooking(response.data.booking || otpLoadedBooking);
      setMsg(response.data.message || (requestPayment ? "Passenger boarded and payment request sent." : "Passenger boarded."));
      await refreshAfterSeatAction();
      return response;
    } catch (error) {
      setErr(error?.response?.data?.detail || "Unable to update this passenger ride.");
      return null;
    } finally {
      setOtpBusy(false);
    }
  }, [otpLoadedBooking, refreshAfterSeatAction]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => {
    const timer = setInterval(() => {
      loadDashboard({ silent: true });
      if (trip?.id) loadTripContext(trip.id);
    }, trip?.id ? 2500 : 4000);
    return () => clearInterval(timer);
  }, [trip?.id, loadDashboard, loadTripContext]);

  useEffect(() => {
    const preferred = trip?.schedule_id
      ? String(trip.schedule_id)
      : schedules.find((item) => item.driver_assignment_accepted)?.id
        ? String(schedules.find((item) => item.driver_assignment_accepted)?.id)
        : schedules[0]?.id
          ? String(schedules[0].id)
          : "";
    if (preferred !== selectedScheduleId) setSelectedScheduleId(preferred);
  }, [trip?.schedule_id, schedules, selectedScheduleId]);

  useEffect(() => { loadTripContext(trip?.id, { clearIfMissing: true }); }, [trip?.id, loadTripContext]);
  useEffect(() => {
    if (routeStops.length < 2) {
      setFromOrder("");
      setToOrder("");
      return;
    }
    setFromOrder((current) => current || String(routeStops[0].stop_order));
    setToOrder((current) => current || String(routeStops[routeStops.length - 1].stop_order));
  }, [routeStops]);

  useEffect(() => {
    if (!seatLayoutTripId) {
      setSeats([]);
      setSeatSheet(null);
      return;
    }
    loadSeats(seatLayoutTripId, fromOrder, toOrder, { silent: seats.length > 0 });
  }, [fromOrder, loadSeats, seatLayoutTripId, toOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!seatLayoutTripId) return undefined;
    const timer = setInterval(() => loadSeats(seatLayoutTripId, fromOrder, toOrder, { silent: true }), 4000);
    return () => clearInterval(timer);
  }, [fromOrder, loadSeats, seatLayoutTripId, toOrder]);

  useEffect(() => {
    if (trip?.id) return;
    setOtpBooking(null);
    setOtpCode("");
  }, [trip?.id]);

  const requestScheduledStart = async () => {
    if (!selectedSchedule?.id) return setErr("There is no scheduled trip selected right now.");
    if (!selectedSchedule.driver_assignment_accepted) return setErr("Wait for the driver to accept the assignment before starting.");
    return runTripAction(() => api.post("/api/trips/start/", { schedule_id: selectedSchedule.id }), "Trip start confirmation sent.");
  };

  const confirmPendingStart = async () => {
    if (!pendingTrip?.id) return setErr("There is no pending trip to confirm.");
    const payload = pendingTrip.schedule_id ? { schedule_id: pendingTrip.schedule_id } : { trip_id: pendingTrip.id };
    return runTripAction(() => api.post("/api/trips/start/", payload), "Trip start confirmation sent.");
  };

  const requestTripEnd = async () => {
    if (!activeTrip?.id) return setErr("There is no live trip to end right now.");
    return runTripAction(() => api.post(`/api/trips/${activeTrip.id}/end/`), "Trip end confirmation sent.");
  };

  const onboardOfflinePassenger = (seat) => {
    if (!activeTrip?.id) return setErr("Start the ride first to onboard an offline passenger.");
    if (!(fromOrder && toOrder && Number(toOrder) > Number(fromOrder))) return setErr("Choose a valid segment before onboarding an offline passenger.");
    return runSeatAction(() => api.post(`/api/bookings/trips/${activeTrip.id}/offline/`, { from_stop_order: Number(fromOrder), to_stop_order: Number(toOrder), seat_ids: [seat.seat_id] }), `Offline passenger onboarded in seat ${seat.seat_no}.`, { closeSheet: true });
  };

  const requestPaymentForSeat = (bookingId) => runSeatAction(() => api.post(`/api/bookings/${bookingId}/request-payment/`), `Payment request sent for booking #${bookingId}.`);
  const verifyCashForSeat = (bookingId) => runSeatAction(() => api.post(`/api/payments/cash/verify/${bookingId}/`), `Cash payment verified for booking #${bookingId}.`);
  const acceptPassenger = (bookingId) => runSeatAction(() => api.post(`/api/bookings/${bookingId}/accept/`), `Passenger accepted for booking #${bookingId}.`);
  const boardPassengerForSeat = (bookingId) => runSeatAction(() => api.post(`/api/bookings/${bookingId}/board/`), `Passenger boarded for booking #${bookingId}.`);
  const completeRideForSeat = (bookingId) => runSeatAction(() => api.post(`/api/bookings/${bookingId}/complete/`), `Ride ended for booking #${bookingId}.`, { closeSheet: true });
  const collectOfflineCash = (offlineBoardingId) => runSeatAction(() => api.post(`/api/bookings/offline/${offlineBoardingId}/collect-cash/`), "Cash collected for offline passenger.");
  const completeOfflineRide = (offlineBoardingId) => runSeatAction(() => api.post(`/api/bookings/offline/${offlineBoardingId}/complete/`), "Offline passenger ride completed.", { closeSheet: true });

  const seatAction = useMemo(() => {
    if (!seatSheet) return null;
    if (!activeTrip?.id) return null;
    if (seatSheet.available) return { label: "Onboard Offline Passenger", tone: "primary", onClick: () => onboardOfflinePassenger(seatSheet) };
    if (seatSheet.offline_boarding_id) {
      if (!seatSheet.payment_verified) return { label: "Mark Cash Collected", tone: "primary", onClick: () => collectOfflineCash(seatSheet.offline_boarding_id) };
      if (seatSheet.journey_stage === "dropoff") return { label: "End Passenger Ride", tone: "danger", onClick: () => completeOfflineRide(seatSheet.offline_boarding_id) };
      return null;
    }
    if (selectedBooking?.can_accept) return { label: "Accept Passenger", tone: "primary", onClick: () => acceptPassenger(seatSheet.booking_id) };
    if (selectedBooking?.can_verify_cash) return { label: "Verify Cash Payment", tone: "primary", onClick: () => verifyCashForSeat(seatSheet.booking_id) };
    if (selectedBooking?.can_request_payment) return { label: "Request Payment", tone: "primary", onClick: () => requestPaymentForSeat(seatSheet.booking_id) };
    if (selectedBooking?.can_board) return { label: "Board Passenger", tone: "primary", onClick: () => boardPassengerForSeat(seatSheet.booking_id) };
    if (selectedBooking?.can_complete || (seatSheet.payment_verified && seatSheet.journey_stage === "dropoff")) return { label: "End Passenger Ride", tone: "danger", onClick: () => completeRideForSeat(seatSheet.booking_id) };
    return null;
  }, [acceptPassenger, boardPassengerForSeat, collectOfflineCash, completeOfflineRide, completeRideForSeat, onboardOfflinePassenger, requestPaymentForSeat, seatSheet, selectedBooking?.can_accept, selectedBooking?.can_board, selectedBooking?.can_complete, selectedBooking?.can_request_payment, selectedBooking?.can_verify_cash, verifyCashForSeat]);

  const seatStatusText = seatSheet?.available
    ? activeTrip?.id ? "Vacant and ready for an offline passenger" : "Vacant seat. Helper actions unlock after the trip goes fully live."
    : seatSheet?.offline_boarding_id
      ? seatSheet.payment_verified ? "Offline passenger onboard with cash collected" : "Offline passenger onboard with cash pending"
      : seatSheet?.payment_verified
        ? seatSheet.journey_stage === "dropoff" ? "Passenger is onboard and ready for drop completion" : "Passenger payment is complete"
        : "Passenger payment is still pending";
  const handleLogout = () => {
    clearToken();
    setUser(null);
    navigate("/auth/login", { replace: true });
  };

  if (loading) {
    return (
      <div style={theme} className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--text)]">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
          <p className="mt-4 text-sm font-medium text-[var(--muted)]">Loading helper workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={theme} className="min-h-screen bg-[radial-gradient(circle_at_top,#fff5eb_0%,var(--bg)_42%,var(--bg-soft)_100%)] text-[var(--text)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top_right,rgba(255,150,45,0.18),transparent_48%),radial-gradient(circle_at_top_left,rgba(75,38,102,0.18),transparent_42%)]" />

      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--header)] backdrop-blur-xl">
        <div className={`${shell} flex items-center justify-between px-4 py-4 sm:px-5`}>
          <div className="flex min-w-0 items-center gap-3">
            <LogoMark />
            <div className="min-w-0">
              <p className="text-lg font-black leading-none text-[var(--primary)]">MetroBus</p>
              <p className="mt-1 text-[0.72rem] font-black uppercase tracking-[0.22em] text-[var(--muted)]">Helper Home</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleLogout} className="rounded-full border border-[rgba(219,61,79,0.18)] bg-[rgba(219,61,79,0.10)] px-4 py-2 text-[0.7rem] font-black uppercase tracking-[0.16em] text-[var(--danger)] shadow-[var(--shadow)]">Logout</button>
            <button type="button" className="grid h-12 w-12 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-strong)] text-sm font-black text-[var(--primary)] shadow-[var(--shadow)]" aria-label="Helper account">{initials(user?.full_name)}</button>
          </div>
        </div>
      </header>

      <main className={`${shell} relative px-4 pb-32 pt-4 sm:px-5 sm:pt-5`}>
        {err ? <div className="mb-4 rounded-[1.25rem] border border-[rgba(219,61,79,0.18)] bg-[rgba(219,61,79,0.10)] px-4 py-3 text-sm font-semibold text-[var(--danger)]">{err}</div> : null}
        {msg ? <div className="mb-4 rounded-[1.25rem] border border-[rgba(23,165,103,0.16)] bg-[rgba(23,165,103,0.10)] px-4 py-3 text-sm font-semibold text-[var(--success)]">{msg}</div> : null}

        {tab === "riders" ? (
          <SurfaceCard className="overflow-hidden">
            <div className="border-b border-[var(--border)] px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[0.72rem] font-black uppercase tracking-[0.24em] text-[var(--primary)]">Passenger OTP</p>
                  <h2 className="mt-3 text-[2rem] font-black leading-tight text-[var(--text)]">Load ride details with the passenger OTP</h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Enter the 4-digit ride OTP, load the ticket, then either onboard the passenger directly or onboard and trigger the payment prompt on the passenger dashboard.</p>
                </div>
                <StatusPill tone={activeTrip ? "live" : "waiting"}>{activeTrip ? "Trip Live" : "Start Trip First"}</StatusPill>
              </div>
            </div>

            {!activeTrip ? (
              <div className="px-5 py-6">
                <div className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-5 text-sm font-semibold leading-7 text-[var(--muted)]">
                  The helper OTP page becomes active once the ride is started from Home.
                </div>
              </div>
            ) : (
              <>
                <div className="border-b border-[var(--border)] px-5 py-5">
                  <label className="mb-3 block text-[0.68rem] font-black uppercase tracking-[0.22em] text-[var(--primary)]">Passenger Ride OTP</label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={otpCode}
                      onChange={(event) => setOtpCode(sanitizeOtp(event.target.value))}
                      placeholder="0000"
                      className="min-w-0 flex-1 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-4 text-[1.25rem] font-black tracking-[0.4em] text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                    />
                    <ActionButton onClick={loadOtpBookingDetails} disabled={otpBusy} className="sm:min-w-[12rem]">
                      <Icon name="shield" className="h-4 w-4" />
                      {otpBusy ? "Loading..." : "Load Details"}
                    </ActionButton>
                  </div>
                </div>

                {otpLoadedBooking ? (
                  <div className="px-5 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-[var(--primary)]">Passenger Ride</p>
                        <h3 className="mt-3 text-[1.85rem] font-black leading-tight text-[var(--text)]">{otpLoadedBooking.passenger_name || "Passenger"}</h3>
                        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{helperJourneyLabel(otpLoadedBooking)}</p>
                      </div>
                      <StatusPill tone={otpPayment.tone}>{otpPayment.label}</StatusPill>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.3rem] bg-[var(--accent-soft)] px-4 py-4">
                        <p className="text-[0.64rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Route</p>
                        <p className="mt-2 text-lg font-black leading-7 text-[var(--text)]">{otpLoadedBooking.pickup_stop_name} to {otpLoadedBooking.destination_stop_name}</p>
                      </div>
                      <div className="rounded-[1.3rem] bg-[var(--accent-soft)] px-4 py-4">
                        <p className="text-[0.64rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Seat</p>
                        <p className="mt-2 text-lg font-black leading-7 text-[var(--text)]">{(otpLoadedBooking.seat_labels || []).join(", ") || "--"}</p>
                      </div>
                      <div className="rounded-[1.3rem] bg-[var(--accent-soft)] px-4 py-4">
                        <p className="text-[0.64rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Phone</p>
                        <p className="mt-2 text-lg font-black leading-7 text-[var(--text)]">{otpLoadedBooking.passenger_phone || "--"}</p>
                      </div>
                      <div className="rounded-[1.3rem] bg-[var(--accent-soft)] px-4 py-4">
                        <p className="text-[0.64rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Fare</p>
                        <p className="mt-2 text-lg font-black leading-7 text-[var(--text)]">Rs {Number(otpLoadedBooking.fare_total || 0).toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[1.3rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm leading-6 text-[var(--muted)]">
                      OTP {String(otpLoadedBooking.boarding_otp || "").padStart(4, "0").slice(-4)} | Bus {otpLoadedBooking.bus_plate || activeTrip?.bus_plate || "--"} | Payment {otpPayment.label}
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <ActionButton
                        onClick={() => runOtpBoardingAction(false)}
                        disabled={otpBusy || Boolean(otpLoadedBooking.completed_at || otpLoadedBooking.checked_in_at)}
                        className="w-full"
                      >
                        <Icon name="ticket" className="h-4 w-4" />
                        {otpBusy ? "Saving..." : "Onboard Passenger"}
                      </ActionButton>
                      <ActionButton
                        onClick={() => runOtpBoardingAction(true)}
                        disabled={otpBusy || Boolean(otpLoadedBooking.completed_at || otpLoadedBooking.payment_status === "SUCCESS")}
                        tone="secondary"
                        className="w-full"
                      >
                        <Icon name="money" className="h-4 w-4" />
                        {otpBusy ? "Saving..." : otpLoadedBooking.checked_in_at ? "Request Payment" : "Onboard & Request Payment"}
                      </ActionButton>
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-6">
                    <div className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-5 text-sm font-semibold leading-7 text-[var(--muted)]">
                      Load a passenger OTP to review the seat, fare, route, and payment state before you onboard them.
                    </div>
                  </div>
                )}
              </>
            )}
          </SurfaceCard>
        ) : null}

        {tab === "payments" || tab === "account" ? <PlaceholderPanel tabLabel={TABS.find((item) => item.id === tab)?.label || "Helper"} /> : null}

        {tab === "home" ? (
          <SurfaceCard className="overflow-hidden">
            {!activeTrip ? (
              <div className="px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[0.72rem] font-black uppercase tracking-[0.24em] text-[var(--primary)]">Ride Control</p>
                  <StatusPill tone={pendingTrip ? "waiting" : selectedSchedule?.driver_assignment_accepted ? "default" : "danger"}>{homeStatus}</StatusPill>
                </div>
                <div className="mt-4 grid gap-3">
                  {(pendingTrip || selectedSchedule?.driver_assignment_accepted) ? <ActionButton onClick={pendingTrip ? confirmPendingStart : requestScheduledStart} disabled={busy || (pendingTrip ? pendingTrip.helper_start_confirmed : false)} className="w-full"><Icon name="play" className="h-4 w-4" />{busy ? "Sending..." : startLabel}</ActionButton> : null}
                </div>
              </div>
            ) : null}

            {showSeatLayout ? (
              <div className={`${!activeTrip ? "border-t border-[var(--border)]" : ""}`}>
                <div className="border-b border-[var(--border)] px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[0.72rem] font-black uppercase tracking-[0.24em] text-[var(--primary)]">Seat Layout</p>
                      <h2 className="mt-2 break-words text-[1.6rem] font-black leading-tight">{trip?.route_name || selectedSchedule?.route_name || "Helper seat layout"}</h2>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">The main seat screen shows occupancy and payment status directly. Tap any seat to open its helper action window.</p>
                    </div>
                    <StatusPill tone={activeTrip ? "live" : pendingTrip ? "waiting" : "default"}>{activeTrip ? "Ride Live" : pendingTrip ? "Start Pending" : "Standby"}</StatusPill>
                  </div>
                </div>

                <div className="border-b border-[var(--border)] px-5 py-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[1.2rem] bg-[var(--accent-soft)] px-4 py-4"><p className="text-[0.66rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Available</p><p className="mt-2 text-2xl font-black">{availableSeats}</p></div>
                    <div className="rounded-[1.2rem] bg-[var(--accent-soft)] px-4 py-4"><p className="text-[0.66rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Occupied</p><p className="mt-2 text-2xl font-black">{occupiedSeats}</p></div>
                    <div className="rounded-[1.2rem] bg-[var(--accent-soft)] px-4 py-4"><p className="text-[0.66rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Paid / Collected</p><p className="mt-2 text-2xl font-black">{paidSeats}</p></div>
                  </div>
                </div>

                <div className="border-b border-[var(--border)] px-5 py-4">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-[var(--primary)]">Current Segment</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">This segment is used when you onboard an offline passenger from the seat popup.</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <SelectField label="From" value={fromOrder} onChange={setFromOrder} options={stopOptions.length ? stopOptions : [{ value: "", label: "No stops" }]} disabled={!stopOptions.length || !trip} />
                    <SelectField label="To" value={toOrder} onChange={setToOrder} options={stopOptions.length ? stopOptions : [{ value: "", label: "No stops" }]} disabled={!stopOptions.length || !trip} />
                  </div>
                </div>

                <div className="px-5 py-5">
                  <MetroSeatBoard
                    title="Seat Layout"
                    routeName={trip?.route_name || selectedSchedule?.route_name || "Helper seat layout"}
                    busLabel={trip?.bus_plate || selectedSchedule?.bus_plate || "--"}
                    seats={seats}
                    mode="helper"
                    activeSeatId={seatSheet?.seat_id}
                    onSeatClick={setSeatSheet}
                    loading={loadingSeats}
                    loadingMessage="Loading helper seat layout..."
                    emptyMessage="No seats were found for this ride segment."
                  />
                </div>
              </div>
            ) : null}

            {showSeatLayout ? (
              <div className="border-t border-[var(--border)] px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[0.72rem] font-black uppercase tracking-[0.24em] text-[var(--primary)]">Trip Finish</p>
                  <StatusPill tone={activeTrip.driver_end_confirmed ? "waiting" : "default"}>{activeTrip.driver_end_confirmed ? "Confirm End" : "Trip Control"}</StatusPill>
                </div>
                <ActionButton onClick={requestTripEnd} disabled={busy || activeTrip.helper_end_confirmed} tone="danger" className="mt-4 w-full"><Icon name="stop" className="h-4 w-4" />{busy ? "Sending..." : endLabel}</ActionButton>
              </div>
            ) : null}
          </SurfaceCard>
        ) : null}
      </main>

      {seatSheet ? (
        <div className="fixed inset-0 z-50">
          <button type="button" className="absolute inset-0 bg-[rgba(15,8,21,0.38)] backdrop-blur-[1px]" onClick={() => setSeatSheet(null)} aria-label="Close seat details" />
          <div className="absolute inset-x-0 bottom-0 px-3 pb-[calc(0.7rem+env(safe-area-inset-bottom))]">
            <div className={`${shell} rounded-[1.9rem] border border-[var(--border)] bg-[var(--surface-strong)] p-5 shadow-[var(--shadow-strong)]`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-[var(--primary)]">Seat Details</p>
                  <h3 className="mt-2 text-[2rem] font-black leading-none text-[var(--text)]">Seat {seatSheet.seat_no}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{seatStatusText}</p>
                </div>
                <button type="button" onClick={() => setSeatSheet(null)} className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-lg font-black text-[var(--muted)]">X</button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.3rem] bg-[var(--accent-soft)] px-4 py-4"><p className="text-[0.64rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Passenger</p><p className="mt-2 break-words text-lg font-black">{seatSheet.available ? "No passenger yet" : seatSheet.offline_boarding_id ? "Offline passenger" : selectedBooking?.passenger_name || "Passenger seat"}</p></div>
                <div className="rounded-[1.3rem] bg-[var(--accent-soft)] px-4 py-4"><p className="text-[0.64rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Phone</p><p className="mt-2 break-words text-lg font-black">{selectedBooking?.passenger_phone || "--"}</p></div>
                <div className="rounded-[1.3rem] bg-[var(--accent-soft)] px-4 py-4"><p className="text-[0.64rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Ride</p><p className="mt-2 break-words text-lg font-black">{seatSheet.available ? `${selectedFromName} to ${selectedToName}` : seatSheet.offline_boarding_id ? `${selectedFromName} to ${selectedToName}` : `${selectedBooking?.pickup_stop_name || "--"} to ${selectedBooking?.destination_stop_name || "--"}`}</p></div>
                <div className="rounded-[1.3rem] bg-[var(--accent-soft)] px-4 py-4"><p className="text-[0.64rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Payment</p><p className="mt-2 break-words text-lg font-black">{seatSheet.available ? "Not assigned" : seatSheet.offline_boarding_id ? (seatSheet.payment_verified ? "Cash collected" : "Cash pending") : seatSheet.payment_verified ? "Paid" : "Unpaid"}</p></div>
              </div>

              {selectedBooking && !seatSheet.offline_boarding_id ? <div className="mt-4 rounded-[1.3rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm leading-6 text-[var(--muted)]">Booking #{selectedBooking.id} | OTP {selectedBooking.boarding_otp || "--"} | Seats {(selectedBooking.seat_labels || []).join(", ") || "--"}</div> : null}

              {seatAction ? (
                <ActionButton onClick={seatAction.onClick} tone={seatAction.tone} disabled={seatBusy} className="mt-5 w-full">
                  <Icon name={seatAction.tone === "danger" ? "stop" : seatAction.label.includes("Payment") || seatAction.label.includes("Cash") ? "money" : seatAction.label.includes("Accept") ? "shield" : seatAction.label.includes("Board") ? "ticket" : "play"} className="h-4 w-4" />
                  {seatBusy ? "Saving..." : seatAction.label}
                </ActionButton>
              ) : <div className="mt-5 rounded-[1.3rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm font-semibold leading-6 text-[var(--muted)]">No immediate action is needed for this seat right now.</div>}
            </div>
          </div>
        </div>
      ) : null}

      <footer className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.55rem+env(safe-area-inset-bottom))] pt-2">
        <div className={`${shell} rounded-[1.45rem] border border-[var(--border)] bg-[var(--footer)] p-1.5 shadow-[var(--shadow)] backdrop-blur-xl`}>
          <div className="grid grid-cols-4 gap-1.5">
            {TABS.map((item) => {
              const active = tab === item.id;
              return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex flex-col items-center gap-1 rounded-[1rem] px-2 py-2.5 text-center transition ${active ? "bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-white shadow-[var(--shadow-strong)]" : "text-[var(--muted)]"}`}><Icon name={item.icon} className="h-4 w-4" /><span className="text-[0.6rem] font-black uppercase tracking-[0.12em]">{item.label}</span></button>;
            })}
          </div>
        </div>
      </footer>
    </div>
  );
}
