import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { api } from "../../api";
import { useAuth } from "../../AuthContext";
import { clearToken } from "../../auth";
import { snapRouteToRoad } from "../../lib/mapRoute";
import { useTheme } from "../../ThemeContext";

const LIGHT_THEME = {
  "--drv-bg": "#fbf3f6",
  "--drv-bg-end": "rgba(245,235,242,0.98)",
  "--drv-surface": "rgba(255,255,255,0.92)",
  "--drv-soft": "#fbebf0",
  "--drv-border": "rgba(52,21,93,0.08)",
  "--drv-text": "#27133f",
  "--drv-muted": "#7d6b93",
  "--drv-purple": "#34155d",
  "--drv-purple-2": "#ff6b73",
  "--drv-plum": "#2e124f",
  "--drv-header": "rgba(252,245,248,0.92)",
  "--drv-nav": "rgba(252,245,248,0.94)",
  "--drv-shadow": "0 24px 56px rgba(46,18,79,0.12)",
  "--drv-shadow-strong": "0 26px 60px rgba(255,107,115,0.22)",
};

const DARK_THEME = {
  "--drv-bg": "#241043",
  "--drv-bg-end": "rgba(36,16,67,0.98)",
  "--drv-surface": "rgba(57,27,92,0.9)",
  "--drv-soft": "rgba(255,107,115,0.12)",
  "--drv-border": "rgba(196,152,233,0.14)",
  "--drv-text": "#fff7f5",
  "--drv-muted": "#d3c3e2",
  "--drv-purple": "#ff8a77",
  "--drv-purple-2": "#ff9a5c",
  "--drv-plum": "#2e124f",
  "--drv-header": "rgba(36,16,67,0.92)",
  "--drv-nav": "rgba(43,20,78,0.94)",
  "--drv-shadow": "0 24px 56px rgba(0,0,0,0.24)",
  "--drv-shadow-strong": "0 26px 60px rgba(255,107,115,0.26)",
};

function Icon({ name, className = "h-5 w-5" }) {
  const common = { className, fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24" };
  switch (name) {
    case "bell": return <svg {...common}><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" /><path d="M10 17a2 2 0 0 0 4 0" /></svg>;
    case "logout": return <svg {...common}><path d="M15 17 20 12 15 7" /><path d="M20 12H9" /><path d="M12 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" /></svg>;
    case "sun": return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2.2" /><path d="M12 19.8V22" /><path d="m4.9 4.9 1.6 1.6" /><path d="m17.5 17.5 1.6 1.6" /><path d="M2 12h2.2" /><path d="M19.8 12H22" /><path d="m4.9 19.1 1.6-1.6" /><path d="m17.5 6.5 1.6-1.6" /></svg>;
    case "moon": return <svg {...common}><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.7 6.7 0 0 0 21 12.8Z" /></svg>;
    case "home": return <svg {...common}><path d="M4 10.5 12 4l8 6.5" /><path d="M7 10v8h10v-8" /></svg>;
    case "route": return <svg {...common}><path d="M5 19c2.5-4 3.5-10 6-14 1-1.5 3.5-1.5 4.5 0 1 1.4.8 3.5-.5 4.7L9 15" /><circle cx="6" cy="19" r="1.5" /><circle cx="18" cy="5" r="1.5" /></svg>;
    case "history": return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" /><path d="M12 7v5l3 2" /></svg>;
    case "wallet": return <svg {...common}><rect x="4" y="6" width="16" height="12" rx="3" /><path d="M14 11h6" /><path d="M16.5 11h.01" /></svg>;
    case "bus": return <svg {...common}><rect x="5" y="5" width="14" height="11" rx="3" /><path d="M7.5 16v3" /><path d="M16.5 16v3" /><path d="M7 10h10" /></svg>;
    case "fuel": return <svg {...common}><path d="M7 18V7a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v11" /><path d="M7 12h9" /><path d="m16 8 2 2v5a2 2 0 1 0 4 0v-5l-2-2" /></svg>;
    case "refresh": return <svg {...common}><path d="M20 11a8 8 0 1 1-2.35-5.66" /><path d="M20 4v5h-5" /></svg>;
    case "play": return <svg {...common}><path d="m8 6 10 6-10 6V6Z" /></svg>;
    case "alert": return <svg {...common}><path d="M12 4 3.5 18h17L12 4Z" /><path d="M12 9v4" /><path d="M12 16h.01" /></svg>;
    case "ticket": return <svg {...common}><rect x="4" y="7" width="16" height="10" rx="2.8" /><path d="M9 7v10" /><path d="M9 10h.01" /><path d="M9 14h.01" /></svg>;
    case "users": return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="3" /><path d="M20 21v-2a4 4 0 0 0-3-3.87" /><path d="M16.5 4.13a3 3 0 0 1 0 5.74" /></svg>;
    case "trend": return <svg {...common}><path d="M4 16 10 10l4 4 6-7" /><path d="M20 7h-5" /><path d="M20 7v5" /></svg>;
    case "arrow-right": return <svg {...common}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>;
  }
}

function Panel({ children, className = "" }) {
  return <div className={`rounded-[2rem] border border-[var(--drv-border)] bg-[var(--drv-surface)] p-5 shadow-[var(--drv-shadow)] backdrop-blur-xl ${className}`}>{children}</div>;
}

function Pill({ children, tone = "idle" }) {
  const tones = { idle: "bg-[rgba(248,221,250,0.92)] text-[var(--drv-purple)]", live: "bg-[rgba(16,185,129,0.12)] text-emerald-600", warn: "bg-[rgba(245,158,11,0.14)] text-amber-600" };
  return <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.18em] ${tones[tone] || tones.idle}`}>{children}</span>;
}

function ActionButton({ children, tone = "primary", className = "", ...props }) {
  const tones = {
    primary: "bg-[linear-gradient(135deg,var(--drv-purple),var(--drv-purple-2))] text-white shadow-[var(--drv-shadow-strong)]",
    danger: "bg-[var(--drv-plum)] text-white shadow-[0_18px_40px_rgba(71,39,81,0.24)]",
    ghost: "border border-[var(--drv-border)] bg-white/80 text-[var(--drv-text)]",
  };
  return <button type="button" className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black uppercase tracking-[0.14em] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone] || tones.primary} ${className}`} {...props}>{children}</button>;
}

function SectionLabel({ children }) {
  return <p className="text-[0.7rem] font-black uppercase tracking-[0.24em] text-[var(--drv-purple)]">{children}</p>;
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.24em] text-[var(--drv-muted)]">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-[1.4rem] border border-[var(--drv-border)] bg-[var(--drv-soft)] px-4 py-4 text-sm font-semibold text-[var(--drv-text)] outline-none transition focus:border-[var(--drv-purple)]">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

function MapViewport({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) { map.setView(points[0], 14); return; }
    map.fitBounds(points, { padding: [28, 28] });
  }, [map, points]);
  return null;
}

