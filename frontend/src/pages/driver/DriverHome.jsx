import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { api } from "../../api";
import { useAuth } from "../../AuthContext";
import { clearToken } from "../../auth";

const TABS = [
  { id: "home", label: "Home", short: "HM" },
  { id: "active", label: "Active Trip", short: "AT" },
  { id: "history", label: "History", short: "HS" },
  { id: "earnings", label: "Earnings", short: "NR" },
];

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatTimeOnly(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return value;
  }
}

function minutesUntil(value) {
  if (!value) return null;
  const diff = Math.round((new Date(value).getTime() - Date.now()) / 60000);
  if (Number.isNaN(diff)) return null;
  return diff;
}

function distanceBetween(pointA, pointB) {
  if (!pointA || !pointB) return Number.POSITIVE_INFINITY;
  const latDelta = Number(pointA[0]) - Number(pointB[0]);
  const lngDelta = Number(pointA[1]) - Number(pointB[1]);
  return Math.sqrt(latDelta * latDelta + lngDelta * lngDelta);
}

function HeaderIcon({ children, active = false, className = "" }) {
  const palette = active
    ? "bg-gradient-to-br from-teal-500 to-cyan-700 text-white shadow-lg shadow-cyan-200/60"
    : "bg-slate-100 text-slate-700";

  return (
    <div className={`flex h-14 w-14 items-center justify-center rounded-3xl ${palette} ${className}`}>
      {children}
    </div>
  );
}

function BottomTab({ tab, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-2 rounded-3xl px-3 py-3 text-center transition ${
        active ? "bg-indigo-100 text-indigo-950" : "text-slate-500"
      }`}
    >
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xs font-black ${
          active ? "bg-indigo-900 text-white" : "bg-slate-100 text-slate-500"
        }`}
      >
        {tab.short}
      </div>
      <span className={`text-sm font-semibold ${active ? "text-indigo-950" : "text-slate-500"}`}>
        {tab.label}
      </span>
    </button>
  );
}

function SectionCard({ children, className = "" }) {
  return (
    <section className={`rounded-[2.15rem] bg-white p-6 shadow-[0_24px_50px_-28px_rgba(15,23,42,0.35)] ${className}`}>
      {children}
    </section>
  );
}

