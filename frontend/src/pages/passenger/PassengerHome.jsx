import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from "react-leaflet";
import { api } from "../../api";
import { clearToken, getToken } from "../../auth";
import { useNavigate } from "react-router-dom";

function SeatPill({ seat, selected, onClick }) {
  const base =
    "rounded-xl border px-3 py-2 text-sm font-semibold active:scale-[0.98] transition";
  if (!seat.available) {
    return (
      <button
        disabled
        className={`${base} border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-500`}
      >
        {seat.seat_no}
      </button>
    );
  }
  if (selected) {
    return (
      <button
        onClick={onClick}
        className={`${base} border-transparent bg-brand-accent text-slate-900`}
      >
        {seat.seat_no}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className={`${base} border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-brand-card dark:text-brand-text`}
    >
      {seat.seat_no}
    </button>
  );
}

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function MapViewport({ routeStops, latestLocation }) {
  const map = useMap();

  useEffect(() => {
    const points = routeStops.map((stop) => [Number(stop.stop.lat), Number(stop.stop.lng)]);
    if (latestLocation) {
      points.push([Number(latestLocation.lat), Number(latestLocation.lng)]);
    }

    if (points.length >= 2) {
      map.fitBounds(points, { padding: [24, 24] });
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], 15);
    }
  }, [map, routeStops, latestLocation]);

  return null;
}

