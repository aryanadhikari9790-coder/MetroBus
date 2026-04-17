import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { api } from "../../api";
import { useAuth } from "../../AuthContext";
import { clearToken } from "../../auth";
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
  { id: "routes", label: "Routes", icon: "route" },
  { id: "history", label: "History", icon: "history" },
  { id: "account", label: "Account", icon: "account" },
];

function Icon({ name, className = "h-5 w-5" }) {
  const common = { className, fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24" };
  switch (name) {
    case "home": return <svg {...common}><path d="M4 10.5 12 4l8 6.5" /><path d="M7 10v8h10v-8" /></svg>;
    case "route": return <svg {...common}><path d="M5 19c2.4-4.2 3.6-10.1 6.1-13.9 1-1.5 3.5-1.5 4.5 0 1.1 1.6.8 3.6-.7 4.9L9.2 15" /><circle cx="6" cy="19" r="1.5" /><circle cx="18" cy="5" r="1.5" /></svg>;
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
  const [passengerRequests, setPassengerRequests] = useState([]);
  const [latestLocation, setLatestLocation] = useState(null);

  const activeTrip = dashboard?.active_trip ?? null;
  const pendingTrip = dashboard?.pending_trip ?? null;
  const trip = activeTrip || pendingTrip;
  const schedules = dashboard?.schedules ?? [];

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

  const routePolyline = useMemo(() => routeStops.map((item) => [Number(item.stop?.lat), Number(item.stop?.lng)]).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)), [routeStops]);
  const liveBusPoint = useMemo(() => {
    if (!latestLocation) return null;
    const lat = Number(latestLocation.lat);
    const lng = Number(latestLocation.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }, [latestLocation]);

  const pickupRequests = useMemo(() => passengerRequests.filter((item) => item.stage === "pickup"), [passengerRequests]);
  const dropRequests = useMemo(() => passengerRequests.filter((item) => item.stage === "dropoff"), [passengerRequests]);
  const stopIndex = useMemo(() => {
    if (!liveBusPoint || !routePolyline.length) return -1;
    let best = -1;
    let bestDistance = Infinity;
    routePolyline.forEach((point, index) => {
      const nextDistance = distance(point, liveBusPoint);
      if (nextDistance < bestDistance) {
        bestDistance = nextDistance;
        best = index;
      }
    });
    return best;
  }, [liveBusPoint, routePolyline]);

  const mapPoints = useMemo(() => {
    const points = [...routePolyline];
    passengerRequests.forEach((item) => {
      const lat = Number(item.marker_lat);
      const lng = Number(item.marker_lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) points.push([lat, lng]);
    });
    if (liveBusPoint) points.push(liveBusPoint);
    return points;
  }, [routePolyline, passengerRequests, liveBusPoint]);

  const routeStart = routeStops[0]?.stop?.name || "--";
  const routeEnd = routeStops[routeStops.length - 1]?.stop?.name || "--";
  const nextStop = stopIndex >= 0 ? routeStops[Math.min(stopIndex + 1, routeStops.length - 1)]?.stop?.name || routeEnd : routeStart;

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
        setPassengerRequests([]);
      }
      return;
    }
    try {
      const response = await api.get(`/api/trips/${tripId}/`);
      setRouteStops(response.data.route_stops || []);
      setPassengerRequests(response.data.passenger_requests || []);
    } catch {
      if (clearIfMissing) {
        setRouteStops([]);
        setPassengerRequests([]);
      }
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

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
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

  const acceptAssignment = async () => {
    if (!selectedSchedule?.id) return;
    const response = await runAction(() => api.post(`/api/trips/schedules/${selectedSchedule.id}/accept/`), "Assignment accepted.");
    if (response) setSelectedScheduleId(String(selectedSchedule.id));
  };

  const startRide = async () => {
    const payload = pendingTrip?.id ? { trip_id: pendingTrip.id } : selectedSchedule?.id ? { schedule_id: selectedSchedule.id } : null;
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

  const showAccept = !activeTrip && !pendingTrip && selectedSchedule && !selectedSchedule.driver_assignment_accepted;
  const showStart = !activeTrip && (pendingTrip || selectedSchedule?.driver_assignment_accepted);
  const canStart = pendingTrip ? !pendingTrip.driver_start_confirmed : Boolean(selectedSchedule?.driver_assignment_accepted);
  const homeStatus = activeTrip ? "Trip Live" : pendingTrip ? (pendingTrip.driver_start_confirmed ? "Waiting for Helper" : pendingTrip.helper_start_confirmed ? "Ready to Go Live" : "Start Pending") : selectedSchedule ? (selectedSchedule.driver_assignment_accepted ? "Ready to Start" : "Assignment Pending") : "Standby";
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

        {!loading && tab !== "home" ? (
          <section className={`${card} p-6`}>
            <p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[var(--primary)]">Driver Navigation</p>
            <h2 className="mt-3 text-[2rem] font-black leading-tight">{TABS.find((item) => item.id === tab)?.label} page is ready for the next step</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">The footer navigation is set up now. We can wire this tab into its own driver-side screen next.</p>
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
                  {showAccept ? <button type="button" onClick={acceptAssignment} disabled={busy} className={`${button} bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-white shadow-[var(--shadow-strong)]`}><Icon name="assignment" className="h-4 w-4" />{busy ? "Accepting Assignment..." : "Accept Assignment"}</button> : null}
                  {showStart ? <button type="button" onClick={startRide} disabled={busy || !canStart} className={`${button} bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-white shadow-[var(--shadow-strong)]`}><Icon name="play" className="h-4 w-4" />{busy ? "Sending..." : startLabel}</button> : null}
                </div>
              </div>
            ) : null}

            <div className={`${!activeTrip ? "border-t border-[var(--border)]" : ""}`}>
              <div className="border-b border-[var(--border)] px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[0.72rem] font-black uppercase tracking-[0.24em] text-[var(--primary)]">Passenger Map</p>
                    <h2 className="mt-2 break-words text-[1.6rem] font-black leading-tight">{trip?.route_name || selectedSchedule?.route_name || "Driver ride map"}</h2>
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
                  {routePolyline.length > 1 ? <Polyline positions={routePolyline} pathOptions={{ color: theme["--primary"], weight: 5, opacity: 0.92 }} /> : null}
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
                      <h3 className="mt-2 text-2xl font-black">{selectedSchedule ? "Start the ride to unlock the live driver map" : "Waiting for your next assigned trip"}</h3>
                      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{selectedSchedule ? "After the ride is started, this map will show the route and passenger points. Pickup markers will appear in green and drop markers will appear in red." : "Once admin assigns a ride, the home page will show the route controls here."}</p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 border-t border-[var(--border)] px-5 py-4 sm:grid-cols-3">
                <div className={`${soft} px-4 py-4`}><p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Current State</p><p className="mt-2 text-lg font-black">{homeStatus}</p></div>
                <div className={`${soft} px-4 py-4`}><p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Bus / Helper</p><p className="mt-2 break-words text-lg font-black">{trip?.bus_plate || selectedSchedule?.bus_plate || "--"}</p><p className="mt-1 text-sm text-[var(--muted)]">{trip?.helper_name || selectedSchedule?.helper_name || "Helper pending"}</p></div>
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
