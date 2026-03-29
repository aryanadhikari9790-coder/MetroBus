import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { divIcon } from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { api } from "../../api";
import { useAuth } from "../../AuthContext";
import { clearToken } from "../../auth";
import { snapRouteToRoad } from "../../lib/mapRoute";
import { useTheme } from "../../ThemeContext";
import { themeTokens, pillColor } from "../../lib/theme";

// ─── Pure helpers ─────────────────────────────────────────────
function fmt(v) { if (!v) return "—"; try { return new Date(v).toLocaleString(); } catch { return v; } }
function fmtMoney(v) { return `NPR ${Number(v || 0).toLocaleString()}`; }
function fmtEta(eta) { if (!eta) return "ETA unavailable"; if (eta.status === "arriving") return "Arriving now"; if (eta.status === "passed") return "Passed pickup"; if (Number.isFinite(eta.minutes)) return `${eta.minutes} min`; return "ETA unavailable"; }
function toPoint(lat, lng) { const la = Number(lat), lo = Number(lng); return isFinite(la) && isFinite(lo) ? [la, lo] : null; }
function toLocPoint(loc) { return loc ? toPoint(loc.lat, loc.lng) : null; }
function distKm(a, b) { if (!a || !b) return 0; const R = 6371, toRad = d => (d * Math.PI) / 180; const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]); const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); }
function cumDist(pts) { const c = [0]; for (let i = 1; i < pts.length; i++) c[i] = c[i - 1] + distKm(pts[i - 1], pts[i]); return c; }
function nearestIdx(pts, t) { if (!pts.length || !t) return -1; let best = 0, bestD = Infinity; pts.forEach((p, i) => { const d = distKm(p, t); if (d < bestD) { bestD = d; best = i; } }); return best; }
function speedKmh(s) { const n = Number(s); return !isFinite(n) || n <= 0 ? 22 : n <= 30 ? n * 3.6 : n; }
function snapPolylineWithAngle(p, line) {
  if (!p || !line || !line.length) return { pt: p, angle: 0 };
  if (line.length === 1) return { pt: line[0], angle: 0 };
  let closest = line[0], minDist = Infinity, bestAngle = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1], dx = b[0] - a[0], dy = b[1] - a[1];
    let t = 0;
    if (dx !== 0 || dy !== 0) t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    const proj = [a[0] + t * dx, a[1] + t * dy], distSq = (p[0] - proj[0]) ** 2 + (p[1] - proj[1]) ** 2;
    if (distSq < minDist) { 
      minDist = distSq; closest = proj; 
      bestAngle = Math.atan2(b[1] - a[1], b[0] - a[0]) * (180 / Math.PI);
    }
  }
  return { pt: closest, angle: bestAngle };
}
function estimateEta(busPoint, target, path, speed) {
  if (!busPoint || !target) return null;
  const pts = path.length > 1 ? path : [busPoint, target];
  const cum = cumDist(pts); const bi = nearestIdx(pts, busPoint); const ti = nearestIdx(pts, target);
  if (bi === -1 || ti === -1) return null;
  const direct = distKm(busPoint, target);
  if (direct <= 0.15) return { status: "arriving", minutes: 1 };
  if (bi > ti + 3 && direct > 0.2) return { status: "passed", minutes: null };
  const routeDist = ti >= bi ? Math.max(0, cum[ti] - cum[bi]) : direct;
  return { status: "enroute", minutes: Math.max(1, Math.round((routeDist / speedKmh(speed)) * 60)) };
}
function buildFormPost(redirect) {
  const form = document.createElement("form"); form.method = "POST"; form.action = redirect.url;
  Object.entries(redirect.fields || {}).forEach(([k, v]) => { const inp = document.createElement("input"); inp.type = "hidden"; inp.name = k; inp.value = v; form.appendChild(inp); });
  document.body.appendChild(form); form.submit();
}
function createBusIcon({ active = false, heading = 0, label = "BUS" }) {
  const size = active ? 48 : 38;
  const fill = active ? "#4f46e5" : "#64748b";
  const shadow = active ? "drop-shadow(0 6px 12px rgba(79, 70, 229, 0.4))" : "drop-shadow(0 4px 6px rgba(0,0,0,0.3))";
  
  let rot = (heading + 90) % 360;
  if(rot < 0) rot += 360;
  const flip = (rot > 90 && rot < 270) ? "scaleY(-1)" : "scaleY(1)";

  return divIcon({ 
    className: "", iconSize: [size, size + 20], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2],
    html: `
      <div style="position:relative;width:${size}px;height:${size + 20}px;">
        <div style="position:absolute;left:50%;bottom:0;transform:translateX(-50%);padding:2px 8px;border-radius:999px;background:#0f172a;color:white;font-size:10px;font-weight:800;letter-spacing:0.08em;white-space:nowrap;z-index:10;border:1px solid rgba(255,255,255,0.15);box-shadow:0 4px 6px rgba(0,0,0,0.3);">
          ${label}
        </div>
        <div style="position:absolute;inset:0;display:flex;align-items:flex-start;justify-content:center;">
          <div style="width:${size}px;height:${size}px;filter:${shadow};transform:rotate(${rot}deg) ${flip};transform-origin:center center;transition:transform 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28);">
            <svg viewBox="0 0 64 64" width="${size}" height="${size}">
              <path d="M 12 14 L 60 14 C 62.2 14 64 15.8 64 18 L 64 46 C 64 48.2 62.2 50 60 50 L 4 50 C 1.8 50 0 48.2 0 46 L 0 32 C 0 19.6 8 14 12 14 Z" fill="${fill}" />
              <path d="M 14 20 L 22 20 L 22 34 L 5 34 C 5 26.6 8 20 14 20 Z" fill="#ffffff" />
              <rect x="25" y="20" width="10" height="14" rx="1" fill="#ffffff" />
              <rect x="38" y="20" width="10" height="14" rx="1" fill="#ffffff" />
              <rect x="51" y="20" width="9" height="14" rx="1" fill="#ffffff" />
              <circle cx="16" cy="50" r="7" fill="${fill}" />
              <circle cx="48" cy="50" r="7" fill="${fill}" />
              <circle cx="16" cy="50" r="3" fill="#ffffff" />
              <circle cx="48" cy="50" r="3" fill="#ffffff" />
            </svg>
          </div>
        </div>
      </div>
    `
  });
}

