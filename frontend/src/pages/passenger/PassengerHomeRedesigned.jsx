import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { clearToken } from "../../auth";
import { useAuth } from "../../AuthContext";
import { api } from "../../api";
import { CheckoutPage } from "../../components/passenger/PassengerUI";
import MetroSeatBoard from "../../components/shared/MetroSeatBoard";
import { snapRouteToRoad } from "../../lib/mapRoute";
import { useTheme } from "../../ThemeContext";
import { buildFormPost, estimateEta, fmtMoney, PASSENGER_THEME, toLocPoint, toPoint, useSplash } from "./passengerUtils";

const LIGHT = { "--bg": "#f7efe7", "--bg-soft": "#fff7f0", "--surface": "rgba(255,255,255,0.92)", "--surface-strong": "rgba(255,255,255,0.98)", "--border": "rgba(73,39,94,0.10)", "--text": "#2d1838", "--muted": "#756681", "--primary": "#4b2666", "--accent": "#ff8a1f", "--accent-soft": "#fff1df", "--success": "#17a567", "--danger": "#db3d4f", "--header": "rgba(255,250,245,0.88)", "--footer": "rgba(255,251,247,0.96)", "--shadow": "0 20px 38px rgba(73,39,94,0.12)", "--shadow-strong": "0 24px 44px rgba(75,38,102,0.18)" };
const DARK = { "--bg": "#190f24", "--bg-soft": "#24152f", "--surface": "rgba(37,24,49,0.90)", "--surface-strong": "rgba(44,27,58,0.96)", "--border": "rgba(255,255,255,0.09)", "--text": "#fff5ef", "--muted": "#c8b8c7", "--primary": "#8d5abf", "--accent": "#ff962d", "--accent-soft": "rgba(255,150,45,0.16)", "--success": "#1fcf81", "--danger": "#ff6474", "--header": "rgba(25,15,36,0.84)", "--footer": "rgba(27,17,39,0.95)", "--shadow": "0 22px 42px rgba(0,0,0,0.28)", "--shadow-strong": "0 26px 48px rgba(0,0,0,0.34)" };
const TABS = [{ id: "home", label: "Home", icon: "home" }, { id: "rides", label: "Rides", icon: "ticket" }, { id: "support", label: "Support", icon: "support" }, { id: "account", label: "Account", icon: "account" }];
const CANCELLATION_REASONS = [{ value: "CHANGE_OF_PLANS", label: "Change of plans" }, { value: "WRONG_ROUTE", label: "Wrong route selected" }, { value: "DELAY", label: "Bus arrival delay" }, { value: "PAYMENT_ISSUE", label: "Payment issue" }, { value: "EMERGENCY", label: "Emergency" }, { value: "OTHER", label: "Other reason" }];

function Icon({ name, className = "h-5 w-5" }) {
  const common = { className, fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24" };
  switch (name) {
    case "home": return <svg {...common}><path d="M4 10.5 12 4l8 6.5" /><path d="M7 10v8h10v-8" /></svg>;
    case "ticket": return <svg {...common}><path d="M5 9a2 2 0 0 0 0 6v3h14v-3a2 2 0 0 0 0-6V6H5v3Z" /><path d="M12 6v12" /></svg>;
    case "support": return <svg {...common}><path d="M8 10h8" /><path d="M8 14h5" /><path d="M6 19h2l3-3h7a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z" /></svg>;
    case "account": return <svg {...common}><circle cx="12" cy="8" r="3.2" /><path d="M5 19a7 7 0 0 1 14 0" /></svg>;
    case "search": return <svg {...common}><circle cx="11" cy="11" r="6" /><path d="m20 20-3.5-3.5" /></svg>;
    case "close": return <svg {...common}><path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg>;
    case "back": return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>;
  }
}

function LogoMark() {
  return <div className="relative grid h-12 w-12 place-items-center overflow-hidden rounded-[1.1rem] bg-[linear-gradient(180deg,#4b2666_0%,#6d3d9b_50%,#ff8a1f_100%)] shadow-[0_14px_30px_rgba(75,38,102,0.24)]"><div className="absolute right-1 top-1 h-8 w-8 rounded-full border-[6px] border-[rgba(255,143,31,0.95)] border-l-transparent border-b-transparent rotate-[28deg]" /><div className="relative text-white"><svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="5" y="7" width="14" height="10" rx="3" /><path d="M7 12h10" /><path d="M8 17v2" /><path d="M16 17v2" /><path d="M3 9h2" /><path d="M1 13h4" /></svg></div></div>;
}

const SurfaceCard = ({ children, className = "" }) => <section className={`rounded-[1.8rem] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)] backdrop-blur-xl ${className}`}>{children}</section>;
const StatusPill = ({ tone = "default", children }) => <span className={`inline-flex items-center rounded-full px-4 py-2 text-[0.64rem] font-black uppercase tracking-[0.18em] ${tone === "success" ? "bg-[rgba(23,165,103,0.14)] text-[var(--success)]" : tone === "warning" ? "bg-[rgba(255,150,45,0.18)] text-[var(--accent)]" : tone === "danger" ? "bg-[rgba(219,61,79,0.14)] text-[var(--danger)]" : "bg-[var(--accent-soft)] text-[var(--primary)]"}`}>{children}</span>;
const ActionButton = ({ children, tone = "primary", className = "", ...props }) => <button type="button" className={`inline-flex items-center justify-center gap-2 rounded-[1.2rem] px-5 py-4 text-sm font-black tracking-[0.04em] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-55 ${tone === "secondary" ? "border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text)]" : tone === "danger" ? "bg-[linear-gradient(135deg,#a92b3c,#ff6e55)] text-white shadow-[var(--shadow-strong)]" : "bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-white shadow-[var(--shadow-strong)]"} ${className}`} {...props}>{children}</button>;

function SelectField({ label, value, onChange, options }) {
  return <div><label className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--muted)]">{label}</label><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3.5 text-sm font-semibold text-[var(--text)] outline-none">{options.map((option) => <option key={`${option.value}-${option.label}`} value={option.value}>{option.label}</option>)}</select></div>;
}

function MapViewport({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) { map.setView(points[0], 14); return; }
    map.fitBounds(points, { padding: [26, 26] });
  }, [map, points]);
  return null;
}

const initials = (name) => !name ? "PS" : name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "PS";
const occupancyTone = (percent) => (percent >= 80 ? "danger" : percent >= 50 ? "warning" : "success");

