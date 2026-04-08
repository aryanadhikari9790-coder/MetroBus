import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import {
  createBusIcon,
  distKm,
  fmtDate,
  fmtEta,
  fmtMoney,
  fmtTime,
  getBusPoint,
  paymentHandle,
  routeCode,
  statusTone,
  toPoint,
} from "../../pages/passenger/passengerUtils";

export function SplashScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8f7ff,#f5f2ff_42%,#f7f3ff)] px-6">
      <div className="w-full max-w-[23rem] text-center">
        <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-white shadow-[0_28px_60px_rgba(111,40,255,0.14)]">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-[linear-gradient(135deg,#6810ff,#8f28ff)] text-white shadow-[0_18px_34px_rgba(104,16,255,0.24)]">
            <MetroBusMark className="h-10 w-10" />
          </div>
        </div>
        <div className="mt-8">
          <MetroBusWordmark />
        </div>
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.28em] text-[var(--mb-muted)]">
          Premium Mobility
        </p>
        <div className="mx-auto mt-24 h-1.5 w-16 overflow-hidden rounded-full bg-[#d7d3e8]">
          <div className="h-full w-7 rounded-full bg-[var(--mb-purple)]" />
        </div>
        <p className="mx-auto mt-20 max-w-[17rem] text-[2rem] font-black leading-tight tracking-[-0.03em] text-[var(--mb-text)]">
          The serene way to navigate your city.
        </p>
        <p className="mt-9 text-xs font-semibold uppercase tracking-[0.3em] text-[#bbb4ca]">
          Powered by Metro Dynamics
        </p>
      </div>
    </div>
  );
}

export function MetroBusMark({ className = "h-12 w-12" }) {
  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="metrobus-brand-gradient" x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#5f0c84" />
          <stop offset="100%" stopColor="#be3fff" />
        </linearGradient>
      </defs>
      <rect x="17" y="9" width="33" height="52" rx="10" fill="url(#metrobus-brand-gradient)" />
      <rect x="23" y="18" width="21" height="28" rx="4" fill="#fff" opacity="0.95" />
      <rect x="28" y="12" width="10" height="3" rx="1.5" fill="#fff" />
      <rect x="10" y="27" width="8" height="4" rx="2" fill="url(#metrobus-brand-gradient)" />
      <rect x="15" y="34" width="8" height="4" rx="2" fill="url(#metrobus-brand-gradient)" />
      <rect x="17" y="41" width="8" height="4" rx="2" fill="url(#metrobus-brand-gradient)" />
      <path d="M22 29h12l10 10-10 10H22l8-10z" fill="#fff" />
      <path d="M26 32h9l7 7-7 7h-9l5-7z" fill="url(#metrobus-brand-gradient)" />
      <path d="M49 31c5 0 9 4 9 9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M49 24c8 0 15 7 15 16" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="28" cy="56" r="3" fill="#fff" />
      <circle cx="42" cy="56" r="3" fill="#fff" />
      <rect x="48" y="24" width="8" height="16" rx="3" fill="url(#metrobus-brand-gradient)" />
    </svg>
  );
}

export function MetroBusWordmark({ compact = false }) {
  return (
    <div className={`font-black tracking-[-0.05em] ${compact ? "text-[1.45rem]" : "text-[3rem]"}`}>
      <span className="text-[#17131d]">Metro</span>
      <span className="text-[var(--mb-purple)]">Bus</span>
    </div>
  );
}

