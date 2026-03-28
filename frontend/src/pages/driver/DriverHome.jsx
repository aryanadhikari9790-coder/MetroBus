import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { api } from "../../api";
import { useAuth } from "../../AuthContext";
import { clearToken } from "../../auth";
import { snapRouteToRoad } from "../../lib/mapRoute";
import { useTheme } from "../../ThemeContext";
import { themeTokens, pillColor } from "../../lib/theme";

// ─── Shared primitives ───────────────────────────────────────
function GlassCard({ children, className = "", t }) {
  return (
    <div className={`rounded-2xl border backdrop-blur-sm p-5 ${t.card} ${className}`}>
      {children}
    </div>
  );
}
function Pill({ children, color = "slate", isDark }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${pillColor(isDark, color)}`}>
      {children}
    </span>
  );
}
function Btn({ children, onClick, disabled, tone = "primary", className = "" }) {
  const map = {
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/40",
    success: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40",
    danger:  "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40",
    ghost:   "bg-white/10 hover:bg-white/20 text-white border border-white/10",
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`rounded-xl px-5 py-3 text-sm font-bold tracking-wide transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${map[tone]} ${className}`}>
      {children}
    </button>
  );
}
function SectionLabel({ children, t }) {
  return <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-3 ${t.label}`}>{children}</p>;
}
function LiveDot({ active }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {active && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${active ? "bg-emerald-400" : "bg-slate-500"}`} />
    </span>
  );
}

function SelectField({ label, value, onChange, options, t }) {
  return (
    <div>
      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${t.label}`}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-indigo-500 transition ${t.input}`}
        style={{ backgroundColor: "var(--select-bg)", color: "var(--input-text)" }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function StopTimeline({ stops, progressIndex, liveBusPoint, t }) {
  if (!stops.length) return <p className={`text-sm py-2 ${t.textSub}`}>Start a trip to see progress.</p>;
  return (
    <div className="space-y-0">
      {stops.map((item, i) => {
        const isDone    = progressIndex !== -1 && i < progressIndex && liveBusPoint;
        const isCurrent = progressIndex !== -1 && i === progressIndex && liveBusPoint;
        const isLast    = i === stops.length - 1;
        return (
          <div key={`${item.stop_order}-${item.stop?.name}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`mt-0.5 h-3.5 w-3.5 rounded-full border-2 flex-shrink-0 transition-colors ${isDone ? t.dotDone : isCurrent ? t.dotCurrent : t.dotPending}`} />
              {!isLast && <span className={`w-px flex-1 min-h-[2rem] ${t.timelineLine}`} />}
            </div>
            <div className="pb-4">
              <p className={`text-[10px] uppercase tracking-widest ${t.label}`}>Stop {i + 1}</p>
              <p className={`text-sm font-semibold mt-0.5 ${isDone ? "text-emerald-500" : isCurrent ? "text-indigo-400" : t.textSub}`}>
                {item.stop?.name || "—"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────
function fmt(v) { if (!v) return "—"; try { return new Date(v).toLocaleString(); } catch { return v; } }
function fmtTime(v) { if (!v) return "—"; try { return new Date(v).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch { return v; } }
function minutesUntil(v) { if (!v) return null; const d = Math.round((new Date(v).getTime() - Date.now()) / 60000); return Number.isNaN(d) ? null : d; }
function distanceBetween(a, b) { if (!a || !b) return Infinity; return Math.sqrt((Number(a[0]) - Number(b[0])) ** 2 + (Number(a[1]) - Number(b[1])) ** 2); }

function MapViewport({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) { map.setView(points[0], 14); return; }
    map.fitBounds(points, { padding: [32, 32] });
  }, [map, points]);
  return null;
}

const TABS = [
  { id: "home",     label: "Home",        icon: "⌂" },
  { id: "active",   label: "Active Trip", icon: "▶" },
  { id: "history",  label: "History",     icon: "⏱" },
  { id: "earnings", label: "Earnings",    icon: "₨" },
];

