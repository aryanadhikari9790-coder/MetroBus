import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { api } from "../../api";
import { clearToken } from "../../auth";
import { useTheme } from "../../ThemeContext";
import { buildWsUrl } from "../../lib/ws";

const LIGHT_THEME = {
  "--hlp-bg": "#fbf3f6",
  "--hlp-bg-end": "rgba(245,235,242,0.98)",
  "--hlp-surface": "rgba(255,255,255,0.92)",
  "--hlp-soft": "#fbebf0",
  "--hlp-border": "rgba(52,21,93,0.08)",
  "--hlp-text": "#27133f",
  "--hlp-muted": "#7d6b93",
  "--hlp-purple": "#34155d",
  "--hlp-purple-2": "#ff6b73",
  "--hlp-plum": "#2e124f",
  "--hlp-header": "rgba(252,245,248,0.92)",
  "--hlp-nav": "rgba(252,245,248,0.94)",
  "--hlp-shadow": "0 12px 28px rgba(46,18,79,0.08)",
  "--hlp-shadow-strong": "0 14px 30px rgba(255,107,115,0.16)",
};

const DARK_THEME = {
  "--hlp-bg": "#241043",
  "--hlp-bg-end": "rgba(36,16,67,0.98)",
  "--hlp-surface": "rgba(57,27,92,0.9)",
  "--hlp-soft": "rgba(255,107,115,0.12)",
  "--hlp-border": "rgba(202,161,233,0.14)",
  "--hlp-text": "#fff7f5",
  "--hlp-muted": "#d3c3e2",
  "--hlp-purple": "#ff8a77",
  "--hlp-purple-2": "#ff9a5c",
  "--hlp-plum": "#2e124f",
  "--hlp-header": "rgba(36,16,67,0.92)",
  "--hlp-nav": "rgba(43,20,78,0.94)",
  "--hlp-shadow": "0 14px 30px rgba(0,0,0,0.2)",
  "--hlp-shadow-strong": "0 16px 32px rgba(255,107,115,0.18)",
};

const TABS = [
  { id: "trip", label: "Trip", icon: "bus" },
  { id: "boarding", label: "Boarding", icon: "ticket" },
  { id: "verify", label: "Verify", icon: "shield" },
  { id: "route", label: "Route", icon: "map" },
];

const APP_SHELL_CLASS = "enterprise-mobile-shell";

