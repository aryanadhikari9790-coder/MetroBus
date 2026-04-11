import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { api } from "../../api";
import { useAuth } from "../../AuthContext";
import { clearToken } from "../../auth";
import { snapRouteToRoad } from "../../lib/mapRoute";
import { useTheme } from "../../ThemeContext";
import { themeTokens, pillColor } from "../../lib/theme";

function GlassCard({ children, className = "", t }) { return <div className={`rounded-xl border backdrop-blur-sm p-5 ${t.card} ${className}`}>{children}</div>; }
function Pill({ children, color = "slate", isDark }) { return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${pillColor(isDark, color)}`}>{children}</span>; }
function Btn({ children, onClick, disabled, tone = "primary", className = "" }) {
  const m = { primary: "bg-[linear-gradient(135deg,#ff6b73,#ff8a5b)] hover:opacity-95 text-white shadow-[0_12px_24px_rgba(255,107,115,0.16)]", success: "bg-emerald-600 hover:bg-emerald-500 text-white", danger: "bg-red-600 hover:bg-red-500 text-white", ghost: "bg-white/10 hover:bg-white/20 text-white border border-white/10" };
  return <button type="button" onClick={onClick} disabled={disabled} className={`rounded-lg px-5 py-3 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${m[tone]} ${className}`}>{children}</button>;
}
function SLabel({ children, t }) { return <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-3 ${t.label}`}>{children}</p>; }
function ThemeToggle({ isDark, toggle }) { return <button type="button" onClick={toggle} style={{ color: "var(--text)", borderColor: "var(--border)", background: "var(--surface)" }} className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition hover:opacity-80">{isDark ? "Light Mode" : "Dark Mode"}</button>; }
function StatCard({ label, value, sub, accent = "", t }) {
  return <GlassCard t={t}><p className={`text-[10px] uppercase tracking-widest ${t.label}`}>{label}</p><p className={`mt-2 break-words text-3xl font-black leading-tight ${accent || t.text}`}>{value}</p>{sub && <p className={`mt-1.5 break-words text-xs leading-5 ${t.textSub}`}>{sub}</p>}</GlassCard>;
}
function InputField({ label, value, onChange, placeholder, type = "text", t }) {
  return <div><label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${t.label}`}>{label}</label><input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-[#ff6b73] transition ${t.input}`} /></div>;
}
function FileField({ label, onChange, file, accept = "image/*", t }) {
  return (
    <div>
      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${t.label}`}>{label}</label>
      <label className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${t.input}`}>
        <span className={file ? "font-semibold" : ""}>{file?.name || "Choose file"}</span>
        <span className="text-xs font-bold uppercase tracking-widest text-[#ff6b73]">Upload</span>
        <input type="file" accept={accept} onChange={e => onChange(e.target.files?.[0] || null)} className="hidden" />
      </label>
    </div>
  );
}
function SelectField({ label, value, onChange, options, t }) {
  return <div><label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${t.label}`}>{label}</label><select value={value} onChange={e => onChange(e.target.value)} className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-[#ff6b73] transition ${t.input}`} style={{ backgroundColor: "var(--select-bg)", color: "var(--input-text)" }}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>;
}
function MapViewport({ points }) {
  const map = useMap();
  useEffect(() => { if (!points.length) return; if (points.length === 1) { map.setView(points[0], 14); return; } map.fitBounds(points, { padding: [32, 32] }); }, [map, points]);
  return null;
}
function StopMapPicker({ onPick }) {
  useMapEvents({
    click(event) {
      onPick?.(event.latlng);
    },
  });
  return null;
}
function fmt(v) { if (!v) return "--"; try { return new Date(v).toLocaleString(); } catch { return v; } }
function fmtMoney(v) { return `NPR ${Number(v || 0).toLocaleString()}`; }

const EMPTY_OBJ = {};
const ADMIN_SECTIONS = [
  { id: "analytics", label: "Analytics" },
  { id: "routes", label: "Routes" },
  { id: "buses", label: "Buses" },
  { id: "staff", label: "Staff" },
  { id: "assignments", label: "Assignments" },
];
const DEFAULT_ADMIN_SECTION = "analytics";

function toLocalDatetimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function AdminHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isDark, toggle } = useTheme();
  const t = themeTokens(isDark);

  const [dashboard, setDashboard]           = useState(null);
  const [loading, setLoading]               = useState(true);
  const [err, setErr]                       = useState("");
  const [builderStops, setBuilderStops]     = useState([]);
  const [recentStops, setRecentStops]       = useState([]);
  const [recentRoutes, setRecentRoutes]     = useState([]);
  const [routeBusy, setRouteBusy]           = useState(false);
  const [routeMsg, setRouteMsg]             = useState("");
  const [editingRouteId, setEditingRouteId] = useState(null);
  const [routeDeleteBusyId, setRouteDeleteBusyId] = useState(null);
  const [stopMsg, setStopMsg]               = useState("");
  const [scheduleMsg, setScheduleMsg]       = useState("");
  const [stopName, setStopName]             = useState("");
  const [stopLat, setStopLat]               = useState("");
  const [stopLng, setStopLng]               = useState("");
  const [stopActive, setStopActive]         = useState(true);
  const [stopBusy, setStopBusy]             = useState(false);
  const [routeName, setRouteName]           = useState("");
  const [routeCity, setRouteCity]           = useState("Pokhara");
  const [routeActive, setRouteActive]       = useState(true);
  const [selectedStopIds, setSelectedStopIds] = useState([]);
  const [segmentFares, setSegmentFares]     = useState([]);
  const [roadPolyline, setRoadPolyline]     = useState([]);
  const [scheduleBusy, setScheduleBusy]     = useState(false);
  const [schedOpts, setSchedOpts]           = useState({ routes: [], buses: [], drivers: [], helpers: [], recent_schedules: [], schedules: [] });
  const [sRouteId, setSRouteId]             = useState("");
  const [sBusId, setSBusId]                 = useState("");
  const [sDriverId, setSDriverId]           = useState("");
  const [sHelperId, setSHelperId]           = useState("");
  const [sStartTime, setSStartTime]         = useState("");
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [scheduleDeleteBusyId, setScheduleDeleteBusyId] = useState(null);
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
  const [editingBusId, setEditingBusId]     = useState(null);
  const [busDeleteBusyId, setBusDeleteBusyId] = useState(null);
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
  const [editingUserId, setEditingUserId]   = useState(null);
  const [userDeleteBusyId, setUserDeleteBusyId] = useState(null);
  const [userRoleFilter, setUserRoleFilter] = useState("ALL");
  const [reviewBusyId, setReviewBusyId]     = useState(null);
  const [reviewMsg, setReviewMsg]           = useState("");

  const loadDB     = async ({ silent = false } = {}) => { if (!silent) setLoading(true); try { const r = await api.get("/api/auth/admin/dashboard/"); setDashboard(r.data); setErr(""); } catch (e) { setErr(e?.response?.data?.detail || "Failed to load dashboard."); } finally { if (!silent) setLoading(false); } };
  const loadRoute  = async () => { try { const r = await api.get("/api/transport/admin/route-builder/"); setBuilderStops(r.data.stops || []); setRecentStops(r.data.recent_stops || []); setRecentRoutes(r.data.routes || r.data.recent_routes || []); } catch (e) { setErr(p => p || e?.response?.data?.detail || "Failed to load routes."); } };
  const loadSched  = async () => { try { const r = await api.get("/api/trips/admin/schedules/"); setSchedOpts({ routes: r.data.routes || [], buses: r.data.buses || [], drivers: r.data.drivers || [], helpers: r.data.helpers || [], recent_schedules: r.data.recent_schedules || [], schedules: r.data.schedules || [] }); } catch (e) { setErr(p => p || e?.response?.data?.detail || "Failed to load schedules."); } };
  const loadBuses  = async () => { try { const r = await api.get("/api/transport/admin/buses/"); setBusList(r.data.buses || []); } catch { /* silent */ } };
  const loadUsers  = async (role = null) => {
    try {
      const r = await api.get(`/api/auth/admin/users/${role ? `?role=${role}` : ""}`);
      setUserList(r.data.users || []);
    } catch { /* silent */ }
  };
  const reloadFilteredUsers = async () => loadUsers(userRoleFilter === "ALL" ? null : userRoleFilter);

  const selectedScheduleBus = useMemo(() => schedOpts.buses.find(b => String(b.id) === String(sBusId)) || null, [sBusId, schedOpts.buses]);
  const selectedAssignBus = useMemo(() => busList.find(b => String(b.id) === String(assignBusId)) || null, [assignBusId, busList]);

  useEffect(() => { loadDB(); loadRoute(); loadSched(); loadBuses(); loadUsers(); const id = setInterval(() => loadDB({ silent: true }), 10000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (location.pathname === "/admin" || location.pathname === "/admin/") {
      navigate(`/admin/${DEFAULT_ADMIN_SECTION}`, { replace: true });
    }
  }, [location.pathname, navigate]);
  useEffect(() => { setSegmentFares(c => Array.from({ length: Math.max(selectedStopIds.length - 1, 0) }, (_, i) => c[i] || "")); }, [selectedStopIds]);
  useEffect(() => {
    if (!sRouteId && schedOpts.routes.length) setSRouteId(String(schedOpts.routes[0].id));
    if (!sBusId && schedOpts.buses.length) setSBusId(String(schedOpts.buses[0].id));
    if (!sDriverId && schedOpts.drivers.length) setSDriverId(String(schedOpts.drivers[0].id));
    if (!sHelperId && schedOpts.helpers.length) setSHelperId(String(schedOpts.helpers[0].id));
    if (!sStartTime) { const d = new Date(Date.now() + 15 * 60000); setSStartTime(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)); }
  }, [sBusId, sDriverId, sHelperId, sRouteId, sStartTime, schedOpts]);
  useEffect(() => {
    if (!selectedScheduleBus) return;
    if (selectedScheduleBus.driver) setSDriverId(String(selectedScheduleBus.driver));
    if (selectedScheduleBus.helper) setSHelperId(String(selectedScheduleBus.helper));
  }, [selectedScheduleBus]);
  useEffect(() => {
    if (!selectedAssignBus) return;
    setAssignDriverId(selectedAssignBus.driver ? String(selectedAssignBus.driver) : "");
    setAssignHelperId(selectedAssignBus.helper ? String(selectedAssignBus.helper) : "");
  }, [selectedAssignBus]);

  const handleLogout = () => { clearToken(); navigate("/auth/login"); };

  const activeSection = useMemo(() => {
    const section = location.pathname.split("/")[2] || DEFAULT_ADMIN_SECTION;
    return ADMIN_SECTIONS.some((item) => item.id === section) ? section : DEFAULT_ADMIN_SECTION;
  }, [location.pathname]);
  const overview = dashboard?.overview; const roleCounts = overview?.role_counts || EMPTY_OBJ; const transport = overview?.transport || EMPTY_OBJ; const trips = overview?.trips || EMPTY_OBJ; const bookings = overview?.bookings || EMPTY_OBJ; const rideOps = overview?.ride_ops || EMPTY_OBJ; const payments = overview?.payments || EMPTY_OBJ; const wallets = overview?.wallets || EMPTY_OBJ;
  const paymentRows = useMemo(() => Object.entries(payments?.methods || {}).map(([method, stats]) => ({ method, total: stats.total || 0, success: stats.success || 0, rate: stats.total ? Math.round((stats.success / stats.total) * 100) : 0 })), [payments]);
  const recentBookingFlow = dashboard?.recent_booking_flow || [];
  const rewardLeaderboard = dashboard?.reward_leaderboard || [];
  const routeAnalytics = dashboard?.route_analytics || [];
  const busAnalytics = dashboard?.bus_analytics || [];
  const staffUsers = useMemo(() => userList.filter(item => item.role !== "PASSENGER"), [userList]);
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
  const clearStopForm = () => { setStopName(""); setStopLat(""); setStopLng(""); setStopActive(true); };
  const clearRoute  = () => { setEditingRouteId(null); setRouteName(""); setRouteCity("Pokhara"); setRouteActive(true); setSelectedStopIds([]); setSegmentFares([]); setRouteMsg(""); };
  const clearScheduleForm = () => { setEditingScheduleId(null); setScheduleMsg(""); setSStartTime(""); };
  const resetBusForm = () => {
    setEditingBusId(null);
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
    setBusMgmtMsg("");
  };
  const resetUserForm = () => {
    setEditingUserId(null);
    setUName("");
    setUPhone("");
    setUEmail("");
    setUAddress("");
    setUPass("");
    setUOfficialPhoto(null);
    setULicenseNumber("");
    setULicensePhoto(null);
    setURole("DRIVER");
    setUMgmtMsg("");
  };
  const handleMapPick = ({ lat, lng }) => { setStopLat(Number(lat).toFixed(6)); setStopLng(Number(lng).toFixed(6)); };

  const createStop = async () => {
    if (!stopName.trim()) { setErr("Enter a stop name."); return; }
    if (stopLat === "" || stopLng === "") { setErr("Tap the map or enter valid stop coordinates."); return; }
    if (Number.isNaN(Number(stopLat)) || Number.isNaN(Number(stopLng))) { setErr("Stop coordinates must be valid numbers."); return; }
    setStopBusy(true); setErr(""); setStopMsg("");
    try {
      const r = await api.post("/api/transport/admin/stops/", {
        name: stopName.trim(),
        lat: Number(stopLat),
        lng: Number(stopLng),
        is_active: stopActive,
      });
      setStopMsg(r.data.message || "Stop added.");
      clearStopForm();
      await Promise.all([loadDB({ silent: true }), loadRoute()]);
    } catch (e) {
      const d = e?.response?.data;
      setErr(d?.name?.[0] || d?.lat?.[0] || d?.lng?.[0] || d?.detail || "Failed to create stop.");
    } finally {
      setStopBusy(false);
    }
  };

  const saveRoute = async () => {
    if (!routeName.trim()) { setErr("Enter a route name."); return; } if (selectedStopIds.length < 2) { setErr("Select at least two stops."); return; } if (segmentFares.some(f => f === "" || Number(f) < 0)) { setErr("Fill every segment fare."); return; }
    setRouteBusy(true); setErr(""); setRouteMsg("");
    try {
      const payload = { name: routeName.trim(), city: routeCity.trim() || "Pokhara", is_active: routeActive, stop_ids: selectedStopIds, segment_fares: segmentFares.map(Number) };
      const r = editingRouteId
        ? await api.patch(`/api/transport/admin/routes/${editingRouteId}/`, payload)
        : await api.post("/api/transport/admin/route-builder/", payload);
      setRouteMsg(r.data.message || (editingRouteId ? "Route updated." : "Route created."));
      clearRoute();
      await Promise.all([loadDB({ silent: true }), loadRoute(), loadSched()]);
    }
    catch (e) { setErr(e?.response?.data?.detail || `Failed to ${editingRouteId ? "update" : "create"} route.`); } finally { setRouteBusy(false); }
  };

  const startEditingRoute = (route) => {
    setErr("");
    setRouteMsg("");
    setEditingRouteId(route.id);
    setRouteName(route.name || "");
    setRouteCity(route.city || "Pokhara");
    setRouteActive(Boolean(route.is_active));
    setSelectedStopIds((route.route_stops || []).map(item => item.stop.id));
    setSegmentFares((route.segment_fares || []).map(value => String(value)));
    navigate("/admin/routes");
  };

  const deleteRoute = async (route) => {
    if (!window.confirm(`Delete route ${route.name}? This cannot be undone.`)) return;
    setRouteDeleteBusyId(route.id);
    setErr("");
    setRouteMsg("");
    try {
      const r = await api.delete(`/api/transport/admin/routes/${route.id}/`);
      setRouteMsg(r.data.message || "Route deleted.");
      if (editingRouteId === route.id) clearRoute();
      await Promise.all([loadDB({ silent: true }), loadRoute(), loadSched()]);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to delete route.");
    } finally {
      setRouteDeleteBusyId(null);
    }
  };

  const saveSchedule = async () => {
    if (!(sRouteId && sBusId && sDriverId && sHelperId && sStartTime)) { setErr("Fill all schedule fields."); return; }
    setScheduleBusy(true); setErr(""); setScheduleMsg("");
    try {
      const payload = { route_id: +sRouteId, bus_id: +sBusId, driver_id: +sDriverId, helper_id: +sHelperId, scheduled_start_time: new Date(sStartTime).toISOString() };
      const r = editingScheduleId
        ? await api.patch(`/api/trips/admin/schedules/${editingScheduleId}/`, payload)
        : await api.post("/api/trips/admin/schedules/", payload);
      setScheduleMsg(r.data.message || (editingScheduleId ? "Schedule updated." : "Schedule created."));
      clearScheduleForm();
      await Promise.all([loadDB({ silent: true }), loadSched()]);
    }
    catch (e) { setErr(e?.response?.data?.detail || `Failed to ${editingScheduleId ? "update" : "create"} schedule.`); } finally { setScheduleBusy(false); }
  };

  const startEditingSchedule = (schedule) => {
    setErr("");
    setScheduleMsg("");
    setEditingScheduleId(schedule.id);
    setSRouteId(String(schedule.route));
    setSBusId(String(schedule.bus));
    setSDriverId(String(schedule.driver));
    setSHelperId(String(schedule.helper));
    setSStartTime(toLocalDatetimeInput(schedule.scheduled_start_time));
    navigate("/admin/assignments");
  };

  const deleteSchedule = async (schedule) => {
    if (!window.confirm(`Delete the schedule for ${schedule.route_name}? This cannot be undone.`)) return;
    setScheduleDeleteBusyId(schedule.id);
    setErr("");
    setScheduleMsg("");
    try {
      const r = await api.delete(`/api/trips/admin/schedules/${schedule.id}/`);
      setScheduleMsg(r.data.message || "Schedule deleted.");
      if (editingScheduleId === schedule.id) clearScheduleForm();
      await Promise.all([loadDB({ silent: true }), loadSched()]);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to delete schedule.");
    } finally {
      setScheduleDeleteBusyId(null);
    }
  };

  const saveBus = async () => {
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
      const r = editingBusId
        ? await api.patch(`/api/transport/admin/buses/${editingBusId}/`, formData)
        : await api.post("/api/transport/admin/buses/", formData);
      setBusMgmtMsg(r.data.message || (editingBusId ? "Bus updated." : "Bus created."));
      resetBusForm();
      await Promise.all([loadBuses(), loadSched(), loadDB({ silent: true })]);
    }
    catch (e) { setErr(e?.response?.data?.detail || `Failed to ${editingBusId ? "update" : "create"} bus.`); } finally { setBusMgmtBusy(false); }
  };

  const startEditingBus = (bus) => {
    setErr("");
    setBusMgmtMsg("");
    setEditingBusId(bus.id);
    setBusName(bus.display_name || "");
    setBusPlate(bus.plate_number || "");
    setBusYear(bus.model_year ? String(bus.model_year) : "");
    setBusCondition(bus.condition || "NORMAL");
    setBusRows(String(bus.layout_rows || 9));
    setBusCols(String(bus.layout_columns || 4));
    setBusActive(Boolean(bus.is_active));
    setBusExteriorPhoto(null);
    setBusInteriorPhoto(null);
    setBusSeatPhoto(null);
    navigate("/admin/buses");
  };

  const deleteBus = async (bus) => {
    if (!window.confirm(`Delete bus ${bus.display_name || bus.plate_number}? This cannot be undone.`)) return;
    setBusDeleteBusyId(bus.id);
    setErr("");
    setBusMgmtMsg("");
    try {
      const r = await api.delete(`/api/transport/admin/buses/${bus.id}/`);
      setBusMgmtMsg(r.data.message || "Bus deleted.");
      if (editingBusId === bus.id) resetBusForm();
      if (assignBusId === String(bus.id)) {
        setAssignBusId("");
        setAssignDriverId("");
        setAssignHelperId("");
      }
      await Promise.all([loadBuses(), loadSched(), loadDB({ silent: true })]);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to delete bus.");
    } finally {
      setBusDeleteBusyId(null);
    }
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

  const saveUser = async () => {
    if (!uName.trim() || !uPhone.trim() || (!editingUserId && !uPass.trim())) { setErr("Name, phone, and password are required."); return; }
    if ((uRole === "DRIVER" || uRole === "HELPER") && !uAddress.trim()) { setErr("Address is required for staff accounts."); return; }
    if ((uRole === "DRIVER" || uRole === "HELPER") && !uOfficialPhoto && !editingUserId) { setErr("An official photo is required for staff accounts."); return; }
    if (uRole === "DRIVER" && (!uLicenseNumber.trim() || (!uLicensePhoto && !editingUserId))) { setErr("Driver license number and license photo are required."); return; }
    setUMgmtBusy(true); setErr(""); setUMgmtMsg("");
    try {
      const formData = new FormData();
      formData.append("full_name", uName.trim());
      formData.append("phone", uPhone.trim());
      if (uPass.trim()) formData.append("password", uPass);
      formData.append("role", uRole);
      if (uEmail.trim()) formData.append("email", uEmail.trim());
      if (uAddress.trim()) formData.append("address", uAddress.trim());
      if (uOfficialPhoto) formData.append("official_photo", uOfficialPhoto);
      if (uRole === "DRIVER" && uLicenseNumber.trim()) formData.append("license_number", uLicenseNumber.trim());
      if (uRole === "DRIVER" && uLicensePhoto) formData.append("license_photo", uLicensePhoto);
      const r = editingUserId
        ? await api.patch(`/api/auth/admin/users/${editingUserId}/`, formData)
        : await api.post("/api/auth/admin/users/", formData);
      setUMgmtMsg(r.data.message || (editingUserId ? "User updated." : "User created."));
      resetUserForm();
      await Promise.all([reloadFilteredUsers(), loadSched(), loadDB({ silent: true })]);
    }
    catch (e) { const d = e?.response?.data; setErr(d?.phone?.[0] || d?.email?.[0] || d?.detail || `Failed to ${editingUserId ? "update" : "create"} user.`); } finally { setUMgmtBusy(false); }
  };

  const startEditingUser = (staffUser) => {
    setErr("");
    setUMgmtMsg("");
    setEditingUserId(staffUser.id);
    setURole(staffUser.role || "DRIVER");
    setUName(staffUser.full_name || "");
    setUPhone(staffUser.phone || "");
    setUEmail(staffUser.email || "");
    setUAddress(staffUser.address || "");
    setUPass("");
    setUOfficialPhoto(null);
    setULicenseNumber(staffUser.license_number || "");
    setULicensePhoto(null);
    navigate("/admin/staff");
  };

  const deleteUser = async (staffUser) => {
    if (!window.confirm(`Delete ${staffUser.full_name}? This cannot be undone.`)) return;
    setUserDeleteBusyId(staffUser.id);
    setErr("");
    setUMgmtMsg("");
    setReviewMsg("");
    try {
      const r = await api.delete(`/api/auth/admin/users/${staffUser.id}/`);
      setUMgmtMsg(r.data.message || "User deleted.");
      if (editingUserId === staffUser.id) resetUserForm();
      await Promise.all([reloadFilteredUsers(), loadSched(), loadDB({ silent: true })]);
    } catch (e) {
      const d = e?.response?.data;
      setErr(d?.detail || "Failed to delete user.");
    } finally {
      setUserDeleteBusyId(null);
    }
  };

  const setStaffFilter = async (role) => {
    setUserRoleFilter(role);
    await loadUsers(role === "ALL" ? null : role);
  };

  const reviewUser = async (staffUser, payload) => {
    setReviewBusyId(staffUser.id);
    setErr("");
    setReviewMsg("");
    try {
      const r = await api.patch(`/api/auth/admin/users/${staffUser.id}/review/`, payload);
      const updatedUser = r.data.user;
      setUserList(current => current.map(row => (row.id === updatedUser.id ? updatedUser : row)));
      setReviewMsg(r.data.message || `Updated ${staffUser.full_name}.`);
      await loadDB({ silent: true });
      await loadSched();
    } catch (e) {
      const d = e?.response?.data;
      setErr(d?.official_photo_verified?.[0] || d?.license_verified?.[0] || d?.detail || "Failed to update staff review.");
    } finally {
      setReviewBusyId(null);
    }
  };

  if (loading) return <div className={`min-h-screen flex items-center justify-center ${t.page}`}><div className="text-center"><div className="w-12 h-12 rounded-full border-4 border-[#ff6b73] border-t-transparent animate-spin mx-auto" /><p className={`mt-4 text-sm ${t.textSub}`}>Loading admin dashboard...</p></div></div>;

  const rowBg = isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-200";

  return (
      <div className={`min-h-screen font-sans transition-colors duration-200 ${t.page}`}>
        <header className={`sticky top-0 z-30 border-b backdrop-blur-md px-3 py-3 sm:px-4 ${t.nav}`}>
          <div className="mx-auto flex max-w-[76rem] flex-wrap items-center justify-between gap-3 sm:gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-sm font-black text-white">MB</div>
              <div className="min-w-0"><p className={`text-[10px] font-bold uppercase tracking-widest ${t.label}`}>MetroBus Admin</p><p className={`truncate text-sm font-bold leading-none ${t.text}`}>{user?.full_name || "Admin"}</p></div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Pill color="emerald" isDark={isDark}>{trips.live || 0} live</Pill>
              <Pill color="amber" isDark={isDark}>{payments.pending || 0} pending</Pill>
              <ThemeToggle isDark={isDark} toggle={toggle} />
            <Btn tone="ghost" onClick={() => { loadDB(); loadRoute(); loadSched(); }} className="!py-2 !px-3 text-xs">Reload</Btn>
            <Btn tone="danger" onClick={handleLogout} className="!py-2 !px-3 text-xs">Logout</Btn>
          </div>
        </div>
      </header>

        <div className="mx-auto max-w-[76rem] px-3 py-4 sm:px-4 sm:py-5">
        {err ? <p className="mb-4 text-sm font-semibold text-red-600">{err}</p> : null}
        {/* Tabs */}
          <div className={`enterprise-inline-scroll mb-6 flex gap-1.5 rounded-2xl border p-1.5 backdrop-blur ${t.tabBar}`}>
            {ADMIN_SECTIONS.map(section => (
              <button key={section.id} type="button" onClick={() => navigate(`/admin/${section.id}`)}
                className={`flex min-w-[7rem] items-center justify-center rounded-xl px-3 py-2.5 text-[0.72rem] font-bold leading-tight transition-all sm:min-w-0 sm:flex-1 ${activeSection === section.id ? "bg-[linear-gradient(135deg,#ff6b73,#ff8a5b)] text-white shadow-[0_18px_34px_rgba(255,107,115,0.24)]" : t.tabInactive}`}>
                <span>{section.label}</span>
              </button>
            ))}
          </div>

        {/* OVERVIEW */}
        {activeSection === "analytics" && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total Users" value={overview?.users_total ?? 0} sub={`${roleCounts.PASSENGER || 0} passengers | ${roleCounts.DRIVER || 0} drivers`} accent="text-[#ff6b73]" t={t} />
              <StatCard label="Live Trips" value={trips.live ?? 0} sub={`${trips.total || 0} total`} accent="text-emerald-500" t={t} />
              <StatCard label="Bookings" value={bookings.total ?? 0} sub={`${bookings.confirmed || 0} confirmed`} accent="text-amber-500" t={t} />
              <StatCard label="Revenue" value={fmtMoney(payments.revenue_success ?? 0)} sub={`${payments.success || 0} successful`} t={t} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Wallet Float" value={fmtMoney(wallets.total_balance ?? 0)} sub="Passenger balance held" accent="text-fuchsia-500" t={t} />
              <StatCard label="Active Passes" value={wallets.active_passes ?? 0} sub={`${wallets.weekly_passes || 0} weekly | ${wallets.monthly_passes || 0} monthly`} accent="text-sky-500" t={t} />
              <StatCard label="Reward Ready" value={wallets.reward_ready ?? 0} sub={`${wallets.reward_threshold || 100} points unlock a free ride`} accent="text-violet-500" t={t} />
              <StatCard label="Free Rides Used" value={wallets.free_rides_redeemed ?? 0} sub={`${wallets.total_reward_points || 0} live points across wallets`} accent="text-emerald-500" t={t} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard label="Await Accept" value={rideOps.awaiting_acceptance ?? 0} sub="Helper has not accepted yet" accent="text-amber-500" t={t} />
              <StatCard label="Await Payment" value={rideOps.awaiting_payment ?? 0} sub="Accepted but not paid" accent="text-rose-500" t={t} />
              <StatCard label="Ready To Board" value={rideOps.ready_to_board ?? 0} sub="Paid and waiting" accent="text-sky-500" t={t} />
              <StatCard label="Onboard" value={rideOps.onboard ?? 0} sub="Passengers riding now" accent="text-emerald-500" t={t} />
              <StatCard label="Completed Today" value={rideOps.completed_today ?? 0} sub="Seats released today" accent="text-violet-500" t={t} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Routes" value={transport.routes ?? 0} sub={`${routeAnalytics.filter(route => route.is_active).length} active across ${new Set(routeAnalytics.map(route => route.city)).size || 1} city`} accent="text-indigo-500" t={t} />
              <StatCard label="Stops" value={transport.stops ?? 0} sub="Shared map stops managed by admin" accent="text-sky-500" t={t} />
              <StatCard label="Buses" value={transport.buses ?? 0} sub={`${busAnalytics.filter(bus => bus.is_active).length} active fleet vehicles`} accent="text-fuchsia-500" t={t} />
              <StatCard label="Seats" value={transport.seats ?? 0} sub="Total seats mapped across the fleet" accent="text-orange-500" t={t} />
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
              <GlassCard t={t}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <SLabel t={t}>Route Analytics</SLabel>
                  <Pill color="indigo" isDark={isDark}>{routeAnalytics.length} routes</Pill>
                </div>
                <div className="space-y-3">
                  {routeAnalytics.length === 0 ? <p className={`text-sm ${t.textSub}`}>No route analytics yet.</p> : routeAnalytics.slice(0, 8).map(route => (
                    <div key={route.route_id} className={`rounded-xl border px-4 py-4 ${rowBg}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`break-words text-sm font-bold ${t.text}`}>{route.route_name}</p>
                          <p className={`mt-1 text-xs ${t.textSub}`}>{route.city} | {route.stops_count} stops</p>
                        </div>
                        <Pill color={route.is_active ? "emerald" : "slate"} isDark={isDark}>{route.is_active ? "ACTIVE" : "INACTIVE"}</Pill>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className={`rounded-xl px-3 py-2 text-xs ${rowBg}`}>Schedules {route.planned_schedules}</div>
                        <div className={`rounded-xl px-3 py-2 text-xs ${rowBg}`}>Live {route.live_trips}</div>
                        <div className={`rounded-xl px-3 py-2 text-xs ${rowBg}`}>Bookings {route.bookings}</div>
                        <div className={`rounded-xl px-3 py-2 text-xs ${rowBg}`}>Revenue {fmtMoney(route.revenue_success)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
              <GlassCard t={t}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <SLabel t={t}>Bus Analytics</SLabel>
                  <Pill color="fuchsia" isDark={isDark}>{busAnalytics.length} buses</Pill>
                </div>
                <div className="space-y-3">
                  {busAnalytics.length === 0 ? <p className={`text-sm ${t.textSub}`}>No fleet analytics yet.</p> : busAnalytics.slice(0, 8).map(bus => (
                    <div key={bus.bus_id} className={`rounded-xl border px-4 py-4 ${rowBg}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`break-words text-sm font-bold ${t.text}`}>{bus.display_name}</p>
                          <p className={`mt-1 text-xs ${t.textSub}`}>{bus.plate_number} | {bus.capacity} seats | {bus.condition}</p>
                          <p className={`mt-1 text-xs ${t.textSub}`}>Driver {bus.driver_name || "Unassigned"} | Helper {bus.helper_name || "Unassigned"}</p>
                        </div>
                        <Pill color={bus.is_active ? "emerald" : "slate"} isDark={isDark}>{bus.is_active ? "ACTIVE" : "OFF"}</Pill>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className={`rounded-xl px-3 py-2 text-xs ${rowBg}`}>Schedules {bus.planned_schedules}</div>
                        <div className={`rounded-xl px-3 py-2 text-xs ${rowBg}`}>Live {bus.live_trips}</div>
                        <div className={`rounded-xl px-3 py-2 text-xs ${rowBg}`}>Trips {bus.total_trips}</div>
                        <div className={`rounded-xl px-3 py-2 text-xs ${rowBg}`}>Revenue {fmtMoney(bus.revenue_success)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
            <GlassCard t={t}>
              <SLabel t={t}>Payment Method Performance</SLabel>
              <div className="space-y-3">
                {paymentRows.length === 0 && <p className={`text-sm ${t.textSub}`}>No payment data yet.</p>}
                {paymentRows.map(row => (
                  <div key={row.method} className="flex items-center gap-4">
                    <p className={`w-24 text-xs font-bold flex-shrink-0 ${t.text}`}>{row.method}</p>
                    <div className={`flex-1 h-2 rounded-full ${isDark ? "bg-white/10" : "bg-slate-200"}`}><div className="h-2 rounded-full bg-[#ff6b73] transition-all" style={{ width: `${row.rate}%` }} /></div>
                    <div className="flex items-center gap-2 flex-shrink-0"><Pill color={row.rate >= 70 ? "emerald" : row.rate > 0 ? "amber" : "slate"} isDark={isDark}>{row.rate}%</Pill><span className={`text-xs ${t.textMuted}`}>{row.success}/{row.total}</span></div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[{ label: "Success", v: payments.success || 0, a: "text-emerald-500" }, { label: "Pending", v: payments.pending || 0, a: "text-amber-500" }, { label: "Failed", v: payments.failed || 0, a: "text-red-500" }].map(r => (
                  <div key={r.label} className={`rounded-xl border px-4 py-3 ${rowBg}`}><p className={`text-[10px] uppercase tracking-widest ${t.label}`}>{r.label}</p><p className={`text-2xl font-black mt-1 ${r.a}`}>{r.v}</p></div>
                ))}
              </div>
            </GlassCard>
            <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <GlassCard t={t}>
                <SLabel t={t}>Reward Leaderboard</SLabel>
                <div className="space-y-3">
                  {rewardLeaderboard.length === 0 ? <p className={`text-sm ${t.textSub}`}>No passenger wallet activity yet.</p> : rewardLeaderboard.map((row, index) => (
                    <div key={row.passenger_id} className={`rounded-xl border px-4 py-4 ${rowBg}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`text-sm font-bold ${t.text}`}>{index + 1}. {row.passenger_name}</p>
                          <p className={`text-xs mt-0.5 ${t.textSub}`}>{row.phone}</p>
                          <p className={`text-xs mt-1 ${t.textSub}`}>{row.pass_plan ? `${row.pass_plan} | ${row.pass_rides_remaining} rides left` : "No active pass"}</p>
                        </div>
                        <Pill color={row.reward_points >= (wallets.reward_threshold || 100) ? "emerald" : "amber"} isDark={isDark}>
                          {row.reward_points} pts
                        </Pill>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className={`rounded-xl px-3 py-2 text-xs ${t.textSub} ${rowBg}`}>Wallet {fmtMoney(row.balance)}</div>
                        <div className={`rounded-xl px-3 py-2 text-xs ${t.textSub} ${rowBg}`}>Lifetime {row.lifetime_reward_points} pts</div>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
              <GlassCard t={t}>
                <SLabel t={t}>Pass Mix</SLabel>
                <div className="space-y-3">
                  {[{ label: "Weekly Passes", value: wallets.weekly_passes || 0, tone: "sky" }, { label: "Monthly Passes", value: wallets.monthly_passes || 0, tone: "indigo" }, { label: "Flex 20 Passes", value: wallets.flex_passes || 0, tone: "amber" }].map(item => (
                    <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border px-4 py-4 border-transparent bg-white/40">
                      <div>
                        <p className={`text-sm font-bold ${t.text}`}>{item.label}</p>
                        <p className={`text-xs mt-1 ${t.textSub}`}>Active now in MetroBus wallets</p>
                      </div>
                      <Pill color={item.tone} isDark={isDark}>{item.value}</Pill>
                    </div>
                  ))}
                </div>
                <div className={`mt-4 rounded-xl border px-4 py-4 text-sm ${rowBg}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${t.label}`}>Reward Policy</p>
                  <p className={`mt-2 font-bold ${t.text}`}>{wallets.reward_threshold || 100} points = 1 free ride</p>
                  <p className={`mt-2 ${t.textSub}`}>Passengers earn reward points from Metro Wallet and Ride Pass payments. Admin can monitor redemption pressure here before it affects route demand.</p>
                </div>
              </GlassCard>
            </div>
          </div>
        )}

        {/* ROUTES */}
        {activeSection === "routes" && (
          <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
            <div className="space-y-4">
              <GlassCard t={t}>
                <SLabel t={t}>Add Stop To Main Map</SLabel>
                <div className="space-y-3">
                  <InputField label="Stop Name" value={stopName} onChange={setStopName} placeholder="Bindhyabasini Gate" t={t} />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InputField label="Latitude" value={stopLat} onChange={setStopLat} placeholder="28.233421" t={t} />
                    <InputField label="Longitude" value={stopLng} onChange={setStopLng} placeholder="83.996812" t={t} />
                  </div>
                  <div className={`rounded-xl border px-4 py-3 text-xs ${rowBg}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${t.label}`}>Pinned Coordinate</p>
                    <p className={`mt-2 text-sm font-bold ${t.text}`}>{stopLat && stopLng ? `${stopLat}, ${stopLng}` : "Tap anywhere on the map to pin this stop."}</p>
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${t.label}`}>Active</label>
                    <button type="button" onClick={() => setStopActive(v => !v)} className={`w-full rounded-xl px-4 py-3 text-sm font-bold transition ${stopActive ? "bg-emerald-600 text-white" : isDark ? "bg-white/10 text-slate-400" : "bg-slate-200 text-slate-600"}`}>
                      {stopActive ? "Active For Routes" : "Saved As Inactive"}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Btn tone="ghost" onClick={clearStopForm} className="w-full !py-4">Clear</Btn>
                    <Btn tone="success" onClick={createStop} disabled={stopBusy} className="w-full !py-4">{stopBusy ? "Saving..." : "Add Stop"}</Btn>
                  </div>
                </div>
              </GlassCard>
              <GlassCard t={t}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <SLabel t={t}>{editingRouteId ? "Edit Route" : "Route Builder"}</SLabel>
                  {editingRouteId ? <button type="button" onClick={clearRoute} className={`rounded-lg border px-3 py-2 text-xs font-bold ${rowBg} ${t.text}`}>Cancel</button> : null}
                </div>
                <div className="space-y-3">
                  <InputField label="Route Name" value={routeName} onChange={setRouteName} placeholder="Lakeside to Prithvi Chowk" t={t} />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                    <InputField label="City" value={routeCity} onChange={setRouteCity} placeholder="Pokhara" t={t} />
                    <div><label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${t.label}`}>Active</label><button type="button" onClick={() => setRouteActive(v => !v)} className={`w-full rounded-xl px-4 py-3 text-sm font-bold transition ${routeActive ? "bg-emerald-600 text-white" : isDark ? "bg-white/10 text-slate-400" : "bg-slate-200 text-slate-600"}`}>{routeActive ? "YES" : "NO"}</button></div>
                  </div>
                  {routeMsg ? <p className="text-sm font-semibold text-emerald-600">{routeMsg}</p> : null}
                </div>
              </GlassCard>
              <GlassCard t={t}>
                <div className="flex items-center justify-between mb-3"><SLabel t={t}>Selected Stops ({selectedStops.length})</SLabel><button type="button" onClick={clearRoute} className={`text-xs hover:text-red-400 transition ${t.textSub}`}>Clear all</button></div>
                {selectedStops.length === 0 ? <p className={`text-sm ${t.textSub}`}>Click map markers to add stops in order.</p>
                  : selectedStops.map((stop, i) => (
                    <div key={stop.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 mb-2 ${rowBg}`}>
                      <span className="text-xs text-[#ff6b73] font-bold w-5 flex-shrink-0">{i + 1}</span>
                      <span className={`text-sm flex-1 break-words leading-snug ${t.text}`}>{stop.name}</span>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => moveStop(i, -1)} className={`rounded-lg px-2 py-1 text-xs transition ${isDark ? "bg-white/10 hover:bg-white/20" : "bg-slate-200 hover:bg-slate-300"} ${t.text}`}>Up</button>
                        <button type="button" onClick={() => moveStop(i, 1)} className={`rounded-lg px-2 py-1 text-xs transition ${isDark ? "bg-white/10 hover:bg-white/20" : "bg-slate-200 hover:bg-slate-300"} ${t.text}`}>Down</button>
                        <button type="button" onClick={() => toggleStop(stop.id)} className="rounded-lg bg-red-500/20 px-2 py-1 text-xs text-red-400 hover:bg-red-500/30">Remove</button>
                      </div>
                    </div>
                  ))}
              </GlassCard>
              {selectedStops.length >= 2 && (
                <GlassCard t={t}>
                  <SLabel t={t}>Segment Fares (NPR)</SLabel>
                  {selectedStops.slice(0, -1).map((stop, i) => (
                    <div key={`${stop.id}-fare`} className="mb-3"><label className={`block text-[10px] mb-1 ${t.textSub}`}>{stop.name} to {selectedStops[i + 1].name}</label><input type="number" min="0" step="0.01" value={segmentFares[i] || ""} placeholder="Enter fare" onChange={e => { const n = [...segmentFares]; n[i] = e.target.value; setSegmentFares(n); }} className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:border-[#ff6b73] ${t.input}`} /></div>
                  ))}
                </GlassCard>
              )}
              <Btn tone="success" onClick={saveRoute} disabled={routeBusy} className="w-full !py-4">{routeBusy ? (editingRouteId ? "Saving..." : "Creating...") : (editingRouteId ? "Save Route Changes" : "Create Route")}</Btn>
            </div>
            <div className="space-y-4">
              <GlassCard t={t} className="!p-0 overflow-hidden">
                <div className={`px-5 py-4 border-b ${t.divider}`}><SLabel t={t}>Stop Map - Build Routes + Pin Stops</SLabel><p className={`text-sm font-bold -mt-2 ${t.text}`}>{selectedStopIds.length} stops selected for the route builder</p></div>
                <div className="h-80">
                  <MapContainer center={[28.2096, 83.9856]} zoom={12} scrollWheelZoom={false} className="h-full w-full">
                    <TileLayer attribution="&copy; OpenStreetMap &copy; CARTO" url={t.mapTile} />
                    <MapViewport points={mapPts} />
                    <StopMapPicker onPick={handleMapPick} />
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
                <SLabel t={t}>Recent Stops</SLabel>
                {recentStops.length === 0 ? <p className={`text-sm ${t.textSub}`}>No stops added yet.</p>
                  : recentStops.map(stop => (
                    <div key={stop.id} className={`flex items-center justify-between rounded-xl border px-4 py-3 mb-2 ${rowBg}`}>
                      <div className="min-w-0">
                        <p className={`text-sm font-bold ${t.text}`}>{stop.name}</p>
                        <p className={`text-xs mt-0.5 ${t.textSub}`}>{Number(stop.lat).toFixed(4)}, {Number(stop.lng).toFixed(4)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {stop.is_active ? <button type="button" onClick={() => toggleStop(stop.id)} className="rounded-lg bg-[#fff0ef] px-3 py-2 text-[11px] font-bold text-[#ff6b73]">{selectedStopIds.includes(stop.id) ? "Remove" : "Use"}</button> : null}
                        <Pill color={stop.is_active ? "emerald" : "slate"} isDark={isDark}>{stop.is_active ? "ACTIVE" : "INACTIVE"}</Pill>
                      </div>
                    </div>
                  ))}
              </GlassCard>
              <GlassCard t={t}>
                <SLabel t={t}>Routes ({recentRoutes.length})</SLabel>
                {recentRoutes.length === 0 ? <p className={`text-sm ${t.textSub}`}>No routes yet.</p>
                  : recentRoutes.map(r => (
                    <div key={r.id} className={`rounded-xl border px-4 py-3 mb-2 ${rowBg}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`break-words text-sm font-bold leading-snug ${t.text}`}>{r.name}</p>
                          <p className={`mt-0.5 break-words text-xs leading-5 ${t.textSub}`}>{r.city} | {r.stops_count} stops</p>
                          {r.route_stops?.length ? <p className={`mt-1 break-words text-xs leading-5 ${t.textSub}`}>{r.route_stops[0].stop.name} to {r.route_stops[r.route_stops.length - 1].stop.name}</p> : null}
                        </div>
                        <Pill color={r.is_active ? "emerald" : "slate"} isDark={isDark}>{r.is_active ? "ACTIVE" : "INACTIVE"}</Pill>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Btn tone="primary" onClick={() => startEditingRoute(r)} className="!rounded-full !px-3 !py-2 text-[11px]">Edit</Btn>
                        <Btn tone="danger" onClick={() => deleteRoute(r)} disabled={routeDeleteBusyId === r.id} className="!rounded-full !px-3 !py-2 text-[11px]">
                          {routeDeleteBusyId === r.id ? "Deleting..." : "Delete"}
                        </Btn>
                      </div>
                    </div>
                  ))}
              </GlassCard>
            </div>
          </div>
        )}

        {/* SCHEDULES */}
        {activeSection === "assignments" && (
          <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
            <div className="space-y-4">
              <GlassCard t={t}>
                <SLabel t={t}>Assign Bus And Staff</SLabel>
                <div className="space-y-3">
                  {assignMsg ? <p className="text-sm font-semibold text-emerald-600">{assignMsg}</p> : null}
                  <SelectField label="Bus" value={assignBusId} onChange={setAssignBusId} t={t} options={[{ value: "", label: "-- Select Bus --" }, ...busList.map(b => ({ value: b.id, label: `${b.display_name || b.plate_number} | ${b.plate_number}` }))]} />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <SelectField label="Driver" value={assignDriverId} onChange={setAssignDriverId} t={t} options={[{ value: "", label: "Unassigned" }, ...schedOpts.drivers.map(d => ({ value: d.id, label: d.full_name }))]} />
                    <SelectField label="Helper" value={assignHelperId} onChange={setAssignHelperId} t={t} options={[{ value: "", label: "Unassigned" }, ...schedOpts.helpers.map(h => ({ value: h.id, label: h.full_name }))]} />
                  </div>
                  {selectedAssignBus ? (
                    <div className={`rounded-xl border px-4 py-3 text-xs ${rowBg}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${t.label}`}>Current Assignment</p>
                      <p className={`mt-2 text-sm font-bold ${t.text}`}>{selectedAssignBus.display_name || selectedAssignBus.plate_number}</p>
                      <p className={`mt-1 ${t.textSub}`}>{selectedAssignBus.plate_number} | {selectedAssignBus.capacity} seats | {selectedAssignBus.condition}</p>
                      <p className={`mt-2 ${t.textSub}`}>Driver: {selectedAssignBus.driver_name || "Unassigned"} | Helper: {selectedAssignBus.helper_name || "Unassigned"}</p>
                    </div>
                  ) : null}
                  <Btn tone="primary" onClick={assignStaffToBus} disabled={assignBusy} className="w-full !py-4">
                    {assignBusy ? "Updating..." : "Save Assignment"}
                  </Btn>
                </div>
              </GlassCard>
              <GlassCard t={t}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <SLabel t={t}>{editingScheduleId ? "Edit Trip Schedule" : "Create Trip Schedule"}</SLabel>
                  </div>
                  {editingScheduleId ? (
                    <button type="button" onClick={clearScheduleForm} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${rowBg} ${t.text}`}>
                      Cancel
                    </button>
                  ) : null}
                </div>
                <div className="space-y-3">
                  {scheduleMsg ? <p className="text-sm font-semibold text-emerald-600">{scheduleMsg}</p> : null}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <SelectField label="Route" value={sRouteId} onChange={setSRouteId} t={t} options={schedOpts.routes.map(r => ({ value: r.id, label: r.name }))} />
                    <SelectField label="Bus" value={sBusId} onChange={setSBusId} t={t} options={schedOpts.buses.map(b => ({ value: b.id, label: `${b.display_name || b.plate_number} | ${b.plate_number}` }))} />
                    <SelectField label="Driver" value={sDriverId} onChange={setSDriverId} t={t} options={schedOpts.drivers.map(d => ({ value: d.id, label: d.full_name }))} />
                    <SelectField label="Helper" value={sHelperId} onChange={setSHelperId} t={t} options={schedOpts.helpers.map(h => ({ value: h.id, label: h.full_name }))} />
                  </div>
                  {selectedScheduleBus ? (
                    <div className={`rounded-xl border px-4 py-3 text-xs ${rowBg}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${t.label}`}>Schedule Snapshot</p>
                      <p className={`mt-2 text-sm font-bold ${t.text}`}>{selectedScheduleBus.display_name || selectedScheduleBus.plate_number}</p>
                      <p className={`mt-1 ${t.textSub}`}>{selectedScheduleBus.plate_number} | {selectedScheduleBus.capacity} seats</p>
                      <p className={`mt-2 ${t.textSub}`}>Driver: {selectedScheduleBus.driver_name || "Not assigned"} | Helper: {selectedScheduleBus.helper_name || "Not assigned"}</p>
                    </div>
                  ) : null}
                  <InputField label="Scheduled Start Time" type="datetime-local" value={sStartTime} onChange={setSStartTime} t={t} />
                  <Btn tone="primary" onClick={saveSchedule} disabled={scheduleBusy} className="w-full !py-4">
                    {scheduleBusy ? (editingScheduleId ? "Saving..." : "Creating...") : (editingScheduleId ? "Save Schedule Changes" : "Create Trip Schedule")}
                  </Btn>
                </div>
              </GlassCard>
            </div>
            <div className="space-y-4">
              <GlassCard t={t}>
                <SLabel t={t}>Bus Assignment Snapshot</SLabel>
                <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                  {busList.length === 0 ? <p className={`text-sm ${t.textSub}`}>No buses registered yet.</p> : busList.map(bus => (
                    <div key={bus.id} className={`rounded-xl border px-4 py-4 ${rowBg}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`break-words text-sm font-bold ${t.text}`}>{bus.display_name || bus.plate_number}</p>
                          <p className={`mt-1 text-xs ${t.textSub}`}>{bus.plate_number} | {bus.capacity} seats | {bus.condition}</p>
                          <p className={`mt-1 text-xs ${t.textSub}`}>Driver: {bus.driver_name || "Unassigned"} | Helper: {bus.helper_name || "Unassigned"}</p>
                        </div>
                        <Pill color={bus.is_active ? "emerald" : "slate"} isDark={isDark}>{bus.is_active ? "ACTIVE" : "OFF"}</Pill>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Btn tone="primary" onClick={() => setAssignBusId(String(bus.id))} className="!rounded-full !px-3 !py-2 text-[11px]">Load Assignment</Btn>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
              <GlassCard t={t}>
                <SLabel t={t}>Trip Schedules ({schedOpts.schedules.length})</SLabel>
                <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
                  {schedOpts.schedules.length === 0 ? <p className={`text-sm ${t.textSub}`}>No schedules yet.</p> : schedOpts.schedules.map(s => (
                    <div key={s.id} className={`rounded-xl border px-4 py-4 ${rowBg}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`break-words text-sm font-bold ${t.text}`}>{s.route_name}</p>
                          <p className={`mt-1 text-xs ${t.textSub}`}>{s.bus_plate} | {s.driver_name || "--"} | {s.helper_name || "--"}</p>
                          <p className={`mt-1 text-xs ${t.textMuted}`}>Starts {fmt(s.scheduled_start_time)}</p>
                        </div>
                        <Pill color={s.status === "PLANNED" ? "amber" : s.status === "COMPLETED" ? "emerald" : "slate"} isDark={isDark}>{s.status}</Pill>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Btn tone="primary" onClick={() => startEditingSchedule(s)} className="!rounded-full !px-3 !py-2 text-[11px]">Edit</Btn>
                        <Btn tone="danger" onClick={() => deleteSchedule(s)} disabled={scheduleDeleteBusyId === s.id} className="!rounded-full !px-3 !py-2 text-[11px]">
                          {scheduleDeleteBusyId === s.id ? "Deleting..." : "Delete"}
                        </Btn>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          </div>
        )}

        {/* ACTIVITY */}
        {activeSection === "analytics" && (
          <div className="grid gap-5 xl:grid-cols-2">
            <div>
              <SLabel t={t}>Live Trips</SLabel>
              {dashboard?.live_trips?.length ? dashboard.live_trips.map(trip => (
                <GlassCard key={trip.id} t={t} className="!p-4 mb-3">
                  <div className="flex items-start justify-between"><div><p className={`text-sm font-bold ${t.text}`}>{trip.route_name}</p><p className={`text-xs mt-0.5 ${t.textSub}`}>Bus {trip.bus_plate} | {trip.driver_name} | {trip.helper_name}</p></div><Pill color={trip.deviation_mode ? "amber" : "emerald"} isDark={isDark}>{trip.deviation_mode ? "Deviation" : "Normal"}</Pill></div>
                  <div className="mt-3 grid grid-cols-2 gap-2"><div className={`rounded-xl px-3 py-2 text-xs leading-5 ${t.textSub} ${rowBg}`}>Started {fmt(trip.started_at)}</div><div className={`rounded-xl px-3 py-2 text-xs break-all leading-5 ${t.textSub} ${rowBg}`}>{trip.latest_location ? `GPS ${Number(trip.latest_location.lat).toFixed(4)}, ${Number(trip.latest_location.lng).toFixed(4)}` : "No GPS yet"}</div></div>
                </GlassCard>
              )) : <GlassCard t={t}><p className={`text-sm ${t.textSub}`}>No live trips right now.</p></GlassCard>}
            </div>
            <div>
              <SLabel t={t}>Recent Bookings</SLabel>
              {dashboard?.recent_bookings?.length ? dashboard.recent_bookings.map(b => (
                <GlassCard key={b.id} t={t} className="!p-4 mb-3">
                  <div className="flex items-start justify-between"><div><p className={`text-sm font-bold ${t.text}`}>Booking #{b.id}</p><p className={`text-xs mt-0.5 ${t.textSub}`}>{b.route_name} | {b.bus_plate}</p></div><Pill color={b.status === "CONFIRMED" ? "emerald" : b.status === "CANCELLED" ? "red" : "amber"} isDark={isDark}>{b.status}</Pill></div>
                  <div className="mt-2 grid grid-cols-2 gap-2"><div className={`rounded-xl px-3 py-2 text-xs ${t.textSub} ${rowBg}`}>{b.passenger_name}</div><div className={`rounded-xl px-3 py-2 text-xs ${t.textSub} ${rowBg}`}>{b.seats_count} seats | {fmtMoney(b.fare_total)}</div></div>
                </GlassCard>
              )) : <GlassCard t={t}><p className={`text-sm ${t.textSub}`}>No bookings yet.</p></GlassCard>}
            </div>
            <div>
              <SLabel t={t}>Booking Lifecycle</SLabel>
              {recentBookingFlow.length ? recentBookingFlow.map(flow => (
                <GlassCard key={flow.id} t={t} className="!p-4 mb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm font-bold ${t.text}`}>Booking #{flow.id} | {flow.passenger_name}</p>
                      <p className={`text-xs mt-0.5 ${t.textSub}`}>{flow.route_name} | {flow.bus_plate}</p>
                    </div>
                    <Pill color={flow.completed_at ? "emerald" : flow.checked_in_at ? "sky" : flow.accepted_by_helper_at ? "amber" : "slate"} isDark={isDark}>
                      {flow.completed_at ? "Completed" : flow.checked_in_at ? "Onboard" : flow.accepted_by_helper_at ? "Accepted" : "Pending"}
                    </Pill>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className={`rounded-xl px-3 py-2 text-xs ${t.textSub} ${rowBg}`}>Payment: {flow.payment_method || "UNPAID"} | {flow.payment_status}</div>
                    <div className={`rounded-xl px-3 py-2 text-xs ${t.textSub} ${rowBg}`}>Accepted: {flow.accepted_by_helper_name ? `${flow.accepted_by_helper_name} at ${fmt(flow.accepted_by_helper_at)}` : "Waiting for helper acceptance"}</div>
                    <div className={`rounded-xl px-3 py-2 text-xs ${t.textSub} ${rowBg}`}>Boarded: {flow.checked_in_by_name ? `${flow.checked_in_by_name} at ${fmt(flow.checked_in_at)}` : "Not boarded yet"}</div>
                    <div className={`rounded-xl px-3 py-2 text-xs ${t.textSub} ${rowBg}`}>Completed: {flow.completed_by_name ? `${flow.completed_by_name} at ${fmt(flow.completed_at)}` : "Ride still active"}</div>
                  </div>
                </GlassCard>
              )) : <GlassCard t={t}><p className={`text-sm ${t.textSub}`}>No booking lifecycle activity yet.</p></GlassCard>}
            </div>
            <div>
              <SLabel t={t}>Recent Payments</SLabel>
              {dashboard?.recent_payments?.length ? dashboard.recent_payments.map(p => (
                <GlassCard key={p.id} t={t} className="!p-4 mb-3">
                  <div className="flex items-start justify-between"><div><p className={`text-sm font-bold ${t.text}`}>Payment #{p.id}</p><p className={`text-xs mt-0.5 ${t.textSub}`}>Booking #{p.booking_id} | {p.route_name}</p></div><Pill color={p.status === "SUCCESS" ? "emerald" : p.status === "FAILED" ? "red" : "amber"} isDark={isDark}>{p.status}</Pill></div>
                  <div className="mt-2 grid grid-cols-2 gap-2"><div className={`rounded-xl px-3 py-2 text-xs ${t.textSub} ${rowBg}`}>{p.method} | {fmtMoney(p.amount)}</div><div className={`rounded-xl px-3 py-2 text-xs ${t.textSub} ${rowBg}`}>{p.created_by_name}</div></div>
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
        {activeSection === "buses" && (
          <div className="space-y-4">
              <GlassCard t={t}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <SLabel t={t}>{editingBusId ? "Edit Bus" : "Add New Bus"}</SLabel>
                  </div>
                  {editingBusId ? (
                    <button type="button" onClick={resetBusForm} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${rowBg} ${t.text}`}>
                      Cancel
                    </button>
                  ) : null}
                </div>
                <div className="space-y-3">
                  {busMgmtMsg ? <p className="text-sm font-semibold text-emerald-600">{busMgmtMsg}</p> : null}
                  <InputField label="Bus Name / Identifier" value={busName} onChange={setBusName} placeholder="MetroBus Lakeside Express" t={t} />
                  <InputField label="Plate Number" value={busPlate} onChange={setBusPlate} placeholder="BA 1 CHA 2233" t={t} />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InputField label="Model Year" value={busYear} onChange={setBusYear} type="number" placeholder="2024" t={t} />
                    <SelectField label="Condition" value={busCondition} onChange={setBusCondition} t={t} options={[{ value: "NEW", label: "New" }, { value: "NORMAL", label: "Normal" }, { value: "OLD", label: "Old" }]} />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  <Btn tone="primary" onClick={saveBus} disabled={busMgmtBusy} className="w-full !py-4">
                    {busMgmtBusy ? (editingBusId ? "Saving..." : "Creating...") : (editingBusId ? "Save Bus Changes" : "Add Bus")}
                  </Btn>
                </div>
              </GlassCard>

              <GlassCard t={t}>
                <SLabel t={t}>Existing Buses ({busList.length})</SLabel>
                <div className="max-h-[48rem] overflow-y-auto space-y-3 pr-1">
                  {busList.length === 0 && <p className={`text-sm ${t.textSub}`}>No buses registered yet.</p>}
                  {busList.map(bus => (
                    <div key={bus.id} className={`rounded-xl border px-4 py-4 ${rowBg}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`break-words text-sm font-bold leading-snug ${t.text}`}>{bus.display_name || bus.plate_number}</p>
                          <p className={`mt-0.5 break-words text-xs leading-5 ${t.textSub}`}>{bus.plate_number} | {bus.condition} | {bus.model_year || "Year N/A"}</p>
                          <p className={`mt-1 break-words text-xs leading-5 ${t.textSub}`}>{bus.capacity} seats | layout {bus.layout_rows}x{bus.layout_columns}</p>
                          <p className={`mt-1 break-words text-xs leading-5 ${t.textSub}`}>driver: {bus.driver_name || "--"} | helper: {bus.helper_name || "--"}</p>
                        </div>
                        <Pill color={bus.is_active ? "emerald" : "slate"} isDark={isDark}>{bus.is_active ? "ACTIVE" : "OFF"}</Pill>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Btn tone="primary" onClick={() => startEditingBus(bus)} className="!rounded-full !px-3 !py-2 text-[11px]">Edit</Btn>
                        <Btn tone="danger" onClick={() => deleteBus(bus)} disabled={busDeleteBusyId === bus.id} className="!rounded-full !px-3 !py-2 text-[11px]">
                          {busDeleteBusyId === bus.id ? "Deleting..." : "Delete"}
                        </Btn>
                      </div>
                      {(bus.exterior_photo_url || bus.interior_photo_url || bus.seat_photo_url) ? (
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
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
        )}

        {activeSection === "staff" && (
          <div className="space-y-4">
              <GlassCard t={t}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <SLabel t={t}>{editingUserId ? "Edit Staff Account" : "Add Staff Account"}</SLabel>
                  </div>
                  {editingUserId ? (
                    <button type="button" onClick={resetUserForm} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${rowBg} ${t.text}`}>
                      Cancel
                    </button>
                  ) : null}
                </div>
                <div className="space-y-3">
                  {uMgmtMsg ? <p className="text-sm font-semibold text-emerald-600">{uMgmtMsg}</p> : null}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {["DRIVER", "HELPER", "ADMIN"].map(role => (
                      <button key={role} type="button" onClick={() => setURole(role)} className={`rounded-xl py-3 text-xs font-black uppercase tracking-widest transition ${uRole === role ? "bg-[linear-gradient(135deg,#ff6b73,#ff8a5b)] text-white" : isDark ? "bg-white/10 text-slate-400 hover:bg-white/20" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                        {role}
                      </button>
                    ))}
                  </div>
                  <InputField label="Full Name" value={uName} onChange={setUName} placeholder="Ramesh Kumar" t={t} />
                  <InputField label="Phone (login ID)" value={uPhone} onChange={setUPhone} placeholder="9800000000" t={t} />
                  <InputField label="Email (optional)" value={uEmail} onChange={setUEmail} placeholder="ramesh@example.com" t={t} />
                  <InputField label="Address" value={uAddress} onChange={setUAddress} placeholder="Pokhara-8, Nepal" t={t} />
                  <InputField label={editingUserId ? "Password (optional)" : "Password"} value={uPass} onChange={setUPass} placeholder={editingUserId ? "Leave blank to keep current password" : "Min 6 characters"} type="password" t={t} />
                  <FileField label="Official Staff Photo" file={uOfficialPhoto} onChange={setUOfficialPhoto} t={t} />
                  {uRole === "DRIVER" ? (
                    <>
                      <InputField label="License Number" value={uLicenseNumber} onChange={setULicenseNumber} placeholder="NP-DRV-009812" t={t} />
                      <FileField label="License Photo" file={uLicensePhoto} onChange={setULicensePhoto} t={t} />
                    </>
                  ) : null}
                  <Btn tone="success" onClick={saveUser} disabled={uMgmtBusy} className="w-full !py-4">
                    {uMgmtBusy ? (editingUserId ? "Saving..." : "Creating...") : (editingUserId ? "Save Staff Changes" : `Add ${uRole.charAt(0) + uRole.slice(1).toLowerCase()}`)}
                  </Btn>
                </div>
              </GlassCard>

              <GlassCard t={t}>
                <div className="flex items-center justify-between mb-3">
                  <SLabel t={t}>Staff Accounts ({staffUsers.length})</SLabel>
                  <div className="flex gap-1">
                    {["ALL", "DRIVER", "HELPER", "ADMIN"].map(r => (
                      <button key={r} type="button" onClick={() => setStaffFilter(r)} className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition ${userRoleFilter === r ? "bg-[linear-gradient(135deg,#ff6b73,#ff8a5b)] text-white" : isDark ? "bg-white/10 text-slate-400 hover:bg-white/20" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                {reviewMsg ? <p className="mb-3 text-sm font-semibold text-emerald-600">{reviewMsg}</p> : null}
                <div className="max-h-[48rem] overflow-y-auto space-y-3 pr-1">
                  {staffUsers.length === 0 && <p className={`text-sm ${t.textSub}`}>No staff users loaded.</p>}
                  {staffUsers.map(u => (
                    <div key={u.id} className={`rounded-xl border px-4 py-4 ${rowBg}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {u.official_photo_url ? <img src={u.official_photo_url} alt={u.full_name} className="h-14 w-14 rounded-2xl object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff0ef] text-sm font-black text-[#ff6b73]">{(u.full_name || "MB").slice(0, 2).toUpperCase()}</div>}
                          <div className="min-w-0">
                            <p className={`break-words text-sm font-bold leading-snug ${t.text}`}>{u.full_name}</p>
                            <p className={`mt-0.5 break-all text-xs leading-5 ${t.textSub}`}>{u.phone}{u.email ? ` | ${u.email}` : ""}</p>
                            {u.address ? <p className={`mt-1 break-words text-xs leading-5 ${t.textSub}`}>{u.address}</p> : null}
                            {u.license_number ? <p className={`mt-1 break-words text-xs leading-5 ${t.textSub}`}>License: {u.license_number}</p> : null}
                          </div>
                        </div>
                        <Pill color={u.role === "ADMIN" ? "red" : u.role === "DRIVER" ? "sky" : u.role === "HELPER" ? "indigo" : "slate"} isDark={isDark}>{u.role}</Pill>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {u.official_photo_verified ? <Pill color="emerald" isDark={isDark}>Photo OK</Pill> : u.official_photo_url ? <Pill color="amber" isDark={isDark}>Photo Pending</Pill> : <Pill color="slate" isDark={isDark}>No Photo</Pill>}
                        {u.role === "DRIVER" ? (u.license_verified ? <Pill color="emerald" isDark={isDark}>License OK</Pill> : u.license_photo_url ? <Pill color="amber" isDark={isDark}>License Pending</Pill> : <Pill color="slate" isDark={isDark}>No License</Pill>) : null}
                        {!u.is_active ? <Pill color="slate" isDark={isDark}>Inactive</Pill> : null}
                      </div>
                      {(u.official_photo_url || u.license_photo_url) ? (
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {u.official_photo_url ? <img src={u.official_photo_url} alt={`${u.full_name} official`} className="h-24 w-full rounded-xl object-cover" /> : <div className={`flex h-24 items-center justify-center rounded-xl border text-xs ${t.textSub} ${rowBg}`}>No official photo</div>}
                          {u.role === "DRIVER" ? (u.license_photo_url ? <img src={u.license_photo_url} alt={`${u.full_name} license`} className="h-24 w-full rounded-xl object-cover" /> : <div className={`flex h-24 items-center justify-center rounded-xl border text-xs ${t.textSub} ${rowBg}`}>No license photo</div>) : <div className={`flex h-24 items-center justify-center rounded-xl border text-xs ${t.textSub} ${rowBg}`}>License not required</div>}
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Btn tone="primary" onClick={() => startEditingUser(u)} className="!rounded-full !px-3 !py-2 text-[11px]">Edit</Btn>
                        {user?.id !== u.id ? (
                          <Btn tone="danger" onClick={() => deleteUser(u)} disabled={userDeleteBusyId === u.id} className="!rounded-full !px-3 !py-2 text-[11px]">
                            {userDeleteBusyId === u.id ? "Deleting..." : "Delete"}
                          </Btn>
                        ) : null}
                        {u.official_photo_url ? (
                          <button
                            type="button"
                            onClick={() => reviewUser(u, { official_photo_verified: !u.official_photo_verified })}
                            disabled={reviewBusyId === u.id}
                            className={`rounded-full px-3 py-2 text-[11px] font-bold transition ${u.official_photo_verified ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"} disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            {u.official_photo_verified ? "Revoke Photo" : "Verify Photo"}
                          </button>
                        ) : null}
                        {u.role === "DRIVER" && u.license_photo_url ? (
                          <button
                            type="button"
                            onClick={() => reviewUser(u, { license_verified: !u.license_verified })}
                            disabled={reviewBusyId === u.id}
                            className={`rounded-full px-3 py-2 text-[11px] font-bold transition ${u.license_verified ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"} disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            {u.license_verified ? "Revoke License" : "Verify License"}
                          </button>
                        ) : null}
                        {user?.id !== u.id ? (
                          <button
                            type="button"
                            onClick={() => reviewUser(u, { is_active: !u.is_active })}
                            disabled={reviewBusyId === u.id}
                            className={`rounded-full px-3 py-2 text-[11px] font-bold transition ${u.is_active ? "bg-slate-200 text-slate-700 hover:bg-slate-300" : "bg-[#fff0ef] text-[#ff6b73] hover:bg-[#ffe3df]"} disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            {u.is_active ? "Set Inactive" : "Activate Account"}
                          </button>
                        ) : (
                          <Pill color="slate" isDark={isDark}>Current Admin</Pill>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
}