// ─── Design primitives ─────────────────────────────────────────
function GlassCard({ children, className = "", t }) { return <div className={`rounded-2xl border backdrop-blur-sm p-5 ${t.card} ${className}`}>{children}</div>; }
function Pill({ children, color = "slate", isDark }) { return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${pillColor(isDark, color)}`}>{children}</span>; }
function Btn({ children, onClick, disabled, tone = "primary", className = "" }) {
  const m = { primary: "bg-indigo-600 hover:bg-indigo-500 text-white", success: "bg-emerald-600 hover:bg-emerald-500 text-white", danger: "bg-red-600 hover:bg-red-500 text-white", ghost: "bg-white/10 hover:bg-white/20 text-white border border-white/10" };
  return <button type="button" onClick={onClick} disabled={disabled} className={`rounded-xl px-5 py-3 text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${m[tone]} ${className}`}>{children}</button>;
}
function SLabel({ children, t }) { return <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-3 ${t.label}`}>{children}</p>; }
function ThemeToggle({ isDark, toggle }) { return <button type="button" onClick={toggle} style={{ color: "var(--text)", borderColor: "var(--border)", background: "var(--surface)" }} className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition hover:opacity-80">{isDark ? "☀ Light" : "🌙 Dark"}</button>; }

function MapViewport({ points }) {
  const map = useMap();
  const [bHash, setBHash] = useState("");
  useEffect(() => { 
    if (!points.length) return; 
    let minL = Infinity, maxL = -Infinity, minN = Infinity, maxN = -Infinity;
    for(const p of points) { if(p[0]<minL) minL=p[0]; if(p[0]>maxL) maxL=p[0]; if(p[1]<minN) minN=p[1]; if(p[1]>maxN) maxN=p[1]; }
    const hash = `${minL},${maxL},${minN},${maxN}`;
    if (hash === bHash) return;
    setBHash(hash);
    if (points.length === 1) { map.setView(points[0], 14); return; } 
    map.fitBounds(points, { padding: [26, 26] }); 
  }, [map, points, bHash]);
  return null;
}

function StopSearch({ label, value, onChange, stops, active, onMapSelect, pickedFromMap, t, isDark }) {
  const [query, setQuery] = useState("");
  const [open, setOpen]   = useState(false);
  const sel = stops.find(s => String(s.id) === String(value)) || null;
  const filtered = useMemo(() => { const q = query.trim().toLowerCase(); return q ? stops.filter(s => s.name.toLowerCase().includes(q)) : stops; }, [query, stops]);
  useEffect(() => { setQuery(sel?.name || ""); }, [sel?.id]);

  // Button label logic:
  //  - "Picking…" ONLY when actively picking (map mode clicked) and no stop selected yet
  //  - "✓ <stop name>" when a stop is chosen (dropdown OR map)
  //  - "Pick on map" when nothing is selected and not in active mode
  const mapBtnLabel = active && !value
    ? "Picking…"
    : value && sel
    ? `✓ ${sel.name.split(" ").slice(0, 2).join(" ")}`
    : "Pick on map";

  const mapBtnClass = active && !value
    ? "bg-indigo-600 text-white"
    : value
    ? pillColor(isDark, "emerald")
    : isDark
    ? "bg-white/10 text-slate-400 hover:bg-white/20"
    : "bg-slate-100 text-slate-500 hover:bg-slate-200";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label className={`text-[10px] font-bold uppercase tracking-widest ${t.label}`}>{label}</label>
        <button type="button" onClick={onMapSelect}
          className={`max-w-[140px] truncate rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide transition ${mapBtnClass}`}
          title={sel ? `Change: ${sel.name}` : "Pick on map"}>
          {mapBtnLabel}
        </button>
      </div>
      <div className="relative">
        <input type="text" value={query} onChange={e => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} placeholder="Search stop name…"
          className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-indigo-500 transition ${t.input}`} />
        {open && (
          <div className={`absolute left-0 right-0 top-[calc(100%+0.4rem)] z-[1200] max-h-64 overflow-y-auto rounded-2xl border py-2 shadow-2xl ${t.dropList}`}>
            {filtered.length ? filtered.map(stop => { const isSel = String(stop.id) === String(value); return <button key={stop.id} type="button" onMouseDown={() => { onChange(String(stop.id)); setQuery(stop.name); setOpen(false); }} className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition ${isSel ? t.dropSel : t.dropItem}`}><span>{stop.name}</span>{isSel && <span className="text-[10px] text-indigo-400">Selected</span>}</button>; })
              : <div className={`px-4 py-3 text-sm ${t.textSub}`}>No stops found.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function SeatBtn({ seat, selected, onClick, t }) {
  const cls = !seat.available ? t.seatTaken : selected ? t.seatSel : t.seatOpen;
  return <button type="button" disabled={!seat.available} onClick={onClick} className={`rounded-xl border px-2 py-2.5 text-xs font-bold text-center transition-all ${cls}`}><div>{seat.seat_no}</div><div className="text-[9px] uppercase opacity-70 mt-0.5">{seat.available ? (selected ? "Sel" : "Open") : "Taken"}</div></button>;
}