function StopTimeline({ stops, progressIndex, liveBusPoint }) {
  if (!stops.length) return <p className="py-2 text-sm text-[var(--drv-muted)]">Start a trip to see stop progress.</p>;
  return (
    <div>
      {stops.map((item, index) => {
        const isDone = progressIndex !== -1 && index < progressIndex && liveBusPoint;
        const isCurrent = progressIndex !== -1 && index === progressIndex && liveBusPoint;
        const isLast = index === stops.length - 1;
        return (
          <div key={`${item.stop_order}-${item.stop?.name}`} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className={`mt-1 h-4 w-4 rounded-full border-2 ${isDone ? "border-transparent bg-emerald-500" : isCurrent ? "border-transparent bg-[var(--drv-purple)]" : "border-[rgba(175,114,210,0.42)] bg-white"}`} />
              {!isLast ? <span className="min-h-[2.5rem] w-px bg-[linear-gradient(180deg,rgba(170,98,222,0.9),rgba(236,211,246,0.9))]" /> : null}
            </div>
            <div className="pb-4">
              <p className="text-[0.64rem] font-black uppercase tracking-[0.22em] text-[var(--drv-muted)]">Stop {index + 1}</p>
              <p className={`mt-1 break-words text-base font-black leading-snug ${isDone ? "text-emerald-600" : isCurrent ? "text-[var(--drv-purple)]" : "text-[var(--drv-text)]"}`}>{item.stop?.name || "--"}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatDateTime(value) { if (!value) return "--"; try { return new Date(value).toLocaleString(); } catch { return value; } }
function formatTime(value) { if (!value) return "--"; try { return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch { return value; } }
function minutesUntil(value) { if (!value) return null; const delta = Math.round((new Date(value).getTime() - Date.now()) / 60000); return Number.isNaN(delta) ? null : delta; }
function distanceBetween(a, b) { if (!a || !b) return Infinity; return Math.sqrt((Number(a[0]) - Number(b[0])) ** 2 + (Number(a[1]) - Number(b[1])) ** 2); }
function buildSimulationPoints(points, maxPoints = 100) {
  const clean = points.filter((point) => Array.isArray(point) && point.length === 2 && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])));
  if (clean.length <= maxPoints) return clean;
  const sampled = [];
  const lastIndex = clean.length - 1;
  for (let index = 0; index < maxPoints; index += 1) {
    const pointIndex = Math.round((index / (maxPoints - 1)) * lastIndex);
    sampled.push(clean[pointIndex]);
  }
  return sampled;
}

const TABS = [
  { id: "home", label: "Home", icon: "home" },
  { id: "active", label: "Active Trip", icon: "route" },
  { id: "history", label: "History", icon: "history" },
  { id: "earnings", label: "Earnings", icon: "wallet" },
];

const APP_SHELL_CLASS = "mx-auto w-full max-w-[31rem]";

export default function DriverHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark, toggle } = useTheme();
  const theme = useMemo(() => (isDark ? DARK_THEME : LIGHT_THEME), [isDark]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [autoShare, setAutoShare] = useState(false);
  const [latestLocation, setLatestLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [deviationMode, setDeviationMode] = useState(false);
  const [assignedBus, setAssignedBus] = useState(null);
  const [routeId, setRouteId] = useState("");
  const [busId, setBusId] = useState("");
  const [helperId, setHelperId] = useState("");
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulationIndex, setSimulationIndex] = useState(0);
  const [simulationPointsCount, setSimulationPointsCount] = useState(0);
  const [simulationSpeedMs, setSimulationSpeedMs] = useState("3000");
  const [routeStops, setRouteStops] = useState([]);
  const [passengerRequests, setPassengerRequests] = useState([]);
  const [roadPolyline, setRoadPolyline] = useState([]);
  const [activeTab, setActiveTab] = useState("home");
  const [expandStops, setExpandStops] = useState(false);
  const [showAllHistoryTrips, setShowAllHistoryTrips] = useState(false);
  const locationWatch = useMemo(() => ({ id: null }), []);
  const wsRef = useMemo(() => ({ current: null }), []);
  const queueRef = useMemo(() => ({ current: [] }), []);

  const activeTrip = dashboard?.active_trip ?? null;
  const pendingTrip = dashboard?.pending_trip ?? null;
  const currentTrip = activeTrip || pendingTrip;
  const tripAwaitingStart = Boolean(pendingTrip && !activeTrip);
  const schedules = dashboard?.schedules ?? [];
  const manualOptions = useMemo(
    () => dashboard?.manual_start_options ?? { routes: [], buses: [], helpers: [] },
    [dashboard?.manual_start_options],
  );
  const nextSchedule = schedules[0] ?? null;
  const routePolyline = useMemo(() => routeStops.map((stop) => [Number(stop.stop?.lat), Number(stop.stop?.lng)]).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)), [routeStops]);
  const displayedPolyline = roadPolyline.length > 1 ? roadPolyline : routePolyline;
  const liveBusPoint = useMemo(() => {
    if (!latestLocation) return null;
    const lat = Number(latestLocation.lat);
    const lng = Number(latestLocation.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }, [latestLocation]);
  const mapPoints = useMemo(() => {
    const points = [...displayedPolyline];
    if (liveBusPoint) points.push(liveBusPoint);
    return points;
  }, [displayedPolyline, liveBusPoint]);
  const simulationPoints = useMemo(() => buildSimulationPoints(displayedPolyline.length > 1 ? displayedPolyline : routePolyline), [displayedPolyline, routePolyline]);
  const stopProgressIndex = useMemo(() => {
    if (!liveBusPoint || !routePolyline.length) return -1;
    let best = -1;
    let bestDistance = Infinity;
    routePolyline.forEach((point, index) => {
      const distance = distanceBetween(point, liveBusPoint);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return best;
  }, [liveBusPoint, routePolyline]);
  const pendingPickupRequests = useMemo(
    () => passengerRequests.filter((request) => request.stage === "pickup"),
    [passengerRequests],
  );
  const onboardDropRequests = useMemo(
    () => passengerRequests.filter((request) => request.stage === "dropoff"),
    [passengerRequests],
  );

  const currentBus = currentTrip?.bus_plate || nextSchedule?.bus_plate || manualOptions.buses.find((bus) => String(bus.id) === busId)?.plate_number || "--";
  const currentRoute = currentTrip?.route_name || nextSchedule?.route_name || manualOptions.routes.find((route) => String(route.id) === routeId)?.name || "--";
  const helperName = currentTrip?.helper_name || nextSchedule?.helper_name || manualOptions.helpers.find((helper) => String(helper.id) === helperId)?.full_name || "--";
  const routeOptions = manualOptions.routes.length
    ? manualOptions.routes.map((route) => ({ value: route.id, label: `${route.name} - ${route.city}` }))
    : [{ value: "", label: "No routes available" }];
  const busOptions = manualOptions.buses.length
    ? manualOptions.buses.map((bus) => ({ value: bus.id, label: `${bus.plate_number} (${bus.capacity})` }))
    : [{ value: "", label: "No buses available" }];
  const helperOptions = manualOptions.helpers.length
    ? manualOptions.helpers.map((helper) => ({ value: helper.id, label: helper.full_name }))
    : [{ value: "", label: "No helpers available" }];
  const minutesToDeparture = minutesUntil(nextSchedule?.scheduled_start_time);
  const nextStop = routeStops[Math.min(stopProgressIndex + 1, routeStops.length - 1)]?.stop?.name || routeStops[1]?.stop?.name || "--";
  const previousStop = routeStops[Math.max(stopProgressIndex, 0)]?.stop?.name || "--";
  const capacity = Number(manualOptions.buses.find((bus) => bus.id === currentTrip?.bus)?.capacity || assignedBus?.capacity || 40);
  const occupied = currentTrip ? Math.min(32, capacity) : Math.min(18, capacity);
  const occupancyPct = capacity ? Math.round((occupied / capacity) * 100) : 0;
  const plannedTrips = schedules.length || 6;
  const homeStatus = activeTrip ? "Trip Live" : pendingTrip ? "Start Pending" : "On Track";
  const todaysEarnings = currentTrip ? 4500 : 2450;
  const completedTrips = currentTrip ? 8 : 6;
  const totalPassengers = currentTrip ? 124 : 42;
  const fuelLevel = currentTrip ? 84 : 85;
  const predictedPax = currentTrip ? `${passengerRequests.length || 0}` : "0";
  const shiftStartTime = nextSchedule?.scheduled_start_time ? formatTime(nextSchedule.scheduled_start_time) : "08:30 AM";
  const lastShiftDate = new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  const lastShiftEarnings = 4800;
  const lastShiftPassengers = 245;
  const lastShiftDuration = "8h 15m";
  const lastShiftRank = "Top 5%";
  const historyMetrics = [
    { label: "Fuel Efficiency", value: "4.2", suffix: "km/L", icon: "fuel" },
    { label: "On-Time", value: "98%", suffix: "", icon: "history" },
    { label: "Safety Score", value: "4.9/5", suffix: "", icon: "alert" },
  ];
  const recentHistoryTrips = [
    { route: "Route 42A: Downtown Express", time: "08:30 AM - 09:45 AM", earnings: "Rs. 840" },
    { route: "Route 12: Westside Terminal", time: "10:15 AM - 11:30 AM", earnings: "Rs. 620" },
    { route: "Route 05: Airport Shuttle", time: "12:00 PM - 01:45 PM", earnings: "Rs. 1,150" },
    { route: "Route 18: University Loop", time: "02:15 PM - 03:05 PM", earnings: "Rs. 540" },
    { route: "Route 07: Fewa Connector", time: "03:25 PM - 04:10 PM", earnings: "Rs. 430" },
  ];
  const earningsGrowth = "+12%";
  const weeklyTargetPct = 58;
  const earningsBreakdown = [
    { label: "Ticket Sales", value: "Rs. 4,416", note: "92% of total", icon: "ticket", tint: "bg-[rgba(247,212,250,0.82)]", accent: "text-[var(--drv-purple)]" },
    { label: "Bonus", value: "Rs. 500", note: "", icon: "wallet", tint: "bg-[rgba(247,212,250,0.82)]", accent: "text-[var(--drv-purple)]" },
    { label: "Deductions", value: "- Rs. 116", note: "", icon: "trend", tint: "bg-[rgba(252,224,230,0.84)]", accent: "text-rose-700" },
  ];
  const fuelBars = [
    { day: "Mon", value: 50 },
    { day: "Tue", value: 72 },
    { day: "Wed", value: 34 },
    { day: "Thu", value: 58 },
    { day: "Fri", value: 76 },
    { day: "Sat", value: 64 },
    { day: "Today", value: 78 },
  ];
  const activeTripStartedLabel = activeTrip?.started_at ? formatTime(activeTrip.started_at) : shiftStartTime;
  const currentStopName = routeStops[Math.max(stopProgressIndex, 0)]?.stop?.name || routeStops[0]?.stop?.name || "--";
  const routeStatusLabel = currentTrip?.deviation_mode ? "Deviation Mode" : tripAwaitingStart ? "Awaiting Start" : "On Route";
  const gpsStateLabel = autoShare ? "GPS Live" : latestLocation ? "Manual Mode" : "Waiting";
  const stopsRemaining = routeStops.length ? Math.max(routeStops.length - Math.max(stopProgressIndex + 1, 1), 0) : 0;
  const priorityPassengerStop = pendingPickupRequests[0]?.marker_stop_name || onboardDropRequests[0]?.marker_stop_name || "--";
  const routeProgressPct = routeStops.length > 1 && stopProgressIndex >= 0
    ? Math.min(100, Math.max(12, Math.round((stopProgressIndex / (routeStops.length - 1)) * 100)))
    : liveBusPoint ? 18 : 0;
  const visibleStopCount = expandStops ? routeStops.length : Math.min(routeStops.length, Math.max(stopProgressIndex + 4, 4));
  const visibleStops = routeStops.slice(0, visibleStopCount);
  const hiddenStopCount = Math.max(routeStops.length - visibleStopCount, 0);
  const simulationPoint = simulationPoints[Math.min(simulationIndex, Math.max(simulationPoints.length - 1, 0))] || null;
  const simulationTotalPoints = simulationPointsCount || simulationPoints.length;
  const simulationActionLabel = simulationActive ? "Restart Live" : simulationIndex > 0 ? "Resume Simulation" : "Start Simulation";
  const pendingStartLabel = pendingTrip?.helper_start_confirmed
    ? "Helper confirmed. Waiting on driver."
    : pendingTrip?.driver_start_confirmed
      ? "Driver confirmed. Waiting on helper."
      : "Trip is waiting for the first confirmation.";
  const pendingEndLabel = activeTrip?.helper_end_confirmed
    ? "Helper has confirmed trip end. Waiting on driver."
    : activeTrip?.driver_end_confirmed
      ? "Driver has confirmed trip end. Waiting on helper."
      : "End confirmation has not been requested yet.";
  const visibleHistoryTrips = showAllHistoryTrips ? recentHistoryTrips : recentHistoryTrips.slice(0, 3);

  const loadDashboard = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get("/api/trips/driver/dashboard/");
      setDashboard(response.data);
      setLatestLocation(response.data.latest_location || null);
      setSimulationActive(Boolean(response.data.simulation?.is_active));
      setSimulationIndex(Number(response.data.simulation?.current_index || 0));
      setSimulationPointsCount(Number(response.data.simulation?.points_count || 0));
      setErr("");
    } catch (error) {
      setErr(error?.response?.data?.detail || "Failed to load driver dashboard.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadAssignedBus = async () => {
    try {
      const response = await api.get("/api/transport/my-bus/");
      setAssignedBus(response.data.bus || null);
    } catch {
      // Ignore optional assigned bus failures.
    }
  };

  useEffect(() => { loadDashboard(); loadAssignedBus(); }, []);
  useEffect(() => {
    if (!currentTrip?.id) return undefined;
    const timer = setInterval(() => {
      loadDashboard({ silent: true });
    }, activeTab === "active" || simulationActive ? 1000 : 3000);
    return () => clearInterval(timer);
  }, [activeTab, currentTrip?.id, simulationActive]);
  useEffect(() => { if (currentTrip) setActiveTab("active"); }, [currentTrip]);
  useEffect(() => { setExpandStops(false); }, [currentTrip?.id]);
  useEffect(() => {
    setSimulationActive(false);
    setSimulationIndex(0);
    setSimulationPointsCount(0);
  }, [activeTrip?.id]);
  useEffect(() => {
    if (!routeId && manualOptions.routes.length) setRouteId(String(manualOptions.routes[0].id));
    if (!busId && manualOptions.buses.length) setBusId(String(manualOptions.buses[0].id));
    if (!helperId && manualOptions.helpers.length) setHelperId(String(manualOptions.helpers[0].id));
  }, [manualOptions, routeId, busId, helperId]);
  useEffect(() => {
    if (!currentTrip?.id) {
      setRouteStops([]);
      setPassengerRequests([]);
      setRoadPolyline([]);
      return;
    }
    api.get(`/api/trips/${currentTrip.id}/`)
      .then((response) => {
        setRouteStops(response.data.route_stops || []);
        setPassengerRequests(response.data.passenger_requests || []);
      })
      .catch(() => {
        setRouteStops([]);
        setPassengerRequests([]);
      });
  }, [currentTrip?.id]);
  useEffect(() => {
    if (routePolyline.length < 2) { setRoadPolyline([]); return; }
    const controller = new AbortController();
    snapRouteToRoad(routePolyline, controller.signal).then((points) => setRoadPolyline(points.length > 1 ? points : [])).catch((error) => { if (error.name !== "AbortError") setRoadPolyline([]); });
    return () => controller.abort();
  }, [routePolyline]);

  const runAction = async (fn, successMsg) => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const response = await fn();
      setMsg(response?.data?.message || successMsg);
      await loadDashboard({ silent: true });
    } catch (error) {
      setErr(error?.response?.data?.detail || "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const startScheduledTrip = async (id) => {
    await runAction(() => api.post("/api/trips/start/", { schedule_id: id, deviation_mode: deviationMode }), "Trip start request sent.");
    setActiveTab("active");
  };

  const startManualTrip = async () => {
    if (!(routeId && busId && helperId)) {
      setErr("Select route, bus, and helper first.");
      return;
    }
    await runAction(() => api.post("/api/trips/start/", { route_id: Number(routeId), bus_id: Number(busId), helper_id: Number(helperId), deviation_mode: deviationMode }), "Manual trip start request sent.");
    setActiveTab("active");
  };

  const endTrip = async () => {
    if (!activeTrip) return;
    await runAction(() => api.post(`/api/trips/${activeTrip.id}/end/`), "Trip end confirmation sent.");
    setAutoShare(false);
    setLocationStatus("");
    setRouteStops([]);
    if (!activeTrip?.helper_end_confirmed) {
      setActiveTab("active");
    } else {
      setActiveTab("history");
    }
  };

  const postLocation = useCallback(async (payload) => {
    if (!activeTrip?.id) { setErr("Start a trip first."); return; }
    setLocationBusy(true);
    setErr("");
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      setLocationStatus("Live GPS tracking active.");
      try {
        const response = await api.post(`/api/trips/${activeTrip.id}/location/`, payload);
        setLatestLocation(response.data);
        setSimulationActive(false);
      } catch {
        // Ignore HTTP fallback errors when WebSocket is already live.
      }
    } else {
      queueRef.current.push(payload);
      setLocationStatus(`Offline queue: ${queueRef.current.length} point(s).`);
    }
    setLocationBusy(false);
  }, [activeTrip?.id, wsRef, queueRef]);

  useEffect(() => {
    if (!activeTrip?.id) return;
    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    const connect = () => {
      const socket = new WebSocket(`${wsProtocol}://${window.location.hostname}:8000/ws/transport/trips/${activeTrip.id}/`);
      socket.onopen = () => {
        if (queueRef.current.length > 0) {
          queueRef.current.forEach((payload) => socket.send(JSON.stringify(payload)));
          queueRef.current = [];
        }
      };
      socket.onclose = () => setTimeout(connect, 3000);
      wsRef.current = socket;
    };
    connect();
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, [activeTrip?.id, queueRef, wsRef]);

  const clearWatch = useCallback(() => {
    if (locationWatch.id !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(locationWatch.id);
      locationWatch.id = null;
    }
  }, [locationWatch]);

  const sendBrowserLocation = useCallback(() => {
    if (!navigator.geolocation) { setErr("Geolocation not supported."); setAutoShare(false); return; }
    navigator.geolocation.getCurrentPosition((position) => postLocation({ lat: position.coords.latitude, lng: position.coords.longitude, speed: Number.isFinite(position.coords.speed) ? position.coords.speed : null, heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null }), (error) => { setErr(error.message); setAutoShare(false); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 });
  }, [postLocation]);

  const sendManualLocation = () => {
    const lat = Number(manualLat);
    const lng = Number(manualLng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) { setErr("Enter valid latitude and longitude."); return; }
    postLocation({ lat, lng, speed: null, heading: null });
  };

  const applySimulationResponse = useCallback((data, statusText) => {
    if (data?.latest_location) {
      setLatestLocation(data.latest_location);
      setManualLat(Number(data.latest_location.lat).toFixed(6));
      setManualLng(Number(data.latest_location.lng).toFixed(6));
    }
    setSimulationActive(Boolean(data?.simulation?.is_active));
    setSimulationIndex(Number(data?.simulation?.current_index || 0));
    setSimulationPointsCount(Number(data?.simulation?.points_count || 0));
    setLocationStatus(statusText);
  }, []);

  const startSimulation = useCallback(async () => {
    if (!activeTrip?.id) { setErr("Start a trip first."); return; }
    setLocationBusy(true);
    setAutoShare(false);
    setErr("");
    setMsg("");
    try {
      const response = await api.post(`/api/trips/${activeTrip.id}/simulate/start/`, {
        points: simulationPoints,
        step_interval_ms: Number(simulationSpeedMs),
      });
      applySimulationResponse(response.data, "Backend simulation running.");
      setMsg("Simulation started. Passenger tracking will keep moving even after driver logout.");
    } catch (error) {
      setErr(error?.response?.data?.detail || "Unable to start the simulator.");
    } finally {
      setLocationBusy(false);
    }
  }, [activeTrip?.id, applySimulationResponse, simulationPoints, simulationSpeedMs]);

  const pauseSimulation = useCallback(async () => {
    if (!activeTrip?.id) return;
    setLocationBusy(true);
    setErr("");
    try {
      const response = await api.post(`/api/trips/${activeTrip.id}/simulate/pause/`);
      applySimulationResponse(response.data, "Simulation paused.");
    } catch (error) {
      setErr(error?.response?.data?.detail || "Unable to pause the simulator.");
    } finally {
      setLocationBusy(false);
    }
  }, [activeTrip?.id, applySimulationResponse]);

  const resetSimulation = useCallback(async () => {
    if (!activeTrip?.id) return;
    setLocationBusy(true);
    setErr("");
    try {
      const response = await api.post(`/api/trips/${activeTrip.id}/simulate/reset/`);
      applySimulationResponse(response.data, "Simulation reset to the route start.");
    } catch (error) {
      setErr(error?.response?.data?.detail || "Unable to reset the simulator.");
    } finally {
      setLocationBusy(false);
    }
  }, [activeTrip?.id, applySimulationResponse]);

  const sendSimulationStep = useCallback(async () => {
    if (!activeTrip?.id) { setErr("Start a trip first."); return; }
    setLocationBusy(true);
    setAutoShare(false);
    setErr("");
    try {
      const response = await api.post(`/api/trips/${activeTrip.id}/simulate/step/`);
      applySimulationResponse(response.data, `Simulation point ${Number(response.data?.simulation?.current_index || 0) + 1}/${simulationTotalPoints || 0} sent.`);
    } catch (error) {
      setErr(error?.response?.data?.detail || "Unable to send the next simulation point.");
    } finally {
      setLocationBusy(false);
    }
  }, [activeTrip?.id, applySimulationResponse, simulationTotalPoints]);

  useEffect(() => { setAutoShare(Boolean(activeTrip?.id)); }, [activeTrip?.id]);
  useEffect(() => {
    if (!activeTrip?.id || !autoShare) { clearWatch(); return; }
    if (!navigator.geolocation) { setErr("Geolocation not supported."); setAutoShare(false); return; }
    sendBrowserLocation();
    const id = navigator.geolocation.watchPosition((position) => postLocation({ lat: position.coords.latitude, lng: position.coords.longitude, speed: Number.isFinite(position.coords.speed) ? position.coords.speed : null, heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null }), (error) => { setErr(error.message); setAutoShare(false); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 });
    locationWatch.id = id;
    return () => {
      navigator.geolocation.clearWatch(id);
      if (locationWatch.id === id) locationWatch.id = null;
    };
  }, [autoShare, activeTrip?.id, clearWatch, locationWatch, postLocation, sendBrowserLocation]);
  const handleLogout = () => {
    clearWatch();
    clearToken();
    navigate("/auth/login");
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

  const handleViewAllTrips = () => {
    const next = !showAllHistoryTrips;
    setShowAllHistoryTrips(next);
    setErr("");
    setMsg(next ? "Showing the full recent trip list." : "Showing the latest recent trips.");
  };

  const handleMarkShiftComplete = () => {
    setErr("");
    if (activeTrip || pendingTrip) {
      setMsg("");
      setErr("Finish the current trip before marking the shift complete.");
      return;
    }
    setShowAllHistoryTrips(false);
    setMsg("Shift marked complete. Returning to the home dashboard.");
    setActiveTab("home");
  };

  const handleWithdraw = async () => {
    setErr("");
    const summary = `MetroBus earnings summary
Driver: ${user?.full_name || "Driver"}
Date: ${lastShiftDate}
Today earnings: Rs. ${todaysEarnings.toLocaleString()}
Completed trips: ${completedTrips}
Passengers served: ${totalPassengers}`;
    const copied = await copyToClipboard(summary);
    setMsg(copied ? "Earnings summary copied. Share it with finance to process the withdrawal." : "Earnings are ready for withdrawal review.");
  };

  const handleReportIssue = async () => {
    setErr("");
    const summary = `MetroBus earnings issue
Driver: ${user?.full_name || "Driver"}
Route: ${currentRoute}
Bus: ${currentBus}
Today earnings: Rs. ${todaysEarnings.toLocaleString()}
Please review the earnings breakdown for this shift.`;
    const copied = await copyToClipboard(summary);
    setMsg(copied ? "Issue summary copied. Send it to operations support." : "Issue summary prepared for support.");
  };

  if (loading) {
    return <div style={theme} className="flex min-h-screen items-center justify-center bg-[var(--drv-bg)] text-[var(--drv-text)]"><div className="text-center"><div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[var(--drv-purple)] border-t-transparent" /><p className="mt-4 text-sm font-medium text-[var(--drv-muted)]">Loading driver dashboard...</p></div></div>;
  }

  return (
    <div style={theme} className="min-h-screen bg-[linear-gradient(180deg,var(--drv-bg),var(--drv-bg-end))] text-[var(--drv-text)]">
      <header className="sticky top-0 z-30 border-b border-[var(--drv-border)] bg-[var(--drv-header)] px-4 py-4 backdrop-blur-xl">
        <div className={`${APP_SHELL_CLASS} flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-[linear-gradient(135deg,var(--drv-purple),var(--drv-purple-2))] text-sm font-black text-white shadow-[var(--drv-shadow-strong)]">{(user?.full_name || "DR").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-[var(--drv-shadow)]"><span className="text-xs font-black uppercase tracking-[0.2em] text-[var(--drv-purple)]">MB</span></div>
          </div>
          <div className="flex items-center gap-2">
            <Pill tone={activeTrip ? "live" : pendingTrip ? "warn" : "idle"}>{activeTrip ? "Trip Live" : pendingTrip ? "Start Pending" : "Standby"}</Pill>
            <button type="button" onClick={() => loadDashboard()} className="grid h-11 w-11 place-items-center rounded-full border border-[var(--drv-border)] bg-white/80 text-[var(--drv-purple)] shadow-[var(--drv-shadow)]"><Icon name="refresh" /></button>
            {activeTab !== "home" ? <button type="button" onClick={toggle} className="grid h-11 w-11 place-items-center rounded-full border border-[var(--drv-border)] bg-white/80 text-[var(--drv-purple)] shadow-[var(--drv-shadow)]"><Icon name={isDark ? "sun" : "moon"} /></button> : null}
            <button type="button" onClick={handleLogout} className="grid h-11 w-11 place-items-center rounded-full border border-[var(--drv-border)] bg-white/80 text-[var(--drv-plum)] shadow-[var(--drv-shadow)]"><Icon name="logout" /></button>
          </div>
        </div>
      </header>

      <main className={`${APP_SHELL_CLASS} px-4 py-5 pb-32 sm:px-5`}>
        {err ? <div className="mb-4 rounded-[1.6rem] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{err}</div> : null}
        {msg ? <div className="mb-4 rounded-[1.6rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{msg}</div> : null}

        <section className="relative overflow-hidden rounded-[2.6rem] bg-[linear-gradient(135deg,var(--drv-purple),var(--drv-purple-2))] p-6 text-white shadow-[var(--drv-shadow-strong)]">
          <div className="absolute inset-y-0 right-0 w-32 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.14),transparent_62%)]" />
          <p className="text-[0.7rem] font-black uppercase tracking-[0.28em] text-white/70">{activeTrip ? "Route In Progress" : pendingTrip ? "Trip Confirmation" : "Shift Dashboard"}</p>
          <h1 className="mt-3 text-5xl font-black leading-[0.92] whitespace-pre-line">{activeTrip ? "ROUTE\nLIVE" : pendingTrip ? "WAITING\nTO GO" : "READY TO\nSTART"}</h1>
          <p className="mt-4 text-base font-medium text-white/84">{activeTrip ? `${currentRoute} is active now. Keep GPS sharing on and watch the next stop.` : pendingTrip ? `${currentRoute} is almost ready. ${pendingStartLabel}` : `Shift starts at ${shiftStartTime} - Current City: Pokhara.`}</p>
          <div className="mt-6 rounded-[2rem] border border-white/20 bg-white/10 p-4 backdrop-blur">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-white/14 text-white"><Icon name="bus" className="h-7 w-7" /></div>
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-white/70">Assigned Bus</p>
                <p className="mt-1 text-2xl font-black">{currentBus}</p>
                <p className="mt-1 text-sm text-white/78">{capacity} seats - AC service - Helper: {helperName}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[{ label: "Planned Trips", value: plannedTrips, note: "Today", icon: "history" }, { label: "On Track", value: homeStatus, note: "Status", icon: "route" }, { label: "Today Earnings", value: `Rs. ${todaysEarnings.toLocaleString()}`, note: "Today earnings", icon: "wallet" }, { label: "Fuel Level", value: `${fuelLevel}%`, note: "Tank status", icon: "fuel" }].map((card, index) => (
            <Panel key={card.label} className={`${index === 2 ? "bg-[var(--drv-soft)]" : index === 3 ? "bg-white" : "bg-[rgba(247,224,249,0.84)]"} min-h-[10.4rem]`}>
              <div className="text-[var(--drv-purple)]"><Icon name={card.icon} /></div>
              <p className="mt-10 text-[0.7rem] font-black uppercase tracking-[0.22em] text-[var(--drv-muted)]">{card.label}</p>
              <p className={`mt-2 font-black leading-none text-[var(--drv-text)] ${index === 1 ? "text-[1.65rem]" : "text-[1.9rem]"}`}>{card.value}</p>
              {card.icon === "fuel" ? <div className="mt-4 h-2 rounded-full bg-[#f0dce4]"><div className="h-2 rounded-full bg-[linear-gradient(135deg,var(--drv-purple),var(--drv-purple-2))]" style={{ width: `${fuelLevel}%` }} /></div> : null}
              <p className="mt-2 text-xs text-[var(--drv-muted)]">{card.note}</p>
            </Panel>
          ))}
        </div>

        {activeTab === "home" ? (
          <>
            <Panel className="mt-5">
              <div className="flex items-start justify-between gap-3">
                <div><SectionLabel>Manual Trip Setup</SectionLabel><h2 className="text-4xl font-black leading-[1.02]">Manual Trip Setup</h2></div>
                <div className="flex items-center gap-3 rounded-full bg-[var(--drv-soft)] px-4 py-3"><div><p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[var(--drv-muted)]">Deviation</p><p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[var(--drv-muted)]">Mode</p></div><button type="button" onClick={() => setDeviationMode((value) => !value)} className={`relative h-7 w-12 rounded-full transition ${deviationMode ? "bg-[var(--drv-purple)]" : "bg-[#ead4f6]"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${deviationMode ? "left-6" : "left-1"}`} /></button></div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <SelectField label="Route" value={routeId} onChange={setRouteId} options={routeOptions} />
                <SelectField label="Bus" value={busId} onChange={setBusId} options={busOptions} />
                <SelectField label="Helper / Conductor" value={helperId} onChange={setHelperId} options={helperOptions} />
              </div>
              {!manualOptions.helpers.length ? <p className="mt-4 rounded-[1.4rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">No helpers are currently available for manual assignment.</p> : null}
              <ActionButton tone="primary" onClick={() => (nextSchedule ? startScheduledTrip(nextSchedule.id) : startManualTrip())} disabled={busy || (!nextSchedule && (!routeId || !busId || !helperId))} className="mt-5 w-full !py-5 !text-base"><Icon name="play" />{busy ? "Starting Trip" : "Start Trip"}</ActionButton>
            </Panel>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-3xl font-black">Upcoming Schedules</h2>
                <Pill tone={minutesToDeparture !== null && minutesToDeparture > 0 ? "warn" : "idle"}>{minutesToDeparture !== null ? `${Math.max(minutesToDeparture, 0)} min` : "Today"}</Pill>
              </div>
              <div className="space-y-3">
                {schedules.length === 0 ? (
                  <Panel>
                    <p className="text-sm text-[var(--drv-muted)]">No planned schedules right now.</p>
                  </Panel>
                ) : schedules.slice(0, 4).map((schedule, index) => (
                  <button
                    key={schedule.id}
                    type="button"
                    onClick={() => startScheduledTrip(schedule.id)}
                    disabled={busy || Boolean(currentTrip)}
                    className={`flex w-full items-start gap-4 rounded-[1.8rem] border px-4 py-4 text-left shadow-[var(--drv-shadow)] transition ${index === 0 ? "border-transparent bg-[var(--drv-soft)]" : "border-[var(--drv-border)] bg-white/72"}`}
                  >
                    <div className="min-w-[4.8rem] rounded-[1.4rem] bg-white/70 px-3 py-3 text-center">
                      <p className="text-2xl font-black leading-none text-[var(--drv-purple)]">{formatTime(schedule.scheduled_start_time)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-lg font-black leading-snug">{schedule.route_name}</p>
                      <p className="mt-1 break-words text-sm leading-6 text-[var(--drv-muted)]">{schedule.bus_plate} | {schedule.helper_name || "Helper pending"}</p>
                    </div>
                    {index === 0 ? <span className="rounded-full bg-[linear-gradient(135deg,var(--drv-purple),var(--drv-purple-2))] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white">Active</span> : null}
                  </button>
                ))}
              </div>
            </div>

            <Panel className="mt-5 bg-[rgba(255,240,239,0.9)]"><div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-[rgba(255,107,115,0.12)] text-[var(--drv-purple)]"><Icon name="alert" /></div><div><SectionLabel>Traffic Alert</SectionLabel><p className="text-lg font-black">Heavy congestion reported near Mahendrapul.</p><p className="mt-2 text-sm leading-6 text-[var(--drv-muted)]">Consider switching to deviation mode if your next departure starts before the scheduled corridor clears.</p></div></div></Panel>
          </>
        ) : null}

        {activeTab === "active" ? (
          !currentTrip ? (
            <div className="mt-5 space-y-5 pb-32">
              <Panel>
                <SectionLabel>Active Trip</SectionLabel>
                <h2 className="mt-2 text-3xl font-black leading-tight">You are on standby right now</h2>
                <p className="mt-3 text-sm leading-6 text-[var(--drv-muted)]">
                  Start a scheduled trip or launch a manual trip from this tab. As soon as the trip goes live, GPS Management and the Route Simulator will appear here.
                </p>
              </Panel>

              {nextSchedule ? (
                <Panel className="bg-[rgba(247,224,249,0.82)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <SectionLabel>Next Scheduled Trip</SectionLabel>
                      <p className="mt-2 break-words text-2xl font-black leading-snug">{nextSchedule.route_name}</p>
                      <p className="mt-2 break-words text-sm leading-6 text-[var(--drv-muted)]">{nextSchedule.bus_plate} | {nextSchedule.helper_name || "Helper pending"}</p>
                    </div>
                    <Pill tone={minutesToDeparture !== null && minutesToDeparture > 0 ? "warn" : "idle"}>
                      {minutesToDeparture !== null ? `${Math.max(minutesToDeparture, 0)} min` : "Queued"}
                    </Pill>
                  </div>
                  <div className="mt-4 rounded-[1.5rem] bg-white/80 px-4 py-4">
                    <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--drv-muted)]">Departure Window</p>
                    <p className="mt-2 text-lg font-black text-[var(--drv-text)]">{formatTime(nextSchedule.scheduled_start_time)}</p>
                  </div>
                  <ActionButton tone="primary" onClick={() => startScheduledTrip(nextSchedule.id)} disabled={busy} className="mt-4 w-full !py-4">
                    <Icon name="play" className="h-4 w-4" />
                    {busy ? "Starting Trip" : "Start Scheduled Trip"}
                  </ActionButton>
                </Panel>
              ) : null}

              <Panel>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <SectionLabel>Manual Trip Setup</SectionLabel>
                    <p className="mt-2 text-2xl font-black">Start from Active Trip tab</p>
                  </div>
                  <div className="flex items-center gap-3 rounded-full bg-[var(--drv-soft)] px-4 py-3">
                    <div>
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[var(--drv-muted)]">Deviation</p>
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[var(--drv-muted)]">Mode</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeviationMode((value) => !value)}
                      className={`relative h-7 w-12 rounded-full transition ${deviationMode ? "bg-[var(--drv-purple)]" : "bg-[#ead4f6]"}`}
                    >
                      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${deviationMode ? "left-6" : "left-1"}`} />
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <SelectField label="Route" value={routeId} onChange={setRouteId} options={routeOptions} />
                  <SelectField label="Bus" value={busId} onChange={setBusId} options={busOptions} />
                  <SelectField label="Helper / Conductor" value={helperId} onChange={setHelperId} options={helperOptions} />
                </div>

                <ActionButton tone="primary" onClick={startManualTrip} disabled={busy || !routeId || !busId || !helperId} className="mt-5 w-full !py-4">
                  <Icon name="play" className="h-4 w-4" />
                  {busy ? "Starting Trip" : "Start Manual Trip"}
                </ActionButton>
              </Panel>

              <Panel className="bg-white/80">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <SectionLabel>GPS Management</SectionLabel>
                    <p className="mt-2 text-2xl font-black">Waiting for an active trip</p>
                  </div>
                  <Pill tone="idle">Standby</Pill>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--drv-muted)]">
                  After you start a trip, this tab will unlock live GPS sharing, manual coordinate sending, and the route simulator for passenger tracking.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button type="button" disabled className="rounded-full border border-[var(--drv-border)] bg-[var(--drv-soft)] px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-[var(--drv-muted)] opacity-70">
                    GPS Management Locked
                  </button>
                  <button type="button" disabled className="rounded-full border border-[var(--drv-border)] bg-[var(--drv-soft)] px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-[var(--drv-muted)] opacity-70">
                    Route Simulator Locked
                  </button>
                </div>
              </Panel>
            </div>
          ) : tripAwaitingStart ? (
            <div className="mt-5 space-y-5 pb-32">
              <div className="overflow-hidden rounded-[2.3rem] bg-[linear-gradient(135deg,var(--drv-purple),var(--drv-purple-2))] p-5 text-white shadow-[var(--drv-shadow-strong)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-white/72">Trip Confirmation</p>
                    <h2 className="mt-3 break-words text-4xl font-black leading-[1.02]">{currentRoute}</h2>
                    <p className="mt-3 break-words text-sm font-semibold leading-6 text-white/80">{currentBus} | Helper {helperName}</p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-white/14 px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.18em] text-white shadow-[0_10px_22px_rgba(71,39,81,0.18)]">
                    Start Pending
                  </span>
                </div>

                <div className="mt-5 rounded-[1.7rem] bg-white/12 p-4 backdrop-blur-sm">
                  <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-white/72">Confirmation Status</p>
                  <p className="mt-2 text-xl font-black">{pendingStartLabel}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.14em] ${pendingTrip?.driver_start_confirmed ? "bg-emerald-500/18 text-white" : "bg-white/12 text-white/82"}`}>
                      Driver {pendingTrip?.driver_start_confirmed ? "Confirmed" : "Pending"}
                    </span>
                    <span className={`rounded-full px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.14em] ${pendingTrip?.helper_start_confirmed ? "bg-emerald-500/18 text-white" : "bg-white/12 text-white/82"}`}>
                      Helper {pendingTrip?.helper_start_confirmed ? "Confirmed" : "Pending"}
                    </span>
                  </div>
                </div>
              </div>

              <Panel>
                <SectionLabel>What Happens Next</SectionLabel>
                <h3 className="mt-2 text-3xl font-black">Trip is waiting on staff confirmation</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--drv-muted)]">
                  The trip will become officially LIVE only after both you and the assigned helper confirm the start. GPS sharing and the route simulator stay locked until then.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.5rem] bg-[var(--drv-soft)] px-4 py-4">
                    <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--drv-muted)]">Assigned Helper</p>
                    <p className="mt-2 text-lg font-black">{helperName}</p>
                  </div>
                  <div className="rounded-[1.5rem] bg-[var(--drv-soft)] px-4 py-4">
                    <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--drv-muted)]">Deviation Mode</p>
                    <p className="mt-2 text-lg font-black">{currentTrip?.deviation_mode ? "Enabled" : "Off"}</p>
                  </div>
                </div>
                {!pendingTrip?.driver_start_confirmed && pendingTrip?.schedule_id ? (
                  <ActionButton tone="primary" onClick={() => startScheduledTrip(pendingTrip.schedule_id)} disabled={busy} className="mt-5 w-full !py-4">
                    <Icon name="play" className="h-4 w-4" />
                    {busy ? "Confirming Trip" : "Confirm Trip Start"}
                  </ActionButton>
                ) : null}
              </Panel>

              <Panel className="bg-white/80">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <SectionLabel>GPS Management</SectionLabel>
                    <p className="mt-2 text-2xl font-black">Locked until both confirm</p>
                  </div>
                  <Pill tone="warn">Pending</Pill>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--drv-muted)]">
                  As soon as the helper confirms from their MetroBus Helper screen, this trip will switch to LIVE here and unlock GPS Management, route progress, and the simulator.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button type="button" disabled className="rounded-full border border-[var(--drv-border)] bg-[var(--drv-soft)] px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-[var(--drv-muted)] opacity-70">
                    GPS Management Locked
                  </button>
                  <button type="button" disabled className="rounded-full border border-[var(--drv-border)] bg-[var(--drv-soft)] px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-[var(--drv-muted)] opacity-70">
                    Route Simulator Locked
                  </button>
                </div>
              </Panel>
            </div>
          ) : (
            <div className="mt-5 space-y-5 pb-40">
              <div className="overflow-hidden rounded-[2.3rem] bg-[linear-gradient(135deg,var(--drv-purple),var(--drv-purple-2))] p-5 text-white shadow-[var(--drv-shadow-strong)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-white/72">Current Route</p>
                    <h2 className="mt-3 break-words text-4xl font-black leading-[1.02]">{currentRoute}</h2>
                    <p className="mt-3 break-words text-sm font-semibold leading-6 text-white/80">{currentBus} | Helper {helperName}</p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-white/14 px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.18em] text-white shadow-[0_10px_22px_rgba(71,39,81,0.18)]">
                    Trip Live
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <div className="rounded-[1.7rem] bg-white/12 p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 place-items-center rounded-full bg-white/14 text-white">
                        <Icon name="bus" />
                      </div>
                      <div>
                        <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-white/72">Current Stop</p>
                        <p className="mt-1 break-words text-xl font-black leading-snug">{currentStopName}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white/12 px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.14em] text-white/82">
                        Started {activeTripStartedLabel}
                      </span>
                      <span className="rounded-full bg-white/12 px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.14em] text-white/82">
                        {stopsRemaining} Stops Left
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:w-[11.5rem]">
                    <div className="rounded-[1.4rem] bg-white/12 px-4 py-3">
                      <p className="text-[0.64rem] font-black uppercase tracking-[0.22em] text-white/70">Route Status</p>
                      <p className="mt-2 text-lg font-black">{routeStatusLabel}</p>
                    </div>
                    <div className="rounded-[1.4rem] bg-white/12 px-4 py-3">
                      <p className="text-[0.64rem] font-black uppercase tracking-[0.22em] text-white/70">Passenger Stops</p>
                      <p className="mt-2 text-lg font-black">{predictedPax} active</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.18em] text-white/74">
                    <span>Progress</span>
                    <span>{routeProgressPct}% Complete</span>
                  </div>
                  <div className="mt-3 h-2.5 rounded-full bg-white/16">
                    <div className="h-full rounded-full bg-white" style={{ width: `${routeProgressPct}%` }} />
                  </div>
                </div>
              </div>

              {activeTrip?.waiting_for_end_confirmation ? (
                <Panel className="bg-[rgba(255,244,248,0.9)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <SectionLabel>End Confirmation</SectionLabel>
                      <p className="mt-2 text-2xl font-black">Trip end is waiting on the other staff member</p>
                      <p className="mt-3 text-sm leading-6 text-[var(--drv-muted)]">{pendingEndLabel}</p>
                    </div>
                    <Pill tone="warn">Ending</Pill>
                  </div>
                </Panel>
              ) : null}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Occupancy", value: `${occupancyPct}%`, note: `${occupied}/${capacity} seats` },
                  { label: "Next Stop", value: nextStop, note: `Prev: ${previousStop}` },
                  { label: "GPS Status", value: gpsStateLabel, note: locationStatus || "Waiting for sync" },
                  { label: "Route Status", value: routeStatusLabel, note: liveBusPoint ? "Live route synced" : "Waiting for GPS" },
                ].map((card) => (
                  <Panel key={card.label}>
                    <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--drv-muted)]">{card.label}</p>
                    <p className="mt-3 text-2xl font-black leading-tight">{card.value}</p>
                    <p className="mt-2 text-xs text-[var(--drv-muted)]">{card.note}</p>
                  </Panel>
                ))}
              </div>

              <Panel className="overflow-hidden !p-0">
                <div className="flex items-center justify-between border-b border-[var(--drv-border)] px-5 py-4">
                  <div>
                    <SectionLabel>Live Route Map</SectionLabel>
                    <p className="mt-1 break-words text-lg font-black leading-snug">{currentRoute}</p>
                  </div>
                  <Pill tone={liveBusPoint ? "live" : "idle"}>{liveBusPoint ? "Bus Live" : "No GPS"}</Pill>
                </div>

                <div className="relative h-[21rem] w-full">
                  <div className="pointer-events-none absolute left-4 top-4 z-[500] max-w-[14rem] rounded-[1.5rem] bg-white/92 px-4 py-3 shadow-[var(--drv-shadow)] backdrop-blur-xl">
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.24em] text-[var(--drv-purple)]">Direction</p>
                    <p className="mt-2 break-words text-sm font-black leading-6 text-[var(--drv-text)]">{nextStop !== "--" ? `Next stop: ${nextStop}` : "Waiting for first stop update"}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--drv-muted)]">
                      {liveBusPoint ? `${stopsRemaining} remaining stop${stopsRemaining === 1 ? "" : "s"} on this trip.` : "Share location to sync the live marker and route progress."}
                    </p>
                  </div>
                  {passengerRequests.length ? (
                    <div className="pointer-events-none absolute bottom-4 right-4 z-[500] rounded-[1.5rem] bg-white/92 px-4 py-3 text-right shadow-[var(--drv-shadow)] backdrop-blur-xl">
                      <p className="text-[0.62rem] font-black uppercase tracking-[0.22em] text-[var(--drv-purple)]">Passenger Demand</p>
                      <p className="mt-2 break-words text-sm font-black leading-6 text-[var(--drv-text)]">
                        {pendingPickupRequests.length} pickup{pendingPickupRequests.length === 1 ? "" : "s"} | {onboardDropRequests.length} onboard
                      </p>
                      <p className="mt-1 break-words text-xs leading-5 text-[var(--drv-muted)]">Priority stop: {priorityPassengerStop}</p>
                    </div>
                  ) : null}

                  <MapContainer center={[28.2096, 83.9856]} zoom={13} scrollWheelZoom={false} className="h-full w-full">
                    <TileLayer attribution="&copy; OpenStreetMap &copy; CARTO" url={isDark ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"} />
                    <MapViewport points={mapPoints} />
                    {displayedPolyline.length > 0 ? <Polyline positions={displayedPolyline} pathOptions={{ color: "#ff6b73", weight: 5, opacity: 0.9 }} /> : null}
                    {routeStops.map((item, index) => {
                      const lat = Number(item.stop?.lat);
                      const lng = Number(item.stop?.lng);
                      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                      const current = index === Math.max(stopProgressIndex, 0) && liveBusPoint;
                      return (
                        <CircleMarker
                          key={`${item.stop_order}-${item.stop?.name}`}
                          center={[lat, lng]}
                          radius={current ? 8 : 5}
                          pathOptions={{ color: current ? "#ff6b73" : "#af8bbf", fillColor: current ? "#ff6b73" : "#f0dce4", fillOpacity: 0.95 }}
                        >
                          <Popup>Stop {item.stop_order}: {item.stop?.name}</Popup>
                        </CircleMarker>
                      );
                    })}
                    {passengerRequests.map((request) => {
                      const lat = Number(request.marker_lat);
                      const lng = Number(request.marker_lng);
                      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                      const isPickup = request.stage === "pickup";
                      return (
                        <CircleMarker
                          key={`${request.booking_id}-${request.stage}`}
                          center={[lat, lng]}
                          radius={isPickup ? 10 : 8}
                          pathOptions={{
                            color: isPickup ? "#ff8a5b" : "#34155d",
                            fillColor: isPickup ? "#ffb290" : "#ff6b73",
                            fillOpacity: 0.96,
                          }}
                        >
                          <Popup>
                            <div className="space-y-1">
                              <p className="text-sm font-black text-[var(--drv-text)]">{request.passenger_name}</p>
                              <p className="text-xs font-semibold text-[var(--drv-purple)]">{request.stage_label}</p>
                              <p className="text-xs text-[var(--drv-muted)]">
                                {request.pickup_stop_name} to {request.destination_stop_name}
                              </p>
                              <p className="text-xs text-[var(--drv-muted)]">
                                Seats: {(request.seat_labels || []).join(", ") || request.seats_count}
                              </p>
                            </div>
                          </Popup>
                        </CircleMarker>
                      );
                    })}
                    {liveBusPoint ? (
                      <CircleMarker center={liveBusPoint} radius={11} pathOptions={{ color: "#10b981", fillColor: "#34d399", fillOpacity: 1 }}>
                        <Popup>Live bus position</Popup>
                      </CircleMarker>
                    ) : null}
                  </MapContainer>
                </div>
              </Panel>

              <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
                <Panel>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <SectionLabel>GPS Management</SectionLabel>
                      <p className="mt-1 text-2xl font-black">Share and override location</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutoShare((value) => !value)}
                      className={`relative h-7 w-12 rounded-full transition ${autoShare ? "bg-[var(--drv-purple)]" : "bg-[#ead4f6]"}`}
                    >
                      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${autoShare ? "left-6" : "left-1"}`} />
                    </button>
                  </div>

                  <div className="mt-4 rounded-[1.5rem] bg-[var(--drv-soft)] px-4 py-4">
                    <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--drv-muted)]">Auto Sharing</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--drv-text)]">{locationStatus || (autoShare ? "Broadcasting live GPS from this device." : "Auto sharing is paused right now.")}</p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <input className="rounded-[1.4rem] border border-[var(--drv-border)] bg-[var(--drv-soft)] px-4 py-4 text-sm font-medium text-[var(--drv-text)] outline-none" placeholder="Latitude override" value={manualLat} onChange={(event) => setManualLat(event.target.value)} />
                    <input className="rounded-[1.4rem] border border-[var(--drv-border)] bg-[var(--drv-soft)] px-4 py-4 text-sm font-medium text-[var(--drv-text)] outline-none" placeholder="Longitude override" value={manualLng} onChange={(event) => setManualLng(event.target.value)} />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <ActionButton tone="ghost" onClick={sendManualLocation} disabled={locationBusy} className="w-full !py-4">Send Coordinates</ActionButton>
                    <ActionButton tone="primary" onClick={sendBrowserLocation} disabled={locationBusy} className="w-full !py-4">{locationBusy ? "Sending..." : "Send My Location"}</ActionButton>
                  </div>

                  <div className="mt-4 rounded-[1.5rem] border border-[var(--drv-border)] px-4 py-4">
                    <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--drv-muted)]">Latest GPS Point</p>
                    {latestLocation ? (
                      <>
                        <p className="mt-2 text-base font-black text-[var(--drv-purple)]">{Number(latestLocation.lat).toFixed(6)}, {Number(latestLocation.lng).toFixed(6)}</p>
                        <p className="mt-2 text-xs text-[var(--drv-muted)]">Updated {formatDateTime(latestLocation.recorded_at)}</p>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-[var(--drv-muted)]">No live location has been sent yet.</p>
                    )}
                  </div>

                  <div className="mt-4 rounded-[1.7rem] border border-[var(--drv-border)] bg-white/72 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <SectionLabel>Route Simulator</SectionLabel>
                        <p className="mt-1 text-2xl font-black">Send moving bus points</p>
                      </div>
                      <Pill tone={simulationActive ? "live" : "idle"}>{simulationActive ? "Sim Live" : "Manual"}</Pill>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-[var(--drv-muted)]">
                      Use the route simulator to push sample bus coordinates from this device so passengers can see the bus move toward their pickup point.
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                      <div className="rounded-[1.4rem] bg-[var(--drv-soft)] px-4 py-4">
                        <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--drv-muted)]">Simulation Progress</p>
                        <p className="mt-2 text-lg font-black text-[var(--drv-text)]">{simulationTotalPoints ? `${Math.min(simulationIndex + 1, simulationTotalPoints)} / ${simulationTotalPoints} points` : "Route points pending"}</p>
                        <p className="mt-2 text-xs text-[var(--drv-muted)]">
                          {simulationPoint ? `${Number(simulationPoint[0]).toFixed(6)}, ${Number(simulationPoint[1]).toFixed(6)}` : "Load an active route to prepare coordinates."}
                        </p>
                      </div>
                      <div>
                        <label className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--drv-muted)]">Speed</label>
                        <select value={simulationSpeedMs} onChange={(event) => setSimulationSpeedMs(event.target.value)} className="rounded-[1.2rem] border border-[var(--drv-border)] bg-[var(--drv-soft)] px-4 py-4 text-sm font-semibold text-[var(--drv-text)] outline-none">
                          <option value="1000">Fast</option>
                          <option value="3000">Normal</option>
                          <option value="5000">Slow</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <ActionButton tone="primary" onClick={startSimulation} disabled={locationBusy} className="w-full !py-4">
                        <Icon name="play" className="h-4 w-4" />
                        {simulationActionLabel}
                      </ActionButton>
                      <ActionButton tone="ghost" onClick={sendSimulationStep} disabled={locationBusy || !simulationTotalPoints} className="w-full !py-4">
                        Send Next Point
                      </ActionButton>
                      <ActionButton tone="ghost" onClick={pauseSimulation} disabled={!simulationActive} className="w-full !py-4">
                        Pause
                      </ActionButton>
                      <ActionButton tone="ghost" onClick={resetSimulation} disabled={!simulationTotalPoints} className="w-full !py-4">
                        Reset
                      </ActionButton>
                    </div>
                  </div>
                </Panel>

                <Panel>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <SectionLabel>Stop Progress</SectionLabel>
                      <p className="mt-1 text-2xl font-black">Current route timeline</p>
                    </div>
                    {hiddenStopCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setExpandStops(true)}
                        className="rounded-full bg-[var(--drv-soft)] px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--drv-purple)]"
                      >
                        View {Math.min(hiddenStopCount, 3)} More Stops
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 rounded-[1.7rem] bg-white/70 px-4 py-4">
                    <StopTimeline stops={visibleStops} progressIndex={stopProgressIndex} liveBusPoint={liveBusPoint} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-[1.5rem] bg-[var(--drv-soft)] px-4 py-4">
                      <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--drv-muted)]">Current Stop</p>
                      <p className="mt-2 break-words text-lg font-black leading-snug">{currentStopName}</p>
                    </div>
                    <div className="rounded-[1.5rem] bg-[var(--drv-soft)] px-4 py-4">
                      <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--drv-muted)]">Remaining</p>
                      <p className="mt-2 text-lg font-black">{stopsRemaining} stops</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[1.5rem] border border-[var(--drv-border)] bg-white/78 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <SectionLabel>Passenger Stops</SectionLabel>
                        <p className="mt-1 text-xl font-black">Upcoming pickup and drop requests</p>
                      </div>
                      <Pill tone={pendingPickupRequests.length ? "warn" : "idle"}>
                        {pendingPickupRequests.length} pickup
                      </Pill>
                    </div>

                    {passengerRequests.length ? (
                      <div className="mt-4 space-y-3">
                        {passengerRequests.slice(0, 5).map((request) => (
                          <div key={`request-${request.booking_id}-${request.stage}`} className="rounded-[1.3rem] bg-[var(--drv-soft)] px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="break-words text-sm font-black text-[var(--drv-text)]">{request.passenger_name}</p>
                                <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-[var(--drv-purple)]">{request.stage_label}</p>
                              </div>
                              <span className="rounded-full bg-white px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--drv-purple)]">
                                {(request.seat_labels || []).join(", ") || `${request.seats_count} seat`}
                              </span>
                            </div>
                            <p className="mt-3 break-words text-sm font-semibold leading-6 text-[var(--drv-text)]">
                              {request.pickup_stop_name} to {request.destination_stop_name}
                            </p>
                            <p className="mt-1 break-words text-xs leading-5 text-[var(--drv-muted)]">
                              Marker stop: {request.marker_stop_name} | Payment {request.payment_status}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm leading-6 text-[var(--drv-muted)]">
                        No passenger pickup or drop requests are active yet for this trip.
                      </p>
                    )}
                  </div>
                </Panel>
              </div>
            </div>
          )
        ) : null}

        {activeTab === "history" ? (
          <div className="mt-5 space-y-5 pb-32">
            <div className="flex items-end justify-between gap-4 px-1">
              <div>
                <SectionLabel>Current Status</SectionLabel>
                <h2 className="mt-3 text-5xl font-black leading-[0.94]">
                  Last Shift
                  <span className="block text-[var(--drv-purple)]">Summary</span>
                </h2>
              </div>
              <p className="pb-2 text-sm font-medium text-[var(--drv-muted)]">{lastShiftDate}</p>
            </div>

            <div className="overflow-hidden rounded-[2.3rem] bg-[linear-gradient(135deg,var(--drv-purple),var(--drv-purple-2))] p-6 text-white shadow-[var(--drv-shadow-strong)]">
              <div className="grid h-12 w-12 place-items-center rounded-[1.2rem] bg-white/14 text-white">
                <Icon name="wallet" />
              </div>
              <p className="mt-8 text-lg font-medium text-white/82">Total Earnings</p>
              <p className="mt-4 text-6xl font-black leading-none">Rs. {lastShiftEarnings.toLocaleString()}</p>
              <div className="mt-8 h-px bg-white/20" />
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { label: "Passengers", value: lastShiftPassengers },
                  { label: "Duration", value: lastShiftDuration },
                  { label: "Efficiency", value: lastShiftRank },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-[0.64rem] font-black uppercase tracking-[0.22em] text-white/70">{item.label}</p>
                    <p className="mt-2 text-2xl font-black leading-tight">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {historyMetrics.map((metric, index) => (
                <Panel key={metric.label} className={index === 2 ? "bg-[rgba(243,224,250,0.95)]" : "bg-[rgba(252,227,252,0.82)]"}>
                  <div className="flex items-center gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-[rgba(255,107,115,0.12)] text-[var(--drv-purple)]">
                      <Icon name={metric.icon} />
                    </div>
                    <div>
                      <p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[var(--drv-muted)]">{metric.label}</p>
                      <p className="mt-2 text-4xl font-black leading-none">
                        {metric.value}
                        {metric.suffix ? <span className="ml-1 text-base font-semibold text-[var(--drv-muted)]">{metric.suffix}</span> : null}
                      </p>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="text-3xl font-black">Recent Trips</h3>
                <button type="button" onClick={handleViewAllTrips} className="text-[0.72rem] font-black uppercase tracking-[0.2em] text-[var(--drv-purple)]">
                  {showAllHistoryTrips ? "Show Less" : "View All"}
                </button>
              </div>

              <div className="space-y-4">
                {visibleHistoryTrips.map((trip, index) => (
                  <Panel key={`${trip.route}-${trip.time}`} className={index === 1 ? "bg-[rgba(251,234,252,0.86)]" : "bg-white/88"}>
                    <div className="flex items-start gap-4">
                      <div className="mt-1 grid h-12 w-12 place-items-center rounded-[1.1rem] bg-[rgba(255,107,115,0.12)] text-[var(--drv-purple)]">
                        <Icon name="bus" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-2xl font-black leading-tight">{trip.route}</p>
                        <p className="mt-2 text-sm text-[var(--drv-muted)]">{trip.time}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[0.64rem] font-black uppercase tracking-[0.22em] text-[var(--drv-muted)]">Earnings</p>
                        <p className="mt-2 text-2xl font-black">{trip.earnings}</p>
                      </div>
                    </div>
                  </Panel>
                ))}
              </div>
            </div>

            <ActionButton tone="primary" onClick={handleMarkShiftComplete} className="w-full !justify-between !py-5 !pl-7 !pr-6 text-base">
              <span>Mark Shift Complete</span>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/16">
                <Icon name="history" className="h-5 w-5" />
              </span>
            </ActionButton>

            <p className="text-center text-sm leading-6 text-[var(--drv-muted)]">
              Shift ending at 16:30. All data will be synced automatically after completion.
            </p>
          </div>
        ) : null}

        {activeTab === "earnings" ? (
          <div className="mt-5 space-y-5 pb-32">
            <div className="overflow-hidden rounded-[2.3rem] bg-[linear-gradient(135deg,var(--drv-purple),var(--drv-purple-2))] p-6 text-white shadow-[var(--drv-shadow-strong)]">
              <p className="text-[0.72rem] font-black uppercase tracking-[0.28em] text-white/76">Today Earnings</p>
              <div className="mt-5 flex items-end justify-between gap-4">
                <p className="text-6xl font-black leading-none">Rs. {todaysEarnings.toLocaleString()}</p>
                <p className="pb-1 text-3xl font-black text-white/28">{earningsGrowth}</p>
              </div>
              <div className="mt-7 flex items-end justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-white/72">Weekly Target</p>
                  <div className="mt-3 h-2.5 max-w-[8.5rem] rounded-full bg-white/18">
                    <div className="h-full rounded-full bg-white" style={{ width: `${weeklyTargetPct}%` }} />
                  </div>
                </div>
                <button type="button" onClick={handleWithdraw} className="rounded-full bg-white/18 px-6 py-3 text-base font-black shadow-[0_16px_34px_rgba(71,39,81,0.16)] backdrop-blur-sm">
                  Withdraw
                </button>
              </div>
            </div>

            <div className="rounded-[2.1rem] bg-[rgba(247,212,250,0.82)] p-6 shadow-[var(--drv-shadow)]">
              <div className="flex items-start justify-between gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-[rgba(255,107,115,0.12)] text-[var(--drv-purple)]">
                  <Icon name="ticket" className="h-6 w-6" />
                </div>
                <p className="text-sm font-black text-[var(--drv-purple)]">{earningsBreakdown[0].note}</p>
              </div>
              <p className="mt-6 text-3xl font-black">{earningsBreakdown[0].label}</p>
              <p className="mt-3 text-5xl font-black leading-none">{earningsBreakdown[0].value}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {earningsBreakdown.slice(1).map((card) => (
                <div key={card.label} className={`rounded-[2rem] ${card.tint} p-5 shadow-[var(--drv-shadow)]`}>
                  <div className={`grid h-12 w-12 place-items-center rounded-full bg-white/42 ${card.accent}`}>
                    <Icon name={card.icon} />
                  </div>
                  <p className="mt-6 text-3xl font-black">{card.label}</p>
                  <p className={`mt-3 text-5xl font-black leading-none ${card.accent}`}>{card.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Completed Trips", value: completedTrips, icon: "history" },
                { label: "Total Passengers", value: totalPassengers, icon: "users" },
              ].map((card) => (
                <div key={card.label} className="rounded-[1.8rem] border border-[var(--drv-border)] bg-white/90 px-4 py-4 shadow-[var(--drv-shadow)]">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-[rgba(255,107,115,0.1)] text-[var(--drv-purple)]">
                      <Icon name={card.icon} />
                    </div>
                    <div>
                      <p className="text-sm text-[var(--drv-muted)]">{card.label}</p>
                      <p className="mt-1 text-4xl font-black leading-none">{card.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-[2.1rem] bg-[#23102c] p-6 text-white shadow-[0_22px_48px_rgba(35,16,44,0.3)]">
              <p className="inline-flex rounded-full bg-white/8 px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/82">Status</p>
              <div className="mt-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-5xl font-black leading-none">Elite Tier</p>
                  <p className="mt-3 text-xl text-white/68">Top 5% of drivers this month</p>
                </div>
                <div className="grid h-20 w-20 place-items-center rounded-full border border-white/8 bg-white/4 text-white/65">
                  <Icon name="wallet" className="h-8 w-8" />
                </div>
              </div>
            </div>

            <Panel className="!p-6">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-3xl font-black">Fuel Level</h3>
                <p className="text-2xl font-black text-[var(--drv-purple)]">{fuelLevel}% Full</p>
              </div>
              <div className="mt-8 flex items-end justify-between gap-2">
                {fuelBars.map((bar, index) => (
                  <div key={bar.day} className="flex flex-1 flex-col items-center gap-3">
                    <div
                      className={`w-full max-w-[2.4rem] rounded-t-[1.1rem] ${index === fuelBars.length - 1 ? "bg-[linear-gradient(180deg,#ff8a5b,#ff6b73)]" : index >= fuelBars.length - 3 ? "bg-[rgba(255,145,120,0.68)]" : "bg-[rgba(249,221,218,0.9)]"}`}
                      style={{ height: `${Math.max(bar.value, 24)}px` }}
                    />
                    <span className={`text-[0.66rem] font-black uppercase tracking-[0.14em] ${index === fuelBars.length - 1 ? "text-[var(--drv-purple)]" : "text-[var(--drv-muted)]"}`}>
                      {bar.day}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

            <div className="flex items-center gap-4 rounded-[2rem] bg-[rgba(247,212,250,0.82)] px-5 py-5 shadow-[var(--drv-shadow)]">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-[var(--drv-purple)]">
                <Icon name="alert" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-black">Inconsistency?</p>
                <p className="mt-1 text-sm text-[var(--drv-muted)]">Report an earnings issue</p>
              </div>
              <button type="button" onClick={handleReportIssue} className="grid h-12 w-12 place-items-center rounded-full bg-[linear-gradient(135deg,var(--drv-purple),var(--drv-purple-2))] text-white shadow-[var(--drv-shadow-strong)]">
                <Icon name="arrow-right" />
              </button>
            </div>
          </div>
        ) : null}

        {activeTab === "active" && activeTrip ? (
          <div className="fixed bottom-[5.5rem] left-1/2 z-30 flex w-[calc(100%-1rem)] max-w-[28rem] -translate-x-1/2 gap-3">
            <ActionButton tone="danger" onClick={endTrip} disabled={busy || activeTrip?.driver_end_confirmed} className="flex-1 !py-4">
              {busy ? "Sending..." : activeTrip?.helper_end_confirmed ? "Confirm End Trip" : activeTrip?.driver_end_confirmed ? "End Requested" : "Request End Trip"}
            </ActionButton>
          </div>
        ) : null}

        <div className="fixed bottom-3 left-1/2 z-40 w-[calc(100%-1rem)] max-w-[28rem] -translate-x-1/2 rounded-[1.65rem] border border-white/70 bg-[var(--drv-nav)] p-1.5 shadow-[var(--drv-shadow)] backdrop-blur-xl">
          <div className="grid grid-cols-4 gap-1.5">
            {TABS.map((tab) => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-1.5 rounded-[1.1rem] py-2 text-center transition ${activeTab === tab.id ? "bg-[linear-gradient(135deg,var(--drv-purple),var(--drv-purple-2))] text-white shadow-[var(--drv-shadow-strong)]" : "text-[var(--drv-muted)]"}`}>
                <Icon name={tab.icon} className="h-[1.1rem] w-[1.1rem]" />
                <span className="px-1 text-[0.6rem] font-black uppercase tracking-[0.1em] leading-tight">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