export function Icon({ name, className = "h-5 w-5" }) {
  const common = { className, fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24" };
  switch (name) {
    case "bell":
      return <svg {...common}><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" /><path d="M10 17a2 2 0 0 0 4 0" /></svg>;
    case "menu":
      return <svg {...common}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg>;
    case "arrow-left":
      return <svg {...common}><path d="m15 6-6 6 6 6" /><path d="M9 12h11" /></svg>;
    case "search":
      return <svg {...common}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>;
    case "home":
      return <svg {...common}><path d="M4 10.5 12 4l8 6.5" /><path d="M7 10v8h10v-8" /></svg>;
    case "track":
      return <svg {...common}><path d="M12 3 18 6l-6 15-6-3 6-15Z" /><path d="m12 3 0 6" /></svg>;
    case "rides":
      return <svg {...common}><rect x="5" y="6" width="14" height="10" rx="3" /><path d="M7.5 16v2" /><path d="M16.5 16v2" /><path d="M7 11h10" /></svg>;
    case "profile":
      return <svg {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 19c1.8-3 4.1-4.5 7-4.5S17.2 16 19 19" /></svg>;
    case "logout":
      return <svg {...common}><path d="M15 17 20 12 15 7" /><path d="M20 12H9" /><path d="M12 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" /></svg>;
    case "briefcase":
      return <svg {...common}><rect x="4" y="7" width="16" height="11" rx="2.5" /><path d="M9 7V5.7A1.7 1.7 0 0 1 10.7 4h2.6A1.7 1.7 0 0 1 15 5.7V7" /></svg>;
    case "school":
      return <svg {...common}><path d="M3 9 12 4l9 5-9 5-9-5Z" /><path d="M6 11.5V16c0 .9 2.7 2 6 2s6-1.1 6-2v-4.5" /><path d="M21 9v6" /></svg>;
    case "dumbbell":
      return <svg {...common}><path d="M4 9v6" /><path d="M7 8v8" /><path d="M17 8v8" /><path d="M20 9v6" /><path d="M7 12h10" /></svg>;
    case "pin":
      return <svg {...common}><path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" /><circle cx="12" cy="11" r="2" /></svg>;
    case "star":
      return <svg {...common}><path d="m12 4 2.4 4.8 5.3.8-3.9 3.8.9 5.3L12 16.2 7.3 18.7l.9-5.3-3.9-3.8 5.3-.8L12 4Z" /></svg>;
    case "chat":
      return <svg {...common}><path d="M6 17.5 4.5 20V6.8A2.8 2.8 0 0 1 7.3 4h9.4a2.8 2.8 0 0 1 2.8 2.8v7.4A2.8 2.8 0 0 1 16.7 17H6Z" /><path d="M8 9h8" /><path d="M8 12h5" /></svg>;
    case "seat":
      return <svg {...common}><path d="M8 6v5a2 2 0 0 0 2 2h5" /><path d="M8 18h8" /><path d="M8 13v5" /><path d="M16 11V6" /></svg>;
    case "snow":
      return <svg {...common}><path d="M12 3v18" /><path d="m5.6 6.6 12.8 10.8" /><path d="m18.4 6.6-12.8 10.8" /></svg>;
    case "share":
      return <svg {...common}><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 13v5h14v-5" /></svg>;
    case "alert":
      return <svg {...common}><path d="M12 4 3.5 18h17L12 4Z" /><path d="M12 9v4" /><path d="M12 16h.01" /></svg>;
    case "wallet":
      return <svg {...common}><rect x="4" y="6" width="16" height="12" rx="3" /><path d="M14 11h6" /><path d="M16.5 11h.01" /></svg>;
    case "shield":
      return <svg {...common}><path d="M12 3 5 6.3v5.4c0 4.1 2.8 7.9 7 9.3 4.2-1.4 7-5.2 7-9.3V6.3L12 3Z" /></svg>;
    case "help":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.3a2.7 2.7 0 0 1 5 .9c0 1.8-2 2.2-2.5 3.5" /><path d="M12 17h.01" /></svg>;
    case "info":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 10v6" /><path d="M12 7h.01" /></svg>;
    case "lock":
      return <svg {...common}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8.5A4 4 0 0 1 12 4.5a4 4 0 0 1 4 4V11" /></svg>;
    case "plus":
      return <svg {...common}><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
    case "qr":
      return <svg {...common}><path d="M4 4h5v5H4z" /><path d="M15 4h5v5h-5z" /><path d="M4 15h5v5H4z" /><path d="M15 15h2" /><path d="M18 15v5" /><path d="M15 18h3" /></svg>;
    case "edit":
      return <svg {...common}><path d="m4 20 4.5-1 9-9a2.2 2.2 0 0 0-3.1-3.1l-9 9L4 20Z" /></svg>;
    case "download":
      return <svg {...common}><path d="M12 4v10" /><path d="m8 10 4 4 4-4" /><path d="M5 19h14" /></svg>;
    case "chevron":
      return <svg {...common}><path d="m9 6 6 6-6 6" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>;
  }
}

export function PassengerAvatar({ user, size = "h-11 w-11" }) {
  return (
    <div className={`grid ${size} place-items-center rounded-full bg-[linear-gradient(135deg,#8d12eb,#ff4fd8)] text-sm font-black text-white shadow-[var(--mb-shadow-strong)]`}>
      {(user?.full_name || "P").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
    </div>
  );
}

export function HeaderBar({ user, activeView, onLogout }) {
  return (
    <header className="fixed inset-x-0 top-0 z-[1200] border-b border-white/60 bg-[color:var(--mb-nav)]/98 px-4 py-4 shadow-[0_12px_32px_rgba(83,33,159,0.08)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[28rem] items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" className="grid h-11 w-11 place-items-center rounded-full bg-white text-[var(--mb-purple)] shadow-[var(--mb-shadow)]">
            <Icon name="menu" />
          </button>
          <div>
            <MetroBusWordmark compact />
            <p className="text-xs font-medium text-[var(--mb-muted)]">
              {activeView === "home" ? "Journey Planner" : activeView === "track" ? "Live Tracking" : activeView === "rides" ? "My Tickets" : "Passenger Profile"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="grid h-11 w-11 place-items-center rounded-full bg-white text-[var(--mb-purple)] shadow-[var(--mb-shadow)]">
            <Icon name="bell" />
          </button>
          <button type="button" onClick={onLogout} className="grid h-11 w-11 place-items-center rounded-full bg-white text-[var(--mb-text)] shadow-[var(--mb-shadow)]">
            <Icon name="logout" />
          </button>
          <PassengerAvatar user={user} size="h-12 w-12" />
        </div>
      </div>
    </header>
  );
}

function MapViewport({ points }) {
  const map = useMap();
  const hashRef = useRef("");
  useEffect(() => {
    if (!points.length) return;
    const hash = points.map((point) => point.join(",")).join("|");
    if (hashRef.current === hash) return;
    hashRef.current = hash;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(points, { padding: [24, 24] });
  }, [map, points]);
  return null;
}

export function SearchBar({ summary, onOpenPlanner, onSearch }) {
  return (
    <div className="mt-6 flex items-center gap-3 rounded-[28px] bg-[var(--mb-card-soft)] p-3 shadow-[var(--mb-shadow)]">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-white text-[var(--mb-muted)]">
        <Icon name="search" />
      </div>
      <button type="button" onClick={onOpenPlanner} className="min-w-0 flex-1 text-left text-lg font-medium text-[var(--mb-muted)]">
        <span className="block truncate">{summary}</span>
      </button>
      <button type="button" onClick={onSearch} className="rounded-full bg-[linear-gradient(135deg,#8d12eb,#b641ff)] px-6 py-3 text-sm font-black text-white shadow-[var(--mb-shadow-strong)]">
        GO
      </button>
    </div>
  );
}

function StopPicker({ label, value, stops, onChange }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = stops.find((stop) => String(stop.id) === String(value)) || null;
  const displayValue = open ? query : selected?.name || query;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return stops.slice(0, 12);
    return stops.filter((stop) => stop.name.toLowerCase().includes(needle)).slice(0, 12);
  }, [query, stops]);

  return (
    <div className="space-y-2">
      <p className="text-[0.72rem] font-bold uppercase tracking-[0.24em] text-[var(--mb-muted)]">{label}</p>
      <div className="relative">
        <input
          className="w-full rounded-full border border-[var(--mb-border)] bg-white px-5 py-4 text-base font-medium text-[var(--mb-text)] outline-none transition focus:border-[var(--mb-purple)]"
          value={displayValue}
          placeholder={`Search ${label.toLowerCase()}`}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
        />
        {open ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 max-h-60 overflow-auto rounded-[24px] border border-[var(--mb-border)] bg-white p-2 shadow-[var(--mb-shadow)]">
            {filtered.length ? filtered.map((stop) => (
              <button
                key={stop.id}
                type="button"
                className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm font-medium text-[var(--mb-text)] transition hover:bg-[var(--mb-bg-alt)]"
                onMouseDown={() => {
                  onChange(String(stop.id));
                  setQuery(stop.name);
                  setOpen(false);
                }}
              >
                <span>{stop.name}</span>
                {String(selected?.id) === String(stop.id) ? <span className="text-xs font-bold text-[var(--mb-purple)]">Selected</span> : null}
              </button>
            )) : (
              <p className="px-3 py-3 text-sm text-[var(--mb-muted)]">No matching stops found.</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PlannerCard({
  stops,
  pickupStopId,
  dropStopId,
  selectionMode,
  onPickupChange,
  onDropChange,
  onMapPickMode,
  onFindRoutes,
  findingRoutes,
  mapPoints,
  pickupStop,
  dropStop,
  matchedTrips = [],
  selectedTripId,
  onSelectTrip,
  onDeclineTrip,
  onViewOccupancy,
  displayLine = [],
  showSubmit = true,
}) {
  const routeMatches = useMemo(
    () =>
      matchedTrips
        .map((trip, index) => {
          const bus = getBusPoint(trip, displayLine);
          if (!bus?.point) return null;
          return { trip, index, bus };
        })
        .filter(Boolean),
    [displayLine, matchedTrips],
  );

  const plannerPoints = useMemo(() => {
    const busPoints = routeMatches.map((item) => item.bus.point).filter(Boolean);
    return [...mapPoints, ...busPoints];
  }, [mapPoints, routeMatches]);

  return (
    <section className="space-y-5">
      <div className="relative overflow-hidden rounded-[2.25rem] bg-[#251d31] shadow-[var(--mb-shadow-strong)]">
        <div className="h-64">
          <MapContainer center={[28.2096, 83.9856]} zoom={13} scrollWheelZoom={false} className="h-full w-full">
            <TileLayer attribution="&copy; OpenStreetMap &copy; CARTO" url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <MapViewport points={plannerPoints} />
            {stops.map((stop) => {
              const point = toPoint(stop.lat, stop.lng);
              if (!point) return null;
              const isPickup = String(stop.id) === String(pickupStopId);
              const isDrop = String(stop.id) === String(dropStopId);
              return (
                <CircleMarker
                  key={stop.id}
                  center={point}
                  radius={isPickup || isDrop ? 9 : 5}
                  eventHandlers={{ click: () => onMapPickMode(selectionMode || (!pickupStopId ? "pickup" : "drop"), stop.id) }}
                  pathOptions={{
                    color: "#f8f3ff",
                    weight: isPickup || isDrop ? 2 : 1,
                    fillColor: isPickup ? "#6c12ff" : isDrop ? "#c548ff" : "#bca7ff",
                    fillOpacity: 1,
                  }}
                />
              );
            })}
            {routeMatches.map(({ trip, index, bus }) => (
              <Marker key={trip.id} position={bus.point} icon={createBusIcon({ label: routeCode(trip, index), heading: bus.heading })}>
                <Popup closeButton={false} offset={[0, -18]}>
                  <div className="min-w-[15rem] space-y-3 text-[var(--mb-text)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-[var(--mb-purple)]">Live Bus</p>
                        <p className="mt-1 text-lg font-black">{trip.bus_plate || routeCode(trip, index)}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.18em] ${String(selectedTripId) === String(trip.id) ? "bg-[var(--mb-purple)] text-white" : "bg-[var(--mb-bg-alt)] text-[var(--mb-purple)]"}`}>
                        {String(selectedTripId) === String(trip.id) ? "Selected" : "Match"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onViewOccupancy?.(trip);
                        }}
                        className="rounded-2xl bg-[var(--mb-bg-alt)] px-3 py-2 text-left transition hover:bg-[#f3e3f8]"
                      >
                        <p className="font-bold uppercase tracking-[0.16em] text-[var(--mb-muted)]">Occupancy</p>
                        <p className="mt-1 text-sm font-black text-[var(--mb-text)]">
                          {trip.occupancy_percent != null ? `${trip.occupancy_percent}% full` : trip.occupancy_label || "Live service"}
                        </p>
                      </button>
                      <div className="rounded-2xl bg-[var(--mb-bg-alt)] px-3 py-2">
                        <p className="font-bold uppercase tracking-[0.16em] text-[var(--mb-muted)]">ETA</p>
                        <p className="mt-1 text-sm font-black text-[var(--mb-text)]">{fmtEta(trip.eta)}</p>
                      </div>
                      <div className="rounded-2xl bg-[var(--mb-bg-alt)] px-3 py-2">
                        <p className="font-bold uppercase tracking-[0.16em] text-[var(--mb-muted)]">Fare</p>
                        <p className="mt-1 text-sm font-black text-[var(--mb-text)]">{fmtMoney(trip.fare_estimate || 50)}</p>
                      </div>
                      <div className="rounded-2xl bg-[var(--mb-bg-alt)] px-3 py-2">
                        <p className="font-bold uppercase tracking-[0.16em] text-[var(--mb-muted)]">Seats</p>
                        <p className="mt-1 text-sm font-black text-[var(--mb-text)]">{trip.open_seats ?? 0} open</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={trip.open_seats != null && trip.open_seats <= 0}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onSelectTrip?.(trip.id);
                        }}
                        className={`rounded-full px-4 py-2.5 text-sm font-black text-white ${trip.open_seats != null && trip.open_seats <= 0 ? "bg-[#dcc8e5] text-[#876f92]" : "bg-[linear-gradient(135deg,#8d12eb,#b641ff)] shadow-[var(--mb-shadow-strong)]"}`}
                      >
                        {trip.open_seats != null && trip.open_seats <= 0 ? "Full" : "Accept"}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onDeclineTrip?.(trip.id);
                        }}
                        className="rounded-full border border-[var(--mb-border)] bg-white px-4 py-2.5 text-sm font-black text-[var(--mb-text)]"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(30,18,57,0.08),rgba(30,18,57,0.32))]" />
        <button
          type="button"
          onClick={() => onMapPickMode(selectionMode || (!pickupStopId ? "pickup" : "drop"))}
          className="absolute bottom-5 right-5 rounded-full bg-white px-5 py-3 text-base font-black text-[var(--mb-purple)] shadow-[0_14px_30px_rgba(19,9,42,0.22)]"
        >
          <span className="inline-flex items-center gap-2">
            <Icon name="track" className="h-5 w-5" />
            Select from Map
          </span>
        </button>
      </div>

      <div className="rounded-[2rem] bg-[var(--mb-card-strong)] p-5 shadow-[var(--mb-shadow)]">
        <div className="flex items-center gap-4">
          <div className="flex min-h-[7rem] w-12 flex-col items-center justify-center">
            <span className="h-3.5 w-3.5 rounded-full bg-[var(--mb-purple)]" />
            <span className="h-10 border-l-2 border-[rgba(95,25,230,0.2)]" />
            <span className="grid h-3.5 w-3.5 place-items-center rounded-sm border-2 border-[var(--mb-purple)] bg-white" />
          </div>
          <div className="flex-1 space-y-3">
            <StopPicker label="Pickup point" value={pickupStopId} stops={stops} onChange={onPickupChange} />
            <StopPicker label="Drop point" value={dropStopId} stops={stops} onChange={onDropChange} />
          </div>
        </div>
      </div>

      {showSubmit ? (
        <div className="flex items-center justify-between gap-3 rounded-[24px] bg-[var(--mb-bg-alt)] p-4">
          <div>
            <p className="text-sm font-semibold text-[var(--mb-text)]">{pickupStop?.name || "Choose pickup"} to {dropStop?.name || "Choose destination"}</p>
            <p className="mt-1 text-xs text-[var(--mb-muted)]">Choose both points to see live buses and seat availability.</p>
          </div>
          <button type="button" onClick={onFindRoutes} disabled={findingRoutes} className="rounded-full bg-[linear-gradient(135deg,#8d12eb,#b641ff)] px-5 py-3 text-sm font-black text-white shadow-[var(--mb-shadow-strong)] disabled:opacity-60">
            {findingRoutes ? "Finding..." : "Find buses"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function QuickRouteCard({ icon, label, caption, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex w-[138px] flex-none flex-col items-center rounded-[36px] bg-[var(--mb-card-strong)] px-5 py-6 text-center shadow-[var(--mb-shadow)] transition hover:-translate-y-0.5">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-[#f3c5ee] text-[var(--mb-purple)]">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <p className="mt-4 text-xl font-bold text-[var(--mb-text)]">{label}</p>
      <p className="mt-1 text-xs text-[var(--mb-muted)]">{caption}</p>
    </button>
  );
}

export function NearbyMapCard({ stops, displayLine, selectedTrip, matchedTrips = [], selectedTripId, onSelectTrip }) {
  const routeMatches = useMemo(
    () =>
      matchedTrips
        .map((trip, index) => {
          const bus = getBusPoint(trip, displayLine);
          if (!bus?.point) return null;
          return { trip, index, bus };
        })
        .filter(Boolean),
    [displayLine, matchedTrips],
  );

  const points = useMemo(() => {
    const line = displayLine.length ? displayLine : stops.map((stop) => toPoint(stop.lat, stop.lng)).filter(Boolean);
    const busPoints = routeMatches.map((item) => item.bus.point).filter(Boolean);
    const merged = [...line, ...busPoints];
    return merged.length ? merged : [[28.2096, 83.9856]];
  }, [displayLine, routeMatches, stops]);

  return (
    <div className="overflow-hidden rounded-[38px] bg-[#24182c] shadow-[var(--mb-shadow-strong)]">
      <div className="relative h-56">
        <MapContainer center={points[0]} zoom={13} scrollWheelZoom={false} className="h-full w-full">
          <TileLayer attribution="&copy; OpenStreetMap &copy; CARTO" url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <MapViewport points={points} />
          {displayLine.length > 1 ? <Polyline positions={displayLine} pathOptions={{ color: "#c14cff", weight: 5, opacity: 0.9 }} /> : null}
          {stops.map((stop) => {
            const point = toPoint(stop.lat, stop.lng);
            if (!point) return null;
            return <CircleMarker key={stop.id} center={point} radius={6} pathOptions={{ color: "#f9d4fa", fillColor: "#b641ff", fillOpacity: 0.9 }} />;
          })}
          {routeMatches.map(({ trip, index, bus }) => (
            <Marker
              key={trip.id}
              position={bus.point}
              icon={createBusIcon({ label: routeCode(trip, index), heading: bus.heading })}
              eventHandlers={{ click: () => onSelectTrip?.(trip.id) }}
            />
          ))}
        </MapContainer>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(193,76,255,0.18),transparent_46%)]" />
        <div className="absolute right-4 top-4 rounded-full bg-white px-4 py-2 text-sm font-black text-[var(--mb-purple)]">LIVE</div>
        {matchedTrips.length ? (
          <div className="absolute left-4 top-4 rounded-full bg-white/90 px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--mb-purple)] shadow-[var(--mb-shadow)]">
            {matchedTrips.length} route match{matchedTrips.length !== 1 ? "es" : ""}
          </div>
        ) : null}
        <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-black/32 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
          <Icon name="pin" className="h-4 w-4" />
          {selectedTrip?.pickup_stop_name || stops[0]?.name || "Downtown Hub"} • {selectedTrip ? fmtEta(selectedTrip.eta) : "Nearby now"}
        </div>
        {selectedTripId && matchedTrips.length ? (
          <div className="absolute bottom-16 right-4 rounded-full bg-[linear-gradient(135deg,#8d12eb,#b641ff)] px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.18em] text-white shadow-[var(--mb-shadow-strong)]">
            Selected bus live
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function StopFeatureCard({ icon, eyebrow, title, featured = false }) {
  return (
    <div className={`min-h-[158px] rounded-[36px] p-5 shadow-[var(--mb-shadow)] ${featured ? "bg-[linear-gradient(135deg,#8d12eb,#b200ff)] text-white" : "bg-[var(--mb-card-strong)] text-[var(--mb-text)]"}`}>
      <div className={`grid h-10 w-10 place-items-center rounded-full ${featured ? "bg-white/18 text-white" : "bg-[#f7cdee] text-[var(--mb-purple)]"}`}>
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <p className={`mt-10 text-xs font-bold uppercase tracking-[0.24em] ${featured ? "text-white/70" : "text-[var(--mb-muted)]"}`}>{eyebrow}</p>
      <p className="mt-2 text-[1.65rem] font-black leading-tight">{title}</p>
    </div>
  );
}

export function LiveBusCard({ trip, index, active, onClick, now, onViewOccupancy }) {
  const tone = statusTone(trip, now);
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-4 rounded-[34px] border px-5 py-4 text-left shadow-[var(--mb-shadow)] transition ${active ? "border-transparent bg-[linear-gradient(180deg,#fff8fc,#f7dff6)] ring-2 ring-[rgba(141,18,235,0.18)]" : "border-[var(--mb-border)] bg-[var(--mb-card)]"}`}>
      <div className="grid h-16 w-16 flex-none place-items-center rounded-full bg-white text-[2rem] font-black text-[var(--mb-purple)]">
        {routeCode(trip, index)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xl font-black text-[var(--mb-text)]">{trip.route_name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--mb-muted)]">
          <span>Gate {trip.from_order || 1}</span>
          <span>•</span>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onViewOccupancy?.(trip);
            }}
            className="rounded-full bg-[var(--mb-bg-alt)] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-[var(--mb-purple)]"
          >
            {trip.occupancy_percent != null ? `${trip.occupancy_percent}% full` : trip.occupancy_label || "Live service"}
          </button>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[1.85rem] font-black leading-none text-[var(--mb-purple)]">{trip.eta?.minutes ? String(trip.eta.minutes).padStart(2, "0") : "--"}</p>
        <p className="mt-1 text-xs font-black uppercase tracking-[0.2em] text-[var(--mb-purple)]">MIN</p>
        <p className={`mt-2 text-sm font-black ${tone.color}`}>{tone.label}</p>
      </div>
    </button>
  );
}

export function SeatButton({ seat, selected, onClick }) {
  return (
    <button
      type="button"
      disabled={!seat.available}
      onClick={onClick}
      className={`rounded-[18px] border px-3 py-3 text-center text-xs font-black transition ${!seat.available ? "border-transparent bg-[#f4e3f1] text-[#c0a5c6] opacity-70" : selected ? "border-transparent bg-[linear-gradient(135deg,#8d12eb,#b641ff)] text-white shadow-[var(--mb-shadow-strong)]" : "border-[var(--mb-border)] bg-white text-[var(--mb-purple)]"}`}
    >
      <div>{seat.seat_no}</div>
      <div className="mt-1 text-[0.58rem] uppercase tracking-[0.24em]">{!seat.available ? "Taken" : selected ? "Selected" : "Open"}</div>
    </button>
  );
}

function buildPaymentOptions(total, walletSummary) {
  const options = [
    { label: "Cash", method: "CASH", note: "Pay onboard", disabled: false },
    { label: "eSewa", method: "ESEWA", note: "Online payment", disabled: false },
    { label: "Khalti", method: "KHALTI", note: "Online payment", disabled: false },
    {
      label: "Metro Wallet",
      method: "WALLET",
      note: walletSummary ? `${fmtMoney(walletSummary.balance)} available` : "Wallet balance unavailable",
      disabled: walletSummary ? Number(walletSummary.balance) < Number(total) : true,
    },
    {
      label: "Ride Pass",
      method: "PASS",
      note: walletSummary?.pass_active
        ? `${walletSummary.pass_plan_label || "Active pass"} • ${walletSummary.pass_rides_remaining} rides remaining`
        : "No active pass",
      disabled: !walletSummary?.pass_active,
    },
  ];
  if (walletSummary?.reward_free_ride_ready) {
    options.push({ label: "Free Ride", method: "REWARD", note: `${walletSummary.reward_points} reward points ready`, disabled: false });
  }
  return options;
}

export function OccupancySheet({ trip, seats = [], loading, onClose }) {
  if (!trip) return null;
  const openCount = seats.filter((seat) => seat.available).length;
  const totalSeats = trip.seats_total || seats.length || 0;
  const takenCount = totalSeats ? Math.max(totalSeats - openCount, 0) : 0;
  const occupancyPercent = trip.occupancy_percent != null
    ? trip.occupancy_percent
    : totalSeats
      ? Math.round((takenCount / totalSeats) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-[1400] bg-[rgba(49,23,56,0.3)] px-4 py-8 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full max-w-2xl items-center justify-center">
        <div className="w-full rounded-[36px] bg-[linear-gradient(180deg,#fffdfd,#fff1f9)] p-5 shadow-[0_36px_90px_rgba(141,18,235,0.24)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--mb-purple)]">Live Occupancy</p>
              <h3 className="mt-2 text-3xl font-black text-[var(--mb-text)]">{trip.bus_plate || "MetroBus"} • {trip.route_name}</h3>
              <p className="mt-2 text-sm font-medium text-[var(--mb-muted)]">
                {trip.pickup_stop_name || "Pickup"} to {trip.destination_stop_name || "Destination"}
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full bg-white px-4 py-2 text-sm font-black text-[var(--mb-purple)] shadow-[var(--mb-shadow)]">
              Close
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] bg-white px-4 py-4 shadow-[var(--mb-shadow)]">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--mb-muted)]">Occupancy</p>
              <p className="mt-2 text-3xl font-black text-[var(--mb-purple)]">{occupancyPercent}% full</p>
            </div>
            <div className="rounded-[24px] bg-white px-4 py-4 shadow-[var(--mb-shadow)]">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--mb-muted)]">Open Seats</p>
              <p className="mt-2 text-3xl font-black text-[var(--mb-text)]">{openCount}</p>
            </div>
            <div className="rounded-[24px] bg-white px-4 py-4 shadow-[var(--mb-shadow)]">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--mb-muted)]">Taken Seats</p>
              <p className="mt-2 text-3xl font-black text-[var(--mb-text)]">{takenCount}</p>
            </div>
          </div>

          <div className="mt-5 rounded-[28px] bg-[var(--mb-card)] p-4 shadow-[var(--mb-shadow)]">
            <div className="mb-3 flex flex-wrap gap-2 text-[0.68rem] font-black uppercase tracking-[0.18em]">
              <span className="rounded-full bg-white px-3 py-2 text-[var(--mb-purple)]">Open</span>
              <span className="rounded-full bg-[#f4e3f1] px-3 py-2 text-[#8d6f97]">Occupied</span>
            </div>
            {loading ? (
              <p className="py-6 text-center text-sm font-medium text-[var(--mb-muted)]">Loading occupancy details...</p>
            ) : seats.length ? (
              <div className="grid grid-cols-5 gap-3 sm:grid-cols-6">
                {seats.map((seat) => (
                  <div
                    key={seat.seat_id}
                    className={`rounded-[18px] border px-3 py-3 text-center text-xs font-black ${seat.available ? "border-[var(--mb-border)] bg-white text-[var(--mb-purple)]" : "border-transparent bg-[#f4e3f1] text-[#c0a5c6]"}`}
                  >
                    <div>{seat.seat_no}</div>
                    <div className="mt-1 text-[0.58rem] uppercase tracking-[0.24em]">{seat.available ? "Open" : "Taken"}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm font-medium text-[var(--mb-muted)]">Seat occupancy details are not available for this bus yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TicketQrCard({ booking, title = "Ride Ticket", compact = false }) {
  if (!booking) return null;
  const paymentLabel = booking.payment_method || booking.payment?.method || "UNPAID";
  const paymentStatus = booking.payment_status || booking.payment?.status || "UNPAID";
  const boardingStatus = booking.completed_at ? "Completed" : booking.checked_in_at ? "Onboard" : "Ready to board";
  return (
    <div className={`space-y-5 ${compact ? "" : ""}`}>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--mb-purple)]">{title}</p>
        <h3 className="mt-3 text-[2.35rem] font-black leading-[0.96] tracking-[-0.04em] text-[var(--mb-text)]">Your Ride Ticket</h3>
        <p className="mt-3 text-[1.05rem] leading-8 text-[var(--mb-muted)]">Show this QR code to the driver upon boarding.</p>
      </div>

      <div className="relative overflow-hidden rounded-[2.25rem] bg-white px-5 py-6 shadow-[var(--mb-shadow)]">
        <div className="absolute inset-x-6 top-10 h-px bg-[radial-gradient(circle,rgba(95,25,230,0.28)_1px,transparent_1px)] bg-[size:12px_1px] opacity-70" />
        <div className="absolute inset-x-6 bottom-40 h-px bg-[radial-gradient(circle,rgba(95,25,230,0.28)_1px,transparent_1px)] bg-[size:12px_1px] opacity-70" />
        <div className="mx-auto max-w-[16rem] rounded-[2rem] bg-[#faf8ff] p-4 shadow-[0_18px_34px_rgba(88,43,171,0.1)]">
          <div className="overflow-hidden rounded-[1.5rem] bg-white p-4">
            {booking.ticket_qr_svg ? (
              <div className="[&_svg]:h-full [&_svg]:w-full [&_svg]:max-h-[15rem]" dangerouslySetInnerHTML={{ __html: booking.ticket_qr_svg }} />
            ) : (
              <div className="grid h-52 place-items-center rounded-[20px] bg-[var(--mb-bg-alt)] text-sm font-medium text-[var(--mb-muted)]">
                QR is being prepared.
              </div>
            )}
          </div>
        </div>
        <p className="mt-6 text-center text-[1.05rem] font-black uppercase tracking-[0.22em] text-[var(--mb-purple)]">{booking.ticket_code}</p>
      </div>

      <div className="rounded-[2.2rem] bg-white px-6 py-6 shadow-[var(--mb-shadow)]">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--mb-muted)]">Passenger</p>
            <p className="mt-2 text-[1.9rem] font-black leading-tight text-[var(--mb-text)]">{booking.passenger_name || "MetroBus Passenger"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--mb-muted)]">Seat Number</p>
            <p className="mt-2 text-[1.9rem] font-black leading-tight text-[var(--mb-text)]">{(booking.seat_labels || []).join(", ") || "--"}</p>
          </div>
        </div>

        <div className="mt-7 space-y-6">
          <div className="flex gap-4">
            <div className="mt-1 flex flex-col items-center">
              <span className="h-3.5 w-3.5 rounded-full bg-[var(--mb-purple)]" />
              <span className="h-10 border-l-2 border-[rgba(95,25,230,0.2)]" />
              <span className="h-3.5 w-3.5 rounded-full border-2 border-[var(--mb-purple)] bg-white" />
            </div>
            <div className="space-y-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--mb-muted)]">Pickup</p>
                <p className="mt-2 text-[1.55rem] font-black leading-tight text-[var(--mb-text)]">{booking.pickup_stop_name}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--mb-muted)]">Drop</p>
                <p className="mt-2 text-[1.55rem] font-black leading-tight text-[var(--mb-text)]">{booking.destination_stop_name}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--mb-muted)]">Bus Info</p>
              <p className="mt-2 text-[1.45rem] font-black leading-tight text-[var(--mb-text)]">{booking.bus_plate}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--mb-muted)]">Total Fare</p>
              <p className="mt-2 text-[1.7rem] font-black leading-tight text-[var(--mb-purple)]">{fmtMoney(booking.fare_total)}</p>
            </div>
          </div>

          <div className="grid gap-3 rounded-[1.5rem] bg-[var(--mb-card-strong)] px-4 py-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--mb-muted)]">Payment</p>
              <p className="mt-2 text-base font-black text-[var(--mb-text)]">{paymentLabel}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--mb-muted)]">Status</p>
              <p className="mt-2 text-base font-black text-[var(--mb-purple)]">{paymentStatus} • {boardingStatus}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReservationBuilder({ trip, seats, selectedSeatIds, onSeatToggle, onBook, onPay, bookingBusy, paymentBusy, loadingSeats, lastBookingId, lastBookingSummary, walletSummary, pickupStop, dropStop }) {
  const selectedLabels = seats.filter((seat) => selectedSeatIds.includes(seat.seat_id)).map((seat) => seat.seat_no);
  const openSeatCount = seats.filter((seat) => seat.available).length;
  const total = lastBookingSummary?.fare_total || ((trip?.fare_estimate || 50) * selectedSeatIds.length);
  const paymentOptions = buildPaymentOptions(total, walletSummary);
  if (!trip) return null;
  return (
    <section className="space-y-5">
      <div className="rounded-[2.2rem] bg-white px-5 py-5 shadow-[var(--mb-shadow)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--mb-muted)]">Selected Route</p>
            <h3 className="mt-2 text-[2.1rem] font-black leading-[0.96] text-[var(--mb-text)]">{trip.route_name || trip.bus_plate || "MetroBus"}</h3>
          </div>
          <div className="rounded-full bg-[var(--mb-bg-alt)] px-4 py-2 text-base font-black text-[var(--mb-purple)]">
            ETA: {trip.eta?.minutes ? `${trip.eta.minutes} Mins` : "Live"}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-[auto_1fr_auto_1fr] items-center gap-3 text-[1.1rem] font-medium text-[var(--mb-text)]">
          <Icon name="track" className="h-5 w-5 text-[var(--mb-purple)]" />
          <span>{pickupStop?.name || "Pickup"}</span>
          <span className="text-[var(--mb-muted)]">→</span>
          <span>{dropStop?.name || "Drop"}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-5">
          <h3 className="text-[2rem] font-black tracking-[-0.03em] text-[var(--mb-text)]">Select Seats</h3>
          <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-[var(--mb-text)]">
            <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded border border-[var(--mb-border)] bg-white" />Open</span>
            <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded bg-[#e3e0ee]" />Taken</span>
            <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded bg-[var(--mb-purple)]" />Selected</span>
          </div>
        </div>

        {loadingSeats ? <p className="text-sm text-[var(--mb-muted)]">Loading seat map...</p> : null}
        {!loadingSeats && !seats.length ? (
          <div className="rounded-[26px] border border-dashed border-[var(--mb-border)] bg-white px-4 py-5 text-sm font-medium text-[var(--mb-muted)]">
            Seat map is not ready for this bus yet. Try refreshing the search or picking another live bus.
          </div>
        ) : null}
        {!loadingSeats && seats.length ? (
          <div className="overflow-hidden rounded-[2.2rem] bg-[var(--mb-card-strong)] px-4 pt-6 shadow-[var(--mb-shadow)]">
            <div className="mx-auto mb-5 h-2 w-20 rounded-full bg-[rgba(145,123,194,0.18)]" />
            <div className="grid grid-cols-5 gap-3">
              {seats.map((seat, index) => (
                <div key={seat.seat_id} className={index % 5 === 2 ? "pl-2" : ""}>
                  <SeatButton seat={seat} selected={selectedSeatIds.includes(seat.seat_id)} onClick={() => onSeatToggle(seat.seat_id)} />
                </div>
              ))}
            </div>
            {!openSeatCount ? (
              <div className="mt-4 rounded-[24px] bg-[#f9ecf6] px-4 py-3 text-sm font-medium text-[var(--mb-muted)]">
                This bus has no open seats left for the selected segment right now.
              </div>
            ) : null}
            <div className="mt-6 rounded-t-[2rem] bg-white px-5 py-5 shadow-[0_-10px_30px_rgba(95,25,230,0.08)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--mb-muted)]">Your Selection</p>
                  <p className="mt-2 text-[1.9rem] font-black leading-tight text-[var(--mb-text)]">Seats: {selectedLabels.join(", ") || "--"}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--mb-muted)]">Total Fare</p>
                  <p className="mt-2 text-[2.1rem] font-black leading-tight text-[var(--mb-purple)]">{fmtMoney(total)}</p>
                </div>
              </div>
              <button type="button" onClick={onBook} disabled={bookingBusy || !selectedSeatIds.length} className="mt-5 w-full rounded-full bg-[linear-gradient(135deg,#8d12eb,#b641ff)] px-6 py-4 text-[1.05rem] font-black text-white shadow-[var(--mb-shadow-strong)] disabled:opacity-60">
                {bookingBusy ? "Confirming..." : "Confirm Booking"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {lastBookingId ? (
        <div className="mt-4 space-y-3">
          <TicketQrCard booking={lastBookingSummary} title="Step 2" />
          <div className="rounded-[24px] bg-[linear-gradient(135deg,#fff,#f8e5fb)] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--mb-purple)]">Choose Payment</p>
            <p className="mt-2 text-sm text-[var(--mb-muted)]">
              Booking #{lastBookingId} is ready. Choose cash, Nepali gateways, your MetroBus wallet, an active ride pass, or redeem reward points for a free ride.
            </p>
          </div>
          {walletSummary ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] bg-white px-4 py-4 shadow-[var(--mb-shadow)]">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--mb-muted)]">Wallet Balance</p>
                <p className="mt-2 text-2xl font-black text-[var(--mb-text)]">{fmtMoney(walletSummary.balance)}</p>
              </div>
              <div className="rounded-[24px] bg-white px-4 py-4 shadow-[var(--mb-shadow)]">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--mb-muted)]">Ride Pass</p>
                <p className="mt-2 text-2xl font-black text-[var(--mb-text)]">
                  {walletSummary.pass_active ? `${walletSummary.pass_rides_remaining} rides left` : "Inactive"}
                </p>
              </div>
              <div className="rounded-[24px] bg-white px-4 py-4 shadow-[var(--mb-shadow)]">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--mb-muted)]">Reward Points</p>
                <p className="mt-2 text-2xl font-black text-[var(--mb-text)]">{walletSummary.reward_points}</p>
              </div>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            {paymentOptions.map((option) => (
              <button
                key={option.method}
                type="button"
                onClick={() => onPay(option.method)}
                disabled={paymentBusy || option.disabled}
                className={`rounded-[24px] border px-4 py-4 text-left text-sm font-black shadow-[var(--mb-shadow)] disabled:opacity-60 ${option.disabled ? "border-[var(--mb-border)] bg-[#f5edf7] text-[var(--mb-muted)]" : "border-[var(--mb-border)] bg-white text-[var(--mb-purple)]"}`}
              >
                <span className="block text-base">{paymentBusy ? "Processing..." : option.label}</span>
                <span className="mt-1 block text-xs font-semibold text-[var(--mb-muted)]">{option.note}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function PaymentRequestCard({ booking, walletSummary, paymentBusy, onPay }) {
  if (!booking) return null;
  const paymentOptions = buildPaymentOptions(booking.fare_total, walletSummary);
  const waitingForCash = booking.payment_method === "CASH" && booking.payment_pending_verification;
  const waitingForGateway = booking.payment_pending_verification && booking.payment_method && booking.payment_method !== "CASH";

  return (
    <div className="rounded-[34px] bg-[linear-gradient(180deg,#fff,#f8e5fb)] p-5 shadow-[var(--mb-shadow)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--mb-purple)]">Helper Payment Request</p>
          <h3 className="mt-2 text-2xl font-black text-[var(--mb-text)]">Booking #{booking.id} is ready for payment</h3>
          <p className="mt-2 text-sm font-medium text-[var(--mb-muted)]">
            {booking.payment_requested_by_name
              ? `${booking.payment_requested_by_name} scanned or loaded your ticket and is waiting for your payment choice.`
              : "Your helper scanned or loaded the ticket and is waiting for your payment choice."}
          </p>
        </div>
        <div className="rounded-full bg-white px-4 py-2 text-sm font-black text-[var(--mb-purple)] shadow-[var(--mb-shadow)]">
          {fmtMoney(booking.fare_total)}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[24px] bg-white px-4 py-4 shadow-[var(--mb-shadow)]">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--mb-muted)]">Route</p>
          <p className="mt-2 text-lg font-black text-[var(--mb-text)]">{booking.route_name}</p>
        </div>
        <div className="rounded-[24px] bg-white px-4 py-4 shadow-[var(--mb-shadow)]">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--mb-muted)]">Seat</p>
          <p className="mt-2 text-lg font-black text-[var(--mb-text)]">{(booking.seat_labels || []).join(", ") || "--"}</p>
        </div>
        <div className="rounded-[24px] bg-white px-4 py-4 shadow-[var(--mb-shadow)]">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--mb-muted)]">Payment State</p>
          <p className="mt-2 text-lg font-black text-[var(--mb-purple)]">{booking.payment_status}</p>
        </div>
      </div>

      {booking.needs_payment_selection ? (
        <>
          <p className="mt-5 text-sm font-medium text-[var(--mb-muted)]">
            Choose how you want to pay before boarding. Cash stays pending until the helper confirms collection.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {paymentOptions.map((option) => (
              <button
                key={option.method}
                type="button"
                onClick={() => onPay(option.method, booking.id)}
                disabled={paymentBusy || option.disabled}
                className={`rounded-[24px] border px-4 py-4 text-left text-sm font-black shadow-[var(--mb-shadow)] disabled:opacity-60 ${option.disabled ? "border-[var(--mb-border)] bg-[#f5edf7] text-[var(--mb-muted)]" : "border-[var(--mb-border)] bg-white text-[var(--mb-purple)]"}`}
              >
                <span className="block text-base">{paymentBusy ? "Processing..." : option.label}</span>
                <span className="mt-1 block text-xs font-semibold text-[var(--mb-muted)]">{option.note}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {waitingForCash ? (
        <div className="mt-5 rounded-[24px] bg-white px-4 py-4 text-sm font-medium text-[var(--mb-muted)] shadow-[var(--mb-shadow)]">
          Cash selected. Please hand the fare to the helper so they can verify and mark you boarded.
        </div>
      ) : null}

      {waitingForGateway ? (
        <div className="mt-5 rounded-[24px] bg-white px-4 py-4 text-sm font-medium text-[var(--mb-muted)] shadow-[var(--mb-shadow)]">
          Your payment is being processed. Keep MetroBus open until the status changes.
        </div>
      ) : null}
    </div>
  );
}

export function TrackMap({ trip, displayLine, now }) {
  const busLocation = getBusPoint(trip, displayLine);
  const points = displayLine.length ? displayLine : (busLocation ? [busLocation.point] : [[28.2096, 83.9856]]);
  const distanceValue = trip?.pickup_point && busLocation?.point ? distKm(busLocation.point, trip.pickup_point).toFixed(1) : "3.0";
  return (
    <div className="relative overflow-hidden rounded-[2.3rem] bg-[#2b1d30] shadow-[var(--mb-shadow-strong)]">
      <div className="h-[37rem]">
        <MapContainer center={points[0]} zoom={13} scrollWheelZoom={false} className="h-full w-full">
          <TileLayer attribution="&copy; OpenStreetMap &copy; CARTO" url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          <MapViewport points={points} />
          {displayLine.length > 1 ? <Polyline positions={displayLine} pathOptions={{ color: "#7f2fff", weight: 5, dashArray: "10 10", opacity: 0.9 }} /> : null}
          {busLocation ? <Marker position={busLocation.point} icon={createBusIcon({ label: trip.bus_plate || "Bus", heading: busLocation.heading })} /> : null}
        </MapContainer>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(247,240,255,0.12),rgba(247,240,255,0.26))]" />
      <div className="absolute left-5 right-5 top-5 rounded-[2.2rem] bg-white px-6 py-5 shadow-[0_18px_34px_rgba(30,18,57,0.12)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--mb-muted)]">Current Journey</p>
            <p className="mt-2 max-w-[12rem] text-[2rem] font-black leading-[1.02] text-[var(--mb-purple)]">{trip?.route_name || "Route 04: Lakeside Express"}</p>
          </div>
          <div className="rounded-full bg-[var(--mb-bg-alt)] px-4 py-2 text-[1.1rem] font-black text-[var(--mb-purple)]">
            LIVE
          </div>
        </div>
      </div>

      <div className="absolute left-4 right-4 top-40 grid grid-cols-3 gap-3">
        <div className="rounded-full bg-white p-5 text-center shadow-[0_18px_32px_rgba(30,18,57,0.12)]">
          <Icon name="seat" className="mx-auto h-6 w-6 text-[var(--mb-purple)]" />
          <p className="mt-4 text-sm text-[var(--mb-muted)]">Available</p>
          <p className="mt-1 text-[2rem] font-black text-[var(--mb-text)]">{trip?.open_seats ?? 12}</p>
        </div>
        <div className="rounded-full bg-white p-5 text-center shadow-[0_18px_32px_rgba(30,18,57,0.12)]">
          <Icon name="snow" className="mx-auto h-6 w-6 text-[var(--mb-purple)]" />
          <p className="mt-4 text-sm text-[var(--mb-muted)]">Climate</p>
          <p className="mt-1 text-[2rem] font-black text-[var(--mb-text)]">22°C</p>
        </div>
        <div className="rounded-full bg-white p-5 text-center shadow-[0_18px_32px_rgba(30,18,57,0.12)]">
          <Icon name="bell" className="mx-auto h-6 w-6 text-[var(--mb-purple)]" />
          <p className="mt-4 text-sm text-[var(--mb-muted)]">ETA</p>
          <p className="mt-1 text-[2rem] font-black text-[var(--mb-text)]">{trip?.eta?.minutes || 4} Mins</p>
        </div>
      </div>

      <div className="absolute left-1/2 top-[18rem] -translate-x-1/2 rounded-full bg-[linear-gradient(135deg,#6017eb,#8f30ff)] px-5 py-3 text-center text-xl font-black text-white shadow-[var(--mb-shadow-strong)]">
        Bus {routeCode(trip, 0)}
      </div>

      <div className="absolute right-8 top-[10.5rem] rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--mb-purple)] shadow-[var(--mb-shadow)]">
        {statusTone(trip, now).label}
      </div>
      <div className="absolute right-8 top-[17.5rem] rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--mb-purple)] shadow-[var(--mb-shadow)]">
        {distanceValue} km away
      </div>
    </div>
  );
}

export function DriverCard({ trip, onShare, onSos }) {
  return (
    <div className="rounded-[2.2rem] bg-white p-5 shadow-[var(--mb-shadow)]">
      <div className="flex items-center gap-4">
        <PassengerAvatar user={{ full_name: trip?.driver_name || "Driver" }} size="h-16 w-16" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[1.95rem] font-black leading-tight text-[var(--mb-text)]">{trip?.driver_name || "Arjun Thapa"}</p>
          <p className="mt-1 text-lg font-medium text-[var(--mb-muted)]">Certified Senior Captain</p>
          <p className="mt-2 text-lg font-semibold text-[var(--mb-text)]">4.9 <span className="text-[var(--mb-muted)]">(1.2k reviews)</span></p>
        </div>
        <div className="rounded-[1.5rem] bg-[var(--mb-bg-alt)] px-4 py-4 text-right">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--mb-muted)]">Bus</p>
          <p className="mt-2 text-[1.45rem] font-black leading-tight text-[var(--mb-purple)]">{trip?.bus_plate || "BA-2-KHA 4421"}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-[var(--mb-border)] pt-5">
        <button type="button" onClick={onShare} className="flex flex-col items-center gap-2 rounded-[1.6rem] px-4 py-4 text-[var(--mb-text)]">
          <Icon name="share" className="h-6 w-6" />
          <span className="text-sm font-black uppercase tracking-[0.14em]">Share Trip</span>
        </button>
        <button type="button" className="flex flex-col items-center gap-2 rounded-[1.6rem] px-4 py-4 text-[var(--mb-text)]">
          <Icon name="chat" className="h-6 w-6" />
          <span className="text-sm font-black uppercase tracking-[0.14em]">Chat</span>
        </button>
        <button type="button" onClick={onSos} className="flex flex-col items-center gap-2 rounded-[1.6rem] bg-[#fff4f2] px-4 py-4 text-[var(--mb-danger)]">
          <Icon name="alert" className="h-6 w-6" />
          <span className="text-sm font-black uppercase tracking-[0.14em]">SOS</span>
        </button>
      </div>
    </div>
  );
}

export function MetricCard({ icon, label, value }) {
  return (
    <div className="rounded-[34px] bg-[var(--mb-card-strong)] p-5 shadow-[var(--mb-shadow)]">
      <div className="text-[var(--mb-purple)]"><Icon name={icon} className="h-7 w-7" /></div>
      <p className="mt-7 text-sm font-bold uppercase tracking-[0.2em] text-[var(--mb-muted)]">{label}</p>
      <p className="mt-2 text-4xl font-black text-[var(--mb-text)]">{value}</p>
    </div>
  );
}

export function ReservationCard({ booking, onReschedule, onViewTicket }) {
  if (!booking) return null;
  return (
    <div className="rounded-[42px] bg-[var(--mb-card-strong)] p-6 shadow-[var(--mb-shadow)]">
      <div className="flex items-start justify-between gap-4">
        <span className="rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[var(--mb-purple)]">Express Route</span>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--mb-muted)]">Fare</p>
          <p className="mt-2 text-3xl font-black text-[var(--mb-purple)]">{fmtMoney(booking.fare_total)}</p>
        </div>
      </div>
      <div className="mt-6 flex items-end gap-3">
        <p className="text-6xl font-black leading-none text-[var(--mb-text)]">{fmtTime(booking.created_at)}</p>
        <p className="pb-2 text-3xl font-medium text-[var(--mb-text)]">Today</p>
      </div>
      <div className="mt-6 space-y-5">
        <div className="flex gap-4">
          <div className="mt-1 flex flex-col items-center">
            <span className="h-4 w-4 rounded-full border-4 border-[var(--mb-purple)] bg-white" />
            <span className="h-10 border-l border-dashed border-[rgba(141,18,235,0.25)]" />
            <span className="h-4 w-4 rounded-full border-4 border-[var(--mb-muted)] bg-white" />
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--mb-muted)]">Pickup</p>
              <p className="mt-1 text-3xl font-black text-[var(--mb-text)]">{booking.pickup_stop_name}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--mb-muted)]">Destination</p>
              <p className="mt-1 text-3xl font-black text-[var(--mb-text)]">{booking.destination_stop_name}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-7 grid grid-cols-2 gap-4">
        <button type="button" onClick={onReschedule} className="rounded-full bg-white px-6 py-4 text-lg font-black text-[var(--mb-text)]">
          Reschedule
        </button>
        <button type="button" onClick={onViewTicket} className="rounded-full bg-[linear-gradient(135deg,#8d12eb,#b641ff)] px-6 py-4 text-lg font-black text-white shadow-[var(--mb-shadow-strong)]">
          View Ticket
        </button>
      </div>
    </div>
  );
}