export default function PassengerHomeRedesigned() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { user, setUser } = useAuth();
  const { isDark } = useTheme();
  const showSplash = useSplash();
  const theme = useMemo(() => (isDark ? DARK : LIGHT), [isDark]);
  const shell = "enterprise-mobile-shell";
  const releaseHoldRef = useRef(() => Promise.resolve());

  const [tab, setTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [findingRoutes, setFindingRoutes] = useState(false);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [holdBusy, setHoldBusy] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [cancellationBusy, setCancellationBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [stops, setStops] = useState([]);
  const [trips, setTrips] = useState([]);
  const [routeFeed, setRouteFeed] = useState([]);
  const [tripContexts, setTripContexts] = useState({});
  const [pickupStopId, setPickupStopId] = useState("");
  const [dropStopId, setDropStopId] = useState("");
  const [activeSearch, setActiveSearch] = useState(null);
  const [matchedTrips, setMatchedTrips] = useState([]);
  const [dismissedMatchIds, setDismissedMatchIds] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [acceptedTripId, setAcceptedTripId] = useState("");
  const [seats, setSeats] = useState([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [walletSummary, setWalletSummary] = useState(null);
  const [roadPolyline, setRoadPolyline] = useState([]);
  const [paymentPanelOpen, setPaymentPanelOpen] = useState(false);
  const [checkoutBookingId, setCheckoutBookingId] = useState(null);
  const [cancellationBookingId, setCancellationBookingId] = useState(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationNote, setCancellationNote] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("view") === "checkout") {
      const bookingId = params.get("bookingId");
      if (bookingId) setCheckoutBookingId(Number(bookingId));
      setPaymentPanelOpen(true);
    }
  }, [search]);

  useEffect(() => {
    if (!msg) return undefined;
    const timer = setTimeout(() => setMsg(""), 4000);
    return () => clearTimeout(timer);
  }, [msg]);

  const liveTripsById = useMemo(() => new Map(routeFeed.map((trip) => [String(trip.id), trip])), [routeFeed]);
  const hydrateTrip = useCallback((trip) => {
    if (!trip) return null;
    const liveTrip = liveTripsById.get(String(trip.id));
    return liveTrip ? { ...liveTrip, ...trip, latest_location: liveTrip.latest_location ?? trip.latest_location ?? null, open_seats: trip.open_seats ?? liveTrip.open_seats, seats_total: trip.seats_total ?? liveTrip.seats_total, occupancy_percent: trip.occupancy_percent ?? liveTrip.occupancy_percent, occupancy_label: trip.occupancy_label ?? liveTrip.occupancy_label, eta: trip.eta ?? liveTrip.eta } : trip;
  }, [liveTripsById]);

  const visibleMatchedTrips = useMemo(() => matchedTrips.map((trip) => hydrateTrip(trip)).filter(Boolean).filter((trip) => !dismissedMatchIds.includes(String(trip.id))), [dismissedMatchIds, hydrateTrip, matchedTrips]);
  const activeBooking = bookings.find((booking) => ["PENDING", "CONFIRMED"].includes(booking.status)) || null;
  const paymentActionBooking = bookings.find((booking) => booking.needs_payment_selection && ["PENDING", "CONFIRMED"].includes(booking.status)) || null;
  const paymentPendingBooking = bookings.find((booking) => booking.payment_pending_verification && ["PENDING", "CONFIRMED"].includes(booking.status)) || null;
  const activeBookingId = activeBooking?.id || null;
  const hasPaymentAttention = Boolean(paymentActionBooking?.id || paymentPendingBooking?.id);
  const selectedTrip = useMemo(() => {
    const preferredKey = selectedTripId ? String(selectedTripId) : activeBooking?.trip_id ? String(activeBooking.trip_id) : "";
    return visibleMatchedTrips.find((trip) => String(trip.id) === preferredKey) || routeFeed.find((trip) => String(trip.id) === preferredKey) || (preferredKey ? hydrateTrip(liveTripsById.get(preferredKey)) : null) || routeFeed[0] || null;
  }, [activeBooking?.trip_id, hydrateTrip, liveTripsById, routeFeed, selectedTripId, visibleMatchedTrips]);
  const acceptedTrip = useMemo(() => {
    const tripKey = acceptedTripId ? String(acceptedTripId) : "";
    return visibleMatchedTrips.find((trip) => String(trip.id) === tripKey) || (tripKey ? hydrateTrip(liveTripsById.get(tripKey)) : null) || null;
  }, [acceptedTripId, hydrateTrip, liveTripsById, visibleMatchedTrips]);
  const focusTrip = activeBooking?.trip_id ? hydrateTrip(liveTripsById.get(String(activeBooking.trip_id))) || selectedTrip : acceptedTrip || selectedTrip;
  const routeStops = useMemo(() => !focusTrip?.id ? [] : tripContexts[focusTrip.id]?.route_stops || focusTrip.route_stops || [], [focusTrip, tripContexts]);
  const routePolyline = useMemo(() => routeStops.map((item) => toPoint(item.stop?.lat, item.stop?.lng)).filter(Boolean), [routeStops]);
  const displayLine = roadPolyline.length > 1 ? roadPolyline : routePolyline;
  const liveBusPoint = useMemo(() => toLocPoint(focusTrip?.live_override || focusTrip?.latest_location), [focusTrip]);
  const mapPoints = useMemo(() => [...displayLine, ...(liveBusPoint ? [liveBusPoint] : [])], [displayLine, liveBusPoint]);
  const checkoutBooking = useMemo(() => bookings.find((booking) => Number(booking.id) === Number(checkoutBookingId)) || paymentActionBooking || paymentPendingBooking || activeBooking || null, [activeBooking, bookings, checkoutBookingId, paymentActionBooking, paymentPendingBooking]);
  const cancellationBooking = useMemo(() => bookings.find((booking) => Number(booking.id) === Number(cancellationBookingId)) || null, [bookings, cancellationBookingId]);
  const stopOptions = useMemo(() => [{ value: "", label: "Choose a stop" }, ...stops.map((stop) => ({ value: String(stop.id), label: stop.name }))], [stops]);

  const mergeTripContexts = useCallback((liveTrips) => {
    setTripContexts((current) => {
      const merged = { ...current };
      liveTrips.forEach((trip) => {
        if (trip.route_stops) merged[trip.id] = { ...(merged[trip.id] || {}), route_stops: trip.route_stops };
      });
      return merged;
    });
  }, []);

  const syncTripSeatMeta = useCallback((tripId, seatsData) => {
    const openSeats = seatsData.filter((seat) => seat.available).length;
    const seatsTotal = seatsData.length;
    const occupancyPercent = seatsTotal ? Math.round(((seatsTotal - openSeats) / seatsTotal) * 100) : 0;
    const occupancyLabel = seatsTotal ? (occupancyPercent >= 80 ? "High Occupancy" : occupancyPercent >= 50 ? "Med Occupancy" : "Low Occupancy") : "Seat map unavailable";
    const apply = (list) => list.map((trip) => (String(trip.id) === String(tripId) ? { ...trip, open_seats: openSeats, seats_total: seatsTotal, occupancy_percent: occupancyPercent, occupancy_label: occupancyLabel } : trip));
    setRouteFeed((current) => apply(current));
    setMatchedTrips((current) => apply(current));
  }, []);

  const loadBookings = useCallback(async ({ silent = false } = {}) => {
    try { const response = await api.get("/api/bookings/my/"); setBookings(response.data.bookings || []); if (!silent) setErr(""); } catch { if (!silent) setErr("Unable to refresh your bookings right now."); }
  }, []);
  const loadWalletSummary = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setWalletBusy(true);
    try { const response = await api.get("/api/payments/wallet/summary/"); setWalletSummary(response.data.wallet || null); } catch { if (!silent) setErr("Unable to refresh wallet details right now."); } finally { if (!silent) setWalletBusy(false); }
  }, []);
  const ensureCtx = useCallback(async (tripList) => {
    const missing = tripList.filter((trip) => !tripContexts[trip.id]);
    if (!missing.length) return tripContexts;
    const pairs = await Promise.all(missing.map(async (trip) => [trip.id, (await api.get(`/api/trips/${trip.id}/`)).data]));
    const merged = { ...tripContexts };
    pairs.forEach(([id, data]) => { merged[id] = data; });
    setTripContexts(merged);
    return merged;
  }, [tripContexts]);
  const buildRouteFeed = useCallback(async (liveTrips) => {
    const cards = await Promise.all(liveTrips.map(async (trip) => {
      const rows = trip.route_stops || [];
      const first = rows[0];
      const last = rows[rows.length - 1];
      let openSeats = null; let seatsTotal = null; let occupancyPercent = null; let fareEstimate = Number(trip.fare_estimate || 0); let occupancyLabel = "Live service";
      if (first && last && Number(last.stop_order) > Number(first.stop_order)) {
        try {
          const availability = await api.get(`/api/bookings/trips/${trip.id}/availability/?from=${first.stop_order}&to=${last.stop_order}`);
          const seatsData = availability.data.seats || [];
          seatsTotal = seatsData.length;
          openSeats = seatsData.filter((seat) => seat.available).length;
          occupancyPercent = seatsData.length ? Math.round(((seatsData.length - openSeats) / seatsData.length) * 100) : 0;
          occupancyLabel = occupancyPercent >= 80 ? "High Occupancy" : occupancyPercent >= 50 ? "Med Occupancy" : "Low Occupancy";
          fareEstimate = Number(availability.data.fare_per_seat || 0) || fareEstimate;
        } catch { /* keep card visible */ }
      }
      const routePoints = rows.map((item) => toPoint(item.stop?.lat, item.stop?.lng)).filter(Boolean);
      return { ...trip, from_order: first?.stop_order || 1, to_order: last?.stop_order || 2, pickup_stop_name: first?.stop?.name || "Pickup", destination_stop_name: last?.stop?.name || "Drop", open_seats: openSeats, seats_total: seatsTotal, occupancy_percent: occupancyPercent, occupancy_label: occupancyLabel, fare_estimate: fareEstimate, eta: estimateEta(toLocPoint(trip.latest_location), first ? toPoint(first.stop?.lat, first.stop?.lng) : null, routePoints, trip.latest_location?.speed) };
    }));
    setRouteFeed(cards);
    setSelectedTripId((current) => current || String(cards[0]?.id || ""));
  }, []);
  const refreshLiveTrips = useCallback(async () => {
    const tripsResponse = await api.get("/api/trips/live/");
    const liveTrips = tripsResponse.data || [];
    setTrips(liveTrips);
    mergeTripContexts(liveTrips);
    await buildRouteFeed(liveTrips);
    return liveTrips;
  }, [buildRouteFeed, mergeTripContexts]);
  const buildMatchedTripCards = useCallback(async (tripList, nextPickupStopId, nextDropStopId) => {
    const ctxMap = await ensureCtx(tripList);
    const matches = [];

    for (const rawTrip of tripList) {
      const trip = hydrateTrip(rawTrip) || rawTrip;
      const rows = ctxMap[trip.id]?.route_stops || trip.route_stops || [];
      const pickupRow = rows.find((item) => String(item.stop?.id) === String(nextPickupStopId));
      const dropRow = rows.find((item) => String(item.stop?.id) === String(nextDropStopId));
      if (!pickupRow || !dropRow || Number(dropRow.stop_order) <= Number(pickupRow.stop_order)) continue;

      const routePoints = rows.map((item) => toPoint(item.stop?.lat, item.stop?.lng)).filter(Boolean);
      const eta = estimateEta(
        toLocPoint(trip.latest_location),
        toPoint(pickupRow.stop?.lat, pickupRow.stop?.lng),
        routePoints,
        trip.latest_location?.speed,
      );

      let openSeats = trip.open_seats ?? null;
      let seatsTotal = trip.seats_total ?? null;
      let occupancyPercent = trip.occupancy_percent ?? null;
      let occupancyLabel = trip.occupancy_label || "";
      let fareEstimate = Number(trip.fare_estimate || 0);

      try {
        const availability = await api.get(`/api/bookings/trips/${trip.id}/availability/?from=${pickupRow.stop_order}&to=${dropRow.stop_order}`);
        const seatsData = availability.data.seats || [];
        seatsTotal = seatsData.length;
        openSeats = seatsData.filter((seat) => seat.available).length;
        occupancyPercent = seatsData.length ? Math.round(((seatsData.length - openSeats) / seatsData.length) * 100) : 0;
        occupancyLabel = occupancyPercent >= 80 ? "High Occupancy" : occupancyPercent >= 50 ? "Med Occupancy" : "Low Occupancy";
        fareEstimate = Number(availability.data.fare_per_seat || 0);
      } catch {
        if (!occupancyLabel) occupancyLabel = "Availability updating";
      }

      matches.push({
        ...trip,
        from_order: Number(pickupRow.stop_order),
        to_order: Number(dropRow.stop_order),
        pickup_stop_name: pickupRow.stop?.name,
        destination_stop_name: dropRow.stop?.name,
        open_seats: openSeats,
        seats_total: seatsTotal,
        occupancy_percent: occupancyPercent,
        occupancy_label: occupancyLabel || "Availability updating",
        fare_estimate: fareEstimate,
        eta,
      });
    }

    return matches;
  }, [ensureCtx, hydrateTrip]);
  const loadBase = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [stopsResponse, liveTrips] = await Promise.all([api.get("/api/transport/stops/"), refreshLiveTrips()]);
      const liveStops = stopsResponse.data.stops || [];
      setStops(liveStops);
      setErr("");
      return liveTrips;
    } catch (error) { if (!silent) setErr(error?.response?.data?.detail || "Unable to load MetroBus passenger data."); } finally { if (!silent) setLoading(false); }
  }, [refreshLiveTrips]);
  const loadSeats = useCallback(async (tripId, fromOrder, toOrder) => {
    if (!tripId || !fromOrder || !toOrder) { setSeats([]); setSelectedSeatIds([]); return; }
    setLoadingSeats(true);
    try {
      const response = await api.get(`/api/bookings/trips/${tripId}/availability/?from=${fromOrder}&to=${toOrder}`);
      const seatsData = response.data.seats || [];
      const heldIds = response.data.selected_seat_ids || seatsData.filter((seat) => seat.held_by_me).map((seat) => seat.seat_id);
      setSeats(seatsData); setSelectedSeatIds(heldIds); syncTripSeatMeta(tripId, seatsData);
    } catch (error) { setErr(error?.response?.data?.detail || "Unable to load seats."); setSeats([]); setSelectedSeatIds([]); } finally { setLoadingSeats(false); }
  }, [syncTripSeatMeta]);
  const syncSeatHolds = useCallback(async (tripId, fromOrder, toOrder, seatIds) => {
    const response = await api.post(`/api/bookings/trips/${tripId}/holds/`, { from_stop_order: fromOrder, to_stop_order: toOrder, seat_ids: seatIds });
    const seatsData = response.data.seats || [];
    const heldIds = response.data.selected_seat_ids || seatsData.filter((seat) => seat.held_by_me).map((seat) => seat.seat_id);
    setSeats(seatsData); setSelectedSeatIds(heldIds); syncTripSeatMeta(tripId, seatsData);
  }, [syncTripSeatMeta]);
  const releaseAcceptedTripHolds = useCallback(async () => {
    if (!acceptedTrip?.id || !acceptedTrip.from_order || !acceptedTrip.to_order) return;
    try { await syncSeatHolds(acceptedTrip.id, acceptedTrip.from_order, acceptedTrip.to_order, []); } catch { /* holds expire automatically */ }
  }, [acceptedTrip, syncSeatHolds]);
  releaseHoldRef.current = releaseAcceptedTripHolds;

  useEffect(() => {
    loadBase();
    loadBookings();
    loadWalletSummary();
  }, [loadBase, loadBookings, loadWalletSummary]);

  useEffect(() => {
    const tripRefresh = setInterval(() => loadBase({ silent: true }), activeBookingId ? 3000 : 7000);
    return () => clearInterval(tripRefresh);
  }, [activeBookingId, loadBase]);

  useEffect(() => {
    const bookingRefresh = setInterval(() => loadBookings({ silent: true }), activeBookingId || hasPaymentAttention ? 3000 : 15000);
    return () => clearInterval(bookingRefresh);
  }, [activeBookingId, hasPaymentAttention, loadBookings]);

  useEffect(() => {
    const walletRefresh = setInterval(() => loadWalletSummary({ silent: true }), 30000);
    return () => clearInterval(walletRefresh);
  }, [loadWalletSummary]);
  useEffect(() => {
    if (!acceptedTrip?.id || !acceptedTrip.from_order || !acceptedTrip.to_order) { setSeats([]); setSelectedSeatIds([]); return; }
    loadSeats(acceptedTrip.id, acceptedTrip.from_order, acceptedTrip.to_order);
  }, [acceptedTrip?.from_order, acceptedTrip?.id, acceptedTrip?.to_order, loadSeats]);
  useEffect(() => { if (activeBooking?.trip_id) { setSelectedTripId(String(activeBooking.trip_id)); setAcceptedTripId(""); } }, [activeBooking?.trip_id]);
  useEffect(() => {
    if (routePolyline.length < 2) { setRoadPolyline([]); return undefined; }
    const controller = new AbortController();
    snapRouteToRoad(routePolyline, controller.signal).then((points) => setRoadPolyline(points.length > 1 ? points : [])).catch((error) => { if (error.name !== "AbortError") setRoadPolyline([]); });
    return () => controller.abort();
  }, [routePolyline]);
  useEffect(() => () => { releaseHoldRef.current(); }, []);
  useEffect(() => {
    if (!activeSearch?.pickupStopId || !activeSearch?.dropStopId || activeBooking) return undefined;
    let cancelled = false;

    const syncMatches = async () => {
      try {
        const matches = await buildMatchedTripCards(trips, activeSearch.pickupStopId, activeSearch.dropStopId);
        if (cancelled) return;
        setMatchedTrips(matches);
        setSelectedTripId((current) => (current && matches.some((trip) => String(trip.id) === String(current)) ? current : String(matches[0]?.id || "")));
      } catch {
        if (!cancelled) setMatchedTrips([]);
      }
    };

    syncMatches();
    return () => { cancelled = true; };
  }, [activeBooking, activeSearch, buildMatchedTripCards, trips]);

  const findRoutes = async () => {
    if (!pickupStopId || !dropStopId) return setErr("Choose both pickup and destination stops first.");
    if (String(pickupStopId) === String(dropStopId)) return setErr("Pickup and destination must be different.");
    const nextSearch = { pickupStopId: String(pickupStopId), dropStopId: String(dropStopId) };
    setFindingRoutes(true); setErr(""); setMsg(""); setAcceptedTripId(""); setDismissedMatchIds([]); setActiveSearch(nextSearch);
    try {
      let liveTrips = trips;
      try {
        liveTrips = await refreshLiveTrips();
      } catch (refreshError) {
        if (!liveTrips.length) throw refreshError;
      }
      const matches = await buildMatchedTripCards(liveTrips, nextSearch.pickupStopId, nextSearch.dropStopId);
      setMatchedTrips(matches); setSelectedTripId(String(matches[0]?.id || ""));
      matches.length ? setMsg(`${matches.length} bus${matches.length !== 1 ? "es" : ""} found for your route.`) : setErr("No live buses match that route right now.");
    } catch (error) { setErr(error?.response?.data?.detail || "Unable to find live buses."); } finally { setFindingRoutes(false); }
  };
  const acceptMatchedTrip = (tripId) => { setAcceptedTripId(String(tripId)); setSelectedTripId(String(tripId)); setErr(""); setMsg("Bus selected. Choose your seat from the seat layout."); };
  const declineMatchedTrip = (tripId) => setDismissedMatchIds((current) => (current.includes(String(tripId)) ? current : [...current, String(tripId)]));
  const closeSeatSheet = async () => { await releaseAcceptedTripHolds(); setAcceptedTripId(""); setSelectedSeatIds([]); setSeats([]); };
  const toggleSeat = async (seat) => {
    if (!acceptedTrip?.id) return;
    const selected = selectedSeatIds.includes(seat.seat_id);
    if (!selected && !seat.available && !seat.held_by_me) return;
    const nextSeatIds = selected ? selectedSeatIds.filter((seatId) => seatId !== seat.seat_id) : [...selectedSeatIds, seat.seat_id];
    setHoldBusy(true); setErr("");
    try { await syncSeatHolds(acceptedTrip.id, acceptedTrip.from_order, acceptedTrip.to_order, nextSeatIds); } catch (error) { setErr(error?.response?.data?.detail || "Unable to lock that seat right now."); await loadSeats(acceptedTrip.id, acceptedTrip.from_order, acceptedTrip.to_order); } finally { setHoldBusy(false); }
  };
  const confirmBooking = async () => {
    if (!acceptedTrip?.id || !selectedSeatIds.length) return setErr("Choose at least one seat before confirming the booking.");
    if (activeBooking && Number(activeBooking.trip_id) !== Number(acceptedTrip.id)) return setErr("Finish or cancel your current ride before booking another one.");
    setBookingBusy(true); setErr(""); setMsg("");
    try {
      const response = await api.post(`/api/bookings/trips/${acceptedTrip.id}/book/`, { from_stop_order: acceptedTrip.from_order, to_stop_order: acceptedTrip.to_order, seat_ids: selectedSeatIds });
      setCheckoutBookingId(response.data.id); setAcceptedTripId(""); setActiveSearch(null); setMatchedTrips([]); setDismissedMatchIds([]); setSelectedSeatIds([]); setSeats([]); setSelectedTripId(String(acceptedTrip.id)); setMsg(`Booking #${response.data.id} confirmed. Your ride OTP is ready.`); await Promise.all([loadBookings({ silent: true }), loadBase({ silent: true })]);
    } catch (error) { setErr(error?.response?.data?.detail || "Booking failed."); await loadSeats(acceptedTrip.id, acceptedTrip.from_order, acceptedTrip.to_order); } finally { setBookingBusy(false); }
  };
  const openPayment = (bookingId) => { if (bookingId) setCheckoutBookingId(Number(bookingId)); setPaymentPanelOpen(true); };
  const pay = async (method, bookingId = checkoutBookingId || paymentActionBooking?.id || activeBooking?.id) => {
    if (method === "OPEN_CHECKOUT") return openPayment(bookingId);
    if (!bookingId) return setErr("There is no active booking ready for payment.");
    setPaymentBusy(true); setErr(""); setMsg("");
    try {
      const response = await api.post("/api/payments/create/", { booking_id: bookingId, method });
      const { redirect, payment } = response.data;
      if (response.data.wallet) setWalletSummary(response.data.wallet);
      if (redirect?.type === "REDIRECT" && redirect.url) { window.location.href = redirect.url; return; }
      if (redirect?.type === "FORM_POST" && redirect.url) { buildFormPost(redirect); return; }
      await Promise.all([loadBookings({ silent: true }), loadWalletSummary({ silent: true })]);
      if (payment?.status === "SUCCESS") { setMsg("Payment completed for this booking."); setPaymentPanelOpen(false); } else if (payment?.status === "PENDING") setMsg(method === "CASH" ? "Cash selected. Hand the fare to the helper so they can verify it." : "Payment is pending. Keep MetroBus open while MetroBus checks the status."); else setMsg(`Payment ${payment?.status || "updated"}.`);
    } catch (error) { setErr(error?.response?.data?.detail || "Payment failed."); } finally { setPaymentBusy(false); }
  };
  const requestCancellation = (booking) => { if (!booking?.can_cancel) return setErr("This ride can no longer be cancelled."); setCancellationBookingId(booking.id); setCancellationReason(""); setCancellationNote(""); setErr(""); setMsg(""); };
  const closeCancellationSheet = () => { setCancellationBookingId(null); setCancellationReason(""); setCancellationNote(""); };
  const confirmPassengerCancellation = async () => {
    if (!cancellationBookingId || !cancellationReason) return setErr("Choose a cancellation reason first.");
    if (cancellationReason === "OTHER" && !cancellationNote.trim()) return setErr("Please enter a short note for the cancellation.");
    setCancellationBusy(true); setErr(""); setMsg("");
    try {
      const response = await api.post(`/api/bookings/${cancellationBookingId}/cancel/`, { reason: cancellationReason, note: cancellationNote.trim() });
      setBookings((current) => current.map((booking) => (Number(booking.id) === Number(cancellationBookingId) ? response.data.booking || booking : booking)));
      setActiveSearch(null);
      setMatchedTrips([]); setDismissedMatchIds([]); setSelectedTripId(""); setAcceptedTripId(""); setPaymentPanelOpen(false); closeCancellationSheet(); setMsg(response.data.message || "Ride cancelled."); await loadBookings({ silent: true });
    } catch (error) { setErr(error?.response?.data?.note?.[0] || error?.response?.data?.detail || "Unable to cancel this ride."); } finally { setCancellationBusy(false); }
  };
  const handleLogout = useCallback(async () => { await releaseAcceptedTripHolds(); clearToken(); setUser(null); navigate("/auth/login", { replace: true }); }, [navigate, releaseAcceptedTripHolds, setUser]);

  if (showSplash) return <div style={theme} className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,var(--bg),var(--bg-soft))]"><div className={shell}><div className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] px-6 py-8 shadow-[var(--shadow)]"><div className="flex items-center gap-4"><LogoMark /><div><p className="text-[0.72rem] font-black uppercase tracking-[0.24em] text-[var(--muted)]">MetroBus</p><p className="text-[1.6rem] font-black text-[var(--text)]">Passenger Home</p></div></div></div></div></div>;
  if (loading) return <div style={theme} className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,var(--bg),var(--bg-soft))] px-6 text-center text-lg font-semibold text-[var(--muted)]">Loading your MetroBus passenger dashboard...</div>;

  const occupancyPercent = focusTrip?.occupancy_percent ?? 0;
  const etaText = focusTrip?.eta?.minutes ? `${Math.max(1, Math.round(focusTrip.eta.minutes))} min` : "Live";
  const rideSeatLabels = activeBooking?.seat_labels?.join(", ") || "--";
  const selectedSeatLabels = seats.filter((seat) => selectedSeatIds.includes(seat.seat_id)).map((seat) => seat.seat_no);
  const selectedSeatTotal = (acceptedTrip?.fare_estimate || 0) * selectedSeatIds.length;

  return (
    <div style={theme} className="min-h-screen bg-[linear-gradient(180deg,var(--bg),var(--bg-soft))] text-[var(--text)]">
      <div className={`mx-auto flex min-h-screen max-w-[34rem] flex-col ${shell}`}>
        <header className="sticky top-0 z-30 flex items-center justify-between rounded-b-[2rem] border-b border-[var(--border)] bg-[var(--header)] px-4 py-4 backdrop-blur-xl"><div className="flex items-center gap-3"><LogoMark /><div><p className="text-[0.64rem] font-black uppercase tracking-[0.22em] text-[var(--muted)]">MetroBus</p><p className="text-lg font-black text-[var(--text)]">Passenger</p></div></div><div className="flex items-center gap-2"><button type="button" onClick={handleLogout} className="rounded-full border border-[rgba(219,61,79,0.18)] bg-[rgba(219,61,79,0.10)] px-4 py-2 text-[0.7rem] font-black uppercase tracking-[0.16em] text-[var(--danger)] shadow-[var(--shadow)]">Logout</button><button type="button" onClick={() => setTab("account")} className="grid h-12 w-12 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-strong)] text-sm font-black text-[var(--primary)] shadow-[var(--shadow)]">{initials(user?.full_name)}</button></div></header>
        <main className="flex-1 px-4 pb-28 pt-5">
          {err ? <p className="mb-4 rounded-[1rem] bg-[rgba(219,61,79,0.12)] px-4 py-3 text-sm font-semibold text-[var(--danger)]">{err}</p> : null}
          {msg ? <p className="mb-4 rounded-[1rem] bg-[rgba(23,165,103,0.12)] px-4 py-3 text-sm font-semibold text-[var(--success)]">{msg}</p> : null}
          {tab === "home" ? (
            <SurfaceCard className="overflow-hidden">
              {activeBooking ? (
                <>
                  <div className="px-5 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[var(--primary)]">Current Ride</p>
                        <h2 className="mt-3 text-[2rem] font-black leading-tight text-[var(--text)]">{activeBooking.pickup_stop_name} to {activeBooking.destination_stop_name}</h2>
                        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{focusTrip?.route_name || activeBooking.route_name} on {focusTrip?.bus_plate || activeBooking.bus_plate}</p>
                      </div>
                      <StatusPill tone={occupancyTone(occupancyPercent)}>{focusTrip?.occupancy_label || "Ride Live"}</StatusPill>
                    </div>
                  </div>

                  <div className="border-t border-[var(--border)] overflow-hidden">
                    <div className="h-[54vh] min-h-[24rem]">
                      {mapPoints.length ? (
                        <MapContainer center={mapPoints[0]} zoom={13} className="h-full w-full" scrollWheelZoom={false}>
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                          <MapViewport points={mapPoints} />
                          {displayLine.length > 1 ? <Polyline positions={displayLine} pathOptions={{ color: isDark ? "#8d5abf" : "#4b2666", weight: 6, opacity: 0.78 }} /> : null}
                          {liveBusPoint ? (
                            <CircleMarker center={liveBusPoint} radius={9} pathOptions={{ color: "#ff8a1f", fillColor: "#ff8a1f", fillOpacity: 0.98, weight: 3 }}>
                              <Popup>
                                <div className="space-y-1 text-sm">
                                  <p className="font-black">{focusTrip?.bus_plate || "MetroBus"}</p>
                                  <p>{focusTrip?.route_name || "Live route"}</p>
                                  <p className="text-[var(--muted)]">ETA {etaText}</p>
                                </div>
                              </Popup>
                            </CircleMarker>
                          ) : null}
                        </MapContainer>
                      ) : (
                        <div className="grid h-full place-items-center bg-[var(--bg-soft)] px-6 text-center text-sm font-medium text-[var(--muted)]">Live route preview will appear here once the trip position is available.</div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="px-5 py-5">
                    <p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[var(--primary)]">Book a Ride</p>
                    <h2 className="mt-3 text-[2rem] font-black leading-tight text-[var(--text)]">Search for the next MetroBus on your route</h2>
                    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Search, compare live buses, accept one, and confirm seats from the same home page.</p>
                    <div className="mt-5 grid gap-4">
                      <SelectField label="Pickup stop" value={pickupStopId} onChange={setPickupStopId} options={stopOptions} />
                      <SelectField label="Destination stop" value={dropStopId} onChange={setDropStopId} options={stopOptions} />
                      <ActionButton onClick={findRoutes} disabled={findingRoutes}>
                        <Icon name="search" className="h-4 w-4" />
                        {findingRoutes ? "Finding Buses..." : "Search Rides"}
                      </ActionButton>
                    </div>
                  </div>

                  <div className="border-t border-[var(--border)] px-5 py-5">
                    <p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[var(--primary)]">Ride Flow</p>
                    <h3 className="mt-3 text-[1.5rem] font-black text-[var(--text)]">Ride cards and seat popup stay on this same screen</h3>
                    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Each available bus shows its bus number, occupancy, ETA, and accept or decline buttons. After you accept one, the seat layout opens from the bottom.</p>
                  </div>
                </>
              )}
            </SurfaceCard>
          ) : null}
          {tab === "rides" ? <SurfaceCard className="p-6"><p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[var(--primary)]">Passenger Rides</p><h2 className="mt-3 text-[2rem] font-black leading-tight text-[var(--text)]">Ride history page is next</h2><p className="mt-4 text-sm leading-7 text-[var(--muted)]">The footer navigation is ready. We can shape the dedicated passenger rides page after this home redesign.</p></SurfaceCard> : null}
          {tab === "support" ? <SurfaceCard className="p-6"><p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[var(--primary)]">Passenger Support</p><h2 className="mt-3 text-[2rem] font-black leading-tight text-[var(--text)]">Support page is ready for the next step</h2><p className="mt-4 text-sm leading-7 text-[var(--muted)]">For now the redesigned work is focused on booking and live ride flow. We can build the support page next.</p></SurfaceCard> : null}
          {tab === "account" ? <section className="space-y-4"><SurfaceCard className="p-6"><p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[var(--primary)]">Passenger Account</p><h2 className="mt-3 text-[2rem] font-black leading-tight text-[var(--text)]">{user?.full_name || "MetroBus Passenger"}</h2><p className="mt-2 text-sm leading-7 text-[var(--muted)]">{user?.phone || "--"} {user?.email ? `| ${user.email}` : ""}</p></SurfaceCard><SurfaceCard className="p-6"><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-[1.4rem] bg-[var(--accent-soft)] px-4 py-4"><p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--muted)]">Wallet Balance</p><p className="mt-2 text-[1.6rem] font-black text-[var(--text)]">{fmtMoney(walletSummary?.balance || 0)}</p></div><div className="rounded-[1.4rem] bg-[var(--accent-soft)] px-4 py-4"><p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--muted)]">Reward Points</p><p className="mt-2 text-[1.6rem] font-black text-[var(--text)]">{walletSummary?.reward_points ?? 0}</p></div></div></SurfaceCard><ActionButton tone="danger" onClick={handleLogout}>Log Out</ActionButton></section> : null}
        </main>
        <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--footer)] px-4 py-3 backdrop-blur-xl"><div className={`mx-auto grid max-w-[34rem] grid-cols-4 gap-2 ${shell}`}>{TABS.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex flex-col items-center gap-2 rounded-[1.2rem] px-3 py-3 text-[0.72rem] font-black transition ${tab === item.id ? "bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-white shadow-[var(--shadow-strong)]" : "text-[var(--muted)]"}`}><Icon name={item.icon} className="h-5 w-5" /><span>{item.label}</span></button>)}</div></footer>
        {!activeBooking && visibleMatchedTrips.length && !acceptedTrip ? <div className="fixed inset-0 z-40 bg-[rgba(25,15,36,0.38)] px-4 pb-24 pt-24 backdrop-blur-sm"><div className={`mx-auto max-h-full max-w-[34rem] overflow-y-auto ${shell}`}><div className="space-y-4">{visibleMatchedTrips.map((trip) => { const fullPercent = trip.occupancy_percent ?? 0; const canAccept = trip.open_seats == null || trip.open_seats > 0; return <SurfaceCard key={trip.id} className="p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[var(--primary)]">Available Bus</p><h3 className="mt-3 text-[1.7rem] font-black leading-tight text-[var(--text)]">{trip.route_name}</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Bus number {trip.bus_plate || "--"}</p></div><StatusPill tone={occupancyTone(fullPercent)}>{trip.occupancy_label || `${fullPercent}% Full`}</StatusPill></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-[1.2rem] bg-[var(--accent-soft)] px-4 py-4"><p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">ETA</p><p className="mt-2 text-lg font-black text-[var(--text)]">{trip.eta?.minutes ? `${Math.max(1, Math.round(trip.eta.minutes))} min` : "Live"}</p></div><div className="rounded-[1.2rem] bg-[var(--accent-soft)] px-4 py-4"><p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Occupancy</p><p className="mt-2 text-lg font-black text-[var(--text)]">{fullPercent}% Full</p></div><div className="rounded-[1.2rem] bg-[var(--accent-soft)] px-4 py-4"><p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Fare</p><p className="mt-2 text-lg font-black text-[var(--text)]">{fmtMoney(trip.fare_estimate || 0)}</p></div></div><div className="mt-5 grid grid-cols-2 gap-3"><ActionButton tone="secondary" onClick={() => declineMatchedTrip(trip.id)}>Decline</ActionButton><ActionButton onClick={() => acceptMatchedTrip(trip.id)} disabled={!canAccept}>{canAccept ? "Accept Ride" : "Bus Full"}</ActionButton></div></SurfaceCard>; })}</div></div></div> : null}
        {!activeBooking && acceptedTrip ? (
          <div className="fixed inset-0 z-50 bg-[rgba(25,15,36,0.38)] px-4 pb-24 pt-20 backdrop-blur-sm">
            <div className={`mx-auto flex max-h-full max-w-[34rem] flex-col justify-end ${shell}`}>
              <SurfaceCard className="max-h-full overflow-hidden rounded-[2rem]">
                <div className="max-h-[86vh] overflow-y-auto">
                  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[rgba(255,255,255,0.82)] px-5 py-4 backdrop-blur-xl">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={closeSeatSheet} className="grid h-11 w-11 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--primary)]">
                        <Icon name="back" className="h-5 w-5" />
                      </button>
                      <div>
                        <p className="text-[0.72rem] font-black uppercase tracking-[0.24em] text-[var(--muted)]">Seat Selection</p>
                        <p className="text-lg font-black text-[var(--text)]">Passenger Window</p>
                      </div>
                    </div>
                    <p className="text-lg font-black text-[var(--primary)]">MetroBus</p>
                  </div>

                  <div className="p-5">
                    <div>
                      <p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[var(--primary)]">Select Seats</p>
                      <h3 className="mt-3 text-[1.8rem] font-black leading-tight text-[var(--text)]">{acceptedTrip.route_name}</h3>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Choose your seats and confirm the booking from this same popup.</p>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[1.2rem] bg-[var(--accent-soft)] px-4 py-4">
                        <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">ETA</p>
                        <p className="mt-2 text-lg font-black text-[var(--text)]">{acceptedTrip.eta?.minutes ? `${Math.max(1, Math.round(acceptedTrip.eta.minutes))} min` : "Live"}</p>
                      </div>
                      <div className="rounded-[1.2rem] bg-[var(--accent-soft)] px-4 py-4">
                        <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Fare / Seat</p>
                        <p className="mt-2 text-lg font-black text-[var(--text)]">{fmtMoney(acceptedTrip.fare_estimate || 0)}</p>
                      </div>
                      <div className="rounded-[1.2rem] bg-[var(--accent-soft)] px-4 py-4">
                        <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Occupancy</p>
                        <p className="mt-2 text-lg font-black text-[var(--text)]">{acceptedTrip.occupancy_percent ?? 0}% Full</p>
                      </div>
                    </div>

                    <div className="mt-5">
                      <MetroSeatBoard
                        title="Seat Selection"
                        routeName={acceptedTrip.route_name}
                        busLabel={acceptedTrip.bus_plate || "--"}
                        seats={seats}
                        mode="passenger"
                        selectedSeatIds={selectedSeatIds}
                        onSeatClick={toggleSeat}
                        loading={loadingSeats}
                        loadingMessage="Loading live seat layout..."
                        emptyMessage="Seat layout is not ready for this bus yet."
                        summarySlot={(
                          <div className="rounded-[1.65rem] bg-[var(--surface-strong)] p-4 sm:p-5">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Selected Seats</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {selectedSeatLabels.length ? selectedSeatLabels.map((label) => (
                                    <span key={label} className="rounded-full bg-[var(--bg-soft)] px-3 py-2 text-[0.78rem] font-black text-[var(--primary)] shadow-[inset_0_0_0_1px_rgba(75,38,102,0.08)]">{label}</span>
                                  )) : (
                                    <span className="rounded-full bg-[var(--bg-soft)] px-3 py-2 text-[0.78rem] font-black text-[var(--muted)] shadow-[inset_0_0_0_1px_rgba(75,38,102,0.08)]">Choose seats</span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Total Price</p>
                                <p className="mt-2 text-[2rem] font-black leading-none text-[var(--primary)]">{fmtMoney(selectedSeatTotal || 0)}</p>
                              </div>
                            </div>
                            <p className="mt-4 text-sm leading-6 text-[var(--muted)]">Selected seats are temporarily hidden from other passengers until you confirm or the hold expires.</p>
                            <div className="mt-4 grid grid-cols-2 gap-3">
                              <ActionButton tone="secondary" onClick={closeSeatSheet}>
                                <Icon name="back" className="h-4 w-4" />
                                Back
                              </ActionButton>
                              <ActionButton onClick={confirmBooking} disabled={bookingBusy || holdBusy || !selectedSeatIds.length}>
                                {bookingBusy ? "Confirming..." : holdBusy ? "Locking Seats..." : "Confirm Booking"}
                              </ActionButton>
                            </div>
                          </div>
                        )}
                      />
                    </div>
                  </div>
                </div>
              </SurfaceCard>
            </div>
          </div>
        ) : null}
        {activeBooking ? <div className="pointer-events-none fixed inset-x-0 bottom-24 z-20 px-4"><div className={`mx-auto max-w-[34rem] space-y-3 ${shell}`}><div className="pointer-events-auto rounded-[1.8rem] border border-[var(--border)] bg-[var(--surface-strong)] px-5 py-5 shadow-[var(--shadow-strong)] backdrop-blur-xl"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--muted)]">Ride OTP</p><p className="mt-2 text-[1.8rem] font-black tracking-[0.12em] text-[var(--primary)]">{String(activeBooking.boarding_otp || "").padStart(4, "0").slice(-4)}</p><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Show this OTP to the helper when the bus arrives. Seat {rideSeatLabels}</p></div><div className="rounded-[1.2rem] bg-[var(--accent-soft)] px-4 py-4"><p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Bus ETA</p><p className="mt-2 text-lg font-black text-[var(--text)]">{etaText}</p></div></div>{paymentActionBooking || paymentPendingBooking ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] bg-[var(--accent-soft)] px-4 py-4"><p className="text-sm font-semibold text-[var(--text)]">Payment update is waiting for this booking.</p><ActionButton className="px-4 py-3 text-xs" onClick={() => openPayment((paymentActionBooking || paymentPendingBooking)?.id)}>Open Payment</ActionButton></div> : null}</div>{activeBooking.can_cancel ? <ActionButton tone="danger" className="pointer-events-auto w-full" onClick={() => requestCancellation(activeBooking)}>Cancel Ride</ActionButton> : null}</div></div> : null}
        {cancellationBooking ? <div className="fixed inset-0 z-50 bg-[rgba(25,15,36,0.38)] px-4 pb-24 pt-20 backdrop-blur-sm"><div className={`mx-auto flex max-h-full max-w-[34rem] flex-col justify-end ${shell}`}><SurfaceCard className="rounded-[2rem] p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[var(--danger)]">Cancel Ride</p><h3 className="mt-3 text-[1.7rem] font-black leading-tight text-[var(--text)]">{cancellationBooking.pickup_stop_name} to {cancellationBooking.destination_stop_name}</h3></div><button type="button" onClick={closeCancellationSheet} className="grid h-11 w-11 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--primary)]"><Icon name="close" className="h-5 w-5" /></button></div><div className="mt-5 grid gap-3">{CANCELLATION_REASONS.map((reason) => <button key={reason.value} type="button" onClick={() => setCancellationReason(reason.value)} className={`rounded-[1.2rem] border px-4 py-4 text-left text-sm font-black ${cancellationReason === reason.value ? "border-[var(--danger)] bg-[rgba(219,61,79,0.10)] text-[var(--danger)]" : "border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text)]"}`}>{reason.label}</button>)}</div>{cancellationReason === "OTHER" ? <textarea value={cancellationNote} onChange={(event) => setCancellationNote(event.target.value)} placeholder="Tell us why you are cancelling this ride..." className="mt-4 min-h-[7rem] w-full rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-4 text-sm font-medium text-[var(--text)] outline-none" /> : null}<div className="mt-5 grid grid-cols-2 gap-3"><ActionButton tone="secondary" onClick={closeCancellationSheet}>Back</ActionButton><ActionButton tone="danger" onClick={confirmPassengerCancellation} disabled={cancellationBusy}>{cancellationBusy ? "Cancelling..." : "Confirm Cancel"}</ActionButton></div></SurfaceCard></div></div> : null}
        {paymentPanelOpen ? <div className="fixed inset-0 z-[60] overflow-y-auto bg-[rgba(25,15,36,0.38)] px-4 pb-24 pt-10 backdrop-blur-sm"><div style={PASSENGER_THEME} className={`mx-auto max-w-[34rem] ${shell}`}><div className="mb-4 flex justify-end"><button type="button" onClick={() => setPaymentPanelOpen(false)} className="rounded-full bg-white px-4 py-2 text-sm font-black text-[var(--mb-purple)] shadow-[var(--mb-shadow)]">Close Checkout</button></div><CheckoutPage booking={checkoutBooking} walletSummary={walletSummary} paymentBusy={paymentBusy} onPay={pay} onBack={() => setPaymentPanelOpen(false)} onTrack={() => { setPaymentPanelOpen(false); setTab("home"); }} onViewTicket={() => { setPaymentPanelOpen(false); setTab("rides"); }} /></div></div> : null}
      </div>
    </div>
  );
}
