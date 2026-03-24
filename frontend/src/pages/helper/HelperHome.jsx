import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../AuthContext";
import { clearToken } from "../../auth";

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
      ? "border-emerald-700 bg-emerald-700 text-white"
      : "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
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
        {available ? (selected ? "Marked" : "Open") : "Taken"}
      </div>
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

export default function HelperHome() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [trips, setTrips] = useState([]);
  const [tripId, setTripId] = useState("");
  const [routeStops, setRouteStops] = useState([]);
  const [latestLocation, setLatestLocation] = useState(null);
  const [fromOrder, setFromOrder] = useState("");
  const [toOrder, setToOrder] = useState("");
  const [seats, setSeats] = useState([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [offlineBusy, setOfflineBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyBookingId, setVerifyBookingId] = useState("");
  const [verifiedPayment, setVerifiedPayment] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const selectedTrip = useMemo(
    () => trips.find((trip) => String(trip.id) === String(tripId)) || null,
    [trips, tripId]
  );

  const availableSeats = seats.filter((seat) => seat.available);
  const occupiedCount = seats.length - availableSeats.length;
  const fromStop = routeStops.find((stop) => String(stop.stop_order) === String(fromOrder)) || null;
  const toStop = routeStops.find((stop) => String(stop.stop_order) === String(toOrder)) || null;
  const selectedSeatLabels = seats
    .filter((seat) => selectedSeatIds.includes(seat.seat_id))
    .map((seat) => seat.seat_no);

  const loadTrips = async ({ silent = false } = {}) => {
    if (!silent) setLoadingTrips(true);

    try {
      const res = await api.get("/api/trips/live/");
      setTrips(res.data);
      setErr("");

      if (!tripId && res.data.length > 0) {
        setTripId(String(res.data[0].id));
      } else if (tripId && !res.data.some((trip) => String(trip.id) === String(tripId))) {
        setTripId(res.data[0] ? String(res.data[0].id) : "");
      }
    } catch (error) {
      setErr(error?.response?.data?.detail || "Unable to load live trips.");
    } finally {
      if (!silent) setLoadingTrips(false);
    }
  };

  const loadTripContext = async (activeTripId) => {
    if (!activeTripId) {
      setRouteStops([]);
      setLatestLocation(null);
      return;
    }

    try {
      const [tripDetail, latestLoc] = await Promise.all([
        api.get(`/api/trips/${activeTripId}/`),
        api.get(`/api/trips/${activeTripId}/location/latest/`).catch(() => null),
      ]);

      setRouteStops(tripDetail.data.route_stops || []);
      setLatestLocation(latestLoc?.data || null);
      setErr("");
    } catch (error) {
      setErr(error?.response?.data?.detail || "Unable to load helper trip context.");
      setRouteStops([]);
      setLatestLocation(null);
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
    }, 20000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    loadTripContext(tripId);

    if (!tripId) return undefined;

    const intervalId = window.setInterval(() => {
      loadTripContext(tripId);
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [tripId]);

  useEffect(() => {
    if (routeStops.length < 2) {
      setFromOrder("");
      setToOrder("");
      return;
    }

    setFromOrder((current) => current || String(routeStops[0].stop_order));
    setToOrder((current) => {
      if (current) return current;
      return String(routeStops[1].stop_order);
    });
  }, [routeStops]);

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
  }, [tripId, fromOrder, toOrder]);

  const toggleSeat = (seatId) => {
    setSelectedSeatIds((current) =>
      current.includes(seatId) ? current.filter((item) => item !== seatId) : [...current, seatId]
    );
  };

  const submitOffline = async () => {
    if (!tripId || !fromOrder || !toOrder || selectedSeatIds.length === 0) {
      setErr("Choose a trip, a valid segment, and at least one seat first.");
      return;
    }

    setOfflineBusy(true);
    setErr("");
    setMsg("");

    try {
      const res = await api.post(`/api/bookings/trips/${tripId}/offline/`, {
        from_stop_order: Number(fromOrder),
        to_stop_order: Number(toOrder),
        seat_ids: selectedSeatIds,
      });

      setMsg(
        `Offline boarding #${res.data.offline_boarding.id} saved for ${res.data.offline_boarding.seats_count} seat(s).`
      );
      await loadAvailability(tripId, fromOrder, toOrder);
    } catch (error) {
      setErr(error?.response?.data?.detail || "Offline update failed.");
    } finally {
      setOfflineBusy(false);
    }
  };

  const verifyCashPayment = async () => {
    if (!verifyBookingId.trim()) {
      setErr("Enter a booking ID to verify cash payment.");
      return;
    }

    setVerifyBusy(true);
    setErr("");
    setMsg("");
    setVerifiedPayment(null);

    try {
      const res = await api.post(`/api/payments/cash/verify/${verifyBookingId.trim()}/`);
      setVerifiedPayment(res.data);
      setMsg(`Cash payment for booking #${verifyBookingId.trim()} verified successfully.`);
    } catch (error) {
      setErr(error?.response?.data?.detail || "Cash verification failed.");
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
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#e4fff4_0%,#effcf7_42%,#f7fbff_100%)] px-4 py-8 text-slate-900">
        <div className="mx-auto max-w-md rounded-[2rem] bg-white p-8 text-center shadow-lg">
          Loading helper dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#e4fff4_0%,#effcf7_42%,#f7fbff_100%)] text-slate-900">
      <div className="mx-auto max-w-md px-4 py-5 pb-8">
        <header className="rounded-[2rem] bg-white px-4 py-4 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.4)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-emerald-500 to-teal-700 text-lg font-black text-white">
                HP
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">MetroBus Ops</div>
                <div className="mt-1 text-2xl font-black text-slate-950">Helper Side</div>
                <div className="mt-1 text-sm text-slate-500">{user?.full_name || "Helper"}</div>
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
          <ShellCard className="overflow-hidden bg-gradient-to-br from-[#0e5f49] via-[#0a7357] to-[#11977b] text-white">
            <div className="flex items-center justify-between gap-3">
              <StatusPill tone="green">On Trip Duty</StatusPill>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100/90">
                {selectedTrip?.status || "Waiting"}
              </div>
            </div>

            <div className="mt-4 text-sm font-semibold uppercase tracking-[0.28em] text-emerald-100/80">Select live trip</div>
            <select
              value={tripId}
              onChange={(event) => {
                setTripId(event.target.value);
                setMsg("");
                setErr("");
                setVerifiedPayment(null);
              }}
              className="mt-3 w-full rounded-[1.4rem] border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white outline-none"
            >
              {trips.length === 0 ? <option value="">No live trips</option> : null}
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id} className="text-slate-900">
                  {trip.route_name} | {trip.bus_plate}
                </option>
              ))}
            </select>

            <div className="mt-5 text-4xl font-black leading-tight">
              {selectedTrip?.route_name || "No active trip available right now"}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-emerald-100">
              <StatusPill tone="blue">Bus {selectedTrip?.bus_plate || "-"}</StatusPill>
              <StatusPill tone="amber">Driver {selectedTrip?.driver_name || "-"}</StatusPill>
              <StatusPill tone="green">Trip #{selectedTrip?.id || "-"}</StatusPill>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-[1.5rem] bg-white/10 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100/80">Started</div>
                <div className="mt-2 text-sm font-semibold text-white">{formatDateTime(selectedTrip?.started_at)}</div>
              </div>
              <div className="rounded-[1.5rem] bg-white/10 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100/80">Last GPS</div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {latestLocation ? formatDateTime(latestLocation.recorded_at) : "Waiting for update"}
                </div>
              </div>
            </div>
          </ShellCard>

          <div className="grid grid-cols-3 gap-3">
            <ShellCard className="p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Open seats</div>
              <div className="mt-2 text-3xl font-black text-slate-950">{availableSeats.length}</div>
            </ShellCard>
            <ShellCard className="p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Occupied</div>
              <div className="mt-2 text-3xl font-black text-slate-950">{occupiedCount}</div>
            </ShellCard>
            <ShellCard className="p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Marked</div>
              <div className="mt-2 text-3xl font-black text-slate-950">{selectedSeatIds.length}</div>
            </ShellCard>
          </div>

          <ShellCard>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Offline Boarding</div>
                <div className="mt-1 text-2xl font-black text-slate-950">Segment workspace</div>
              </div>
              {loadingAvailability ? <StatusPill tone="amber">Refreshing</StatusPill> : <StatusPill tone="green">Ready</StatusPill>}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">From stop</label>
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
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">To stop</label>
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

            <div className="mt-4 rounded-[1.35rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Segment: <span className="font-bold">{fromStop?.stop?.name || "-"}</span> to <span className="font-bold">{toStop?.stop?.name || "-"}</span>
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
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Seat Control</div>
                <div className="mt-1 text-2xl font-black text-slate-950">Mark offline passengers</div>
              </div>
              <StatusPill tone="blue">{selectedSeatLabels.length ? selectedSeatLabels.join(", ") : "No seats marked"}</StatusPill>
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
                Select a live trip and valid segment to view seats.
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <StatusPill tone="green">Green = can be marked</StatusPill>
              <StatusPill tone="blue">Dark green = selected for offline</StatusPill>
              <StatusPill tone="slate">Grey = already occupied</StatusPill>
            </div>

            <button
              type="button"
              onClick={submitOffline}
              disabled={offlineBusy || selectedSeatIds.length === 0}
              className="mt-5 w-full rounded-[1.5rem] bg-emerald-700 px-4 py-4 text-base font-black text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {offlineBusy ? "Saving offline boarding..." : "Save offline boarding"}
            </button>
          </ShellCard>

          <ShellCard className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">Cash Verification</div>
                <div className="mt-1 text-2xl font-black">Verify pending cash payment</div>
              </div>
              <StatusPill tone="amber">Helper action</StatusPill>
            </div>

            <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
              <input
                type="text"
                value={verifyBookingId}
                onChange={(event) => setVerifyBookingId(event.target.value)}
                placeholder="Enter booking ID"
                className="rounded-[1.35rem] border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium text-white outline-none placeholder:text-slate-300"
              />
              <button
                type="button"
                onClick={verifyCashPayment}
                disabled={verifyBusy}
                className="rounded-[1.35rem] bg-emerald-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {verifyBusy ? "VERIFYING" : "VERIFY"}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-[1.35rem] bg-white/10 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">Method</div>
                <div className="mt-2 text-sm font-semibold">{verifiedPayment?.method || "CASH"}</div>
              </div>
              <div className="rounded-[1.35rem] bg-white/10 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">Status</div>
                <div className="mt-2 text-sm font-semibold">{verifiedPayment?.status || "PENDING"}</div>
              </div>
              <div className="rounded-[1.35rem] bg-white/10 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">Amount</div>
                <div className="mt-2 text-sm font-semibold">{verifiedPayment?.amount || "-"}</div>
              </div>
            </div>

            <div className="mt-4 rounded-[1.35rem] bg-white/10 px-4 py-3 text-sm text-slate-200">
              Use this when a passenger pays cash on board and you need to mark the booking as confirmed in the system.
            </div>
          </ShellCard>
        </div>
      </div>
    </div>
  );
}
