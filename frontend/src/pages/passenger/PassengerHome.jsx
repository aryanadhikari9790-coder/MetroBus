import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { api } from "../../api";
import { useAuth } from "../../AuthContext";
import { clearToken } from "../../auth";

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
  if (Number.isFinite(eta.minutes)) return `ETA ${eta.minutes} min`;
  return "ETA unavailable";
}

function toLatLng(value) {
  if (!value) return null;
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
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

  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

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
  if (directDistance <= 0.15) {
    return { status: "arriving", minutes: 1, distanceKm: directDistance };
  }

  if (busIndex > targetIndex + 3 && directDistance > 0.2) {
    return { status: "passed", minutes: null, distanceKm: 0 };
  }

  const routeDistance =
    targetIndex >= busIndex
      ? Math.max(0, cumulative[targetIndex] - cumulative[busIndex])
      : directDistance;

  const speedKmh = normalizeSpeedKmh(speed);
  const minutes = Math.max(1, Math.round((routeDistance / speedKmh) * 60));

  return {
    status: "enroute",
    minutes,
    distanceKm: routeDistance,
  };
}

function MapViewport({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;

    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }

    map.fitBounds(points, { padding: [32, 32] });
  }, [map, points]);

  return null;
}

function ShellCard({ children, className = "" }) {
  return (
    <section
      className={`rounded-[2rem] bg-white p-5 shadow-[0_24px_48px_-30px_rgba(15,23,42,0.35)] ${className}`}
    >
      {children}
    </section>
  );
}

