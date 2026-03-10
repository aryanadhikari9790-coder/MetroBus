import { useEffect, useState } from "react";
import { api } from "../../api";
import { getToken } from "../../auth";
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

export default function HelperHome() {
  const nav = useNavigate();
  const [trips, setTrips] = useState([]);
  const [tripId, setTripId] = useState(null);
  const [routeStops, setRouteStops] = useState([]);

  const [fromOrder, setFromOrder] = useState(1);
  const [toOrder, setToOrder] = useState(2);
  const [seats, setSeats] = useState([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const isLoggedIn = !!getToken();

  useEffect(() => {
    const loadTrips = async () => {
      try {
        const res = await api.get("/api/trips/live/");
        setTrips(res.data);
        if (!tripId && res.data.length > 0) setTripId(res.data[0].id);
      } catch {
        // ignore
      }
    };
    loadTrips();
    const t = setInterval(loadTrips, 7000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadTripDetail = async () => {
      if (!tripId) return;
      try {
        const res = await api.get(`/api/trips/${tripId}/`);
        const stops = res.data.route_stops || [];
        setRouteStops(stops);

        if (stops.length >= 2) {
          setFromOrder(stops[0].stop_order);
          setToOrder(stops[stops.length - 1].stop_order);
        }
      } catch {
        setRouteStops([]);
      }
    };
    loadTripDetail();
  }, [tripId]);

  const loadAvailability = async () => {
    setErr("");
    setMsg("");
    setSelectedSeatIds([]);
    if (!tripId) return;
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
      setErr("Failed to load seat availability.");
    }
  };

  useEffect(() => {
    if (tripId) loadAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, fromOrder, toOrder]);

  const toggleSeat = (seatId) => {
    setSelectedSeatIds((prev) =>
      prev.includes(seatId) ? prev.filter((x) => x !== seatId) : [...prev, seatId]
    );
  };

  const submitOffline = async () => {
    setErr("");
    setMsg("");

    if (!isLoggedIn) {
      setErr("Helper must login first.");
      nav("/auth/login");
      return;
    }
    if (!tripId) return;
    if (selectedSeatIds.length === 0) {
      setErr("Select at least one seat.");
      return;
    }

    try {
      await api.post(`/api/bookings/trips/${tripId}/offline/`, {
        from_stop_order: fromOrder,
        to_stop_order: toOrder,
        seat_ids: selectedSeatIds,
      });
      setMsg(`Offline boarding saved for ${selectedSeatIds.length} seat(s).`);
      await loadAvailability();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Offline update failed.");
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-brand-bg dark:text-brand-text">
      <div className="mx-auto max-w-md px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Helper</h1>
          <button
            className="rounded-xl border px-3 py-2 text-xs font-semibold dark:border-slate-800"
            onClick={() => document.documentElement.classList.toggle("dark")}
          >
            Theme
          </button>
        </div>

        <p className="mt-1 text-sm text-slate-500 dark:text-brand-muted">
          Update seat occupancy for offline passengers.
        </p>

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

        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-brand-card">
          <label className="text-xs font-semibold text-slate-500 dark:text-brand-muted">
            Live Trip
          </label>
          <select
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-brand-bg"
            value={tripId ?? ""}
            onChange={(e) => setTripId(Number(e.target.value))}
          >
            {trips.length === 0 ? <option value="">No LIVE trips</option> : null}
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                #{t.id} • {t.route_name} • {t.bus_plate}
              </option>
            ))}
          </select>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-brand-muted">
                From stop
              </label>
              <select
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-brand-bg"
                value={fromOrder}
                onChange={(e) => setFromOrder(Number(e.target.value))}
              >
                {routeStops.map((rs) => (
                  <option key={rs.stop_order} value={rs.stop_order}>
                    {rs.stop.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-brand-muted">
                To stop
              </label>
              <select
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-brand-bg"
                value={toOrder}
                onChange={(e) => setToOrder(Number(e.target.value))}
              >
                {routeStops.map((rs) => (
                  <option key={rs.stop_order} value={rs.stop_order}>
                    {rs.stop.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800"
            onClick={loadAvailability}
          >
            Refresh Availability
          </button>
        </div>

        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-brand-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Select occupied seats</h2>
            <div className="text-xs text-slate-500 dark:text-brand-muted">
              Selected: {selectedSeatIds.length}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-5 gap-2">
            {seats.map((s) => (
              <SeatPill
                key={s.seat_id}
                seat={s}
                selected={selectedSeatIds.includes(s.seat_id)}
                onClick={() => toggleSeat(s.seat_id)}
              />
            ))}
          </div>

          <button
            className="mt-4 w-full rounded-2xl bg-brand-accent px-4 py-3 font-semibold text-slate-900 disabled:opacity-50"
            onClick={submitOffline}
            disabled={seats.length === 0}
          >
            Save Offline Boarding
          </button>
        </div>
      </div>
    </div>
  );
}
