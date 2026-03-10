import { useEffect, useState } from "react";
import { api } from "../../api";

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function StatCard({ label, value, subtext }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-brand-card">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-brand-muted">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      {subtext ? (
        <div className="mt-1 text-xs text-slate-500 dark:text-brand-muted">{subtext}</div>
      ) : null}
    </div>
  );
}

function SectionCard({ title, children, emptyText }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-brand-card">
      <h2 className="text-sm font-bold">{title}</h2>
      {children}
      {!children && emptyText ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-brand-muted">{emptyText}</p>
      ) : null}
    </div>
  );
}

export default function AdminHome() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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

  useEffect(() => {
    loadDashboard();
    const intervalId = window.setInterval(() => {
      loadDashboard({ silent: true });
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-slate-900 dark:bg-brand-bg dark:text-brand-text">
        <div className="mx-auto max-w-6xl px-4 py-6">Loading admin dashboard...</div>
      </div>
    );
  }

  const overview = dashboard?.overview;
  const roleCounts = overview?.role_counts || {};
  const transport = overview?.transport || {};
  const trips = overview?.trips || {};
  const bookings = overview?.bookings || {};
  const payments = overview?.payments || {};
  const methods = payments?.methods || {};

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-brand-bg dark:text-brand-text">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-brand-muted">
              Monitor users, transport inventory, trips, bookings, payments, and live bus movement from one overview.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-xl border px-3 py-2 text-xs font-semibold dark:border-slate-800"
              onClick={() => document.documentElement.classList.toggle("dark")}
            >
              Theme
            </button>
            <button
              className="rounded-xl bg-brand-accent px-3 py-2 text-xs font-semibold text-slate-900"
              onClick={() => loadDashboard()}
            >
              Refresh
            </button>
          </div>
        </div>

        {err ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {err}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Users"
            value={overview?.users_total ?? 0}
            subtext={`Passengers ${roleCounts.PASSENGER || 0} • Drivers ${roleCounts.DRIVER || 0}`}
          />
          <StatCard
            label="Live Trips"
            value={trips.live ?? 0}
            subtext={`Total ${trips.total || 0} • Ended ${trips.ended || 0}`}
          />
          <StatCard
            label="Bookings"
            value={bookings.total ?? 0}
            subtext={`Confirmed ${bookings.confirmed || 0} • Cancelled ${bookings.cancelled || 0}`}
          />
          <StatCard
            label="Revenue"
            value={`Rs ${payments.revenue_success ?? 0}`}
            subtext={`Successful payments ${payments.success || 0}`}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <SectionCard title="User Roles">
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 dark:bg-brand-bg">
                <span>Passengers</span>
                <span className="font-semibold">{roleCounts.PASSENGER || 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 dark:bg-brand-bg">
                <span>Drivers</span>
                <span className="font-semibold">{roleCounts.DRIVER || 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 dark:bg-brand-bg">
                <span>Helpers</span>
                <span className="font-semibold">{roleCounts.HELPER || 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 dark:bg-brand-bg">
                <span>Admins</span>
                <span className="font-semibold">{roleCounts.ADMIN || 0}</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Transport Inventory">
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-brand-bg">
                <div className="text-xs text-slate-500 dark:text-brand-muted">Routes</div>
                <div className="mt-1 text-lg font-bold">{transport.routes || 0}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-brand-bg">
                <div className="text-xs text-slate-500 dark:text-brand-muted">Stops</div>
                <div className="mt-1 text-lg font-bold">{transport.stops || 0}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-brand-bg">
                <div className="text-xs text-slate-500 dark:text-brand-muted">Buses</div>
                <div className="mt-1 text-lg font-bold">{transport.buses || 0}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-brand-bg">
                <div className="text-xs text-slate-500 dark:text-brand-muted">Seats</div>
                <div className="mt-1 text-lg font-bold">{transport.seats || 0}</div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Payment Methods">
            <div className="mt-3 space-y-2 text-sm">
              {Object.entries(methods).map(([method, stats]) => (
                <div key={method} className="rounded-2xl bg-slate-50 px-3 py-2 dark:bg-brand-bg">
                  <div className="font-semibold">{method}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-brand-muted">
                    Total {stats.total} • Success {stats.success}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <SectionCard title="Live Trips" emptyText="No LIVE trips right now.">
            {dashboard?.live_trips?.length ? (
              <div className="mt-3 space-y-3">
                {dashboard.live_trips.map((trip) => (
                  <div key={trip.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                    <div className="font-semibold">{trip.route_name}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-brand-muted">
                      Bus {trip.bus_plate} • Driver {trip.driver_name} • Helper {trip.helper_name}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-brand-muted">
                      Started {formatDateTime(trip.started_at)}
                    </div>
                    <div className="mt-2 text-xs text-slate-500 dark:text-brand-muted">
                      Latest location {trip.latest_location ? `${trip.latest_location.lat}, ${trip.latest_location.lng}` : "No GPS update yet"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-brand-muted">
                      {trip.latest_location ? `Updated ${formatDateTime(trip.latest_location.recorded_at)}` : "Waiting for driver GPS"}
                    </div>
                    <div className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold dark:bg-brand-bg">
                      {trip.deviation_mode ? "Deviation Mode" : "Normal Route"}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Recent Bookings" emptyText="No bookings yet.">
            {dashboard?.recent_bookings?.length ? (
              <div className="mt-3 space-y-3">
                {dashboard.recent_bookings.map((booking) => (
                  <div key={booking.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">Booking #{booking.id}</div>
                      <div className="text-xs font-semibold">{booking.status}</div>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-brand-muted">
                      {booking.route_name} • {booking.bus_plate}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-brand-muted">
                      Passenger {booking.passenger_name} • Seats {booking.seats_count} • Rs {booking.fare_total}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-brand-muted">
                      {formatDateTime(booking.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </SectionCard>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <SectionCard title="Recent Payments" emptyText="No payments yet.">
            {dashboard?.recent_payments?.length ? (
              <div className="mt-3 space-y-3">
                {dashboard.recent_payments.map((payment) => (
                  <div key={payment.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">Payment #{payment.id}</div>
                      <div className="text-xs font-semibold">{payment.status}</div>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-brand-muted">
                      Booking #{payment.booking_id} • {payment.route_name}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-brand-muted">
                      {payment.method} • Rs {payment.amount} • Created by {payment.created_by_name}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-brand-muted">
                      Verified by {payment.verified_by_name || "-"} • {formatDateTime(payment.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Newest Users" emptyText="No users yet.">
            {dashboard?.recent_users?.length ? (
              <div className="mt-3 space-y-3">
                {dashboard.recent_users.map((user) => (
                  <div key={user.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">{user.full_name}</div>
                      <div className="text-xs font-semibold">{user.role}</div>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-brand-muted">{user.phone}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-brand-muted">
                      Joined {formatDateTime(user.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
