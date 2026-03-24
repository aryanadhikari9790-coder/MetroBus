import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { divIcon } from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { api } from "../../api";
import { useAuth } from "../../AuthContext";
import { clearToken } from "../../auth";
import { snapRouteToRoad } from "../../lib/mapRoute";

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatMoney(value) {
  const numeric = Number(value || 0);
  return `NPR ${numeric.toLocaleString()}`;
}

function formatEtaLabel(eta) {
  if (!eta) return "ETA unavailable";
  if (eta.status === "arriving") return "Arriving now";
  if (eta.status === "passed") return "Passed pickup";
  if (Number.isFinite(eta.minutes)) return `${eta.minutes} min`;
  return "ETA unavailable";
}

function distanceKm(a, b) {
  if (!a || !b) return 0;
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  const earthRadiusKm = 6371;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const originLat = toRadians(lat1);
  const destinationLat = toRadians(lat2);
  const haversine = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function buildCumulativeDistances(points) {
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative[index] = cumulative[index - 1] + distanceKm(points[index - 1], points[index]);
  }
  return cumulative;
}

function findNearestPointIndex(points, target) {
  if (!points.length || !target) return -1;
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  points.forEach((point, index) => {
    const currentDistance = distanceKm(point, target);
    if (currentDistance < nearestDistance) {
      nearestDistance = currentDistance;
      nearestIndex = index;
    }
  });
  return nearestIndex;
}

function normalizeSpeedKmh(speed) {
  const numeric = Number(speed);
  if (!Number.isFinite(numeric) || numeric <= 0) return 22;
  if (numeric <= 30) return numeric * 3.6;
  return numeric;
}

function estimateEta(busPoint, targetPoint, routePath, speed) {
  if (!busPoint || !targetPoint) return null;
  const path = routePath.length > 1 ? routePath : [busPoint, targetPoint];
  const cumulative = buildCumulativeDistances(path);
  const busIndex = findNearestPointIndex(path, busPoint);
  const targetIndex = findNearestPointIndex(path, targetPoint);
  if (busIndex === -1 || targetIndex === -1) return null;
  const directDistance = distanceKm(busPoint, targetPoint);
  if (directDistance <= 0.15) return { status: "arriving", minutes: 1 };
  if (busIndex > targetIndex + 3 && directDistance > 0.2) return { status: "passed", minutes: null };
  const routeDistance = targetIndex >= busIndex ? Math.max(0, cumulative[targetIndex] - cumulative[busIndex]) : directDistance;
  const speedKmh = normalizeSpeedKmh(speed);
  const minutes = Math.max(1, Math.round((routeDistance / speedKmh) * 60));
  return { status: "enroute", minutes };
}

function toPoint(lat, lng) {
  const pointLat = Number(lat);
  const pointLng = Number(lng);
  if (!Number.isFinite(pointLat) || !Number.isFinite(pointLng)) return null;
  return [pointLat, pointLng];
}

