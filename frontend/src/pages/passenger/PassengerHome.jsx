import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearToken } from "../../auth";
import { useAuth } from "../../AuthContext";
import { api } from "../../api";
import { snapRouteToRoad } from "../../lib/mapRoute";
import {
  BottomNav,
  DriverCard,
  HeaderBar,
  HistoryCard,
  Icon,
  LiveBusCard,
  MetricCard,
  NearbyMapCard,
  PaymentShowcase,
  PlannerCard,
  ProfileCard,
  QuickRouteCard,
  ReservationBuilder,
  ReservationCard,
  SearchBar,
  SettingsRow,
  SplashScreen,
  StopFeatureCard,
  TicketQrCard,
  TrackMap,
} from "../../components/passenger/PassengerUI";
import { buildFormPost, downloadInvoice, estimateEta, PASSENGER_THEME, toLocPoint, toPoint, useSplash } from "./passengerUtils";

export default function PassengerHome() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const showSplash = useSplash();
  const [activeView, setActiveView] = useState("home");
  const [stops, setStops] = useState([]);
  const [trips, setTrips] = useState([]);
  const [routeFeed, setRouteFeed] = useState([]);
  const [tripContexts, setTripContexts] = useState({});
  const [pickupStopId, setPickupStopId] = useState("");
  const [dropStopId, setDropStopId] = useState("");
  const [selectionMode, setSelectionMode] = useState("");
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [matchedTrips, setMatchedTrips] = useState([]);
  const [dismissedMatchIds, setDismissedMatchIds] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [acceptedTripId, setAcceptedTripId] = useState("");
  const [seats, setSeats] = useState([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [lastBookingId, setLastBookingId] = useState(null);
  const [lastBookingSummary, setLastBookingSummary] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [rideTab, setRideTab] = useState("upcoming");
  const [profileForm, setProfileForm] = useState({ full_name: "", email: "" });
  const [profileBusy, setProfileBusy] = useState(false);
  const [settings, setSettings] = useState({ liveTracking: true, arrivalAlerts: true });
  const [liveLocationOverwrites, setLiveLocationOverwrites] = useState({});
  const [roadPolyline, setRoadPolyline] = useState([]);
  const [ticketBookingId, setTicketBookingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [findingRoutes, setFindingRoutes] = useState(false);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [now, setNow] = useState(Date.now());
  const bookingSectionRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setProfileForm({ full_name: user?.full_name || "", email: user?.email || "" });
  }, [user?.email, user?.full_name]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("metrobus_passenger_settings");
      if (raw) setSettings((current) => ({ ...current, ...JSON.parse(raw) }));
    } catch {
      // Ignore invalid local settings snapshots.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("metrobus_passenger_settings", JSON.stringify(settings));
  }, [settings]);

  const pickupStop = stops.find((stop) => String(stop.id) === String(pickupStopId)) || null;
  const dropStop = stops.find((stop) => String(stop.id) === String(dropStopId)) || null;
  const liveTripsById = useMemo(() => {
    const index = new Map();
    routeFeed.forEach((trip) => {
      index.set(String(trip.id), trip);
    });
    return index;
  }, [routeFeed]);
  const hydrateTrip = useCallback((trip) => {
    if (!trip) return null;
    const liveTrip = liveTripsById.get(String(trip.id));
    if (!liveTrip) return trip;
    return {
      ...liveTrip,
      ...trip,
      latest_location: liveTrip.latest_location ?? trip.latest_location ?? null,
      live_override: trip.live_override ?? liveTrip.live_override,
      open_seats: trip.open_seats ?? liveTrip.open_seats,
      occupancy_label: trip.occupancy_label ?? liveTrip.occupancy_label,
      eta: trip.eta ?? liveTrip.eta,
    };
  }, [liveTripsById]);
  const hydratedMatchedTrips = useMemo(
    () => matchedTrips.map((trip) => hydrateTrip(trip)).filter(Boolean),
    [hydrateTrip, matchedTrips],
  );
  const visibleMatchedTrips = useMemo(
    () => hydratedMatchedTrips.filter((trip) => !dismissedMatchIds.includes(String(trip.id))),
    [dismissedMatchIds, hydratedMatchedTrips],
  );
  const displayTrips = matchedTrips.length ? visibleMatchedTrips : routeFeed;
  const activeBooking = bookings.find((booking) => ["CONFIRMED", "PENDING"].includes(booking.status)) || null;
  const pastBookings = bookings.filter((booking) => ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(booking.status) || booking.trip_status === "ENDED");
  const historyBooking = pastBookings[0] || bookings[0] || null;
  const latestPaidBooking = bookings.find((booking) => booking.payment_status === "SUCCESS") || null;
  const ticketBooking = bookings.find((booking) => booking.id === ticketBookingId) || lastBookingSummary || null;
  const selectedTrip = useMemo(() => {
    const preferredId = activeView === "track" ? acceptedTripId || activeBooking?.trip_id || selectedTripId : selectedTripId;
    const preferredKey = preferredId ? String(preferredId) : "";
    return (
      displayTrips.find((trip) => String(trip.id) === preferredKey)
      || (preferredKey ? hydrateTrip(liveTripsById.get(preferredKey)) : null)
      || displayTrips[0]
      || null
    );
  }, [acceptedTripId, activeBooking?.trip_id, activeView, displayTrips, hydrateTrip, liveTripsById, selectedTripId]);
  const acceptedTrip = useMemo(() => {
    const acceptedKey = acceptedTripId ? String(acceptedTripId) : activeBooking?.trip_id ? String(activeBooking.trip_id) : "";
    return (
      visibleMatchedTrips.find((trip) => String(trip.id) === acceptedKey)
      || (acceptedKey ? hydrateTrip(liveTripsById.get(acceptedKey)) : null)
      || null
    );
  }, [acceptedTripId, activeBooking?.trip_id, hydrateTrip, liveTripsById, visibleMatchedTrips]);
  const routeStops = useMemo(() => (
    selectedTrip ? tripContexts[selectedTrip.id]?.route_stops || [] : []
  ), [selectedTrip, tripContexts]);
  const routePolyline = useMemo(() => routeStops.map((item) => toPoint(item.stop?.lat, item.stop?.lng)).filter(Boolean), [routeStops]);
  const displayLine = roadPolyline.length > 1 ? roadPolyline : routePolyline;
  const mapPoints = useMemo(() => {
    const points = [...displayLine];
    if (points.length < 2) stops.forEach((stop) => { const point = toPoint(stop.lat, stop.lng); if (point) points.push(point); });
    return points;
  }, [displayLine, stops]);
  const nearbyStops = useMemo(() => [pickupStop, dropStop, ...stops].filter(Boolean).filter((stop, index, array) => array.findIndex((item) => item.id === stop.id) === index).slice(0, 2), [dropStop, pickupStop, stops]);

  const ensureCtx = useCallback(async (tripList) => {
    const missing = tripList.filter((trip) => !tripContexts[trip.id]);
    if (!missing.length) return tripContexts;
    const pairs = await Promise.all(missing.map(async (trip) => [trip.id, (await api.get(`/api/trips/${trip.id}/`)).data]));
    const merged = { ...tripContexts };
    pairs.forEach(([id, data]) => { merged[id] = data; });
    setTripContexts(merged);
    return merged;
  }, [tripContexts]);

  const loadBookings = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setBookingsLoading(true);
    try {
      const response = await api.get("/api/bookings/my/");
      setBookings(response.data.bookings || []);
    } catch {
      // Keep existing bookings visible if a refresh fails.
    } finally {
      if (!silent) setBookingsLoading(false);
    }
  }, []);

  const syncTripSeatMeta = useCallback((tripId, seatsData) => {
    const openSeats = seatsData.filter((seat) => seat.available).length;
    const occupancy = seatsData.length ? Math.round(((seatsData.length - openSeats) / seatsData.length) * 100) : 0;
    const occupancyLabel = seatsData.length
      ? occupancy >= 80
        ? "High Occupancy"
        : occupancy >= 50
          ? "Med Occupancy"
          : "Low Occupancy"
      : "Seat map unavailable";
    const apply = (list) => list.map((trip) => (
      String(trip.id) === String(tripId)
        ? { ...trip, open_seats: openSeats, occupancy_label: occupancyLabel }
        : trip
    ));
    setRouteFeed((current) => apply(current));
    setMatchedTrips((current) => apply(current));
  }, []);

  const loadSeats = useCallback(async (tripId, fromOrder, toOrder) => {
    if (!tripId || !fromOrder || !toOrder) { setSeats([]); setSelectedSeatIds([]); return; }
    setLoadingSeats(true);
    try {
      const response = await api.get(`/api/bookings/trips/${tripId}/availability/?from=${fromOrder}&to=${toOrder}`);
      const seatsData = response.data.seats || [];
      setSeats(seatsData);
      setSelectedSeatIds([]);
      syncTripSeatMeta(tripId, seatsData);
    }
    catch (error) { setErr(error?.response?.data?.detail || "Unable to load seats."); setSeats([]); }
    finally { setLoadingSeats(false); }
  }, [syncTripSeatMeta]);

  const buildRouteFeed = useCallback(async (liveTrips) => {
    const ctxMap = await ensureCtx(liveTrips);
    const cards = await Promise.all(liveTrips.map(async (trip) => {
      const rows = ctxMap[trip.id]?.route_stops || [];
      const first = rows[0];
      const last = rows[rows.length - 1];
      let openSeats = null;
      let occupancyLabel = "Live service";
      if (first && last && Number(last.stop_order) > Number(first.stop_order)) {
        try {
          const availability = await api.get(`/api/bookings/trips/${trip.id}/availability/?from=${first.stop_order}&to=${last.stop_order}`);
          const seatsData = availability.data.seats || [];
          openSeats = seatsData.filter((seat) => seat.available).length;
          const occupancy = seatsData.length ? Math.round(((seatsData.length - openSeats) / seatsData.length) * 100) : 0;
          occupancyLabel = occupancy >= 80 ? "High Occupancy" : occupancy >= 50 ? "Med Occupancy" : "Low Occupancy";
        } catch {
          // Fall back to live service copy when seat availability is unavailable.
        }
      }
      const routePoints = rows.map((item) => toPoint(item.stop?.lat, item.stop?.lng)).filter(Boolean);
      return {
        ...trip,
        from_order: first?.stop_order || 1,
        to_order: last?.stop_order || 2,
        pickup_stop_name: first?.stop?.name || "Downtown Hub",
        destination_stop_name: last?.stop?.name || "Main Terminal",
        pickup_point: first ? toPoint(first.stop?.lat, first.stop?.lng) : null,
        open_seats: openSeats,
        occupancy_label: occupancyLabel,
        eta: estimateEta(toLocPoint(trip.latest_location), first ? toPoint(first.stop?.lat, first.stop?.lng) : null, routePoints, trip.latest_location?.speed),
      };
    }));
    setRouteFeed(cards);
    setSelectedTripId((current) => current || String(cards[0]?.id || ""));
  }, [ensureCtx]);

  const loadBase = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [stopsResponse, tripsResponse] = await Promise.all([api.get("/api/transport/stops/"), api.get("/api/trips/live/")]);
      const liveStops = stopsResponse.data.stops || [];
      const liveTrips = tripsResponse.data || [];
      setStops(liveStops);
      setTrips(liveTrips);
      await buildRouteFeed(liveTrips);
      setErr("");
    } catch (error) {
      setErr(error?.response?.data?.detail || "Unable to load MetroBus passenger data.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [buildRouteFeed]);

  useEffect(() => {
    loadBase();
    loadBookings();
    const tripRefresh = setInterval(() => loadBase({ silent: true }), activeView === "track" ? 1000 : 5000);
    const bookingRefresh = setInterval(() => loadBookings({ silent: true }), 15000);
    return () => { clearInterval(tripRefresh); clearInterval(bookingRefresh); };
  }, [activeView, loadBase, loadBookings]);

  useEffect(() => {
    if (!activeBooking?.trip_id) return;
    const bookingTripId = String(activeBooking.trip_id);
    setSelectedTripId((current) => (acceptedTripId ? current || bookingTripId : bookingTripId));
    setAcceptedTripId((current) => current || bookingTripId);
  }, [acceptedTripId, activeBooking?.trip_id]);

  useEffect(() => {
    if (!acceptedTrip?.id || !acceptedTrip.from_order || !acceptedTrip.to_order) {
      setSeats([]);
      setSelectedSeatIds([]);
      return;
    }
    loadSeats(acceptedTrip.id, acceptedTrip.from_order, acceptedTrip.to_order);
  }, [acceptedTrip?.from_order, acceptedTrip?.id, acceptedTrip?.to_order, loadSeats]);

  useEffect(() => {
    if (routePolyline.length < 2) { setRoadPolyline([]); return; }
    const controller = new AbortController();
    snapRouteToRoad(routePolyline, controller.signal).then((points) => setRoadPolyline(points.length > 1 ? points : [])).catch((error) => { if (error.name !== "AbortError") setRoadPolyline([]); });
    return () => controller.abort();
  }, [routePolyline]);

  useEffect(() => {
    if (!selectedTripId || !settings.liveTracking) return undefined;
    let socket = null;
    let subscribed = true;
    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    const connect = () => {
      socket = new WebSocket(`${wsProtocol}://${window.location.hostname}:8000/ws/transport/trips/${selectedTripId}/`);
      socket.onmessage = (event) => {
        if (!subscribed) return;
        const data = JSON.parse(event.data);
        setLiveLocationOverwrites((current) => ({ ...current, [selectedTripId]: { lat: data.lat, lng: data.lng, heading: data.bearing, lastSeen: Date.now() } }));
      };
      socket.onclose = () => { if (subscribed) setTimeout(connect, 3000); };
    };
    connect();
    return () => { subscribed = false; if (socket) socket.close(); };
  }, [selectedTripId, settings.liveTracking]);

  useEffect(() => {
    if (!Object.keys(liveLocationOverwrites).length) return;
    const apply = (list) => list.map((trip) => liveLocationOverwrites[trip.id] ? { ...trip, live_override: liveLocationOverwrites[trip.id] } : trip);
    setRouteFeed((current) => apply(current));
    setMatchedTrips((current) => apply(current));
  }, [liveLocationOverwrites]);

  const findRoutes = async () => {
    if (!pickupStopId || !dropStopId) { setErr("Choose both pickup and destination stops first."); setPlannerOpen(true); return; }
    if (String(pickupStopId) === String(dropStopId)) { setErr("Pickup and destination must be different."); return; }
    setFindingRoutes(true); setErr(""); setMsg("");
    setDismissedMatchIds([]);
    setAcceptedTripId("");
    try {
      const ctxMap = await ensureCtx(trips);
      const matches = [];
      for (const trip of trips) {
        const rows = ctxMap[trip.id]?.route_stops || [];
        const pickupRow = rows.find((item) => String(item.stop?.id) === String(pickupStopId));
        const dropRow = rows.find((item) => String(item.stop?.id) === String(dropStopId));
        if (!pickupRow || !dropRow || Number(dropRow.stop_order) <= Number(pickupRow.stop_order)) continue;
        const availability = await api.get(`/api/bookings/trips/${trip.id}/availability/?from=${pickupRow.stop_order}&to=${dropRow.stop_order}`);
        const seatsData = availability.data.seats || [];
        const openSeats = seatsData.filter((seat) => seat.available).length;
        const occupancy = seatsData.length ? Math.round(((seatsData.length - openSeats) / seatsData.length) * 100) : 0;
        const routePoints = rows.map((item) => toPoint(item.stop?.lat, item.stop?.lng)).filter(Boolean);
        matches.push({
          ...trip,
          live_override: liveLocationOverwrites[trip.id],
          from_order: Number(pickupRow.stop_order),
          to_order: Number(dropRow.stop_order),
          pickup_stop_name: pickupRow.stop?.name,
          destination_stop_name: dropRow.stop?.name,
          pickup_point: toPoint(pickupRow.stop?.lat, pickupRow.stop?.lng),
          open_seats: openSeats,
          occupancy_label: occupancy >= 80 ? "High Occupancy" : occupancy >= 50 ? "Med Occupancy" : "Low Occupancy",
          eta: estimateEta(toLocPoint(trip.latest_location), toPoint(pickupRow.stop?.lat, pickupRow.stop?.lng), routePoints, trip.latest_location?.speed),
          fare_estimate: 50,
        });
      }
      setMatchedTrips(matches);
      setSelectedTripId(String(matches[0]?.id || ""));
      setLastBookingId(null);
      setLastBookingSummary(null);
      setSelectedSeatIds([]);
      if (!matches.length) setErr("No live buses found for that route right now.");
      else setMsg(`${matches.length} live bus${matches.length !== 1 ? "es" : ""} found.`);
    } catch (error) {
      setErr(error?.response?.data?.detail || "Unable to find live buses.");
    } finally {
      setFindingRoutes(false);
    }
  };

  const handleMapSelect = (mode, stopId) => {
    if (!stopId) { setSelectionMode(mode); return; }
    if (mode === "drop") { setDropStopId(String(stopId)); setSelectionMode(""); return; }
    setPickupStopId(String(stopId)); setSelectionMode("drop");
  };
  const applyQuickRoute = (type) => {
    setPlannerOpen(true);
    if (!stops.length) return;
    if (type === "home") setPickupStopId(String(stops[0]?.id || ""));
    if (type === "work") setDropStopId(String(stops[1]?.id || stops[0]?.id || ""));
    if (type === "gym") setDropStopId(String(stops[2]?.id || stops[1]?.id || ""));
  };
  const acceptMatchedTrip = (tripId) => {
    setSelectedTripId(String(tripId));
    setAcceptedTripId(String(tripId));
    setPlannerOpen(false);
    setLastBookingId(null);
    setLastBookingSummary(null);
    setSelectedSeatIds([]);
    setErr("");
    setMsg("Bus selected. Choose your seat below.");
    setTimeout(() => bookingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  };
  const declineMatchedTrip = (tripId) => {
    if (String(acceptedTripId) === String(tripId)) {
      setAcceptedTripId("");
      setLastBookingId(null);
      setLastBookingSummary(null);
    }
    setDismissedMatchIds((current) => (
      current.includes(String(tripId)) ? current : [...current, String(tripId)]
    ));
    setSelectedSeatIds([]);
  };
  const toggleSeat = (seatId) => setSelectedSeatIds((current) => current.includes(seatId) ? current.filter((id) => id !== seatId) : [...current, seatId]);

  const bookSeats = async () => {
    if (!acceptedTrip || !selectedSeatIds.length) { setErr("Accept a live bus and choose at least one seat."); return; }
    setBookingBusy(true); setErr(""); setMsg("");
    try {
      const response = await api.post(`/api/bookings/trips/${acceptedTrip.id}/book/`, { from_stop_order: acceptedTrip.from_order, to_stop_order: acceptedTrip.to_order, seat_ids: selectedSeatIds });
      setLastBookingId(response.data.id); setLastBookingSummary(response.data); setTicketBookingId(response.data.id);
      setActiveView("track");
      setPlannerOpen(false);
      setSelectedTripId(String(acceptedTrip.id));
      setMsg(`Booking #${response.data.id} confirmed. Your live bus is now open in Track.`);
      await loadSeats(acceptedTrip.id, acceptedTrip.from_order, acceptedTrip.to_order);
      await loadBookings({ silent: true });
      setTimeout(() => bookingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    } catch (error) { setErr(error?.response?.data?.detail || "Booking failed."); }
    finally { setBookingBusy(false); }
  };

  const pay = async (method) => {
    if (!lastBookingId) { setErr("Create a booking first."); return; }
    setPaymentBusy(true); setErr(""); setMsg("");
    try {
      const response = await api.post("/api/payments/create/", { booking_id: lastBookingId, method });
      const { redirect, payment } = response.data;
      setLastBookingSummary((current) => (
        current ? { ...current, payment_status: payment?.status || current.payment_status, payment_method: payment?.method || current.payment_method, payment: payment || current.payment } : current
      ));
      if (redirect?.type === "REDIRECT" && redirect.url) { window.location.href = redirect.url; return; }
      if (redirect?.type === "FORM_POST" && redirect.url) { buildFormPost(redirect); return; }
      setMsg(`Payment ${payment?.status || "PENDING"}.`); await loadBookings({ silent: true });
    } catch (error) { setErr(error?.response?.data?.detail || "Payment failed."); }
    finally { setPaymentBusy(false); }
  };

  const saveProfile = async () => {
    setProfileBusy(true); setErr(""); setMsg("");
    try { const response = await api.patch("/api/auth/me/", profileForm); setUser(response.data); setMsg("Profile updated."); }
    catch (error) { setErr(error?.response?.data?.email?.[0] || error?.response?.data?.full_name?.[0] || "Update failed."); }
    finally { setProfileBusy(false); }
  };

  const shareTrip = async () => {
    if (!selectedTrip) return;
    const text = `I am tracking MetroBus ${selectedTrip.bus_plate || "bus"} on ${selectedTrip.route_name}.`;
    try { if (navigator.share) await navigator.share({ title: "MetroBus trip", text }); else if (navigator.clipboard) await navigator.clipboard.writeText(text); setMsg("Trip details shared."); }
    catch { setErr("Unable to share trip right now."); }
  };

  const handleLogout = useCallback(() => {
    clearToken();
    setUser(null);
    navigate("/auth/login", { replace: true });
  }, [navigate, setUser]);

  if (showSplash) return <SplashScreen />;
  if (loading) return <div style={PASSENGER_THEME} className="min-h-screen bg-[var(--mb-bg)] px-6 py-20 text-center text-xl font-semibold text-[var(--mb-muted)]">Loading your MetroBus dashboard...</div>;

  return (
    <div style={PASSENGER_THEME} className="min-h-screen bg-[linear-gradient(180deg,var(--mb-bg),#fff1f8)] text-[var(--mb-text)]">
      <HeaderBar user={user} activeView={activeView} onLogout={handleLogout} />
      <main className="mx-auto max-w-5xl px-5 pb-44 pt-28 md:px-6 md:pt-32">
        {err ? <div className="mb-4 rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{err}</div> : null}
        {msg ? <div className="mb-4 rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{msg}</div> : null}

        {activeView === "home" ? (
          <>
            <section className="rounded-[42px] bg-[radial-gradient(circle_at_top_right,rgba(182,65,255,0.18),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,241,249,0.95))] p-5 shadow-[var(--mb-shadow)] md:p-8">
              <p className="text-sm font-black uppercase tracking-[0.3em] text-[var(--mb-purple)]">
                Hello, {(user?.full_name || "Passenger").split(" ")[0]}
              </p>
              <h1 className="mt-4 text-[3.4rem] font-black leading-[0.96] text-[var(--mb-text)] md:text-[4.6rem]">
                Where to <span className="text-[var(--mb-purple)]">next?</span>
              </h1>
              <SearchBar
                summary={pickupStop && dropStop ? `${pickupStop.name} to ${dropStop.name}` : "Search destination..."}
                onOpenPlanner={() => setPlannerOpen((current) => !current)}
                onSearch={() => {
                  setPlannerOpen(true);
                  findRoutes();
                }}
              />
              {plannerOpen ? (
                <PlannerCard
                  stops={stops}
                  pickupStopId={pickupStopId}
                  dropStopId={dropStopId}
                  selectionMode={selectionMode}
                  onPickupChange={setPickupStopId}
                  onDropChange={setDropStopId}
                  onMapPickMode={handleMapSelect}
                  onFindRoutes={findRoutes}
                  findingRoutes={findingRoutes}
                  mapPoints={mapPoints}
                  pickupStop={pickupStop}
                  dropStop={dropStop}
                  matchedTrips={visibleMatchedTrips}
                  selectedTripId={selectedTripId}
                  onSelectTrip={acceptMatchedTrip}
                  onDeclineTrip={declineMatchedTrip}
                  displayLine={displayLine}
                />
              ) : null}
            </section>

            {acceptedTrip ? (
              <div ref={bookingSectionRef} className="mt-6">
                <ReservationBuilder
                  trip={acceptedTrip}
                  seats={seats}
                  selectedSeatIds={selectedSeatIds}
                  onSeatToggle={toggleSeat}
                  onBook={bookSeats}
                  onPay={pay}
                  bookingBusy={bookingBusy}
                  paymentBusy={paymentBusy}
                  loadingSeats={loadingSeats}
                  lastBookingId={lastBookingId}
                  lastBookingSummary={lastBookingSummary}
                  pickupStop={pickupStop}
                  dropStop={dropStop}
                />
              </div>
            ) : null}

            <section className="mt-8">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-3xl font-black text-[var(--mb-text)]">Quick Routes</h2>
                <button type="button" onClick={() => setPlannerOpen(true)} className="text-lg font-black text-[var(--mb-purple)]">
                  Edit
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2">
                <QuickRouteCard icon="home" label="Home" caption={user?.home_location_label || "Saved pickup"} onClick={() => applyQuickRoute("home")} />
                <QuickRouteCard icon="briefcase" label="Work" caption={user?.office_location_label || "Office route"} onClick={() => applyQuickRoute("work")} />
                <QuickRouteCard icon="dumbbell" label="Gym" caption={stops[2]?.name || "Popular route"} onClick={() => applyQuickRoute("gym")} />
              </div>
            </section>

            <section className="mt-10">
              <h2 className="mb-4 text-3xl font-black text-[var(--mb-text)]">Nearby Stops</h2>
              <NearbyMapCard
                stops={routeStops.length ? routeStops.map((item) => item.stop).filter(Boolean) : nearbyStops}
                displayLine={displayLine}
                selectedTrip={selectedTrip}
                matchedTrips={visibleMatchedTrips}
                selectedTripId={selectedTripId}
                onSelectTrip={acceptMatchedTrip}
              />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <StopFeatureCard icon="pin" eyebrow={`Station ${nearbyStops[0]?.id || 14}`} title={nearbyStops[0]?.name || "North Plaza"} />
                <StopFeatureCard icon="star" eyebrow="Recommended" title={nearbyStops[1]?.name || "Main Terminal"} featured />
              </div>
            </section>

            <section className="mt-10">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-3xl font-black text-[var(--mb-text)]">Available Buses</h2>
                <span className="rounded-full bg-[#f6dbff] px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[var(--mb-purple)]">
                  Refreshed just now
                </span>
              </div>
              <div className="space-y-4">
                {displayTrips.length ? (
                  displayTrips.slice(0, 4).map((trip, index) => (
                    <LiveBusCard
                      key={trip.id}
                      trip={trip}
                      index={index}
                      active={String(trip.id) === String(selectedTripId)}
                      now={now}
                      onClick={() => {
                        setSelectedTripId(String(trip.id));
                        setActiveView(visibleMatchedTrips.length ? "home" : "track");
                        setPlannerOpen(Boolean(visibleMatchedTrips.length));
                      }}
                    />
                  ))
                ) : (
                  <div className="rounded-[32px] bg-[var(--mb-card)] px-5 py-8 text-center text-lg font-medium text-[var(--mb-muted)] shadow-[var(--mb-shadow)]">
                    No live buses at the moment. Try refreshing in a few seconds.
                  </div>
                )}
              </div>
            </section>

            <button
              type="button"
              onClick={() => setPlannerOpen((current) => !current)}
              className="fixed bottom-32 right-6 z-30 grid h-20 w-20 place-items-center rounded-full bg-[linear-gradient(135deg,#8d12eb,#b641ff)] text-white shadow-[var(--mb-shadow-strong)] md:right-[max(2rem,calc((100vw-68rem)/2+1.5rem))]"
            >
              <Icon name="plus" className="h-9 w-9" />
            </button>
          </>
        ) : null}

        {activeView === "track" ? <section className="space-y-5"><TrackMap trip={selectedTrip} displayLine={displayLine} now={now} /><DriverCard trip={selectedTrip} /><div className="grid gap-4 sm:grid-cols-2"><MetricCard icon="seat" label="Seats" value={`${selectedTrip?.open_seats ?? 12} Free`} /><MetricCard icon="snow" label="Climate" value="22°C Fixed" /></div><div className="grid gap-4 sm:grid-cols-[1.4fr_0.8fr]"><button type="button" onClick={shareTrip} className="inline-flex items-center justify-center gap-3 rounded-full bg-[linear-gradient(135deg,#8d12eb,#b641ff)] px-6 py-5 text-2xl font-black text-white shadow-[var(--mb-shadow-strong)]"><Icon name="share" className="h-7 w-7" />Share Trip</button><button type="button" onClick={() => { window.location.href = "tel:100"; }} className="inline-flex items-center justify-center gap-3 rounded-full bg-[var(--mb-danger)] px-6 py-5 text-2xl font-black text-white"><Icon name="alert" className="h-7 w-7" />SOS</button></div></section> : null}

        {activeView === "rides" ? <section className="space-y-7"><div className="inline-flex rounded-full bg-[var(--mb-card-soft)] p-2 shadow-[var(--mb-shadow)]">{["upcoming", "past"].map((tab) => <button key={tab} type="button" onClick={() => setRideTab(tab)} className={`rounded-full px-10 py-4 text-2xl font-black transition ${rideTab === tab ? "bg-[linear-gradient(135deg,#8d12eb,#b641ff)] text-white shadow-[var(--mb-shadow-strong)]" : "text-[var(--mb-text)]"}`}>{tab === "upcoming" ? "Upcoming" : "Past"}</button>)}</div><div className="flex items-center justify-between gap-3"><h2 className="text-4xl font-black text-[var(--mb-text)]">Active Reservations</h2>{bookingsLoading ? <span className="text-sm font-medium text-[var(--mb-muted)]">Syncing rides...</span> : null}</div>{rideTab === "upcoming" ? activeBooking ? <ReservationCard booking={activeBooking} onReschedule={() => { setPlannerOpen(true); setActiveView("home"); }} onViewTicket={() => setTicketBookingId(activeBooking.id)} /> : <div className="rounded-[36px] border border-dashed border-[var(--mb-border)] bg-[var(--mb-card)] p-8 text-center text-lg text-[var(--mb-muted)]">No active reservations yet.</div> : pastBookings.map((booking) => <HistoryCard key={booking.id} booking={booking} onDownload={() => downloadInvoice(booking)} />)}<div className="flex items-center justify-between gap-3"><h2 className="text-4xl font-black text-[var(--mb-text)]">Recent History</h2><button type="button" onClick={() => setRideTab("past")} className="text-lg font-black uppercase tracking-[0.16em] text-[var(--mb-purple)]">View All</button></div>{historyBooking ? <HistoryCard booking={historyBooking} onDownload={() => downloadInvoice(historyBooking)} /> : null}{ticketBooking ? <div className="space-y-3"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--mb-purple)]">Ticket Preview</p><h3 className="mt-2 text-3xl font-black text-[var(--mb-text)]">Booking #{ticketBooking.id}</h3></div><button type="button" onClick={() => setTicketBookingId(null)} className="rounded-full bg-white px-4 py-2 text-sm font-black text-[var(--mb-purple)] shadow-[var(--mb-shadow)]">Close</button></div><TicketQrCard booking={ticketBooking} compact /></div> : null}</section> : null}

        {activeView === "profile" ? <section className="space-y-7"><ProfileCard user={user} profileForm={profileForm} setProfileForm={setProfileForm} onSave={saveProfile} profileBusy={profileBusy} /><PaymentShowcase latestPaidBooking={latestPaidBooking} /><div className="space-y-4"><h3 className="text-3xl font-black text-[var(--mb-text)]">Settings</h3><SettingsRow icon="bell" title="Notifications" description="Trip updates and boarding alerts" trailing={<button type="button" onClick={() => setSettings((current) => ({ ...current, arrivalAlerts: !current.arrivalAlerts }))} className={`relative h-7 w-12 rounded-full transition ${settings.arrivalAlerts ? "bg-[var(--mb-purple)]" : "bg-[#d9c6df]"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${settings.arrivalAlerts ? "left-6" : "left-1"}`} /></button>} /><SettingsRow icon="track" title="Live Tracking" description="Show live bus movement on the map" trailing={<button type="button" onClick={() => setSettings((current) => ({ ...current, liveTracking: !current.liveTracking }))} className={`relative h-7 w-12 rounded-full transition ${settings.liveTracking ? "bg-[var(--mb-purple)]" : "bg-[#d9c6df]"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${settings.liveTracking ? "left-6" : "left-1"}`} /></button>} /><SettingsRow icon="shield" title="Security & Privacy" description="Protected with verified phone login" /><SettingsRow icon="help" title="Help & Support" description="Need assistance with a route or payment?" /></div><button type="button" onClick={handleLogout} className="w-full rounded-full border border-red-200 bg-white px-6 py-5 text-2xl font-black text-red-600">Log Out</button></section> : null}
      </main>
      <BottomNav activeView={activeView} onChange={setActiveView} />
    </div>
  );
}