const PAX_TABS = [{ id: "home", label: "Home", icon: "🗺" }, { id: "settings", label: "Settings", icon: "⚙" }, { id: "profile", label: "Profile", icon: "👤" }];

export default function PassengerHome() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const { isDark, toggle } = useTheme();
  const t = themeTokens(isDark);

  const [activeView, setActiveView]         = useState("home");
  const [stops, setStops]                   = useState([]);
  const [trips, setTrips]                   = useState([]);
  const [tripContexts, setTripContexts]     = useState({});
  const [pickupStopId, setPickupStopId]     = useState("");
  const [dropStopId, setDropStopId]         = useState("");
  const [selectionMode, setSelectionMode]   = useState("pickup");
  const [step, setStep]                     = useState("plan");
  const [findingRoutes, setFindingRoutes]   = useState(false);
  const [matchedTrips, setMatchedTrips]     = useState([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [seats, setSeats]                   = useState([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [loading, setLoading]               = useState(true);
  const [loadingSeats, setLoadingSeats]     = useState(false);
  const [bookingBusy, setBookingBusy]       = useState(false);
  const [paymentBusy, setPaymentBusy]       = useState(false);
  const [lastBookingId, setLastBookingId]   = useState(null);
  const [lastBookingSummary, setLastBookingSummary] = useState(null);
  const [roadPolyline, setRoadPolyline]     = useState([]);
  const [selSrc, setSelSrc]                 = useState({ pickup: "dropdown", drop: "dropdown" });
  const [profileForm, setProfileForm]       = useState({ full_name: "", email: "" });
  const [profileBusy, setProfileBusy]       = useState(false);
  const [settings, setSettings]             = useState({ liveTracking: true, arrivalAlerts: true, compactMap: false });
  const [msg, setMsg]                       = useState("");
  const [err, setErr]                       = useState("");

  const pickupStop  = stops.find(s => String(s.id) === String(pickupStopId)) || null;
  const dropStop    = stops.find(s => String(s.id) === String(dropStopId)) || null;
  const selTrip     = matchedTrips.find(x => String(x.id) === String(selectedTripId)) || matchedTrips[0] || null;
  const selCtx      = selTrip ? tripContexts[selTrip.id] : null;
  const routeStops  = selCtx?.route_stops || [];
  const routePoly   = useMemo(() => routeStops.map(item => toPoint(item.stop?.lat, item.stop?.lng)).filter(Boolean), [routeStops]);
  const dispPoly    = roadPolyline.length > 1 ? roadPolyline : routePoly;
  const selLabels   = seats.filter(s => selectedSeatIds.includes(s.seat_id)).map(s => s.seat_no);
  const estFare     = lastBookingSummary?.fare_total || (selTrip && selectedSeatIds.length > 0 ? (selTrip.fare_estimate || 50) * selectedSeatIds.length : 0);

  const mapPoints = useMemo(() => { const pts = [...dispPoly]; if (pts.length < 2) { stops.forEach(s => { const p = toPoint(s.lat, s.lng); if (p) pts.push(p); }); } return pts; }, [dispPoly, stops]);

  const loadBase = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try { const [sR, tR] = await Promise.all([api.get("/api/transport/stops/"), api.get("/api/trips/live/")]); setStops(sR.data.stops || []); setTrips(tR.data || []); setErr(""); }
    catch (e) { setErr(e?.response?.data?.detail || "Unable to load map data."); } finally { if (!silent) setLoading(false); }
  };

  const ensureCtx = async (tripList) => {
    const missing = tripList.filter(x => !tripContexts[x.id]);
    if (!missing.length) return tripContexts;
    const pairs = await Promise.all(missing.map(async x => [x.id, (await api.get(`/api/trips/${x.id}/`)).data]));
    const merged = { ...tripContexts }; pairs.forEach(([id, data]) => { merged[id] = data; }); setTripContexts(merged); return merged;
  };

  const loadSeats = async (tid, from, to) => {
    if (!tid || !from || !to) { setSeats([]); setSelectedSeatIds([]); return; }
    setLoadingSeats(true);
    try { const res = await api.get(`/api/bookings/trips/${tid}/availability/?from=${from}&to=${to}`); setSeats(res.data.seats || []); setSelectedSeatIds([]); }
    catch (e) { setErr(e?.response?.data?.detail || "Unable to load seats."); setSeats([]); setSelectedSeatIds([]); } finally { setLoadingSeats(false); }
  };

  useEffect(() => { loadBase(); const id = setInterval(() => loadBase({ silent: true }), 4000); return () => clearInterval(id); }, []);
  useEffect(() => { setProfileForm({ full_name: user?.full_name || "", email: user?.email || "" }); }, [user?.full_name, user?.email]);
  useEffect(() => { try { const raw = localStorage.getItem("metrobus_passenger_settings"); if (raw) setSettings(c => ({ ...c, ...JSON.parse(raw) })); } catch { /* ignore */ } }, []);
  useEffect(() => { localStorage.setItem("metrobus_passenger_settings", JSON.stringify(settings)); }, [settings]);
  useEffect(() => { if (!(pickupStopId && dropStopId && matchedTrips.length)) return; findRoutes({ silent: true }).catch(() => {}); }, [trips]);
  useEffect(() => { if (!selTrip) { setSeats([]); return; } loadSeats(selTrip.id, selTrip.from_order, selTrip.to_order); }, [selectedTripId, matchedTrips]);
  useEffect(() => { if (routePoly.length < 2) { setRoadPolyline([]); return; } const c = new AbortController(); snapRouteToRoad(routePoly, c.signal).then(p => setRoadPolyline(p.length > 1 ? p : [])).catch(e => { if (e.name !== "AbortError") setRoadPolyline([]); }); return () => c.abort(); }, [routePoly]);

  const findRoutes = async ({ silent = false } = {}) => {
    if (!pickupStopId || !dropStopId) { setErr("Choose both pickup and drop points first."); return; }
    if (String(pickupStopId) === String(dropStopId)) { setErr("Pickup and drop must be different."); return; }
    if (!silent) { setFindingRoutes(true); setErr(""); setMsg(""); }
    try {
      const ctxMap = await ensureCtx(trips); const matches = [];
      for (const trip of trips) {
        const rs = ctxMap[trip.id]?.route_stops || [];
        const pR = rs.find(item => String(item.stop?.id) === String(pickupStopId)); const dR = rs.find(item => String(item.stop?.id) === String(dropStopId));
        if (!pR || !dR || Number(dR.stop_order) <= Number(pR.stop_order)) continue;
        const avail = await api.get(`/api/bookings/trips/${trip.id}/availability/?from=${pR.stop_order}&to=${dR.stop_order}`);
        const seatsData = avail.data.seats || []; const open = seatsData.filter(s => s.available).length; const occ = seatsData.length ? Math.round(((seatsData.length - open) / seatsData.length) * 100) : 0;
        const routePts = rs.map(item => toPoint(item.stop?.lat, item.stop?.lng)).filter(Boolean);
        const eta = estimateEta(toLocPoint(trip.latest_location), toPoint(pR.stop?.lat, pR.stop?.lng), routePts, trip.latest_location?.speed);
        matches.push({ ...trip, from_order: +pR.stop_order, to_order: +dR.stop_order, open_seats: open, total_seats: seatsData.length, occupancy_percent: occ, occupancy_label: occ >= 80 ? "Busy" : occ >= 50 ? "Moderate" : "Comfortable", eta, availability: seatsData, fare_estimate: 50 });
      }
      setMatchedTrips(matches); setSelectedTripId(matches[0] ? String(matches[0].id) : "");
      setLastBookingId(null); setLastBookingSummary(null); setSelectedSeatIds([]);
      if (!matches.length) { setSeats([]); setErr("No live buses found."); if (!silent) setStep("plan"); }
      else if (!silent) { setMsg(`${matches.length} live bus${matches.length !== 1 ? "es" : ""} found.`); setStep("buses"); }
    } catch (e) { if (!silent) setErr(e?.response?.data?.detail || "Unable to find routes."); }
    finally { if (!silent) setFindingRoutes(false); }
  };

  const handleMapPick = stopId => {
    if (selectionMode === "drop") { setDropStopId(String(stopId)); setSelSrc(c => ({ ...c, drop: "map" })); setSelectionMode(""); return; }
    if (!pickupStopId || selectionMode === "pickup") { setPickupStopId(String(stopId)); setSelSrc(c => ({ ...c, pickup: "map" })); setSelectionMode("drop"); return; }
    setDropStopId(String(stopId)); setSelSrc(c => ({ ...c, drop: "map" })); setSelectionMode("");
  };

  const selectBus = id => { setSelectedTripId(String(id)); const x = matchedTrips.find(m => String(m.id) === String(id)); if (x?.availability) { setSeats(x.availability); setSelectedSeatIds([]); } setStep("seats"); };
  const toggleSeat = id => setSelectedSeatIds(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]);

  const bookSeats = async () => {
    if (!selTrip || !selectedSeatIds.length) { setErr("Select a bus and at least one seat."); return; }
    setBookingBusy(true); setErr(""); setMsg("");
    try { const res = await api.post(`/api/bookings/trips/${selTrip.id}/book/`, { from_stop_order: selTrip.from_order, to_stop_order: selTrip.to_order, seat_ids: selectedSeatIds }); setLastBookingId(res.data.id); setLastBookingSummary(res.data); setMsg(`Booking #${res.data.id} confirmed!`); await loadSeats(selTrip.id, selTrip.from_order, selTrip.to_order); }
    catch (e) { setErr(e?.response?.data?.detail || "Booking failed."); } finally { setBookingBusy(false); }
  };

  const pay = async method => {
    if (!lastBookingId) { setErr("Create a booking first."); return; }
    setPaymentBusy(true); setErr(""); setMsg("");
    try { const res = await api.post("/api/payments/create/", { booking_id: lastBookingId, method }); const { redirect, payment } = res.data; if (redirect?.type === "REDIRECT" && redirect.url) { window.location.href = redirect.url; return; } if (redirect?.type === "FORM_POST" && redirect.url) { buildFormPost(redirect); return; } setMsg(`Payment ${payment?.status || "PENDING"}.`); }
    catch (e) { setErr(e?.response?.data?.detail || "Payment failed."); } finally { setPaymentBusy(false); }
  };

  const saveProfile = async () => {
    setProfileBusy(true); setErr(""); setMsg("");
    try { const res = await api.patch("/api/auth/me/", profileForm); setUser(res.data); setMsg("Profile updated."); }
    catch (e) { setErr(e?.response?.data?.email?.[0] || e?.response?.data?.full_name?.[0] || "Update failed."); } finally { setProfileBusy(false); }
  };

  const handleLogout = () => { clearToken(); setUser(null); navigate("/auth/login", { replace: true }); };

  if (loading) return <div className={`min-h-[100dvh] flex items-center justify-center ${t.page}`}><div className="text-center"><div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mx-auto" /><p className={`mt-4 text-sm ${t.textSub}`}>Loading your dashboard…</p></div></div>;

  const rowBg = isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50";

  return (
    <div className={`h-[100dvh] flex flex-col overflow-hidden font-sans transition-colors duration-200 ${t.page}`}>
      {/* Floating Header on mobile, Standard on desktop */}
      <header className={`flex-none z-30 border-b backdrop-blur-md px-4 py-3 xl:static absolute top-0 w-full left-0 ${t.nav} ${isDark ? "bg-[#0a0e1a]/80" : "bg-[#f0f4f8]/80"}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex xl:h-9 xl:w-9 h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 xl:text-sm text-xs font-black text-white shadow-lg">MB</div>
            <div className="hidden sm:block"><p className={`text-[10px] font-bold uppercase tracking-widest ${t.label}`}>MetroBus</p><p className={`text-sm font-bold leading-none drop-shadow-md ${t.text}`}>Hello, {user?.full_name?.split(" ")[0] || "Passenger"} 👋</p></div>
          </div>
          <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 backdrop-blur-md rounded-xl p-1 shadow-sm"><ThemeToggle isDark={isDark} toggle={toggle} /><Btn tone="primary" onClick={handleLogout} className="!py-1.5 !px-3 text-xs shadow-md">Logout</Btn></div>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col relative w-full overflow-hidden mx-auto xl:max-w-6xl">
        {err && <div className={`absolute top-20 left-4 right-4 z-[50] rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur-md ${t.errBanner}`}>{err}</div>}
        {msg && <div className={`absolute top-20 left-4 right-4 z-[50] rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur-md ${t.okBanner}`}>✓ {msg}</div>}

        {/* HOME */}
        {activeView === "home" && (
          <div className="flex-1 flex flex-col xl:grid xl:grid-cols-[1.4fr_0.95fr] xl:gap-5 xl:py-5 min-h-0 w-full relative">
            {/* Map Area (Full top or responsive desktop) */}
            <div className={`flex-none w-full relative z-0 transition-all duration-300 xl:rounded-2xl xl:border xl:overflow-hidden ${settings.compactMap ? "h-[35dvh] xl:h-[60vh]" : "h-[48dvh] xl:h-auto xl:min-h-[550px]"} ${isDark ? "xl:border-white/10 bg-[#0a0e1a]" : "xl:border-slate-200 bg-[#f0f4f8]"}`}>
              <div className="h-full w-full">
                <MapContainer center={[28.2096, 83.9856]} zoom={13} scrollWheelZoom={false} className="h-full w-full z-0">
                  <TileLayer attribution="&copy; OpenStreetMap &copy; CARTO" url={t.mapTile} />
                  <MapViewport points={mapPoints} />
                  {dispPoly.length > 0 && <Polyline positions={dispPoly} pathOptions={{ color: "#818cf8", weight: 4, opacity: 0.9 }} />}
                  {stops.map(stop => {
                    const pt = toPoint(stop.lat, stop.lng); if (!pt) return null;
                    const isP = String(stop.id) === String(pickupStopId); const isD = String(stop.id) === String(dropStopId);
                    return <CircleMarker key={stop.id} center={pt} radius={isP || isD ? 9 : 5} eventHandlers={{ click: () => handleMapPick(stop.id) }} pathOptions={{ color: isP ? "#10b981" : isD ? "#818cf8" : "#475569", fillColor: isP ? "#10b981" : isD ? "#818cf8" : "#64748b", fillOpacity: 0.95 }}><Popup><div className="font-bold">{stop.name}</div><div className="text-xs text-slate-500">Tap to use as {selectionMode === "drop" ? "drop" : !pickupStopId ? "pickup" : "next"}</div></Popup></CircleMarker>;
                  })}
                  {matchedTrips.map(trip => {
                    let pt = toLocPoint(trip.latest_location); if (!pt) return null;
                    let angle = Number(trip.latest_location?.heading || 0);
                    if (dispPoly.length > 1) { const snap = snapPolylineWithAngle(pt, dispPoly); pt = snap.pt; angle = snap.angle; }
                    const active = String(trip.id) === String(selectedTripId);
                    return <Marker key={trip.id} position={pt} icon={createBusIcon({ active, heading: angle, label: trip.bus_plate || `Bus ${trip.id}` })} eventHandlers={{ click: () => setSelectedTripId(String(trip.id)) }}>{active && <Tooltip direction="top" offset={[0, -24]} opacity={1} permanent>{trip.bus_plate}</Tooltip>}<Popup><div className="font-bold">Bus {trip.bus_plate}</div><div>ETA {fmtEta(trip.eta)}</div><div>Open {trip.open_seats} seats</div></Popup></Marker>;
                  })}
                </MapContainer>
              </div>
            </div>

            {/* Booking panel (Bottom Sheet on Mobile) */}
            <div className={`flex-1 overflow-y-auto w-full z-20 rounded-t-3xl xl:rounded-none -mt-6 xl:mt-0 shadow-[0_-12px_40px_rgba(0,0,0,0.15)] xl:shadow-none px-4 pt-4 pb-28 xl:p-0 xl:pb-0 ${isDark ? "bg-[#0a0e1a] border-t border-white/10 xl:border-none" : "bg-[#f0f4f8] xl:bg-transparent"}`}>
              {/* Mobile pull handle aesthetic */}
              <div className="mx-auto w-12 h-1.5 rounded-full bg-slate-300 dark:bg-white/20 mb-5 xl:hidden" />
              <div className="space-y-4 max-w-xl mx-auto xl:max-w-none">
              {/* Step breadcrumbs */}
              <div className="flex gap-2 flex-wrap">
                {[{ id: "plan", label: "1. Plan" }, { id: "buses", label: "2. Choose Bus" }, { id: "seats", label: "3. Seat & Pay" }].map(s => (
                  <span key={s.id} className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${step === s.id ? "bg-indigo-600 text-white" : isDark ? "bg-white/5 text-slate-500" : "bg-slate-100 text-slate-400"}`}>{s.label}</span>
                ))}
              </div>

              {/* Plan step */}
              {step === "plan" && (
                <GlassCard t={t}>
                  <SLabel t={t}>Plan Your Ride</SLabel>
                  <div className="space-y-3">
                    <StopSearch label="Pickup Point" value={pickupStopId} onChange={v => { setPickupStopId(v); setSelSrc(c => ({ ...c, pickup: "dropdown" })); }} stops={stops} active={selectionMode === "pickup"} pickedFromMap={selSrc.pickup === "map"} onMapSelect={() => setSelectionMode("pickup")} t={t} isDark={isDark} />
                    <StopSearch label="Drop Point" value={dropStopId} onChange={v => { setDropStopId(v); setSelSrc(c => ({ ...c, drop: "dropdown" })); }} stops={stops} active={selectionMode === "drop"} pickedFromMap={selSrc.drop === "map"} onMapSelect={() => setSelectionMode("drop")} t={t} isDark={isDark} />
                    <Btn tone="primary" onClick={() => findRoutes()} disabled={findingRoutes} className="w-full !py-4">{findingRoutes ? "Finding buses…" : "🔍 Find Available Buses"}</Btn>
                  </div>
                </GlassCard>
              )}

              {/* Buses step */}
              {step === "buses" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between"><SLabel t={t}>{matchedTrips.length} Bus{matchedTrips.length !== 1 ? "es" : ""} Available</SLabel><button type="button" onClick={() => setStep("plan")} className={`text-xs hover:underline ${t.textSub}`}>← Edit route</button></div>
                  {matchedTrips.map(trip => {
                    const active = String(trip.id) === String(selectedTripId);
                    return (
                      <button key={trip.id} type="button" onClick={() => selectBus(trip.id)}
                        className={`w-full rounded-2xl border text-left p-4 transition-all ${active ? "border-indigo-500 bg-indigo-500/10" : isDark ? "border-white/10 bg-white/5 hover:border-white/20" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                        <div className="flex items-start justify-between gap-3"><div><p className={`text-sm font-bold ${t.text}`}>Bus {trip.bus_plate}</p><p className={`text-xs mt-0.5 ${t.textSub}`}>{trip.route_name}</p></div><Pill color="sky" isDark={isDark}>ETA {fmtEta(trip.eta)}</Pill></div>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {[{ label: "Occupancy", v: `${trip.occupancy_percent}%` }, { label: "Status", v: trip.occupancy_label }, { label: "Open Seats", v: trip.open_seats }].map(cell => (
                            <div key={cell.label} className={`rounded-xl border px-3 py-2 text-center ${rowBg}`}><p className={`text-[10px] uppercase tracking-widest ${t.label}`}>{cell.label}</p><p className={`text-sm font-bold mt-0.5 ${t.text}`}>{cell.v}</p></div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Seats step */}
              {step === "seats" && selTrip && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between"><div><SLabel t={t}>Bus {selTrip.bus_plate}</SLabel><p className={`text-xs -mt-2 ${t.textSub}`}>{pickupStop?.name} → {dropStop?.name}</p></div><button type="button" onClick={() => setStep("buses")} className={`text-xs hover:underline ${t.textSub}`}>← Change</button></div>
                  <GlassCard t={t}>
                    <SLabel t={t}>Choose Seats</SLabel>
                    {seats.length === 0 ? <p className={`text-sm py-2 ${t.textSub}`}>{loadingSeats ? "Loading seat map…" : "No seat map available."}</p>
                      : <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">{seats.map(s => <SeatBtn key={s.seat_id} seat={s} selected={selectedSeatIds.includes(s.seat_id)} onClick={() => toggleSeat(s.seat_id)} t={t} />)}</div>}
                    {selLabels.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{selLabels.map(l => <span key={l} className={`rounded-full border px-2.5 py-0.5 text-xs ${pillColor(isDark, "indigo")}`}>{l}</span>)}</div>}
                  </GlassCard>
                  <GlassCard t={t} className={`bg-gradient-to-br ${isDark ? "from-indigo-900/40 to-transparent" : "from-indigo-50 to-transparent"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div><SLabel t={t}>Booking Summary</SLabel><p className={`text-sm -mt-2 ${t.text}`}>{pickupStop?.name} → {dropStop?.name}</p><p className={`text-xs mt-1 ${t.textSub}`}>{selLabels.length} seat{selLabels.length !== 1 ? "s" : ""}</p></div>
                      <p className={`text-2xl font-black ${t.text}`}>{fmtMoney(lastBookingSummary?.fare_total || estFare)}</p>
                    </div>
                    <Btn tone="primary" onClick={bookSeats} disabled={bookingBusy || !selectedSeatIds.length} className="mt-4 w-full !py-3.5">{bookingBusy ? "Confirming…" : "Confirm Booking"}</Btn>
                  </GlassCard>
                  {lastBookingId && (
                    <GlassCard t={t}>
                      <SLabel t={t}>Payment Method</SLabel>
                      <div className="grid grid-cols-2 gap-3">
                        {[{ label: "💵 Cash", method: "CASH", tone: "ghost" }, { label: "🔗 Mock Online", method: "MOCK_ONLINE", tone: "success" }, { label: "💚 eSewa", method: "ESEWA", tone: "success" }, { label: "💜 Khalti", method: "KHALTI", tone: "primary" }].map(p => (
                          <Btn key={p.method} tone={p.tone} onClick={() => pay(p.method)} disabled={paymentBusy} className="!py-3 w-full text-sm">{paymentBusy ? "…" : p.label}</Btn>
                        ))}
                      </div>
                    </GlassCard>
                  )}
                </div>
              )}
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {activeView === "settings" && (
          <div className="flex-1 overflow-y-auto w-full px-4 pt-20 pb-32 xl:pt-5 xl:px-0">
            <GlassCard t={t} className="max-w-2xl mx-auto">
              <SLabel t={t}>Passenger Preferences</SLabel>
              <p className={`text-xs mb-5 ${t.textSub}`}>Stored on this device.</p>
              <div className="space-y-4">
                {[{ key: "liveTracking", title: "Live Bus Tracking", desc: "Show live bus movement on the map." }, { key: "arrivalAlerts", title: "Arrival Alerts", desc: "Show ETA when bus approach." }, { key: "compactMap", title: "Compact Map", desc: "Reduce map height." }].map(item => (
                  <div key={item.key} className={`flex items-center justify-between gap-4 border-b pb-4 last:border-0 last:pb-0 ${t.divider}`}>
                    <div><p className={`text-sm font-semibold ${t.text}`}>{item.title}</p><p className={`text-xs mt-0.5 ${t.textSub}`}>{item.desc}</p></div>
                    <button type="button" onClick={() => setSettings(c => ({ ...c, [item.key]: !c[item.key] }))}
                      className={`relative h-6 w-11 rounded-full flex-shrink-0 transition-colors ${settings[item.key] ? "bg-indigo-500" : t.toggleOff}`}>
                      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${settings[item.key] ? "translate-x-5" : ""}`} />
                    </button>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        )}

        {/* PROFILE */}
        {activeView === "profile" && (
          <div className="flex-1 overflow-y-auto w-full px-4 pt-20 pb-32 xl:pt-5 xl:px-0">
            <GlassCard t={t} className="max-w-2xl mx-auto">
              <SLabel t={t}>Your Profile</SLabel>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${t.label}`}>Full Name</label><input type="text" value={profileForm.full_name} onChange={e => setProfileForm(c => ({ ...c, full_name: e.target.value }))} className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-indigo-500 ${t.input}`} /></div>
              <div><label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${t.label}`}>Phone (read-only)</label><input type="text" value={user?.phone || ""} readOnly className={`w-full rounded-xl border px-4 py-3 text-sm outline-none opacity-50 ${t.input}`} /></div>
              <div className="sm:col-span-2"><label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${t.label}`}>Email</label><input type="email" value={profileForm.email} onChange={e => setProfileForm(c => ({ ...c, email: e.target.value }))} className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-indigo-500 ${t.input}`} /></div>
            </div>
            <Btn tone="primary" onClick={saveProfile} disabled={profileBusy} className="mt-5 !py-3 w-full">{profileBusy ? "Saving…" : "Save Profile"}</Btn>
            </GlassCard>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className={`fixed bottom-4 left-1/2 z-[1200] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl border p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.15)] backdrop-blur-md ${isDark ? "bg-[#0a0e1a]/90 border-white/10" : "bg-[#f0f4f8]/90 border-slate-200"}`}>
        <div className="flex gap-1.5">
          {PAX_TABS.map(tab => (
            <button key={tab.id} type="button" onClick={() => setActiveView(tab.id)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2.5 transition-all ${activeView === tab.id ? "bg-indigo-600 text-white" : t.tabInactive}`}>
              <span className="text-lg">{tab.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-wide">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