function Icon({ name, className = "h-5 w-5" }) {
  const common = { className, fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24" };
  switch (name) {
    case "refresh": return <svg {...common}><path d="M20 11a8 8 0 1 1-2.35-5.66" /><path d="M20 4v5h-5" /></svg>;
    case "sun": return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.9 4.9 1.4 1.4" /><path d="m17.7 17.7 1.4 1.4" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m4.9 19.1 1.4-1.4" /><path d="m17.7 6.3 1.4-1.4" /></svg>;
    case "moon": return <svg {...common}><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.8 6.8 0 0 0 21 12.8Z" /></svg>;
    case "logout": return <svg {...common}><path d="M15 17 20 12 15 7" /><path d="M20 12H9" /><path d="M12 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" /></svg>;
    case "profile": return <svg {...common}><circle cx="12" cy="8" r="3.2" /><path d="M5 19a7 7 0 0 1 14 0" /></svg>;
    case "bus": return <svg {...common}><rect x="5" y="5" width="14" height="11" rx="3" /><path d="M7.5 16v3" /><path d="M16.5 16v3" /><path d="M7 10h10" /></svg>;
    case "money": return <svg {...common}><path d="M4 7h16v10H4z" /><path d="M8 12h8" /><path d="M9 9v6" /><path d="M15 9v6" /></svg>;
    case "shield": return <svg {...common}><path d="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6l-7-3Z" /><path d="m9.5 12 1.7 1.7 3.3-3.7" /></svg>;
    case "ticket": return <svg {...common}><path d="M5 9a2 2 0 0 0 0 6v3h14v-3a2 2 0 0 0 0-6V6H5v3Z" /><path d="M12 6v12" /></svg>;
    case "map": return <svg {...common}><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z" /><path d="M9 4v14" /><path d="M15 6v14" /></svg>;
    case "swap": return <svg {...common}><path d="M7 7h11" /><path d="m14 4 4 3-4 3" /><path d="M17 17H6" /><path d="m10 14-4 3 4 3" /></svg>;
    case "broadcast": return <svg {...common}><path d="M4 12a8 8 0 0 1 8-8" /><path d="M4 12a8 8 0 0 0 8 8" /><path d="M12 6a6 6 0 0 1 6 6" /><path d="M12 18a6 6 0 0 0 6-6" /><circle cx="12" cy="12" r="1.5" /></svg>;
    case "headset": return <svg {...common}><path d="M4 12a8 8 0 0 1 16 0" /><rect x="4" y="12" width="3" height="6" rx="1.5" /><rect x="17" y="12" width="3" height="6" rx="1.5" /><path d="M7 18a5 5 0 0 0 5 3h2" /></svg>;
    case "pin": return <svg {...common}><path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z" /><circle cx="12" cy="10" r="2.3" /></svg>;
    case "clock": return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></svg>;
    case "alert": return <svg {...common}><path d="M12 4 3.5 18h17L12 4Z" /><path d="M12 9v4" /><path d="M12 16h.01" /></svg>;
    case "thermo": return <svg {...common}><path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z" /><path d="M12 11v5" /></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>;
  }
}

function SurfaceCard({ children, className = "" }) {
  return <div className={`rounded-[1.35rem] border border-[var(--hlp-border)] bg-[var(--hlp-surface)] p-4 shadow-[var(--hlp-shadow)] backdrop-blur-xl sm:rounded-[1.5rem] sm:p-5 ${className}`}>{children}</div>;
}

function HeaderButton({ children, className = "", ...props }) {
  return <button type="button" className={`grid h-10 w-10 place-items-center rounded-full border border-[var(--hlp-border)] bg-white/75 text-[var(--hlp-purple)] shadow-[var(--hlp-shadow)] sm:h-11 sm:w-11 ${className}`} {...props}>{children}</button>;
}

function Chip({ children, tone = "soft", className = "" }) {
  const tones = {
    soft: "bg-[var(--hlp-soft)] text-[var(--hlp-purple)]",
    live: "bg-[rgba(16,185,129,0.12)] text-emerald-600",
    warn: "bg-[rgba(245,158,11,0.14)] text-amber-600",
    dark: "bg-[var(--hlp-plum)] text-white",
  };
  return <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.18em] ${tones[tone] || tones.soft} ${className}`}>{children}</span>;
}

function PrimaryButton({ children, tone = "primary", className = "", ...props }) {
  const tones = {
    primary: "bg-[linear-gradient(135deg,var(--hlp-purple),var(--hlp-purple-2))] text-white shadow-[var(--hlp-shadow-strong)]",
    danger: "bg-[var(--hlp-plum)] text-white shadow-[0_18px_40px_rgba(71,39,81,0.24)]",
    ghost: "border border-[var(--hlp-border)] bg-white/82 text-[var(--hlp-text)]",
  };
  return <button type="button" className={`inline-flex items-center justify-center gap-2 rounded-[0.95rem] px-4 py-3 text-sm font-bold tracking-[0.04em] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 ${tones[tone] || tones.primary} ${className}`} {...props}>{children}</button>;
}

function SectionLabel({ children }) {
  return <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-[var(--hlp-purple)]">{children}</p>;
}

function StatCard({ label, value, note, icon }) {
  return (
    <SurfaceCard className="min-h-[9.5rem]">
      <div className="text-[var(--hlp-purple)]"><Icon name={icon} /></div>
      <p className="mt-8 text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--hlp-muted)]">{label}</p>
      <p className="mt-2 text-[2rem] font-black leading-none text-[var(--hlp-text)]">{value}</p>
      <p className="mt-2 text-xs text-[var(--hlp-muted)]">{note}</p>
    </SurfaceCard>
  );
}

function SelectField({ label, value, onChange, options, disabled = false }) {
  return (
    <div>
      <label className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.24em] text-[var(--hlp-muted)]">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="w-full rounded-[1.4rem] border border-[var(--hlp-border)] bg-[var(--hlp-soft)] px-4 py-4 text-sm font-semibold text-[var(--hlp-text)] outline-none transition focus:border-[var(--hlp-purple)] disabled:opacity-60">
        {options.map((option) => <option key={`${option.value}-${option.label}`} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

function SeatNode({ seat, selected, onClick }) {
  let className = "border-[var(--hlp-border)] bg-white text-[var(--hlp-text)]";
  let stateLabel = "Open";
  if (!seat.available) {
    className = "border-transparent bg-[rgba(233,198,244,0.8)] text-[var(--hlp-muted)]";
    stateLabel = "Taken";
  } else if (selected) {
    className = "border-transparent bg-[linear-gradient(135deg,var(--hlp-purple),var(--hlp-purple-2))] text-white shadow-[var(--hlp-shadow-strong)]";
    stateLabel = "Marked";
  }
  return (
    <button type="button" disabled={!seat.available} onClick={onClick} className={`flex aspect-square min-h-[4.2rem] flex-col items-center justify-center rounded-[1.55rem] border text-center transition ${className} disabled:cursor-not-allowed`}>
      <span className="text-base font-black">{seat.seat_no}</span>
      <span className="mt-1 text-[0.54rem] font-black uppercase tracking-[0.18em] opacity-75">{stateLabel}</span>
    </button>
  );
}

function MapViewport({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(points, { padding: [24, 24] });
  }, [map, points]);
  return null;
}

function formatTime(value) {
  if (!value) return "--";
  try {
    return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return value;
  }
}

function distanceBetween(a, b) {
  if (!a || !b) return Infinity;
  return Math.sqrt((Number(a[0]) - Number(b[0])) ** 2 + (Number(a[1]) - Number(b[1])) ** 2);
}

export default function HelperHome() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const theme = useMemo(() => (isDark ? DARK_THEME : LIGHT_THEME), [isDark]);

  const [dashboard, setDashboard] = useState(null);
  const [tripId, setTripId] = useState("");
  const [routeStops, setRouteStops] = useState([]);
  const [latestLocation, setLatestLocation] = useState(null);
  const [assignedBus, setAssignedBus] = useState(null);
  const [fromOrder, setFromOrder] = useState("");
  const [toOrder, setToOrder] = useState("");
  const [seats, setSeats] = useState([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [offlineBusy, setOfflineBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyBookingId, setVerifyBookingId] = useState("");
  const [ticketLookup, setTicketLookup] = useState(null);
  const [scanLogItems, setScanLogItems] = useState([]);
  const [bookingSocketState, setBookingSocketState] = useState("disconnected");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [activeTab, setActiveTab] = useState("trip");
  const bookingSocketRef = useRef(null);
  const ticketLookupRef = useRef(null);

  const activeTrip = dashboard?.active_trip ?? null;
  const pendingTrip = dashboard?.pending_trip ?? null;
  const schedules = dashboard?.schedules ?? [];
  const helperBookingGroups = dashboard?.helper_bookings ?? {};
  const trips = useMemo(() => (activeTrip ? [activeTrip] : []), [activeTrip]);
  const selectedTrip = useMemo(() => trips.find((trip) => String(trip.id) === String(tripId)) || activeTrip || null, [trips, tripId, activeTrip]);
  const currentTrip = selectedTrip || pendingTrip || null;
  const tripAwaitingStart = Boolean(pendingTrip && !activeTrip);
  const contextTripId = activeTrip?.id || pendingTrip?.id || "";
  const availableSeats = seats.filter((seat) => seat.available);
  const occupiedCount = seats.length - availableSeats.length;
  const selectedCount = selectedSeatIds.length;
  const fromStop = routeStops.find((stop) => String(stop.stop_order) === String(fromOrder)) || null;
  const toStop = routeStops.find((stop) => String(stop.stop_order) === String(toOrder)) || null;
  const selectedSeatLabels = seats.filter((seat) => selectedSeatIds.includes(seat.seat_id)).map((seat) => seat.seat_no);
  const stopOptions = routeStops.map((stop) => ({ value: String(stop.stop_order), label: `${stop.stop_order}. ${stop.stop?.name || "--"}` }));
  const terminalChips = routeStops.length
    ? routeStops.slice(0, 3).map((stop) => ({ label: stop.stop?.name || `Stop ${stop.stop_order}`, value: String(stop.stop_order) }))
    : [{ label: "Main Terminal", value: "" }, { label: "Midtown Hub", value: "" }, { label: "Lakeside", value: "" }];
  const mapPolyline = useMemo(() => routeStops.map((stop) => [Number(stop.stop?.lat), Number(stop.stop?.lng)]).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)), [routeStops]);
  const livePoint = useMemo(() => {
    if (!latestLocation) return null;
    const lat = Number(latestLocation.lat);
    const lng = Number(latestLocation.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }, [latestLocation]);
  const mapPoints = useMemo(() => {
    const points = [...mapPolyline];
    if (livePoint) points.push(livePoint);
    return points;
  }, [mapPolyline, livePoint]);
  const currentStopIndex = useMemo(() => {
    if (!livePoint || !mapPolyline.length) return 0;
    let bestIndex = 0;
    let bestDistance = Infinity;
    mapPolyline.forEach((point, index) => {
      const distance = distanceBetween(point, livePoint);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    return bestIndex;
  }, [livePoint, mapPolyline]);
  const upcomingStop = routeStops[Math.min(currentStopIndex + 1, routeStops.length - 1)] || null;
  const nextSchedule = schedules[0] ?? null;
  const routeTitle = currentTrip?.route_name || nextSchedule?.route_name || "Route 42A";
  const routeDestination = routeStops[routeStops.length - 1]?.stop?.name || "Lakeside";
  const routeCondition = livePoint ? "Live movement on route" : tripAwaitingStart ? "Waiting for both start confirmations" : "Waiting for GPS ping";
  const verifyPreview = ticketLookup?.payment || { method: "Cash", status: "Pending", amount: 450 };
  const helperTripHeroTitle = currentTrip?.route_name || nextSchedule?.route_name || "Route 42A: Downtown Express";
  const vehicleCapacity = assignedBus?.capacity || seats.length || 32;
  const occupancyPercent = vehicleCapacity ? Math.round((occupiedCount / vehicleCapacity) * 100) : 56;
  const helperDashboardMarked = selectedCount || 2;
  const tripStarted = formatTime(activeTrip?.started_at || nextSchedule?.scheduled_start_time) || "08:30 AM";
  const assignedDriverName = currentTrip?.driver_name || nextSchedule?.driver_name || "Robert Fox";
  const driverBadgeId = currentTrip?.id ? `ID-MB-${currentTrip.id}` : "ID-MB-782";
  const helperHeaderStatus = activeTrip ? "Trip Live" : pendingTrip ? "Start Pending" : schedules.length ? "Standby" : "Standby";
  const pendingStartLabel = pendingTrip?.driver_start_confirmed
    ? "Driver confirmed. Your helper confirmation will make this trip LIVE."
    : pendingTrip?.helper_start_confirmed
      ? "You already confirmed. Waiting for the driver."
      : "This trip is waiting for both staff confirmations.";
  const pendingEndLabel = activeTrip?.driver_end_confirmed
    ? "Driver confirmed the trip end. Your confirmation will complete it."
    : activeTrip?.helper_end_confirmed
      ? "You already confirmed the trip end. Waiting for the driver."
      : "No end request has been sent yet.";
  const needsAcceptanceBookings = helperBookingGroups.needs_acceptance ?? [];
  const awaitingPaymentBookings = helperBookingGroups.awaiting_payment ?? [];
  const readyToBoardBookings = helperBookingGroups.ready_to_board ?? [];
  const onboardBookings = helperBookingGroups.onboard ?? [];
  const completedRecentBookings = helperBookingGroups.completed_recent ?? [];
  const helperBookingSummary = helperBookingGroups.summary ?? {};

  const pushScanLog = useCallback((text) => {
    setScanLogItems((current) => {
      const entry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        text,
      };
      return [entry, ...current].slice(0, 8);
    });
  }, []);

  useEffect(() => {
    ticketLookupRef.current = ticketLookup;
  }, [ticketLookup]);

  const loadDashboard = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoadingTrips(true);
    try {
      const response = await api.get("/api/trips/helper/dashboard/");
      setDashboard(response.data);
      setLatestLocation(response.data.latest_location || null);
      setErr("");
      setTripId((current) => {
        const liveTripId = response.data.active_trip?.id ? String(response.data.active_trip.id) : "";
        if (!liveTripId) return "";
        if (!current) return liveTripId;
        if (current !== liveTripId) {
          return liveTripId;
        }
        return current;
      });
    } catch (error) {
      setErr(error?.response?.data?.detail || "Unable to load helper dashboard.");
    } finally {
      if (!silent) setLoadingTrips(false);
    }
  }, []);

  const loadAssignedBus = useCallback(async () => {
    try {
      const response = await api.get("/api/transport/my-bus/");
      setAssignedBus(response.data.bus || null);
    } catch {
      // Optional helper assignment.
    }
  }, []);

  const loadTripContext = useCallback(async (id) => {
    if (!id) {
      setRouteStops([]);
      setLatestLocation(null);
      return;
    }
    try {
      const [detailResponse, locationResponse] = await Promise.all([
        api.get(`/api/trips/${id}/`),
        api.get(`/api/trips/${id}/location/latest/`).catch(() => null),
      ]);
      setRouteStops(detailResponse.data.route_stops || []);
      setLatestLocation(locationResponse?.data || null);
      setErr("");
    } catch (error) {
      setErr(error?.response?.data?.detail || "Unable to load trip context.");
      setRouteStops([]);
      setLatestLocation(null);
    }
  }, []);

  const loadAvailability = useCallback(async (tid, from, to) => {
    if (!tid || !from || !to) {
      setSeats([]);
      setSelectedSeatIds([]);
      return;
    }
    setLoadingAvail(true);
    try {
      const response = await api.get(`/api/bookings/trips/${tid}/availability/?from=${from}&to=${to}`);
      setSeats(response.data.seats || []);
      setSelectedSeatIds([]);
      setErr("");
    } catch (error) {
      setErr(error?.response?.data?.detail || "Unable to load availability.");
      setSeats([]);
      setSelectedSeatIds([]);
    } finally {
      setLoadingAvail(false);
    }
  }, []);

  const refreshBookingDetail = useCallback(async (bookingId, { silent = true } = {}) => {
    if (!bookingId) return null;
    if (!silent) {
      setVerifyBusy(true);
      setErr("");
      setMsg("");
    }
    try {
      const response = await api.get(`/api/bookings/${bookingId}/`);
      setTicketLookup(response.data.booking);
      return response.data.booking;
    } catch (error) {
      if (!silent) setErr(error?.response?.data?.detail || "Booking refresh failed.");
      return null;
    } finally {
      if (!silent) setVerifyBusy(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    loadAssignedBus();
    const intervalId = setInterval(() => loadDashboard({ silent: true }), 3000);
    return () => clearInterval(intervalId);
  }, [loadDashboard, loadAssignedBus]);

  useEffect(() => {
    let subscribed = true;
    let reconnectTimer = null;

    const connect = () => {
      setBookingSocketState("connecting");
      const socket = new WebSocket(buildWsUrl("/ws/bookings/stream/"));
      bookingSocketRef.current = socket;

      socket.onopen = () => {
        setBookingSocketState("connected");
        pushScanLog("Booking socket connected.");
      };

      socket.onerror = () => {
        pushScanLog("Booking socket error detected.");
      };

      socket.onmessage = async (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "SOCKET_CONNECTED") {
            pushScanLog("Real-time booking channel is ready.");
            return;
          }
          pushScanLog(`Realtime event: ${payload.type} for booking #${payload.booking_id}.`);
          await loadDashboard({ silent: true });
          if (payload.booking_id && ticketLookupRef.current?.id === payload.booking_id) {
            const updated = await refreshBookingDetail(payload.booking_id, { silent: true });
            if (updated && payload.type === "PAYMENT_CONFIRMED") {
              setMsg(`Payment confirmed for ${updated.passenger_name}.`);
            }
          }
        } catch {
          pushScanLog("Received an unreadable realtime booking message.");
        }
      };

      socket.onclose = () => {
        setBookingSocketState("disconnected");
        if (subscribed) {
          pushScanLog("Booking socket disconnected. Reconnecting...");
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    };

    connect();
    return () => {
      subscribed = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (bookingSocketRef.current) bookingSocketRef.current.close();
    };
  }, [loadDashboard, pushScanLog, refreshBookingDetail]);

  useEffect(() => {
    loadTripContext(contextTripId);
    if (!contextTripId) return undefined;
    const intervalId = setInterval(() => loadTripContext(contextTripId), 15000);
    return () => clearInterval(intervalId);
  }, [contextTripId, loadTripContext]);

  useEffect(() => {
    if (routeStops.length < 2) {
      setFromOrder("");
      setToOrder("");
      return;
    }
    setFromOrder((current) => current || String(routeStops[0].stop_order));
    setToOrder((current) => current || String(routeStops[1].stop_order));
  }, [routeStops]);

  useEffect(() => {
    if (!fromOrder || !toOrder) return;
    if (Number(toOrder) <= Number(fromOrder)) {
      const nextStopCandidate = routeStops.find((stop) => Number(stop.stop_order) > Number(fromOrder));
      setToOrder(nextStopCandidate ? String(nextStopCandidate.stop_order) : "");
      return;
    }
    loadAvailability(tripId, fromOrder, toOrder);
  }, [tripId, fromOrder, toOrder, routeStops, loadAvailability]);

  const toggleSeat = (seatId) => {
    setSelectedSeatIds((current) => (
      current.includes(seatId) ? current.filter((item) => item !== seatId) : [...current, seatId]
    ));
  };

  const submitOffline = async () => {
    if (!tripId || !fromOrder || !toOrder || !selectedSeatIds.length) {
      setErr("Choose trip, segment, and at least one seat.");
      return;
    }
    setOfflineBusy(true);
    setErr("");
    setMsg("");
    try {
      const response = await api.post(`/api/bookings/trips/${tripId}/offline/`, {
        from_stop_order: Number(fromOrder),
        to_stop_order: Number(toOrder),
        seat_ids: selectedSeatIds,
      });
      setMsg(`Offline boarding #${response.data.offline_boarding.id} saved.`);
      await loadAvailability(tripId, fromOrder, toOrder);
    } catch (error) {
      setErr(error?.response?.data?.detail || "Offline update failed.");
    } finally {
      setOfflineBusy(false);
    }
  };

  const runTripAction = async (requestFn, fallbackMessage) => {
    setErr("");
    setMsg("");
    try {
      const response = await requestFn();
      setMsg(response?.data?.message || fallbackMessage);
      await loadDashboard({ silent: true });
      return response;
    } catch (error) {
      setErr(error?.response?.data?.detail || "Trip action failed.");
      return null;
    }
  };

  const requestScheduledStart = async (scheduleId) => {
    const response = await runTripAction(
      () => api.post("/api/trips/start/", { schedule_id: scheduleId }),
      "Trip start confirmation sent.",
    );
    if (response?.data?.trip?.status === "LIVE") {
      setTripId(String(response.data.trip.id));
      setActiveTab("boarding");
    } else {
      setActiveTab("trip");
    }
  };

  const confirmPendingStart = async () => {
    if (!pendingTrip?.schedule_id) {
      setErr("There is no pending scheduled trip to confirm.");
      return;
    }
    const response = await runTripAction(
      () => api.post("/api/trips/start/", { schedule_id: pendingTrip.schedule_id }),
      "Trip start confirmation sent.",
    );
    if (response?.data?.trip?.status === "LIVE") {
      setTripId(String(response.data.trip.id));
      setActiveTab("boarding");
    }
  };

  const requestTripEnd = async () => {
    if (!activeTrip?.id) {
      setErr("There is no LIVE trip to end right now.");
      return;
    }
    await runTripAction(
      () => api.post(`/api/trips/${activeTrip.id}/end/`),
      "Trip end confirmation sent.",
    );
  };

  const lookupTicket = useCallback(async (referenceOverride) => {
    const reference = String(referenceOverride ?? verifyBookingId).replace(/\D/g, "").slice(0, 4);
    if (reference.length !== 4) {
      setErr("Enter the passenger 4-digit ride OTP first.");
      return null;
    }
    setVerifyBusy(true);
    setErr("");
    setMsg("");
    pushScanLog(`Ride OTP verification requested for ${reference}.`);
    try {
      const response = await api.post("/api/bookings/otp/verify/", { reference });
      setVerifyBookingId(reference);
      setTicketLookup(response.data.booking);
      pushScanLog(`Booking #${response.data.booking.id} loaded from OTP ${reference}.`);
      setMsg(response.data.message || `Ride loaded for ${response.data.booking.passenger_name}.`);
      return response.data.booking;
    } catch (error) {
      pushScanLog(`Ride OTP verification failed: ${error?.response?.data?.detail || "unknown error"}.`);
      setErr(error?.response?.data?.detail || "Ride OTP lookup failed.");
      return null;
    } finally {
      setVerifyBusy(false);
    }
  }, [pushScanLog, verifyBookingId]);

  const verifyCash = async () => {
    const booking = ticketLookup || await lookupTicket();
    if (!booking?.id) return;
    setVerifyBusy(true);
    setErr("");
    setMsg("");
    try {
      const response = await api.post(`/api/payments/cash/verify/${booking.id}/`);
      setTicketLookup(response.data.booking);
      pushScanLog(`Cash payment confirmed for booking #${booking.id}.`);
      setMsg(response.data.message || `Payment verified for booking #${booking.id}.`);
      await loadDashboard({ silent: true });
    } catch (error) {
      setErr(error?.response?.data?.detail || "Verification failed.");
    } finally {
      setVerifyBusy(false);
    }
  };

  const requestPassengerPayment = useCallback(async () => {
    if (!ticketLookup?.id) {
      setErr("Load a ride OTP before requesting passenger payment.");
      return;
    }
    setVerifyBusy(true);
    setErr("");
    setMsg("");
    pushScanLog(`Payment request sent for booking #${ticketLookup.id}.`);
    try {
      const response = await api.post(`/api/bookings/${ticketLookup.id}/request-payment/`);
      setTicketLookup(response.data.booking);
      setMsg(response.data.message || "Payment request sent to the passenger.");
      pushScanLog(`Passenger payment request is active for booking #${response.data.booking.id}.`);
      await loadDashboard({ silent: true });
    } catch (error) {
      pushScanLog(`Payment request failed for booking #${ticketLookup.id}.`);
      setErr(error?.response?.data?.detail || "Unable to request payment.");
    } finally {
      setVerifyBusy(false);
    }
  }, [loadDashboard, pushScanLog, ticketLookup]);

  const helperPaymentActionLabel = ticketLookup?.can_accept ? "Accept & Request Payment" : "Request Payment";

  const acceptPassengerRide = async (bookingOverride) => {
    const booking = bookingOverride || ticketLookup;
    if (!booking?.id) {
      setErr("Load a ride OTP before accepting the passenger ride.");
      return;
    }
    setVerifyBusy(true);
    setErr("");
    setMsg("");
    try {
      const response = await api.post(`/api/bookings/${booking.id}/accept/`);
      setTicketLookup(response.data.booking);
      pushScanLog(`Helper accepted booking #${booking.id}.`);
      setMsg(response.data.message || "Passenger ride accepted.");
      await loadDashboard({ silent: true });
    } catch (error) {
      setErr(error?.response?.data?.detail || "Unable to accept the passenger ride.");
    } finally {
      setVerifyBusy(false);
    }
  };

  const openBookingInVerify = (booking) => {
    if (!booking) return;
    setTicketLookup(booking);
    setVerifyBookingId(String(booking.boarding_otp || "").slice(0, 4));
    setActiveTab("verify");
    setErr("");
    setMsg("");
  };

  const boardPassenger = async (bookingOverride) => {
    const booking = bookingOverride || ticketLookup;
    if (!booking?.id) {
      setErr("Load a ride OTP before boarding the passenger.");
      return;
    }
    setVerifyBusy(true);
    setErr("");
    setMsg("");
    try {
      const response = await api.post(`/api/bookings/${booking.id}/board/`);
      setTicketLookup(response.data.booking);
      pushScanLog(`Passenger boarded on booking #${booking.id}.`);
      setMsg(response.data.message || "Passenger marked as boarded.");
      await loadDashboard({ silent: true });
      if (tripId && fromOrder && toOrder) await loadAvailability(tripId, fromOrder, toOrder);
    } catch (error) {
      setErr(error?.response?.data?.detail || "Boarding update failed.");
    } finally {
      setVerifyBusy(false);
    }
  };

  const completePassengerRide = async (bookingOverride) => {
    const booking = bookingOverride || ticketLookup;
    if (!booking?.id) {
      setErr("Load a ride OTP before completing the ride.");
      return;
    }
    setVerifyBusy(true);
    setErr("");
    setMsg("");
    try {
      const response = await api.post(`/api/bookings/${booking.id}/complete/`);
      setTicketLookup(response.data.booking);
      pushScanLog(`Ride completed for booking #${booking.id}.`);
      setMsg(response.data.message || "Ride completed.");
      await loadDashboard({ silent: true });
      if (tripId && fromOrder && toOrder) await loadAvailability(tripId, fromOrder, toOrder);
    } catch (error) {
      setErr(error?.response?.data?.detail || "Ride completion failed.");
    } finally {
      setVerifyBusy(false);
    }
  };

  const copyToClipboard = useCallback(async (text) => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, []);

  const shareHelperUpdate = useCallback(async (title, text) => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text });
        return "shared";
      } catch {
        // Fall back to clipboard when the share sheet is dismissed or unsupported.
      }
    }
    const copied = await copyToClipboard(text);
    return copied ? "copied" : "ready";
  }, [copyToClipboard]);

  const openVehicleLogs = () => {
    setErr("");
    setActiveTab("route");
    setMsg(`Vehicle log preview loaded for ${assignedBus?.plate_number || currentTrip?.bus_plate || "the assigned bus"}.`);
  };

  const broadcastUpdate = async () => {
    setErr("");
    const updateText = `MetroBus helper update
Route: ${routeTitle}
Bus: ${assignedBus?.plate_number || currentTrip?.bus_plate || "--"}
Status: ${helperHeaderStatus}
Current stop: ${routeStops[currentStopIndex]?.stop?.name || routeStops[0]?.stop?.name || "--"}
Next stop: ${upcomingStop?.stop?.name || routeDestination}`;
    const result = await shareHelperUpdate("MetroBus helper update", updateText);
    setMsg(result === "shared" ? "Live trip update shared." : result === "copied" ? "Trip update copied. Paste it into your dispatch channel." : "Trip update is ready to send.");
  };

  const contactDispatch = async () => {
    setErr("");
    const dispatchNote = `MetroBus dispatch note
Route: ${routeTitle}
Bus: ${assignedBus?.plate_number || currentTrip?.bus_plate || "--"}
Driver: ${assignedDriverName}
Status: ${helperHeaderStatus}
Current stop: ${routeStops[currentStopIndex]?.stop?.name || routeStops[0]?.stop?.name || "--"}
Need support with live trip operations.`;
    const copied = await copyToClipboard(dispatchNote);
    setMsg(copied ? "Dispatch note copied. Opening your messaging app." : "Dispatch note prepared for messaging.");
    if (typeof window !== "undefined") {
      window.location.href = `sms:?body=${encodeURIComponent(dispatchNote)}`;
    }
  };

  const openFullMap = () => {
    const focusPoint = livePoint || mapPolyline[Math.min(currentStopIndex, Math.max(mapPolyline.length - 1, 0))] || mapPolyline[0];
    if (!focusPoint) {
      setErr("No route map is available yet.");
      return;
    }
    const [lat, lng] = focusPoint;
    setErr("");
    setMsg("Opened the live route in a full map.");
    if (typeof window !== "undefined") {
      window.open(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`, "_blank", "noopener,noreferrer");
    }
  };

  const handleLogout = () => {
    clearToken();
    navigate("/auth/login");
  };

  if (loadingTrips) {
    return (
      <div style={theme} className="flex min-h-screen items-center justify-center bg-[var(--hlp-bg)] text-[var(--hlp-text)]">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[var(--hlp-purple)] border-t-transparent" />
          <p className="mt-4 text-sm font-medium text-[var(--hlp-muted)]">Loading helper workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={theme} className="min-h-screen bg-[linear-gradient(180deg,var(--hlp-bg),var(--hlp-bg-end))] text-[var(--hlp-text)]">
      <header className="sticky top-0 z-30 border-b border-[var(--hlp-border)] bg-[var(--hlp-header)] px-3 py-3 backdrop-blur-xl sm:px-4 sm:py-4">
        <div className={`${APP_SHELL_CLASS} flex items-center justify-between gap-3`}>
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <HeaderButton onClick={() => loadDashboard()}>
              <Icon name="refresh" />
            </HeaderButton>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[1rem] bg-white shadow-[var(--hlp-shadow)] sm:h-11 sm:w-11 sm:rounded-2xl">
              <span className="text-[0.6rem] font-black uppercase tracking-[0.2em] text-[var(--hlp-purple)]">MB</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-[0.92rem] font-black tracking-[0.01em] text-[var(--hlp-purple)] sm:text-[1rem]">MetroBus Helper</p>
              <p className="truncate text-[0.58rem] font-black uppercase tracking-[0.16em] text-[var(--hlp-muted)] sm:text-[0.6rem] sm:tracking-[0.18em]">Staff Operations</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Chip tone={activeTrip ? "live" : pendingTrip ? "warn" : "soft"} className="px-2.5 py-2 sm:px-3">
              {helperHeaderStatus}
            </Chip>
            <HeaderButton onClick={handleLogout}>
              <Icon name="logout" />
            </HeaderButton>
          </div>
        </div>
      </header>

      <main className={`${APP_SHELL_CLASS} px-4 py-4 pb-28 sm:px-5 sm:py-5 sm:pb-32`}>
        {err ? <div className="mb-4 rounded-[1.5rem] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{err}</div> : null}
        {msg ? <div className="mb-4 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{msg}</div> : null}

        {activeTab === "trip" ? <>
          <section className="relative overflow-hidden rounded-[1.6rem] bg-[linear-gradient(135deg,var(--hlp-purple),var(--hlp-purple-2))] p-5 text-white shadow-[var(--hlp-shadow-strong)] sm:rounded-[1.9rem] sm:p-6">
            <div className="absolute inset-y-0 right-0 w-36 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.14),transparent_62%)]" />
            <p className="text-[0.68rem] font-black uppercase tracking-[0.28em] text-white/74">Shift Dashboard</p>
            <h1 className="mt-3 text-[2.7rem] font-black leading-[0.92] whitespace-pre-line sm:text-5xl">{activeTrip ? "LIVE\nSUPPORT" : pendingTrip ? "START\nPENDING" : "READY ON\nSHIFT"}</h1>
            <p className="mt-4 text-sm font-medium leading-6 text-white/84 sm:text-base sm:leading-7">
              {activeTrip ? `${activeTrip.route_name} is ready for boarding, payment checks, and route support.` : pendingTrip ? pendingStartLabel : "Waiting for a live trip in Pokhara. Stay ready for boarding and cash verification."}
            </p>
            <div className="mt-6 rounded-[1.4rem] border border-white/20 bg-white/10 p-4 backdrop-blur">
              <div className="flex items-center gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-white/14 text-white"><Icon name="bus" className="h-7 w-7" /></div>
                <div>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-white/74">Assigned Bus</p>
                  <p className="mt-1 break-words text-2xl font-black leading-snug">{assignedBus?.plate_number || currentTrip?.bus_plate || nextSchedule?.bus_plate || "--"}</p>
                  <p className="mt-1 break-words text-sm leading-6 text-white/78">{assignedBus?.capacity || "--"} seats | Driver: {currentTrip?.driver_name || nextSchedule?.driver_name || assignedBus?.driver_name || "--"}</p>
                </div>
              </div>
            </div>
          </section>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Open Seats" value={availableSeats.length} note="Current segment" icon="ticket" />
            <StatCard label="Occupied" value={occupiedCount} note="Already reserved" icon="shield" />
            <StatCard label="Marked" value={selectedCount} note="Offline seats" icon="money" />
          </div>
        </> : null}

        {activeTab === "trip" ? (
          <div className="mt-5 space-y-5">
            <div className="px-1">
                <h2 className="text-[1.35rem] font-black">Helper Dashboard</h2>
                <p className="mt-1 text-base text-[var(--hlp-muted)]">Monitoring active transit operations</p>
              </div>

            <div className="max-w-[15rem]">
              <SelectField label="Switch Active Trip" value={tripId} onChange={(value) => { setTripId(value); setMsg(""); setErr(""); setTicketLookup(null); }} options={trips.length ? trips.map((trip) => ({ value: String(trip.id), label: `${trip.route_name} - ${trip.bus_plate}` })) : [{ value: "", label: tripAwaitingStart ? "Trip is waiting for driver/helper confirmation" : "No live trips available" }]} disabled={!trips.length} />
            </div>

            <SurfaceCard className="overflow-hidden bg-[linear-gradient(135deg,var(--hlp-purple),var(--hlp-purple-2))] text-white shadow-[var(--hlp-shadow-strong)]">
              <Chip tone="dark" className="bg-white/18">{activeTrip ? "Active Trip" : pendingTrip ? "Start Pending" : "Shift Ready"}</Chip>
                <h3 className="mt-6 break-words text-[2.3rem] font-black leading-[0.94] sm:text-[3rem]">{helperTripHeroTitle}</h3>
              <div className="mt-6 flex flex-wrap gap-3">
                <span className="rounded-full bg-white/14 px-4 py-2 text-sm font-black uppercase tracking-[0.14em]">{activeTrip ? `Started ${tripStarted}` : nextSchedule ? `Scheduled ${formatTime(nextSchedule.scheduled_start_time)}` : "Waiting for trip"}</span>
                <span className="rounded-full bg-white/14 px-4 py-2 text-sm font-black uppercase tracking-[0.14em]">{activeTrip ? "On Time" : pendingTrip ? "Confirm Start" : "Standby"}</span>
              </div>
              <div className="mt-6 rounded-[1.8rem] border border-white/18 bg-white/10 p-4">
                <div className="flex items-center gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-white/16 text-base font-black">{assignedDriverName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>
                  <div>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-white/72">Assigned Driver</p>
                    <p className="mt-1 break-words text-2xl font-black leading-snug">{assignedDriverName}</p>
                    <p className="mt-1 break-all text-sm text-white/78">{driverBadgeId}</p>
                  </div>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {tripAwaitingStart ? (
                  pendingTrip?.helper_start_confirmed ? (
                    <div className="rounded-[1.6rem] bg-white/12 px-4 py-4 text-sm font-medium text-white/88">
                      {pendingStartLabel}
                    </div>
                  ) : (
                    <PrimaryButton tone="primary" onClick={confirmPendingStart} className="w-full !justify-between !rounded-[1.8rem] !px-6 !py-5 !text-base">
                      Confirm Trip Start
                      <Icon name="shield" className="h-5 w-5" />
                    </PrimaryButton>
                  )
                ) : null}
                {!currentTrip && nextSchedule ? (
                  <PrimaryButton tone="primary" onClick={() => requestScheduledStart(nextSchedule.id)} className="w-full !justify-between !rounded-[1.8rem] !px-6 !py-5 !text-base">
                    Start Scheduled Trip
                    <Icon name="bus" className="h-5 w-5" />
                  </PrimaryButton>
                ) : null}
                {activeTrip ? (
                  <PrimaryButton tone={activeTrip.helper_end_confirmed ? "ghost" : "danger"} onClick={requestTripEnd} disabled={activeTrip.helper_end_confirmed} className="w-full !justify-between !rounded-[1.8rem] !px-6 !py-5 !text-base">
                    {activeTrip.driver_end_confirmed ? "Confirm End Trip" : activeTrip.helper_end_confirmed ? "End Requested" : "Request End Trip"}
                    <Icon name="alert" className="h-5 w-5" />
                  </PrimaryButton>
                ) : null}
              </div>
            </SurfaceCard>

            {activeTrip?.waiting_for_end_confirmation ? (
              <SurfaceCard className="bg-[rgba(255,244,248,0.92)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <SectionLabel>End Confirmation</SectionLabel>
                    <h3 className="mt-2 text-2xl font-black">Trip end is waiting on the other staff member</h3>
                    <p className="mt-3 text-sm leading-6 text-[var(--hlp-muted)]">{pendingEndLabel}</p>
                  </div>
                  <Chip tone="warn">Ending</Chip>
                </div>
              </SurfaceCard>
            ) : null}

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <SurfaceCard className="bg-[rgba(247,224,249,0.84)]">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-[rgba(255,107,115,0.12)] text-[var(--hlp-purple)]"><Icon name="ticket" /></div>
                <p className="mt-8 text-[2rem] font-black sm:text-4xl">{availableSeats.length || 12}</p>
                <p className="mt-2 text-[0.9rem] font-medium uppercase tracking-[0.14em] text-[var(--hlp-muted)]">Open Seats</p>
              </SurfaceCard>
              <SurfaceCard className="bg-[rgba(245,219,248,0.92)]">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-[rgba(255,107,115,0.12)] text-[var(--hlp-purple)]"><Icon name="profile" /></div>
                <p className="mt-8 text-[2rem] font-black sm:text-4xl">{occupiedCount || 18}</p>
                <p className="mt-2 text-[0.9rem] font-medium uppercase tracking-[0.14em] text-[var(--hlp-muted)]">Occupied</p>
              </SurfaceCard>
              <SurfaceCard className="col-span-2 bg-[rgba(245,206,241,0.9)]">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-[rgba(233,86,120,0.12)] text-[#c81e49]"><Icon name="alert" /></div>
                <p className="mt-8 text-[2rem] font-black sm:text-4xl">{helperDashboardMarked}</p>
                <p className="mt-2 text-[0.9rem] font-medium uppercase tracking-[0.14em] text-[var(--hlp-muted)]">Marked (Special)</p>
              </SurfaceCard>
            </div>

            <SurfaceCard>
              <SectionLabel>Assigned Vehicle</SectionLabel>
              <h3 className="mt-2 text-3xl font-black uppercase">Assigned Vehicle</h3>
              <div className="mt-6 rounded-[1.8rem] bg-[var(--hlp-soft)] px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-[var(--hlp-purple)] shadow-[var(--hlp-shadow)]"><Icon name="bus" /></div>
                  <div>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--hlp-muted)]">Vehicle</p>
                    <p className="mt-1 break-words text-2xl font-black leading-snug">{assignedBus?.plate_number || currentTrip?.bus_plate || "BA 2 PA 4567"}</p>
                    <p className="mt-1 text-sm text-[var(--hlp-muted)]">Fleet Number: 88-X</p>
                  </div>
                </div>
              </div>
              <div className="mt-5 rounded-[1.6rem] bg-[var(--hlp-soft)] px-4 py-4 text-sm font-semibold">
                <div className="flex items-center justify-between gap-3">
                  <span>Total Capacity</span>
                  <span className="text-xl font-black text-[var(--hlp-purple)]">{vehicleCapacity} Seats</span>
                </div>
              </div>
              <div className="mt-5 h-2 rounded-full bg-[#f0dce4]">
                <div className="h-2 rounded-full bg-[linear-gradient(135deg,var(--hlp-purple),var(--hlp-purple-2))]" style={{ width: `${Math.min(Math.max(occupancyPercent, 12), 100)}%` }} />
              </div>
              <p className="mt-4 text-center text-[0.82rem] font-black uppercase tracking-[0.16em] text-[var(--hlp-muted)]">Current Occupancy: {Math.min(Math.max(occupancyPercent, 12), 100)}%</p>
              <PrimaryButton tone="ghost" onClick={openVehicleLogs} className="mt-5 w-full !py-4 !text-base">Vehicle Logs</PrimaryButton>
            </SurfaceCard>

            <div className="space-y-4">
              <PrimaryButton tone="primary" onClick={broadcastUpdate} className="w-full !justify-between !rounded-[1.8rem] !px-6 !py-5 !text-base">Broadcast Update <Icon name="broadcast" className="h-5 w-5" /></PrimaryButton>
              <PrimaryButton tone="ghost" onClick={contactDispatch} className="w-full !justify-between !rounded-[1.8rem] !bg-[var(--hlp-soft)] !px-6 !py-5 !text-base">Contact Dispatch <Icon name="headset" className="h-5 w-5" /></PrimaryButton>
            </div>
          </div>
        ) : null}

        {activeTab === "boarding" ? (
          <div className="mt-5 space-y-5">
            {!activeTrip ? (
              <SurfaceCard className="bg-[rgba(255,250,255,0.92)]">
                <SectionLabel>Boarding Locked</SectionLabel>
                <p className="mt-2 text-2xl font-black">{tripAwaitingStart ? "Waiting for both trip confirmations" : "No LIVE trip yet"}</p>
                <p className="mt-3 text-sm leading-6 text-[var(--hlp-muted)]">
                  {tripAwaitingStart ? pendingStartLabel : "Seat marking and offline boarding unlock as soon as the assigned trip becomes LIVE."}
                </p>
              </SurfaceCard>
            ) : null}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {terminalChips.map((chip, index) => (
                <button key={`${chip.label}-${index}`} type="button" onClick={() => chip.value && setFromOrder(chip.value)} className={`shrink-0 rounded-full px-5 py-3 text-sm font-black uppercase tracking-[0.14em] ${index === 0 ? "bg-[linear-gradient(135deg,var(--hlp-purple),var(--hlp-purple-2))] text-white shadow-[var(--hlp-shadow-strong)]" : "bg-[var(--hlp-soft)] text-[var(--hlp-purple)]"}`}>
                  {chip.label}
                </button>
              ))}
            </div>

            <SurfaceCard className="overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(246,219,252,0.95),rgba(255,255,255,0.94)_45%)]">
              <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
                <SelectField label="From" value={fromOrder} onChange={setFromOrder} options={stopOptions.length ? stopOptions : [{ value: "", label: "No stops" }]} disabled={!stopOptions.length} />
                <button type="button" onClick={() => { const currentFrom = fromOrder; setFromOrder(toOrder); setToOrder(currentFrom); }} className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--hlp-soft)] text-[var(--hlp-purple)]">
                  <Icon name="swap" className="h-6 w-6" />
                </button>
                <SelectField label="To" value={toOrder} onChange={setToOrder} options={stopOptions.length ? stopOptions : [{ value: "", label: "No stops" }]} disabled={!stopOptions.length} />
              </div>
              <div className="mt-4 rounded-[1.4rem] bg-white/80 px-4 py-3 text-sm font-semibold text-[var(--hlp-text)] shadow-[var(--hlp-shadow)]">
                {fromStop && toStop ? `Segment: ${fromStop.stop?.name} to ${toStop.stop?.name}` : "Choose a route segment to continue."}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <SectionLabel>Segment Status</SectionLabel>
                <Chip tone={loadingAvail ? "warn" : "live"}>{loadingAvail ? "Refreshing Seats" : "Seats Ready"}</Chip>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-5 text-[0.72rem] font-black uppercase tracking-[0.16em] text-[var(--hlp-muted)]">
                <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded-full border border-[var(--hlp-border)] bg-white" />Open</span>
                <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded-full bg-[rgba(233,198,244,0.86)]" />Occupied</span>
                <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded-full bg-[linear-gradient(135deg,var(--hlp-purple),var(--hlp-purple-2))]" />Selected</span>
              </div>
            </SurfaceCard>

            <SurfaceCard className="overflow-hidden !p-0">
              <div className="border-b border-[var(--hlp-border)] px-5 py-4">
                <SectionLabel>Seat Map</SectionLabel>
                <p className="mt-1 text-lg font-black">Offline boarding workspace</p>
              </div>
              <div className="bg-[var(--hlp-soft)] px-4 py-5 sm:px-6">
                {seats.length === 0 ? <div className="rounded-[1.8rem] bg-white/70 px-5 py-8 text-center text-sm font-medium text-[var(--hlp-muted)]">Select a live trip and a valid segment to load available seats.</div> : <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">{seats.map((seat) => <SeatNode key={seat.seat_id} seat={seat} selected={selectedSeatIds.includes(seat.seat_id)} onClick={() => toggleSeat(seat.seat_id)} />)}</div>}
                <div className="mx-auto mt-6 flex w-fit flex-wrap items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[var(--hlp-text)] shadow-[var(--hlp-shadow)]">
                  <span className="uppercase tracking-[0.16em] text-[var(--hlp-muted)]">Selected seats:</span>
                  {selectedSeatLabels.length ? selectedSeatLabels.map((label) => <span key={label} className="rounded-full bg-[linear-gradient(135deg,var(--hlp-purple),var(--hlp-purple-2))] px-3 py-1 text-xs text-white">{label}</span>) : <span className="text-[var(--hlp-muted)]">None</span>}
                </div>
              </div>
            </SurfaceCard>

            <PrimaryButton tone="primary" onClick={submitOffline} disabled={offlineBusy || !selectedSeatIds.length} className="w-full !py-5 !text-base">
              <Icon name="ticket" />
              {offlineBusy ? "Saving Offline Boarding" : "Save Offline Boarding"}
            </PrimaryButton>
            <p className="text-center text-sm font-medium uppercase tracking-[0.18em] text-[var(--hlp-muted)]">Your boarding pass will remain accessible without an active internet connection.</p>
          </div>
        ) : null}

        {activeTab === "verify" ? (
          <div className="mt-5 space-y-5">
            <div className="px-1">
              <SectionLabel>Transit Verification</SectionLabel>
              <h2 className="mt-2 text-[2.9rem] font-black leading-[0.92] sm:text-6xl">Verify Payment</h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-[var(--hlp-muted)]">Enter the passenger 4-digit ride OTP to load the booking, request payment, confirm boarding, and complete the ride when the passenger gets off.</p>
            </div>
            <SurfaceCard className="rounded-[1.8rem]">
              <label className="mb-3 block text-[0.68rem] font-black uppercase tracking-[0.24em] text-[var(--hlp-muted)]">4-Digit Ride OTP</label>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="relative">
                  <input
                    type="text"
                    value={verifyBookingId}
                    onChange={(event) => setVerifyBookingId(event.target.value.replace(/\D/g, "").slice(0, 4))}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="1234"
                    className="w-full rounded-full border border-[var(--hlp-border)] bg-[var(--hlp-soft)] px-5 py-4 pr-14 text-base font-semibold tracking-[0.22em] text-[var(--hlp-text)] outline-none"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[var(--hlp-purple)]"><Icon name="shield" className="h-6 w-6" /></span>
                </div>
                <PrimaryButton tone="primary" onClick={() => lookupTicket()} disabled={verifyBusy} className="!px-8 !py-4">
                  {verifyBusy ? "Loading Ride" : "Load Ride"}
                </PrimaryButton>
              </div>
              <p className="mt-3 text-sm text-[var(--hlp-muted)]">The passenger shares this OTP after booking. MetroBus verifies it against the live booking before payment and boarding actions are unlocked.</p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-black uppercase tracking-[0.14em] text-[var(--hlp-muted)]">
                <span className="rounded-full bg-[var(--hlp-soft)] px-3 py-2">Socket: {bookingSocketState}</span>
                <span className="rounded-full bg-[var(--hlp-soft)] px-3 py-2">Lookup: OTP verification</span>
              </div>
            </SurfaceCard>

            <SurfaceCard className="rounded-[1.8rem]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <SectionLabel>Debug Status</SectionLabel>
                  <p className="mt-2 text-2xl font-black">Helper OTP and payment log</p>
                </div>
                <Chip tone="soft">{scanLogItems.length} events</Chip>
              </div>
              <div className="mt-4 space-y-2">
                {scanLogItems.length ? scanLogItems.map((item) => (
                  <div key={item.id} className="rounded-[1.1rem] bg-[var(--hlp-soft)] px-4 py-3 text-sm font-medium text-[var(--hlp-text)]">
                    {item.text}
                  </div>
                )) : (
                  <div className="rounded-[1.1rem] border border-dashed border-[var(--hlp-border)] px-4 py-4 text-sm text-[var(--hlp-muted)]">
                    No helper OTP events yet. Load a passenger ride OTP to see each verification and payment step here.
                  </div>
                )}
              </div>
            </SurfaceCard>

            <SurfaceCard className="rounded-[1.8rem] border-[rgba(215,149,239,0.45)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Chip tone="soft">Verification Result</Chip>
                  <h3 className="mt-5 text-[2rem] font-black leading-tight sm:text-4xl">Commuter Ticket</h3>
                </div>
                <div className="grid h-16 w-16 place-items-center rounded-full bg-[var(--hlp-soft)] text-[var(--hlp-purple)]"><Icon name="shield" className="h-8 w-8" /></div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {[{ label: "Passenger", value: ticketLookup?.passenger_name || "Load a ride" }, { label: "Route", value: ticketLookup?.route_name || "--" }, { label: "Seats", value: ticketLookup?.seat_labels?.join(", ") || "--" }, { label: "Ride OTP", value: ticketLookup?.boarding_otp || "--" }, { label: "Payment", value: verifyPreview.method || "--" }, { label: "Amount", value: verifyPreview.amount ? `Rs. ${verifyPreview.amount}` : "--" }].map((item) => (
                  <div key={item.label}>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-[var(--hlp-muted)]">{item.label}</p>
                    <p className={`mt-3 break-words text-2xl font-black leading-snug ${item.label === "Amount" || item.label === "Ride OTP" ? "text-[var(--hlp-purple)]" : ""}`}>{item.value}</p>
                  </div>
                ))}
              </div>
              {ticketLookup ? (
                <div className="mt-5 rounded-[1.6rem] bg-[var(--hlp-soft)] px-4 py-4 text-sm font-medium text-[var(--hlp-text)]">
                  <p className="break-words"><span className="font-black text-[var(--hlp-purple)]">Booking ID:</span> #{ticketLookup.id}</p>
                  <p className="mt-2 break-words"><span className="font-black text-[var(--hlp-purple)]">Ride OTP:</span> {ticketLookup.boarding_otp}</p>
                  <p className="mt-2 break-words"><span className="font-black text-[var(--hlp-purple)]">Journey Status:</span> {ticketLookup.journey_status_label || ticketLookup.journey_status}</p>
                  <p className="break-words"><span className="font-black text-[var(--hlp-purple)]">Pickup:</span> {ticketLookup.pickup_stop_name}</p>
                  <p className="mt-2 break-words"><span className="font-black text-[var(--hlp-purple)]">Drop:</span> {ticketLookup.destination_stop_name}</p>
                  <p className="mt-2 break-all"><span className="font-black text-[var(--hlp-purple)]">Ticket:</span> {ticketLookup.ticket_code}</p>
                  {ticketLookup.scanned_at ? (
                    <p className="mt-2 break-words"><span className="font-black text-[var(--hlp-purple)]">Scanned:</span> {ticketLookup.scanned_by_name || "Helper"} at {formatTime(ticketLookup.scanned_at)}</p>
                  ) : null}
                  {ticketLookup.accepted_by_helper_at ? (
                    <p className="mt-2 break-words"><span className="font-black text-[var(--hlp-purple)]">Accepted:</span> {ticketLookup.accepted_by_helper_name || "Helper"} at {formatTime(ticketLookup.accepted_by_helper_at)}</p>
                  ) : null}
                  {ticketLookup.payment_requested_at ? (
                    <p className="mt-2 break-words"><span className="font-black text-[var(--hlp-purple)]">Payment Request:</span> Sent {formatTime(ticketLookup.payment_requested_at)}</p>
                  ) : null}
                </div>
              ) : null}
            </SurfaceCard>

            <div className="grid gap-3 sm:grid-cols-2">
              <PrimaryButton tone="ghost" onClick={acceptPassengerRide} disabled={verifyBusy || !ticketLookup?.can_accept} className="w-full !py-5 !text-base">
                Accept Ride
                <Icon name="shield" />
              </PrimaryButton>
              <PrimaryButton tone="primary" onClick={requestPassengerPayment} disabled={verifyBusy || !ticketLookup?.can_request_payment} className="w-full !py-5 !text-base">
                {helperPaymentActionLabel}
                <Icon name="money" />
              </PrimaryButton>
              <PrimaryButton tone="danger" onClick={verifyCash} disabled={verifyBusy || !ticketLookup?.can_verify_cash} className="w-full !py-5 !text-base">
                Confirm Cash
                <Icon name="shield" />
              </PrimaryButton>
              <PrimaryButton tone="primary" onClick={boardPassenger} disabled={verifyBusy || !ticketLookup?.can_board} className="w-full !py-5 !text-base">
                Mark Boarded
                <Icon name="ticket" />
              </PrimaryButton>
              <PrimaryButton tone="ghost" onClick={completePassengerRide} disabled={verifyBusy || !ticketLookup?.can_complete} className="w-full !py-5 !text-base">
                Complete Ride
                <Icon name="map" />
              </PrimaryButton>
            </div>
            {(needsAcceptanceBookings.length || onboardBookings.length || readyToBoardBookings.length || awaitingPaymentBookings.length) ? (
              <SurfaceCard className="rounded-[1.8rem]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <SectionLabel>Live Passenger Flow</SectionLabel>
                    <p className="mt-2 text-2xl font-black">Boarding and offboarding queue</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--hlp-muted)]">Use these live cards to open tickets faster, confirm boarding, and finish rides when passengers get off.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Chip tone="warn">{helperBookingSummary.needs_acceptance_count || 0} need acceptance</Chip>
                    <Chip tone="warn">{helperBookingSummary.awaiting_payment_count || 0} waiting payment</Chip>
                    <Chip tone="soft">{helperBookingSummary.ready_to_board_count || 0} ready to board</Chip>
                    <Chip tone="live">{helperBookingSummary.onboard_count || 0} onboard</Chip>
                  </div>
                </div>
                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  <div className="space-y-3">
                    <SectionLabel>Needs Acceptance</SectionLabel>
                    {needsAcceptanceBookings.length ? needsAcceptanceBookings.slice(0, 3).map((booking) => (
                      <div key={`accept-${booking.id}`} className="rounded-[1.6rem] bg-[var(--hlp-soft)] px-4 py-4">
                        <p className="break-words text-lg font-black">{booking.passenger_name}</p>
                        <p className="mt-1 break-words text-sm font-medium leading-6 text-[var(--hlp-muted)]">{booking.seat_labels?.join(", ") || "--"} | {booking.pickup_stop_name}</p>
                        <div className="mt-4 flex gap-2">
                          <PrimaryButton tone="ghost" onClick={() => openBookingInVerify(booking)} className="!flex-1 !px-4 !py-3 !text-sm">Open Ticket</PrimaryButton>
                          <PrimaryButton tone="primary" onClick={() => acceptPassengerRide(booking)} disabled={verifyBusy || !booking.can_accept} className="!flex-1 !px-4 !py-3 !text-sm">Accept Ride</PrimaryButton>
                        </div>
                      </div>
                    )) : <div className="rounded-[1.6rem] border border-dashed border-[var(--hlp-border)] px-4 py-5 text-sm font-medium text-[var(--hlp-muted)]">All scanned passengers are already accepted.</div>}
                  </div>
                  <div className="space-y-3">
                    <SectionLabel>Awaiting Payment</SectionLabel>
                    {awaitingPaymentBookings.length ? awaitingPaymentBookings.slice(0, 3).map((booking) => (
                      <div key={`awaiting-${booking.id}`} className="rounded-[1.6rem] bg-[var(--hlp-soft)] px-4 py-4">
                        <p className="break-words text-lg font-black">{booking.passenger_name}</p>
                        <p className="mt-1 break-words text-sm font-medium leading-6 text-[var(--hlp-muted)]">{booking.seat_labels?.join(", ") || "--"} | {booking.pickup_stop_name}</p>
                        <div className="mt-4 flex gap-2">
                          <PrimaryButton tone="ghost" onClick={() => openBookingInVerify(booking)} className="!flex-1 !px-4 !py-3 !text-sm">Open Ticket</PrimaryButton>
                        </div>
                      </div>
                    )) : <div className="rounded-[1.6rem] border border-dashed border-[var(--hlp-border)] px-4 py-5 text-sm font-medium text-[var(--hlp-muted)]">No passengers are waiting on payment right now.</div>}
                  </div>
                  <div className="space-y-3">
                    <SectionLabel>Ready To Board</SectionLabel>
                    {readyToBoardBookings.length ? readyToBoardBookings.slice(0, 3).map((booking) => (
                      <div key={`ready-${booking.id}`} className="rounded-[1.6rem] bg-[var(--hlp-soft)] px-4 py-4">
                        <p className="break-words text-lg font-black">{booking.passenger_name}</p>
                        <p className="mt-1 break-words text-sm font-medium leading-6 text-[var(--hlp-muted)]">{booking.seat_labels?.join(", ") || "--"} | Pickup {booking.pickup_stop_name}</p>
                        <div className="mt-4 flex gap-2">
                          <PrimaryButton tone="ghost" onClick={() => openBookingInVerify(booking)} className="!flex-1 !px-4 !py-3 !text-sm">Open Ticket</PrimaryButton>
                          <PrimaryButton tone="primary" onClick={() => boardPassenger(booking)} disabled={verifyBusy || !booking.can_board} className="!flex-1 !px-4 !py-3 !text-sm">Board Now</PrimaryButton>
                        </div>
                      </div>
                    )) : <div className="rounded-[1.6rem] border border-dashed border-[var(--hlp-border)] px-4 py-5 text-sm font-medium text-[var(--hlp-muted)]">No paid passengers are waiting to board.</div>}
                  </div>
                  <div className="space-y-3 lg:col-span-2">
                    <SectionLabel>Onboard Passengers</SectionLabel>
                    {onboardBookings.length ? onboardBookings.slice(0, 4).map((booking) => (
                      <div key={`onboard-${booking.id}`} className="rounded-[1.6rem] bg-[var(--hlp-soft)] px-4 py-4">
                        <p className="break-words text-lg font-black">{booking.passenger_name}</p>
                        <p className="mt-1 break-words text-sm font-medium leading-6 text-[var(--hlp-muted)]">{booking.seat_labels?.join(", ") || "--"} | Drop {booking.destination_stop_name}</p>
                        <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--hlp-purple)]">Boarded {formatTime(booking.checked_in_at)}</p>
                        <div className="mt-4 flex gap-2">
                          <PrimaryButton tone="ghost" onClick={() => openBookingInVerify(booking)} className="!flex-1 !px-4 !py-3 !text-sm">Open Ticket</PrimaryButton>
                          <PrimaryButton tone="primary" onClick={() => completePassengerRide(booking)} disabled={verifyBusy || !booking.can_complete} className="!flex-1 !px-4 !py-3 !text-sm">Complete Ride</PrimaryButton>
                        </div>
                      </div>
                    )) : <div className="rounded-[1.6rem] border border-dashed border-[var(--hlp-border)] px-4 py-5 text-sm font-medium text-[var(--hlp-muted)]">No passengers are onboard yet.</div>}
                  </div>
                </div>
              </SurfaceCard>
            ) : null}
            {completedRecentBookings.length ? (
              <SurfaceCard className="rounded-[1.5rem]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <SectionLabel>Recently Completed</SectionLabel>
                    <p className="mt-2 text-xl font-black">Seats released on this trip</p>
                  </div>
                  <Chip tone="soft">{helperBookingSummary.completed_recent_count || completedRecentBookings.length} completed</Chip>
                </div>
                <div className="mt-4 space-y-3">
                  {completedRecentBookings.map((booking) => (
                    <div key={`done-${booking.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] bg-[var(--hlp-soft)] px-4 py-4">
                      <div>
                        <p className="break-words text-base font-black">{booking.passenger_name}</p>
                        <p className="mt-1 break-words text-sm font-medium leading-6 text-[var(--hlp-muted)]">{booking.seat_labels?.join(", ") || "--"} | Dropped at {booking.destination_stop_name}</p>
                      </div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--hlp-purple)]">{formatTime(booking.completed_at)}</p>
                    </div>
                  ))}
                </div>
              </SurfaceCard>
            ) : null}
            <p className="text-center text-sm text-[var(--hlp-muted)]">Verify the ride OTP, accept the passenger ride details, request or verify payment, then mark the rider boarded. Once the ride is completed, the seat becomes free for the next passengers on that segment.</p>
            <div className="h-48 rounded-[2.6rem] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.55),rgba(244,232,247,0.42))] shadow-[var(--hlp-shadow)]" />
          </div>
        ) : null}

        {activeTab === "route" ? (
          <div className="mt-5 space-y-5">
            <div className="px-1">
              <SectionLabel>Live Journey</SectionLabel>
              <h2 className="mt-2 break-words text-[2rem] font-black leading-tight sm:text-4xl">{routeTitle}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Chip tone="soft">Express</Chip>
                <p className="text-sm font-medium text-[var(--hlp-muted)]">To {routeDestination}</p>
              </div>
            </div>
            {!activeTrip && tripAwaitingStart ? (
              <SurfaceCard className="bg-[rgba(255,250,255,0.92)]">
                <SectionLabel>Route Status</SectionLabel>
                <p className="mt-2 text-2xl font-black">Trip is not LIVE yet</p>
                <p className="mt-3 text-sm leading-6 text-[var(--hlp-muted)]">
                  {pendingStartLabel}
                </p>
              </SurfaceCard>
            ) : null}
            <SurfaceCard>
              <div className="space-y-0">
                {routeStops.length === 0 ? <p className="py-2 text-sm text-[var(--hlp-muted)]">No route stops loaded for this trip yet.</p> : routeStops.map((stop, index) => {
                  const isCurrent = index === currentStopIndex;
                  const isFinal = index === routeStops.length - 1;
                  return (
                    <div key={`${stop.stop_order}-${stop.stop?.name}`} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <span className={`mt-1 grid h-10 w-10 place-items-center rounded-full border-2 ${isCurrent ? "border-transparent bg-[var(--hlp-purple)] text-white" : isFinal ? "border-dashed border-[var(--hlp-purple)] text-[var(--hlp-purple)]" : "border-[var(--hlp-border)] bg-[var(--hlp-soft)] text-[var(--hlp-purple)]"}`}>
                          <Icon name={isFinal ? "pin" : "bus"} className="h-4 w-4" />
                        </span>
                        {index < routeStops.length - 1 ? <span className="min-h-[2.9rem] w-px bg-[linear-gradient(180deg,rgba(170,98,222,0.94),rgba(237,210,247,0.85))]" /> : null}
                      </div>
                      <div className="flex-1 pb-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className={`break-words text-2xl font-black leading-snug ${isCurrent ? "text-[var(--hlp-purple)]" : ""}`}>{stop.stop?.name || "--"}</p>
                            <p className="mt-1 text-[0.74rem] font-black uppercase tracking-[0.18em] text-[var(--hlp-muted)]">{isCurrent ? "Current stop" : isFinal ? "Final destination" : "Upcoming stop"}</p>
                          </div>
                          <p className="text-lg font-black text-[var(--hlp-text)]">{index === currentStopIndex ? formatTime(latestLocation?.recorded_at || activeTrip?.started_at || nextSchedule?.scheduled_start_time) : `${9 + index}:${index === 0 ? "10" : `${index}5`}`}</p>
                        </div>
                        {isCurrent ? <div className="mt-3 rounded-[1.4rem] border border-[rgba(255,107,115,0.25)] bg-[var(--hlp-soft)] px-4 py-3 text-sm font-medium leading-6 text-[var(--hlp-plum)]">Boarding support is active here. Next movement is toward {upcomingStop?.stop?.name || "the next stop"}.</div> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SurfaceCard>
            <SurfaceCard className="overflow-hidden bg-[linear-gradient(135deg,var(--hlp-purple),var(--hlp-purple-2))] text-white shadow-[var(--hlp-shadow-strong)]">
              <div className="flex items-start justify-between gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/14"><Icon name="ticket" className="h-7 w-7" /></div>
                <Chip tone="dark" className="bg-white/18">Active Pass</Chip>
              </div>
              <p className="mt-6 text-sm font-medium text-white/76">Registered user</p>
              <p className="mt-1 text-3xl font-black">Morning Commute</p>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/18 pt-4 text-sm font-semibold text-white/86">
                <span>Valid until {formatTime(activeTrip?.started_at || nextSchedule?.scheduled_start_time)}</span>
                <span className="text-lg font-black">{">"}</span>
              </div>
            </SurfaceCard>
            <SurfaceCard className="overflow-hidden !p-0">
              <div className="border-b border-[var(--hlp-border)] px-5 py-4">
                <SectionLabel>Map Preview</SectionLabel>
                <p className="mt-1 text-lg font-black">{routeCondition}</p>
              </div>
              <div className="h-72 w-full">
                <MapContainer center={[28.2096, 83.9856]} zoom={13} scrollWheelZoom={false} className="h-full w-full">
                  <TileLayer attribution="&copy; OpenStreetMap &copy; CARTO" url={isDark ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"} />
                  <MapViewport points={mapPoints} />
                  {mapPolyline.length > 1 ? <Polyline positions={mapPolyline} pathOptions={{ color: "#ff6b73", weight: 5, opacity: 0.9 }} /> : null}
                  {routeStops.map((stop, index) => {
                    const lat = Number(stop.stop?.lat);
                    const lng = Number(stop.stop?.lng);
                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                    const current = index === currentStopIndex;
                    return <CircleMarker key={`${stop.stop_order}-${stop.stop?.name}`} center={[lat, lng]} radius={current ? 8 : 5} pathOptions={{ color: current ? "#ff6b73" : "#af8bbf", fillColor: current ? "#ff6b73" : "#f4dde7", fillOpacity: 0.95 }}><Popup>{stop.stop_order}. {stop.stop?.name}</Popup></CircleMarker>;
                  })}
                  {livePoint ? <CircleMarker center={livePoint} radius={10} pathOptions={{ color: "#10b981", fillColor: "#34d399", fillOpacity: 1 }}><Popup>Latest helper-linked trip location</Popup></CircleMarker> : null}
                </MapContainer>
              </div>
              <div className="px-5 py-4">
                <PrimaryButton tone="ghost" onClick={openFullMap} className="w-full">Open Full Map</PrimaryButton>
              </div>
            </SurfaceCard>
            <SurfaceCard className="border-dashed">
              <SectionLabel>Route Weather</SectionLabel>
              <div className="mt-4 flex items-center gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-[var(--hlp-soft)] text-[var(--hlp-purple)]"><Icon name="thermo" className="h-7 w-7" /></div>
                <div>
                  <p className="text-[2rem] font-black sm:text-4xl">24C</p>
                  <p className="mt-1 text-sm font-medium uppercase tracking-[0.12em] text-[var(--hlp-muted)]">Clear skies for travel in Pokhara</p>
                </div>
              </div>
            </SurfaceCard>
          </div>
        ) : null}
      </main>
      <div className="fixed bottom-0 inset-x-0 z-40 px-2.5 pb-[calc(0.55rem+env(safe-area-inset-bottom))] pt-2">
        <div className="enterprise-mobile-nav rounded-[1.35rem] border border-white/70 bg-[var(--hlp-nav)] p-1.5 shadow-[var(--hlp-shadow)] backdrop-blur-xl sm:rounded-[1.65rem]">
          <div className="grid grid-cols-4 gap-1.5">
            {TABS.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-1 rounded-[1rem] py-2 text-center transition sm:gap-1.5 sm:rounded-[1.1rem] ${activeTab === tab.id ? "bg-[linear-gradient(135deg,var(--hlp-purple),var(--hlp-purple-2))] text-white shadow-[var(--hlp-shadow-strong)]" : "text-[var(--hlp-muted)]"}`}><Icon name={tab.icon} className="h-4 w-4 sm:h-[1.1rem] sm:w-[1.1rem]" /><span className="px-1 text-[0.58rem] font-black uppercase tracking-[0.08em] leading-tight sm:text-[0.6rem] sm:tracking-[0.1em]">{tab.label}</span></button>)}
          </div>
        </div>
      </div>
    </div>
  );
}
