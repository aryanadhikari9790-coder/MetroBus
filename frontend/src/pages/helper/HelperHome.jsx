import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { api } from "../../api";
import { useAuth } from "../../AuthContext";
import { clearToken } from "../../auth";
import { useTheme } from "../../ThemeContext";

const LIGHT_THEME = {
  "--hlp-bg": "#fff7fb",
  "--hlp-surface": "rgba(255,255,255,0.9)",
  "--hlp-soft": "#f9e3fb",
  "--hlp-border": "rgba(169,103,210,0.16)",
  "--hlp-text": "#321b39",
  "--hlp-muted": "#89718d",
  "--hlp-purple": "#8c12eb",
  "--hlp-purple-2": "#c243ff",
  "--hlp-plum": "#4a2656",
  "--hlp-shadow": "0 26px 58px rgba(161,69,197,0.12)",
  "--hlp-shadow-strong": "0 28px 62px rgba(140,18,235,0.22)",
};

const DARK_THEME = {
  "--hlp-bg": "#140d1a",
  "--hlp-surface": "rgba(34,22,43,0.92)",
  "--hlp-soft": "rgba(96,51,119,0.48)",
  "--hlp-border": "rgba(202,161,233,0.14)",
  "--hlp-text": "#f7eefb",
  "--hlp-muted": "#bba8c4",
  "--hlp-purple": "#cb7cff",
  "--hlp-purple-2": "#8c12eb",
  "--hlp-plum": "#26152c",
  "--hlp-shadow": "0 26px 58px rgba(0,0,0,0.24)",
  "--hlp-shadow-strong": "0 28px 62px rgba(140,18,235,0.28)",
};

const TABS = [
  { id: "trip", label: "Trip", icon: "bus" },
  { id: "boarding", label: "Boarding", icon: "ticket" },
  { id: "verify", label: "Verify", icon: "shield" },
  { id: "route", label: "Route", icon: "map" },
];

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
    case "pin": return <svg {...common}><path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z" /><circle cx="12" cy="10" r="2.3" /></svg>;
    case "clock": return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></svg>;
    case "alert": return <svg {...common}><path d="M12 4 3.5 18h17L12 4Z" /><path d="M12 9v4" /><path d="M12 16h.01" /></svg>;
    case "qr": return <svg {...common}><path d="M4 4h5v5H4z" /><path d="M15 4h5v5h-5z" /><path d="M4 15h5v5H4z" /><path d="M15 15h2" /><path d="M18 15v5" /><path d="M15 18h3" /></svg>;
    case "thermo": return <svg {...common}><path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z" /><path d="M12 11v5" /></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>;
  }
}

function SurfaceCard({ children, className = "" }) {
  return <div className={`rounded-[2rem] border border-[var(--hlp-border)] bg-[var(--hlp-surface)] p-5 shadow-[var(--hlp-shadow)] backdrop-blur-xl ${className}`}>{children}</div>;
}

