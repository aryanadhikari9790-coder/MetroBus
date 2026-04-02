import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { api } from "../../api";
import { useAuth } from "../../AuthContext";
import { clearToken } from "../../auth";
import { snapRouteToRoad } from "../../lib/mapRoute";
import { useTheme } from "../../ThemeContext";
import { themeTokens, pillColor } from "../../lib/theme";

function GlassCard({ children, className = "", t }) { return <div className={`rounded-2xl border backdrop-blur-sm p-5 ${t.card} ${className}`}>{children}</div>; }
function Pill({ children, color = "slate", isDark }) { return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${pillColor(isDark, color)}`}>{children}</span>; }
function Btn({ children, onClick, disabled, tone = "primary", className = "" }) {
  const m = { primary: "bg-indigo-600 hover:bg-indigo-500 text-white", success: "bg-emerald-600 hover:bg-emerald-500 text-white", danger: "bg-red-600 hover:bg-red-500 text-white", ghost: "bg-white/10 hover:bg-white/20 text-white border border-white/10" };
  return <button type="button" onClick={onClick} disabled={disabled} className={`rounded-xl px-5 py-3 text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${m[tone]} ${className}`}>{children}</button>;
}
function SLabel({ children, t }) { return <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-3 ${t.label}`}>{children}</p>; }
function ThemeToggle({ isDark, toggle }) { return <button type="button" onClick={toggle} style={{ color: "var(--text)", borderColor: "var(--border)", background: "var(--surface)" }} className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition hover:opacity-80">{isDark ? "â˜€ Light" : "ðŸŒ™ Dark"}</button>; }
function StatCard({ label, value, sub, accent = "", t }) {
  return <GlassCard t={t}><p className={`text-[10px] uppercase tracking-widest ${t.label}`}>{label}</p><p className={`text-3xl font-black mt-2 leading-none ${accent || t.text}`}>{value}</p>{sub && <p className={`text-xs mt-1.5 ${t.textSub}`}>{sub}</p>}</GlassCard>;
}
function InputField({ label, value, onChange, placeholder, type = "text", t }) {
  return <div><label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${t.label}`}>{label}</label><input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-indigo-500 transition ${t.input}`} /></div>;
}
function FileField({ label, onChange, file, accept = "image/*", t }) {
  return (
    <div>
      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${t.label}`}>{label}</label>
      <label className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${t.input}`}>
        <span className={file ? "font-semibold" : ""}>{file?.name || "Choose file"}</span>
        <span className="text-xs font-bold uppercase tracking-widest text-indigo-500">Upload</span>
        <input type="file" accept={accept} onChange={e => onChange(e.target.files?.[0] || null)} className="hidden" />
      </label>
    </div>
  );
}
function SelectField({ label, value, onChange, options, t }) {
  return <div><label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${t.label}`}>{label}</label><select value={value} onChange={e => onChange(e.target.value)} className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-indigo-500 transition ${t.input}`} style={{ backgroundColor: "var(--select-bg)", color: "var(--input-text)" }}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>;
}
function MapViewport({ points }) {
  const map = useMap();
  useEffect(() => { if (!points.length) return; if (points.length === 1) { map.setView(points[0], 14); return; } map.fitBounds(points, { padding: [32, 32] }); }, [map, points]);
  return null;
}
function fmt(v) { if (!v) return "â€”"; try { return new Date(v).toLocaleString(); } catch { return v; } }
function fmtMoney(v) { return `NPR ${Number(v || 0).toLocaleString()}`; }

const EMPTY_OBJ = {};
const TABS = [{ id: "overview", label: "Overview", icon: "â—ˆ" }, { id: "routes", label: "Routes", icon: "âŠ•" }, { id: "schedules", label: "Schedules", icon: "â°" }, { id: "activity", label: "Activity", icon: "âš¡" }, { id: "manage", label: "Manage", icon: "ðŸ› " }];