export function HistoryCard({ booking, onDownload }) {
  return (
    <div className="rounded-[32px] bg-white p-5 shadow-[var(--mb-shadow)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-[var(--mb-bg-alt)] text-[var(--mb-purple)]">
            <Icon name="track" />
          </div>
          <div>
            <p className="text-2xl font-black text-[var(--mb-text)]">{fmtDate(booking.created_at)}</p>
            <p className="mt-1 text-sm text-[var(--mb-muted)]">Ride ID: #MB{booking.id}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-[var(--mb-text)]">{fmtMoney(booking.fare_total)}</p>
          <p className="mt-1 text-sm font-black text-[var(--mb-purple)]">{booking.status}</p>
        </div>
      </div>
      <div className="mt-5 border-t border-[var(--mb-border)] pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xl font-semibold italic text-[var(--mb-text)]">{booking.pickup_stop_name} to {booking.destination_stop_name}</p>
          <button type="button" onClick={onDownload} className="inline-flex items-center gap-2 text-lg font-black text-[var(--mb-purple)]">
            <Icon name="download" className="h-5 w-5" />
            Download Invoice
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProfileCard({ user, profileForm, setProfileForm, onSave, profileBusy }) {
  return (
    <div className="rounded-[40px] bg-[var(--mb-card)] p-6 text-center shadow-[var(--mb-shadow)]">
      <div className="relative mx-auto w-fit">
        <PassengerAvatar user={user} size="h-28 w-28" />
        <button type="button" className="absolute bottom-0 right-0 grid h-12 w-12 place-items-center rounded-full bg-[linear-gradient(135deg,#8d12eb,#b641ff)] text-white shadow-[var(--mb-shadow-strong)]">
          <Icon name="edit" />
        </button>
      </div>
      <h2 className="mt-6 text-5xl font-black text-[var(--mb-text)]">{profileForm.full_name || user?.full_name || "MetroBus Rider"}</h2>
      <p className="mt-2 text-2xl text-[var(--mb-muted)]">{user?.email || "Add your email"}</p>
      <div className="mt-6 flex items-center justify-center gap-10">
        <span className="text-sm font-black uppercase tracking-[0.22em] text-[var(--mb-purple)]">{user?.is_corporate_employee ? "PRO MEMBER" : "CITY RIDER"}</span>
        <span className="text-xl font-black text-[var(--mb-purple)]">4.9 star</span>
      </div>
      <div className="mt-6 grid gap-3 text-left md:grid-cols-2">
        <input className="rounded-[22px] border border-[var(--mb-border)] bg-white px-4 py-3 text-sm font-medium text-[var(--mb-text)] outline-none" value={profileForm.full_name} onChange={(event) => setProfileForm((current) => ({ ...current, full_name: event.target.value }))} placeholder="Full name" />
        <input className="rounded-[22px] border border-[var(--mb-border)] bg-white px-4 py-3 text-sm font-medium text-[var(--mb-muted)] outline-none opacity-70" value={user?.phone || ""} readOnly />
        <input className="md:col-span-2 rounded-[22px] border border-[var(--mb-border)] bg-white px-4 py-3 text-sm font-medium text-[var(--mb-text)] outline-none" value={profileForm.email} onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" />
      </div>
      <button type="button" onClick={onSave} disabled={profileBusy} className="mt-5 rounded-full bg-[linear-gradient(135deg,#8d12eb,#b641ff)] px-8 py-4 text-base font-black text-white shadow-[var(--mb-shadow-strong)] disabled:opacity-60">
        {profileBusy ? "Saving..." : "Save Profile"}
      </button>
    </div>
  );
}

export function PaymentShowcase({ latestPaidBooking, walletSummary, passPlans = [], onTopUp, onBuyPass, actionBusy }) {
  const activePlanCode = walletSummary?.pass_plan || "";
  const passLabel = walletSummary?.pass_active
    ? `${walletSummary.pass_rides_remaining} of ${walletSummary.pass_total_rides || walletSummary.pass_rides_remaining} rides left`
    : walletSummary?.pass_valid_until
      ? `Expired ${fmtDate(walletSummary.pass_valid_until)}`
      : "No pass active";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-3xl font-black text-[var(--mb-text)]">Payment Methods</h3>
        <button type="button" onClick={onTopUp} disabled={actionBusy} className="text-lg font-black text-[var(--mb-purple)] disabled:opacity-60">Top Up +500</button>
      </div>
      <div className="rounded-[36px] bg-[linear-gradient(135deg,#8d12eb,#c243ff)] p-6 text-white shadow-[var(--mb-shadow-strong)]">
        <div className="flex items-center justify-between">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-[var(--mb-purple)]">
            <Icon name="wallet" />
          </div>
          <p className="text-2xl font-black uppercase tracking-[0.2em]">Metro Wallet</p>
        </div>
        <p className="mt-8 text-sm font-bold uppercase tracking-[0.24em] text-white/70">Passenger account</p>
        <p className="mt-2 text-4xl font-black">{walletSummary ? fmtMoney(walletSummary.balance) : "NPR 0"}</p>
        <div className="mt-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">Lifetime Points</p>
            <p className="mt-2 text-2xl font-black uppercase">{walletSummary?.lifetime_reward_points || 0}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">Reward Points</p>
            <p className="mt-2 text-2xl font-black">{walletSummary?.reward_points || 0}</p>
          </div>
        </div>
        <p className="mt-6 text-sm font-medium text-white/80">
          Pay rides from your MetroBus wallet and earn reward points toward a free ride.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[30px] bg-[var(--mb-card-strong)] p-5 shadow-[var(--mb-shadow)]">
          <div className="text-[var(--mb-purple)]"><Icon name="wallet" className="h-7 w-7" /></div>
          <p className="mt-7 text-sm font-bold uppercase tracking-[0.2em] text-[var(--mb-muted)]">Ride Pass</p>
          <p className="mt-2 text-4xl font-black text-[var(--mb-purple)]">{walletSummary?.pass_active ? (walletSummary.pass_plan_label || "Active pass") : passLabel}</p>
          <p className="mt-3 text-sm font-medium text-[var(--mb-muted)]">
            {walletSummary?.pass_active
              ? `${passLabel} • valid until ${fmtDate(walletSummary.pass_valid_until)}`
              : "Choose a weekly, monthly, or flexible ride pass for regular travel."}
          </p>
          <div className="mt-4 grid gap-3">
            {passPlans.map((plan) => {
              const isActive = walletSummary?.pass_active && activePlanCode === plan.code;
              return (
                <button
                  key={plan.code}
                  type="button"
                  onClick={() => onBuyPass(plan.code)}
                  disabled={actionBusy}
                  className={`rounded-[24px] border px-4 py-4 text-left shadow-[var(--mb-shadow)] transition disabled:opacity-60 ${
                    isActive
                      ? "border-[rgba(141,18,235,0.18)] bg-white"
                      : "border-transparent bg-white/80 hover:border-[rgba(141,18,235,0.14)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-[var(--mb-text)]">{plan.label}</p>
                      <p className="mt-1 text-sm font-medium text-[var(--mb-muted)]">{plan.summary}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                      isActive
                        ? "bg-[linear-gradient(135deg,#8d12eb,#b641ff)] text-white"
                        : "bg-[var(--mb-bg-alt)] text-[var(--mb-purple)]"
                    }`}>
                      {isActive ? "Active" : "Choose"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--mb-purple)]">
                    <span className="rounded-full bg-[var(--mb-bg-alt)] px-3 py-2">{plan.rides_count} rides</span>
                    <span className="rounded-full bg-[var(--mb-bg-alt)] px-3 py-2">{plan.validity_days} days</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="rounded-[30px] bg-white p-5 shadow-[var(--mb-shadow)]">
          <div className="text-[var(--mb-purple)]"><Icon name="track" className="h-7 w-7" /></div>
          <p className="mt-7 text-sm font-bold uppercase tracking-[0.2em] text-[var(--mb-muted)]">Free Ride Progress</p>
          <p className="mt-2 text-3xl font-black text-[var(--mb-text)]">{walletSummary?.reward_free_ride_ready ? "Ready to redeem" : `${walletSummary?.reward_points_needed || 100} pts to go`}</p>
          <p className="mt-3 text-sm font-medium text-[var(--mb-muted)]">
            {walletSummary?.reward_free_ride_ready
              ? "Use Reward Ride during checkout on your next booking."
              : `Last payment: ${paymentHandle(latestPaidBooking)}`}
          </p>
        </div>
      </div>
    </div>
  );
}

export function CancellationSheet({
  booking,
  reasons,
  reason,
  note,
  busy,
  onReasonChange,
  onNoteChange,
  onConfirm,
  onClose,
}) {
  if (!booking) return null;
  return (
    <div className="rounded-[34px] border border-[var(--mb-border)] bg-white p-5 shadow-[var(--mb-shadow)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--mb-purple)]">Cancel Ride</p>
          <h3 className="mt-2 text-3xl font-black text-[var(--mb-text)]">Confirm cancellation</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--mb-muted)]">
            Choose the reason for cancelling Booking #{booking.id}. This will release your reserved seats immediately.
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full bg-[var(--mb-bg-alt)] px-3 py-2 text-xs font-black text-[var(--mb-purple)]">
          Close
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <div className="grid gap-2">
          {reasons.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onReasonChange(item.value)}
              className={`rounded-[24px] border px-4 py-3 text-left text-sm font-bold transition ${
                reason === item.value
                  ? "border-transparent bg-[linear-gradient(135deg,#8d12eb,#b641ff)] text-white shadow-[var(--mb-shadow-strong)]"
                  : "border-[var(--mb-border)] bg-[var(--mb-card-soft)] text-[var(--mb-text)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {reason === "OTHER" ? (
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--mb-muted)]">Short note</span>
            <textarea
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Tell MetroBus why you need to cancel."
              className="min-h-[7rem] w-full rounded-[24px] border border-[var(--mb-border)] bg-[var(--mb-card-soft)] px-4 py-4 text-sm font-medium text-[var(--mb-text)] outline-none transition focus:border-[var(--mb-purple)]"
            />
          </label>
        ) : null}

        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || !reason}
          className="w-full rounded-full bg-[#b1002b] px-6 py-4 text-lg font-black text-white shadow-[0_16px_32px_rgba(177,0,43,0.22)] disabled:opacity-60"
        >
          {busy ? "Cancelling..." : "Confirm Cancellation"}
        </button>
      </div>
    </div>
  );
}

export function SettingsRow({ icon, title, description, trailing }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[28px] bg-[var(--mb-card)] px-5 py-4 shadow-[var(--mb-shadow)]">
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-[var(--mb-bg-alt)] text-[var(--mb-purple)]">
          <Icon name={icon} />
        </div>
        <div>
          <p className="text-2xl font-black text-[var(--mb-text)]">{title}</p>
          {description ? <p className="mt-1 text-sm text-[var(--mb-muted)]">{description}</p> : null}
        </div>
      </div>
      {trailing || <Icon name="chevron" className="h-6 w-6 text-[var(--mb-muted)]" />}
    </div>
  );
}

export function BottomNav({ activeView, onChange }) {
  const tabs = [
    { id: "home", label: "Home", icon: "home" },
    { id: "track", label: "Track", icon: "track" },
    { id: "rides", label: "My Rides", icon: "rides" },
    { id: "profile", label: "Profile", icon: "profile" },
  ];
  return (
    <div className="fixed inset-x-0 bottom-0 z-[1200] bg-[color:var(--mb-nav)]/92 px-4 pb-4 pt-3 backdrop-blur-xl">
      <div className="mx-auto max-w-[28rem] rounded-[2rem] bg-white px-3 py-3 shadow-[0_-8px_40px_rgba(95,25,230,0.12)]">
        <div className="grid grid-cols-4 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`rounded-[1.65rem] px-2 py-3 text-center transition ${activeView === tab.id ? "bg-[var(--mb-bg-alt)] text-[var(--mb-purple)]" : "text-[var(--mb-muted)]"}`}
            >
              <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full ${activeView === tab.id ? "bg-white shadow-[0_10px_20px_rgba(95,25,230,0.08)]" : ""}`}>
                <Icon name={tab.icon} className="h-6 w-6" />
              </div>
              <p className={`mt-2 text-[0.78rem] font-bold ${activeView === tab.id ? "text-[var(--mb-purple)]" : ""}`}>{tab.label}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