function InfoBadge({ children, tone = "green" }) {
  const tones = {
    green: "bg-emerald-100 text-emerald-900",
    blue: "bg-indigo-100 text-indigo-900",
    slate: "bg-slate-100 text-slate-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-900",
  };

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

function ActionButton({ children, onClick, disabled = false, tone = "green", className = "", type = "button" }) {
  const tones = {
    green: "bg-green-800 text-white hover:bg-green-700",
    blue: "bg-indigo-900 text-white hover:bg-indigo-800",
    light: "bg-white text-slate-900 hover:bg-slate-50",
    red: "bg-red-700 text-white hover:bg-red-600",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-[1.65rem] px-5 py-4 text-base font-black tracking-wide transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]} ${className}`}
    >
      {children}
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

    map.fitBounds(points, { padding: [32, 32] });
  }, [map, points]);

  return null;
}

function StopTimelineItem({ stop, index, status }) {
  const dotClass =
    status === "done"
      ? "border-emerald-600 bg-emerald-600"
      : status === "current"
        ? "border-indigo-900 bg-indigo-900"
        : "border-slate-300 bg-white";
  const textClass =
    status === "done"
      ? "text-emerald-700"
      : status === "current"
        ? "text-indigo-900"
        : "text-slate-500";

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={`h-4 w-4 rounded-full border-4 ${dotClass}`} />
        {status !== "last" ? <span className="mt-1 h-full min-h-[2.5rem] w-px bg-slate-200" /> : null}
      </div>
      <div className="pb-5">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Stop {index + 1}</div>
        <div className={`mt-1 text-lg font-black ${textClass}`}>{stop.stop?.name || "-"}</div>
      </div>
    </div>
  );
}

export default function DriverHome() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [autoShare, setAutoShare] = useState(false);
  const [latestLocation, setLatestLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [deviationMode, setDeviationMode] = useState(false);
  const [routeId, setRouteId] = useState("");
  const [busId, setBusId] = useState("");
  const [helperId, setHelperId] = useState("");
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [routeStops, setRouteStops] = useState([]);
  const [activeTab, setActiveTab] = useState("home");

  const activeTrip = dashboard?.active_trip ?? null;
  const schedules = dashboard?.schedules ?? [];
  const manualOptions = dashboard?.manual_start_options ?? { routes: [], buses: [], helpers: [] };
  const nextSchedule = schedules[0] ?? null;

  const routePolyline = useMemo(
    () =>
      routeStops
        .map((item) => [Number(item.stop?.lat), Number(item.stop?.lng)])
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)),
    [routeStops]
  );

  const liveBusPoint = useMemo(() => {
    if (!latestLocation) return null;
    const lat = Number(latestLocation.lat);
    const lng = Number(latestLocation.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
  }, [latestLocation]);

  const mapPoints = useMemo(() => {
    const all = [...routePolyline];
    if (liveBusPoint) all.push(liveBusPoint);
    return all;
  }, [routePolyline, liveBusPoint]);

  const stopProgressIndex = useMemo(() => {
    if (!liveBusPoint || routePolyline.length === 0) return -1;

    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    routePolyline.forEach((point, index) => {
      const distance = distanceBetween(point, liveBusPoint);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return bestIndex;
  }, [liveBusPoint, routePolyline]);

  const currentBus = useMemo(() => {
    if (activeTrip) return activeTrip.bus_plate;
    if (nextSchedule) return nextSchedule.bus_plate;
    return manualOptions.buses[0]?.plate_number || "Bus #1024";
  }, [activeTrip, nextSchedule, manualOptions]);

  const currentRoute = activeTrip?.route_name || nextSchedule?.route_name || "Pokhara-Lakeside";
  const helperName = activeTrip?.helper_name || nextSchedule?.helper_name || manualOptions.helpers[0]?.full_name || "Helper";
  const minutesToNext = minutesUntil(nextSchedule?.scheduled_start_time);
  const nextStop =
    routeStops[Math.min(stopProgressIndex + 1, routeStops.length - 1)]?.stop?.name ||
    routeStops[1]?.stop?.name ||
    routeStops[0]?.stop?.name ||
    "Prithvi Chowk";
  const previousStop =
    routeStops[Math.max(stopProgressIndex, 0)]?.stop?.name || routeStops[0]?.stop?.name || "Route start";
  const capacity = activeTrip
    ? Number(manualOptions.buses.find((bus) => bus.id === activeTrip.bus)?.capacity || 40)
    : Number(manualOptions.buses.find((bus) => String(bus.id) === busId)?.capacity || 40);
  const occupiedSeats = activeTrip ? Math.min(32, capacity) : Math.min(18, capacity);
  const occupancyPercent = capacity ? Math.round((occupiedSeats / capacity) * 100) : 0;
  const todaysEarnings = activeTrip ? 4500 : 1250;
  const completedTrips = activeTrip ? 8 : 7;
  const totalPassengers = activeTrip ? 124 : 42;
  const fuelLevel = activeTrip ? 84 : 76;
  const routeDuration = activeTrip ? 45 : 42;
  const predictedPassengers = activeTrip ? "3-5 passengers" : "2-4 passengers";
  const pickups = activeTrip ? 5 : 3;
  const drops = activeTrip ? 2 : 1;

  const loadDashboard = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const res = await api.get("/api/trips/driver/dashboard/");
      setDashboard(res.data);
      setLatestLocation(res.data.latest_location || null);
      setErr("");
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load driver dashboard.");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (activeTrip) {
      setActiveTab("active");
    }
  }, [activeTrip?.id]);

  useEffect(() => {
    if (!routeId && manualOptions.routes.length > 0) {
      setRouteId(String(manualOptions.routes[0].id));
    }
    if (!busId && manualOptions.buses.length > 0) {
      setBusId(String(manualOptions.buses[0].id));
    }
    if (!helperId && manualOptions.helpers.length > 0) {
      setHelperId(String(manualOptions.helpers[0].id));
    }
  }, [manualOptions, routeId, busId, helperId]);

  useEffect(() => {
    const loadTripDetail = async () => {
      if (!activeTrip?.id) {
        setRouteStops([]);
        return;
      }

      try {
        const res = await api.get(`/api/trips/${activeTrip.id}/`);
        setRouteStops(res.data.route_stops || []);
      } catch {
        setRouteStops([]);
      }
    };

    loadTripDetail();
  }, [activeTrip?.id]);

  const runAction = async (action, successMessage) => {
    setBusy(true);
    setErr("");
    setMsg("");

    try {
      await action();
      setMsg(successMessage);
      await loadDashboard({ silent: true });
    } catch (e) {
      setErr(e?.response?.data?.detail || "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const startScheduledTrip = async (scheduleId) => {
    await runAction(
      () => api.post("/api/trips/start/", { schedule_id: scheduleId, deviation_mode: deviationMode }),
      "Trip started successfully."
    );
    setActiveTab("active");
  };

  const startManualTrip = async () => {
    if (!(routeId && busId && helperId)) {
      setErr("Select route, bus, and helper first.");
      return;
    }

    await runAction(
      () =>
        api.post("/api/trips/start/", {
          route_id: Number(routeId),
          bus_id: Number(busId),
          helper_id: Number(helperId),
          deviation_mode: deviationMode,
        }),
      "Manual trip started successfully."
    );
    setActiveTab("active");
  };

  const endTrip = async () => {
    if (!activeTrip) return;

    await runAction(() => api.post(`/api/trips/${activeTrip.id}/end/`), "Trip ended successfully.");
    setAutoShare(false);
    setLocationStatus("");
    setRouteStops([]);
    setActiveTab("history");
  };

  const postLocation = async (payload, successLabel = "Location sent.") => {
    if (!activeTrip) {
      setErr("Start a trip before sending location.");
      return;
    }

    setLocationBusy(true);
    setErr("");

    try {
      const res = await api.post(`/api/trips/${activeTrip.id}/location/`, payload);
      setLatestLocation(res.data);
      setLocationStatus(successLabel);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to send location.");
    } finally {
      setLocationBusy(false);
    }
  };
  const sendBrowserLocation = async () => {
    if (!navigator.geolocation) {
      setErr("Geolocation is not supported in this browser.");
      setAutoShare(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, speed, heading } = position.coords;
        await postLocation(
          {
            lat: latitude,
            lng: longitude,
            speed: Number.isFinite(speed) ? speed : null,
            heading: Number.isFinite(heading) ? heading : null,
          },
          "Live location updated."
        );
      },
      (geoError) => {
        setErr(geoError.message || "Unable to fetch current location.");
        setAutoShare(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );
  };

  useEffect(() => {
    if (!autoShare || !activeTrip) return;

    sendBrowserLocation();
    const intervalId = window.setInterval(() => {
      sendBrowserLocation();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoShare, activeTrip?.id]);

  const sendManualLocation = async () => {
    const lat = Number(manualLat);
    const lng = Number(manualLng);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setErr("Enter valid latitude and longitude.");
      return;
    }

    await postLocation({ lat, lng, speed: null, heading: null }, "Manual location updated.");
  };

  const handleLogout = () => {
    clearToken();
    navigate("/auth/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f7fb] px-4 py-8 text-slate-900">
        <div className="mx-auto max-w-md rounded-[2.2rem] bg-white p-8 text-center shadow-lg">
          Loading driver dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f7fbff_0%,#eef3fb_45%,#f5f7fb_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-5">
        <header className="rounded-[2rem] bg-white px-4 py-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <HeaderIcon active>
                <span className="text-lg font-black">DR</span>
              </HeaderIcon>
              <div>
                <div className="text-[1.9rem] font-black leading-none text-slate-950">{currentBus} • Active</div>
                <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-green-700">
                  <span className="h-3 w-3 rounded-full bg-green-700" />
                  <span>ON DUTY</span>
                  <span className="text-slate-400">•</span>
                  <span>{helperName}</span>
                </div>
                <div className="mt-1 text-sm text-slate-500">{user?.full_name || "Driver"} • {currentRoute}</div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => loadDashboard()} className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">
                Refresh
              </button>
              <button type="button" onClick={handleLogout} className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-bold text-white">
                Logout
              </button>
            </div>
          </div>
        </header>

        {err ? (
          <div className="mt-4 rounded-[1.75rem] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {err}
          </div>
        ) : null}

        {msg ? (
          <div className="mt-4 rounded-[1.75rem] border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            {msg}
          </div>
        ) : null}

        <div className="mt-5 flex-1 space-y-5">
          {activeTab === "home" ? (
            <>
              <SectionCard className="overflow-hidden bg-gradient-to-br from-[#0f2f84] via-[#13388f] to-[#0b2a77] text-white">
                <div className="text-sm font-semibold uppercase tracking-[0.28em] text-indigo-100/80">Upcoming Schedule</div>
                <div className="mt-5 text-5xl font-black leading-[1.02] tracking-tight">
                  {nextSchedule?.route_name || activeTrip?.route_name || "Pokhara-Lakeside"}
                </div>
                <div className="mt-4 flex items-center gap-2 text-lg text-indigo-100/90">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-black">CL</span>
                  <span>
                    {minutesToNext !== null
                      ? minutesToNext > 0
                        ? `Departs in ${minutesToNext} mins`
                        : "Ready to depart"
                      : "Manual trip ready"}
                  </span>
                  <span>•</span>
                  <span>{nextSchedule ? `Route ${nextSchedule.id}` : "Driver route"}</span>
                </div>

                <div className="mt-8 space-y-3">
                  <ActionButton
                    onClick={() => (nextSchedule ? startScheduledTrip(nextSchedule.id) : startManualTrip())}
                    disabled={busy}
                    tone="green"
                    className="w-full bg-[#2d7f2d] py-5 text-2xl"
                  >
                    {busy ? "STARTING..." : nextSchedule ? "START NEXT TRIP" : "START MANUAL TRIP"}
                  </ActionButton>
                  <div className="flex items-center justify-between rounded-[1.5rem] bg-white/10 px-4 py-3 text-sm text-indigo-50">
                    <span>{deviationMode ? "Deviation mode enabled" : "Normal route mode"}</span>
                    <button
                      type="button"
                      onClick={() => setDeviationMode((value) => !value)}
                      className="rounded-full bg-white/20 px-3 py-1 font-semibold"
                    >
                      Toggle
                    </button>
                  </div>
                </div>
              </SectionCard>

              <SectionCard>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Trip Setup</div>
                    <div className="mt-2 text-3xl font-black text-slate-950">Manual start workspace</div>
                  </div>
                  <InfoBadge tone="blue">Route • Bus • Helper</InfoBadge>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Route</label>
                    <select
                      value={routeId}
                      onChange={(e) => setRouteId(e.target.value)}
                      className="w-full rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none"
                    >
                      {manualOptions.routes.map((route) => (
                        <option key={route.id} value={route.id}>
                          {route.name} ({route.city})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Bus</label>
                      <select
                        value={busId}
                        onChange={(e) => setBusId(e.target.value)}
                        className="w-full rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none"
                      >
                        {manualOptions.buses.map((bus) => (
                          <option key={bus.id} value={bus.id}>
                            {bus.plate_number} ({bus.capacity})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Helper</label>
                      <select
                        value={helperId}
                        onChange={(e) => setHelperId(e.target.value)}
                        className="w-full rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none"
                      >
                        {manualOptions.helpers.map((helper) => (
                          <option key={helper.id} value={helper.id}>
                            {helper.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div className="rounded-[1.5rem] bg-slate-50 px-5 py-5">
                    <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Planned trips</div>
                    <div className="mt-4 text-5xl font-black text-slate-950">{schedules.length}</div>
                  </div>
                  <div className="rounded-[1.5rem] bg-slate-50 px-5 py-5">
                    <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Live status</div>
                    <div className="mt-4 text-2xl font-black text-slate-950">{activeTrip ? "ACTIVE" : "STANDBY"}</div>
                  </div>
                </div>
              </SectionCard>
              <div className="flex items-center justify-between px-2">
                <h2 className="text-[2.1rem] font-black tracking-tight text-slate-950">Today's Performance</h2>
                <button type="button" className="text-lg font-black uppercase tracking-wide text-indigo-900" onClick={() => setActiveTab("earnings")}>
                  View Report
                </button>
              </div>

              <SectionCard>
                <div className="flex items-center justify-between gap-5">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Total Earnings</div>
                    <div className="mt-3 text-[4rem] font-black leading-none text-indigo-950">NPR {todaysEarnings.toLocaleString()}</div>
                    <div className="mt-2 text-sm text-slate-500">Driver analytics are still using local demo metrics for now.</div>
                  </div>
                  <div className="flex h-24 w-24 items-center justify-center rounded-[1.75rem] bg-green-200/80 text-3xl font-black text-green-900">NR</div>
                </div>
              </SectionCard>

              <div className="grid grid-cols-2 gap-4">
                <SectionCard className="bg-slate-50/90">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[1.3rem] bg-indigo-100 text-lg font-black text-indigo-950">BS</div>
                  <div className="mt-10 text-6xl font-black leading-none text-slate-950">{completedTrips}</div>
                  <div className="mt-2 text-base font-semibold uppercase tracking-[0.24em] text-slate-600">Completed Trips</div>
                </SectionCard>
                <SectionCard className="bg-slate-100/95">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[1.3rem] bg-slate-200 text-lg font-black text-slate-800">PX</div>
                  <div className="mt-10 text-6xl font-black leading-none text-slate-950">{totalPassengers}</div>
                  <div className="mt-2 text-base font-semibold uppercase tracking-[0.24em] text-slate-600">Total Passengers</div>
                </SectionCard>
              </div>

              <SectionCard>
                <div className="flex gap-4">
                  <div className="relative flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-[1.6rem] bg-[linear-gradient(145deg,#f2f5eb,#c9d5c3)] text-3xl font-black text-slate-700">
                    BUS
                    <span className="absolute right-3 top-3 h-5 w-5 rounded-full border-4 border-white bg-green-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <InfoBadge tone="green">Vehicle Healthy</InfoBadge>
                      <span className="text-sm font-medium text-slate-500">Last checked 2h ago</span>
                    </div>
                    <div className="mt-4 text-2xl font-black text-slate-950">Fuel Level: {fuelLevel}%</div>
                    <div className="mt-4 h-3 rounded-full bg-green-100">
                      <div className="h-3 rounded-full bg-green-700" style={{ width: `${fuelLevel}%` }} />
                    </div>
                    <div className="mt-4 flex gap-3">
                      <ActionButton onClick={() => setActiveTab("active")} tone="blue" className="flex-1 py-3 text-sm">
                        OPEN ACTIVE TRIP
                      </ActionButton>
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard>
                <div className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Upcoming Runs</div>
                <div className="mt-4 space-y-3">
                  {schedules.length === 0 ? (
                    <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4 text-sm text-slate-500">No planned schedules yet. Use manual start when needed.</div>
                  ) : (
                    schedules.slice(0, 3).map((schedule) => (
                      <div key={schedule.id} className="rounded-[1.5rem] bg-slate-50 px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-lg font-black text-slate-950">{schedule.route_name}</div>
                            <div className="mt-1 text-sm text-slate-500">{schedule.bus_plate} • {formatDateTime(schedule.scheduled_start_time)}</div>
                          </div>
                          <ActionButton
                            onClick={() => startScheduledTrip(schedule.id)}
                            disabled={busy || Boolean(activeTrip)}
                            tone="green"
                            className="py-3 text-sm"
                          >
                            START
                          </ActionButton>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>
            </>
          ) : null}

          {activeTab === "active" ? (
            <>
              <SectionCard className="bg-[radial-gradient(circle_at_top_left,#f3fbff_0%,#ffffff_44%,#edf6ff_100%)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Next Stop</div>
                    <div className="mt-3 text-6xl font-black leading-[0.92] tracking-tight text-indigo-950">{nextStop}</div>
                    <div className="mt-3 text-sm text-slate-500">Previous waypoint: {previousStop}</div>
                  </div>
                  <div className="rounded-[1.6rem] bg-green-200 px-5 py-4 text-center text-green-950">
                    <div className="text-5xl font-black leading-none">4</div>
                    <div className="mt-1 text-lg font-semibold uppercase tracking-[0.2em]">Min</div>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="rounded-[1.75rem] bg-slate-50 px-5 py-5">
                    <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Pickups</div>
                    <div className="mt-4 text-5xl font-black text-slate-950">{pickups}</div>
                  </div>
                  <div className="rounded-[1.75rem] bg-slate-50 px-5 py-5">
                    <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Drops</div>
                    <div className="mt-4 text-5xl font-black text-slate-950">{drops}</div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard className="overflow-hidden">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Route Map</div>
                    <div className="mt-1 text-2xl font-black text-slate-950">Live route tracking</div>
                  </div>
                  {liveBusPoint ? <InfoBadge tone="green">Bus live</InfoBadge> : <InfoBadge tone="slate">No GPS yet</InfoBadge>}
                </div>

                <div className="mt-4 overflow-hidden rounded-[1.6rem] border border-slate-200">
                  <div className="h-72 w-full bg-slate-100">
                    <MapContainer center={[28.2096, 83.9856]} zoom={13} scrollWheelZoom={false} className="h-full w-full">
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <MapViewport points={mapPoints} />
                      {routePolyline.length > 0 ? (
                        <Polyline positions={routePolyline} pathOptions={{ color: "#1d4ed8", weight: 5 }} />
                      ) : null}

                      {routeStops.map((item, index) => {
                        const lat = Number(item.stop?.lat);
                        const lng = Number(item.stop?.lng);
                        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

                        const isCurrent = index === Math.max(stopProgressIndex, 0) && liveBusPoint;

                        return (
                          <CircleMarker
                            key={`${item.stop_order}-${item.stop?.name}`}
                            center={[lat, lng]}
                            radius={isCurrent ? 8 : 6}
                            pathOptions={{
                              color: isCurrent ? "#1e3a8a" : "#0f766e",
                              fillColor: isCurrent ? "#1d4ed8" : "#2dd4bf",
                              fillOpacity: 0.95,
                            }}
                          >
                            <Popup>
                              Stop {item.stop_order}: {item.stop?.name}
                            </Popup>
                          </CircleMarker>
                        );
                      })}

                      {liveBusPoint ? (
                        <CircleMarker
                          center={liveBusPoint}
                          radius={10}
                          pathOptions={{ color: "#991b1b", fillColor: "#ef4444", fillOpacity: 1 }}
                        >
                          <Popup>Live bus position</Popup>
                        </CircleMarker>
                      ) : null}
                    </MapContainer>
                  </div>
                </div>
              </SectionCard>

              <SectionCard className="bg-gradient-to-br from-[#0f2f84] via-[#13388f] to-[#0b2a77] text-white">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[1.3rem] bg-green-200 text-lg font-black text-green-950">AI</div>
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.28em] text-indigo-100/80">AI Predictor</div>
                    <div className="mt-3 text-3xl font-black leading-snug text-white">
                      High Prospect: <span className="text-green-200">{predictedPassengers}</span> likely at next stop
                    </div>
                  </div>
                </div>
                <div className="mt-6 rounded-[1.7rem] bg-[#0d2a72] px-5 py-5 text-lg text-indigo-100">
                  Based on active route context near {nextStop}. This is still a demo placeholder until the prediction module is added.
                </div>
              </SectionCard>
              <div className="grid grid-cols-[1.1fr_0.9fr] gap-4">
                <SectionCard>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Route Status</div>
                      <div className="mt-4 flex items-center gap-3 text-4xl font-black text-slate-950">
                        <span className="h-4 w-4 rounded-full bg-green-700" />
                        ON TIME
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Occupancy</div>
                      <div className="mt-4 text-4xl font-black text-slate-950">{occupancyPercent}%</div>
                      <div className="mt-2 text-lg text-slate-500">({occupiedSeats}/{capacity})</div>
                    </div>
                  </div>
                </SectionCard>
                <div className="flex items-end">
                  <ActionButton tone="red" className="w-full rounded-[1.9rem] py-5 text-2xl">
                    SOS
                  </ActionButton>
                </div>
              </div>

              <SectionCard className="bg-gradient-to-br from-[#0f2f84] via-[#1746af] to-[#13388f] text-white">
                <div className="text-sm font-semibold uppercase tracking-[0.28em] text-indigo-100/80">Current Occupancy</div>
                <div className="mt-4 text-[5rem] font-black leading-none">{occupiedSeats}/{capacity}</div>
                <div className="mt-6 flex items-center gap-4">
                  <div className="h-5 flex-1 overflow-hidden rounded-full bg-white/20">
                    <div className="h-5 rounded-full bg-green-200" style={{ width: `${occupancyPercent}%` }} />
                  </div>
                  <div className="text-2xl font-black">{occupancyPercent}%</div>
                </div>
              </SectionCard>

              <SectionCard>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Live GPS</div>
                    <div className="mt-2 text-xl font-black text-slate-950">
                      {latestLocation ? `${latestLocation.lat}, ${latestLocation.lng}` : "No location yet"}
                    </div>
                    <div className="mt-2 text-sm text-slate-500">
                      {latestLocation ? `Updated ${formatDateTime(latestLocation.recorded_at)}` : "Waiting for driver update"}
                    </div>
                  </div>
                  {locationStatus ? <InfoBadge tone="blue">{locationStatus}</InfoBadge> : null}
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <ActionButton onClick={() => setAutoShare((value) => !value)} disabled={locationBusy} tone="green" className="py-4 text-sm">
                    {autoShare ? "STOP AUTO GPS" : "START AUTO GPS"}
                  </ActionButton>
                  <ActionButton onClick={sendBrowserLocation} disabled={locationBusy} tone="blue" className="py-4 text-sm">
                    {locationBusy ? "SENDING..." : "SEND CURRENT LOCATION"}
                  </ActionButton>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <input
                    className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none"
                    placeholder="Latitude"
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                  />
                  <input
                    className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none"
                    placeholder="Longitude"
                    value={manualLng}
                    onChange={(e) => setManualLng(e.target.value)}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <ActionButton onClick={sendManualLocation} disabled={locationBusy} tone="light" className="border border-slate-200 py-4 text-sm text-slate-900">
                    SEND MANUAL COORDINATES
                  </ActionButton>
                  <ActionButton onClick={endTrip} disabled={busy} tone="red" className="py-4 text-sm">
                    {busy ? "ENDING..." : "END TRIP"}
                  </ActionButton>
                </div>
              </SectionCard>

              <SectionCard>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Stop Timeline</div>
                    <div className="mt-1 text-2xl font-black text-slate-950">Route progression</div>
                  </div>
                  <InfoBadge tone="amber">{routeStops.length} stops</InfoBadge>
                </div>
                <div className="mt-6">
                  {routeStops.length === 0 ? (
                    <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4 text-sm text-slate-500">No route stops loaded yet. Start a trip to see progression.</div>
                  ) : (
                    routeStops.map((stop, index) => {
                      const status =
                        stopProgressIndex === -1
                          ? "upcoming"
                          : index < stopProgressIndex
                            ? "done"
                            : index === stopProgressIndex
                              ? "current"
                              : "upcoming";
                      return (
                        <StopTimelineItem
                          key={`${stop.stop_order}-${stop.stop?.name}`}
                          stop={stop}
                          index={index}
                          status={index === routeStops.length - 1 && status === "upcoming" ? "last" : status}
                        />
                      );
                    })
                  )}
                </div>
              </SectionCard>
            </>
          ) : null}

          {activeTab === "history" ? (
            <>
              <SectionCard className="bg-gradient-to-br from-[#0f2f84] via-[#13388f] to-[#0b2a77] text-white">
                <div className="text-sm font-semibold uppercase tracking-[0.28em] text-indigo-100/80">Trip Completed Successfully</div>
                <div className="mt-4 text-[5rem] font-black leading-none">NPR 1,250</div>
                <div className="mt-3 text-2xl text-indigo-100">Total earnings from the last completed shift</div>
              </SectionCard>

              <div className="grid grid-cols-2 gap-4">
                <SectionCard>
                  <div className="text-sm font-semibold uppercase tracking-[0.24em] text-green-700">Capacity OK</div>
                  <div className="mt-5 text-6xl font-black text-slate-950">42</div>
                  <div className="mt-2 text-xl text-slate-600">Total Passengers</div>
                </SectionCard>
                <SectionCard>
                  <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Route Duration</div>
                  <div className="mt-5 text-6xl font-black text-slate-950">{routeDuration}</div>
                  <div className="mt-2 text-xl text-slate-600">mins</div>
                </SectionCard>
              </div>

              <SectionCard className="bg-slate-100/90">
                <div className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Efficiency Metrics</div>
                <div className="mt-8 space-y-7 text-2xl font-semibold text-slate-900">
                  <div className="flex items-center justify-between gap-3">
                    <span>Fuel Efficiency</span>
                    <span className="font-black">12.4 km/L</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>On-Time Performance</span>
                    <InfoBadge tone="green">98%</InfoBadge>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Last route completed</span>
                    <span className="font-black">{formatTimeOnly(activeTrip?.ended_at || nextSchedule?.scheduled_start_time)}</span>
                  </div>
                </div>
              </SectionCard>

              <ActionButton tone="green" className="w-full py-6 text-3xl">
                SHIFT COMPLETE
              </ActionButton>
            </>
          ) : null}

          {activeTab === "earnings" ? (
            <>
              <SectionCard className="bg-gradient-to-br from-[#0f2f84] via-[#13388f] to-[#0b2a77] text-white">
                <div className="text-sm font-semibold uppercase tracking-[0.28em] text-indigo-100/80">Today's Earnings</div>
                <div className="mt-4 text-[5rem] font-black leading-none">NPR {todaysEarnings.toLocaleString()}</div>
                <div className="mt-3 text-xl text-indigo-100">Driver earnings analytics are currently shown as demo placeholders.</div>
              </SectionCard>

              <div className="grid grid-cols-2 gap-4">
                <SectionCard>
                  <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Completed Trips</div>
                  <div className="mt-6 text-6xl font-black text-slate-950">{completedTrips}</div>
                </SectionCard>
                <SectionCard>
                  <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Passengers</div>
                  <div className="mt-6 text-6xl font-black text-slate-950">{totalPassengers}</div>
                </SectionCard>
              </div>

              <SectionCard className="bg-slate-100/90">
                <div className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Breakdown</div>
                <div className="mt-6 space-y-5 text-xl text-slate-900">
                  <div className="flex items-center justify-between gap-3">
                    <span>App bookings</span>
                    <span className="font-black">NPR 2,800</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Cash collections</span>
                    <span className="font-black">NPR 1,700</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Manual entries</span>
                    <span className="font-black">8 pax</span>
                  </div>
                </div>
              </SectionCard>

              <SectionCard>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Vehicle Health</div>
                    <div className="mt-3 text-3xl font-black text-slate-950">Fuel Level {fuelLevel}%</div>
                  </div>
                  <InfoBadge tone="green">GOOD</InfoBadge>
                </div>
                <div className="mt-5 h-4 rounded-full bg-green-100">
                  <div className="h-4 rounded-full bg-green-700" style={{ width: `${fuelLevel}%` }} />
                </div>
              </SectionCard>
            </>
          ) : null}
        </div>

        <div className="pointer-events-none fixed bottom-28 left-1/2 z-20 w-full max-w-md -translate-x-1/2 px-5">
          <div className="flex justify-end">
            <ActionButton tone="red" className="pointer-events-auto min-w-[9rem] rounded-[1.9rem] py-5 text-2xl shadow-[0_22px_36px_-20px_rgba(185,28,28,0.7)]">
              SOS
            </ActionButton>
          </div>
        </div>

        <nav className="sticky bottom-0 mt-6 rounded-[2rem] bg-white/95 p-3 shadow-[0_-18px_40px_-28px_rgba(15,23,42,0.28)] backdrop-blur">
          <div className="flex gap-2">
            {TABS.map((tab) => (
              <BottomTab key={tab.id} tab={tab} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} />
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
