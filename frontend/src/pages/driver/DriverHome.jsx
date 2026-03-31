import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { api } from "../../api";
import { useAuth } from "../../AuthContext";
import { clearToken } from "../../auth";
import { snapRouteToRoad } from "../../lib/mapRoute";
import { useTheme } from "../../ThemeContext";

const LIGHT_THEME = {
  "--drv-bg": "#fff7fb",
  "--drv-surface": "rgba(255,255,255,0.86)",
  "--drv-soft": "#f8def9",
  "--drv-border": "rgba(167,96,204,0.16)",
  "--drv-text": "#2f1738",
  "--drv-muted": "#89738f",
  "--drv-purple": "#8c12eb",
  "--drv-purple-2": "#c243ff",
  "--drv-plum": "#472751",
  "--drv-shadow": "0 24px 56px rgba(155,54,184,0.12)",
  "--drv-shadow-strong": "0 26px 60px rgba(141,18,235,0.22)",
};

const DARK_THEME = {
  "--drv-bg": "#130d19",
  "--drv-surface": "rgba(33,22,42,0.9)",
  "--drv-soft": "rgba(81,44,104,0.52)",
  "--drv-border": "rgba(196,152,233,0.14)",
  "--drv-text": "#f7eefc",
  "--drv-muted": "#b8a6c2",
  "--drv-purple": "#c56bff",
  "--drv-purple-2": "#8c12eb",
  "--drv-plum": "#25142d",
  "--drv-shadow": "0 24px 56px rgba(0,0,0,0.24)",
  "--drv-shadow-strong": "0 26px 60px rgba(141,18,235,0.28)",
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
    case "play": return <svg {...common}><path d="m8 6 10 6-10 6V6Z" /></svg>;
    case "alert": return <svg {...common}><path d="M12 4 3.5 18h17L12 4Z" /><path d="M12 9v4" /><path d="M12 16h.01" /></svg>;
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
              <p className={`mt-1 text-base font-black ${isDone ? "text-emerald-600" : isCurrent ? "text-[var(--drv-purple)]" : "text-[var(--drv-text)]"}`}>{item.stop?.name || "--"}</p>
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

const TABS = [
  { id: "home", label: "Home", icon: "home" },
  { id: "active", label: "Active Trip", icon: "route" },
  { id: "history", label: "History", icon: "history" },
  { id: "earnings", label: "Earnings", icon: "wallet" },
];

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
  const [routeStops, setRouteStops] = useState([]);
  const [roadPolyline, setRoadPolyline] = useState([]);
  const [activeTab, setActiveTab] = useState("home");
  const locationWatch = useMemo(() => ({ id: null }), []);
  const wsRef = useMemo(() => ({ current: null }), []);
  const queueRef = useMemo(() => ({ current: [] }), []);

  const activeTrip = dashboard?.active_trip ?? null;
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

  const currentBus = activeTrip?.bus_plate || nextSchedule?.bus_plate || manualOptions.buses.find((bus) => String(bus.id) === busId)?.plate_number || "--";
  const currentRoute = activeTrip?.route_name || nextSchedule?.route_name || manualOptions.routes.find((route) => String(route.id) === routeId)?.name || "--";
  const helperName = activeTrip?.helper_name || nextSchedule?.helper_name || manualOptions.helpers.find((helper) => String(helper.id) === helperId)?.full_name || "--";
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
  const capacity = Number(manualOptions.buses.find((bus) => bus.id === activeTrip?.bus)?.capacity || assignedBus?.capacity || 40);
  const occupied = activeTrip ? Math.min(32, capacity) : Math.min(18, capacity);
  const occupancyPct = capacity ? Math.round((occupied / capacity) * 100) : 0;
  const todaysEarnings = activeTrip ? 4500 : 2450;
  const completedTrips = activeTrip ? 8 : 6;
  const totalPassengers = activeTrip ? 124 : 42;
  const fuelLevel = activeTrip ? 84 : 76;
  const predictedPax = activeTrip ? "3-5" : "2-4";

  const loadDashboard = async ({ silent = false } = {}) => {
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
  useEffect(() => { if (activeTrip) setActiveTab("active"); }, [activeTrip]);
  useEffect(() => {
    if (!routeId && manualOptions.routes.length) setRouteId(String(manualOptions.routes[0].id));
    if (!busId && manualOptions.buses.length) setBusId(String(manualOptions.buses[0].id));
    if (!helperId && manualOptions.helpers.length) setHelperId(String(manualOptions.helpers[0].id));
  }, [manualOptions, routeId, busId, helperId]);
  useEffect(() => {
    if (!activeTrip?.id) { setRouteStops([]); setRoadPolyline([]); return; }
    api.get(`/api/trips/${activeTrip.id}/`).then((response) => setRouteStops(response.data.route_stops || [])).catch(() => setRouteStops([]));
  }, [activeTrip?.id]);
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
      await fn();
      setMsg(successMsg);
      await loadDashboard({ silent: true });
    } catch (error) {
      setErr(error?.response?.data?.detail || "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const startScheduledTrip = async (id) => {
    await runAction(() => api.post("/api/trips/start/", { schedule_id: id, deviation_mode: deviationMode }), "Trip started.");
    setActiveTab("active");
  };

  const startManualTrip = async () => {
    if (!(routeId && busId && helperId)) {
      setErr("Select route, bus, and helper first.");
      return;
    }
    await runAction(() => api.post("/api/trips/start/", { route_id: Number(routeId), bus_id: Number(busId), helper_id: Number(helperId), deviation_mode: deviationMode }), "Manual trip started.");
    setActiveTab("active");
  };

  const endTrip = async () => {
    if (!activeTrip) return;
    await runAction(() => api.post(`/api/trips/${activeTrip.id}/end/`), "Trip ended.");
    setAutoShare(false);
    setLocationStatus("");
    setRouteStops([]);
    setActiveTab("history");
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

  if (loading) {
    return <div style={theme} className="flex min-h-screen items-center justify-center bg-[var(--drv-bg)] text-[var(--drv-text)]"><div className="text-center"><div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[var(--drv-purple)] border-t-transparent" /><p className="mt-4 text-sm font-medium text-[var(--drv-muted)]">Loading driver dashboard...</p></div></div>;
  }

  return (
    <div style={theme} className="min-h-screen bg-[linear-gradient(180deg,var(--drv-bg),rgba(255,241,248,0.98))] text-[var(--drv-text)]">
      <header className="sticky top-0 z-30 border-b border-[var(--drv-border)] bg-[rgba(255,247,251,0.9)] px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-[linear-gradient(135deg,#8c12eb,#c243ff)] text-sm font-black text-white shadow-[var(--drv-shadow-strong)]">{(user?.full_name || "DR").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-[var(--drv-shadow)]"><span className="text-xs font-black uppercase tracking-[0.2em] text-[var(--drv-purple)]">MB</span></div>
            <Pill tone={activeTrip ? "live" : "idle"}>{activeTrip ? "Trip Live" : "Standby"}</Pill>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => loadDashboard()} className="grid h-11 w-11 place-items-center rounded-full border border-[var(--drv-border)] bg-white/80 text-[var(--drv-purple)] shadow-[var(--drv-shadow)]"><Icon name="bell" /></button>
            <button type="button" onClick={toggle} className="grid h-11 w-11 place-items-center rounded-full border border-[var(--drv-border)] bg-white/80 text-[var(--drv-purple)] shadow-[var(--drv-shadow)]"><Icon name={isDark ? "sun" : "moon"} /></button>
            <button type="button" onClick={handleLogout} className="grid h-11 w-11 place-items-center rounded-full border border-[var(--drv-border)] bg-white/80 text-[var(--drv-plum)] shadow-[var(--drv-shadow)]"><Icon name="logout" /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 pb-32">
        {err ? <div className="mb-4 rounded-[1.6rem] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{err}</div> : null}
        {msg ? <div className="mb-4 rounded-[1.6rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{msg}</div> : null}

        <section className="relative overflow-hidden rounded-[2.6rem] bg-[linear-gradient(135deg,#8c12eb,#c243ff)] p-6 text-white shadow-[var(--drv-shadow-strong)]">
          <div className="absolute inset-y-0 right-0 w-32 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.14),transparent_62%)]" />
          <p className="text-[0.7rem] font-black uppercase tracking-[0.28em] text-white/70">{activeTrip ? "Route In Progress" : "Shift Dashboard"}</p>
          <h1 className="mt-3 text-5xl font-black leading-[0.92] whitespace-pre-line">{activeTrip ? "ROUTE\nLIVE" : "READY TO\nSTART"}</h1>
          <p className="mt-4 text-base font-medium text-white/84">{activeTrip ? `${currentRoute} is active now. Keep GPS sharing on and watch the next stop.` : `Shift starts at ${formatTime(nextSchedule?.scheduled_start_time)}. Current city: Pokhara.`}</p>
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
          {[{ label: "Planned Trips", value: schedules.length, note: "Today", icon: "history" }, { label: "On Track", value: activeTrip ? "Live" : "Standby", note: "Status", icon: "route" }, { label: "Today Earnings", value: `Rs. ${todaysEarnings.toLocaleString()}`, note: "Driver total", icon: "wallet" }, { label: "Fuel Level", value: `${fuelLevel}%`, note: "Tank status", icon: "fuel" }].map((card, index) => (
            <Panel key={card.label} className={`${index === 2 ? "bg-[var(--drv-soft)]" : ""} min-h-[10.4rem]`}>
              <div className="text-[var(--drv-purple)]"><Icon name={card.icon} /></div>
              <p className="mt-10 text-[0.7rem] font-black uppercase tracking-[0.22em] text-[var(--drv-muted)]">{card.label}</p>
              <p className="mt-2 text-[1.9rem] font-black leading-none text-[var(--drv-text)]">{card.value}</p>
              {card.icon === "fuel" ? <div className="mt-4 h-2 rounded-full bg-[#edd6f7]"><div className="h-2 rounded-full bg-[linear-gradient(135deg,#8c12eb,#c243ff)]" style={{ width: `${fuelLevel}%` }} /></div> : null}
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

            <div className="mt-6"><div className="mb-3 flex items-center justify-between"><h2 className="text-3xl font-black">Upcoming Schedules</h2><Pill tone={minutesToDeparture !== null && minutesToDeparture > 0 ? "warn" : "idle"}>{minutesToDeparture !== null ? `${Math.max(minutesToDeparture, 0)} min` : "Today"}</Pill></div><div className="space-y-3">{schedules.length === 0 ? <Panel><p className="text-sm text-[var(--drv-muted)]">No planned schedules right now.</p></Panel> : schedules.slice(0, 4).map((schedule, index) => <button key={schedule.id} type="button" onClick={() => startScheduledTrip(schedule.id)} disabled={busy || Boolean(activeTrip)} className={`flex w-full items-center gap-4 rounded-[1.8rem] border px-4 py-4 text-left shadow-[var(--drv-shadow)] transition ${index === 0 ? "border-transparent bg-[var(--drv-soft)]" : "border-[var(--drv-border)] bg-white/72"}`}><div className="min-w-[4.8rem] rounded-[1.4rem] bg-white/70 px-3 py-3 text-center"><p className="text-2xl font-black leading-none text-[var(--drv-purple)]">{formatTime(schedule.scheduled_start_time)}</p></div><div className="min-w-0 flex-1"><p className="truncate text-lg font-black">{schedule.route_name}</p><p className="mt-1 text-sm text-[var(--drv-muted)]">{schedule.bus_plate} - {schedule.helper_name || "Helper pending"}</p></div>{index === 0 ? <span className="rounded-full bg-[linear-gradient(135deg,#8c12eb,#c243ff)] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white">Active</span> : null}</button>)}</div></div>

            <Panel className="mt-5 bg-[rgba(250,227,252,0.86)]"><div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-[rgba(140,18,235,0.12)] text-[var(--drv-purple)]"><Icon name="alert" /></div><div><SectionLabel>Traffic Alert</SectionLabel><p className="text-lg font-black">Heavy congestion reported near Mahendrapul.</p><p className="mt-2 text-sm leading-6 text-[var(--drv-muted)]">Consider switching to deviation mode if your next departure starts before the scheduled corridor clears.</p></div></div></Panel>
          </>
        ) : null}

        {activeTab === "active" ? (!activeTrip ? <Panel className="mt-5"><p className="text-center text-sm text-[var(--drv-muted)]">No active trip. Start one from the Home tab.</p></Panel> : <div className="mt-5 space-y-5"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[{ label: "Occupancy", value: `${occupancyPct}%`, note: `${occupied}/${capacity} seats` }, { label: "Next Stop", value: nextStop, note: `Prev: ${previousStop}` }, { label: "AI Prediction", value: `${predictedPax} pax`, note: "At next stop" }, { label: "GPS", value: autoShare ? "Live" : "Off", note: locationStatus || "Waiting" }].map((card) => <Panel key={card.label}><p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--drv-muted)]">{card.label}</p><p className="mt-3 text-2xl font-black">{card.value}</p><p className="mt-2 text-xs text-[var(--drv-muted)]">{card.note}</p></Panel>)}</div><Panel className="overflow-hidden !p-0"><div className="flex items-center justify-between border-b border-[var(--drv-border)] px-5 py-4"><div><SectionLabel>Live Route Map</SectionLabel><p className="mt-1 text-lg font-black">{currentRoute}</p></div><Pill tone={liveBusPoint ? "live" : "idle"}>{liveBusPoint ? "Bus Live" : "No GPS"}</Pill></div><div className="h-80 w-full"><MapContainer center={[28.2096, 83.9856]} zoom={13} scrollWheelZoom={false} className="h-full w-full"><TileLayer attribution="&copy; OpenStreetMap &copy; CARTO" url={isDark ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"} /><MapViewport points={mapPoints} />{displayedPolyline.length > 0 ? <Polyline positions={displayedPolyline} pathOptions={{ color: "#8c12eb", weight: 5, opacity: 0.9 }} /> : null}{routeStops.map((item, index) => { const lat = Number(item.stop?.lat); const lng = Number(item.stop?.lng); if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null; const current = index === Math.max(stopProgressIndex, 0) && liveBusPoint; return <CircleMarker key={`${item.stop_order}-${item.stop?.name}`} center={[lat, lng]} radius={current ? 8 : 5} pathOptions={{ color: current ? "#8c12eb" : "#b68ac8", fillColor: current ? "#8c12eb" : "#edd6f7", fillOpacity: 0.95 }}><Popup>Stop {item.stop_order}: {item.stop?.name}</Popup></CircleMarker>; })}{liveBusPoint ? <CircleMarker center={liveBusPoint} radius={11} pathOptions={{ color: "#10b981", fillColor: "#34d399", fillOpacity: 1 }}><Popup>Live bus position</Popup></CircleMarker> : null}</MapContainer></div></Panel><div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]"><Panel><div className="flex items-center justify-between"><SectionLabel>GPS Control</SectionLabel><button type="button" onClick={() => setAutoShare((value) => !value)} className={`relative h-7 w-12 rounded-full transition ${autoShare ? "bg-[var(--drv-purple)]" : "bg-[#ead4f6]"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${autoShare ? "left-6" : "left-1"}`} /></button></div><p className="mt-2 text-sm text-[var(--drv-muted)]">{locationStatus || (autoShare ? "Broadcasting live GPS..." : "Auto sharing is paused.")}</p><div className="mt-4 grid grid-cols-2 gap-3"><input className="rounded-[1.4rem] border border-[var(--drv-border)] bg-[var(--drv-soft)] px-4 py-4 text-sm font-medium text-[var(--drv-text)] outline-none" placeholder="Latitude" value={manualLat} onChange={(event) => setManualLat(event.target.value)} /><input className="rounded-[1.4rem] border border-[var(--drv-border)] bg-[var(--drv-soft)] px-4 py-4 text-sm font-medium text-[var(--drv-text)] outline-none" placeholder="Longitude" value={manualLng} onChange={(event) => setManualLng(event.target.value)} /></div><div className="mt-4 grid grid-cols-2 gap-3"><ActionButton tone="ghost" onClick={sendManualLocation} disabled={locationBusy}>Send Coordinates</ActionButton><ActionButton tone="primary" onClick={sendBrowserLocation} disabled={locationBusy}>{locationBusy ? "Sending..." : "Send My Location"}</ActionButton></div></Panel><div className="space-y-5"><Panel><SectionLabel>Stop Timeline</SectionLabel><StopTimeline stops={routeStops} progressIndex={stopProgressIndex} liveBusPoint={liveBusPoint} /></Panel><Panel><SectionLabel>Current GPS</SectionLabel>{latestLocation ? <><p className="mt-2 text-base font-black text-[var(--drv-purple)]">{Number(latestLocation.lat).toFixed(6)}, {Number(latestLocation.lng).toFixed(6)}</p><p className="mt-2 text-xs text-[var(--drv-muted)]">Updated {formatDateTime(latestLocation.recorded_at)}</p></> : <p className="mt-2 text-sm text-[var(--drv-muted)]">No live location yet.</p>}</Panel><ActionButton tone="danger" onClick={endTrip} disabled={busy} className="w-full !py-4">{busy ? "Ending Trip" : "End Trip"}</ActionButton><ActionButton tone="danger" className="w-full !bg-[linear-gradient(135deg,#7a1029,#aa1f42)] !py-5 text-base"><Icon name="alert" />SOS</ActionButton></div></div></div>) : null}

        {activeTab === "history" ? <div className="mt-5 space-y-5"><Panel className="bg-[linear-gradient(135deg,var(--drv-soft),rgba(255,255,255,0.85))]"><SectionLabel>Last Shift Summary</SectionLabel><p className="mt-3 text-5xl font-black">NPR 1,250</p><p className="mt-2 text-sm text-[var(--drv-muted)]">Total earnings from the last completed trip</p></Panel><div className="grid grid-cols-2 gap-3">{[{ label: "Passengers", value: "42" }, { label: "Duration", value: "42 min" }].map((card) => <Panel key={card.label}><p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--drv-muted)]">{card.label}</p><p className="mt-3 text-4xl font-black">{card.value}</p></Panel>)}</div><Panel><SectionLabel>Efficiency Report</SectionLabel>{[{ label: "Fuel Efficiency", value: "12.4 km/L" }, { label: "On-Time Performance", value: "98%" }, { label: "Last Route", value: formatTime(nextSchedule?.scheduled_start_time) }].map((row) => <div key={row.label} className="flex items-center justify-between border-b border-[var(--drv-border)] py-4 last:border-0"><span className="text-sm text-[var(--drv-muted)]">{row.label}</span><span className="text-sm font-black">{row.value}</span></div>)}</Panel></div> : null}

        {activeTab === "earnings" ? <div className="mt-5 space-y-5"><Panel className="bg-[linear-gradient(135deg,var(--drv-soft),rgba(255,255,255,0.85))]"><SectionLabel>Today's Earnings</SectionLabel><p className="mt-3 text-5xl font-black">NPR {todaysEarnings.toLocaleString()}</p><p className="mt-2 text-sm text-[var(--drv-muted)]">Driver-side earnings snapshot</p></Panel><div className="grid grid-cols-2 gap-3">{[{ label: "Completed Trips", value: completedTrips }, { label: "Passengers", value: totalPassengers }].map((card) => <Panel key={card.label}><p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--drv-muted)]">{card.label}</p><p className="mt-3 text-4xl font-black">{card.value}</p></Panel>)}</div><Panel><SectionLabel>Breakdown</SectionLabel>{[{ label: "App Bookings", value: "NPR 2,800" }, { label: "Cash Collections", value: "NPR 1,700" }, { label: "Manual Entries", value: "8 pax" }].map((row) => <div key={row.label} className="flex items-center justify-between border-b border-[var(--drv-border)] py-4 last:border-0"><span className="text-sm text-[var(--drv-muted)]">{row.label}</span><span className="text-sm font-black">{row.value}</span></div>)}</Panel></div> : null}

        <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-[30rem] -translate-x-1/2 rounded-[2rem] border border-white/70 bg-[rgba(255,252,255,0.9)] p-2 shadow-[var(--drv-shadow)] backdrop-blur-xl"><div className="grid grid-cols-4 gap-2">{TABS.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-2 rounded-[1.4rem] py-3 text-center transition ${activeTab === tab.id ? "bg-[linear-gradient(135deg,#8c12eb,#c243ff)] text-white shadow-[var(--drv-shadow-strong)]" : "text-[var(--drv-muted)]"}`}><Icon name={tab.icon} className="h-5 w-5" /><span className="text-[0.66rem] font-black uppercase tracking-[0.14em]">{tab.label}</span></button>)}</div></div>
      </main>
    </div>
  );
}
