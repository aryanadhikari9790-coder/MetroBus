import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearToken } from "../../auth";
import { useAuth } from "../../AuthContext";
import { api } from "../../api";
import { snapRouteToRoad } from "../../lib/mapRoute";
import { buildWsUrl } from "../../lib/ws";
import {
  BottomNav,
  CancellationSheet,
  CheckoutPage,
  DriverCard,
  HeaderBar,
  HistoryCard,
  Icon,
  MetricCard,
  NearbyMapCard,
  OccupancySheet,
  PaymentRequestCard,
  PaymentShowcase,
  PlannerCard,
  ProfileCard,
  ReservationBuilder,
  ReservationCard,
  SettingsRow,
  SplashScreen,
  TicketQrCard,
  TrackMap,
} from "../../components/passenger/PassengerUI";
import { buildFormPost, distKm, downloadInvoice, estimateEta, PASSENGER_THEME, toLocPoint, toPoint, useSplash } from "./passengerUtils";

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
  const [homeStage, setHomeStage] = useState("planner");
  const [matchedTrips, setMatchedTrips] = useState([]);
  const [dismissedMatchIds, setDismissedMatchIds] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [acceptedTripId, setAcceptedTripId] = useState("");
  const [seats, setSeats] = useState([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [occupancyTripId, setOccupancyTripId] = useState("");
  const [occupancySeats, setOccupancySeats] = useState([]);
  const [occupancyBusy, setOccupancyBusy] = useState(false);
  const [lastBookingId, setLastBookingId] = useState(null);
  const [lastBookingSummary, setLastBookingSummary] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [rideTab, setRideTab] = useState("upcoming");
  const [profileForm, setProfileForm] = useState({ full_name: "", email: "" });
  const [profileBusy, setProfileBusy] = useState(false);
  const [walletSummary, setWalletSummary] = useState(null);
  const [passPlans, setPassPlans] = useState([]);
  const [walletBusy, setWalletBusy] = useState(false);
  const [settings, setSettings] = useState({ liveTracking: true, arrivalAlerts: true });
  const [liveLocationOverwrites, setLiveLocationOverwrites] = useState({});
  const [roadPolyline, setRoadPolyline] = useState([]);
  const [ticketBookingId, setTicketBookingId] = useState(null);
  const [checkoutOriginView, setCheckoutOriginView] = useState("home");
  const [headerPanel, setHeaderPanel] = useState("");
  const [cancellationBookingId, setCancellationBookingId] = useState(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationNote, setCancellationNote] = useState("");
  const [cancellationBusy, setCancellationBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [findingRoutes, setFindingRoutes] = useState(false);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [bookingSocketState, setBookingSocketState] = useState("disconnected");
  const [bookingEventLog, setBookingEventLog] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [now, setNow] = useState(Date.now());
  const lastPaymentRequestKeyRef = useRef("");
  const activeViewRef = useRef("home");
  const checkoutOriginViewRef = useRef("home");

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    checkoutOriginViewRef.current = checkoutOriginView;
  }, [checkoutOriginView]);

  const pushBookingLog = useCallback((text) => {
    setBookingEventLog((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        text,
      },
      ...current,
    ].slice(0, 8));
  }, []);

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
  const homeStopMatch = useMemo(() => {
    const homePoint = toPoint(user?.home_lat, user?.home_lng);
    if (!homePoint || !stops.length) return null;
    return stops.reduce((best, stop) => {
      const stopPoint = toPoint(stop.lat, stop.lng);
      if (!stopPoint) return best;
      const distance = distKm(homePoint, stopPoint);
      return !best || distance < best.distance ? { stop, distance } : best;
    }, null)?.stop || null;
  }, [stops, user?.home_lat, user?.home_lng]);
  const officeStopMatch = useMemo(() => {
    const officePoint = toPoint(user?.office_lat, user?.office_lng);
    if (!officePoint || !stops.length) return null;
    return stops.reduce((best, stop) => {
      const stopPoint = toPoint(stop.lat, stop.lng);
      if (!stopPoint) return best;
      const distance = distKm(officePoint, stopPoint);
      return !best || distance < best.distance ? { stop, distance } : best;
    }, null)?.stop || null;
  }, [stops, user?.office_lat, user?.office_lng]);
  const schoolStopMatch = useMemo(() => {
    const schoolPoint = toPoint(user?.school_lat, user?.school_lng);
    if (!schoolPoint || !stops.length) return null;
    return stops.reduce((best, stop) => {
      const stopPoint = toPoint(stop.lat, stop.lng);
      if (!stopPoint) return best;
      const distance = distKm(schoolPoint, stopPoint);
      return !best || distance < best.distance ? { stop, distance } : best;
    }, null)?.stop || null;
  }, [stops, user?.school_lat, user?.school_lng]);
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
      seats_total: trip.seats_total ?? liveTrip.seats_total,
      occupancy_percent: trip.occupancy_percent ?? liveTrip.occupancy_percent,
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
  const paymentActionBooking = bookings.find((booking) => booking.needs_payment_selection && ["CONFIRMED", "PENDING"].includes(booking.status)) || null;
  const paymentPendingBooking = bookings.find((booking) => booking.payment_pending_verification && ["CONFIRMED", "PENDING"].includes(booking.status)) || null;
  const pastBookings = bookings.filter((booking) => ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(booking.status) || booking.trip_status === "ENDED");
  const historyBooking = pastBookings[0] || bookings[0] || null;
  const latestPaidBooking = bookings.find((booking) => booking.payment_status === "SUCCESS") || null;
  const ticketBooking = bookings.find((booking) => booking.id === ticketBookingId) || lastBookingSummary || activeBooking || null;
  const homeRideBooking = paymentActionBooking || paymentPendingBooking || ticketBooking || activeBooking || null;
  const checkoutBooking = useMemo(() => {
    if (paymentActionBooking) return paymentActionBooking;
    if (paymentPendingBooking) return paymentPendingBooking;
    if (activeView === "checkout") return activeBooking || ticketBooking || lastBookingSummary || null;
    return null;
  }, [activeBooking, activeView, lastBookingSummary, paymentActionBooking, paymentPendingBooking, ticketBooking]);
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
  const occupancyTrip = useMemo(() => {
    const occupancyKey = occupancyTripId ? String(occupancyTripId) : "";
    return (
      visibleMatchedTrips.find((trip) => String(trip.id) === occupancyKey)
      || displayTrips.find((trip) => String(trip.id) === occupancyKey)
      || (occupancyKey ? hydrateTrip(liveTripsById.get(occupancyKey)) : null)
      || null
    );
  }, [displayTrips, hydrateTrip, liveTripsById, occupancyTripId, visibleMatchedTrips]);
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
  const quickRouteOptions = useMemo(() => ([
    { id: "home", label: "Home", caption: homeStopMatch?.name || user?.home_location_label || "Saved home", ready: Boolean(homeStopMatch) },
    { id: "work", label: "Work", caption: officeStopMatch?.name || user?.office_location_label || "Saved office", ready: Boolean(officeStopMatch) },
    { id: "school", label: "School", caption: schoolStopMatch?.name || user?.school_location_label || "Saved school", ready: Boolean(schoolStopMatch) },
  ]), [
    homeStopMatch,
    officeStopMatch,
    schoolStopMatch,
    user?.home_location_label,
    user?.office_location_label,
    user?.school_location_label,
  ]);
  const homeStageMeta = useMemo(() => ({
    planner: {
      eyebrow: activeBooking ? "Ride Ticket" : "Journey Planner",
      title: activeBooking ? "Your ride QR is ready" : "Where to next?",
      description: activeBooking
        ? "Show this QR to the helper when the bus arrives. Payment and boarding updates for this ride will continue from here."
        : "Plan your journey across the city.",
    },
    matches: {
      eyebrow: "Available Buses",
      title: "Available Buses",
      description: visibleMatchedTrips.length
        ? `${visibleMatchedTrips.length} live bus${visibleMatchedTrips.length !== 1 ? "es" : ""} match your route right now.`
        : "No live buses are available for this route right now.",
    },
    seats: {
      eyebrow: "Seat Selection",
      title: "Select Seats",
      description: "Select the seats you want for this trip, then confirm the booking on the same screen.",
    },
    ticket: {
      eyebrow: "Ride Ticket",
      title: "Your ride QR is ready",
      description: "Show this QR to the helper when the bus arrives. Payment and boarding updates will continue from this same booking flow.",
    },
  }), [activeBooking, visibleMatchedTrips.length]);
  const stageOrder = ["planner", "matches", "seats", "ticket"];
  const cancellationBooking = useMemo(
    () => bookings.find((booking) => Number(booking.id) === Number(cancellationBookingId)) || null,
    [bookings, cancellationBookingId],
  );
  const cancellationReasons = useMemo(() => ([
    { value: "CHANGE_OF_PLANS", label: "Change of plans" },
    { value: "WRONG_ROUTE", label: "Booked the wrong route" },
    { value: "DELAY", label: "Bus arrival delay" },
    { value: "PAYMENT_ISSUE", label: "Payment issue" },
    { value: "EMERGENCY", label: "Emergency or urgent issue" },
    { value: "OTHER", label: "Other" },
  ]), []);
  const homeBookingLocked = Boolean(activeBooking && homeStage === "planner");
  const logoutCancellationBookings = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          booking.can_cancel
          && (
            booking.trip_status === "LIVE"
            || booking.checked_in_at
            || booking.payment_requested_at
            || booking.accepted_by_helper_at
          ),
      ),
    [bookings],
  );
  const passengerNotifications = useMemo(() => {
    const items = [];
    if (paymentActionBooking) {
      items.push({
        id: `payment-request-${paymentActionBooking.id}`,
        title: `Payment requested for Booking #${paymentActionBooking.id}`,
        body: "A helper scanned or loaded your ticket and is waiting for your payment choice.",
        actionLabel: "Open Payment",
        action: "payment",
      });
    }
    if (!paymentActionBooking && paymentPendingBooking) {
      items.push({
        id: `payment-pending-${paymentPendingBooking.id}`,
        title: `Payment pending for Booking #${paymentPendingBooking.id}`,
        body: paymentPendingBooking.payment_method === "CASH"
          ? "Please hand the fare to the helper for verification."
          : "Keep MetroBus open while the payment completes.",
        actionLabel: "View Checkout",
        action: "payment",
      });
    }
    if (activeBooking) {
      items.push({
        id: `active-booking-${activeBooking.id}`,
        title: `Ride #${activeBooking.id} is active`,
        body: `${activeBooking.pickup_stop_name} to ${activeBooking.destination_stop_name}`,
        actionLabel: "Open Ticket",
        action: "ticket",
      });
    }
    if (walletSummary?.reward_free_ride_ready) {
      items.push({
        id: "reward-ready",
        title: "Reward ride is ready",
        body: "You have enough points to redeem a free ride on your next booking.",
        actionLabel: "Open Wallet",
        action: "profile",
      });
    }
    return items;
  }, [activeBooking, paymentActionBooking, paymentPendingBooking, walletSummary?.reward_free_ride_ready]);
  const bookingRefreshMs = activeBooking || paymentActionBooking || paymentPendingBooking ? 3000 : 15000;

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

  const loadWalletSummary = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setWalletBusy(true);
    try {
      const response = await api.get("/api/payments/wallet/summary/");
      setWalletSummary(response.data.wallet || null);
      setPassPlans(response.data.pass_plans || []);
    } catch {
      // Leave existing wallet summary visible if refresh fails.
    } finally {
      if (!silent) setWalletBusy(false);
    }
  }, []);

  const syncTripSeatMeta = useCallback((tripId, seatsData) => {
    const openSeats = seatsData.filter((seat) => seat.available).length;
    const seatTotal = seatsData.length;
    const occupancy = seatTotal ? Math.round(((seatTotal - openSeats) / seatTotal) * 100) : 0;
    const occupancyLabel = seatsData.length
      ? occupancy >= 80
        ? "High Occupancy"
        : occupancy >= 50
          ? "Med Occupancy"
          : "Low Occupancy"
      : "Seat map unavailable";
    const apply = (list) => list.map((trip) => (
      String(trip.id) === String(tripId)
        ? { ...trip, open_seats: openSeats, seats_total: seatTotal, occupancy_percent: occupancy, occupancy_label: occupancyLabel }
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
      let seatTotal = null;
      let occupancy = null;
      let fareEstimate = Number(trip.fare_estimate || 0);
      let occupancyLabel = "Live service";
      if (first && last && Number(last.stop_order) > Number(first.stop_order)) {
        try {
          const availability = await api.get(`/api/bookings/trips/${trip.id}/availability/?from=${first.stop_order}&to=${last.stop_order}`);
          const seatsData = availability.data.seats || [];
          seatTotal = seatsData.length;
          openSeats = seatsData.filter((seat) => seat.available).length;
          occupancy = seatsData.length ? Math.round(((seatsData.length - openSeats) / seatsData.length) * 100) : 0;
          occupancyLabel = occupancy >= 80 ? "High Occupancy" : occupancy >= 50 ? "Med Occupancy" : "Low Occupancy";
          fareEstimate = Number(availability.data.fare_per_seat || 0) || fareEstimate;
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
        seats_total: seatTotal,
        occupancy_percent: occupancy,
        occupancy_label: occupancyLabel,
        fare_estimate: fareEstimate,
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
    loadWalletSummary();
    const tripRefresh = setInterval(() => loadBase({ silent: true }), activeView === "track" ? 1000 : 5000);
    const bookingRefresh = setInterval(() => loadBookings({ silent: true }), bookingRefreshMs);
    const walletRefresh = setInterval(() => loadWalletSummary({ silent: true }), 30000);
    return () => { clearInterval(tripRefresh); clearInterval(bookingRefresh); clearInterval(walletRefresh); };
  }, [activeView, bookingRefreshMs, loadBase, loadBookings, loadWalletSummary]);

  useEffect(() => {
    if (!activeBooking?.trip_id) return;
    const bookingTripId = String(activeBooking.trip_id);
    setSelectedTripId((current) => (acceptedTripId ? current || bookingTripId : bookingTripId));
    setAcceptedTripId((current) => current || bookingTripId);
  }, [acceptedTripId, activeBooking?.trip_id]);

  useEffect(() => {
    if (homeStage === "matches" && !visibleMatchedTrips.length) setHomeStage("planner");
  }, [homeStage, visibleMatchedTrips.length]);

  useEffect(() => {
    if (homeStage === "seats" && !acceptedTrip) setHomeStage(visibleMatchedTrips.length ? "matches" : "planner");
  }, [acceptedTrip, homeStage, visibleMatchedTrips.length]);

  useEffect(() => {
    if (homeStage === "ticket" && !ticketBooking) setHomeStage(acceptedTrip ? "seats" : visibleMatchedTrips.length ? "matches" : "planner");
  }, [acceptedTrip, homeStage, ticketBooking, visibleMatchedTrips.length]);

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
    const connect = () => {
      socket = new WebSocket(buildWsUrl(`/ws/transport/trips/${selectedTripId}/`));
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

  useEffect(() => {
    setHeaderPanel("");
  }, [activeView]);

  const openCheckout = useCallback((originView) => {
    const origin = originView && originView !== "checkout"
      ? originView
      : activeView === "checkout"
        ? checkoutOriginView || "home"
        : activeView;
    setCheckoutOriginView(origin || "home");
    setHeaderPanel("");
    setActiveView("checkout");
  }, [activeView, checkoutOriginView]);

  const closeCheckout = useCallback(() => {
    setActiveView(checkoutOriginView || (activeBooking ? "track" : "home"));
  }, [activeBooking, checkoutOriginView]);

  useEffect(() => {
    let subscribed = true;
    let reconnectTimer = null;
    let socket = null;

    const connect = () => {
      setBookingSocketState("connecting");
      socket = new WebSocket(buildWsUrl("/ws/bookings/stream/"));

      socket.onopen = () => {
        setBookingSocketState("connected");
        pushBookingLog("Passenger booking socket connected.");
      };

      socket.onerror = () => {
        pushBookingLog("Passenger booking socket error detected.");
      };

      socket.onmessage = async (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "SOCKET_CONNECTED") {
            pushBookingLog("Realtime payment channel is ready.");
            return;
          }

          pushBookingLog(`Realtime event: ${payload.type} for booking #${payload.booking_id}.`);
          await Promise.all([loadBookings({ silent: true }), loadWalletSummary({ silent: true })]);

          if (payload.type === "PAYMENT_REQUESTED") {
            const origin = activeViewRef.current === "checkout"
              ? checkoutOriginViewRef.current || "home"
              : activeViewRef.current;
            setCheckoutOriginView(origin || "home");
            setHeaderPanel("");
            setActiveView("checkout");
            setMsg(payload.message || `Payment requested for Booking #${payload.booking_id}.`);
          }

          if (payload.type === "BOOKING_SCANNED") {
            setMsg(payload.message || `Helper scanned Booking #${payload.booking_id}.`);
          }

          if (payload.type === "PAYMENT_CONFIRMED") {
            setMsg(payload.message || `Payment confirmed for Booking #${payload.booking_id}.`);
            setActiveView("track");
          }

          if (payload.type === "BOARDING_COMPLETED") {
            setMsg(payload.message || `Ride completed for Booking #${payload.booking_id}.`);
          }
        } catch {
          pushBookingLog("Received an unreadable passenger booking event.");
        }
      };

      socket.onclose = () => {
        setBookingSocketState("disconnected");
        if (subscribed) {
          pushBookingLog("Passenger booking socket disconnected. Reconnecting...");
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    };

    connect();
    return () => {
      subscribed = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) socket.close();
    };
  }, [loadBookings, loadWalletSummary, pushBookingLog]);

  useEffect(() => {
    const requestKey = paymentActionBooking
      ? `${paymentActionBooking.id}:${paymentActionBooking.payment_requested_at || ""}`
      : "";
    if (!requestKey || lastPaymentRequestKeyRef.current === requestKey) return;
    lastPaymentRequestKeyRef.current = requestKey;
    setCheckoutOriginView(activeView === "checkout" ? (checkoutOriginView || "home") : activeView);
    setHeaderPanel("");
    setActiveView("checkout");
    setMsg(`Payment requested for Booking #${paymentActionBooking.id}.`);
  }, [activeView, checkoutOriginView, paymentActionBooking]);

  const findRoutes = async () => {
    if (!pickupStopId || !dropStopId) { setErr("Choose both pickup and destination stops first."); setHomeStage("planner"); return; }
    if (String(pickupStopId) === String(dropStopId)) { setErr("Pickup and destination must be different."); return; }
    setFindingRoutes(true); setErr(""); setMsg("");
    setDismissedMatchIds([]);
    setAcceptedTripId("");
    setLastBookingId(null);
    setLastBookingSummary(null);
    setTicketBookingId(null);
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
        const fareEstimate = Number(availability.data.fare_per_seat || 0);
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
          seats_total: seatsData.length,
          occupancy_percent: occupancy,
          occupancy_label: occupancy >= 80 ? "High Occupancy" : occupancy >= 50 ? "Med Occupancy" : "Low Occupancy",
          eta: estimateEta(toLocPoint(trip.latest_location), toPoint(pickupRow.stop?.lat, pickupRow.stop?.lng), routePoints, trip.latest_location?.speed),
          fare_estimate: fareEstimate || 0,
        });
      }
      setMatchedTrips(matches);
      setSelectedTripId(String(matches[0]?.id || ""));
      setSelectedSeatIds([]);
      if (!matches.length) {
        setHomeStage("planner");
        setErr("No live buses found for that route right now.");
      } else {
        setHomeStage("matches");
        setMsg(`${matches.length} live bus${matches.length !== 1 ? "es" : ""} found.`);
      }
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
    setHomeStage("planner");
    setSelectionMode("");
    setErr("");
    if (!stops.length) return;
    if (type === "home") {
      if (!homeStopMatch) {
        setErr("Your saved home location is not ready yet. Please search or pick a pickup point on the map.");
        return;
      }
      setPickupStopId(String(homeStopMatch.id));
      if (!dropStopId) {
        if (officeStopMatch && String(officeStopMatch.id) !== String(homeStopMatch.id)) setDropStopId(String(officeStopMatch.id));
        else {
          const fallbackStop = stops.find((stop) => String(stop.id) !== String(homeStopMatch.id));
          if (fallbackStop) setDropStopId(String(fallbackStop.id));
        }
      }
      setMsg(`Pickup set to ${homeStopMatch.name}, the nearest stop to your saved home.`);
      return;
    }
    if (type === "work") {
      if (!officeStopMatch) {
        setErr("Your saved office location is not available yet. Please search or pick a destination on the map.");
        return;
      }
      if (!pickupStopId) {
        if (homeStopMatch && String(homeStopMatch.id) !== String(officeStopMatch.id)) setPickupStopId(String(homeStopMatch.id));
        else {
          const fallbackStop = stops.find((stop) => String(stop.id) !== String(officeStopMatch.id));
          if (fallbackStop) setPickupStopId(String(fallbackStop.id));
        }
      }
      setDropStopId(String(officeStopMatch.id));
      setMsg(`Destination set to ${officeStopMatch.name}, the nearest stop to your saved office.`);
      return;
    }
    if (type === "school") {
      if (!schoolStopMatch) {
        setErr("Your saved school location is not available yet. Please add it during registration or choose a destination on the map.");
        return;
      }
      if (!pickupStopId) {
        if (homeStopMatch && String(homeStopMatch.id) !== String(schoolStopMatch.id)) setPickupStopId(String(homeStopMatch.id));
        else if (officeStopMatch && String(officeStopMatch.id) !== String(schoolStopMatch.id)) setPickupStopId(String(officeStopMatch.id));
        else {
          const fallbackStop = stops.find((stop) => String(stop.id) !== String(schoolStopMatch.id));
          if (fallbackStop) setPickupStopId(String(fallbackStop.id));
        }
      }
      setDropStopId(String(schoolStopMatch.id));
      setMsg(`Destination set to ${schoolStopMatch.name}, the nearest stop to your saved school.`);
    }
  };
  const acceptMatchedTrip = (tripId) => {
    setSelectedTripId(String(tripId));
    setAcceptedTripId(String(tripId));
    setLastBookingId(null);
    setLastBookingSummary(null);
    setTicketBookingId(null);
    setSelectedSeatIds([]);
    setHomeStage("seats");
    setErr("");
    setMsg("Bus selected. Choose your seat in the next step.");
  };
  const declineMatchedTrip = (tripId) => {
    if (String(acceptedTripId) === String(tripId)) {
      setAcceptedTripId("");
      setLastBookingId(null);
      setLastBookingSummary(null);
      setTicketBookingId(null);
    }
    setDismissedMatchIds((current) => (
      current.includes(String(tripId)) ? current : [...current, String(tripId)]
    ));
    setSelectedSeatIds([]);
  };
  const openOccupancyDetails = useCallback(async (tripLike) => {
    const tripCandidate = typeof tripLike === "object" ? tripLike : (
      visibleMatchedTrips.find((trip) => String(trip.id) === String(tripLike))
      || displayTrips.find((trip) => String(trip.id) === String(tripLike))
      || hydrateTrip(liveTripsById.get(String(tripLike)))
    );
    if (!tripCandidate?.id) return;
    setOccupancyTripId(String(tripCandidate.id));
    setOccupancyBusy(true);
    setOccupancySeats([]);
    try {
      let fromOrder = tripCandidate.from_order;
      let toOrder = tripCandidate.to_order;
      if (!fromOrder || !toOrder || Number(toOrder) <= Number(fromOrder)) {
        const context = tripContexts[tripCandidate.id] || (await ensureCtx([tripCandidate]))[tripCandidate.id];
        const rows = context?.route_stops || [];
        fromOrder = rows[0]?.stop_order || 1;
        toOrder = rows[rows.length - 1]?.stop_order || 2;
      }
      const response = await api.get(`/api/bookings/trips/${tripCandidate.id}/availability/?from=${fromOrder}&to=${toOrder}`);
      const seatsData = response.data.seats || [];
      setOccupancySeats(seatsData);
      syncTripSeatMeta(tripCandidate.id, seatsData);
    } catch (error) {
      setErr(error?.response?.data?.detail || "Unable to load occupancy details.");
    } finally {
      setOccupancyBusy(false);
    }
  }, [displayTrips, ensureCtx, hydrateTrip, liveTripsById, syncTripSeatMeta, tripContexts, visibleMatchedTrips]);
  const toggleSeat = (seatId) => setSelectedSeatIds((current) => current.includes(seatId) ? current.filter((id) => id !== seatId) : [...current, seatId]);

  const bookSeats = async () => {
    if (activeBooking && Number(activeBooking.trip_id) !== Number(acceptedTrip?.id)) {
      setErr("Finish or cancel your current ride before booking another one.");
      return;
    }
    if (!acceptedTrip || !selectedSeatIds.length) { setErr("Accept a live bus and choose at least one seat."); return; }
    setBookingBusy(true); setErr(""); setMsg("");
    try {
      const response = await api.post(`/api/bookings/trips/${acceptedTrip.id}/book/`, { from_stop_order: acceptedTrip.from_order, to_stop_order: acceptedTrip.to_order, seat_ids: selectedSeatIds });
      setLastBookingId(response.data.id); setLastBookingSummary(response.data); setTicketBookingId(response.data.id);
      setHomeStage("ticket");
      setSelectedTripId(String(acceptedTrip.id));
      setMsg(`Booking #${response.data.id} confirmed. Your QR ticket is ready below.`);
      await loadSeats(acceptedTrip.id, acceptedTrip.from_order, acceptedTrip.to_order);
      await loadBookings({ silent: true });
    } catch (error) { setErr(error?.response?.data?.detail || "Booking failed."); }
    finally { setBookingBusy(false); }
  };

  const pay = async (method, bookingId = lastBookingId) => {
    if (method === "OPEN_CHECKOUT") {
      pushBookingLog("Passenger opened the checkout screen.");
      openCheckout();
      return;
    }
    if (!bookingId) { setErr("Create a booking first."); return; }
    setPaymentBusy(true); setErr(""); setMsg("");
    pushBookingLog(`Passenger selected ${method} for booking #${bookingId}.`);
    try {
      const response = await api.post("/api/payments/create/", { booking_id: bookingId, method });
      const { redirect, payment } = response.data;
      if (response.data.wallet) setWalletSummary(response.data.wallet);
      setLastBookingSummary((current) => (
        current && Number(current.id) === Number(bookingId)
          ? { ...current, payment_status: payment?.status || current.payment_status, payment_method: payment?.method || current.payment_method, payment: payment || current.payment }
          : current
      ));
      if (redirect?.type === "REDIRECT" && redirect.url) { window.location.href = redirect.url; return; }
      if (redirect?.type === "FORM_POST" && redirect.url) { buildFormPost(redirect); return; }
      await Promise.all([loadBookings({ silent: true }), loadWalletSummary({ silent: true })]);
      if (payment?.status === "SUCCESS") {
        pushBookingLog(`Payment confirmed immediately with ${method}.`);
        setMsg("Payment completed for this booking.");
        setActiveView("track");
      } else if (payment?.status === "PENDING") {
        pushBookingLog(`Payment is pending after selecting ${method}.`);
        if (method === "CASH") {
          setMsg("Cash selected. Hand the fare to the helper so they can verify the payment.");
        } else {
          setMsg("Payment is pending. Keep MetroBus open while MetroBus checks the status.");
        }
        setActiveView("checkout");
      } else {
        setMsg(`Payment ${payment?.status || "PENDING"}.`);
      }
    } catch (error) { setErr(error?.response?.data?.detail || "Payment failed."); }
    finally { setPaymentBusy(false); }
  };

  const topUpWallet = async (amount = 500) => {
    setWalletBusy(true); setErr(""); setMsg("");
    try {
      const response = await api.post("/api/payments/wallet/top-up/", { amount });
      setWalletSummary(response.data.wallet || null);
      setMsg(response.data.message || "Wallet topped up.");
    } catch (error) {
      setErr(error?.response?.data?.detail || "Wallet top-up failed.");
    } finally {
      setWalletBusy(false);
    }
  };

  const buyRidePass = async (plan) => {
    setWalletBusy(true); setErr(""); setMsg("");
    try {
      const response = await api.post("/api/payments/wallet/pass/", { plan });
      setWalletSummary(response.data.wallet || null);
      setPassPlans(response.data.pass_plans || passPlans);
      setMsg(response.data.message || "Ride pass activated.");
    } catch (error) {
      setErr(error?.response?.data?.detail || "Ride pass activation failed.");
    } finally {
      setWalletBusy(false);
    }
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

  const contactTripSupport = async () => {
    const text = `Hello MetroBus, I need help with ${selectedTrip?.route_name || "my ride"}${selectedTrip?.bus_plate ? ` on ${selectedTrip.bus_plate}` : ""}${activeBooking ? ` for booking #${activeBooking.id}` : ""}.`;
    try {
      window.location.href = `sms:?body=${encodeURIComponent(text)}`;
      setMsg("Opening your messaging app for trip support.");
    } catch {
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(text);
          setMsg("Support message copied. Paste it into your messaging app.");
          return;
        }
      } catch {
        // Fall through to a visible error.
      }
      setErr("Unable to open your messaging app right now.");
    }
  };

  const openMenuPanel = () => {
    setHeaderPanel((current) => (current === "menu" ? "" : "menu"));
  };

  const openNotificationsPanel = () => {
    setHeaderPanel((current) => (current === "notifications" ? "" : "notifications"));
  };

  const openNotificationTarget = (item) => {
    if (!item) return;
    if (item.action === "payment" || item.action === "track") {
      if (item.action === "payment") openCheckout();
      else setActiveView("track");
    } else if (item.action === "ticket" && activeBooking) {
      setTicketBookingId(activeBooking.id);
      setActiveView("rides");
    } else if (item.action === "profile") {
      setActiveView("profile");
    }
    setHeaderPanel("");
  };

  const closeCancellationSheet = () => {
    setCancellationBookingId(null);
    setCancellationReason("");
    setCancellationNote("");
  };

  const cancelBooking = useCallback(async (bookingId, reason, note = "") => {
    const response = await api.post(`/api/bookings/${bookingId}/cancel/`, { reason, note });
    const cancelledBooking = response.data.booking || null;
    setBookings((current) => current.map((booking) => (Number(booking.id) === Number(bookingId) ? cancelledBooking || booking : booking)));
    if (Number(lastBookingId) === Number(bookingId)) setLastBookingId(null);
    setLastBookingSummary((current) => (current && Number(current.id) === Number(bookingId) ? null : current));
    if (Number(ticketBookingId) === Number(bookingId)) setTicketBookingId(null);
    if (Number(selectedTripId) === Number(cancelledBooking?.trip_id || activeBooking?.trip_id)) {
      setSelectedTripId("");
    }
    if (Number(acceptedTripId) === Number(cancelledBooking?.trip_id || activeBooking?.trip_id)) {
      setAcceptedTripId("");
    }
    setSelectedSeatIds([]);
    setHomeStage("planner");
    setMatchedTrips([]);
    setDismissedMatchIds([]);
    setMsg(response.data.message || "Ride cancelled.");
    return cancelledBooking;
  }, [acceptedTripId, activeBooking?.trip_id, lastBookingId, selectedTripId, ticketBookingId]);

  const confirmPassengerCancellation = async () => {
    if (!cancellationBookingId || !cancellationReason) {
      setErr("Choose a cancellation reason first.");
      return;
    }
    if (cancellationReason === "OTHER" && !cancellationNote.trim()) {
      setErr("Please enter a short note for the cancellation.");
      return;
    }
    setCancellationBusy(true);
    setErr("");
    setMsg("");
    try {
      await cancelBooking(cancellationBookingId, cancellationReason, cancellationNote.trim());
      closeCancellationSheet();
      if (activeView === "track") setActiveView("home");
      await loadBookings({ silent: true });
    } catch (error) {
      setErr(error?.response?.data?.note?.[0] || error?.response?.data?.detail || "Unable to cancel this ride.");
    } finally {
      setCancellationBusy(false);
    }
  };

  const requestCancellation = (booking) => {
    if (!booking?.can_cancel) {
      setErr("This ride can no longer be cancelled.");
      return;
    }
    setErr("");
    setMsg("");
    setCancellationBookingId(booking.id);
    setCancellationReason("");
    setCancellationNote("");
  };

  const handleLogout = useCallback(async () => {
    try {
      setErr("");
      setMsg("");
      if (logoutCancellationBookings.length) {
        await Promise.allSettled(
          logoutCancellationBookings.map((booking) =>
            cancelBooking(booking.id, "LOGOUT", "Passenger logged out while the ride was still active."),
          ),
        );
      }
    } catch {
      // Logout should still proceed even if the cancellation request fails.
    } finally {
      clearToken();
      setUser(null);
      navigate("/auth/login", { replace: true });
    }
  }, [cancelBooking, logoutCancellationBookings, navigate, setUser]);

  const goBackHomeStage = () => {
    setErr("");
    setMsg("");
    if (homeStage === "matches") {
      setHomeStage("planner");
      return;
    }
    if (homeStage === "seats") {
      setAcceptedTripId("");
      setSelectedSeatIds([]);
      setLastBookingId(null);
      setLastBookingSummary(null);
      setTicketBookingId(null);
      setHomeStage(visibleMatchedTrips.length ? "matches" : "planner");
      return;
    }
    if (homeStage === "ticket") {
      setHomeStage(acceptedTrip ? "seats" : visibleMatchedTrips.length ? "matches" : "planner");
    }
  };

  const restartHomeFlow = () => {
    setHomeStage("planner");
    setMatchedTrips([]);
    setDismissedMatchIds([]);
    setSelectedTripId("");
    setAcceptedTripId("");
    setSelectedSeatIds([]);
    setLastBookingId(null);
    setLastBookingSummary(null);
    setTicketBookingId(null);
    setErr("");
    setMsg("");
  };

  if (showSplash) return <SplashScreen />;
  if (loading) return <div style={PASSENGER_THEME} className="min-h-screen bg-[var(--mb-bg)] px-6 py-20 text-center text-xl font-semibold text-[var(--mb-muted)]">Loading your MetroBus dashboard...</div>;

  return (
    <div style={PASSENGER_THEME} className="min-h-screen bg-[linear-gradient(180deg,var(--mb-bg),var(--mb-bg-alt))] text-[var(--mb-text)]">
      <HeaderBar
        user={user}
        activeView={activeView}
        onLogout={handleLogout}
        onMenu={openMenuPanel}
        onNotifications={openNotificationsPanel}
        notificationCount={passengerNotifications.length}
      />
      <main className="mx-auto max-w-[28rem] px-4 pb-36 pt-24">
        {err ? <div className="mb-4 rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{err}</div> : null}
        {msg ? <div className="mb-4 rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{msg}</div> : null}
        {(activeBooking || paymentActionBooking || paymentPendingBooking || activeView === "checkout") ? (
          <div className="mb-4 rounded-[24px] border border-[var(--mb-border)] bg-white px-4 py-4 shadow-[var(--mb-shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--mb-purple)]">Realtime Status</p>
                <p className="mt-1 text-sm font-medium text-[var(--mb-muted)]">Socket: {bookingSocketState}</p>
              </div>
              <span className="rounded-full bg-[var(--mb-card-soft)] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--mb-purple)]">
                {bookingEventLog.length} events
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {bookingEventLog.length ? bookingEventLog.map((item) => (
                <div key={item.id} className="rounded-[18px] bg-[var(--mb-card-soft)] px-3 py-3 text-sm font-medium text-[var(--mb-text)]">
                  {item.text}
                </div>
              )) : (
                <div className="rounded-[18px] border border-dashed border-[var(--mb-border)] px-3 py-3 text-sm text-[var(--mb-muted)]">
                  Waiting for helper scan and payment events.
                </div>
              )}
            </div>
          </div>
        ) : null}
        {paymentActionBooking && activeView !== "checkout" ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[var(--mb-border)] bg-white px-4 py-3 shadow-[var(--mb-shadow)]">
            <div>
              <p className="text-sm font-black text-[var(--mb-text)]">A helper requested payment for Booking #{paymentActionBooking.id}.</p>
              <p className="mt-1 text-sm text-[var(--mb-muted)]">MetroBus opened a dedicated checkout page for this booking.</p>
            </div>
            <button type="button" onClick={() => openCheckout()} className="rounded-full bg-[linear-gradient(135deg,var(--mb-accent),var(--mb-accent-2))] px-5 py-3 text-sm font-black text-white shadow-[var(--mb-shadow-strong)]">
              Pay Now
            </button>
          </div>
        ) : null}
        {!paymentActionBooking && paymentPendingBooking && activeView !== "checkout" ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[var(--mb-border)] bg-white px-4 py-3 text-sm font-medium text-[var(--mb-muted)] shadow-[var(--mb-shadow)]">
            <p>
              Payment for Booking #{paymentPendingBooking.id} is pending. {paymentPendingBooking.payment_method === "CASH" ? "Please hand the fare to the helper for verification." : "Keep MetroBus open while the payment completes."}
            </p>
            <button
              type="button"
              onClick={() => openCheckout()}
              className="rounded-full border border-[var(--mb-border)] bg-[var(--mb-card-soft)] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--mb-purple)]"
            >
              View Checkout
            </button>
          </div>
        ) : null}

        {activeView === "home" ? (
          <section className="space-y-5">
            <div className="rounded-[42px] bg-[radial-gradient(circle_at_top_right,rgba(255,107,115,0.18),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,244,244,0.96))] p-5 shadow-[var(--mb-shadow)] md:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.28em] text-[var(--mb-purple)]">
                    {homeStageMeta[homeStage]?.eyebrow || "MetroBus Booking"}
                  </p>
                  <h1 className="mt-3 text-[2.7rem] font-black leading-[0.95] text-[var(--mb-text)] md:text-[4rem]">
                    {homeStageMeta[homeStage]?.title || "Book your ride"}
                  </h1>
                  <p className="mt-3 max-w-2xl text-base font-medium text-[var(--mb-muted)]">
                    {homeStageMeta[homeStage]?.description || "Move through the booking flow on one mobile screen."}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!homeBookingLocked && homeStage !== "planner" ? (
                    <button
                      type="button"
                      onClick={goBackHomeStage}
                      className="rounded-full border border-[var(--mb-border)] bg-white px-4 py-2.5 text-sm font-black text-[var(--mb-purple)] shadow-[var(--mb-shadow)]"
                    >
                      Back
                    </button>
                  ) : null}
                  {!homeBookingLocked && (matchedTrips.length || acceptedTripId || lastBookingSummary) ? (
                    <button
                      type="button"
                      onClick={restartHomeFlow}
                      className="rounded-full border border-[var(--mb-border)] bg-white px-4 py-2.5 text-sm font-black text-[var(--mb-text)] shadow-[var(--mb-shadow)]"
                    >
                      Start Over
                    </button>
                  ) : null}
                </div>
              </div>

              {!homeBookingLocked ? (
                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {stageOrder.map((stage, index) => {
                    const reached = stageOrder.indexOf(homeStage) >= index;
                    const active = homeStage === stage;
                    return (
                      <div
                        key={stage}
                        className={`rounded-[24px] px-4 py-3 text-sm font-black transition ${
                          active
                            ? "bg-[linear-gradient(135deg,var(--mb-accent),var(--mb-accent-2))] text-white shadow-[var(--mb-shadow-strong)]"
                            : reached
                              ? "bg-[var(--mb-accent-soft)] text-[var(--mb-purple)]"
                              : "bg-white text-[var(--mb-muted)]"
                        }`}
                      >
                        <span className="block text-[0.65rem] uppercase tracking-[0.2em] opacity-80">Step {index + 1}</span>
                        <span className="mt-1 block">{stage === "planner" ? "Route" : stage === "matches" ? "Bus" : stage === "seats" ? "Seat" : "QR"}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {!homeBookingLocked && (pickupStop || dropStop) ? (
                <div className="mt-5 flex flex-wrap items-center gap-3 rounded-[26px] bg-[var(--mb-card-soft)] p-4">
                  <span className="rounded-full bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--mb-purple)]">Current route</span>
                  <p className="text-base font-bold text-[var(--mb-text)]">
                    {pickupStop?.name || "Choose pickup"} to {dropStop?.name || "Choose destination"}
                  </p>
                </div>
              ) : null}
            </div>

            {homeStage === "planner" ? (
              <div className="space-y-4">
                {activeBooking ? (
                  <div className="space-y-4">
                    {homeRideBooking ? <TicketQrCard booking={homeRideBooking} title="Current Ride" /> : null}
                    {paymentActionBooking || paymentPendingBooking ? (
                      <PaymentRequestCard
                        booking={paymentActionBooking || paymentPendingBooking}
                        paymentBusy={paymentBusy}
                        onPay={pay}
                      />
                    ) : (
                      <div className="rounded-[28px] bg-white p-5 shadow-[var(--mb-shadow)]">
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--mb-purple)]">Next Step</p>
                        <p className="mt-3 text-base font-medium leading-7 text-[var(--mb-muted)]">
                          Keep this QR ready. When the helper scans or loads your ticket, MetroBus will ask for payment on this same ride and you can continue with cash or Khalti checkout.
                        </p>
                      </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setActiveView("track")}
                        className="rounded-full bg-[linear-gradient(135deg,var(--mb-accent),var(--mb-accent-2))] px-5 py-4 text-base font-black text-white shadow-[var(--mb-shadow-strong)]"
                      >
                        Track Ride
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTicketBookingId(activeBooking.id);
                          setActiveView("rides");
                        }}
                        className="rounded-full border border-[var(--mb-border)] bg-white px-5 py-4 text-base font-black text-[var(--mb-text)] shadow-[var(--mb-shadow)]"
                      >
                        Open Ticket Details
                      </button>
                      {(paymentActionBooking || paymentPendingBooking) ? (
                        <button
                          type="button"
                          onClick={() => openCheckout("home")}
                          className="rounded-full border border-[var(--mb-border)] bg-[var(--mb-card-soft)] px-5 py-4 text-base font-black text-[var(--mb-purple)] shadow-[var(--mb-shadow)] sm:col-span-2"
                        >
                          Open Checkout
                        </button>
                      ) : null}
                      {activeBooking.can_cancel ? (
                        <button
                          type="button"
                          onClick={() => requestCancellation(activeBooking)}
                          className={`rounded-full border border-red-200 bg-white px-5 py-4 text-base font-black text-red-600 shadow-[var(--mb-shadow)] ${(paymentActionBooking || paymentPendingBooking) ? "sm:col-span-2" : ""}`}
                        >
                          Cancel Ride
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {!activeBooking ? <div className="flex gap-3 overflow-x-auto pb-1">
                  {quickRouteOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => applyQuickRoute(option.id)}
                      className={`min-w-[11rem] rounded-[24px] border px-4 py-4 text-left shadow-[var(--mb-shadow)] transition ${
                        option.ready ? "border-transparent bg-white hover:-translate-y-0.5" : "border-[var(--mb-border)] bg-[#fbf3fd] text-[var(--mb-muted)]"
                      }`}
                    >
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--mb-purple)]">{option.label}</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--mb-text)]">{option.caption}</p>
                    </button>
                  ))}
                </div> : null}
                {!activeBooking ? <PlannerCard
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
                  matchedTrips={[]}
                  selectedTripId={selectedTripId}
                  onSelectTrip={acceptMatchedTrip}
                  onDeclineTrip={declineMatchedTrip}
                  onViewOccupancy={openOccupancyDetails}
                  displayLine={displayLine}
                  showSubmit={false}
                /> : null}
                {!activeBooking ? <button
                  type="button"
                  onClick={findRoutes}
                  disabled={findingRoutes}
                  className="flex w-full items-center justify-center gap-3 rounded-full bg-[linear-gradient(135deg,var(--mb-accent),var(--mb-accent-2))] px-6 py-5 text-[1.1rem] font-black text-white shadow-[var(--mb-shadow-strong)] disabled:opacity-60"
                >
                  <span>{findingRoutes ? "Finding Buses..." : "Find Buses"}</span>
                  <span className="text-xl">→</span>
                </button> : null}
                {cancellationBooking ? (
                  <CancellationSheet
                    booking={cancellationBooking}
                    reasons={cancellationReasons}
                    reason={cancellationReason}
                    note={cancellationNote}
                    busy={cancellationBusy}
                    onReasonChange={setCancellationReason}
                    onNoteChange={setCancellationNote}
                    onConfirm={confirmPassengerCancellation}
                    onClose={closeCancellationSheet}
                  />
                ) : null}
              </div>
            ) : null}

            {homeStage === "matches" ? (
              <div className="space-y-4">
                <div className="rounded-[2rem] bg-[var(--mb-card-strong)] px-5 py-5 shadow-[var(--mb-shadow)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--mb-purple)]">Pickup</p>
                        <p className="mt-1 break-words text-[1.4rem] font-black leading-tight text-[var(--mb-text)]">{pickupStop?.name || "Choose pickup"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--mb-muted)]">Drop-off</p>
                        <p className="mt-1 break-words text-[1.4rem] font-black leading-tight text-[var(--mb-text)]">{dropStop?.name || "Choose destination"}</p>
                      </div>
                    </div>
                    <button type="button" onClick={goBackHomeStage} className="grid h-14 w-14 place-items-center rounded-full bg-white text-[var(--mb-purple)] shadow-[var(--mb-shadow)]">
                      <Icon name="edit" className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <h2 className="text-[2rem] font-black tracking-[-0.04em] text-[var(--mb-text)]">Nearby Results</h2>
                <div className="space-y-3">
                  {visibleMatchedTrips.map((trip, index) => {
                    const canAccept = trip.open_seats == null || trip.open_seats > 0;
                    const occupancyPercent = trip.occupancy_percent ?? 0;
                    const occupancyTone = occupancyPercent >= 80 ? "bg-[#f16060]" : occupancyPercent >= 50 ? "bg-[#f0b400]" : "bg-[#22c55e]";
                    return (
                      <div key={trip.id} className="rounded-[2rem] bg-white p-5 shadow-[var(--mb-shadow)]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-words text-[2rem] font-black leading-tight text-[var(--mb-purple)]">{trip.bus_plate || `Bus ${index + 1}`}</p>
                            <p className="mt-2 break-words text-[1.05rem] font-medium leading-6 text-[var(--mb-text)]">{trip.route_name}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[2rem] font-black text-[var(--mb-text)]">Rs. {Number(trip.fare_estimate || 0).toLocaleString()}</p>
                            <p className="mt-2 text-sm font-black text-[var(--mb-purple)]">ETA: {trip.eta?.minutes ? `${Math.max(1, Math.round(trip.eta.minutes))} min` : "Live"}</p>
                          </div>
                        </div>
                        <div className="mt-5 rounded-full bg-[var(--mb-bg-alt)] px-4 py-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <Icon name="profile" className="h-5 w-5 text-[var(--mb-success)]" />
                              <p className="text-[1.05rem] font-medium text-[var(--mb-text)]">{occupancyPercent}% Full</p>
                              <div className="h-3 w-24 overflow-hidden rounded-full bg-[#d8d0ea]">
                                <div className={`h-full rounded-full ${occupancyTone}`} style={{ width: `${Math.max(8, occupancyPercent)}%` }} />
                              </div>
                            </div>
                            <button type="button" onClick={() => openOccupancyDetails(trip)} className="shrink-0 text-sm font-black text-[var(--mb-purple)]">
                              Occupancy Details
                            </button>
                          </div>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            disabled={!canAccept}
                            onClick={() => acceptMatchedTrip(trip.id)}
                            className={`rounded-full px-5 py-4 text-[1.05rem] font-black ${canAccept ? "bg-[linear-gradient(135deg,var(--mb-accent),var(--mb-accent-2))] text-white shadow-[var(--mb-shadow-strong)]" : "bg-[#e7d8df] text-[#8b7180]"}`}
                          >
                            {canAccept ? "Accept" : "Full"}
                          </button>
                          <button
                            type="button"
                            onClick={() => declineMatchedTrip(trip.id)}
                            className="rounded-full border border-[var(--mb-border)] bg-white px-5 py-4 text-[1.05rem] font-black text-[var(--mb-text)]"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {homeStage === "seats" ? (
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
                walletSummary={walletSummary}
                pickupStop={pickupStop}
                dropStop={dropStop}
              />
            ) : null}

            {homeStage === "ticket" ? (
              <div className="space-y-4">
                {ticketBooking ? <TicketQrCard booking={ticketBooking} title="Ride QR" /> : null}
                {paymentActionBooking ? (
                  <PaymentRequestCard booking={paymentActionBooking} paymentBusy={paymentBusy} onPay={pay} />
                ) : (
                  <div className="rounded-[30px] bg-white p-5 shadow-[var(--mb-shadow)]">
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--mb-purple)]">Next</p>
                    <p className="mt-2 text-base font-medium text-[var(--mb-muted)]">
                      Keep this QR ready. When the helper scans or loads your ticket and requests payment, MetroBus will open a dedicated passenger checkout page for cash, eSewa, Khalti, wallet, pass, or reward payment on this same booking.
                    </p>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setActiveView("track")}
                    className="rounded-full bg-[linear-gradient(135deg,var(--mb-accent),var(--mb-accent-2))] px-6 py-4 text-base font-black text-white shadow-[var(--mb-shadow-strong)]"
                  >
                    Track Live Bus
                  </button>
                  <button
                    type="button"
                    onClick={goBackHomeStage}
                    className="rounded-full border border-[var(--mb-border)] bg-white px-6 py-4 text-base font-black text-[var(--mb-text)]"
                  >
                    Back to Previous Step
                  </button>
                </div>
                {ticketBooking?.can_cancel ? (
                  <button
                    type="button"
                    onClick={() => requestCancellation(ticketBooking)}
                    className="w-full rounded-full border border-red-200 bg-white px-6 py-4 text-base font-black text-red-600 shadow-[var(--mb-shadow)]"
                  >
                    Cancel This Ride
                  </button>
                ) : null}
                {cancellationBooking && Number(cancellationBooking.id) === Number(ticketBooking?.id) ? (
                  <CancellationSheet
                    booking={cancellationBooking}
                    reasons={cancellationReasons}
                    reason={cancellationReason}
                    note={cancellationNote}
                    busy={cancellationBusy}
                    onReasonChange={setCancellationReason}
                    onNoteChange={setCancellationNote}
                    onConfirm={confirmPassengerCancellation}
                    onClose={closeCancellationSheet}
                  />
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {activeView === "checkout" ? (
          <CheckoutPage
            booking={checkoutBooking}
            walletSummary={walletSummary}
            paymentBusy={paymentBusy}
            onPay={pay}
            onBack={closeCheckout}
            onTrack={() => setActiveView("track")}
            onViewTicket={() => {
              if (checkoutBooking?.id) {
                setTicketBookingId(checkoutBooking.id);
                setActiveView("rides");
                return;
              }
              closeCheckout();
            }}
          />
        ) : null}

        {activeView === "track" ? (
          <section className="space-y-5">
            {paymentActionBooking ? <PaymentRequestCard booking={paymentActionBooking} paymentBusy={paymentBusy} onPay={pay} /> : null}
            <TrackMap trip={selectedTrip} displayLine={displayLine} now={now} />
            <DriverCard
              trip={selectedTrip}
              onShare={shareTrip}
              onChat={contactTripSupport}
            />
            {activeBooking?.can_cancel ? (
              <button
                type="button"
                onClick={() => requestCancellation(activeBooking)}
                className="w-full rounded-full border border-red-200 bg-white px-6 py-4 text-base font-black text-red-600 shadow-[var(--mb-shadow)]"
              >
                Cancel Current Ride
              </button>
            ) : null}
            {cancellationBooking && Number(cancellationBooking.id) === Number(activeBooking?.id) ? (
              <CancellationSheet
                booking={cancellationBooking}
                reasons={cancellationReasons}
                reason={cancellationReason}
                note={cancellationNote}
                busy={cancellationBusy}
                onReasonChange={setCancellationReason}
                onNoteChange={setCancellationNote}
                onConfirm={confirmPassengerCancellation}
                onClose={closeCancellationSheet}
              />
            ) : null}
          </section>
        ) : null}

        {activeView === "rides" ? <section className="space-y-7"><div className="inline-flex rounded-full bg-[var(--mb-card-soft)] p-2 shadow-[var(--mb-shadow)]">{["upcoming", "past"].map((tab) => <button key={tab} type="button" onClick={() => setRideTab(tab)} className={`rounded-full px-10 py-4 text-2xl font-black transition ${rideTab === tab ? "bg-[linear-gradient(135deg,var(--mb-accent),var(--mb-accent-2))] text-white shadow-[var(--mb-shadow-strong)]" : "text-[var(--mb-text)]"}`}>{tab === "upcoming" ? "Upcoming" : "Past"}</button>)}</div><div className="flex items-center justify-between gap-3"><h2 className="text-4xl font-black text-[var(--mb-text)]">Active Reservations</h2>{bookingsLoading ? <span className="text-sm font-medium text-[var(--mb-muted)]">Syncing rides...</span> : null}</div>{rideTab === "upcoming" ? <>{paymentActionBooking ? <PaymentRequestCard booking={paymentActionBooking} paymentBusy={paymentBusy} onPay={pay} /> : null}{activeBooking ? <div className="space-y-4"><ReservationCard booking={activeBooking} onPrimaryAction={() => setActiveView("track")} primaryActionLabel="Track Ride" onViewTicket={() => setTicketBookingId(activeBooking.id)} />{activeBooking.can_cancel ? <button type="button" onClick={() => requestCancellation(activeBooking)} className="w-full rounded-full border border-red-200 bg-white px-6 py-4 text-lg font-black text-red-600 shadow-[var(--mb-shadow)]">Cancel Ride</button> : null}{cancellationBooking && Number(cancellationBooking.id) === Number(activeBooking.id) ? <CancellationSheet booking={cancellationBooking} reasons={cancellationReasons} reason={cancellationReason} note={cancellationNote} busy={cancellationBusy} onReasonChange={setCancellationReason} onNoteChange={setCancellationNote} onConfirm={confirmPassengerCancellation} onClose={closeCancellationSheet} /> : null}</div> : <div className="rounded-[36px] border border-dashed border-[var(--mb-border)] bg-[var(--mb-card)] p-8 text-center text-lg text-[var(--mb-muted)]">No active reservations yet.</div>}</> : pastBookings.map((booking) => <HistoryCard key={booking.id} booking={booking} onDownload={() => downloadInvoice(booking)} />)}<div className="flex items-center justify-between gap-3"><h2 className="text-4xl font-black text-[var(--mb-text)]">Recent History</h2><button type="button" onClick={() => setRideTab("past")} className="text-lg font-black uppercase tracking-[0.16em] text-[var(--mb-purple)]">View All</button></div>{historyBooking ? <HistoryCard booking={historyBooking} onDownload={() => downloadInvoice(historyBooking)} /> : null}{ticketBooking ? <div className="space-y-3"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--mb-purple)]">Ticket Preview</p><h3 className="mt-2 text-3xl font-black text-[var(--mb-text)]">Booking #{ticketBooking.id}</h3></div><button type="button" onClick={() => setTicketBookingId(null)} className="rounded-full bg-white px-4 py-2 text-sm font-black text-[var(--mb-purple)] shadow-[var(--mb-shadow)]">Close</button></div><TicketQrCard booking={ticketBooking} compact /></div> : null}</section> : null}

        {activeView === "profile" ? <section className="space-y-7"><ProfileCard user={user} profileForm={profileForm} setProfileForm={setProfileForm} onSave={saveProfile} profileBusy={profileBusy} /><PaymentShowcase latestPaidBooking={latestPaidBooking} walletSummary={walletSummary} passPlans={passPlans} onTopUp={() => topUpWallet(500)} onBuyPass={buyRidePass} actionBusy={walletBusy} /><div className="space-y-4"><h3 className="text-3xl font-black text-[var(--mb-text)]">Settings</h3><SettingsRow icon="bell" title="Notifications" description="Trip updates and boarding alerts" trailing={<button type="button" onClick={() => setSettings((current) => ({ ...current, arrivalAlerts: !current.arrivalAlerts }))} className={`relative h-7 w-12 rounded-full transition ${settings.arrivalAlerts ? "bg-[var(--mb-purple)]" : "bg-[#d9c6df]"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${settings.arrivalAlerts ? "left-6" : "left-1"}`} /></button>} /><SettingsRow icon="track" title="Live Tracking" description="Show live bus movement on the map" trailing={<button type="button" onClick={() => setSettings((current) => ({ ...current, liveTracking: !current.liveTracking }))} className={`relative h-7 w-12 rounded-full transition ${settings.liveTracking ? "bg-[var(--mb-purple)]" : "bg-[#d9c6df]"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${settings.liveTracking ? "left-6" : "left-1"}`} /></button>} /><SettingsRow icon="shield" title="Security & Privacy" description="Protected with verified phone login" /><SettingsRow icon="help" title="Help & Support" description="Need assistance with a route or payment?" /></div><button type="button" onClick={handleLogout} className="w-full rounded-full border border-red-200 bg-white px-6 py-5 text-2xl font-black text-red-600">Log Out</button></section> : null}
      </main>
      {occupancyTrip ? (
        <OccupancySheet
          trip={occupancyTrip}
          seats={occupancySeats}
          loading={occupancyBusy}
          onClose={() => {
            setOccupancyTripId("");
            setOccupancySeats([]);
          }}
        />
      ) : null}
      {headerPanel ? (
        <div className="fixed inset-0 z-[1350] bg-[rgba(49,23,56,0.32)] px-4 pb-28 pt-24 backdrop-blur-sm" onClick={() => setHeaderPanel("")}>
          <div className="mx-auto max-w-[28rem]" onClick={(event) => event.stopPropagation()}>
            {headerPanel === "menu" ? (
              <div className="rounded-[34px] bg-white p-5 shadow-[0_30px_80px_rgba(95,25,230,0.2)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--mb-purple)]">Passenger Menu</p>
                    <h3 className="mt-2 text-3xl font-black text-[var(--mb-text)]">Quick actions</h3>
                  </div>
                  <button type="button" onClick={() => setHeaderPanel("")} className="rounded-full bg-[var(--mb-bg-alt)] px-3 py-2 text-xs font-black text-[var(--mb-purple)]">
                    Close
                  </button>
                </div>
                <div className="mt-5 grid gap-3">
                  {[
                    { id: "home", label: "Go to Home", note: "Book and manage your next ride" },
                    { id: "track", label: "Open Track", note: "See your live bus movement" },
                    { id: "rides", label: "Open My Rides", note: "Tickets, history, and payment requests" },
                    { id: "profile", label: "Open Profile", note: "Wallet, passes, and settings" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveView(item.id);
                        setHeaderPanel("");
                      }}
                      className="rounded-[24px] border border-[var(--mb-border)] bg-[var(--mb-card-soft)] px-4 py-4 text-left"
                    >
                      <span className="block text-lg font-black text-[var(--mb-text)]">{item.label}</span>
                      <span className="mt-1 block text-sm text-[var(--mb-muted)]">{item.note}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {headerPanel === "notifications" ? (
              <div className="rounded-[34px] bg-white p-5 shadow-[0_30px_80px_rgba(95,25,230,0.2)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--mb-purple)]">Notifications</p>
                    <h3 className="mt-2 text-3xl font-black text-[var(--mb-text)]">Passenger alerts</h3>
                  </div>
                  <button type="button" onClick={() => setHeaderPanel("")} className="rounded-full bg-[var(--mb-bg-alt)] px-3 py-2 text-xs font-black text-[var(--mb-purple)]">
                    Close
                  </button>
                </div>
                <div className="mt-5 grid gap-3">
                  {passengerNotifications.length ? passengerNotifications.map((item) => (
                    <div key={item.id} className="rounded-[24px] border border-[var(--mb-border)] bg-[var(--mb-card-soft)] px-4 py-4">
                      <p className="text-lg font-black text-[var(--mb-text)]">{item.title}</p>
                      <p className="mt-2 text-sm text-[var(--mb-muted)]">{item.body}</p>
                      <button
                        type="button"
                        onClick={() => openNotificationTarget(item)}
                        className="mt-4 rounded-full bg-[linear-gradient(135deg,var(--mb-accent),var(--mb-accent-2))] px-4 py-2.5 text-sm font-black text-white shadow-[var(--mb-shadow)]"
                      >
                        {item.actionLabel}
                      </button>
                    </div>
                  )) : (
                    <div className="rounded-[24px] border border-dashed border-[var(--mb-border)] bg-[var(--mb-card)] px-4 py-8 text-center text-sm font-medium text-[var(--mb-muted)]">
                      No new passenger alerts right now.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <BottomNav activeView={activeView} onChange={setActiveView} />
    </div>
  );
}