function StatusPill({ children, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-100 text-blue-900",
    green: "bg-emerald-100 text-emerald-900",
    amber: "bg-amber-100 text-amber-900",
    slate: "bg-slate-100 text-slate-700",
    red: "bg-red-100 text-red-700",
  };

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

function SeatPill({ seat, selected, onClick }) {
  const available = seat.available;
  const classes = available
    ? selected
      ? "border-blue-900 bg-blue-900 text-white"
      : "border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100"
    : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed";

  return (
    <button
      type="button"
      disabled={!available}
      onClick={onClick}
      className={`rounded-2xl border px-3 py-3 text-sm font-bold transition ${classes}`}
    >
      <div>{seat.seat_no}</div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wide">
        {available ? (selected ? "Selected" : "Open") : "Taken"}
      </div>
    </button>
  );
}

function PaymentButton({ label, tone, onClick, disabled }) {
  const tones = {
    dark: "bg-slate-950 text-white hover:bg-slate-800",
    green: "bg-emerald-600 text-white hover:bg-emerald-500",
    yellow: "bg-amber-400 text-slate-950 hover:bg-amber-300",
    blue: "bg-blue-700 text-white hover:bg-blue-600",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
    >
      {label}
    </button>
  );
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

export default function PassengerHome() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [trips, setTrips] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [tripId, setTripId] = useState("");
  const [routeStops, setRouteStops] = useState([]);
  const [fromOrder, setFromOrder] = useState("");
  const [toOrder, setToOrder] = useState("");
  const [seats, setSeats] = useState([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [lastBookingId, setLastBookingId] = useState(null);
  const [lastBookingSummary, setLastBookingSummary] = useState(null);
  const [roadPolyline, setRoadPolyline] = useState([]);
  const [roadRouteLoaded, setRoadRouteLoaded] = useState(false);

  const liveRoutes = useMemo(() => {
    const uniqueRoutes = new Map();

    trips.forEach((trip) => {
      const routeKey = String(trip.route);
      if (!uniqueRoutes.has(routeKey)) {
        uniqueRoutes.set(routeKey, {
          route: trip.route,
          route_name: trip.route_name,
          bus_count: 0,
        });
      }

      uniqueRoutes.get(routeKey).bus_count += 1;
    });

    return Array.from(uniqueRoutes.values());
  }, [trips]);

  const selectedRouteTrips = useMemo(
    () => trips.filter((trip) => String(trip.route) === String(selectedRouteId)),
    [trips, selectedRouteId]
  );

  const selectedRouteSummary = useMemo(
    () => liveRoutes.find((route) => String(route.route) === String(selectedRouteId)) || null,
    [liveRoutes, selectedRouteId]
  );

  const selectedTrip = useMemo(
    () => selectedRouteTrips.find((trip) => String(trip.id) === String(tripId)) || selectedRouteTrips[0] || null,
    [selectedRouteTrips, tripId]
  );

  const latestLocation = selectedTrip?.latest_location || null;

  const routePolyline = useMemo(
    () =>
      routeStops
        .map((item) => [Number(item.stop?.lat), Number(item.stop?.lng)])
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)),
    [routeStops]
  );

  const displayedRoutePolyline = roadPolyline.length > 1 ? roadPolyline : routePolyline;
  const fromStop = routeStops.find((stop) => String(stop.stop_order) === String(fromOrder)) || null;
  const toStop = routeStops.find((stop) => String(stop.stop_order) === String(toOrder)) || null;
  const etaTargetStop = fromStop || routeStops[0] || null;
  const etaTargetPoint = etaTargetStop ? [Number(etaTargetStop.stop?.lat), Number(etaTargetStop.stop?.lng)] : null;

  const routeBuses = useMemo(
    () =>
      selectedRouteTrips
        .map((trip) => {
          const point = toLatLng(trip.latest_location);
          const eta = estimateEta(point, etaTargetPoint, displayedRoutePolyline, trip.latest_location?.speed);
          return {
            trip,
            point,
            eta,
          };
        })
        .filter((item) => item.point),
    [selectedRouteTrips, etaTargetPoint, displayedRoutePolyline]
  );

  const mapPoints = useMemo(() => {
    const all = [...displayedRoutePolyline];
    routeBuses.forEach((bus) => all.push(bus.point));
    return all;
  }, [displayedRoutePolyline, routeBuses]);

  const availableSeats = seats.filter((seat) => seat.available);
  const selectedSeatLabels = seats
    .filter((seat) => selectedSeatIds.includes(seat.seat_id))
    .map((seat) => seat.seat_no);
  const bookedSeatLabels = lastBookingSummary?.seats?.map((seat) => seat.seat_no) || [];
  const estimatedFare =
    lastBookingSummary?.fare_total || (selectedSeatIds.length > 0 && selectedTrip ? selectedSeatIds.length * 120 : 0);

  const loadTrips = async ({ silent = false } = {}) => {
    if (!silent) setLoadingTrips(true);

    try {
      const res = await api.get("/api/trips/live/");
      setTrips(res.data);
      setErr("");
    } catch (error) {
      setErr(error?.response?.data?.detail || "Unable to load live trips.");
    } finally {
      if (!silent) setLoadingTrips(false);
    }
  };

  const loadRouteContext = async (activeTripId) => {
    if (!activeTripId) {
      setRouteStops([]);
      return;
    }

    try {
      const tripDetail = await api.get(`/api/trips/${activeTripId}/`);
      setRouteStops(tripDetail.data.route_stops || []);
      setErr("");
    } catch (error) {
      setErr(error?.response?.data?.detail || "Unable to load route detail.");
      setRouteStops([]);
    }
  };

  const loadAvailability = async (activeTripId, activeFrom, activeTo) => {
    if (!activeTripId || !activeFrom || !activeTo) {
      setSeats([]);
      setSelectedSeatIds([]);
      return;
    }

    setLoadingAvailability(true);

    try {
      const res = await api.get(`/api/bookings/trips/${activeTripId}/availability/?from=${activeFrom}&to=${activeTo}`);
      setSeats(res.data.seats || []);
      setSelectedSeatIds([]);
      setErr("");
    } catch (error) {
      setErr(error?.response?.data?.detail || "Unable to load seat availability.");
      setSeats([]);
      setSelectedSeatIds([]);
    } finally {
      setLoadingAvailability(false);
    }
  };

  useEffect(() => {
    loadTrips();
    const intervalId = window.setInterval(() => {
      loadTrips({ silent: true });
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!liveRoutes.length) {
      setSelectedRouteId("");
      return;
    }

    if (!selectedRouteId || !liveRoutes.some((route) => String(route.route) === String(selectedRouteId))) {
      setSelectedRouteId(String(liveRoutes[0].route));
    }
  }, [liveRoutes, selectedRouteId]);

  useEffect(() => {
    if (!selectedRouteTrips.length) {
      setTripId("");
      return;
    }

    if (!selectedRouteTrips.some((trip) => String(trip.id) === String(tripId))) {
      setTripId(String(selectedRouteTrips[0].id));
    }
  }, [selectedRouteTrips, tripId]);

  useEffect(() => {
    loadRouteContext(selectedTrip?.id || "");
  }, [selectedTrip?.id]);

  useEffect(() => {
    setLastBookingId(null);
    setLastBookingSummary(null);
    setMsg("");
    setErr("");
    setSelectedSeatIds([]);
  }, [tripId]);

  useEffect(() => {
    if (routeStops.length < 2) {
      setFromOrder("");
      setToOrder("");
      return;
    }

    setFromOrder((current) => {
      if (routeStops.some((stop) => String(stop.stop_order) === String(current))) return current;
      return String(routeStops[0].stop_order);
    });

    setToOrder((current) => {
      const currentStop = routeStops.find((stop) => String(stop.stop_order) === String(current));
      if (currentStop && Number(currentStop.stop_order) > Number(routeStops[0].stop_order)) return current;
      return String(routeStops[1].stop_order);
    });
  }, [routeStops]);

  useEffect(() => {
    if (routePolyline.length < 2) {
      setRoadPolyline([]);
      setRoadRouteLoaded(false);
      return;
    }

    const controller = new AbortController();
    const coordinates = routePolyline.map(([lat, lng]) => `${lng},${lat}`).join(";");

    const loadRoadRoute = async () => {
      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Unable to fetch road route.");
        }

        const data = await response.json();
        const geometry = data?.routes?.[0]?.geometry?.coordinates || [];
        const snappedPath = geometry
          .map(([lng, lat]) => [Number(lat), Number(lng)])
          .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

        if (snappedPath.length > 1) {
          setRoadPolyline(snappedPath);
          setRoadRouteLoaded(true);
          return;
        }

        setRoadPolyline([]);
        setRoadRouteLoaded(false);
      } catch (error) {
        if (error.name === "AbortError") return;
        setRoadPolyline([]);
        setRoadRouteLoaded(false);
      }
    };

    loadRoadRoute();

    return () => controller.abort();
  }, [routePolyline]);

  useEffect(() => {
    if (!fromOrder || !toOrder) return;

    const fromNumber = Number(fromOrder);
    const toNumber = Number(toOrder);
    if (toNumber <= fromNumber) {
      const nextStop = routeStops.find((stop) => Number(stop.stop_order) > fromNumber);
      setToOrder(nextStop ? String(nextStop.stop_order) : "");
      return;
    }

    loadAvailability(tripId, fromOrder, toOrder);
  }, [tripId, fromOrder, toOrder, routeStops]);

  const toggleSeat = (seatId) => {
    setSelectedSeatIds((current) =>
      current.includes(seatId) ? current.filter((item) => item !== seatId) : [...current, seatId]
    );
  };

  const handleBookSeats = async () => {
    if (!tripId || !fromOrder || !toOrder || selectedSeatIds.length === 0) {
      setErr("Choose a bus, segment, and at least one seat first.");
      return;
    }

    setBookingBusy(true);
    setErr("");
    setMsg("");

    try {
      const res = await api.post(`/api/bookings/trips/${tripId}/book/`, {
        from_stop_order: Number(fromOrder),
        to_stop_order: Number(toOrder),
        seat_ids: selectedSeatIds,
      });

      setLastBookingId(res.data.id);
      setLastBookingSummary(res.data);
      setMsg(`Booking #${res.data.id} confirmed. Continue with payment below.`);
      await loadAvailability(tripId, fromOrder, toOrder);
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
      const res = await api.post("/api/payments/create/", {
        booking_id: lastBookingId,
        method,
      });

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

  if (loadingTrips) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dff3ff_0%,#eff6ff_42%,#f7fbff_100%)] px-4 py-8 text-slate-900">
        <div className="mx-auto max-w-md rounded-[2rem] bg-white p-8 text-center shadow-lg">
          Loading passenger dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dff3ff_0%,#eff6ff_42%,#f7fbff_100%)] text-slate-900">
      <div className="mx-auto max-w-md px-4 py-5 pb-8">
        <header className="rounded-[2rem] bg-white px-4 py-4 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.4)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-cyan-500 to-blue-700 text-lg font-black text-white">
                MB
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">MetroBus Rider</div>
                <div className="mt-1 text-2xl font-black text-slate-950">Passenger Side</div>
                <div className="mt-1 text-sm text-slate-500">{user?.full_name || "Passenger"}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => loadTrips()}
                className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-bold text-white"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {err ? (
          <div className="mt-4 rounded-[1.5rem] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {err}
          </div>
        ) : null}

        {msg ? (
          <div className="mt-4 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {msg}
          </div>
        ) : null}

        <div className="mt-5 space-y-5">
          <ShellCard className="overflow-hidden bg-gradient-to-br from-[#062b73] via-[#0f3ea4] to-[#1167d8] text-white">
            <div className="flex items-center justify-between gap-3">
              <StatusPill tone="green">Live Route Selection</StatusPill>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100/90">
                {selectedRouteTrips.length} bus{selectedRouteTrips.length === 1 ? "" : "es"} active
              </div>
            </div>

            <div className="mt-4 text-sm font-semibold uppercase tracking-[0.28em] text-blue-100/80">Choose route first</div>
            <select
              value={selectedRouteId}
              onChange={(event) => setSelectedRouteId(event.target.value)}
              className="mt-3 w-full rounded-[1.4rem] border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white outline-none"
            >
              {liveRoutes.length === 0 ? <option value="">No live routes</option> : null}
              {liveRoutes.map((route) => (
                <option key={route.route} value={route.route} className="text-slate-900">
                  {route.route_name} ({route.bus_count} bus{route.bus_count === 1 ? "" : "es"})
                </option>
              ))}
            </select>

            <div className="mt-5 text-4xl font-black leading-tight">
              {selectedRouteSummary?.route_name || "No live route available right now"}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-blue-100">
              <StatusPill tone="blue">Tracking all buses on this route</StatusPill>
              <StatusPill tone="amber">{etaTargetStop ? `Pickup ETA: ${etaTargetStop.stop?.name}` : "Choose your segment below"}</StatusPill>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-[1.5rem] bg-white/10 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100/80">Selected bus</div>
                <div className="mt-2 text-sm font-semibold text-white">{selectedTrip?.bus_plate || "Choose a bus"}</div>
              </div>
              <div className="rounded-[1.5rem] bg-white/10 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100/80">Last GPS</div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {latestLocation ? formatDateTime(latestLocation.recorded_at) : "Waiting for update"}
                </div>
              </div>
            </div>
          </ShellCard>

          <ShellCard>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Route Fleet</div>
                <div className="mt-1 text-2xl font-black text-slate-950">Live buses on this route</div>
              </div>
              <StatusPill tone={routeBuses.length ? "green" : "slate"}>
                {routeBuses.length ? "Live positions available" : "No GPS yet"}
              </StatusPill>
            </div>

            <div className="mt-4 space-y-3">
              {selectedRouteTrips.map((trip) => {
                const liveBus = routeBuses.find((item) => item.trip.id === trip.id);
                const isActive = String(trip.id) === String(selectedTrip?.id);

                return (
                  <button
                    key={trip.id}
                    type="button"
                    onClick={() => setTripId(String(trip.id))}
                    className={`w-full rounded-[1.6rem] border p-4 text-left transition ${
                      isActive
                        ? "border-blue-700 bg-blue-50 shadow-[0_18px_32px_-24px_rgba(29,78,216,0.7)]"
                        : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-black text-slate-950">Bus {trip.bus_plate}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          Driver {trip.driver_name || "-"} | Helper {trip.helper_name || "-"}
                        </div>
                      </div>
                      <StatusPill tone={isActive ? "blue" : "green"}>{formatEtaLabel(liveBus?.eta)}</StatusPill>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-[1.2rem] bg-white px-3 py-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">GPS updated</div>
                        <div className="mt-2 font-semibold text-slate-900">
                          {formatDateTime(trip.latest_location?.recorded_at)}
                        </div>
                      </div>
                      <div className="rounded-[1.2rem] bg-white px-3 py-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Estimated arrival</div>
                        <div className="mt-2 font-semibold text-slate-900">{formatEtaLabel(liveBus?.eta)}</div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {selectedRouteTrips.length === 0 ? (
                <div className="rounded-[1.35rem] bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  No live buses are currently running on the selected route.
                </div>
              ) : null}
            </div>
          </ShellCard>

          <ShellCard>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Journey Tracker</div>
                <div className="mt-1 text-2xl font-black text-slate-950">Live route map</div>
              </div>
              {roadRouteLoaded ? (
                <StatusPill tone="green">Road route loaded</StatusPill>
              ) : routeBuses.length ? (
                <StatusPill tone="green">Dynamic bus locations</StatusPill>
              ) : (
                <StatusPill tone="slate">No live GPS yet</StatusPill>
              )}
            </div>

            <div className="mt-4 overflow-hidden rounded-[1.6rem] border border-slate-200">
              <div className="h-72 w-full bg-slate-100">
                <MapContainer center={[28.2096, 83.9856]} zoom={13} scrollWheelZoom={false} className="h-full w-full">
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapViewport points={mapPoints} />
                  {displayedRoutePolyline.length > 0 ? (
                    <Polyline positions={displayedRoutePolyline} pathOptions={{ color: "#1d4ed8", weight: 5 }} />
                  ) : null}

                  {routeStops.map((item) => {
                    const lat = Number(item.stop?.lat);
                    const lng = Number(item.stop?.lng);
                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

                    const isPickup = String(item.stop_order) === String(fromOrder);
                    const isDrop = String(item.stop_order) === String(toOrder);
                    const fillColor = isPickup ? "#22c55e" : isDrop ? "#f59e0b" : "#2dd4bf";

                    return (
                      <CircleMarker
                        key={`${item.stop_order}-${item.stop?.id || item.stop?.name}`}
                        center={[lat, lng]}
                        radius={isPickup || isDrop ? 9 : 7}
                        pathOptions={{ color: "#0f766e", fillColor, fillOpacity: 0.95 }}
                      >
                        <Popup>
                          Stop {item.stop_order}: {item.stop?.name}
                        </Popup>
                      </CircleMarker>
                    );
                  })}

                  {routeBuses.map((bus) => (
                    <CircleMarker
                      key={bus.trip.id}
                      center={bus.point}
                      radius={String(bus.trip.id) === String(selectedTrip?.id) ? 10 : 8}
                      pathOptions={{
                        color: String(bus.trip.id) === String(selectedTrip?.id) ? "#991b1b" : "#1d4ed8",
                        fillColor: String(bus.trip.id) === String(selectedTrip?.id) ? "#ef4444" : "#60a5fa",
                        fillOpacity: 1,
                      }}
                    >
                      <Popup>
                        <div className="space-y-1">
                          <div className="font-bold">Bus {bus.trip.bus_plate}</div>
                          <div>{formatEtaLabel(bus.eta)}</div>
                          <div>Updated: {formatDateTime(bus.trip.latest_location?.recorded_at)}</div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {routeStops.map((item) => (
                <span key={item.stop_order} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                  {item.stop_order}. {item.stop?.name}
                </span>
              ))}
            </div>
          </ShellCard>

          <ShellCard>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Segment Planner</div>
                <div className="mt-1 text-2xl font-black text-slate-950">Choose your ride section</div>
              </div>
              <StatusPill tone="blue">Segment-based seats</StatusPill>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Pickup</label>
                <select
                  value={fromOrder}
                  onChange={(event) => setFromOrder(event.target.value)}
                  className="w-full rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none"
                >
                  {routeStops.map((stop) => (
                    <option key={stop.stop_order} value={stop.stop_order}>
                      {stop.stop_order}. {stop.stop?.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Destination</label>
                <select
                  value={toOrder}
                  onChange={(event) => setToOrder(event.target.value)}
                  className="w-full rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none"
                >
                  {routeStops.map((stop) => (
                    <option key={stop.stop_order} value={stop.stop_order}>
                      {stop.stop_order}. {stop.stop?.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-[1.35rem] bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Open seats</div>
                <div className="mt-2 text-3xl font-black text-slate-950">{availableSeats.length}</div>
              </div>
              <div className="rounded-[1.35rem] bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Selected</div>
                <div className="mt-2 text-3xl font-black text-slate-950">{selectedSeatIds.length}</div>
              </div>
              <div className="rounded-[1.35rem] bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Fare est.</div>
                <div className="mt-2 text-xl font-black text-slate-950">{formatMoney(estimatedFare)}</div>
              </div>
            </div>

            <div className="mt-4 rounded-[1.35rem] bg-blue-50 px-4 py-3 text-sm text-blue-900">
              From <span className="font-bold">{fromStop?.stop?.name || "-"}</span> to <span className="font-bold">{toStop?.stop?.name || "-"}</span>
            </div>
          </ShellCard>

          <ShellCard>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Seat Studio</div>
                <div className="mt-1 text-2xl font-black text-slate-950">Pick your seats</div>
              </div>
              {loadingAvailability ? <StatusPill tone="amber">Refreshing seats</StatusPill> : <StatusPill tone="green">Live availability</StatusPill>}
            </div>

            <div className="mt-4 grid grid-cols-4 gap-3">
              {seats.map((seat) => (
                <SeatPill
                  key={seat.seat_id}
                  seat={seat}
                  selected={selectedSeatIds.includes(seat.seat_id)}
                  onClick={() => toggleSeat(seat.seat_id)}
                />
              ))}
            </div>

            {seats.length === 0 ? (
              <div className="mt-4 rounded-[1.35rem] bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Select a valid bus and route segment to view seats.
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <StatusPill tone="blue">Blue = available</StatusPill>
              <StatusPill tone="green">Dark = selected</StatusPill>
              <StatusPill tone="slate">Grey = occupied</StatusPill>
            </div>

            <button
              type="button"
              onClick={handleBookSeats}
              disabled={bookingBusy || selectedSeatIds.length === 0}
              className="mt-5 w-full rounded-[1.5rem] bg-slate-950 px-4 py-4 text-base font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bookingBusy ? "Confirming booking..." : "Confirm selected seats"}
            </button>
          </ShellCard>

          <ShellCard className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">Checkout</div>
                <div className="mt-1 text-2xl font-black">Payment and summary</div>
              </div>
              {lastBookingId ? <StatusPill tone="green">Booking #{lastBookingId}</StatusPill> : <StatusPill tone="amber">Book seats first</StatusPill>}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-[1.4rem] bg-white/10 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">Passenger</div>
                <div className="mt-2 text-sm font-semibold">{user?.full_name || "Passenger"}</div>
              </div>
              <div className="rounded-[1.4rem] bg-white/10 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">Bus</div>
                <div className="mt-2 text-sm font-semibold">
                  {selectedTrip?.route_name || "-"} | {selectedTrip?.bus_plate || "-"}
                </div>
              </div>
              <div className="rounded-[1.4rem] bg-white/10 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">Segment</div>
                <div className="mt-2 text-sm font-semibold">
                  {fromStop?.stop?.name || "-"} to {toStop?.stop?.name || "-"}
                </div>
              </div>
              <div className="rounded-[1.4rem] bg-white/10 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">Seats</div>
                <div className="mt-2 text-sm font-semibold">
                  {selectedSeatLabels.join(", ") || bookedSeatLabels.join(", ") || "No seat locked yet"}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-[1.5rem] bg-white/10 px-4 py-4">
              <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
                <span>Total fare</span>
                <span className="text-2xl font-black text-white">{formatMoney(lastBookingSummary?.fare_total || estimatedFare)}</span>
              </div>
              <div className="mt-2 text-xs text-slate-300">Sandbox payments are supported for eSewa and Khalti. Cash stays pending until helper/admin verification.</div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <PaymentButton label={paymentBusy ? "Processing..." : "Cash"} tone="dark" onClick={() => handlePayment("CASH")} disabled={paymentBusy || !lastBookingId} />
              <PaymentButton label={paymentBusy ? "Processing..." : "Mock Online"} tone="green" onClick={() => handlePayment("MOCK_ONLINE")} disabled={paymentBusy || !lastBookingId} />
              <PaymentButton label={paymentBusy ? "Processing..." : "eSewa"} tone="yellow" onClick={() => handlePayment("ESEWA")} disabled={paymentBusy || !lastBookingId} />
              <PaymentButton label={paymentBusy ? "Processing..." : "Khalti"} tone="blue" onClick={() => handlePayment("KHALTI")} disabled={paymentBusy || !lastBookingId} />
            </div>
          </ShellCard>
        </div>
      </div>
    </div>
  );
}
