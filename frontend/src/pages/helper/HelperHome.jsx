import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../AuthContext";
import { clearToken } from "../../auth";
import { useTheme } from "../../ThemeContext";
import { themeTokens, pillColor } from "../../lib/theme";

function GlassCard({ children, className = "", t }) {
  return <div className={`rounded-2xl border backdrop-blur-sm p-5 ${t.card} ${className}`}>{children}</div>;
}
function Pill({ children, color = "slate", isDark }) {
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${pillColor(isDark, color)}`}>{children}</span>;
}
function Btn({ children, onClick, disabled, tone = "primary", className = "" }) {
  const m = { primary: "bg-indigo-600 hover:bg-indigo-500 text-white", success: "bg-emerald-600 hover:bg-emerald-500 text-white", danger: "bg-red-600 hover:bg-red-500 text-white", ghost: "bg-white/10 hover:bg-white/20 text-white border border-white/10" };
  return <button type="button" onClick={onClick} disabled={disabled} className={`rounded-xl px-5 py-3 text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${m[tone]} ${className}`}>{children}</button>;
}
function SLabel({ children, t }) { return <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-3 ${t.label}`}>{children}</p>; }
function LiveDot({ active }) {
  return <span className="relative flex h-2.5 w-2.5"><span className={`absolute inline-flex h-full w-full rounded-full ${active ? "bg-emerald-400 animate-ping opacity-75" : ""}`} /><span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${active ? "bg-emerald-400" : "bg-slate-500"}`} /></span>;
}
function ThemeToggle({ isDark, toggle }) {
  return <button type="button" onClick={toggle} style={{ color: "var(--text)", borderColor: "var(--border)", background: "var(--surface)" }} className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition hover:opacity-80">{isDark ? "☀ Light" : "🌙 Dark"}</button>;
}
function SeatBtn({ seat, selected, onClick, t }) {
  const cls = !seat.available ? t.seatTaken : selected ? t.seatSel : t.seatOpen;
  return <button type="button" disabled={!seat.available} onClick={onClick} className={`rounded-xl border px-2 py-2.5 text-xs font-bold text-center transition-all ${cls}`}><div>{seat.seat_no}</div><div className="mt-1 text-[9px] uppercase opacity-70">{seat.available ? (selected ? "Marked" : "Open") : "Taken"}</div></button>;
}
function fmt(v) { if (!v) return "—"; try { return new Date(v).toLocaleString(); } catch { return v; } }

export default function HelperHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark, toggle } = useTheme();
  const t = themeTokens(isDark);

  const [trips, setTrips]                     = useState([]);
  const [tripId, setTripId]                   = useState("");
  const [routeStops, setRouteStops]           = useState([]);
  const [latestLocation, setLatestLocation]   = useState(null);
  const [fromOrder, setFromOrder]             = useState("");
  const [toOrder, setToOrder]                 = useState("");
  const [seats, setSeats]                     = useState([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [loadingTrips, setLoadingTrips]       = useState(true);
  const [loadingAvail, setLoadingAvail]       = useState(false);
  const [offlineBusy, setOfflineBusy]         = useState(false);
  const [verifyBusy, setVerifyBusy]           = useState(false);
  const [verifyBookingId, setVerifyBookingId] = useState("");
  const [verifiedPayment, setVerifiedPayment] = useState(null);
  const [msg, setMsg]                         = useState("");
  const [err, setErr]                         = useState("");

  const selectedTrip   = useMemo(() => trips.find(x => String(x.id) === String(tripId)) || null, [trips, tripId]);
  const availableSeats = seats.filter(s => s.available);
  const occupiedCount  = seats.length - availableSeats.length;
  const fromStop       = routeStops.find(s => String(s.stop_order) === String(fromOrder)) || null;
  const toStop         = routeStops.find(s => String(s.stop_order) === String(toOrder)) || null;
  const markedLabels   = seats.filter(s => selectedSeatIds.includes(s.seat_id)).map(s => s.seat_no);

  const loadTrips = async ({ silent = false } = {}) => {
    if (!silent) setLoadingTrips(true);
    try {
      const res = await api.get("/api/trips/live/"); setTrips(res.data); setErr("");
      if (!tripId && res.data.length > 0) setTripId(String(res.data[0].id));
      else if (tripId && !res.data.some(x => String(x.id) === String(tripId))) setTripId(res.data[0] ? String(res.data[0].id) : "");
    } catch (e) { setErr(e?.response?.data?.detail || "Unable to load live trips."); }
    finally { if (!silent) setLoadingTrips(false); }
  };

  const loadTripCtx = async (id) => {
    if (!id) { setRouteStops([]); setLatestLocation(null); return; }
    try {
      const [d, l] = await Promise.all([api.get(`/api/trips/${id}/`), api.get(`/api/trips/${id}/location/latest/`).catch(() => null)]);
      setRouteStops(d.data.route_stops || []); setLatestLocation(l?.data || null);
    } catch (e) { setErr(e?.response?.data?.detail || "Unable to load trip context."); setRouteStops([]); setLatestLocation(null); }
  };

  const loadAvail = async (tid, from, to) => {
    if (!tid || !from || !to) { setSeats([]); setSelectedSeatIds([]); return; }
    setLoadingAvail(true);
    try { const res = await api.get(`/api/bookings/trips/${tid}/availability/?from=${from}&to=${to}`); setSeats(res.data.seats || []); setSelectedSeatIds([]); setErr(""); }
    catch (e) { setErr(e?.response?.data?.detail || "Unable to load availability."); setSeats([]); setSelectedSeatIds([]); }
    finally { setLoadingAvail(false); }
  };

  useEffect(() => { loadTrips(); const id = setInterval(() => loadTrips({ silent: true }), 20000); return () => clearInterval(id); }, []);
  useEffect(() => { loadTripCtx(tripId); if (!tripId) return; const id = setInterval(() => loadTripCtx(tripId), 15000); return () => clearInterval(id); }, [tripId]);
  useEffect(() => {
    if (routeStops.length < 2) { setFromOrder(""); setToOrder(""); return; }
    setFromOrder(c => c || String(routeStops[0].stop_order));
    setToOrder(c => c || String(routeStops[1].stop_order));
  }, [routeStops]);
  useEffect(() => {
    if (!fromOrder || !toOrder) return;
    if (Number(toOrder) <= Number(fromOrder)) { const n = routeStops.find(s => Number(s.stop_order) > Number(fromOrder)); setToOrder(n ? String(n.stop_order) : ""); return; }
    loadAvail(tripId, fromOrder, toOrder);
  }, [tripId, fromOrder, toOrder]);

  const toggleSeat = id => setSelectedSeatIds(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]);

  const submitOffline = async () => {
    if (!tripId || !fromOrder || !toOrder || !selectedSeatIds.length) { setErr("Choose trip, segment, and at least one seat."); return; }
    setOfflineBusy(true); setErr(""); setMsg("");
    try { const res = await api.post(`/api/bookings/trips/${tripId}/offline/`, { from_stop_order: +fromOrder, to_stop_order: +toOrder, seat_ids: selectedSeatIds }); setMsg(`Offline boarding #${res.data.offline_boarding.id} saved.`); await loadAvail(tripId, fromOrder, toOrder); }
    catch (e) { setErr(e?.response?.data?.detail || "Offline update failed."); }
    finally { setOfflineBusy(false); }
  };

  const verifyCash = async () => {
    if (!verifyBookingId.trim()) { setErr("Enter a booking ID."); return; }
    setVerifyBusy(true); setErr(""); setMsg(""); setVerifiedPayment(null);
    try { const res = await api.post(`/api/payments/cash/verify/${verifyBookingId.trim()}/`); setVerifiedPayment(res.data); setMsg(`Payment verified for booking #${verifyBookingId.trim()}.`); }
    catch (e) { setErr(e?.response?.data?.detail || "Verification failed."); }
    finally { setVerifyBusy(false); }
  };

  const handleLogout = () => { clearToken(); navigate("/auth/login"); };

  if (loadingTrips) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${t.page}`}>
        <div className="text-center"><div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mx-auto" /><p className={`mt-4 text-sm ${t.textSub}`}>Loading helper dashboard…</p></div>
      </div>
    );
  }

  const stopBg = isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200";

  return (
    <div className={`min-h-screen font-sans transition-colors duration-200 ${t.page}`}>
      <header className={`sticky top-0 z-30 border-b backdrop-blur-md px-4 py-3 ${t.nav}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white">MB</div>
            <div><p className={`text-[10px] font-bold uppercase tracking-widest ${t.label}`}>MetroBus Helper</p><p className={`text-sm font-bold leading-none ${t.text}`}>{user?.full_name || "Helper"}</p></div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Pill color={trips.length ? "emerald" : "slate"} isDark={isDark}><LiveDot active={trips.length > 0} /><span className="ml-1.5">{trips.length} live trip{trips.length !== 1 ? "s" : ""}</span></Pill>
            <ThemeToggle isDark={isDark} toggle={toggle} />
            <Btn tone="ghost" onClick={() => loadTrips()} className="!py-2 !px-3 text-xs">↻</Btn>
            <Btn tone="danger" onClick={handleLogout} className="!py-2 !px-3 text-xs">Logout</Btn>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5 space-y-5">
        {err && <div className={`rounded-xl border px-4 py-3 text-sm ${t.errBanner}`}>{err}</div>}
        {msg && <div className={`rounded-xl border px-4 py-3 text-sm ${t.okBanner}`}>✓ {msg}</div>}

        {/* Hero */}
        <div className={`relative overflow-hidden rounded-2xl border p-6 bg-gradient-to-br ${isDark ? "from-indigo-900/60 via-[#0d1230] to-[#0a0e1a] border-indigo-700/30" : "from-indigo-50 via-white to-[#f0f4f8] border-indigo-200"}`}>
          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mb-1">Active Trip</p>
            <h1 className={`text-2xl font-black ${t.text}`}>{selectedTrip?.route_name || "No active trip"}</h1>
            <div className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm ${t.textSub}`}><span>🚌 {selectedTrip?.bus_plate || "—"}</span><span>👤 {selectedTrip?.driver_name || "—"}</span><span>📍 #{selectedTrip?.id || "—"}</span></div>
            <div className="mt-4">
              <select value={tripId} onChange={e => { setTripId(e.target.value); setMsg(""); setErr(""); setVerifiedPayment(null); }}
                className={`rounded-xl border px-4 py-2.5 text-sm outline-none focus:border-indigo-500 w-full sm:w-auto ${t.input}`} style={{ backgroundColor: "var(--select-bg)", color: "var(--input-text)" }}>
                {trips.length === 0 && <option value="">No live trips</option>}
                {trips.map(x => <option key={x.id} value={x.id}>{x.route_name} | {x.bus_plate}</option>)}
              </select>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[{ label: "Started", v: fmt(selectedTrip?.started_at) }, { label: "Last GPS", v: latestLocation ? fmt(latestLocation.recorded_at) : "Waiting…" }, { label: "Status", v: selectedTrip?.status || "—" }].map(r => (
                <div key={r.label} className={`rounded-xl border px-4 py-3 ${stopBg}`}><p className={`text-[10px] uppercase tracking-widest ${t.label}`}>{r.label}</p><p className={`text-sm font-semibold mt-1 truncate ${t.text}`}>{r.v}</p></div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[{ label: "Open Seats", value: availableSeats.length, accent: "text-emerald-500" }, { label: "Occupied", value: occupiedCount, accent: "text-amber-500" }, { label: "Marked", value: selectedSeatIds.length, accent: "text-indigo-500" }].map(c => (
            <GlassCard key={c.label} t={t}><p className={`text-[10px] uppercase tracking-widest ${t.label}`}>{c.label}</p><p className={`text-3xl font-black mt-2 ${c.accent}`}>{c.value}</p></GlassCard>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-5">
            {/* Segment */}
            <GlassCard t={t}>
              <div className="flex items-center justify-between mb-4"><SLabel t={t}>Segment</SLabel>{loadingAvail ? <Pill color="amber" isDark={isDark}>Refreshing…</Pill> : <Pill color="emerald" isDark={isDark}>Ready</Pill>}</div>
              <div className="grid grid-cols-2 gap-3">
                {[{ label: "From Stop", val: fromOrder, set: setFromOrder }, { label: "To Stop", val: toOrder, set: setToOrder }].map(f => (
                  <div key={f.label}>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${t.label}`}>{f.label}</label>
                    <select value={f.val} onChange={e => f.set(e.target.value)} className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-indigo-500 ${t.input}`} style={{ backgroundColor: "var(--select-bg)", color: "var(--input-text)" }}>
                      {routeStops.map(s => <option key={s.stop_order} value={s.stop_order}>{s.stop_order}. {s.stop?.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              {fromStop && toStop && <div className={`mt-3 rounded-xl border px-4 py-2.5 text-sm ${isDark ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>Segment: <span className="font-bold">{fromStop.stop?.name}</span> → <span className="font-bold">{toStop.stop?.name}</span></div>}
              {routeStops.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{routeStops.map(item => <span key={item.stop_order} className={`rounded-full border px-2.5 py-1 text-[10px] ${t.tagBg}`}>{item.stop_order}. {item.stop?.name}</span>)}</div>}
            </GlassCard>

            {/* Seats */}
            <GlassCard t={t}>
              <div className="flex items-center justify-between mb-4"><SLabel t={t}>Seat Map — Mark Offline Passengers</SLabel>{markedLabels.length > 0 && <Pill color="indigo" isDark={isDark}>{markedLabels.join(", ")}</Pill>}</div>
              {seats.length === 0 ? <p className={`text-sm py-2 ${t.textSub}`}>Select a trip and segment to load seats.</p> : <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">{seats.map(s => <SeatBtn key={s.seat_id} seat={s} selected={selectedSeatIds.includes(s.seat_id)} onClick={() => toggleSeat(s.seat_id)} t={t} />)}</div>}
              <Btn tone="success" onClick={submitOffline} disabled={offlineBusy || !selectedSeatIds.length} className="mt-4 w-full !py-3.5">
                {offlineBusy ? "Saving…" : `Save Offline Boarding (${selectedSeatIds.length} seat${selectedSeatIds.length !== 1 ? "s" : ""})`}
              </Btn>
            </GlassCard>
          </div>

          <div className="space-y-5">
            {/* Cash verify */}
            <GlassCard t={t} className={`bg-gradient-to-br ${isDark ? "from-indigo-900/40 to-transparent" : "from-indigo-50 to-transparent"}`}>
              <SLabel t={t}>Cash Payment Verification</SLabel>
              <p className={`text-xs mb-4 ${t.textSub}`}>Mark a booking as confirmed when a passenger pays cash on board.</p>
              <div className="flex gap-2">
                <input type="text" value={verifyBookingId} onChange={e => setVerifyBookingId(e.target.value)} placeholder="Enter Booking ID" className={`flex-1 rounded-xl border px-4 py-3 text-sm outline-none focus:border-indigo-500 ${t.input}`} />
                <Btn tone="success" onClick={verifyCash} disabled={verifyBusy} className="!px-4">{verifyBusy ? "…" : "Verify"}</Btn>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[{ label: "Method", v: verifiedPayment?.method || "CASH" }, { label: "Status", v: verifiedPayment?.status || "—" }, { label: "Amount", v: verifiedPayment?.amount ? `NPR ${verifiedPayment.amount}` : "—" }].map(r => (
                  <div key={r.label} className={`rounded-xl border px-3 py-3 ${isDark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"}`}>
                    <p className={`text-[10px] uppercase tracking-widest ${t.label}`}>{r.label}</p>
                    <p className={`text-sm font-bold mt-1 ${verifiedPayment ? "text-emerald-500" : t.textSub}`}>{r.v}</p>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Route stops */}
            {routeStops.length > 0 && (
              <GlassCard t={t}>
                <SLabel t={t}>Route Stops ({routeStops.length})</SLabel>
                <div className="space-y-0 max-h-64 overflow-y-auto pr-1">
                  {routeStops.map((item, i) => (
                    <div key={item.stop_order} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className={`mt-0.5 h-3 w-3 rounded-full flex-shrink-0 border-2 ${i === 0 ? "bg-emerald-500 border-emerald-400" : i === routeStops.length - 1 ? "bg-red-500 border-red-400" : `bg-transparent ${isDark ? "border-slate-600" : "border-slate-300"}`}`} />
                        {i < routeStops.length - 1 && <span className={`w-px flex-1 min-h-[1.5rem] ${t.timelineLine}`} />}
                      </div>
                      <p className={`text-xs pb-3 ${t.textSub}`}>{item.stop?.name}</p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
