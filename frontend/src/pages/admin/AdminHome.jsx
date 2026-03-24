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

function MetricCard({ label, value, subtext, tone = "slate" }) {
  const accents = {
    slate: "from-slate-50 to-white text-slate-950",
    blue: "from-blue-50 to-white text-blue-950",
    green: "from-emerald-50 to-white text-emerald-950",
    amber: "from-amber-50 to-white text-amber-950",
  };

  return (
    <div className={`rounded-[1.7rem] bg-gradient-to-br p-5 ${accents[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">{label}</div>
      <div className="mt-3 text-4xl font-black leading-none">{value}</div>
      {subtext ? <div className="mt-3 text-sm text-slate-500">{subtext}</div> : null}
    </div>
  );
}

function SectionTitle({ eyebrow, title, action }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">{eyebrow}</div> : null}
        <div className="mt-1 text-2xl font-black text-slate-950">{title}</div>
      </div>
      {action}
    </div>
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

export default function AdminHome() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [builderStops, setBuilderStops] = useState([]);
  const [recentRoutes, setRecentRoutes] = useState([]);
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeMsg, setRouteMsg] = useState("");
  const [routeName, setRouteName] = useState("");
  const [routeCity, setRouteCity] = useState("Pokhara");
  const [routeActive, setRouteActive] = useState(true);
  const [selectedStopIds, setSelectedStopIds] = useState([]);
  const [segmentFares, setSegmentFares] = useState([]);

  const loadDashboard = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const res = await api.get("/api/auth/admin/dashboard/");
      setDashboard(res.data);
      setErr("");
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load admin dashboard.");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const loadRouteBuilder = async () => {
    try {
      const res = await api.get("/api/transport/admin/route-builder/");
      setBuilderStops(res.data.stops || []);
      setRecentRoutes(res.data.recent_routes || []);
    } catch (e) {
      setErr((prev) => prev || e?.response?.data?.detail || "Failed to load route builder data.");
    }
  };

  useEffect(() => {
    loadDashboard();
    loadRouteBuilder();
    const intervalId = window.setInterval(() => {
      loadDashboard({ silent: true });
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    setSegmentFares((current) => {
      const requiredLength = Math.max(selectedStopIds.length - 1, 0);
      return Array.from({ length: requiredLength }, (_, index) => current[index] || "");
    });
  }, [selectedStopIds]);

  const handleLogout = () => {
    clearToken();
    navigate("/auth/login");
  };

  const overview = dashboard?.overview;
  const roleCounts = overview?.role_counts || {};
  const transport = overview?.transport || {};
  const trips = overview?.trips || {};
  const bookings = overview?.bookings || {};
  const payments = overview?.payments || {};
  const methods = payments?.methods || {};

  const paymentMethodRows = useMemo(
    () =>
      Object.entries(methods).map(([method, stats]) => ({
        method,
        total: stats.total || 0,
        success: stats.success || 0,
        successRate: stats.total ? Math.round((stats.success / stats.total) * 100) : 0,
      })),
    [methods]
  );

  const selectedStops = useMemo(
    () => selectedStopIds.map((id) => builderStops.find((stop) => stop.id === id)).filter(Boolean),
    [builderStops, selectedStopIds]
  );

  const selectedRoutePoints = useMemo(
    () =>
      selectedStops
        .map((stop) => [Number(stop.lat), Number(stop.lng)])
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)),
    [selectedStops]
  );

  const mapPoints = useMemo(() => {
    if (selectedRoutePoints.length > 0) return selectedRoutePoints;
    const allStops = builderStops
      .map((stop) => [Number(stop.lat), Number(stop.lng)])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    return allStops.slice(0, 12);
  }, [builderStops, selectedRoutePoints]);

  const toggleStopSelection = (stopId) => {
    setSelectedStopIds((current) =>
      current.includes(stopId) ? current.filter((item) => item !== stopId) : [...current, stopId]
    );
  };

  const moveStop = (index, direction) => {
    setSelectedStopIds((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const clearRouteBuilder = () => {
    setRouteName("");
    setRouteCity("Pokhara");
    setRouteActive(true);
    setSelectedStopIds([]);
    setSegmentFares([]);
    setRouteMsg("");
  };

  const createRoute = async () => {
    if (!routeName.trim()) {
      setErr("Enter a route name before creating the route.");
      return;
    }
    if (selectedStopIds.length < 2) {
      setErr("Select at least two stops on the map to create a route.");
      return;
    }
    if (segmentFares.some((fare) => fare === "" || Number(fare) < 0)) {
      setErr("Fill every segment fare with a valid amount.");
      return;
    }

    setRouteBusy(true);
    setErr("");
    setRouteMsg("");

    try {
      const res = await api.post("/api/transport/admin/route-builder/", {
        name: routeName.trim(),
        city: routeCity.trim() || "Pokhara",
        is_active: routeActive,
        stop_ids: selectedStopIds,
        segment_fares: segmentFares.map((fare) => Number(fare)),
      });

      setRouteMsg(res.data.message || "Route created successfully.");
      clearRouteBuilder();
      await Promise.all([loadDashboard({ silent: true }), loadRouteBuilder()]);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to create route.");
    } finally {
      setRouteBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eff8ff_0%,#f7fbff_38%,#f8fafc_100%)] px-4 py-8 text-slate-900">
        <div className="mx-auto max-w-7xl rounded-[2rem] bg-white p-8 shadow-lg">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eff8ff_0%,#f7fbff_38%,#f8fafc_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <header className="rounded-[2rem] bg-white px-5 py-5 shadow-[0_24px_48px_-30px_rgba(15,23,42,0.35)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-blue-700 to-slate-900 text-lg font-black text-white">
                AD
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">MetroBus Control</div>
                <div className="mt-1 text-3xl font-black text-slate-950">Admin Dashboard</div>
                <div className="mt-2 max-w-3xl text-sm text-slate-500">
                  Monitor users, transport inventory, live operations, bookings, payments, and system activity from one control center.
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusPill tone="blue">{user?.full_name || "Admin"}</StatusPill>
                  <StatusPill tone="green">{trips.live || 0} live trips</StatusPill>
                  <StatusPill tone="amber">{payments.pending || 0} pending payments</StatusPill>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  loadDashboard();
                  loadRouteBuilder();
                }}
                className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"
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

        {routeMsg ? (
          <div className="mt-4 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {routeMsg}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Users"
            value={overview?.users_total ?? 0}
            subtext={`Passengers ${roleCounts.PASSENGER || 0} • Drivers ${roleCounts.DRIVER || 0}`}
            tone="blue"
          />
          <MetricCard
            label="Live Trips"
            value={trips.live ?? 0}
            subtext={`Total ${trips.total || 0} • Ended ${trips.ended || 0}`}
            tone="green"
          />
          <MetricCard
            label="Bookings"
            value={bookings.total ?? 0}
            subtext={`Confirmed ${bookings.confirmed || 0} • Cancelled ${bookings.cancelled || 0}`}
            tone="amber"
          />
          <MetricCard
            label="Revenue"
            value={formatMoney(payments.revenue_success ?? 0)}
            subtext={`Successful payments ${payments.success || 0}`}
            tone="slate"
          />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <ShellCard>
            <SectionTitle
              eyebrow="Transport Builder"
              title="Create route from the map"
              action={<StatusPill tone="blue">{selectedStopIds.length} selected stops</StatusPill>}
            />

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-4">
                <div className="grid gap-3">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Route name</label>
                    <input
                      type="text"
                      value={routeName}
                      onChange={(e) => setRouteName(e.target.value)}
                      placeholder="Lakeside to Prithvi Chowk"
                      className="w-full rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">City</label>
                      <input
                        type="text"
                        value={routeCity}
                        onChange={(e) => setRouteCity(e.target.value)}
                        className="w-full rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Active</label>
                      <button
                        type="button"
                        onClick={() => setRouteActive((value) => !value)}
                        className={`w-full rounded-[1.35rem] px-4 py-3 text-sm font-bold ${routeActive ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}
                      >
                        {routeActive ? "YES" : "NO"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.5rem] bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-black text-slate-950">Selected stop order</div>
                    <button type="button" onClick={clearRouteBuilder} className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Clear
                    </button>
                  </div>
                  <div className="mt-3 space-y-3">
                    {selectedStops.length ? (
                      selectedStops.map((stop, index) => (
                        <div key={stop.id} className="rounded-[1.2rem] bg-white p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Stop {index + 1}</div>
                              <div className="mt-1 text-sm font-black text-slate-950">{stop.name}</div>
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => moveStop(index, -1)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">Up</button>
                              <button type="button" onClick={() => moveStop(index, 1)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">Down</button>
                              <button type="button" onClick={() => toggleStopSelection(stop.id)} className="rounded-xl bg-red-100 px-3 py-2 text-xs font-bold text-red-700">Remove</button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[1.2rem] bg-white px-3 py-3 text-sm text-slate-500">Click map markers to choose the route in order.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-[1.5rem] bg-slate-50 p-4">
                  <div className="text-sm font-black text-slate-950">Segment fares</div>
                  <div className="mt-3 space-y-3">
                    {selectedStops.length >= 2 ? (
                      selectedStops.slice(0, -1).map((stop, index) => (
                        <div key={`${stop.id}-${selectedStops[index + 1].id}`} className="rounded-[1.2rem] bg-white p-3">
                          <div className="text-sm font-semibold text-slate-700">
                            {stop.name} to {selectedStops[index + 1].name}
                          </div>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={segmentFares[index] || ""}
                            onChange={(e) => {
                              const next = [...segmentFares];
                              next[index] = e.target.value;
                              setSegmentFares(next);
                            }}
                            placeholder="Enter fare"
                            className="mt-2 w-full rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium outline-none"
                          />
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[1.2rem] bg-white px-3 py-3 text-sm text-slate-500">Add at least two stops to configure fares.</div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={createRoute}
                  disabled={routeBusy}
                  className="w-full rounded-[1.5rem] bg-slate-950 px-4 py-4 text-base font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {routeBusy ? "Creating route..." : "Create route"}
                </button>
              </div>

              <div className="space-y-4">
                <div className="overflow-hidden rounded-[1.6rem] border border-slate-200">
                  <div className="h-[26rem] w-full bg-slate-100">
                    <MapContainer center={[28.2096, 83.9856]} zoom={12} scrollWheelZoom={false} className="h-full w-full">
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <MapViewport points={mapPoints} />
                      {selectedRoutePoints.length > 1 ? (
                        <Polyline positions={selectedRoutePoints} pathOptions={{ color: "#0f172a", weight: 5 }} />
                      ) : null}
                      {builderStops.map((stop) => {
                        const lat = Number(stop.lat);
                        const lng = Number(stop.lng);
                        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                        const orderIndex = selectedStopIds.indexOf(stop.id);
                        const selected = orderIndex !== -1;

                        return (
                          <CircleMarker
                            key={stop.id}
                            center={[lat, lng]}
                            radius={selected ? 9 : 7}
                            eventHandlers={{ click: () => toggleStopSelection(stop.id) }}
                            pathOptions={{
                              color: selected ? "#0f172a" : "#0f766e",
                              fillColor: selected ? "#1d4ed8" : "#2dd4bf",
                              fillOpacity: 0.95,
                            }}
                          >
                            <Popup>
                              <div className="text-sm font-semibold">{stop.name}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                {selected ? `Selected as stop ${orderIndex + 1}` : "Click to add to route"}
                              </div>
                            </Popup>
                          </CircleMarker>
                        );
                      })}
                    </MapContainer>
                  </div>
                </div>

                <div className="rounded-[1.5rem] bg-slate-50 p-4">
                  <div className="text-sm font-black text-slate-950">Recent routes</div>
                  <div className="mt-3 space-y-3">
                    {recentRoutes.length ? (
                      recentRoutes.map((route) => (
                        <div key={route.id} className="rounded-[1.2rem] bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-black text-slate-950">{route.name}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                {route.city} • {route.stops_count} stops
                              </div>
                            </div>
                            <StatusPill tone={route.is_active ? "green" : "slate"}>{route.is_active ? "ACTIVE" : "INACTIVE"}</StatusPill>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[1.2rem] bg-white px-3 py-3 text-sm text-slate-500">No recent routes yet.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </ShellCard>

          <ShellCard>
            <SectionTitle eyebrow="Payments" title="Method performance" />
            <div className="mt-5 space-y-3">
              {paymentMethodRows.map((item) => (
                <div key={item.method} className="rounded-[1.5rem] bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-black text-slate-950">{item.method}</div>
                    <StatusPill tone={item.successRate >= 70 ? "green" : item.successRate > 0 ? "amber" : "slate"}>
                      {item.successRate}% success
                    </StatusPill>
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    Total {item.total} • Success {item.success}
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-200">
                    <div className="h-2 rounded-full bg-slate-900" style={{ width: `${item.successRate}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-[1.4rem] bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Success</div>
                <div className="mt-2 text-2xl font-black text-slate-950">{payments.success || 0}</div>
              </div>
              <div className="rounded-[1.4rem] bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Pending</div>
                <div className="mt-2 text-2xl font-black text-slate-950">{payments.pending || 0}</div>
              </div>
              <div className="rounded-[1.4rem] bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Failed</div>
                <div className="mt-2 text-2xl font-black text-slate-950">{payments.failed || 0}</div>
              </div>
            </div>
          </ShellCard>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <ShellCard>
            <SectionTitle
              eyebrow="Live Operations"
              title="Active trips"
              action={<StatusPill tone={dashboard?.live_trips?.length ? "green" : "slate"}>{dashboard?.live_trips?.length || 0} live</StatusPill>}
            />

            <div className="mt-5 space-y-3">
              {dashboard?.live_trips?.length ? (
                dashboard.live_trips.map((trip) => (
                  <div key={trip.id} className="rounded-[1.6rem] border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-black text-slate-950">{trip.route_name}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          Bus {trip.bus_plate} • Driver {trip.driver_name} • Helper {trip.helper_name}
                        </div>
                      </div>
                      <StatusPill tone={trip.deviation_mode ? "amber" : "green"}>
                        {trip.deviation_mode ? "Deviation" : "Normal"}
                      </StatusPill>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-[1.2rem] bg-slate-50 px-3 py-3 text-sm text-slate-600">
                        Started {formatDateTime(trip.started_at)}
                      </div>
                      <div className="rounded-[1.2rem] bg-slate-50 px-3 py-3 text-sm text-slate-600">
                        {trip.latest_location
                          ? `GPS ${trip.latest_location.lat}, ${trip.latest_location.lng}`
                          : "No GPS update yet"}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {trip.latest_location
                        ? `Last updated ${formatDateTime(trip.latest_location.recorded_at)}`
                        : "Waiting for driver GPS"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4 text-sm text-slate-500">No live trips right now.</div>
              )}
            </div>
          </ShellCard>

          <ShellCard>
            <SectionTitle eyebrow="Bookings" title="Recent bookings" />
            <div className="mt-5 space-y-3">
              {dashboard?.recent_bookings?.length ? (
                dashboard.recent_bookings.map((booking) => (
                  <div key={booking.id} className="rounded-[1.6rem] border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-lg font-black text-slate-950">Booking #{booking.id}</div>
                      <StatusPill tone={booking.status === "CONFIRMED" ? "green" : booking.status === "CANCELLED" ? "red" : "amber"}>
                        {booking.status}
                      </StatusPill>
                    </div>
                    <div className="mt-2 text-sm text-slate-500">{booking.route_name} • {booking.bus_plate}</div>
                    <div className="mt-2 grid gap-3 md:grid-cols-2">
                      <div className="rounded-[1.2rem] bg-slate-50 px-3 py-3 text-sm text-slate-600">
                        Passenger {booking.passenger_name}
                      </div>
                      <div className="rounded-[1.2rem] bg-slate-50 px-3 py-3 text-sm text-slate-600">
                        Seats {booking.seats_count} • {formatMoney(booking.fare_total)}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">{formatDateTime(booking.created_at)}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4 text-sm text-slate-500">No bookings yet.</div>
              )}
            </div>
          </ShellCard>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <ShellCard>
            <SectionTitle eyebrow="Payments" title="Recent payments" />
            <div className="mt-5 space-y-3">
              {dashboard?.recent_payments?.length ? (
                dashboard.recent_payments.map((payment) => (
                  <div key={payment.id} className="rounded-[1.6rem] border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-lg font-black text-slate-950">Payment #{payment.id}</div>
                      <StatusPill tone={payment.status === "SUCCESS" ? "green" : payment.status === "FAILED" ? "red" : "amber"}>
                        {payment.status}
                      </StatusPill>
                    </div>
                    <div className="mt-2 text-sm text-slate-500">
                      Booking #{payment.booking_id} • {payment.route_name}
                    </div>
                    <div className="mt-2 grid gap-3 md:grid-cols-2">
                      <div className="rounded-[1.2rem] bg-slate-50 px-3 py-3 text-sm text-slate-600">
                        {payment.method} • {formatMoney(payment.amount)}
                      </div>
                      <div className="rounded-[1.2rem] bg-slate-50 px-3 py-3 text-sm text-slate-600">
                        Created by {payment.created_by_name}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Verified by {payment.verified_by_name || "-"} • {formatDateTime(payment.created_at)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4 text-sm text-slate-500">No payments yet.</div>
              )}
            </div>
          </ShellCard>

          <ShellCard>
            <SectionTitle eyebrow="Accounts" title="Newest users" />
            <div className="mt-5 space-y-3">
              {dashboard?.recent_users?.length ? (
                dashboard.recent_users.map((item) => (
                  <div key={item.id} className="rounded-[1.6rem] border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-lg font-black text-slate-950">{item.full_name}</div>
                      <StatusPill tone="blue">{item.role}</StatusPill>
                    </div>
                    <div className="mt-2 text-sm text-slate-500">{item.phone}</div>
                    <div className="mt-2 text-xs text-slate-500">Joined {formatDateTime(item.created_at)}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4 text-sm text-slate-500">No users yet.</div>
              )}
            </div>
          </ShellCard>
        </div>
      </div>
    </div>
  );
}