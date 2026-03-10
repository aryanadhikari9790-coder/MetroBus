import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function DriverHome() {
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

  const activeTrip = dashboard?.active_trip ?? null;
  const schedules = dashboard?.schedules ?? [];
  const manualOptions = dashboard?.manual_start_options ?? { routes: [], buses: [], helpers: [] };

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

  const activeTripSummary = useMemo(() => {
    if (!activeTrip) return null;
    return `${activeTrip.route_name} • ${activeTrip.bus_plate}`;
  }, [activeTrip]);

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
  };

  const endTrip = async () => {
    if (!activeTrip) return;

    await runAction(
      () => api.post(`/api/trips/${activeTrip.id}/end/`),
      "Trip ended successfully."
    );
    setAutoShare(false);
    setLocationStatus("");
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

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-slate-900 dark:bg-brand-bg dark:text-brand-text">
        <div className="mx-auto max-w-md px-4 py-6">Loading driver dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-brand-bg dark:text-brand-text">
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Driver</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-brand-muted">
              Start your trip, share live location, and end the trip from one place.
            </p>
          </div>
          <button
            className="rounded-xl border px-3 py-2 text-xs font-semibold dark:border-slate-800"
            onClick={() => document.documentElement.classList.toggle("dark")}
          >
            Theme
          </button>
        </div>

        {err ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {err}
          </div>
        ) : null}

        {msg ? (
          <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-200">
            {msg}
          </div>
        ) : null}

        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-brand-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-brand-muted">
                Active Trip
              </div>
              <h2 className="mt-1 text-lg font-bold">{activeTripSummary || "No LIVE trip"}</h2>
            </div>
            <button
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-800"
              onClick={() => loadDashboard()}
              disabled={busy || locationBusy}
            >
              Refresh
            </button>
          </div>

          {activeTrip ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-brand-bg">
                  <div className="text-xs text-slate-500 dark:text-brand-muted">Helper</div>
                  <div className="mt-1 font-semibold">{activeTrip.helper_name}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-brand-bg">
                  <div className="text-xs text-slate-500 dark:text-brand-muted">Started</div>
                  <div className="mt-1 font-semibold">{formatDateTime(activeTrip.started_at)}</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm dark:bg-brand-bg">
                <div className="text-xs text-slate-500 dark:text-brand-muted">Latest Location</div>
                {latestLocation ? (
                  <div className="mt-1 space-y-1">
                    <div className="font-semibold">
                      {latestLocation.lat}, {latestLocation.lng}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-brand-muted">
                      Updated: {formatDateTime(latestLocation.recorded_at)}
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 font-semibold">No location sent yet.</div>
                )}
                {locationStatus ? (
                  <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-300">{locationStatus}</div>
                ) : null}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  className="flex-1 rounded-2xl bg-brand-accent px-4 py-3 text-sm font-semibold text-slate-900 disabled:opacity-50"
                  onClick={() => setAutoShare((value) => !value)}
                  disabled={locationBusy}
                >
                  {autoShare ? "Stop Auto GPS" : "Start Auto GPS"}
                </button>
                <button
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800 disabled:opacity-50"
                  onClick={sendBrowserLocation}
                  disabled={locationBusy}
                >
                  {locationBusy ? "Sending..." : "Send Current Location"}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <input
                  className="rounded-2xl border p-3 text-sm dark:border-slate-700 dark:bg-brand-bg"
                  placeholder="Latitude"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                />
                <input
                  className="rounded-2xl border p-3 text-sm dark:border-slate-700 dark:bg-brand-bg"
                  placeholder="Longitude"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                />
              </div>

              <button
                className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800 disabled:opacity-50"
                onClick={sendManualLocation}
                disabled={locationBusy}
              >
                Send Manual Coordinates
              </button>

              <button
                className="mt-4 w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                onClick={endTrip}
                disabled={busy}
              >
                {busy ? "Working..." : "End Trip"}
              </button>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-500 dark:text-brand-muted">
              No trip is live for this driver yet. Start one from an assigned schedule or use the manual start form.
            </p>
          )}
        </div>

        {!activeTrip ? (
          <>
            <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-brand-card">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold">Assigned Schedules</h2>
                <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-brand-muted">
                  <input
                    type="checkbox"
                    checked={deviationMode}
                    onChange={(e) => setDeviationMode(e.target.checked)}
                  />
                  Deviation mode
                </label>
              </div>

              {schedules.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-brand-muted">
                  No planned schedules assigned right now.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {schedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800"
                    >
                      <div className="font-semibold">{schedule.route_name}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-brand-muted">
                        {schedule.bus_plate} • Helper: {schedule.helper_name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-brand-muted">
                        Scheduled: {formatDateTime(schedule.scheduled_start_time)}
                      </div>
                      <button
                        className="mt-3 w-full rounded-2xl bg-brand-accent px-4 py-3 text-sm font-semibold text-slate-900 disabled:opacity-50"
                        onClick={() => startScheduledTrip(schedule.id)}
                        disabled={busy}
                      >
                        {busy ? "Working..." : "Start This Trip"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-brand-card">
              <h2 className="text-sm font-bold">Manual Trip Start</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-brand-muted">
                Use this when you need to start a trip without a predefined schedule.
              </p>

              <div className="mt-4 space-y-3">
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-brand-bg"
                  value={routeId}
                  onChange={(e) => setRouteId(e.target.value)}
                >
                  {manualOptions.routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.city} • {route.name}
                    </option>
                  ))}
                </select>

                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-brand-bg"
                  value={busId}
                  onChange={(e) => setBusId(e.target.value)}
                >
                  {manualOptions.buses.map((bus) => (
                    <option key={bus.id} value={bus.id}>
                      {bus.plate_number} • {bus.capacity} seats
                    </option>
                  ))}
                </select>

                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-brand-bg"
                  value={helperId}
                  onChange={(e) => setHelperId(e.target.value)}
                >
                  {manualOptions.helpers.map((helper) => (
                    <option key={helper.id} value={helper.id}>
                      {helper.full_name} • {helper.phone}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800 disabled:opacity-50"
                onClick={startManualTrip}
                disabled={busy || !manualOptions.routes.length || !manualOptions.buses.length || !manualOptions.helpers.length}
              >
                {busy ? "Working..." : "Start Manual Trip"}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