export default function AdminHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark, toggle } = useTheme();
  const t = themeTokens(isDark);
  const [activeTab, setActiveTab] = useState("overview");

  const [dashboard, setDashboard]           = useState(null);
  const [loading, setLoading]               = useState(true);
  const [err, setErr]                       = useState("");
  const [builderStops, setBuilderStops]     = useState([]);
  const [recentRoutes, setRecentRoutes]     = useState([]);
  const [routeBusy, setRouteBusy]           = useState(false);
  const [routeMsg, setRouteMsg]             = useState("");
  const [scheduleMsg, setScheduleMsg]       = useState("");
  const [routeName, setRouteName]           = useState("");
  const [routeCity, setRouteCity]           = useState("Pokhara");
  const [routeActive, setRouteActive]       = useState(true);
  const [selectedStopIds, setSelectedStopIds] = useState([]);
  const [segmentFares, setSegmentFares]     = useState([]);
  const [roadPolyline, setRoadPolyline]     = useState([]);
  const [scheduleBusy, setScheduleBusy]     = useState(false);
  const [schedOpts, setSchedOpts]           = useState({ routes: [], buses: [], drivers: [], helpers: [], recent_schedules: [] });
  const [sRouteId, setSRouteId]             = useState("");
  const [sBusId, setSBusId]                 = useState("");
  const [sDriverId, setSDriverId]           = useState("");
  const [sHelperId, setSHelperId]           = useState("");
  const [sStartTime, setSStartTime]         = useState("");
  // Management
  const [busList, setBusList]               = useState([]);
  const [userList, setUserList]             = useState([]);
  const [busName, setBusName]               = useState("");
  const [busPlate, setBusPlate]             = useState("");
  const [busYear, setBusYear]               = useState("");
  const [busCondition, setBusCondition]     = useState("NORMAL");
  const [busRows, setBusRows]               = useState("9");
  const [busCols, setBusCols]               = useState("4");
  const [busActive, setBusActive]           = useState(true);
  const [busExteriorPhoto, setBusExteriorPhoto] = useState(null);
  const [busInteriorPhoto, setBusInteriorPhoto] = useState(null);
  const [busSeatPhoto, setBusSeatPhoto]     = useState(null);
  const [busMgmtBusy, setBusMgmtBusy]       = useState(false);
  const [busMgmtMsg, setBusMgmtMsg]         = useState("");
  const [assignBusId, setAssignBusId]       = useState("");
  const [assignDriverId, setAssignDriverId] = useState("");
  const [assignHelperId, setAssignHelperId] = useState("");
  const [assignBusy, setAssignBusy]         = useState(false);
  const [assignMsg, setAssignMsg]           = useState("");
  const [uName, setUName]                   = useState("");
  const [uPhone, setUPhone]                 = useState("");
  const [uEmail, setUEmail]                 = useState("");
  const [uAddress, setUAddress]             = useState("");
  const [uPass, setUPass]                   = useState("");
  const [uOfficialPhoto, setUOfficialPhoto] = useState(null);
  const [uLicenseNumber, setULicenseNumber] = useState("");
  const [uLicensePhoto, setULicensePhoto]   = useState(null);
  const [uRole, setURole]                   = useState("DRIVER");
  const [uMgmtBusy, setUMgmtBusy]           = useState(false);
  const [uMgmtMsg, setUMgmtMsg]             = useState("");

  const loadDB     = async ({ silent = false } = {}) => { if (!silent) setLoading(true); try { const r = await api.get("/api/auth/admin/dashboard/"); setDashboard(r.data); setErr(""); } catch (e) { setErr(e?.response?.data?.detail || "Failed to load dashboard."); } finally { if (!silent) setLoading(false); } };
  const loadRoute  = async () => { try { const r = await api.get("/api/transport/admin/route-builder/"); setBuilderStops(r.data.stops || []); setRecentRoutes(r.data.recent_routes || []); } catch (e) { setErr(p => p || e?.response?.data?.detail || "Failed to load routes."); } };
  const loadSched  = async () => { try { const r = await api.get("/api/trips/admin/schedules/"); setSchedOpts({ routes: r.data.routes || [], buses: r.data.buses || [], drivers: r.data.drivers || [], helpers: r.data.helpers || [], recent_schedules: r.data.recent_schedules || [] }); } catch (e) { setErr(p => p || e?.response?.data?.detail || "Failed to load schedules."); } };
  const loadBuses  = async () => { try { const r = await api.get("/api/transport/admin/buses/"); setBusList(r.data.buses || []); } catch { /* silent */ } };
  const loadUsers  = async (role) => { try { const r = await api.get(`/api/auth/admin/users/${role ? `?role=${role}` : ""}`); setUserList(r.data.users || []); } catch { /* silent */ } };

  useEffect(() => { loadDB(); loadRoute(); loadSched(); loadBuses(); loadUsers(); const id = setInterval(() => loadDB({ silent: true }), 10000); return () => clearInterval(id); }, []);
  useEffect(() => { setSegmentFares(c => Array.from({ length: Math.max(selectedStopIds.length - 1, 0) }, (_, i) => c[i] || "")); }, [selectedStopIds]);
  useEffect(() => {
    if (!sRouteId && schedOpts.routes.length) setSRouteId(String(schedOpts.routes[0].id));
    if (!sBusId && schedOpts.buses.length) setSBusId(String(schedOpts.buses[0].id));
    if (!sDriverId && schedOpts.drivers.length) setSDriverId(String(schedOpts.drivers[0].id));
    if (!sHelperId && schedOpts.helpers.length) setSHelperId(String(schedOpts.helpers[0].id));
    if (!sStartTime) { const d = new Date(Date.now() + 15 * 60000); setSStartTime(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)); }
  }, [sBusId, sDriverId, sHelperId, sRouteId, sStartTime, schedOpts]);

  const handleLogout = () => { clearToken(); navigate("/auth/login"); };

  const overview = dashboard?.overview; const roleCounts = overview?.role_counts || EMPTY_OBJ; const trips = overview?.trips || EMPTY_OBJ; const bookings = overview?.bookings || EMPTY_OBJ; const payments = overview?.payments || EMPTY_OBJ;
  const paymentRows = useMemo(() => Object.entries(payments?.methods || {}).map(([method, stats]) => ({ method, total: stats.total || 0, success: stats.success || 0, rate: stats.total ? Math.round((stats.success / stats.total) * 100) : 0 })), [payments]);
  const selectedStops = useMemo(() => selectedStopIds.map(id => builderStops.find(s => s.id === id)).filter(Boolean), [builderStops, selectedStopIds]);
  const selPts = useMemo(() => selectedStops.map(s => [Number(s.lat), Number(s.lng)]).filter(([la, lo]) => isFinite(la) && isFinite(lo)), [selectedStops]);
  const dispPts = roadPolyline.length > 1 ? roadPolyline : selPts;
  const mapPts  = useMemo(() => dispPts.length > 0 ? dispPts : builderStops.map(s => [Number(s.lat), Number(s.lng)]).filter(([la, lo]) => isFinite(la) && isFinite(lo)).slice(0, 12), [builderStops, dispPts]);
  const busCapacityPreview = useMemo(() => {
    const rows = parseInt(busRows, 10);
    const cols = parseInt(busCols, 10);
    if (isNaN(rows) || isNaN(cols) || rows < 1 || cols < 1) return 0;
    return rows * cols;
  }, [busCols, busRows]);

  useEffect(() => { if (selPts.length < 2) { setRoadPolyline([]); return; } const c = new AbortController(); snapRouteToRoad(selPts, c.signal).then(p => setRoadPolyline(p.length > 1 ? p : [])).catch(e => { if (e.name !== "AbortError") setRoadPolyline([]); }); return () => c.abort(); }, [selPts]);

  const toggleStop = id => setSelectedStopIds(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]);
  const moveStop = (i, dir) => setSelectedStopIds(c => { const ti = i + dir; if (ti < 0 || ti >= c.length) return c; const n = [...c]; [n[i], n[ti]] = [n[ti], n[i]]; return n; });
  const clearRoute  = () => { setRouteName(""); setRouteCity("Pokhara"); setRouteActive(true); setSelectedStopIds([]); setSegmentFares([]); setRouteMsg(""); };

  const createRoute = async () => {
    if (!routeName.trim()) { setErr("Enter a route name."); return; } if (selectedStopIds.length < 2) { setErr("Select at least two stops."); return; } if (segmentFares.some(f => f === "" || Number(f) < 0)) { setErr("Fill every segment fare."); return; }
    setRouteBusy(true); setErr(""); setRouteMsg("");
    try { const r = await api.post("/api/transport/admin/route-builder/", { name: routeName.trim(), city: routeCity.trim() || "Pokhara", is_active: routeActive, stop_ids: selectedStopIds, segment_fares: segmentFares.map(Number) }); setRouteMsg(r.data.message || "Route created."); clearRoute(); await Promise.all([loadDB({ silent: true }), loadRoute()]); }
    catch (e) { setErr(e?.response?.data?.detail || "Failed to create route."); } finally { setRouteBusy(false); }
  };

  const createSchedule = async () => {
    if (!(sRouteId && sBusId && sDriverId && sHelperId && sStartTime)) { setErr("Fill all schedule fields."); return; }
    setScheduleBusy(true); setErr(""); setScheduleMsg("");
    try { const r = await api.post("/api/trips/admin/schedules/", { route_id: +sRouteId, bus_id: +sBusId, driver_id: +sDriverId, helper_id: +sHelperId, scheduled_start_time: new Date(sStartTime).toISOString() }); setScheduleMsg(r.data.message || "Schedule created."); setSStartTime(""); await Promise.all([loadDB({ silent: true }), loadSched()]); }
    catch (e) { setErr(e?.response?.data?.detail || "Failed to create schedule."); } finally { setScheduleBusy(false); }
  };

  const createBus = async () => {
    if (!busPlate.trim()) { setErr("Enter a plate number."); return; }
    if (!busName.trim()) { setErr("Enter a bus name for identification."); return; }
    if (!busCapacityPreview || busCapacityPreview > 200) { setErr("Seat layout must resolve to 1-200 seats."); return; }
    setBusMgmtBusy(true); setErr(""); setBusMgmtMsg("");
    try {
      const formData = new FormData();
      formData.append("display_name", busName.trim());
      formData.append("plate_number", busPlate.trim());
      formData.append("layout_rows", busRows);
      formData.append("layout_columns", busCols);
      formData.append("capacity", String(busCapacityPreview));
      formData.append("condition", busCondition);
      formData.append("is_active", String(busActive));
      if (busYear.trim()) formData.append("model_year", busYear.trim());
      if (busExteriorPhoto) formData.append("exterior_photo", busExteriorPhoto);
      if (busInteriorPhoto) formData.append("interior_photo", busInteriorPhoto);
      if (busSeatPhoto) formData.append("seat_photo", busSeatPhoto);
      const r = await api.post("/api/transport/admin/buses/", formData);
      setBusMgmtMsg(r.data.message || "Bus created.");
      setBusName("");
      setBusPlate("");
      setBusYear("");
      setBusCondition("NORMAL");
      setBusRows("9");
      setBusCols("4");
      setBusActive(true);
      setBusExteriorPhoto(null);
      setBusInteriorPhoto(null);
      setBusSeatPhoto(null);
      await loadBuses();
    }
    catch (e) { setErr(e?.response?.data?.detail || "Failed to create bus."); } finally { setBusMgmtBusy(false); }
  };

  const assignStaffToBus = async () => {
    if (!assignBusId) { setErr("Select a bus to assign staff."); return; }
    setAssignBusy(true); setErr(""); setAssignMsg("");
    try {
      const r = await api.patch(`/api/transport/admin/buses/${assignBusId}/`, {
        driver: assignDriverId || "",
        helper: assignHelperId || ""
      });
      setAssignMsg(r.data.message || "Bus staff updated.");
      setAssignBusId(""); setAssignDriverId(""); setAssignHelperId("");
      await loadBuses();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to update bus staff.");
    } finally {
      setAssignBusy(false);
    }
  };

  const createUser = async () => {
    if (!uName.trim() || !uPhone.trim() || !uPass.trim()) { setErr("Name, phone, and password are required."); return; }
    if ((uRole === "DRIVER" || uRole === "HELPER") && !uAddress.trim()) { setErr("Address is required for staff accounts."); return; }
    if ((uRole === "DRIVER" || uRole === "HELPER") && !uOfficialPhoto) { setErr("An official photo is required for staff accounts."); return; }
    if (uRole === "DRIVER" && (!uLicenseNumber.trim() || !uLicensePhoto)) { setErr("Driver license number and license photo are required."); return; }
    setUMgmtBusy(true); setErr(""); setUMgmtMsg("");
    try {
      const formData = new FormData();
      formData.append("full_name", uName.trim());
      formData.append("phone", uPhone.trim());
      formData.append("password", uPass);
      formData.append("role", uRole);
      if (uEmail.trim()) formData.append("email", uEmail.trim());
      if (uAddress.trim()) formData.append("address", uAddress.trim());
      if (uOfficialPhoto) formData.append("official_photo", uOfficialPhoto);
      if (uRole === "DRIVER" && uLicenseNumber.trim()) formData.append("license_number", uLicenseNumber.trim());
      if (uRole === "DRIVER" && uLicensePhoto) formData.append("license_photo", uLicensePhoto);
      const r = await api.post("/api/auth/admin/users/", formData);
      setUMgmtMsg(r.data.message || "User created.");
      setUName("");
      setUPhone("");
      setUEmail("");
      setUAddress("");
      setUPass("");
      setUOfficialPhoto(null);
      setULicenseNumber("");
      setULicensePhoto(null);
      await loadUsers();
      await loadSched();
    }
    catch (e) { const d = e?.response?.data; setErr(d?.phone?.[0] || d?.email?.[0] || d?.detail || "Failed to create user."); } finally { setUMgmtBusy(false); }
  };

  if (loading) return <div className={`min-h-screen flex items-center justify-center ${t.page}`}><div className="text-center"><div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mx-auto" /><p className={`mt-4 text-sm ${t.textSub}`}>Loading admin dashboardâ€¦</p></div></div>;

  const rowBg = isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-200";

  return (
    <div className={`min-h-screen font-sans transition-colors duration-200 ${t.page}`}>
      <header className={`sticky top-0 z-30 border-b backdrop-blur-md px-4 py-3 ${t.nav}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-sm font-black text-white">MB</div>
            <div><p className={`text-[10px] font-bold uppercase tracking-widest ${t.label}`}>MetroBus Admin</p><p className={`text-sm font-bold leading-none ${t.text}`}>{user?.full_name || "Admin"}</p></div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Pill color="emerald" isDark={isDark}>{trips.live || 0} live</Pill>
            <Pill color="amber" isDark={isDark}>{payments.pending || 0} pending</Pill>
            <ThemeToggle isDark={isDark} toggle={toggle} />
            <Btn tone="ghost" onClick={() => { loadDB(); loadRoute(); }} className="!py-2 !px-3 text-xs">â†»</Btn>
            <Btn tone="danger" onClick={handleLogout} className="!py-2 !px-3 text-xs">Logout</Btn>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5">
        {err && <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${t.errBanner}`}>{err}</div>}
        {routeMsg && <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${t.okBanner}`}>âœ“ {routeMsg}</div>}
        {scheduleMsg && <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${t.infoBanner}`}>âœ“ {scheduleMsg}</div>}

        {/* Tabs */}
        <div className={`flex gap-1.5 rounded-2xl border p-1.5 mb-6 backdrop-blur ${t.tabBar}`}>
          {TABS.map(tab => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${activeTab === tab.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/50" : t.tabInactive}`}>
              <span>{tab.icon}</span><span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Total Users" value={overview?.users_total ?? 0} sub={`${roleCounts.PASSENGER || 0} passengers Â· ${roleCounts.DRIVER || 0} drivers`} accent="text-indigo-500" t={t} />
              <StatCard label="Live Trips" value={trips.live ?? 0} sub={`${trips.total || 0} total`} accent="text-emerald-500" t={t} />
              <StatCard label="Bookings" value={bookings.total ?? 0} sub={`${bookings.confirmed || 0} confirmed`} accent="text-amber-500" t={t} />
              <StatCard label="Revenue" value={fmtMoney(payments.revenue_success ?? 0)} sub={`${payments.success || 0} successful`} t={t} />
            </div>
            <GlassCard t={t}>
              <SLabel t={t}>Payment Method Performance</SLabel>
              <div className="space-y-3">
                {paymentRows.length === 0 && <p className={`text-sm ${t.textSub}`}>No payment data yet.</p>}
                {paymentRows.map(row => (
                  <div key={row.method} className="flex items-center gap-4">
                    <p className={`w-24 text-xs font-bold flex-shrink-0 ${t.text}`}>{row.method}</p>
                    <div className={`flex-1 h-2 rounded-full ${isDark ? "bg-white/10" : "bg-slate-200"}`}><div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${row.rate}%` }} /></div>
                    <div className="flex items-center gap-2 flex-shrink-0"><Pill color={row.rate >= 70 ? "emerald" : row.rate > 0 ? "amber" : "slate"} isDark={isDark}>{row.rate}%</Pill><span className={`text-xs ${t.textMuted}`}>{row.success}/{row.total}</span></div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[{ label: "Success", v: payments.success || 0, a: "text-emerald-500" }, { label: "Pending", v: payments.pending || 0, a: "text-amber-500" }, { label: "Failed", v: payments.failed || 0, a: "text-red-500" }].map(r => (
                  <div key={r.label} className={`rounded-xl border px-4 py-3 ${rowBg}`}><p className={`text-[10px] uppercase tracking-widest ${t.label}`}>{r.label}</p><p className={`text-2xl font-black mt-1 ${r.a}`}>{r.v}</p></div>
                ))}
              </div>
            </GlassCard>
          </div>
        )}

        {/* ROUTES */}
        {activeTab === "routes" && (
          <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
            <div className="space-y-4">
              <GlassCard t={t}>
                <SLabel t={t}>Route Builder</SLabel>
                <div className="space-y-3">
                  <InputField label="Route Name" value={routeName} onChange={setRouteName} placeholder="Lakeside to Prithvi Chowk" t={t} />
                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <InputField label="City" value={routeCity} onChange={setRouteCity} placeholder="Pokhara" t={t} />
                    <div><label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${t.label}`}>Active</label><button type="button" onClick={() => setRouteActive(v => !v)} className={`w-full rounded-xl px-4 py-3 text-sm font-bold transition ${routeActive ? "bg-emerald-600 text-white" : isDark ? "bg-white/10 text-slate-400" : "bg-slate-200 text-slate-600"}`}>{routeActive ? "YES" : "NO"}</button></div>
                  </div>
                </div>
              </GlassCard>
              <GlassCard t={t}>
                <div className="flex items-center justify-between mb-3"><SLabel t={t}>Selected Stops ({selectedStops.length})</SLabel><button type="button" onClick={clearRoute} className={`text-xs hover:text-red-400 transition ${t.textSub}`}>Clear all</button></div>
                {selectedStops.length === 0 ? <p className={`text-sm ${t.textSub}`}>Click map markers to add stops in order.</p>
                  : selectedStops.map((stop, i) => (
                    <div key={stop.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 mb-2 ${rowBg}`}>
                      <span className="text-xs text-indigo-500 font-bold w-5 flex-shrink-0">{i + 1}</span>
                      <span className={`text-sm flex-1 truncate ${t.text}`}>{stop.name}</span>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => moveStop(i, -1)} className={`rounded-lg px-2 py-1 text-xs transition ${isDark ? "bg-white/10 hover:bg-white/20" : "bg-slate-200 hover:bg-slate-300"} ${t.text}`}>â†‘</button>
                        <button type="button" onClick={() => moveStop(i, 1)} className={`rounded-lg px-2 py-1 text-xs transition ${isDark ? "bg-white/10 hover:bg-white/20" : "bg-slate-200 hover:bg-slate-300"} ${t.text}`}>â†“</button>
                        <button type="button" onClick={() => toggleStop(stop.id)} className="rounded-lg bg-red-500/20 px-2 py-1 text-xs text-red-400 hover:bg-red-500/30">âœ•</button>
                      </div>
                    </div>
                  ))}
              </GlassCard>
              {selectedStops.length >= 2 && (
                <GlassCard t={t}>
                  <SLabel t={t}>Segment Fares (NPR)</SLabel>
                  {selectedStops.slice(0, -1).map((stop, i) => (
                    <div key={`${stop.id}-fare`} className="mb-3"><label className={`block text-[10px] mb-1 ${t.textSub}`}>{stop.name} â†’ {selectedStops[i + 1].name}</label><input type="number" min="0" step="0.01" value={segmentFares[i] || ""} placeholder="Enter fare" onChange={e => { const n = [...segmentFares]; n[i] = e.target.value; setSegmentFares(n); }} className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:border-indigo-500 ${t.input}`} /></div>
                  ))}
                </GlassCard>
              )}
              <Btn tone="success" onClick={createRoute} disabled={routeBusy} className="w-full !py-4">{routeBusy ? "Creatingâ€¦" : "Create Route"}</Btn>
            </div>
            <div className="space-y-4">
              <GlassCard t={t} className="!p-0 overflow-hidden">
                <div className={`px-5 py-4 border-b ${t.divider}`}><SLabel t={t}>Stop Map â€” Click to add</SLabel><p className={`text-sm font-bold -mt-2 ${t.text}`}>{selectedStopIds.length} stops selected</p></div>
                <div className="h-80">
                  <MapContainer center={[28.2096, 83.9856]} zoom={12} scrollWheelZoom={false} className="h-full w-full">
                    <TileLayer attribution="&copy; OpenStreetMap &copy; CARTO" url={t.mapTile} />
                    <MapViewport points={mapPts} />
                    {dispPts.length > 1 && <Polyline positions={dispPts} pathOptions={{ color: "#818cf8", weight: 4, opacity: 0.9 }} />}
                    {builderStops.map(stop => {
                      const la = Number(stop.lat), lo = Number(stop.lng); if (!isFinite(la) || !isFinite(lo)) return null;
                      const oi = selectedStopIds.indexOf(stop.id), sel = oi !== -1;
                      return <CircleMarker key={stop.id} center={[la, lo]} radius={sel ? 9 : 6} eventHandlers={{ click: () => toggleStop(stop.id) }} pathOptions={{ color: sel ? "#818cf8" : "#475569", fillColor: sel ? "#818cf8" : "#64748b", fillOpacity: 0.95 }}><Popup><div className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>{stop.name}</div><div className="text-xs text-slate-500 mt-0.5">{sel ? `Stop ${oi + 1}` : "Click to add"}</div></Popup></CircleMarker>;
                    })}
                  </MapContainer>
                </div>
              </GlassCard>
              <GlassCard t={t}>
                <SLabel t={t}>Recent Routes</SLabel>
                {recentRoutes.length === 0 ? <p className={`text-sm ${t.textSub}`}>No routes yet.</p>
                  : recentRoutes.map(r => (
                    <div key={r.id} className={`flex items-center justify-between rounded-xl border px-4 py-3 mb-2 ${rowBg}`}>
                      <div><p className={`text-sm font-bold ${t.text}`}>{r.name}</p><p className={`text-xs mt-0.5 ${t.textSub}`}>{r.city} Â· {r.stops_count} stops</p></div>
                      <Pill color={r.is_active ? "emerald" : "slate"} isDark={isDark}>{r.is_active ? "ACTIVE" : "INACTIVE"}</Pill>
                    </div>
                  ))}
              </GlassCard>
            </div>
          </div>
        )}

        {/* SCHEDULES */}
        {activeTab === "schedules" && (
          <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
            <GlassCard t={t}>
              <SLabel t={t}>Create Trip Schedule</SLabel>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="Route" value={sRouteId} onChange={setSRouteId} t={t} options={schedOpts.routes.map(r => ({ value: r.id, label: r.name }))} />
                  <SelectField label="Bus" value={sBusId} onChange={setSBusId} t={t} options={schedOpts.buses.map(b => ({ value: b.id, label: `${b.plate_number} (${b.capacity})` }))} />
                  <SelectField label="Driver" value={sDriverId} onChange={setSDriverId} t={t} options={schedOpts.drivers.map(d => ({ value: d.id, label: d.full_name }))} />
                  <SelectField label="Helper" value={sHelperId} onChange={setSHelperId} t={t} options={schedOpts.helpers.map(h => ({ value: h.id, label: h.full_name }))} />
                </div>
                <InputField label="Scheduled Start Time" type="datetime-local" value={sStartTime} onChange={setSStartTime} t={t} />
                <div className={`rounded-xl border px-4 py-3 text-xs ${isDark ? "border-white/5 bg-white/5 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"}`}>Schedules appear on the driver's dashboard so they can start assigned trips without manual setup.</div>
                <Btn tone="primary" onClick={createSchedule} disabled={scheduleBusy} className="w-full !py-4">{scheduleBusy ? "Creatingâ€¦" : "Create Trip Schedule"}</Btn>
              </div>
            </GlassCard>
            <div className="space-y-3">
              <SLabel t={t}>Recent Schedules ({schedOpts.recent_schedules.length})</SLabel>
              {schedOpts.recent_schedules.length === 0 ? <GlassCard t={t}><p className={`text-sm ${t.textSub}`}>No schedules yet.</p></GlassCard>
                : schedOpts.recent_schedules.map(s => (
                  <GlassCard key={s.id} t={t} className="!p-4">
                    <div className="flex items-start justify-between gap-3"><div><p className={`text-sm font-bold ${t.text}`}>{s.route_name}</p><p className={`text-xs mt-0.5 ${t.textSub}`}>{s.bus_plate} Â· {s.driver_name || "â€”"} Â· {s.helper_name || "â€”"}</p></div><Pill color={s.status === "PLANNED" ? "amber" : s.status === "COMPLETED" ? "emerald" : "slate"} isDark={isDark}>{s.status}</Pill></div>
                    <p className={`mt-2 text-xs ${t.textMuted}`}>Starts {fmt(s.scheduled_start_time)}</p>
                  </GlassCard>
                ))}
            </div>
          </div>
        )}

        {/* ACTIVITY */}
        {activeTab === "activity" && (
          <div className="grid gap-5 xl:grid-cols-2">
            <div>
              <SLabel t={t}>Live Trips</SLabel>
              {dashboard?.live_trips?.length ? dashboard.live_trips.map(trip => (
                <GlassCard key={trip.id} t={t} className="!p-4 mb-3">
                  <div className="flex items-start justify-between"><div><p className={`text-sm font-bold ${t.text}`}>{trip.route_name}</p><p className={`text-xs mt-0.5 ${t.textSub}`}>Bus {trip.bus_plate} Â· {trip.driver_name} Â· {trip.helper_name}</p></div><Pill color={trip.deviation_mode ? "amber" : "emerald"} isDark={isDark}>{trip.deviation_mode ? "Deviation" : "Normal"}</Pill></div>
                  <div className="mt-3 grid grid-cols-2 gap-2"><div className={`rounded-xl px-3 py-2 text-xs ${t.textSub} ${rowBg}`}>Started {fmt(trip.started_at)}</div><div className={`rounded-xl px-3 py-2 text-xs truncate ${t.textSub} ${rowBg}`}>{trip.latest_location ? `GPS ${Number(trip.latest_location.lat).toFixed(4)}, ${Number(trip.latest_location.lng).toFixed(4)}` : "No GPS yet"}</div></div>
                </GlassCard>
              )) : <GlassCard t={t}><p className={`text-sm ${t.textSub}`}>No live trips right now.</p></GlassCard>}
            </div>
            <div>
              <SLabel t={t}>Recent Bookings</SLabel>
              {dashboard?.recent_bookings?.length ? dashboard.recent_bookings.map(b => (
                <GlassCard key={b.id} t={t} className="!p-4 mb-3">
                  <div className="flex items-start justify-between"><div><p className={`text-sm font-bold ${t.text}`}>Booking #{b.id}</p><p className={`text-xs mt-0.5 ${t.textSub}`}>{b.route_name} Â· {b.bus_plate}</p></div><Pill color={b.status === "CONFIRMED" ? "emerald" : b.status === "CANCELLED" ? "red" : "amber"} isDark={isDark}>{b.status}</Pill></div>
                  <div className="mt-2 grid grid-cols-2 gap-2"><div className={`rounded-xl px-3 py-2 text-xs ${t.textSub} ${rowBg}`}>{b.passenger_name}</div><div className={`rounded-xl px-3 py-2 text-xs ${t.textSub} ${rowBg}`}>{b.seats_count} seats Â· {fmtMoney(b.fare_total)}</div></div>
                </GlassCard>
              )) : <GlassCard t={t}><p className={`text-sm ${t.textSub}`}>No bookings yet.</p></GlassCard>}
            </div>
            <div>
              <SLabel t={t}>Recent Payments</SLabel>
              {dashboard?.recent_payments?.length ? dashboard.recent_payments.map(p => (
                <GlassCard key={p.id} t={t} className="!p-4 mb-3">
                  <div className="flex items-start justify-between"><div><p className={`text-sm font-bold ${t.text}`}>Payment #{p.id}</p><p className={`text-xs mt-0.5 ${t.textSub}`}>Booking #{p.booking_id} Â· {p.route_name}</p></div><Pill color={p.status === "SUCCESS" ? "emerald" : p.status === "FAILED" ? "red" : "amber"} isDark={isDark}>{p.status}</Pill></div>
                  <div className="mt-2 grid grid-cols-2 gap-2"><div className={`rounded-xl px-3 py-2 text-xs ${t.textSub} ${rowBg}`}>{p.method} Â· {fmtMoney(p.amount)}</div><div className={`rounded-xl px-3 py-2 text-xs ${t.textSub} ${rowBg}`}>{p.created_by_name}</div></div>
                </GlassCard>
              )) : <GlassCard t={t}><p className={`text-sm ${t.textSub}`}>No payments yet.</p></GlassCard>}
            </div>
            <div>
              <SLabel t={t}>Newest Users</SLabel>
              {dashboard?.recent_users?.length ? dashboard.recent_users.map(u => (
                <GlassCard key={u.id} t={t} className="!p-4 mb-3">
                  <div className="flex items-center justify-between"><div><p className={`text-sm font-bold ${t.text}`}>{u.full_name}</p><p className={`text-xs mt-0.5 ${t.textSub}`}>{u.phone}</p></div><Pill color="indigo" isDark={isDark}>{u.role}</Pill></div>
                  <p className={`mt-1 text-xs ${t.textMuted}`}>Joined {fmt(u.created_at)}</p>
                </GlassCard>
              )) : <GlassCard t={t}><p className={`text-sm ${t.textSub}`}>No users yet.</p></GlassCard>}
            </div>
          </div>
        )}

        {/* MANAGE */}
        {activeTab === "manage" && (
          <div className="grid gap-5 xl:grid-cols-2">
            {/* Add Bus */}
            <div className="space-y-4">
              <GlassCard t={t}>
                <SLabel t={t}>Add New Bus</SLabel>
                <p className={`text-xs mb-4 ${t.textSub}`}>Add the full bus profile, media, and seat layout used across the MetroBus system.</p>
                {busMgmtMsg && <div className={`mb-3 rounded-xl border px-4 py-3 text-sm ${t.okBanner}`}>OK: {busMgmtMsg}</div>}
                <div className="space-y-3">
                  <InputField label="Bus Name / Identifier" value={busName} onChange={setBusName} placeholder="MetroBus Lakeside Express" t={t} />
                  <InputField label="Plate Number" value={busPlate} onChange={setBusPlate} placeholder="BA 1 CHA 2233" t={t} />
                  <div className="grid grid-cols-2 gap-3">
                    <InputField label="Model Year" value={busYear} onChange={setBusYear} type="number" placeholder="2024" t={t} />
                    <SelectField label="Condition" value={busCondition} onChange={setBusCondition} t={t} options={[{ value: "NEW", label: "New" }, { value: "NORMAL", label: "Normal" }, { value: "OLD", label: "Old" }]} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <InputField label="Seat Rows" value={busRows} onChange={setBusRows} type="number" placeholder="9" t={t} />
                    <InputField label="Seat Columns" value={busCols} onChange={setBusCols} type="number" placeholder="4" t={t} />
                  </div>
                  <div className={`rounded-xl border px-4 py-3 text-sm ${rowBg}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${t.label}`}>Seat Capacity Preview</p>
                    <p className={`mt-2 text-2xl font-black ${t.text}`}>{busCapacityPreview || 0} seats</p>
                  </div>
                  <FileField label="Exterior Photo" file={busExteriorPhoto} onChange={setBusExteriorPhoto} t={t} />
                  <FileField label="Interior Photo" file={busInteriorPhoto} onChange={setBusInteriorPhoto} t={t} />
                  <FileField label="Seats Photo" file={busSeatPhoto} onChange={setBusSeatPhoto} t={t} />
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${t.label}`}>Status</label>
                    <button type="button" onClick={() => setBusActive(v => !v)} className={`w-full rounded-xl px-4 py-3 text-sm font-bold transition ${busActive ? "bg-emerald-600 text-white" : isDark ? "bg-white/10 text-slate-400" : "bg-slate-200 text-slate-600"}`}>
                      {busActive ? "Active" : "Inactive"}
                    </button>
                  </div>
                  <Btn tone="primary" onClick={createBus} disabled={busMgmtBusy} className="w-full !py-4">
                    {busMgmtBusy ? "Creating..." : "Add Bus"}
                  </Btn>
                </div>
              </GlassCard>

              <GlassCard t={t}>
                <SLabel t={t}>Assign Staff to Bus</SLabel>
                <p className={`text-xs mb-4 ${t.textSub}`}>Select an existing bus to map a driver and/or helper.</p>
                {assignMsg && <div className={`mb-3 rounded-xl border px-4 py-3 text-sm ${t.okBanner}`}>OK: {assignMsg}</div>}
                <div className="space-y-3">
                  <SelectField label="Select Bus" value={assignBusId} onChange={setAssignBusId} t={t} options={[{ value: "", label: "-- Select Bus --" }, ...busList.map(b => ({ value: b.id, label: `${b.display_name || b.plate_number} (${b.plate_number})` }))]} />
                  <SelectField label="Select Driver" value={assignDriverId} onChange={setAssignDriverId} t={t} options={[{ value: "", label: "None / Clear" }, ...userList.filter(u => u.role === "DRIVER").map(u => ({ value: u.id, label: u.full_name }))]} />
                  <SelectField label="Select Helper" value={assignHelperId} onChange={setAssignHelperId} t={t} options={[{ value: "", label: "None / Clear" }, ...userList.filter(u => u.role === "HELPER").map(u => ({ value: u.id, label: u.full_name }))]} />
                  <Btn tone="primary" onClick={assignStaffToBus} disabled={assignBusy} className="w-full !py-4">
                    {assignBusy ? "Updating..." : "Update Assignment"}
                  </Btn>
                </div>
              </GlassCard>

              <GlassCard t={t}>
                <SLabel t={t}>Existing Buses ({busList.length})</SLabel>
                <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
                  {busList.length === 0 && <p className={`text-sm ${t.textSub}`}>No buses registered yet.</p>}
                  {busList.map(bus => (
                    <div key={bus.id} className={`rounded-xl border px-4 py-4 ${rowBg}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`text-sm font-bold ${t.text}`}>{bus.display_name || bus.plate_number}</p>
                          <p className={`text-xs mt-0.5 ${t.textSub}`}>{bus.plate_number} · {bus.condition} · {bus.model_year || "Year N/A"}</p>
                          <p className={`text-xs mt-1 ${t.textSub}`}>{bus.capacity} seats · layout {bus.layout_rows}x{bus.layout_columns}</p>
                          <p className={`text-xs mt-1 ${t.textSub}`}>driver: {bus.driver_name || "—"} · helper: {bus.helper_name || "—"}</p>
                        </div>
                        <Pill color={bus.is_active ? "emerald" : "slate"} isDark={isDark}>{bus.is_active ? "ACTIVE" : "OFF"}</Pill>
                      </div>
                      {(bus.exterior_photo_url || bus.interior_photo_url || bus.seat_photo_url) ? (
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {[bus.exterior_photo_url, bus.interior_photo_url, bus.seat_photo_url].filter(Boolean).map((url, index) => (
                            <img key={`${bus.id}-${index}`} src={url} alt={`${bus.display_name || bus.plate_number} view ${index + 1}`} className="h-20 w-full rounded-xl object-cover" />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>

            {/* Add Staff User */}
            <div className="space-y-4">
              <GlassCard t={t}>
                <SLabel t={t}>Add Staff Account</SLabel>
                <p className={`text-xs mb-4 ${t.textSub}`}>Create fully documented driver, helper, or admin accounts. Passengers still self-register.</p>
                {uMgmtMsg && <div className={`mb-3 rounded-xl border px-4 py-3 text-sm ${t.okBanner}`}>OK: {uMgmtMsg}</div>}
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {["DRIVER", "HELPER", "ADMIN"].map(role => (
                      <button key={role} type="button" onClick={() => setURole(role)} className={`rounded-xl py-3 text-xs font-black uppercase tracking-widest transition ${uRole === role ? "bg-indigo-600 text-white" : isDark ? "bg-white/10 text-slate-400 hover:bg-white/20" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                        {role}
                      </button>
                    ))}
                  </div>
                  <InputField label="Full Name" value={uName} onChange={setUName} placeholder="Ramesh Kumar" t={t} />
                  <InputField label="Phone (login ID)" value={uPhone} onChange={setUPhone} placeholder="9800000000" t={t} />
                  <InputField label="Email (optional)" value={uEmail} onChange={setUEmail} placeholder="ramesh@example.com" t={t} />
                  <InputField label="Address" value={uAddress} onChange={setUAddress} placeholder="Pokhara-8, Nepal" t={t} />
                  <InputField label="Password" value={uPass} onChange={setUPass} placeholder="Min 6 characters" type="password" t={t} />
                  <FileField label="Official Staff Photo" file={uOfficialPhoto} onChange={setUOfficialPhoto} t={t} />
                  {uRole === "DRIVER" ? (
                    <>
                      <InputField label="License Number" value={uLicenseNumber} onChange={setULicenseNumber} placeholder="NP-DRV-009812" t={t} />
                      <FileField label="License Photo" file={uLicensePhoto} onChange={setULicensePhoto} t={t} />
                    </>
                  ) : null}
                  <Btn tone="success" onClick={createUser} disabled={uMgmtBusy} className="w-full !py-4">
                    {uMgmtBusy ? "Creating..." : `Add ${uRole.charAt(0) + uRole.slice(1).toLowerCase()}`}
                  </Btn>
                </div>
              </GlassCard>

              <GlassCard t={t}>
                <div className="flex items-center justify-between mb-3">
                  <SLabel t={t}>Staff Accounts ({userList.filter(u => u.role !== "PASSENGER").length})</SLabel>
                  <div className="flex gap-1">
                    {["ALL", "DRIVER", "HELPER", "ADMIN"].map(r => (
                      <button key={r} type="button" onClick={() => loadUsers(r === "ALL" ? null : r)} className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition ${isDark ? "bg-white/10 text-slate-400 hover:bg-white/20" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
                  {userList.length === 0 && <p className={`text-sm ${t.textSub}`}>No users loaded.</p>}
                  {userList.map(u => (
                    <div key={u.id} className={`rounded-xl border px-4 py-4 ${rowBg}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {u.official_photo_url ? <img src={u.official_photo_url} alt={u.full_name} className="h-14 w-14 rounded-2xl object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-sm font-black text-indigo-600">{u.full_name?.slice(0, 2).toUpperCase()}</div>}
                          <div className="min-w-0">
                            <p className={`text-sm font-bold ${t.text}`}>{u.full_name}</p>
                            <p className={`text-xs mt-0.5 ${t.textSub}`}>{u.phone}{u.email ? ` · ${u.email}` : ""}</p>
                            {u.address ? <p className={`text-xs mt-1 ${t.textSub}`}>{u.address}</p> : null}
                            {u.license_number ? <p className={`text-xs mt-1 ${t.textSub}`}>License: {u.license_number}</p> : null}
                          </div>
                        </div>
                        <Pill color={u.role === "ADMIN" ? "red" : u.role === "DRIVER" ? "sky" : u.role === "HELPER" ? "indigo" : "slate"} isDark={isDark}>{u.role}</Pill>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {u.official_photo_verified ? <Pill color="emerald" isDark={isDark}>Photo OK</Pill> : null}
                        {u.license_verified ? <Pill color="emerald" isDark={isDark}>License OK</Pill> : null}
                        {!u.is_active ? <Pill color="slate" isDark={isDark}>Inactive</Pill> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