function HeaderButton({ children, className = "", ...props }) {
  return <button type="button" className={`grid h-11 w-11 place-items-center rounded-full border border-[var(--hlp-border)] bg-white/75 text-[var(--hlp-purple)] shadow-[var(--hlp-shadow)] ${className}`} {...props}>{children}</button>;
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
  return <button type="button" className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black uppercase tracking-[0.14em] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone] || tones.primary} ${className}`} {...props}>{children}</button>;
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

function formatDateTime(value) {
  if (!value) return "--";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
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
  const { user } = useAuth();
  const { isDark, toggle } = useTheme();
  const theme = useMemo(() => (isDark ? DARK_THEME : LIGHT_THEME), [isDark]);

  const [trips, setTrips] = useState([]);
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
  const [verifiedPayment, setVerifiedPayment] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [activeTab, setActiveTab] = useState("trip");

  const selectedTrip = useMemo(() => trips.find((trip) => String(trip.id) === String(tripId)) || null, [trips, tripId]);
  const availableSeats = seats.filter((seat) => seat.available);
  const occupiedCount = seats.length - availableSeats.length;
  const selectedCount = selectedSeatIds.length;
  const selectedSeatLabels = seats.filter((seat) => selectedSeatIds.includes(seat.seat_id)).map((seat) => seat.seat_no);
  const stopOptions = routeStops.map((stop) => ({ value: String(stop.stop_order), label: `${stop.stop_order}. ${stop.stop?.name || "--"}` }));
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
  const routeCondition = livePoint ? "Live movement on route" : "Waiting for GPS ping";
  const helperInitials = (user?.full_name || "Helper").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  const loadTrips = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoadingTrips(true);
    try {
      const response = await api.get("/api/trips/live/");
      setTrips(response.data);
      setErr("");
      setTripId((current) => {
        if (!current && response.data.length > 0) return String(response.data[0].id);
        if (current && !response.data.some((trip) => String(trip.id) === String(current))) {
          return response.data[0] ? String(response.data[0].id) : "";
        }
        return current;
      });
    } catch (error) {
      setErr(error?.response?.data?.detail || "Unable to load live trips.");
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

  useEffect(() => {
    loadTrips();
    loadAssignedBus();
    const intervalId = setInterval(() => loadTrips({ silent: true }), 20000);
    return () => clearInterval(intervalId);
  }, [loadTrips, loadAssignedBus]);

  useEffect(() => {
    loadTripContext(tripId);
    if (!tripId) return undefined;
    const intervalId = setInterval(() => loadTripContext(tripId), 15000);
    return () => clearInterval(intervalId);
  }, [tripId, loadTripContext]);

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

  const verifyCash = async () => {
    if (!verifyBookingId.trim()) {
      setErr("Enter a booking ID.");
      return;
    }
    setVerifyBusy(true);
    setErr("");
    setMsg("");
    setVerifiedPayment(null);
    try {
      const response = await api.post(`/api/payments/cash/verify/${verifyBookingId.trim()}/`);
      setVerifiedPayment(response.data);
      setMsg(`Payment verified for booking #${verifyBookingId.trim()}.`);
    } catch (error) {
      setErr(error?.response?.data?.detail || "Verification failed.");
    } finally {
      setVerifyBusy(false);
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
    <div style={theme} className="min-h-screen bg-[linear-gradient(180deg,var(--hlp-bg),rgba(255,243,249,0.98))] text-[var(--hlp-text)]">
      <header className="sticky top-0 z-30 border-b border-[var(--hlp-border)] bg-[rgba(255,247,251,0.92)] px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-[linear-gradient(135deg,#8c12eb,#c243ff)] text-sm font-black text-white shadow-[var(--hlp-shadow-strong)]">{helperInitials}</div>
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-[var(--hlp-shadow)]">
              <span className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-[var(--hlp-purple)]">MB</span>
            </div>
            <div>
              <p className="text-[0.62rem] font-black uppercase tracking-[0.22em] text-[var(--hlp-purple)]">MetroBus Helper</p>
              <p className="text-base font-black">{user?.full_name || "Helper"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Chip tone={trips.length ? "live" : "soft"}>{trips.length ? `${trips.length} Live` : "Standby"}</Chip>
            <HeaderButton onClick={() => loadTrips()}>
              <Icon name="refresh" />
            </HeaderButton>
            <HeaderButton onClick={toggle}>
              <Icon name={isDark ? "sun" : "moon"} />
            </HeaderButton>
            <HeaderButton onClick={handleLogout} className="text-[var(--hlp-plum)]">
              <Icon name="logout" />
            </HeaderButton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 pb-32">
        {err ? <div className="mb-4 rounded-[1.5rem] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{err}</div> : null}
        {msg ? <div className="mb-4 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{msg}</div> : null}

        <section className="relative overflow-hidden rounded-[2.5rem] bg-[linear-gradient(135deg,#8c12eb,#c243ff)] p-6 text-white shadow-[var(--hlp-shadow-strong)]">
          <div className="absolute inset-y-0 right-0 w-36 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.14),transparent_62%)]" />
          <p className="text-[0.68rem] font-black uppercase tracking-[0.28em] text-white/74">Shift Dashboard</p>
          <h1 className="mt-3 text-5xl font-black leading-[0.92] whitespace-pre-line">{selectedTrip ? "LIVE\nSUPPORT" : "READY ON\nSHIFT"}</h1>
          <p className="mt-4 text-base font-medium text-white/84">
            {selectedTrip ? `${selectedTrip.route_name} is ready for boarding, payment checks, and route support.` : "Waiting for a live trip in Pokhara. Stay ready for boarding and cash verification."}
          </p>
          <div className="mt-6 rounded-[2rem] border border-white/20 bg-white/10 p-4 backdrop-blur">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-white/14 text-white"><Icon name="bus" className="h-7 w-7" /></div>
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-white/74">Assigned Bus</p>
                <p className="mt-1 text-2xl font-black">{assignedBus?.plate_number || selectedTrip?.bus_plate || "--"}</p>
                <p className="mt-1 text-sm text-white/78">{assignedBus?.capacity || "--"} seats - Driver: {selectedTrip?.driver_name || assignedBus?.driver_name || "--"}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <StatCard label="Open Seats" value={availableSeats.length} note="Current segment" icon="ticket" />
          <StatCard label="Occupied" value={occupiedCount} note="Already reserved" icon="shield" />
          <StatCard label="Marked" value={selectedCount} note="Offline seats" icon="money" />
        </div>

        {activeTab === "trip" ? (
          <div className="mt-5 space-y-5">
            <SurfaceCard>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <SectionLabel>Live Trip</SectionLabel>
                  <h2 className="mt-1 text-4xl font-black leading-[1.02]">Shift Dashboard</h2>
                </div>
                <Chip tone={selectedTrip ? "live" : "warn"}>{selectedTrip ? "Trip Active" : "No Trip"}</Chip>
              </div>
              <div className="mt-5">
                <SelectField label="Select Live Trip" value={tripId} onChange={(value) => { setTripId(value); setMsg(""); setErr(""); setVerifiedPayment(null); }} options={trips.length ? trips.map((trip) => ({ value: String(trip.id), label: `${trip.route_name} - ${trip.bus_plate}` })) : [{ value: "", label: "No live trips available" }]} />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Trip ID", value: selectedTrip?.id || "--", note: "Active record", icon: "ticket" },
                  { label: "Started", value: formatTime(selectedTrip?.started_at), note: formatDateTime(selectedTrip?.started_at), icon: "clock" },
                  { label: "Driver", value: selectedTrip?.driver_name || "--", note: selectedTrip?.bus_plate || "--", icon: "profile" },
                  { label: "Last GPS", value: latestLocation ? formatTime(latestLocation.recorded_at) : "--", note: livePoint ? "Signal live" : "Waiting for update", icon: "pin" },
                ].map((card) => (
                  <SurfaceCard key={card.label} className="!rounded-[1.7rem] !p-4">
                    <div className="text-[var(--hlp-purple)]"><Icon name={card.icon} /></div>
                    <p className="mt-5 text-[0.64rem] font-black uppercase tracking-[0.2em] text-[var(--hlp-muted)]">{card.label}</p>
                    <p className="mt-2 text-lg font-black">{card.value}</p>
                    <p className="mt-1 text-xs text-[var(--hlp-muted)]">{card.note}</p>
                  </SurfaceCard>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="bg-[rgba(250,227,252,0.86)]">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[rgba(140,18,235,0.12)] text-[var(--hlp-purple)]"><Icon name="alert" /></div>
                <div>
                  <SectionLabel>Staff Reminder</SectionLabel>
                  <p className="text-lg font-black">Board offline passengers only after checking the correct trip segment.</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--hlp-muted)]">The boarding workspace below keeps segment-based seat availability and cash verification tied to the same live trip.</p>
                </div>
              </div>
            </SurfaceCard>
          </div>
        ) : null}

        {activeTab === "boarding" ? (
          <div className="mt-5 space-y-5">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {routeStops.slice(0, 4).map((stop, index) => (
                <button key={stop.stop_order} type="button" onClick={() => setFromOrder(String(stop.stop_order))} className={`shrink-0 rounded-full px-5 py-3 text-sm font-black uppercase tracking-[0.14em] ${index === 0 ? "bg-[linear-gradient(135deg,#8c12eb,#c243ff)] text-white shadow-[var(--hlp-shadow-strong)]" : "bg-[var(--hlp-soft)] text-[var(--hlp-purple)]"}`}>
                  {stop.stop?.name || `Stop ${stop.stop_order}`}
                </button>
              ))}
            </div>

            <SurfaceCard>
              <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
                <SelectField label="From" value={fromOrder} onChange={setFromOrder} options={stopOptions.length ? stopOptions : [{ value: "", label: "No stops" }]} disabled={!stopOptions.length} />
                <button type="button" onClick={() => { const currentFrom = fromOrder; setFromOrder(toOrder); setToOrder(currentFrom); }} className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--hlp-soft)] text-[var(--hlp-purple)]">
                  <Icon name="swap" className="h-6 w-6" />
                </button>
                <SelectField label="To" value={toOrder} onChange={setToOrder} options={stopOptions.length ? stopOptions : [{ value: "", label: "No stops" }]} disabled={!stopOptions.length} />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <SectionLabel>Segment Status</SectionLabel>
                <Chip tone={loadingAvail ? "warn" : "live"}>{loadingAvail ? "Refreshing Seats" : "Seats Ready"}</Chip>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-5 text-[0.72rem] font-black uppercase tracking-[0.16em] text-[var(--hlp-muted)]">
                <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded-full border border-[var(--hlp-border)] bg-white" />Open</span>
                <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded-full bg-[rgba(233,198,244,0.86)]" />Occupied</span>
                <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded-full bg-[linear-gradient(135deg,#8c12eb,#c243ff)]" />Selected</span>
              </div>
            </SurfaceCard>

            <SurfaceCard className="overflow-hidden !p-0">
              <div className="border-b border-[var(--hlp-border)] px-5 py-4">
                <SectionLabel>Seat Map</SectionLabel>
                <p className="mt-1 text-lg font-black">Offline boarding workspace</p>
              </div>
              <div className="bg-[var(--hlp-soft)] px-4 py-5 sm:px-6">
                {seats.length === 0 ? <div className="rounded-[1.8rem] bg-white/70 px-5 py-8 text-center text-sm font-medium text-[var(--hlp-muted)]">Select a live trip and a valid segment to load available seats.</div> : <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">{seats.map((seat) => <SeatNode key={seat.seat_id} seat={seat} selected={selectedSeatIds.includes(seat.seat_id)} onClick={() => toggleSeat(seat.seat_id)} />)}</div>}
                <div className="mx-auto mt-6 flex w-fit flex-wrap items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-black text-[var(--hlp-text)] shadow-[var(--hlp-shadow)]">
                  <span className="uppercase tracking-[0.16em] text-[var(--hlp-muted)]">Selected seats:</span>
                  {selectedSeatLabels.length ? selectedSeatLabels.map((label) => <span key={label} className="rounded-full bg-[linear-gradient(135deg,#8c12eb,#c243ff)] px-3 py-1 text-xs text-white">{label}</span>) : <span className="text-[var(--hlp-muted)]">None</span>}
                </div>
              </div>
            </SurfaceCard>

            <PrimaryButton tone="primary" onClick={submitOffline} disabled={offlineBusy || !selectedSeatIds.length} className="w-full !py-5 !text-base">
              <Icon name="ticket" />
              {offlineBusy ? "Saving Offline Boarding" : "Save Offline Boarding"}
            </PrimaryButton>
            <p className="text-center text-sm text-[var(--hlp-muted)]">Boarding records remain available for staff workflows even when passenger devices are offline.</p>
          </div>
        ) : null}

        {activeTab === "verify" ? (
          <div className="mt-5 space-y-5">
            <div className="px-1">
              <SectionLabel>Transit Verification</SectionLabel>
              <h2 className="mt-2 text-6xl font-black leading-[0.9]">Verify Payment</h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-[var(--hlp-muted)]">Enter the booking ID provided by the commuter to validate an onboard cash transaction before confirming it in the system.</p>
            </div>
            <SurfaceCard className="rounded-[2.4rem]">
              <label className="mb-3 block text-[0.68rem] font-black uppercase tracking-[0.24em] text-[var(--hlp-muted)]">Booking ID</label>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="relative">
                  <input type="text" value={verifyBookingId} onChange={(event) => setVerifyBookingId(event.target.value)} placeholder="MB-8829-441" className="w-full rounded-full border border-[var(--hlp-border)] bg-[var(--hlp-soft)] px-5 py-4 pr-14 text-base font-semibold text-[var(--hlp-text)] outline-none" />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[var(--hlp-purple)]"><Icon name="qr" className="h-6 w-6" /></span>
                </div>
                <PrimaryButton tone="primary" onClick={verifyCash} disabled={verifyBusy} className="!px-8 !py-4">
                  {verifyBusy ? "Verifying" : "Verify"}
                </PrimaryButton>
              </div>
            </SurfaceCard>
            <SurfaceCard className="rounded-[2.4rem] border-[rgba(215,149,239,0.45)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Chip tone="soft">Verification Result</Chip>
                  <h3 className="mt-5 text-4xl font-black leading-tight">Commuter Ticket</h3>
                </div>
                <div className="grid h-16 w-16 place-items-center rounded-full bg-[var(--hlp-soft)] text-[var(--hlp-purple)]"><Icon name="shield" className="h-8 w-8" /></div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {[{ label: "Payment", value: verifiedPayment?.method || "Cash" }, { label: "Status", value: verifiedPayment?.status || "Pending" }, { label: "Amount", value: verifiedPayment?.amount ? `Rs. ${verifiedPayment.amount}` : "--" }].map((item) => (
                  <div key={item.label}>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-[var(--hlp-muted)]">{item.label}</p>
                    <p className={`mt-3 text-2xl font-black ${item.label === "Status" ? "text-[var(--hlp-purple)]" : ""}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </SurfaceCard>
            <PrimaryButton tone="danger" className="w-full !py-5 !text-base">
              Confirm Payment
              <Icon name="shield" />
            </PrimaryButton>
            <p className="text-center text-sm text-[var(--hlp-muted)]">By confirming, you acknowledge the receipt of physical cash from the commuter.</p>
          </div>
        ) : null}

        {activeTab === "route" ? (
          <div className="mt-5 space-y-5">
            <div className="px-1">
              <SectionLabel>Live Journey</SectionLabel>
              <h2 className="mt-2 text-4xl font-black">{selectedTrip?.route_name || "No Route Selected"}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Chip tone="soft">Express</Chip>
                <p className="text-sm font-medium text-[var(--hlp-muted)]">To {routeStops[routeStops.length - 1]?.stop?.name || "Destination pending"}</p>
              </div>
            </div>
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
                            <p className={`text-2xl font-black ${isCurrent ? "text-[var(--hlp-purple)]" : ""}`}>{stop.stop?.name || "--"}</p>
                            <p className="mt-1 text-[0.74rem] font-black uppercase tracking-[0.18em] text-[var(--hlp-muted)]">{isCurrent ? "Current stop" : isFinal ? "Final destination" : "Upcoming stop"}</p>
                          </div>
                          <p className="text-lg font-black text-[var(--hlp-text)]">{index === currentStopIndex ? formatTime(latestLocation?.recorded_at || selectedTrip?.started_at) : `${9 + index}:${index === 0 ? "10" : `${index}5`}`}</p>
                        </div>
                        {isCurrent ? <div className="mt-3 rounded-[1.4rem] border border-[rgba(140,18,235,0.25)] bg-[var(--hlp-soft)] px-4 py-3 text-sm font-medium text-[var(--hlp-plum)]">Boarding support is active here. Next movement is toward {upcomingStop?.stop?.name || "the next stop"}.</div> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SurfaceCard>
            <SurfaceCard className="overflow-hidden bg-[linear-gradient(135deg,#8c12eb,#c243ff)] text-white shadow-[var(--hlp-shadow-strong)]">
              <div className="flex items-start justify-between gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/14"><Icon name="qr" className="h-7 w-7" /></div>
                <Chip tone="dark" className="bg-white/18">Active Pass</Chip>
              </div>
              <p className="mt-6 text-sm font-medium text-white/76">Registered user</p>
              <p className="mt-1 text-3xl font-black">Morning Commute</p>
              <div className="mt-5 border-t border-white/18 pt-4 text-sm font-semibold text-white/86">Valid until {formatTime(selectedTrip?.started_at)}</div>
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
                  {mapPolyline.length > 1 ? <Polyline positions={mapPolyline} pathOptions={{ color: "#8c12eb", weight: 5, opacity: 0.9 }} /> : null}
                  {routeStops.map((stop, index) => {
                    const lat = Number(stop.stop?.lat);
                    const lng = Number(stop.stop?.lng);
                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                    const current = index === currentStopIndex;
                    return <CircleMarker key={`${stop.stop_order}-${stop.stop?.name}`} center={[lat, lng]} radius={current ? 8 : 5} pathOptions={{ color: current ? "#8c12eb" : "#c48cdd", fillColor: current ? "#8c12eb" : "#f1daf7", fillOpacity: 0.95 }}><Popup>{stop.stop_order}. {stop.stop?.name}</Popup></CircleMarker>;
                  })}
                  {livePoint ? <CircleMarker center={livePoint} radius={10} pathOptions={{ color: "#10b981", fillColor: "#34d399", fillOpacity: 1 }}><Popup>Latest helper-linked trip location</Popup></CircleMarker> : null}
                </MapContainer>
              </div>
              <div className="px-5 py-4">
                <PrimaryButton tone="ghost" className="w-full">Open Full Map</PrimaryButton>
              </div>
            </SurfaceCard>
            <SurfaceCard className="border-dashed">
              <SectionLabel>Route Weather</SectionLabel>
              <div className="mt-4 flex items-center gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-[var(--hlp-soft)] text-[var(--hlp-purple)]"><Icon name="thermo" className="h-7 w-7" /></div>
                <div>
                  <p className="text-4xl font-black">24C</p>
                  <p className="mt-1 text-sm font-medium text-[var(--hlp-muted)]">Clear skies for travel in Pokhara</p>
                </div>
              </div>
            </SurfaceCard>
          </div>
        ) : null}
      </main>
      <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-[30rem] -translate-x-1/2 rounded-[2rem] border border-white/70 bg-[rgba(255,252,255,0.92)] p-2 shadow-[var(--hlp-shadow)] backdrop-blur-xl">
        <div className="grid grid-cols-4 gap-2">
          {TABS.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-2 rounded-[1.4rem] py-3 text-center transition ${activeTab === tab.id ? "bg-[linear-gradient(135deg,#8c12eb,#c243ff)] text-white shadow-[var(--hlp-shadow-strong)]" : "text-[var(--hlp-muted)]"}`}><Icon name={tab.icon} className="h-5 w-5" /><span className="text-[0.66rem] font-black uppercase tracking-[0.14em]">{tab.label}</span></button>)}
        </div>
      </div>
    </div>
  );
}