// ─── ThemeToggle button ──────────────────────────────────────
function ThemeToggle({ isDark, toggle }) {
  return (
    <button type="button" onClick={toggle}
      className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold transition hover:bg-white/20"
      style={{ color: "var(--text)", borderColor: "var(--border)", background: "var(--surface)" }}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
      {isDark ? "☀ Light" : "🌙 Dark"}
    </button>
  );
}

export default function DriverHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark, toggle } = useTheme();
  const t = themeTokens(isDark);

  const [dashboard, setDashboard]         = useState(null);
  const [loading, setLoading]             = useState(true);
  const [busy, setBusy]                   = useState(false);
  const [locationBusy, setLocationBusy]   = useState(false);
  const [autoShare, setAutoShare]         = useState(false);
  const [latestLocation, setLatestLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("");
  const [msg, setMsg]                     = useState("");
  const [err, setErr]                     = useState("");
  const [deviationMode, setDeviationMode] = useState(false);
  const [routeId, setRouteId]             = useState("");
  const [busId, setBusId]                 = useState("");
  const [helperId, setHelperId]           = useState("");
  const [manualLat, setManualLat]         = useState("");
  const [manualLng, setManualLng]         = useState("");
  const [routeStops, setRouteStops]       = useState([]);
  const [roadPolyline, setRoadPolyline]   = useState([]);
  const [activeTab, setActiveTab]         = useState("home");
  const locationWatch = useMemo(() => ({ id: null }), []);

  const activeTrip    = dashboard?.active_trip ?? null;
  const schedules     = dashboard?.schedules ?? [];
  const manualOptions = dashboard?.manual_start_options ?? { routes: [], buses: [], helpers: [] };
  const nextSchedule  = schedules[0] ?? null;

  const routePolyline = useMemo(
    () => routeStops.map(s => [Number(s.stop?.lat), Number(s.stop?.lng)]).filter(([la, lo]) => isFinite(la) && isFinite(lo)),
    [routeStops]
  );
  const displayedPolyline = roadPolyline.length > 1 ? roadPolyline : routePolyline;

  const liveBusPoint = useMemo(() => {
    if (!latestLocation) return null;
    const lat = Number(latestLocation.lat), lng = Number(latestLocation.lng);
    return isFinite(lat) && isFinite(lng) ? [lat, lng] : null;
  }, [latestLocation]);

  const mapPoints = useMemo(() => {
    const all = [...displayedPolyline];
    if (liveBusPoint) all.push(liveBusPoint);
    return all;
  }, [displayedPolyline, liveBusPoint]);

  const stopProgressIndex = useMemo(() => {
    if (!liveBusPoint || !routePolyline.length) return -1;
    let best = -1, bestDist = Infinity;
    routePolyline.forEach((pt, i) => { const d = distanceBetween(pt, liveBusPoint); if (d < bestDist) { bestDist = d; best = i; } });
    return best;
  }, [liveBusPoint, routePolyline]);

  const currentBus    = activeTrip?.bus_plate    || nextSchedule?.bus_plate    || manualOptions.buses.find(b => String(b.id) === busId)?.plate_number || "—";
  const currentRoute  = activeTrip?.route_name   || nextSchedule?.route_name   || manualOptions.routes.find(r => String(r.id) === routeId)?.name || "—";
  const helperName    = activeTrip?.helper_name  || nextSchedule?.helper_name  || manualOptions.helpers.find(h => String(h.id) === helperId)?.full_name || "—";
  const minutesToNext = minutesUntil(nextSchedule?.scheduled_start_time);
  const nextStop      = routeStops[Math.min(stopProgressIndex + 1, routeStops.length - 1)]?.stop?.name || routeStops[1]?.stop?.name || "—";
  const prevStop      = routeStops[Math.max(stopProgressIndex, 0)]?.stop?.name || "—";
  const capacity      = Number(manualOptions.buses.find(b => b.id === activeTrip?.bus)?.capacity || 40);
  const occupied      = activeTrip ? Math.min(32, capacity) : Math.min(18, capacity);
  const occupancyPct  = capacity ? Math.round((occupied / capacity) * 100) : 0;
  const todaysEarnings = activeTrip ? 4500 : 1250;
  const completedTrips = activeTrip ? 8 : 7;
  const totalPassengers = activeTrip ? 124 : 42;
  const fuelLevel     = activeTrip ? 84 : 76;
  const predictedPax  = activeTrip ? "3–5" : "2–4";

  const loadDashboard = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try { const res = await api.get("/api/trips/driver/dashboard/"); setDashboard(res.data); setLatestLocation(res.data.latest_location || null); setErr(""); }
    catch (e) { setErr(e?.response?.data?.detail || "Failed to load driver dashboard."); }
    finally { if (!silent) setLoading(false); }
  };

  useEffect(() => { loadDashboard(); }, []);
  useEffect(() => { if (activeTrip) setActiveTab("active"); }, [activeTrip?.id]);
  useEffect(() => {
    if (!routeId && manualOptions.routes.length) setRouteId(String(manualOptions.routes[0].id));
    if (!busId   && manualOptions.buses.length)   setBusId(String(manualOptions.buses[0].id));
    if (!helperId && manualOptions.helpers.length) setHelperId(String(manualOptions.helpers[0].id));
  }, [manualOptions]);

  useEffect(() => {
    if (!activeTrip?.id) { setRouteStops([]); setRoadPolyline([]); return; }
    api.get(`/api/trips/${activeTrip.id}/`).then(r => setRouteStops(r.data.route_stops || [])).catch(() => setRouteStops([]));
  }, [activeTrip?.id]);

  useEffect(() => {
    if (routePolyline.length < 2) { setRoadPolyline([]); return; }
    const ctrl = new AbortController();
    snapRouteToRoad(routePolyline, ctrl.signal).then(p => setRoadPolyline(p.length > 1 ? p : [])).catch(e => { if (e.name !== "AbortError") setRoadPolyline([]); });
    return () => ctrl.abort();
  }, [routePolyline]);

  const runAction = async (fn, successMsg) => {
    setBusy(true); setErr(""); setMsg("");
    try { await fn(); setMsg(successMsg); await loadDashboard({ silent: true }); }
    catch (e) { setErr(e?.response?.data?.detail || "Action failed."); }
    finally { setBusy(false); }
  };

  const startScheduledTrip = async id => { await runAction(() => api.post("/api/trips/start/", { schedule_id: id, deviation_mode: deviationMode }), "Trip started!"); setActiveTab("active"); };
  const startManualTrip    = async () => {
    if (!(routeId && busId && helperId)) { setErr("Select route, bus, and helper first."); return; }
    await runAction(() => api.post("/api/trips/start/", { route_id: +routeId, bus_id: +busId, helper_id: +helperId, deviation_mode: deviationMode }), "Manual trip started!"); setActiveTab("active");
  };
  const endTrip = async () => {
    if (!activeTrip) return;
    await runAction(() => api.post(`/api/trips/${activeTrip.id}/end/`), "Trip ended.");
    setAutoShare(false); setLocationStatus(""); setRouteStops([]); setActiveTab("history");
  };

  const postLocation = async (payload, label = "Location sent.") => {
    if (!activeTrip) { setErr("Start a trip first."); return; }
    setLocationBusy(true); setErr("");
    try { const res = await api.post(`/api/trips/${activeTrip.id}/location/`, payload); setLatestLocation(res.data); setLocationStatus(label); }
    catch (e) { setErr(e?.response?.data?.detail || "Failed to send location."); }
    finally { setLocationBusy(false); }
  };

  const clearWatch = () => {
    if (locationWatch.id !== null && navigator.geolocation) { navigator.geolocation.clearWatch(locationWatch.id); locationWatch.id = null; }
  };

  const sendBrowserLocation = () => {
    if (!navigator.geolocation) { setErr("Geolocation not supported."); setAutoShare(false); return; }
    navigator.geolocation.getCurrentPosition(
      pos => postLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, speed: isFinite(pos.coords.speed) ? pos.coords.speed : null, heading: isFinite(pos.coords.heading) ? pos.coords.heading : null }, "Live location updated."),
      e => { setErr(e.message); setAutoShare(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  };

  const sendManualLocation = () => {
    const lat = Number(manualLat), lng = Number(manualLng);
    if (isNaN(lat) || isNaN(lng)) { setErr("Enter valid lat/lng."); return; }
    postLocation({ lat, lng, speed: null, heading: null }, "Manual location updated.");
  };

  useEffect(() => { setAutoShare(Boolean(activeTrip?.id)); }, [activeTrip?.id]);
  useEffect(() => {
    if (!activeTrip?.id || !autoShare) { clearWatch(); return; }
    if (!navigator.geolocation) { setErr("Geolocation not supported."); setAutoShare(false); return; }
    sendBrowserLocation();
    const id = navigator.geolocation.watchPosition(
      pos => postLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, speed: isFinite(pos.coords.speed) ? pos.coords.speed : null, heading: isFinite(pos.coords.heading) ? pos.coords.heading : null }, "Auto GPS is live."),
      e => { setErr(e.message); setAutoShare(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
    );
    locationWatch.id = id;
    return () => { navigator.geolocation.clearWatch(id); if (locationWatch.id === id) locationWatch.id = null; };
  }, [autoShare, activeTrip?.id]);

  const handleLogout = () => { clearWatch(); clearToken(); navigate("/auth/login"); };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${t.page}`}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mx-auto" />
          <p className={`mt-4 text-sm font-medium ${t.textSub}`}>Loading driver dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans transition-colors duration-200 ${t.page}`}>
      {/* Navbar */}
      <header className={`sticky top-0 z-30 border-b backdrop-blur-md px-4 py-3 ${t.nav}`}>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white">MB</div>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${t.label}`}>MetroBus</p>
              <p className={`text-sm font-bold leading-none ${t.text}`}>{user?.full_name || "Driver"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Pill color={activeTrip ? "emerald" : "slate"} isDark={isDark}><LiveDot active={Boolean(activeTrip)} /><span className="ml-1.5">{activeTrip ? "TRIP LIVE" : "STANDBY"}</span></Pill>
            <ThemeToggle isDark={isDark} toggle={toggle} />
            <Btn tone="ghost" onClick={() => loadDashboard()} className="!py-2 !px-3 text-xs">↻ Refresh</Btn>
            <Btn tone="danger" onClick={handleLogout} className="!py-2 !px-3 text-xs">Logout</Btn>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-5 pb-32">
        {err && <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${t.errBanner}`}>{err}</div>}
        {msg && <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${t.okBanner}`}>✓ {msg}</div>}

        {/* Hero */}
        <div className={`relative mb-5 overflow-hidden rounded-2xl bg-gradient-to-br border p-6 ${t.heroCard}`}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.1),transparent_60%)]" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-500 mb-1">{activeTrip ? "Active Route" : nextSchedule ? "Next Scheduled" : "Ready to depart"}</p>
              <h1 className={`text-3xl font-black tracking-tight leading-tight ${t.text}`}>{currentRoute}</h1>
              <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm ${t.textSub}`}>
                <span>🚌 {currentBus}</span><span className={t.textMuted}>•</span><span>👤 {helperName}</span>
                {minutesToNext !== null && !activeTrip && (<><span className={t.textMuted}>•</span><span className="text-amber-500">{minutesToNext > 0 ? `${minutesToNext} min to depart` : "Ready now"}</span></>)}
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              {!activeTrip
                ? <Btn tone="success" onClick={() => nextSchedule ? startScheduledTrip(nextSchedule.id) : startManualTrip()} disabled={busy || (!nextSchedule && (!routeId || !busId || !helperId))} className="!px-6 !py-3 !text-base">{busy ? "Starting…" : nextSchedule ? "▶ Start Scheduled" : "▶ Start Manual"}</Btn>
                : <Btn tone="danger" onClick={endTrip} disabled={busy} className="!px-6 !py-3 !text-base">{busy ? "Ending…" : "■ End Trip"}</Btn>}
            </div>
          </div>
          {activeTrip && (
            <div className="relative mt-5 grid grid-cols-3 gap-3">
              {[
                { label: "Occupancy", value: `${occupied}/${capacity}`, sub: <div className="mt-2 h-1 rounded-full bg-white/10"><div className="h-1 rounded-full bg-emerald-400" style={{ width: `${occupancyPct}%` }} /></div> },
                { label: "Next Stop", value: nextStop, sub: <p className={`text-[10px] mt-1 truncate ${t.label}`}>prev: {prevStop}</p> },
                { label: "GPS", value: <div className="flex items-center gap-2 mt-1"><LiveDot active={autoShare} /><span className="text-sm font-bold">{autoShare ? "Live" : "Off"}</span></div>, sub: <p className={`text-[10px] mt-1 truncate ${t.label}`}>{locationStatus || "Waiting…"}</p> },
              ].map(cell => (
                <div key={cell.label} className={`rounded-xl border px-4 py-3 ${t.heroInner}`}>
                  <p className={`text-[10px] uppercase tracking-widest ${t.label}`}>{cell.label}</p>
                  <p className={`text-sm font-bold truncate ${t.text}`}>{cell.value}</p>
                  {cell.sub}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className={`flex gap-1.5 rounded-2xl border p-1.5 mb-5 backdrop-blur ${t.tabBar}`}>
          {TABS.map(tab => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-3 text-center transition-all duration-150 ${activeTab === tab.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/50" : t.tabInactive}`}>
              <span className="text-lg">{tab.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-wide hidden sm:block">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── HOME ── */}
        {activeTab === "home" && (
          <div className="space-y-5">
            <GlassCard t={t}>
              <SectionLabel t={t}>Manual Trip Setup</SectionLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <SelectField label="Route" value={routeId} onChange={setRouteId} t={t} options={manualOptions.routes.map(r => ({ value: r.id, label: `${r.name} (${r.city})` }))} />
                <SelectField label="Bus" value={busId} onChange={setBusId} t={t} options={manualOptions.buses.map(b => ({ value: b.id, label: `${b.plate_number} (${b.capacity})` }))} />
                <SelectField label="Helper" value={helperId} onChange={setHelperId} t={t} options={manualOptions.helpers.map(h => ({ value: h.id, label: h.full_name }))} />
              </div>
              {!manualOptions.helpers.length && <p className={`mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400`}>⚠ No helpers available.</p>}
              <div className={`mt-4 flex items-center justify-between rounded-xl border px-4 py-3 ${isDark ? "border-white/5 bg-white/5" : "border-slate-200 bg-slate-50"}`}>
                <div>
                  <p className={`text-xs font-semibold ${t.text}`}>Deviation Mode</p>
                  <p className={`text-[10px] mt-0.5 ${t.textSub}`}>Enable for off-route situations</p>
                </div>
                <button type="button" onClick={() => setDeviationMode(v => !v)}
                  className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${deviationMode ? "bg-indigo-500" : t.toggleOff}`}>
                  <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${deviationMode ? "translate-x-5" : ""}`} />
                </button>
              </div>
            </GlassCard>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Planned Trips", value: schedules.length, accent: "text-indigo-500" },
                { label: "Status", value: activeTrip ? "LIVE" : "IDLE", accent: activeTrip ? "text-emerald-500" : t.textSub },
                { label: "Today's Earnings", value: `NPR ${todaysEarnings.toLocaleString()}`, accent: t.text, sub: "Demo metric" },
                { label: "Fuel Level", value: `${fuelLevel}%`, accent: fuelLevel > 50 ? "text-emerald-500" : "text-amber-500" },
              ].map(c => (
                <GlassCard key={c.label} t={t}>
                  <p className={`text-[10px] uppercase tracking-widest ${t.label}`}>{c.label}</p>
                  <p className={`text-3xl font-black mt-2 leading-none ${c.accent}`}>{c.value}</p>
                  {c.sub && <p className={`text-xs mt-1 ${t.textSub}`}>{c.sub}</p>}
                </GlassCard>
              ))}
            </div>

            <GlassCard t={t}>
              <SectionLabel t={t}>Upcoming Schedules</SectionLabel>
              {schedules.length === 0
                ? <p className={`text-sm py-2 ${t.textSub}`}>No planned schedules.</p>
                : schedules.slice(0, 5).map(sch => {
                  const mins = minutesUntil(sch.scheduled_start_time);
                  return (
                    <div key={sch.id} className={`flex items-center justify-between rounded-xl border px-4 py-3 gap-3 mb-2 ${isDark ? "border-white/5 bg-white/5" : "border-slate-200 bg-slate-50"}`}>
                      <div className="min-w-0">
                        <p className={`text-sm font-bold truncate ${t.text}`}>{sch.route_name}</p>
                        <p className={`text-xs mt-0.5 ${t.textSub}`}>{sch.bus_plate} • {fmt(sch.scheduled_start_time)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {mins !== null && <Pill color={mins > 0 ? "sky" : "emerald"} isDark={isDark}>{mins > 0 ? `${mins}m` : "Now"}</Pill>}
                        <Btn tone="success" onClick={() => startScheduledTrip(sch.id)} disabled={busy || Boolean(activeTrip)} className="!py-1.5 !px-3 !text-xs">Start</Btn>
                      </div>
                    </div>
                  );
                })}
            </GlassCard>
          </div>
        )}

        {/* ── ACTIVE TRIP ── */}
        {activeTab === "active" && (
          <div className="space-y-5">
            {!activeTrip
              ? <GlassCard t={t}><p className={`text-sm text-center py-4 ${t.textSub}`}>No active trip. Go to Home to start one.</p></GlassCard>
              : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: "Occupancy", value: `${occupancyPct}%`, sub: `${occupied}/${capacity} seats`, accent: "text-emerald-500" },
                      { label: "Next Stop", value: nextStop, accent: "text-indigo-500" },
                      { label: "AI Prediction", value: `${predictedPax} pax`, sub: "at next stop", accent: "text-amber-500" },
                      { label: "Route Status", value: "ON TIME", accent: "text-emerald-500" },
                    ].map(c => (
                      <GlassCard key={c.label} t={t}>
                        <p className={`text-[10px] uppercase tracking-widest ${t.label}`}>{c.label}</p>
                        <p className={`text-2xl font-black mt-2 leading-none ${c.accent}`}>{c.value}</p>
                        {c.sub && <p className={`text-xs mt-1 ${t.textSub}`}>{c.sub}</p>}
                      </GlassCard>
                    ))}
                  </div>

                  {/* Map */}
                  <GlassCard t={t} className="!p-0 overflow-hidden">
                    <div className={`flex items-center justify-between px-5 py-4 border-b ${t.divider}`}>
                      <div>
                        <SectionLabel t={t}>Live Route Map</SectionLabel>
                        <p className={`text-sm font-bold -mt-2 ${t.text}`}>{currentRoute}</p>
                      </div>
                      <Pill color={liveBusPoint ? "emerald" : "slate"} isDark={isDark}><LiveDot active={Boolean(liveBusPoint)} /><span className="ml-1.5">{liveBusPoint ? "Bus Live" : "No GPS"}</span></Pill>
                    </div>
                    <div className="h-72 w-full">
                      <MapContainer center={[28.2096, 83.9856]} zoom={13} scrollWheelZoom={false} className="h-full w-full">
                        <TileLayer attribution="&copy; OpenStreetMap &copy; CARTO" url={t.mapTile} />
                        <MapViewport points={mapPoints} />
                        {displayedPolyline.length > 0 && <Polyline positions={displayedPolyline} pathOptions={{ color: "#818cf8", weight: 4, opacity: 0.9 }} />}
                        {routeStops.map((item, index) => {
                          const lat = Number(item.stop?.lat), lng = Number(item.stop?.lng);
                          if (!isFinite(lat) || !isFinite(lng)) return null;
                          const isCur = index === Math.max(stopProgressIndex, 0) && liveBusPoint;
                          return (
                            <CircleMarker key={`${item.stop_order}-${item.stop?.name}`} center={[lat, lng]} radius={isCur ? 8 : 5}
                              pathOptions={{ color: isCur ? "#818cf8" : "#475569", fillColor: isCur ? "#818cf8" : "#94a3b8", fillOpacity: 0.95 }}>
                              <Popup>Stop {item.stop_order}: {item.stop?.name}</Popup>
                            </CircleMarker>
                          );
                        })}
                        {liveBusPoint && (
                          <CircleMarker center={liveBusPoint} radius={11} pathOptions={{ color: "#10b981", fillColor: "#34d399", fillOpacity: 1 }}>
                            <Popup>Live bus position</Popup>
                          </CircleMarker>
                        )}
                      </MapContainer>
                    </div>
                  </GlassCard>

                  {/* GPS controls */}
                  <GlassCard t={t}>
                    <SectionLabel t={t}>GPS Control</SectionLabel>
                    <div className={`flex items-center justify-between rounded-xl border px-4 py-3 mb-3 ${isDark ? "border-white/5 bg-white/5" : "border-slate-200 bg-slate-50"}`}>
                      <div>
                        <p className={`text-sm font-semibold ${t.text}`}>Auto GPS Sharing</p>
                        <p className={`text-xs mt-0.5 ${t.textSub}`}>{locationStatus || (autoShare ? "Broadcasting…" : "Paused")}</p>
                      </div>
                      <button type="button" onClick={() => setAutoShare(v => !v)}
                        className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${autoShare ? "bg-emerald-500" : t.toggleOff}`}>
                        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${autoShare ? "translate-x-5" : ""}`} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <input className={`rounded-xl border px-4 py-3 text-sm outline-none focus:border-indigo-500 ${t.input}`} placeholder="Latitude" value={manualLat} onChange={e => setManualLat(e.target.value)} />
                      <input className={`rounded-xl border px-4 py-3 text-sm outline-none focus:border-indigo-500 ${t.input}`} placeholder="Longitude" value={manualLng} onChange={e => setManualLng(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Btn tone="ghost" onClick={sendManualLocation} disabled={locationBusy}>Send Coordinates</Btn>
                      <Btn tone="primary" onClick={sendBrowserLocation} disabled={locationBusy}>{locationBusy ? "Sending…" : "Send My Location"}</Btn>
                    </div>
                  </GlassCard>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <GlassCard t={t}>
                      <div className="flex items-center justify-between mb-4">
                        <SectionLabel t={t}>Stop Timeline</SectionLabel>
                        <Pill color="amber" isDark={isDark}>{routeStops.length} stops</Pill>
                      </div>
                      <StopTimeline stops={routeStops} progressIndex={stopProgressIndex} liveBusPoint={liveBusPoint} t={t} />
                    </GlassCard>
                    <div className="space-y-3">
                      <GlassCard t={t}>
                        <SectionLabel t={t}>Trip Controls</SectionLabel>
                        <Btn tone="danger" onClick={endTrip} disabled={busy} className="w-full !py-4 !text-base">{busy ? "Ending…" : "■ End Trip"}</Btn>
                      </GlassCard>
                      <GlassCard t={t}>
                        <SectionLabel t={t}>Current GPS</SectionLabel>
                        {latestLocation
                          ? <><p className="text-sm font-mono text-indigo-500">{Number(latestLocation.lat).toFixed(6)}, {Number(latestLocation.lng).toFixed(6)}</p><p className={`text-xs mt-1 ${t.textSub}`}>Updated {fmt(latestLocation.recorded_at)}</p></>
                          : <p className={`text-sm ${t.textSub}`}>No location yet</p>}
                      </GlassCard>
                      <Btn tone="danger" className="w-full !py-5 !text-xl font-black tracking-widest shadow-2xl shadow-red-900/50">🚨 SOS</Btn>
                    </div>
                  </div>
                </>
              )}
          </div>
        )}

        {/* ── HISTORY ── */}
        {activeTab === "history" && (
          <div className="space-y-5">
            <GlassCard t={t} className={`bg-gradient-to-br ${isDark ? "from-indigo-900/60 to-[#0a0e1a]" : "from-indigo-50 to-[#f0f4f8]"}`}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Last Shift Summary</p>
              <p className={`text-5xl font-black mt-3 ${t.text}`}>NPR 1,250</p>
              <p className={`text-sm mt-2 ${t.textSub}`}>Total earnings from last completed trip</p>
            </GlassCard>
            <div className="grid grid-cols-2 gap-3">
              <GlassCard t={t}><p className={`text-[10px] uppercase tracking-widest ${t.label}`}>Passengers</p><p className={`text-4xl font-black mt-2 ${t.text}`}>42</p></GlassCard>
              <GlassCard t={t}><p className={`text-[10px] uppercase tracking-widest ${t.label}`}>Duration</p><p className={`text-4xl font-black mt-2 text-indigo-500`}>42 min</p></GlassCard>
            </div>
            <GlassCard t={t}>
              <SectionLabel t={t}>Efficiency Report</SectionLabel>
              {[{ label: "Fuel Efficiency", value: "12.4 km/L" }, { label: "On-Time Performance", value: "98%" }, { label: "Last Route", value: fmtTime(nextSchedule?.scheduled_start_time) }].map(row => (
                <div key={row.label} className={`flex items-center justify-between text-sm border-b pb-4 last:border-0 last:pb-0 mb-4 ${t.divider}`}>
                  <span className={t.textSub}>{row.label}</span>
                  <span className={`font-bold ${t.text}`}>{row.value}</span>
                </div>
              ))}
            </GlassCard>
            <Btn tone="success" className="w-full !py-4 !text-base">✓ Mark Shift Complete</Btn>
          </div>
        )}

        {/* ── EARNINGS ── */}
        {activeTab === "earnings" && (
          <div className="space-y-5">
            <GlassCard t={t} className={`bg-gradient-to-br ${isDark ? "from-indigo-900/60 to-[#0a0e1a]" : "from-indigo-50 to-[#f0f4f8]"}`}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Today's Earnings</p>
              <p className={`text-5xl font-black mt-3 ${t.text}`}>NPR {todaysEarnings.toLocaleString()}</p>
              <p className={`text-sm mt-2 ${t.textSub}`}>Demo placeholder — real API coming soon</p>
            </GlassCard>
            <div className="grid grid-cols-2 gap-3">
              <GlassCard t={t}><p className={`text-[10px] uppercase tracking-widest ${t.label}`}>Completed Trips</p><p className={`text-4xl font-black mt-2 text-indigo-500`}>{completedTrips}</p></GlassCard>
              <GlassCard t={t}><p className={`text-[10px] uppercase tracking-widest ${t.label}`}>Passengers</p><p className={`text-4xl font-black mt-2 ${t.text}`}>{totalPassengers}</p></GlassCard>
            </div>
            <GlassCard t={t}>
              <SectionLabel t={t}>Breakdown</SectionLabel>
              {[{ label: "App Bookings", value: "NPR 2,800" }, { label: "Cash Collections", value: "NPR 1,700" }, { label: "Manual Entries", value: "8 pax" }].map(row => (
                <div key={row.label} className={`flex items-center justify-between text-sm border-b pb-4 last:border-0 last:pb-0 mb-4 ${t.divider}`}>
                  <span className={t.textSub}>{row.label}</span><span className={`font-bold ${t.text}`}>{row.value}</span>
                </div>
              ))}
            </GlassCard>
            <GlassCard t={t}>
              <div className="flex items-center justify-between mb-3"><SectionLabel t={t}>Fuel Level</SectionLabel><Pill color="emerald" isDark={isDark}>GOOD</Pill></div>
              <p className={`text-2xl font-black mb-3 ${t.text}`}>{fuelLevel}%</p>
              <div className={`h-2 rounded-full ${isDark ? "bg-white/10" : "bg-slate-200"}`}><div className="h-2 rounded-full bg-emerald-400 transition-all" style={{ width: `${fuelLevel}%` }} /></div>
            </GlassCard>
          </div>
        )}
      </div>

      {activeTab === "active" && activeTrip && (
        <div className="fixed bottom-6 right-6 z-50 lg:hidden">
          <button type="button" className="h-16 w-16 rounded-full bg-red-600 text-white text-xl font-black shadow-2xl shadow-red-900/60 animate-pulse hover:animate-none hover:bg-red-500 transition-all">SOS</button>
        </div>
      )}
    </div>
  );
}
