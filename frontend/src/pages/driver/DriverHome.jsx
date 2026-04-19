import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { api } from "../../api";
import { useAuth } from "../../AuthContext";
import { clearToken } from "../../auth";
import MetroSeatBoard from "../../components/shared/MetroSeatBoard";
import { snapRouteToRoad } from "../../lib/mapRoute";
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
  { id: "seats", label: "Seats", icon: "route" },
  { id: "expenses", label: "Expenses", icon: "assignment" },
  { id: "simulate", label: "Simulate", icon: "simulate" },
  { id: "history", label: "History", icon: "history" },
  { id: "account", label: "Account", icon: "account" },
];

function Icon({ name, className = "h-5 w-5" }) {
  const common = { className, fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24" };
  switch (name) {
    case "home": return <svg {...common}><path d="M4 10.5 12 4l8 6.5" /><path d="M7 10v8h10v-8" /></svg>;
    case "route": return <svg {...common}><path d="M5 19c2.4-4.2 3.6-10.1 6.1-13.9 1-1.5 3.5-1.5 4.5 0 1.1 1.6.8 3.6-.7 4.9L9.2 15" /><circle cx="6" cy="19" r="1.5" /><circle cx="18" cy="5" r="1.5" /></svg>;
    case "simulate": return <svg {...common}><path d="M4 18c1.6-3.1 3.7-5.6 6.1-7.5 2.3-1.8 5.1-3.2 9.9-4.5" /><path d="m16 5 4 1-2 3" /><circle cx="7" cy="18" r="1.5" /></svg>;
    case "history": return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" /><path d="M12 7v5l3 2" /></svg>;
    case "account": return <svg {...common}><circle cx="12" cy="8" r="3.2" /><path d="M5 19a7 7 0 0 1 14 0" /></svg>;
    case "assignment": return <svg {...common}><rect x="6" y="4" width="12" height="16" rx="2" /><path d="M9 4.5h6" /><path d="M9 10h6" /><path d="M9 14h6" /></svg>;
    case "play": return <svg {...common}><path d="m8 6 10 6-10 6V6Z" /></svg>;
    case "stop": return <svg {...common}><rect x="7" y="7" width="10" height="10" rx="2" /></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>;
  }
}

function MapViewport({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(points, { padding: [26, 26] });
  }, [map, points]);
  return null;
}

function ActionButton({ children, tone = "primary", className = "", ...props }) {
  const tones = {
    primary: "bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-white shadow-[var(--shadow-strong)]",
    secondary: "border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text)]",
    danger: "bg-[linear-gradient(135deg,#a92b3c,#ff6e55)] text-white shadow-[var(--shadow-strong)]",
  };
  return <button type="button" className={`inline-flex w-full items-center justify-center gap-2 rounded-[1.2rem] px-5 py-4 text-sm font-black tracking-[0.04em] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-55 ${tones[tone] || tones.primary} ${className}`} {...props}>{children}</button>;
}

function TextField({ label, value, onChange, placeholder = "", type = "text" }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--muted)]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3.5 text-sm font-semibold text-[var(--text)] outline-none"
      />
    </label>
  );
}