export default function PassengerHome() {
  const nav = useNavigate();

  const [trips, setTrips] = useState([]);
  const [tripId, setTripId] = useState(null);
  const [routeStops, setRouteStops] = useState([]);
  const [fromOrder, setFromOrder] = useState(1);
  const [toOrder, setToOrder] = useState(2);
  const [latestLocation, setLatestLocation] = useState(null);
  const [locationInfo, setLocationInfo] = useState("");

  const [seats, setSeats] = useState([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [lastBookingId, setLastBookingId] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("");

  const isLoggedIn = !!getToken();
  const selectedTrip = trips.find((trip) => trip.id === tripId) || null;

  const routePolyline = useMemo(
    () => routeStops.map((stop) => [Number(stop.stop.lat), Number(stop.stop.lng)]),
    [routeStops]
  );

  const mapCenter = useMemo(() => {
    if (latestLocation) {
      return [Number(latestLocation.lat), Number(latestLocation.lng)];
    }
    if (routePolyline.length > 0) {
      return routePolyline[0];
    }
    return [28.2096, 83.9594];
  }, [latestLocation, routePolyline]);

  const loadTrips = async () => {
    try {
      const res = await api.get("/api/trips/live/");
      setTrips(res.data);
      setTripId((currentTripId) => {
        if (res.data.length === 0) return null;
        if (currentTripId && res.data.some((trip) => trip.id === currentTripId)) {
          return currentTripId;
        }
        return res.data[0].id;
      });
    } catch {
      // ignore background refresh issues for now
    }
  };

  useEffect(() => {
    loadTrips();
    const intervalId = window.setInterval(loadTrips, 7000);
    return () => window.clearInterval(intervalId);
  }, []);

  const loadTripDetail = async () => {
    if (!tripId) {
      setRouteStops([]);
      return;
    }

    try {
      const res = await api.get(`/api/trips/${tripId}/`);
      const stops = res.data.route_stops || [];
      setRouteStops(stops);

      if (stops.length >= 2) {
        setFromOrder((current) => {
          const available = stops.some((stop) => stop.stop_order === current);
          return available ? current : stops[0].stop_order;
        });
        setToOrder((current) => {
          const available = stops.some((stop) => stop.stop_order === current);
          return available ? current : stops[stops.length - 1].stop_order;
        });
      }
    } catch {
      setRouteStops([]);
    }
  };

  const loadLatestLocation = async () => {
    if (!tripId) {
      setLatestLocation(null);
      setLocationInfo("");
      return;
    }

    try {
      const res = await api.get(`/api/trips/${tripId}/location/latest/`);
      setLatestLocation(res.data);
      setLocationInfo(`Bus updated ${formatDateTime(res.data.recorded_at)}`);
    } catch {
      setLatestLocation(null);
      setLocationInfo("No live bus location yet.");
    }
  };

  const loadAvailability = async () => {
    setErr("");
    setMsg("");
    setSelectedSeatIds([]);
    if (!tripId) {
      setErr("No LIVE trips right now. Start a trip as driver.");
      return;
    }
    if (toOrder <= fromOrder) {
      setErr("Destination must be after pickup.");
      return;
    }
    try {
      const res = await api.get(
        `/api/bookings/trips/${tripId}/availability/?from=${fromOrder}&to=${toOrder}`
      );
      setSeats(res.data.seats);
    } catch {
      setErr("Failed to load availability.");
    }
  };

  useEffect(() => {
    loadTripDetail();
    loadLatestLocation();
  }, [tripId]);

  useEffect(() => {
    if (!tripId) return;
    const intervalId = window.setInterval(() => {
      loadLatestLocation();
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, [tripId]);

  useEffect(() => {
    if (!tripId) return;
    if (toOrder <= fromOrder) return;
    loadAvailability();
  }, [tripId, fromOrder, toOrder]);

  const toggleSeat = (seatId) => {
    setSelectedSeatIds((prev) =>
      prev.includes(seatId) ? prev.filter((x) => x !== seatId) : [...prev, seatId]
    );
  };

  const book = async () => {
    setErr("");
    setMsg("");

    if (!isLoggedIn) {
      setErr("Please login first.");
      nav("/auth/login");
      return;
    }
    if (!tripId) return;
    if (selectedSeatIds.length === 0) {
      setErr("Select at least one seat.");
      return;
    }

    try {
      const res = await api.post(`/api/bookings/trips/${tripId}/book/`, {
        from_stop_order: fromOrder,
        to_stop_order: toOrder,
        seat_ids: selectedSeatIds,
      });
      setMsg(
        `Booked ${res.data.seats_count} seat(s). Booking #${res.data.id}. Total Rs ${res.data.fare_total}`
      );
      setLastBookingId(res.data.id);
      setPaymentStatus("");

      await loadAvailability();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Booking failed.");
    }
  };

  const createPayment = async (method) => {
    setErr("");
    setPaymentStatus("");
    if (!lastBookingId) return;

    try {
      const res = await api.post("/api/payments/create/", {
        booking_id: lastBookingId,
        method,
      });

      const redirect = res.data.redirect;

      if (!redirect) {
        setPaymentStatus(`Payment created: ${res.data.payment.method} -> ${res.data.payment.status}`);
        return;
      }

      if (redirect.type === "REDIRECT") {
        window.location.href = redirect.url;
        return;
      }

      if (redirect.type === "FORM_POST") {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = redirect.url;

        Object.entries(redirect.fields).forEach(([k, v]) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = k;
          input.value = String(v);
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
        return;
      }

      setPaymentStatus("Unknown redirect type.");
    } catch (e) {
      setErr(e?.response?.data?.detail || "Payment failed.");
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-brand-bg dark:text-brand-text">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold">Passenger</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-brand-muted">
              Track a live bus, pick your segment, then reserve seats and pay.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-xl border px-3 py-2 text-xs font-semibold dark:border-slate-800"
              onClick={() => document.documentElement.classList.toggle("dark")}
            >
              Theme
            </button>
            {isLoggedIn ? (
              <button
                className="rounded-xl border px-3 py-2 text-xs font-semibold dark:border-slate-800"
                onClick={() => {
                  clearToken();
                  setMsg("Logged out.");
                }}
              >
                Logout
              </button>
            ) : (
              <button
                className="rounded-xl bg-brand-accent px-3 py-2 text-xs font-semibold text-slate-900"
                onClick={() => nav("/auth/login")}
              >
                Login
              </button>
            )}
          </div>
        </div>

        {err ? (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {err}
          </div>
        ) : null}

        {msg ? (
          <div className="mt-3 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-200">
            {msg}
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-brand-card">
              <label className="text-xs font-semibold text-slate-500 dark:text-brand-muted">
                Live Trip
              </label>
              <select
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-brand-bg"
                value={tripId ?? ""}
                onChange={(e) => setTripId(Number(e.target.value))}
              >
                {trips.length === 0 ? <option value="">No LIVE trips</option> : null}
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    #{trip.id} • {trip.route_name} • {trip.bus_plate}
                  </option>
                ))}
              </select>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-brand-bg">
                  <div className="text-xs text-slate-500 dark:text-brand-muted">Route</div>
                  <div className="mt-1 font-semibold">{selectedTrip?.route_name || "-"}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-brand-bg">
                  <div className="text-xs text-slate-500 dark:text-brand-muted">Bus</div>
                  <div className="mt-1 font-semibold">{selectedTrip?.bus_plate || "-"}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-brand-bg">
                  <div className="text-xs text-slate-500 dark:text-brand-muted">Live Status</div>
                  <div className="mt-1 font-semibold">{locationInfo || "Waiting for update"}</div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-brand-card">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold">Live Route Map</h2>
                <button
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-800"
                  onClick={loadLatestLocation}
                  disabled={!tripId}
                >
                  Refresh Bus Location
                </button>
              </div>

              <div className="mt-3 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800">
                <MapContainer
                  center={mapCenter}
                  zoom={14}
                  scrollWheelZoom
                  className="h-[320px] w-full"
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapViewport routeStops={routeStops} latestLocation={latestLocation} />
                  {routePolyline.length >= 2 ? (
                    <Polyline positions={routePolyline} pathOptions={{ color: "#22D3EE", weight: 5 }} />
                  ) : null}
                  {routeStops.map((stop) => (
                    <CircleMarker
                      key={stop.stop.id}
                      center={[Number(stop.stop.lat), Number(stop.stop.lng)]}
                      radius={7}
                      pathOptions={{ color: "#0f172a", fillColor: "#f8fafc", fillOpacity: 1, weight: 2 }}
                    >
                      <Popup>
                        <div className="text-sm font-semibold">{stop.stop.name}</div>
                        <div className="text-xs text-slate-500">Stop order {stop.stop_order}</div>
                      </Popup>
                    </CircleMarker>
                  ))}
                  {latestLocation ? (
                    <CircleMarker
                      center={[Number(latestLocation.lat), Number(latestLocation.lng)]}
                      radius={10}
                      pathOptions={{ color: "#16a34a", fillColor: "#22c55e", fillOpacity: 1, weight: 2 }}
                    >
                      <Popup>
                        <div className="text-sm font-semibold">Live Bus</div>
                        <div className="text-xs text-slate-500">
                          Updated {formatDateTime(latestLocation.recorded_at)}
                        </div>
                      </Popup>
                    </CircleMarker>
                  ) : null}
                </MapContainer>
              </div>

              <p className="mt-3 text-xs text-slate-500 dark:text-brand-muted">
                White markers are route stops. Green marker is the latest live bus position.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-brand-card">
              <h2 className="text-sm font-bold">Trip Segment</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-brand-muted">
                    Pickup Stop
                  </label>
                  <select
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-brand-bg"
                    value={fromOrder}
                    onChange={(e) => setFromOrder(Number(e.target.value))}
                  >
                    {routeStops.map((stop) => (
                      <option key={stop.stop_order} value={stop.stop_order}>
                        {stop.stop.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-brand-muted">
                    Destination Stop
                  </label>
                  <select
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-brand-bg"
                    value={toOrder}
                    onChange={(e) => setToOrder(Number(e.target.value))}
                  >
                    {routeStops.map((stop) => (
                      <option key={stop.stop_order} value={stop.stop_order}>
                        {stop.stop.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800"
                onClick={loadAvailability}
              >
                Refresh Seat Availability
              </button>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-brand-card">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold">Select Seats</h2>
                <div className="text-xs text-slate-500 dark:text-brand-muted">
                  Selected: {selectedSeatIds.length}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-5 gap-2">
                {seats.map((seat) => (
                  <SeatPill
                    key={seat.seat_id}
                    seat={seat}
                    selected={selectedSeatIds.includes(seat.seat_id)}
                    onClick={() => toggleSeat(seat.seat_id)}
                  />
                ))}
              </div>

              <button
                className="mt-4 w-full rounded-2xl bg-brand-accent px-4 py-3 font-semibold text-slate-900 disabled:opacity-50"
                onClick={book}
                disabled={seats.length === 0}
              >
                Book Selected Seats
              </button>

              {lastBookingId ? (
                <div className="mt-4 rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                  <div className="text-sm font-semibold">Payment</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-brand-muted">
                    Booking #{lastBookingId}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      className="rounded-2xl bg-brand-accent px-3 py-3 text-sm font-semibold text-slate-900"
                      onClick={() => createPayment("MOCK_ONLINE")}
                    >
                      Pay Online (Mock)
                    </button>

                    <button
                      className="rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold dark:border-slate-800"
                      onClick={() => createPayment("CASH")}
                    >
                      Cash
                    </button>

                    <button
                      className="rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold dark:border-slate-800"
                      onClick={() => createPayment("ESEWA")}
                    >
                      eSewa (Sandbox)
                    </button>

                    <button
                      className="rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold dark:border-slate-800"
                      onClick={() => createPayment("KHALTI")}
                    >
                      Khalti (Sandbox)
                    </button>
                  </div>

                  {paymentStatus ? (
                    <div className="mt-3 text-xs text-slate-600 dark:text-brand-muted">
                      {paymentStatus}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <p className="mt-3 text-xs text-slate-500 dark:text-brand-muted">
                Seat availability updates by pickup-to-destination segment, so riders can board and leave mid-route.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