function toLocationPoint(location) {
  if (!location) return null;
  return toPoint(location.lat, location.lng);
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

function StepPill({ label, active }) {
  return <div className={`rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] ${active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}>{label}</div>;
}

function StopField({ label, value, onChange, stops, active, onMapSelect }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</label>
        <button type="button" onClick={onMapSelect} className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${active ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}>
          Select on map
        </button>
      </div>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none">
        <option value="">Choose stop</option>
        {stops.map((stop) => <option key={stop.id} value={stop.id}>{stop.name}</option>)}
      </select>
    </div>
  );
}

function SeatPill({ seat, selected, onClick }) {
  const available = seat.available;
  const classes = available ? (selected ? "border-blue-900 bg-blue-900 text-white" : "border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100") : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed";
  return (
    <button type="button" disabled={!available} onClick={onClick} className={`rounded-2xl border px-3 py-3 text-sm font-bold transition ${classes}`}>
      <div>{seat.seat_no}</div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wide">{available ? (selected ? "Selected" : "Open") : "Taken"}</div>
    </button>
  );
}

function PaymentButton({ label, tone, onClick, disabled }) {
  const tones = { dark: "bg-slate-950 text-white hover:bg-slate-800", green: "bg-slate-800 text-white hover:bg-slate-700", yellow: "bg-slate-100 text-slate-900 hover:bg-slate-200", blue: "bg-blue-900 text-white hover:bg-blue-800" };
  return <button type="button" onClick={onClick} disabled={disabled} className={`rounded-2xl px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}>{label}</button>;
}

function buildFormPost(redirect) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = redirect.url;
  Object.entries(redirect.fields || {}).forEach(([key, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

function createBusMarkerIcon({ active = false, heading = 0, label = "BUS" }) {
  const size = active ? 62 : 50;
  const accent = active ? "#ef4444" : "#2563eb";
  const glow = active ? "rgba(239,68,68,0.35)" : "rgba(37,99,235,0.3)";
  return divIcon({
    className: "",
    iconSize: [size, size + 18],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `
      <div style="position:relative;width:${size}px;height:${size + 18}px;">
        <div style="position:absolute;left:50%;bottom:2px;transform:translateX(-50%);padding:2px 8px;border-radius:999px;background:#0f172a;color:white;font-size:10px;font-weight:800;letter-spacing:0.08em;box-shadow:0 10px 22px -16px rgba(15,23,42,0.8);white-space:nowrap;">
          ${label}
        </div>
        <div style="position:absolute;inset:0;display:flex;align-items:flex-start;justify-content:center;">
          <div style="width:${size}px;height:${size}px;filter:drop-shadow(0 16px 20px ${glow});transform:rotate(${heading}deg);transform-origin:center center;">
            <svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">
              <ellipse cx="32" cy="56" rx="18" ry="5" fill="rgba(15,23,42,0.14)" />
              <g>
                <path d="M18 18c0-5.2 4.2-9 9.4-9h9.2c5.2 0 9.4 3.8 9.4 9v18.2c0 3.2-2.6 5.8-5.8 5.8H23.8c-3.2 0-5.8-2.6-5.8-5.8V18z" fill="${accent}" />
                <path d="M21 20.5c0-3.4 2.7-6.1 6.1-6.1h9.8c3.4 0 6.1 2.7 6.1 6.1v7.6H21v-7.6z" fill="#dbeafe" />
                <path d="M23 17.5h18c1.4 0 2.7.8 3.4 2.1l2.1 3.9H17.5l2.1-3.9c.7-1.3 2-2.1 3.4-2.1z" fill="#93c5fd" />
                <rect x="20.5" y="31" width="23" height="7.4" rx="3.2" fill="#f8fafc" opacity="0.95" />
                <circle cx="24" cy="43.5" r="4.5" fill="#0f172a" />
                <circle cx="40" cy="43.5" r="4.5" fill="#0f172a" />
                <circle cx="24" cy="43.5" r="1.8" fill="#cbd5e1" />
                <circle cx="40" cy="43.5" r="1.8" fill="#cbd5e1" />
                <rect x="24" y="34" width="5.8" height="2.2" rx="1.1" fill="#fbbf24" />
                <rect x="34.2" y="34" width="5.8" height="2.2" rx="1.1" fill="#fbbf24" />
                <path d="M32 6l4.8 8h-9.6L32 6z" fill="#0f172a" opacity="0.7" />
              </g>
            </svg>
          </div>
        </div>
      </div>
    `,
  });
}

export default function PassengerHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stops, setStops] = useState([]);
  const [trips, setTrips] = useState([]);
  const [tripContexts, setTripContexts] = useState({});
  const [pickupStopId, setPickupStopId] = useState("");
  const [dropStopId, setDropStopId] = useState("");
  const [selectionMode, setSelectionMode] = useState("pickup");
  const [step, setStep] = useState("plan");
  const [findingRoutes, setFindingRoutes] = useState(false);
  const [matchedTrips, setMatchedTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [seats, setSeats] = useState([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [lastBookingId, setLastBookingId] = useState(null);
  const [lastBookingSummary, setLastBookingSummary] = useState(null);
  const [roadPolyline, setRoadPolyline] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const pickupStop = stops.find((stop) => String(stop.id) === String(pickupStopId)) || null;
  const dropStop = stops.find((stop) => String(stop.id) === String(dropStopId)) || null;
  const selectedTrip = matchedTrips.find((trip) => String(trip.id) === String(selectedTripId)) || matchedTrips[0] || null;
  const selectedContext = selectedTrip ? tripContexts[selectedTrip.id] : null;
  const routeStops = selectedContext?.route_stops || [];
  const routePolyline = useMemo(() => routeStops.map((item) => toPoint(item.stop?.lat, item.stop?.lng)).filter(Boolean), [routeStops]);
  const displayedRoutePolyline = roadPolyline.length > 1 ? roadPolyline : routePolyline;
  const selectedSeatLabels = seats.filter((seat) => selectedSeatIds.includes(seat.seat_id)).map((seat) => seat.seat_no);
  const estimatedFare = lastBookingSummary?.fare_total || (selectedTrip && selectedSeatIds.length > 0 ? selectedTrip.fare_estimate * selectedSeatIds.length : 0);

  const mapPoints = useMemo(() => {
    const points = [...displayedRoutePolyline];
    stops.forEach((stop) => {
      const point = toPoint(stop.lat, stop.lng);
      if (point) points.push(point);
    });
    matchedTrips.forEach((trip) => {
      const point = toLocationPoint(trip.latest_location);
      if (point) points.push(point);
    });
    return points;
  }, [displayedRoutePolyline, stops, matchedTrips]);

  const loadBaseData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [stopsRes, tripsRes] = await Promise.all([api.get("/api/transport/stops/"), api.get("/api/trips/live/")]);
      setStops(stopsRes.data.stops || []);
      setTrips(tripsRes.data || []);
      setErr("");
    } catch (error) {
      setErr(error?.response?.data?.detail || "Unable to load passenger map data.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const ensureTripContexts = async (tripList) => {
    const missingTrips = tripList.filter((trip) => !tripContexts[trip.id]);
    if (!missingTrips.length) return tripContexts;
    const detailPairs = await Promise.all(missingTrips.map(async (trip) => [trip.id, (await api.get(`/api/trips/${trip.id}/`)).data]));
    const merged = { ...tripContexts };
    detailPairs.forEach(([tripId, detail]) => {
      merged[tripId] = detail;
    });
    setTripContexts(merged);
    return merged;
  };

  const loadSeatsForTrip = async (tripId, fromOrder, toOrder) => {
    if (!tripId || !fromOrder || !toOrder) {
      setSeats([]);
      setSelectedSeatIds([]);
      return;
    }
    setLoadingSeats(true);
    try {
      const res = await api.get(`/api/bookings/trips/${tripId}/availability/?from=${fromOrder}&to=${toOrder}`);
      setSeats(res.data.seats || []);
      setSelectedSeatIds([]);
      setErr("");
    } catch (error) {
      setErr(error?.response?.data?.detail || "Unable to load seat availability.");
      setSeats([]);
      setSelectedSeatIds([]);
    } finally {
      setLoadingSeats(false);
    }
  };

  useEffect(() => {
    loadBaseData();
    const intervalId = window.setInterval(() => loadBaseData({ silent: true }), 4000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!(pickupStopId && dropStopId && matchedTrips.length)) return;
    const syncMatchedTrips = async () => {
      try {
        await findRoutes({ silent: true });
      } catch {
        // keep existing results if sync fails
      }
    };
    syncMatchedTrips();
  }, [trips]);

  useEffect(() => {
    if (!selectedTrip) {
      setSeats([]);
      return;
    }
    loadSeatsForTrip(selectedTrip.id, selectedTrip.from_order, selectedTrip.to_order);
  }, [selectedTripId, matchedTrips]);

  useEffect(() => {
    if (routePolyline.length < 2) {
      setRoadPolyline([]);
      return;
    }
    const controller = new AbortController();
    const loadRoadRoute = async () => {
      try {
        const snappedPath = await snapRouteToRoad(routePolyline, controller.signal);
        setRoadPolyline(snappedPath.length > 1 ? snappedPath : []);
      } catch (error) {
        if (error.name === "AbortError") return;
        setRoadPolyline([]);
      }
    };
    loadRoadRoute();
    return () => controller.abort();
  }, [routePolyline]);

  const findRoutes = async ({ silent = false } = {}) => {
    if (!pickupStopId || !dropStopId) {
      setErr("Choose both pickup and drop points first.");
      return;
    }
    if (String(pickupStopId) === String(dropStopId)) {
      setErr("Pickup and drop point must be different.");
      return;
    }
    if (!silent) {
      setFindingRoutes(true);
      setErr("");
      setMsg("");
    }
    try {
      const contextMap = await ensureTripContexts(trips);
      const matches = [];
      for (const trip of trips) {
        const detail = contextMap[trip.id];
        const routeStopRows = detail?.route_stops || [];
        const pickupRow = routeStopRows.find((item) => String(item.stop?.id) === String(pickupStopId));
        const dropRow = routeStopRows.find((item) => String(item.stop?.id) === String(dropStopId));
        if (!pickupRow || !dropRow) continue;
        if (Number(dropRow.stop_order) <= Number(pickupRow.stop_order)) continue;
        const availability = await api.get(`/api/bookings/trips/${trip.id}/availability/?from=${pickupRow.stop_order}&to=${dropRow.stop_order}`);
        const seatsData = availability.data.seats || [];
        const openSeats = seatsData.filter((seat) => seat.available).length;
        const occupancyPercent = seatsData.length ? Math.round(((seatsData.length - openSeats) / seatsData.length) * 100) : 0;
        const routePoints = routeStopRows.map((item) => toPoint(item.stop?.lat, item.stop?.lng)).filter(Boolean);
        const eta = estimateEta(toLocationPoint(trip.latest_location), toPoint(pickupRow.stop?.lat, pickupRow.stop?.lng), routePoints, trip.latest_location?.speed);
        matches.push({ ...trip, from_order: Number(pickupRow.stop_order), to_order: Number(dropRow.stop_order), open_seats: openSeats, total_seats: seatsData.length, occupancy_percent: occupancyPercent, occupancy_label: occupancyPercent >= 80 ? "Busy" : occupancyPercent >= 50 ? "Moderate" : "Comfortable", eta, availability: seatsData, fare_estimate: 50 });
      }
      setMatchedTrips(matches);
      setSelectedTripId(matches[0] ? String(matches[0].id) : "");
      setLastBookingId(null);
      setLastBookingSummary(null);
      setSelectedSeatIds([]);
      if (!matches.length) {
        setSeats([]);
        setErr("No live buses were found for the selected pickup and drop points.");
        if (!silent) setStep("plan");
      } else if (!silent) {
        setMsg(`${matches.length} live bus${matches.length === 1 ? "" : "es"} found for your route.`);
        setStep("buses");
      }
    } catch (error) {
      if (!silent) setErr(error?.response?.data?.detail || "Unable to find matching live routes right now.");
    } finally {
      if (!silent) setFindingRoutes(false);
    }
  };

  const handleMapStopPick = (stopId) => {
    if (selectionMode === "drop") {
      setDropStopId(String(stopId));
      setSelectionMode("");
      return;
    }
    if (!pickupStopId || selectionMode === "pickup") {
      setPickupStopId(String(stopId));
      setSelectionMode("drop");
      return;
    }
    setDropStopId(String(stopId));
    setSelectionMode("");
  };

  const selectBus = (tripId) => {
    setSelectedTripId(String(tripId));
    const selected = matchedTrips.find((trip) => String(trip.id) === String(tripId));
    if (selected?.availability) {
      setSeats(selected.availability);
      setSelectedSeatIds([]);
    }
    setStep("seats");
  };

  const toggleSeat = (seatId) => {
    setSelectedSeatIds((current) => current.includes(seatId) ? current.filter((item) => item !== seatId) : [...current, seatId]);
  };

  const handleBookSeats = async () => {
    if (!selectedTrip || selectedSeatIds.length === 0) {
      setErr("Select a bus and at least one seat first.");
      return;
    }
    setBookingBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await api.post(`/api/bookings/trips/${selectedTrip.id}/book/`, { from_stop_order: selectedTrip.from_order, to_stop_order: selectedTrip.to_order, seat_ids: selectedSeatIds });
      setLastBookingId(res.data.id);
      setLastBookingSummary(res.data);
      setMsg(`Booking #${res.data.id} confirmed. Continue with payment below.`);
      await loadSeatsForTrip(selectedTrip.id, selectedTrip.from_order, selectedTrip.to_order);
    } catch (error) {
      setErr(error?.response?.data?.detail || "Booking failed.");
    } finally {
      setBookingBusy(false);
    }
  };

  const handlePayment = async (method) => {
    if (!lastBookingId) {
      setErr("Create a booking before choosing payment.");
      return;
    }
    setPaymentBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await api.post("/api/payments/create/", { booking_id: lastBookingId, method });
      const redirect = res.data.redirect;
      const payment = res.data.payment;
      if (redirect?.type === "REDIRECT" && redirect.url) {
        window.location.href = redirect.url;
        return;
      }
      if (redirect?.type === "FORM_POST" && redirect.url) {
        buildFormPost(redirect);
        return;
      }
      setMsg(`Payment created with status ${payment?.status || "PENDING"}.`);
    } catch (error) {
      setErr(error?.response?.data?.detail || "Payment request failed.");
    } finally {
      setPaymentBusy(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    navigate("/auth/login");
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#eef5ff] px-4 text-slate-900"><div className="w-full max-w-md rounded-[2rem] bg-white p-8 text-center shadow-lg">Loading passenger app...</div></div>;
  }

  return (
    <div className="min-h-screen bg-[#f3f6f8] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-md flex-col">
        <header className="px-4 pb-3 pt-4">
          <div className="rounded-[1.6rem] border border-slate-200 bg-white px-4 py-4 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-slate-900 text-sm font-black text-white">MB</div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">MetroBus</div>
                  <div className="mt-1 text-xl font-bold text-slate-950">Passenger</div>
                  <div className="mt-1 text-sm text-slate-500">{user?.full_name || "Passenger"}</div>
                </div>
              </div>
              <button type="button" onClick={handleLogout} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">Logout</button>
            </div>
          </div>
        </header>

        <section className="px-4">
          <div className="overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-[0_24px_48px_-34px_rgba(15,23,42,0.26)]">
            <div className="h-[43vh] min-h-[20rem] w-full bg-slate-100">
              <MapContainer center={[28.2096, 83.9856]} zoom={13} scrollWheelZoom={false} className="h-full w-full">
                <TileLayer attribution='&copy; OpenStreetMap &copy; CARTO' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                <MapViewport points={mapPoints} />
                {displayedRoutePolyline.length > 0 ? <Polyline positions={displayedRoutePolyline} pathOptions={{ color: "#334155", weight: 5, opacity: 0.9 }} /> : null}
                {stops.map((stop) => {
                  const point = toPoint(stop.lat, stop.lng);
                  if (!point) return null;
                  const isPickup = String(stop.id) === String(pickupStopId);
                  const isDrop = String(stop.id) === String(dropStopId);
                  const fillColor = isPickup ? "#0f766e" : isDrop ? "#334155" : "#94a3b8";
                  const radius = isPickup || isDrop ? 9 : 6;
                  return <CircleMarker key={stop.id} center={point} radius={radius} eventHandlers={{ click: () => handleMapStopPick(stop.id) }} pathOptions={{ color: "#1e3a8a", fillColor, fillOpacity: 0.95 }}><Popup><div className="space-y-1"><div className="font-bold">{stop.name}</div><div className="text-xs text-slate-500">Tap to use as {selectionMode === "drop" ? "drop" : !pickupStopId ? "pickup" : "next point"}</div></div></Popup></CircleMarker>;
                })}
                {matchedTrips.map((trip) => {
                  const point = toLocationPoint(trip.latest_location);
                  if (!point) return null;
                  const active = String(trip.id) === String(selectedTripId);
                  const heading = Number(trip.latest_location?.heading || 0);
                  return (
                    <Marker
                      key={trip.id}
                      position={point}
                      icon={createBusMarkerIcon({
                        active,
                        heading: Number.isFinite(heading) ? heading : 0,
                        label: trip.bus_plate || `Bus ${trip.id}`,
                      })}
                      eventHandlers={{ click: () => setSelectedTripId(String(trip.id)) }}
                    >
                      <Tooltip direction="top" offset={[0, -24]} opacity={1} permanent={active}>
                        {active ? `Live bus ${trip.bus_plate}` : trip.bus_plate}
                      </Tooltip>
                      <Popup>
                        <div className="space-y-1">
                          <div className="font-bold">Bus {trip.bus_plate}</div>
                          <div>ETA {formatEtaLabel(trip.eta)}</div>
                          <div>Open seats {trip.open_seats}</div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          </div>
        </section>

        <section className="-mt-6 flex-1 rounded-t-[2rem] border-t border-slate-200 bg-white px-4 pb-6 pt-5 shadow-[0_-18px_36px_-28px_rgba(15,23,42,0.18)]">
          <div className="flex flex-wrap gap-2">
            <StepPill label="Plan" active />
            <StepPill label="Choose Bus" active={step === "buses" || step === "seats"} />
            <StepPill label="Choose Seat" active={step === "seats"} />
          </div>
          {err ? <div className="mt-4 rounded-[1.4rem] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{err}</div> : null}
          {msg ? <div className="mt-4 rounded-[1.4rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{msg}</div> : null}

          <div className="mt-4">
            {step === "plan" ? (
              <div className="space-y-4">
                <div><div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Trip planner</div><div className="mt-1 text-[1.8rem] font-bold text-slate-950">Plan your ride</div></div>
                <StopField label="Pickup point" value={pickupStopId} onChange={setPickupStopId} stops={stops} active={selectionMode === "pickup"} onMapSelect={() => setSelectionMode("pickup")} />
                <StopField label="Drop point" value={dropStopId} onChange={setDropStopId} stops={stops} active={selectionMode === "drop"} onMapSelect={() => setSelectionMode("drop")} />
                <button type="button" onClick={() => findRoutes()} disabled={findingRoutes} className="w-full rounded-[1.2rem] bg-slate-900 px-4 py-4 text-base font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">{findingRoutes ? "Finding live buses..." : "Find Route"}</button>
              </div>
            ) : null}

            {step === "buses" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3"><div><div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Available buses</div><div className="mt-1 text-[1.8rem] font-bold text-slate-950">Choose a bus</div></div><button type="button" onClick={() => setStep("plan")} className="text-sm font-semibold text-slate-700">Edit route</button></div>
                <div className="space-y-3">{matchedTrips.map((trip) => <button key={trip.id} type="button" onClick={() => selectBus(trip.id)} className="w-full rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-300 hover:bg-white"><div className="flex items-start justify-between gap-3"><div><div className="text-lg font-semibold text-slate-950">Bus {trip.bus_plate}</div><div className="mt-1 text-sm text-slate-500">{trip.route_name}</div></div><div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">ETA {formatEtaLabel(trip.eta)}</div></div><div className="mt-3 grid grid-cols-3 gap-3"><div className="rounded-[1rem] bg-white px-3 py-3 text-center"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Occupancy</div><div className="mt-2 text-lg font-semibold text-slate-950">{trip.occupancy_percent}%</div></div><div className="rounded-[1rem] bg-white px-3 py-3 text-center"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Status</div><div className="mt-2 text-sm font-semibold text-slate-950">{trip.occupancy_label}</div></div><div className="rounded-[1rem] bg-white px-3 py-3 text-center"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Open seats</div><div className="mt-2 text-lg font-semibold text-slate-950">{trip.open_seats}</div></div></div></button>)}</div>
              </div>
            ) : null}

            {step === "seats" && selectedTrip ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3"><div><div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Selected bus</div><div className="mt-1 text-[1.8rem] font-bold text-slate-950">Bus {selectedTrip.bus_plate}</div><div className="mt-2 text-sm text-slate-500">{pickupStop?.name} to {dropStop?.name} | GPS {selectedTrip.latest_location ? formatDateTime(selectedTrip.latest_location.recorded_at) : "Waiting"}</div></div><button type="button" onClick={() => setStep("buses")} className="text-sm font-semibold text-slate-700">Change bus</button></div>
                <div><div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Seat selection</div><div className="mt-1 text-2xl font-bold text-slate-950">Choose seats</div></div>
                <div className="grid grid-cols-4 gap-3">{seats.map((seat) => <SeatPill key={seat.seat_id} seat={seat} selected={selectedSeatIds.includes(seat.seat_id)} onClick={() => toggleSeat(seat.seat_id)} />)}</div>
                {seats.length === 0 ? <div className="rounded-[1.35rem] bg-slate-50 px-4 py-4 text-sm text-slate-500">{loadingSeats ? "Loading seats..." : "No seat map available for this trip yet."}</div> : null}
                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-900 p-5 text-white"><div className="flex items-start justify-between gap-3"><div><div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Booking summary</div><div className="mt-2 text-xl font-semibold">{pickupStop?.name} to {dropStop?.name}</div></div><div className="text-right"><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Seats</div><div className="mt-2 text-sm font-medium">{selectedSeatLabels.join(", ") || "None"}</div></div></div><div className="mt-4 text-3xl font-bold">{formatMoney(lastBookingSummary?.fare_total || estimatedFare)}</div><button type="button" onClick={handleBookSeats} disabled={bookingBusy || selectedSeatIds.length === 0} className="mt-4 w-full rounded-[1.2rem] bg-white px-4 py-4 text-base font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">{bookingBusy ? "Confirming booking..." : "Confirm Booking"}</button></div>
                {lastBookingId ? <div className="space-y-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4"><div><div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Payment</div><div className="mt-1 text-2xl font-bold text-slate-950">Choose payment method</div></div><div className="grid grid-cols-2 gap-3"><PaymentButton label={paymentBusy ? "Processing..." : "Cash"} tone="dark" onClick={() => handlePayment("CASH")} disabled={paymentBusy} /><PaymentButton label={paymentBusy ? "Processing..." : "Mock Online"} tone="green" onClick={() => handlePayment("MOCK_ONLINE")} disabled={paymentBusy} /><PaymentButton label={paymentBusy ? "Processing..." : "eSewa"} tone="yellow" onClick={() => handlePayment("ESEWA")} disabled={paymentBusy} /><PaymentButton label={paymentBusy ? "Processing..." : "Khalti"} tone="blue" onClick={() => handlePayment("KHALTI")} disabled={paymentBusy} /></div></div> : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
