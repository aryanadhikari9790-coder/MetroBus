import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
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
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#fffdfd,#fff7fc_54%,#f8e4f7)] px-6">
      <div className="text-center">
        <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-[3rem] bg-white shadow-[0_32px_90px_rgba(141,18,235,0.18)]">
          <MetroBusMark className="h-28 w-28" />
        </div>
        <div className="mt-8">
          <MetroBusWordmark />
        </div>
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.28em] text-[var(--mb-muted)]">
          Smart transit for Pokhara
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
    <div className={`font-black italic tracking-[-0.04em] text-[var(--mb-purple)] ${compact ? "text-[1.45rem]" : "text-[2.7rem]"}`}>
      metro<span className="text-[var(--mb-purple-2)]">Bus</span>
    </div>
  );
}

export function Icon({ name, className = "h-5 w-5" }) {
  const common = { className, fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24" };
  switch (name) {
    case "bell":
      return <svg {...common}><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" /><path d="M10 17a2 2 0 0 0 4 0" /></svg>;
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
    case "briefcase":
      return <svg {...common}><rect x="4" y="7" width="16" height="11" rx="2.5" /><path d="M9 7V5.7A1.7 1.7 0 0 1 10.7 4h2.6A1.7 1.7 0 0 1 15 5.7V7" /></svg>;
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
    case "plus":
      return <svg {...common}><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
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

export function HeaderBar({ user, activeView }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--mb-border)] bg-[var(--mb-nav)] px-5 py-4 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-[var(--mb-shadow)]">
            <MetroBusMark className="h-10 w-10" />
          </div>
          <div>
            <MetroBusWordmark compact />
            <p className="text-xs font-medium text-[var(--mb-muted)]">{activeView === "home" ? "Passenger Dashboard" : activeView === "track" ? "Live Tracking" : activeView === "rides" ? "My Reservations" : "Your Account"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="grid h-11 w-11 place-items-center rounded-full bg-white text-[var(--mb-purple)] shadow-[var(--mb-shadow)]">
            <Icon name="bell" />
          </button>
          <PassengerAvatar user={user} />
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
          className="w-full rounded-[22px] border border-[var(--mb-border)] bg-white px-4 py-3 text-sm font-medium text-[var(--mb-text)] outline-none transition focus:border-[var(--mb-purple)]"
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

export function PlannerCard({ stops, pickupStopId, dropStopId, selectionMode, onPickupChange, onDropChange, onMapPickMode, onFindRoutes, findingRoutes, mapPoints, pickupStop, dropStop }) {
  return (
    <section className="mt-5 rounded-[32px] bg-[var(--mb-card)] p-4 shadow-[var(--mb-shadow)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.26em] text-[var(--mb-purple)]">Route Planner</p>
          <h3 className="mt-1 text-xl font-black text-[var(--mb-text)]">Plan your ride</h3>
        </div>
        <div className="rounded-full bg-[var(--mb-bg-alt)] px-3 py-1 text-xs font-bold text-[var(--mb-purple)]">
          {selectionMode ? `Map: ${selectionMode}` : "Tap map pins"}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <StopPicker label="Pickup" value={pickupStopId} stops={stops} onChange={onPickupChange} />
          <StopPicker label="Destination" value={dropStopId} stops={stops} onChange={onDropChange} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <button type="button" onClick={() => onMapPickMode("pickup")} className={`rounded-[24px] border px-4 py-3 text-sm font-bold transition ${selectionMode === "pickup" ? "border-transparent bg-[linear-gradient(135deg,#8d12eb,#b641ff)] text-white shadow-[var(--mb-shadow-strong)]" : "border-[var(--mb-border)] bg-white text-[var(--mb-purple)]"}`}>
            Pick pickup on map
          </button>
          <button type="button" onClick={() => onMapPickMode("drop")} className={`rounded-[24px] border px-4 py-3 text-sm font-bold transition ${selectionMode === "drop" ? "border-transparent bg-[linear-gradient(135deg,#8d12eb,#b641ff)] text-white shadow-[var(--mb-shadow-strong)]" : "border-[var(--mb-border)] bg-white text-[var(--mb-purple)]"}`}>
            Pick destination on map
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[30px]">
        <MapContainer center={[28.2096, 83.9856]} zoom={13} scrollWheelZoom={false} className="h-56 w-full">
          <TileLayer attribution="&copy; OpenStreetMap &copy; CARTO" url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          <MapViewport points={mapPoints} />
          {stops.map((stop) => {
            const point = toPoint(stop.lat, stop.lng);
            if (!point) return null;
            const isPickup = String(stop.id) === String(pickupStopId);
            const isDrop = String(stop.id) === String(dropStopId);
            return (
              <CircleMarker
                key={stop.id}
                center={point}
                radius={isPickup || isDrop ? 10 : 6}
                eventHandlers={{ click: () => onMapPickMode(selectionMode || (!pickupStopId ? "pickup" : "drop"), stop.id) }}
                pathOptions={{
                  color: isPickup ? "#8d12eb" : isDrop ? "#ff4fd8" : "#bba6c6",
                  fillColor: isPickup ? "#8d12eb" : isDrop ? "#ff4fd8" : "#eac9ee",
                  fillOpacity: 0.95,
                }}
              />
            );
          })}
        </MapContainer>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-[24px] bg-[var(--mb-bg-alt)] p-4">
        <div>
          <p className="text-sm font-semibold text-[var(--mb-text)]">{pickupStop?.name || "Choose pickup"} → {dropStop?.name || "Choose destination"}</p>
          <p className="mt-1 text-xs text-[var(--mb-muted)]">Choose both points to see live buses and seat availability.</p>
        </div>
        <button type="button" onClick={onFindRoutes} disabled={findingRoutes} className="rounded-full bg-[linear-gradient(135deg,#8d12eb,#b641ff)] px-5 py-3 text-sm font-black text-white shadow-[var(--mb-shadow-strong)] disabled:opacity-60">
          {findingRoutes ? "Finding..." : "Find buses"}
        </button>
      </div>
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

export function NearbyMapCard({ stops, displayLine, selectedTrip }) {
  const points = useMemo(() => {
    const line = displayLine.length ? displayLine : stops.map((stop) => toPoint(stop.lat, stop.lng)).filter(Boolean);
    return line.length ? line : [[28.2096, 83.9856]];
  }, [displayLine, stops]);

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
        </MapContainer>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(193,76,255,0.18),transparent_46%)]" />
        <div className="absolute right-4 top-4 rounded-full bg-white px-4 py-2 text-sm font-black text-[var(--mb-purple)]">LIVE</div>
        <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-black/32 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
          <Icon name="pin" className="h-4 w-4" />
          {selectedTrip?.pickup_stop_name || stops[0]?.name || "Downtown Hub"} • {selectedTrip ? fmtEta(selectedTrip.eta) : "Nearby now"}
        </div>
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

export function LiveBusCard({ trip, index, active, onClick, now }) {
  const tone = statusTone(trip, now);
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-4 rounded-[34px] border px-5 py-4 text-left shadow-[var(--mb-shadow)] transition ${active ? "border-transparent bg-[linear-gradient(180deg,#fff8fc,#f7dff6)] ring-2 ring-[rgba(141,18,235,0.18)]" : "border-[var(--mb-border)] bg-[var(--mb-card)]"}`}>
      <div className="grid h-16 w-16 flex-none place-items-center rounded-full bg-white text-[2rem] font-black text-[var(--mb-purple)]">
        {routeCode(trip, index)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xl font-black text-[var(--mb-text)]">{trip.route_name}</p>
        <p className="mt-1 truncate text-sm text-[var(--mb-muted)]">Gate {trip.from_order || 1} • {trip.occupancy_label || "Live service"}</p>
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

export function ReservationBuilder({ trip, seats, selectedSeatIds, onSeatToggle, onBook, onPay, bookingBusy, paymentBusy, loadingSeats, lastBookingId, lastBookingSummary, pickupStop, dropStop }) {
  const selectedLabels = seats.filter((seat) => selectedSeatIds.includes(seat.seat_id)).map((seat) => seat.seat_no);
  const total = lastBookingSummary?.fare_total || ((trip?.fare_estimate || 50) * selectedSeatIds.length);
  if (!trip) return null;
  return (
    <section className="mt-5 rounded-[34px] bg-[var(--mb-card)] p-5 shadow-[var(--mb-shadow)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--mb-purple)]">Reserve seats</p>
          <h3 className="mt-2 text-2xl font-black text-[var(--mb-text)]">{trip.bus_plate || "MetroBus"} • {pickupStop?.name || "Pickup"} → {dropStop?.name || "Drop"}</h3>
        </div>
        <div className="rounded-full bg-[var(--mb-bg-alt)] px-4 py-2 text-sm font-black text-[var(--mb-purple)]">
          {trip.open_seats ?? 0} seats
        </div>
      </div>

      <div className="mt-5">
        {loadingSeats ? <p className="text-sm text-[var(--mb-muted)]">Loading seat map...</p> : (
          <div className="grid grid-cols-5 gap-3 sm:grid-cols-6">
            {seats.map((seat) => (
              <SeatButton key={seat.seat_id} seat={seat} selected={selectedSeatIds.includes(seat.seat_id)} onClick={() => onSeatToggle(seat.seat_id)} />
            ))}
          </div>
        )}
      </div>

      {selectedLabels.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {selectedLabels.map((label) => (
            <span key={label} className="rounded-full bg-[var(--mb-bg-alt)] px-3 py-1 text-xs font-black text-[var(--mb-purple)]">{label}</span>
          ))}
        </div>
      ) : null}

      <div className="mt-5 rounded-[28px] bg-[linear-gradient(135deg,#fff,#f8e5fb)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--mb-muted)]">Booking total</p>
            <p className="mt-1 text-3xl font-black text-[var(--mb-text)]">{fmtMoney(total)}</p>
          </div>
          <button type="button" onClick={onBook} disabled={bookingBusy || !selectedSeatIds.length} className="rounded-full bg-[linear-gradient(135deg,#8d12eb,#b641ff)] px-6 py-3 text-sm font-black text-white shadow-[var(--mb-shadow-strong)] disabled:opacity-60">
            {bookingBusy ? "Confirming..." : "Confirm Booking"}
          </button>
        </div>
      </div>

      {lastBookingId ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { label: "Cash", method: "CASH" },
            { label: "Mock Online", method: "MOCK_ONLINE" },
            { label: "eSewa", method: "ESEWA" },
            { label: "Khalti", method: "KHALTI" },
          ].map((option) => (
            <button key={option.method} type="button" onClick={() => onPay(option.method)} disabled={paymentBusy} className="rounded-[24px] border border-[var(--mb-border)] bg-white px-4 py-4 text-sm font-black text-[var(--mb-purple)] shadow-[var(--mb-shadow)] disabled:opacity-60">
              {paymentBusy ? "Processing..." : option.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function TrackMap({ trip, displayLine, now }) {
  const busLocation = getBusPoint(trip, displayLine);
  const points = displayLine.length ? displayLine : (busLocation ? [busLocation.point] : [[28.2096, 83.9856]]);
  const distanceValue = trip?.pickup_point && busLocation?.point ? distKm(busLocation.point, trip.pickup_point).toFixed(1) : "3.0";
  return (
    <div className="relative overflow-hidden rounded-[38px] bg-[#2b1d30] shadow-[var(--mb-shadow-strong)]">
      <div className="h-[28rem]">
        <MapContainer center={points[0]} zoom={13} scrollWheelZoom={false} className="h-full w-full">
          <TileLayer attribution="&copy; OpenStreetMap &copy; CARTO" url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          <MapViewport points={points} />
          {displayLine.length > 1 ? <Polyline positions={displayLine} pathOptions={{ color: "#9f4dff", weight: 6, opacity: 0.88 }} /> : null}
          {busLocation ? <Marker position={busLocation.point} icon={createBusIcon({ label: trip.bus_plate || "Bus", heading: busLocation.heading })} /> : null}
        </MapContainer>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,245,252,0.08),rgba(255,245,252,0.24))]" />
      <div className="absolute left-5 right-5 top-5 rounded-[36px] bg-[rgba(255,217,247,0.92)] px-6 py-5 backdrop-blur">
        <div className="grid grid-cols-2 gap-4 text-[var(--mb-text)]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--mb-purple)]">Arriving In</p>
            <p className="mt-2 text-4xl font-black">{trip?.eta?.minutes || 8} mins</p>
          </div>
          <div className="border-l border-white/40 pl-4 text-right">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--mb-muted)]">Distance</p>
            <p className="mt-2 text-4xl font-black">{distanceValue} km away</p>
          </div>
        </div>
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-[linear-gradient(135deg,#8d12eb,#b641ff)] px-5 py-3 text-center text-xl font-black text-white shadow-[var(--mb-shadow-strong)]">
        Bus {routeCode(trip, 0)}
      </div>
      <div className="absolute right-5 top-[7.6rem] rounded-full bg-white/80 px-3 py-1 text-xs font-black text-[var(--mb-purple)] shadow-[var(--mb-shadow)]">
        {statusTone(trip, now).label}
      </div>
    </div>
  );
}

export function DriverCard({ trip }) {
  return (
    <div className="flex items-center gap-4 rounded-[34px] bg-[var(--mb-card)] p-4 shadow-[var(--mb-shadow)]">
      <PassengerAvatar user={{ full_name: trip?.driver_name || "Driver" }} size="h-16 w-16" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-3xl font-black text-[var(--mb-text)]">{trip?.bus_plate || "Bus"} • {trip?.driver_name || "Robert Fox"}</p>
        <p className="mt-1 text-lg font-medium text-[var(--mb-muted)]">4.9 (1.2k reviews)</p>
      </div>
      <button type="button" className="grid h-16 w-16 place-items-center rounded-full bg-[linear-gradient(135deg,#8d12eb,#b641ff)] text-white shadow-[var(--mb-shadow-strong)]">
        <Icon name="chat" className="h-7 w-7" />
      </button>
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
          <p className="text-xl font-semibold italic text-[var(--mb-text)]">{booking.pickup_stop_name} → {booking.destination_stop_name}</p>
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
        <span className="text-xl font-black text-[var(--mb-purple)]">4.9 ★</span>
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

export function PaymentShowcase({ latestPaidBooking }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-3xl font-black text-[var(--mb-text)]">Payment Methods</h3>
        <button type="button" className="text-lg font-black text-[var(--mb-purple)]">Add New</button>
      </div>
      <div className="rounded-[36px] bg-[linear-gradient(135deg,#8d12eb,#c243ff)] p-6 text-white shadow-[var(--mb-shadow-strong)]">
        <div className="flex items-center justify-between">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-[var(--mb-purple)]">
            <Icon name="wallet" />
          </div>
          <p className="text-3xl font-black italic">VISA</p>
        </div>
        <p className="mt-10 text-4xl font-black tracking-[0.34em]">•••• •••• •••• 4290</p>
        <div className="mt-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">Card Holder</p>
            <p className="mt-2 text-2xl font-black uppercase">{(latestPaidBooking?.route_name || "MetroBus Member").slice(0, 16)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">Last Paid</p>
            <p className="mt-2 text-2xl font-black">{latestPaidBooking ? fmtMoney(latestPaidBooking.fare_total) : "NPR 0"}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[30px] bg-[var(--mb-card-strong)] p-5 shadow-[var(--mb-shadow)]">
          <div className="text-[var(--mb-purple)]"><Icon name="wallet" className="h-7 w-7" /></div>
          <p className="mt-7 text-sm font-bold uppercase tracking-[0.2em] text-[var(--mb-muted)]">MetroBus Pay</p>
          <p className="mt-2 text-4xl font-black text-[var(--mb-purple)]">{latestPaidBooking ? fmtMoney(latestPaidBooking.fare_total) : "NPR 124.50"}</p>
        </div>
        <div className="rounded-[30px] bg-white p-5 shadow-[var(--mb-shadow)]">
          <div className="text-[var(--mb-purple)]"><Icon name="track" className="h-7 w-7" /></div>
          <p className="mt-7 text-sm font-bold uppercase tracking-[0.2em] text-[var(--mb-muted)]">UPI / Wallet</p>
          <p className="mt-2 text-3xl font-black text-[var(--mb-text)]">{paymentHandle(latestPaidBooking)}</p>
        </div>
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
    <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-[30rem] -translate-x-1/2 rounded-[36px] border border-white/70 bg-[var(--mb-nav)] p-3 shadow-[0_24px_60px_rgba(134,29,171,0.16)] backdrop-blur-xl">
      <div className="grid grid-cols-4 gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`rounded-[28px] px-2 py-3 text-center transition ${activeView === tab.id ? "bg-[linear-gradient(135deg,#8d12eb,#b641ff)] text-white shadow-[var(--mb-shadow-strong)]" : "text-[var(--mb-muted)]"}`}
          >
            <div className="mx-auto flex w-fit items-center justify-center"><Icon name={tab.icon} className="h-6 w-6" /></div>
            <p className="mt-2 text-[0.72rem] font-black uppercase tracking-[0.14em]">{tab.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