const fmtTime = (v) => {
  if (!v) return "--";
  try { return new Date(v).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch { return v; }
};

const fmtDateTime = (v) => {
  if (!v) return "--";
  try { return new Date(v).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return v; }
};

const initials = (name) => {
  if (!name) return "DR";
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "DR";
};

const distance = (a, b) => (!a || !b ? Infinity : Math.sqrt((Number(a[0]) - Number(b[0])) ** 2 + (Number(a[1]) - Number(b[1])) ** 2));

export default function DriverHome() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const { isDark } = useTheme();
  const theme = useMemo(() => (isDark ? DARK : LIGHT), [isDark]);
  const shell = "enterprise-mobile-shell";

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("home");
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [routeStops, setRouteStops] = useState([]);
  const [routePathPoints, setRoutePathPoints] = useState([]);
  const [roadPolyline, setRoadPolyline] = useState([]);
  const [passengerRequests, setPassengerRequests] = useState([]);
  const [latestLocation, setLatestLocation] = useState(null);
  const [simBusy, setSimBusy] = useState(false);
  const [simStepMs, setSimStepMs] = useState("3000");
  const [seats, setSeats] = useState([]);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [fromOrder, setFromOrder] = useState("");
  const [toOrder, setToOrder] = useState("");
  const [seatView, setSeatView] = useState("combined");
  const [historyData, setHistoryData] = useState({ summary: null, trips: [] });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expenseData, setExpenseData] = useState({ summary: null, expenses: [] });
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: "", email: "" });
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [expenseForm, setExpenseForm] = useState({
    category: "FUEL",
    amount: "",
    note: "",
    incurred_at: "",
  });
  const [checklist, setChecklist] = useState({
    documents: false,
    fuel: false,
    brakes: false,
    cleanliness: false,
  });

  const activeTrip = dashboard?.active_trip ?? null;
  const pendingTrip = dashboard?.pending_trip ?? null;
  const trip = activeTrip || pendingTrip;
  const schedules = dashboard?.schedules ?? [];
  const assignedBus = dashboard?.assigned_bus ?? null;
  const assignedRouteReady = Boolean(assignedBus?.route && assignedBus?.helper);
  const assignedBusNeedsAcceptance = Boolean(assignedRouteReady && !assignedBus?.driver_assignment_accepted);
  const simulation = dashboard?.simulation ?? null;

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

  const routeStopPolyline = useMemo(() => routeStops.map((item) => [Number(item.stop?.lat), Number(item.stop?.lng)]).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)), [routeStops]);
  const routePolyline = useMemo(() => {
    const path = (routePathPoints || [])
      .map((point) => Array.isArray(point) ? [Number(point[0]), Number(point[1])] : [Number(point?.lat), Number(point?.lng)])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    return path.length > 1 ? path : routeStopPolyline;
  }, [routePathPoints, routeStopPolyline]);
  const routePolylineSignature = useMemo(() => JSON.stringify(routePolyline), [routePolyline]);
  const displayLine = useMemo(() => roadPolyline.length > 1 ? roadPolyline : routePolyline, [roadPolyline, routePolyline]);
  const liveBusPoint = useMemo(() => {
    if (!latestLocation) return null;
    const lat = Number(latestLocation.lat);
    const lng = Number(latestLocation.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }, [latestLocation]);

  const pickupRequests = useMemo(() => passengerRequests.filter((item) => item.stage === "pickup"), [passengerRequests]);
  const dropRequests = useMemo(() => passengerRequests.filter((item) => item.stage === "dropoff"), [passengerRequests]);
  const stopIndex = useMemo(() => {
    if (!liveBusPoint || !routeStopPolyline.length) return -1;
    let best = -1;
    let bestDistance = Infinity;
    routeStopPolyline.forEach((point, index) => {
      const nextDistance = distance(point, liveBusPoint);
      if (nextDistance < bestDistance) {
        bestDistance = nextDistance;
        best = index;
      }
    });
    return best;
  }, [liveBusPoint, routeStopPolyline]);

  const mapPoints = useMemo(() => {
    const points = [...displayLine];
    passengerRequests.forEach((item) => {
      const lat = Number(item.marker_lat);
      const lng = Number(item.marker_lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) points.push([lat, lng]);
    });
    if (liveBusPoint) points.push(liveBusPoint);
    return points;
  }, [displayLine, passengerRequests, liveBusPoint]);

  const routeStart = routeStops[0]?.stop?.name || "--";
  const routeEnd = routeStops[routeStops.length - 1]?.stop?.name || "--";
  const nextStop = stopIndex >= 0 ? routeStops[Math.min(stopIndex + 1, routeStops.length - 1)]?.stop?.name || routeEnd : routeStart;
  const seatLayoutTripId = trip?.id ?? null;
  const stopOptions = routeStops.map((stop) => ({ value: String(stop.stop_order), label: `${stop.stop_order}. ${stop.stop?.name || "--"}` }));
  const checklistReady = Object.values(checklist).every(Boolean);
  const selectedSeatMode = useMemo(() => {
    if (seatView === "occupancy") return "passenger";
    return "helper";
  }, [seatView]);
  const displayedSeats = useMemo(() => {
    if (seatView === "occupancy") {
      return seats.map((seat) => ({
        ...seat,
        payment_verified: false,
        offline_boarding_id: null,
      }));
    }
    if (seatView === "payment") {
      return seats.map((seat) => ({
        ...seat,
        available: seat.available,
      }));
    }
    return seats;
  }, [seatView, seats]);
  const availableSeats = seats.filter((seat) => seat.available).length;
  const occupiedSeats = seats.length - availableSeats;
  const paidSeats = seats.filter((seat) => !seat.available && seat.payment_verified).length;
  const dueSeats = seats.filter((seat) => !seat.available && !seat.payment_verified).length;

  const loadDashboard = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get("/api/trips/driver/dashboard/");
      setDashboard(response.data);
      setLatestLocation(response.data.latest_location || null);
      setErr("");
    } catch (error) {
      setErr(error?.response?.data?.detail || "Failed to load driver dashboard.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadTrip = useCallback(async (tripId, { clearIfMissing = false } = {}) => {
    if (!tripId) {
      if (clearIfMissing) {
        setRouteStops([]);
        setRoutePathPoints([]);
        setRoadPolyline([]);
        setPassengerRequests([]);
        setSeats([]);
      }
      return;
    }
    try {
      const response = await api.get(`/api/trips/${tripId}/`);
      setRouteStops(response.data.route_stops || []);
      setRoutePathPoints(response.data.trip?.route_path_points || []);
      setPassengerRequests(response.data.passenger_requests || []);
    } catch {
      if (clearIfMissing) {
        setRouteStops([]);
        setRoutePathPoints([]);
        setRoadPolyline([]);
        setPassengerRequests([]);
        setSeats([]);
      }
    }
  }, []);

  const loadSeats = useCallback(async (tripId, from = "", to = "", { silent = false } = {}) => {
    if (!tripId) {
      if (!silent) setSeats([]);
      return;
    }
    setLoadingSeats(true);
    try {
      const query = from && to ? `?from=${from}&to=${to}` : "";
      const response = await api.get(`/api/bookings/trips/${tripId}/availability/${query}`);
      setSeats(response.data.seats || []);
      if (response.data.from_stop_order) setFromOrder(String(response.data.from_stop_order));
      if (response.data.to_stop_order) setToOrder(String(response.data.to_stop_order));
    } catch (error) {
      if (!silent) setErr(error?.response?.data?.detail || "Unable to load the seat layout.");
    } finally {
      setLoadingSeats(false);
    }
  }, []);

  const loadHistory = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setHistoryLoading(true);
    try {
      const response = await api.get("/api/trips/driver/history/");
      setHistoryData({
        summary: response.data.summary || null,
        trips: response.data.trips || [],
      });
    } catch (error) {
      if (!silent) setErr(error?.response?.data?.detail || "Unable to load driver history.");
    } finally {
      if (!silent) setHistoryLoading(false);
    }
  }, []);

  const loadExpenses = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setExpenseLoading(true);
    try {
      const response = await api.get("/api/trips/driver/expenses/");
      setExpenseData({
        summary: response.data.summary || null,
        expenses: response.data.expenses || [],
      });
    } catch (error) {
      if (!silent) setErr(error?.response?.data?.detail || "Unable to load driver expenses.");
    } finally {
      if (!silent) setExpenseLoading(false);
    }
  }, []);

  const runAction = useCallback(async (requestFn, successMessage) => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const response = await requestFn();
      setMsg(response?.data?.message || successMessage);
      await loadDashboard({ silent: true });
      if (response?.data?.trip?.id) await loadTrip(response.data.trip.id, { clearIfMissing: true });
      return response;
    } catch (error) {
      setErr(error?.response?.data?.detail || "Action failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }, [loadDashboard, loadTrip]);

  const saveExpense = useCallback(async () => {
    if (!expenseForm.amount || Number(expenseForm.amount) <= 0) {
      setErr("Enter a valid expense amount.");
      return;
    }
    setExpenseSaving(true);
    setErr("");
    setMsg("");
    try {
      const response = await api.post("/api/trips/driver/expenses/", {
        trip: activeTrip?.id || "",
        category: expenseForm.category,
        amount: expenseForm.amount,
        note: expenseForm.note,
        incurred_at: expenseForm.incurred_at || undefined,
      });
      setMsg(response.data.message || "Driver expense recorded.");
      setExpenseForm((current) => ({ ...current, amount: "", note: "" }));
      await loadExpenses({ silent: true });
      await loadHistory({ silent: true });
    } catch (error) {
      setErr(error?.response?.data?.detail || "Unable to save the driver expense.");
    } finally {
      setExpenseSaving(false);
    }
  }, [activeTrip?.id, expenseForm, loadExpenses, loadHistory]);

  const saveProfile = useCallback(async () => {
    setProfileBusy(true);
    setErr("");
    setMsg("");
    try {
      const response = await api.patch("/api/auth/me/", profileForm);
      setUser(response.data);
      setMsg("Driver profile updated.");
    } catch (error) {
      setErr(error?.response?.data?.detail || "Unable to update the driver profile.");
    } finally {
      setProfileBusy(false);
    }
  }, [profileForm, setUser]);

  const changePassword = useCallback(async () => {
    setPasswordBusy(true);
    setErr("");
    setMsg("");
    try {
      const response = await api.post("/api/auth/me/password/", passwordForm);
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      setMsg(response.data.message || "Password updated.");
    } catch (error) {
      setErr(error?.response?.data?.current_password?.[0] || error?.response?.data?.confirm_password?.[0] || error?.response?.data?.new_password?.[0] || error?.response?.data?.detail || "Unable to change the password.");
    } finally {
      setPasswordBusy(false);
    }
  }, [passwordForm]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { setProfileForm({ full_name: user?.full_name || "", email: user?.email || "" }); }, [user?.email, user?.full_name]);
  useEffect(() => {
    const timer = setInterval(() => {
      loadDashboard({ silent: true });
      if (trip?.id) loadTrip(trip.id);
    }, trip?.id ? 2000 : 4000);
    return () => clearInterval(timer);
  }, [trip?.id, loadDashboard, loadTrip]);

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

  useEffect(() => { loadTrip(trip?.id, { clearIfMissing: true }); }, [trip?.id, loadTrip]);
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
      return;
    }
    loadSeats(seatLayoutTripId, fromOrder, toOrder, { silent: seats.length > 0 });
  }, [fromOrder, loadSeats, seatLayoutTripId, toOrder]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!seatLayoutTripId) return undefined;
    const timer = setInterval(() => loadSeats(seatLayoutTripId, fromOrder, toOrder, { silent: true }), 4500);
    return () => clearInterval(timer);
  }, [fromOrder, loadSeats, seatLayoutTripId, toOrder]);
  useEffect(() => {
    if (tab === "history") loadHistory();
    if (tab === "expenses") loadExpenses();
  }, [loadExpenses, loadHistory, tab]);
  useEffect(() => {
    if (routePolyline.length < 2) {
      setRoadPolyline([]);
      return undefined;
    }
    const controller = new AbortController();
    snapRouteToRoad(routePolyline, controller.signal)
      .then((points) => setRoadPolyline(points.length > 1 ? points : []))
      .catch((error) => {
        if (error.name !== "AbortError") setRoadPolyline([]);
      });
    return () => controller.abort();
  }, [routePolylineSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  const acceptAssignment = async () => {
    if (assignedBusNeedsAcceptance) {
      await runAction(() => api.post("/api/trips/assignment/accept/"), "Latest admin assignment accepted.");
      return;
    }
    if (!selectedSchedule?.id) return;
    const response = await runAction(() => api.post(`/api/trips/schedules/${selectedSchedule.id}/accept/`), "Assignment accepted.");
    if (response) setSelectedScheduleId(String(selectedSchedule.id));
  };

  const startRide = async () => {
    const payload = pendingTrip?.id
      ? { trip_id: pendingTrip.id }
      : assignedRouteReady
        ? { route_id: assignedBus.route, bus_id: assignedBus.id, helper_id: assignedBus.helper }
        : selectedSchedule?.id
          ? { schedule_id: selectedSchedule.id }
          : null;
    if (!payload) {
      setErr("No ride is ready to start right now.");
      return;
    }
    await runAction(() => api.post("/api/trips/start/", payload), pendingTrip ? "Start confirmation sent." : "Ride start requested.");
  };

  const endRide = async () => {
    if (!activeTrip?.id) return;
    await runAction(() => api.post(`/api/trips/${activeTrip.id}/end/`), "Trip end request sent.");
  };

  const runSimulationAction = useCallback(async (requestFn, successMessage) => {
    if (!activeTrip?.id) {
      setErr("Start the trip first to use the simulation controls.");
      return null;
    }
    setSimBusy(true);
    setErr("");
    setMsg("");
    try {
      const response = await requestFn();
      if (response?.data?.latest_location) setLatestLocation(response.data.latest_location);
      setMsg(successMessage);
      await loadDashboard({ silent: true });
      await loadTrip(activeTrip.id, { clearIfMissing: true });
      return response;
    } catch (error) {
      setErr(error?.response?.data?.detail || "Simulation action failed.");
      return null;
    } finally {
      setSimBusy(false);
    }
  }, [activeTrip?.id, loadDashboard, loadTrip]);

  const restartSimulation = async () => runSimulationAction(
    () => api.post(`/api/trips/${activeTrip.id}/simulate/start/`, { step_interval_ms: Number(simStepMs) || 3000 }),
    "Live tracking restarted from the beginning of the route.",
  );
  const resumeSimulation = async () => runSimulationAction(
    () => api.post(`/api/trips/${activeTrip.id}/simulate/resume/`, { step_interval_ms: Number(simStepMs) || 3000 }),
    "Live tracking resumed.",
  );
  const pauseSimulation = async () => runSimulationAction(
    () => api.post(`/api/trips/${activeTrip.id}/simulate/pause/`),
    "Live tracking paused.",
  );
  const stepSimulation = async () => runSimulationAction(
    () => api.post(`/api/trips/${activeTrip.id}/simulate/step/`),
    "Bus moved forward by one simulation step.",
  );
  const resetSimulation = async () => runSimulationAction(
    () => api.post(`/api/trips/${activeTrip.id}/simulate/reset/`),
    "Simulation reset to the route origin.",
  );

  const showAccept = !activeTrip && !pendingTrip && (assignedBusNeedsAcceptance || (!assignedRouteReady && selectedSchedule && !selectedSchedule.driver_assignment_accepted));
  const showStart = !activeTrip && !assignedBusNeedsAcceptance && (pendingTrip || assignedRouteReady || selectedSchedule?.driver_assignment_accepted);
  const canStart = !assignedBusNeedsAcceptance && (pendingTrip ? !pendingTrip.driver_start_confirmed : Boolean(assignedRouteReady || selectedSchedule?.driver_assignment_accepted)) && checklistReady;
  const homeStatus = activeTrip
    ? "Trip Live"
    : pendingTrip
      ? (pendingTrip.driver_start_confirmed ? "Waiting for Helper" : pendingTrip.helper_start_confirmed ? "Ready to Go Live" : "Start Pending")
      : assignedBus
        ? (assignedBusNeedsAcceptance ? "Assignment Pending" : assignedRouteReady ? "Ready to Start" : "Assignment Incomplete")
        : selectedSchedule
          ? (selectedSchedule.driver_assignment_accepted ? "Ready to Start" : "Assignment Pending")
          : "Standby";
  const startLabel = pendingTrip?.helper_start_confirmed && !pendingTrip.driver_start_confirmed ? "Confirm Start Ride" : pendingTrip?.driver_start_confirmed ? "Waiting for Helper" : "Start Ride";
  const endLabel = activeTrip?.helper_end_confirmed ? "Confirm End Trip" : activeTrip?.driver_end_confirmed ? "Waiting for Helper" : "End Trip";

  const card = "rounded-[1.8rem] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)] backdrop-blur-xl";
  const soft = "rounded-[1.25rem] bg-[var(--accent-soft)]";
  const button = "inline-flex w-full items-center justify-center gap-2 rounded-[1.2rem] px-5 py-4 text-sm font-black tracking-[0.04em] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-55";
  const handleLogout = () => {
    clearToken();
    setUser(null);
    navigate("/auth/login", { replace: true });
  };

  return (
    <div style={theme} className="min-h-screen bg-[radial-gradient(circle_at_top,#fff5eb_0%,var(--bg)_42%,var(--bg-soft)_100%)] text-[var(--text)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top_right,rgba(255,150,45,0.18),transparent_48%),radial-gradient(circle_at_top_left,rgba(75,38,102,0.18),transparent_42%)]" />
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--header)] backdrop-blur-xl">
        <div className={`${shell} flex items-center justify-between px-4 py-4 sm:px-5`}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative grid h-12 w-12 place-items-center overflow-hidden rounded-[1.1rem] bg-[linear-gradient(180deg,#4b2666_0%,#6d3d9b_50%,#ff8a1f_100%)] text-white shadow-[0_14px_30px_rgba(75,38,102,0.24)]">
              <div className="absolute right-1 top-1 h-8 w-8 rounded-full border-[6px] border-[rgba(255,143,31,0.95)] border-l-transparent border-b-transparent rotate-[28deg]" />
              <Icon name="route" className="relative h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-black leading-none text-[var(--primary)]">MetroBus</p>
              <p className="mt-1 text-[0.72rem] font-black uppercase tracking-[0.22em] text-[var(--muted)]">Driver Home</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleLogout} className="rounded-full border border-[rgba(219,61,79,0.18)] bg-[rgba(219,61,79,0.10)] px-4 py-2 text-[0.7rem] font-black uppercase tracking-[0.16em] text-[var(--danger)] shadow-[var(--shadow)]">Logout</button>
            <button type="button" className="grid h-12 w-12 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-strong)] text-sm font-black text-[var(--primary)] shadow-[var(--shadow)]" aria-label="Driver account">{initials(user?.full_name)}</button>
          </div>
        </div>
      </header>

      <main className={`${shell} relative px-4 pb-32 pt-4 sm:px-5 sm:pt-5`}>
        {err ? <div className="mb-4 rounded-[1.25rem] border border-[rgba(219,61,79,0.18)] bg-[rgba(219,61,79,0.10)] px-4 py-3 text-sm font-semibold text-[var(--danger)]">{err}</div> : null}
        {msg ? <div className="mb-4 rounded-[1.25rem] border border-[rgba(23,165,103,0.16)] bg-[rgba(23,165,103,0.10)] px-4 py-3 text-sm font-semibold text-[var(--success)]">{msg}</div> : null}

        {loading ? (
          <section className={`${card} p-6`}>
            <p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[var(--primary)]">Driver Home</p>
            <h1 className="mt-3 text-[2rem] font-black leading-tight">Loading your current assignment...</h1>
          </section>
        ) : null}

        {!loading && tab === "simulate" ? (
          <section className={`${card} overflow-hidden`}>
            <div className="border-b border-[var(--border)] px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[var(--primary)]">Live Simulation</p>
                  <h2 className="mt-3 text-[2rem] font-black leading-tight">Dummy live tracking control center</h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">This uses the saved MetroBus route and sends dummy live movement through the road path, so the passenger and driver maps behave like a real GPS feed.</p>
                </div>
                <span className={`inline-flex rounded-full px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.16em] ${simulation?.is_active ? "bg-[rgba(23,165,103,0.14)] text-[var(--success)]" : "bg-[var(--accent-soft)] text-[var(--primary)]"}`}>
                  {activeTrip ? (simulation?.is_active ? "Tracking Live" : "Tracking Paused") : "Trip Not Live"}
                </span>
              </div>
            </div>

            <div className="grid gap-4 border-b border-[var(--border)] px-5 py-5 sm:grid-cols-3">
              <div className={`${soft} px-4 py-4`}>
                <p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Trip</p>
                <p className="mt-2 break-words text-lg font-black">{activeTrip?.route_name || "No live trip yet"}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{activeTrip?.bus_plate || assignedBus?.plate_number || "--"}</p>
              </div>
              <div className={`${soft} px-4 py-4`}>
                <p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Simulation Step</p>
                <select value={simStepMs} onChange={(event) => setSimStepMs(event.target.value)} className="mt-2 w-full rounded-[1rem] border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-3 text-sm font-black text-[var(--text)] outline-none">
                  <option value="1000">1 second / step</option>
                  <option value="2000">2 seconds / step</option>
                  <option value="3000">3 seconds / step</option>
                  <option value="5000">5 seconds / step</option>
                  <option value="8000">8 seconds / step</option>
                </select>
              </div>
              <div className={`${soft} px-4 py-4`}>
                <p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Latest Location</p>
                <p className="mt-2 text-lg font-black">{liveBusPoint ? `${Number(liveBusPoint[0]).toFixed(5)}, ${Number(liveBusPoint[1]).toFixed(5)}` : "--"}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{latestLocation?.recorded_at ? fmtDateTime(latestLocation.recorded_at) : "Waiting for live point"}</p>
              </div>
            </div>

            <div className="grid gap-3 border-b border-[var(--border)] px-5 py-5 sm:grid-cols-2">
              <ActionButton onClick={resumeSimulation} disabled={simBusy || !activeTrip}>
                <Icon name="play" className="h-4 w-4" />
                {simBusy ? "Working..." : simulation?.is_active ? "Refresh Tracking" : "Resume Tracking"}
              </ActionButton>
              <ActionButton tone="secondary" onClick={restartSimulation} disabled={simBusy || !activeTrip}>
                <Icon name="route" className="h-4 w-4" />
                Restart From Route Start
              </ActionButton>
              <ActionButton tone="secondary" onClick={stepSimulation} disabled={simBusy || !activeTrip}>
                <Icon name="history" className="h-4 w-4" />
                Step Bus Forward
              </ActionButton>
              <div className="grid grid-cols-2 gap-3">
                <ActionButton tone="secondary" onClick={pauseSimulation} disabled={simBusy || !activeTrip}>
                  Pause
                </ActionButton>
                <ActionButton tone="danger" onClick={resetSimulation} disabled={simBusy || !activeTrip}>
                  Reset
                </ActionButton>
              </div>
            </div>

            <div className="relative h-[28rem] overflow-hidden bg-[var(--bg-soft)]">
              <MapContainer center={[28.2096, 83.9856]} zoom={13} scrollWheelZoom={false} className="h-full w-full">
                <TileLayer attribution="&copy; OpenStreetMap &copy; CARTO" url={isDark ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"} />
                <MapViewport points={mapPoints} />
                {displayLine.length > 1 ? <Polyline positions={displayLine} pathOptions={{ color: theme["--primary"], weight: 6, opacity: 0.92 }} /> : null}
                {liveBusPoint ? <CircleMarker center={liveBusPoint} radius={10} pathOptions={{ color: theme["--accent"], fillColor: theme["--accent"], fillOpacity: 1, weight: 3 }}><Popup>Dummy live bus location</Popup></CircleMarker> : null}
              </MapContainer>
              {!activeTrip ? (
                <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(180deg,rgba(255,247,240,0.24),rgba(255,247,240,0.72))] px-6 text-center backdrop-blur-[2px]">
                  <div className="max-w-md rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-strong)] px-5 py-5 shadow-[var(--shadow)]">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-[var(--primary)]">Simulation Standby</p>
                    <h3 className="mt-2 text-2xl font-black">Start a live trip to simulate bus movement</h3>
                    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Once the trip is LIVE, MetroBus can feed dummy GPS movement through the road path for testing passenger and driver live tracking.</p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 px-5 py-5 sm:grid-cols-3">
              <div className={`${soft} px-4 py-4`}>
                <p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Simulation Points</p>
                <p className="mt-2 text-lg font-black">{simulation?.points_count ?? displayLine.length ?? 0}</p>
              </div>
              <div className={`${soft} px-4 py-4`}>
                <p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Current Index</p>
                <p className="mt-2 text-lg font-black">{simulation?.current_index ?? 0}</p>
              </div>
              <div className={`${soft} px-4 py-4`}>
                <p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Step Interval</p>
                <p className="mt-2 text-lg font-black">{simulation?.step_interval_ms ?? simStepMs} ms</p>
              </div>
            </div>
          </section>
        ) : null}

        {!loading && tab === "seats" ? (
          <section className={`${card} overflow-hidden`}>
            <div className="border-b border-[var(--border)] px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[var(--primary)]">Seat Status</p>
                  <h2 className="mt-3 text-[2rem] font-black leading-tight">Occupancy and payment overview</h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Switch between combined, occupancy-only, and payment-only seat views while keeping the same MetroBus seat layout.</p>
                </div>
                <span className="inline-flex rounded-full bg-[var(--accent-soft)] px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--primary)]">{trip ? "Trip Context" : "Assignment Context"}</span>
              </div>
            </div>

            <div className="grid gap-3 border-b border-[var(--border)] px-5 py-5 sm:grid-cols-4">
              <div className={`${soft} px-4 py-4`}><p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Available</p><p className="mt-2 text-2xl font-black">{availableSeats}</p></div>
              <div className={`${soft} px-4 py-4`}><p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Occupied</p><p className="mt-2 text-2xl font-black">{occupiedSeats}</p></div>
              <div className={`${soft} px-4 py-4`}><p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Paid</p><p className="mt-2 text-2xl font-black">{paidSeats}</p></div>
              <div className={`${soft} px-4 py-4`}><p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Payment Due</p><p className="mt-2 text-2xl font-black">{dueSeats}</p></div>
            </div>

            <div className="grid gap-3 border-b border-[var(--border)] px-5 py-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--muted)]">Trip Segment</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select value={fromOrder} onChange={(event) => setFromOrder(event.target.value)} className="w-full rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3.5 text-sm font-semibold text-[var(--text)] outline-none">
                    {(stopOptions.length ? stopOptions : [{ value: "", label: "No stops" }]).map((option) => <option key={`from-${option.value}`} value={option.value}>{option.label}</option>)}
                  </select>
                  <select value={toOrder} onChange={(event) => setToOrder(event.target.value)} className="w-full rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3.5 text-sm font-semibold text-[var(--text)] outline-none">
                    {(stopOptions.length ? stopOptions : [{ value: "", label: "No stops" }]).map((option) => <option key={`to-${option.value}`} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <p className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--muted)]">Display Mode</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: "combined", label: "Both" },
                    { value: "occupancy", label: "Occupancy" },
                    { value: "payment", label: "Payment" },
                  ].map((option) => (
                    <button key={option.value} type="button" onClick={() => setSeatView(option.value)} className={`rounded-[1.1rem] px-3 py-3 text-[0.72rem] font-black uppercase tracking-[0.14em] ${seatView === option.value ? "bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-white shadow-[var(--shadow-strong)]" : "border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text)]"}`}>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 py-5">
              <MetroSeatBoard
                title={seatView === "occupancy" ? "Occupancy Layout" : seatView === "payment" ? "Payment Layout" : "Seat Layout"}
                routeName={trip?.route_name || assignedBus?.route_name || selectedSchedule?.route_name || "Driver seat overview"}
                busLabel={trip?.bus_plate || assignedBus?.plate_number || selectedSchedule?.bus_plate || "--"}
                seats={displayedSeats}
                mode={selectedSeatMode}
                loading={loadingSeats}
                loadingMessage="Loading driver seat layout..."
                emptyMessage="Seat layout is not available for the current trip context."
              />
            </div>
          </section>
        ) : null}

        {!loading && tab === "expenses" ? (
          <section className={`${card} overflow-hidden`}>
            <div className="border-b border-[var(--border)] px-5 py-5">
              <p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[var(--primary)]">Bus Expenses</p>
              <h2 className="mt-3 text-[2rem] font-black leading-tight">Fuel, repair, and route operation costs</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">These entries help the MetroBus reports show real operating cost for each driver and bus.</p>
            </div>

            <div className="grid gap-3 border-b border-[var(--border)] px-5 py-5 sm:grid-cols-3">
              <div className={`${soft} px-4 py-4`}><p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Total Amount</p><p className="mt-2 text-2xl font-black">Rs {Number(expenseData.summary?.total_amount || 0).toFixed(2)}</p></div>
              <div className={`${soft} px-4 py-4`}><p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Entries</p><p className="mt-2 text-2xl font-black">{expenseData.summary?.count || 0}</p></div>
              <div className={`${soft} px-4 py-4`}><p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Current Bus</p><p className="mt-2 text-lg font-black">{assignedBus?.plate_number || trip?.bus_plate || "--"}</p></div>
            </div>

            <div className="border-b border-[var(--border)] px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--muted)]">Category</span>
                  <select value={expenseForm.category} onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value }))} className="w-full rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3.5 text-sm font-semibold text-[var(--text)] outline-none">
                    {["FUEL", "REPAIR", "MAINTENANCE", "TOLL", "PARKING", "CLEANING", "OTHER"].map((item) => <option key={item} value={item}>{item.replace("_", " ")}</option>)}
                  </select>
                </label>
                <TextField label="Amount (Rs)" value={expenseForm.amount} onChange={(value) => setExpenseForm((current) => ({ ...current, amount: value }))} type="number" placeholder="500" />
                <TextField label="Date / Time" value={expenseForm.incurred_at} onChange={(value) => setExpenseForm((current) => ({ ...current, incurred_at: value }))} type="datetime-local" />
                <TextField label="Note" value={expenseForm.note} onChange={(value) => setExpenseForm((current) => ({ ...current, note: value }))} placeholder="Fuel refill at Lakeside" />
              </div>
              <ActionButton className="mt-4" onClick={saveExpense} disabled={expenseSaving || expenseLoading}>{expenseSaving ? "Saving Expense..." : "Save Expense"}</ActionButton>
            </div>

            <div className="px-5 py-5">
              <p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[var(--primary)]">Recent Expense Entries</p>
              <div className="mt-4 space-y-3">
                {expenseLoading ? <div className={`${soft} px-4 py-4 text-sm font-semibold text-[var(--muted)]`}>Loading expenses...</div> : null}
                {!expenseLoading && !expenseData.expenses.length ? <div className={`${soft} px-4 py-4 text-sm font-semibold text-[var(--muted)]`}>No expense entries yet.</div> : null}
                {expenseData.expenses.map((expense) => (
                  <div key={expense.id} className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-black text-[var(--text)]">{expense.category.replace("_", " ")}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{expense.note || "No note"} | {fmtDateTime(expense.incurred_at)}</p>
                      </div>
                      <p className="text-lg font-black text-[var(--primary)]">Rs {Number(expense.amount || 0).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {!loading && tab === "history" ? (
          <section className="space-y-4">
            <section className={`${card} p-6`}>
              <p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[var(--primary)]">Driver History</p>
              <h2 className="mt-3 text-[2rem] font-black leading-tight">Trip log and performance trail</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className={`${soft} px-4 py-4`}><p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Total Trips</p><p className="mt-2 text-2xl font-black">{historyData.summary?.total_trips || 0}</p></div>
                <div className={`${soft} px-4 py-4`}><p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Completed</p><p className="mt-2 text-2xl font-black">{historyData.summary?.completed_trips || 0}</p></div>
                <div className={`${soft} px-4 py-4`}><p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Live</p><p className="mt-2 text-2xl font-black">{historyData.summary?.live_trips || 0}</p></div>
              </div>
            </section>

            {historyLoading ? <section className={`${card} p-6 text-sm font-semibold text-[var(--muted)]`}>Loading driver history...</section> : null}
            {!historyLoading && !historyData.trips.length ? <section className={`${card} p-6 text-sm font-semibold text-[var(--muted)]`}>No driver trips recorded yet.</section> : null}
            {historyData.trips.map((historyTrip) => (
              <section key={historyTrip.id} className={`${card} p-5`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--primary)]">Trip #{historyTrip.id}</p>
                    <h3 className="mt-2 text-[1.35rem] font-black leading-tight">{historyTrip.route_name}</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">{historyTrip.bus_plate} | Helper {historyTrip.helper_name}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.16em] ${historyTrip.status === "ENDED" ? "bg-[rgba(23,165,103,0.14)] text-[var(--success)]" : historyTrip.status === "LIVE" ? "bg-[rgba(255,150,45,0.16)] text-[var(--accent)]" : "bg-[var(--accent-soft)] text-[var(--primary)]"}`}>{historyTrip.status}</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className={`${soft} px-4 py-4`}><p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Started</p><p className="mt-2 text-sm font-black">{fmtDateTime(historyTrip.started_at || historyTrip.created_at)}</p></div>
                  <div className={`${soft} px-4 py-4`}><p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Bookings</p><p className="mt-2 text-sm font-black">{historyTrip.bookings_count || 0} | Completed {historyTrip.completed_bookings_count || 0}</p></div>
                  <div className={`${soft} px-4 py-4`}><p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Expenses</p><p className="mt-2 text-sm font-black">Rs {Number(historyTrip.expenses_total || 0).toFixed(2)}</p></div>
                </div>
              </section>
            ))}
          </section>
        ) : null}

        {!loading && tab === "account" ? (
          <section className="space-y-4">
            <section className={`${card} p-6`}>
              <p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[var(--primary)]">Driver Account</p>
              <h2 className="mt-3 text-[2rem] font-black leading-tight">{user?.full_name || "MetroBus Driver"}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{user?.phone || "--"} {user?.email ? `| ${user.email}` : ""}</p>
            </section>

            <section className={`${card} p-6`}>
              <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--primary)]">Profile Details</p>
              <div className="mt-4 grid gap-4">
                <TextField label="Full Name" value={profileForm.full_name} onChange={(value) => setProfileForm((current) => ({ ...current, full_name: value }))} />
                <TextField label="Email" value={profileForm.email} onChange={(value) => setProfileForm((current) => ({ ...current, email: value }))} />
              </div>
              <ActionButton className="mt-4" onClick={saveProfile} disabled={profileBusy}>{profileBusy ? "Saving Profile..." : "Save Profile"}</ActionButton>
            </section>

            <section className={`${card} p-6`}>
              <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--primary)]">Password Change</p>
              <div className="mt-4 grid gap-4">
                <TextField label="Current Password" type="password" value={passwordForm.current_password} onChange={(value) => setPasswordForm((current) => ({ ...current, current_password: value }))} />
                <TextField label="New Password" type="password" value={passwordForm.new_password} onChange={(value) => setPasswordForm((current) => ({ ...current, new_password: value }))} />
                <TextField label="Confirm Password" type="password" value={passwordForm.confirm_password} onChange={(value) => setPasswordForm((current) => ({ ...current, confirm_password: value }))} />
              </div>
              <ActionButton className="mt-4" onClick={changePassword} disabled={passwordBusy}>{passwordBusy ? "Updating Password..." : "Update Password"}</ActionButton>
            </section>

            <section className={`${card} p-6`}>
              <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--primary)]">Current Assignment</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className={`${soft} px-4 py-4`}><p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Bus</p><p className="mt-2 text-sm font-black">{assignedBus?.plate_number || selectedSchedule?.bus_plate || "--"}</p></div>
                <div className={`${soft} px-4 py-4`}><p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Route</p><p className="mt-2 text-sm font-black">{assignedBus?.route_name || selectedSchedule?.route_name || "--"}</p></div>
              </div>
            </section>
          </section>
        ) : null}

        {!loading && tab === "home" ? (
          <section className={`${card} overflow-hidden`}>
            {!activeTrip ? (
              <div className="px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[0.72rem] font-black uppercase tracking-[0.24em] text-[var(--primary)]">Ride Control</p>
                  <span className={`inline-flex rounded-full px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.16em] ${activeTrip ? "bg-[rgba(23,165,103,0.14)] text-[var(--success)]" : pendingTrip ? "bg-[rgba(255,150,45,0.16)] text-[var(--accent)]" : "bg-[var(--accent-soft)] text-[var(--primary)]"}`}>{homeStatus}</span>
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="rounded-[1.3rem] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-4">
                    <p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[var(--primary)]">Pre-Trip Checklist</p>
                    <div className="mt-3 grid gap-2">
                      {[
                        ["documents", "Vehicle documents checked"],
                        ["fuel", "Fuel level confirmed"],
                        ["brakes", "Brake and light safety check"],
                        ["cleanliness", "Bus is clean and ready"],
                      ].map(([key, label]) => (
                        <label key={key} className="flex items-center gap-3 rounded-[1rem] bg-[var(--accent-soft)] px-3 py-3 text-sm font-semibold text-[var(--text)]">
                          <input type="checkbox" checked={checklist[key]} onChange={() => setChecklist((current) => ({ ...current, [key]: !current[key] }))} className="h-4 w-4 accent-[var(--primary)]" />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {showAccept ? <button type="button" onClick={acceptAssignment} disabled={busy} className={`${button} bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-white shadow-[var(--shadow-strong)]`}><Icon name="assignment" className="h-4 w-4" />{busy ? "Accepting Assignment..." : assignedBusNeedsAcceptance ? "Accept Admin Assignment" : "Accept Assignment"}</button> : null}
                  {showStart ? <button type="button" onClick={startRide} disabled={busy || !canStart} className={`${button} bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-white shadow-[var(--shadow-strong)]`}><Icon name="play" className="h-4 w-4" />{busy ? "Sending..." : startLabel}</button> : null}
                </div>
              </div>
            ) : null}

            <div className={`${!activeTrip ? "border-t border-[var(--border)]" : ""}`}>
              <div className="border-b border-[var(--border)] px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[0.72rem] font-black uppercase tracking-[0.24em] text-[var(--primary)]">Passenger Map</p>
                    <h2 className="mt-2 break-words text-[1.6rem] font-black leading-tight">{trip?.route_name || assignedBus?.route_name || selectedSchedule?.route_name || "Driver ride map"}</h2>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Green dots show pickups and red dots show passenger drop points.</p>
                  </div>
                  <span className={`inline-flex rounded-full px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.16em] ${activeTrip ? "bg-[rgba(23,165,103,0.14)] text-[var(--success)]" : pendingTrip ? "bg-[rgba(255,150,45,0.16)] text-[var(--accent)]" : "bg-[var(--accent-soft)] text-[var(--primary)]"}`}>{activeTrip ? "Live Trip" : pendingTrip ? "Start Pending" : "Standby"}</span>
                </div>
              </div>

              <div className={`relative overflow-hidden bg-[var(--bg-soft)] ${activeTrip ? "h-[31rem]" : "h-[24.5rem]"}`}>
                <div className="absolute left-4 top-4 z-[500] max-w-[15rem] rounded-[1.3rem] bg-[var(--surface-strong)] px-4 py-3 shadow-[var(--shadow)] backdrop-blur-xl">
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.24em] text-[var(--primary)]">Route Summary</p>
                  <p className="mt-2 break-words text-sm font-black leading-6">{routeStart !== "--" && routeEnd !== "--" ? `${routeStart} to ${routeEnd}` : "Route will appear here after the ride starts"}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{activeTrip ? `Next stop: ${nextStop}` : "Pickup markers turn green and drop markers turn red on the live trip map."}</p>
                </div>

                <div className="absolute bottom-4 right-4 z-[500] rounded-[1.3rem] bg-[var(--surface-strong)] px-4 py-3 shadow-[var(--shadow)] backdrop-blur-xl">
                  <div className="flex items-center gap-4 text-[0.68rem] font-black uppercase tracking-[0.14em]">
                    <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#22c55e]" />{pickupRequests.length} pickup</div>
                    <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#ef4444]" />{dropRequests.length} drop</div>
                  </div>
                </div>

                <MapContainer center={[28.2096, 83.9856]} zoom={13} scrollWheelZoom={false} className="h-full w-full">
                  <TileLayer attribution="&copy; OpenStreetMap &copy; CARTO" url={isDark ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"} />
                  <MapViewport points={mapPoints} />
                  {displayLine.length > 1 ? <Polyline positions={displayLine} pathOptions={{ color: theme["--primary"], weight: 5, opacity: 0.92 }} /> : null}
                  {routeStops.map((item, index) => {
                    const lat = Number(item.stop?.lat);
                    const lng = Number(item.stop?.lng);
                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                    const current = index === stopIndex && liveBusPoint;
                    return <CircleMarker key={`${item.stop_order}-${item.stop?.name}`} center={[lat, lng]} radius={current ? 7 : 4} pathOptions={{ color: current ? theme["--accent"] : theme["--primary"], fillColor: current ? theme["--accent"] : "#ffffff", fillOpacity: 0.95, weight: 2 }}><Popup>Stop {item.stop_order}: {item.stop?.name}</Popup></CircleMarker>;
                  })}
                  {passengerRequests.map((item) => {
                    const lat = Number(item.marker_lat);
                    const lng = Number(item.marker_lng);
                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                    const pickup = item.stage === "pickup";
                    return <CircleMarker key={`${item.booking_id}-${item.stage}`} center={[lat, lng]} radius={8} pathOptions={{ color: pickup ? "#15803d" : "#b91c1c", fillColor: pickup ? "#22c55e" : "#ef4444", fillOpacity: 0.96, weight: 2 }}><Popup><div className="min-w-[12rem] space-y-1 text-sm"><p className="font-black">{item.passenger_name}</p><p className="font-semibold text-[var(--primary)]">{pickup ? "Pickup point" : "Drop point"}</p><p className="text-[var(--muted)]">{item.pickup_stop_name} to {item.destination_stop_name}</p></div></Popup></CircleMarker>;
                  })}
                  {liveBusPoint ? <CircleMarker center={liveBusPoint} radius={10} pathOptions={{ color: theme["--accent"], fillColor: theme["--accent"], fillOpacity: 1, weight: 3 }}><Popup>Live bus location</Popup></CircleMarker> : null}
                </MapContainer>

                {!trip || !routeStops.length ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(180deg,rgba(255,247,240,0.2),rgba(255,247,240,0.7))] px-6 text-center backdrop-blur-[2px]">
                    <div className="max-w-md rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-strong)] px-5 py-5 shadow-[var(--shadow)]">
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-[var(--primary)]">Map Standby</p>
                      <h3 className="mt-2 text-2xl font-black">{assignedBus || selectedSchedule ? "Start the ride to unlock the live driver map" : "Waiting for your next assigned trip"}</h3>
                      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{assignedBus || selectedSchedule ? "After the ride is started, this map will show the route and passenger points. Pickup markers will appear in green and drop markers will appear in red." : "Once admin assigns a bus and route, the home page will show the route controls here."}</p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 border-t border-[var(--border)] px-5 py-4 sm:grid-cols-3">
                <div className={`${soft} px-4 py-4`}><p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Current State</p><p className="mt-2 text-lg font-black">{homeStatus}</p></div>
                <div className={`${soft} px-4 py-4`}><p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Bus / Helper</p><p className="mt-2 break-words text-lg font-black">{trip?.bus_plate || assignedBus?.plate_number || selectedSchedule?.bus_plate || "--"}</p><p className="mt-1 text-sm text-[var(--muted)]">{trip?.helper_name || assignedBus?.helper_name || selectedSchedule?.helper_name || "Helper pending"}</p></div>
                <div className={`${soft} px-4 py-4`}><p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Time</p><p className="mt-2 text-lg font-black">{fmtTime(activeTrip?.started_at || selectedSchedule?.scheduled_start_time)}</p></div>
              </div>
            </div>

            {activeTrip ? (
              <div className="border-t border-[var(--border)] px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[0.72rem] font-black uppercase tracking-[0.24em] text-[var(--primary)]">Trip Finish</p>
                  <span className={`inline-flex rounded-full px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.16em] ${activeTrip.helper_end_confirmed ? "bg-[rgba(255,150,45,0.16)] text-[var(--accent)]" : "bg-[var(--accent-soft)] text-[var(--primary)]"}`}>{activeTrip.helper_end_confirmed ? "Confirm End" : activeTrip.driver_end_confirmed ? "Waiting for Helper" : "Trip Control"}</span>
                </div>
                <button type="button" onClick={endRide} disabled={busy || activeTrip.driver_end_confirmed} className={`${button} mt-4 bg-[linear-gradient(135deg,#a92b3c,#ff6e55)] text-white shadow-[var(--shadow-strong)]`}><Icon name="stop" className="h-4 w-4" />{busy ? "Sending..." : endLabel}</button>
              </div>
            ) : null}
          </section>
        ) : null}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.55rem+env(safe-area-inset-bottom))] pt-2">
        <div className={`${shell} rounded-[1.45rem] border border-[var(--border)] bg-[var(--footer)] p-1.5 shadow-[var(--shadow)] backdrop-blur-xl`}>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }}>
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
