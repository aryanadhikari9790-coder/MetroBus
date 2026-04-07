import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
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
function StopMapPicker({ onPick }) {
  useMapEvents({
    click(event) {
      onPick?.(event.latlng);
    },
  });
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
  const [recentStops, setRecentStops]       = useState([]);
  const [recentRoutes, setRecentRoutes]     = useState([]);
  const [routeBusy, setRouteBusy]           = useState(false);
  const [routeMsg, setRouteMsg]             = useState("");
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
  const loadRoute  = async () => { try { const r = await api.get("/api/transport/admin/route-builder/"); setBuilderStops(r.data.stops || []); setRecentStops(r.data.recent_stops || []); setRecentRoutes(r.data.recent_routes || []); } catch (e) { setErr(p => p || e?.response?.data?.detail || "Failed to load routes."); } };
  const loadSched  = async () => { try { const r = await api.get("/api/trips/admin/schedules/"); setSchedOpts({ routes: r.data.routes || [], buses: r.data.buses || [], drivers: r.data.drivers || [], helpers: r.data.helpers || [], recent_schedules: r.data.recent_schedules || [] }); } catch (e) { setErr(p => p || e?.response?.data?.detail || "Failed to load schedules."); } };
  const loadBuses  = async () => { try { const r = await api.get("/api/transport/admin/buses/"); setBusList(r.data.buses || []); } catch { /* silent */ } };
  const loadUsers  = async (role = null) => {
    try {
      const r = await api.get(`/api/auth/admin/users/${role ? `?role=${role}` : ""}`);
      setUserList(r.data.users || []);
    } catch { /* silent */ }
  };
  const reloadFilteredUsers = async () => loadUsers(userRoleFilter === "ALL" ? null : userRoleFilter);

  const selectedScheduleBus = useMemo(() => schedOpts.buses.find(b => String(b.id) === String(sBusId)) || null, [sBusId, schedOpts.buses]);

  useEffect(() => { loadDB(); loadRoute(); loadSched(); loadBuses(); loadUsers(); const id = setInterval(() => loadDB({ silent: true }), 10000); return () => clearInterval(id); }, []);
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

  const handleLogout = () => { clearToken(); navigate("/auth/login"); };

  const overview = dashboard?.overview; const roleCounts = overview?.role_counts || EMPTY_OBJ; const trips = overview?.trips || EMPTY_OBJ; const bookings = overview?.bookings || EMPTY_OBJ; const rideOps = overview?.ride_ops || EMPTY_OBJ; const payments = overview?.payments || EMPTY_OBJ; const wallets = overview?.wallets || EMPTY_OBJ;
  const paymentRows = useMemo(() => Object.entries(payments?.methods || {}).map(([method, stats]) => ({ method, total: stats.total || 0, success: stats.success || 0, rate: stats.total ? Math.round((stats.success / stats.total) * 100) : 0 })), [payments]);
  const recentBookingFlow = dashboard?.recent_booking_flow || [];
  const rewardLeaderboard = dashboard?.reward_leaderboard || [];
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
  const clearRoute  = () => { setRouteName(""); setRouteCity("Pokhara"); setRouteActive(true); setSelectedStopIds([]); setSegmentFares([]); setRouteMsg(""); };
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
            <Btn tone="ghost" onClick={() => { loadDB(); loadRoute(); loadSched(); }} className="!py-2 !px-3 text-xs">â†»</Btn>
            <Btn tone="danger" onClick={handleLogout} className="!py-2 !px-3 text-xs">Logout</Btn>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5">
        {err && <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${t.errBanner}`}>{err}</div>}
        {stopMsg && <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${t.okBanner}`}>✓ {stopMsg}</div>}
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
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Wallet Float" value={fmtMoney(wallets.total_balance ?? 0)} sub="Passenger balance held" accent="text-fuchsia-500" t={t} />
              <StatCard label="Active Passes" value={wallets.active_passes ?? 0} sub={`${wallets.weekly_passes || 0} weekly Â· ${wallets.monthly_passes || 0} monthly`} accent="text-sky-500" t={t} />
              <StatCard label="Reward Ready" value={wallets.reward_ready ?? 0} sub={`${wallets.reward_threshold || 100} points unlock a free ride`} accent="text-violet-500" t={t} />
              <StatCard label="Free Rides Used" value={wallets.free_rides_redeemed ?? 0} sub={`${wallets.total_reward_points || 0} live points across wallets`} accent="text-emerald-500" t={t} />
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <StatCard label="Await Accept" value={rideOps.awaiting_acceptance ?? 0} sub="Helper has not accepted yet" accent="text-amber-500" t={t} />
              <StatCard label="Await Payment" value={rideOps.awaiting_payment ?? 0} sub="Accepted but not paid" accent="text-rose-500" t={t} />
              <StatCard label="Ready To Board" value={rideOps.ready_to_board ?? 0} sub="Paid and waiting" accent="text-sky-500" t={t} />
              <StatCard label="Onboard" value={rideOps.onboard ?? 0} sub="Passengers riding now" accent="text-emerald-500" t={t} />
              <StatCard label="Completed Today" value={rideOps.completed_today ?? 0} sub="Seats released today" accent="text-violet-500" t={t} />
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
                          <p className={`text-xs mt-1 ${t.textSub}`}>{row.pass_plan ? `${row.pass_plan} Â· ${row.pass_rides_remaining} rides left` : "No active pass"}</p>
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
        {activeTab === "routes" && (
          <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
            <div className="space-y-4">
              <GlassCard t={t}>
                <SLabel t={t}>Add Stop To Main Map</SLabel>
                <p className={`text-xs mb-4 ${t.textSub}`}>Tap the map on the right to pin a new stop, then save it so the whole MetroBus system can use it.</p>
                <div className="space-y-3">
                  <InputField label="Stop Name" value={stopName} onChange={setStopName} placeholder="Bindhyabasini Gate" t={t} />
                  <div className="grid grid-cols-2 gap-3">
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
                  <div className="grid grid-cols-2 gap-3">
                    <Btn tone="ghost" onClick={clearStopForm} className="w-full !py-4">Clear</Btn>
                    <Btn tone="success" onClick={createStop} disabled={stopBusy} className="w-full !py-4">{stopBusy ? "Saving..." : "Add Stop"}</Btn>
                  </div>
                </div>
              </GlassCard>
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
                <div className={`px-5 py-4 border-b ${t.divider}`}><SLabel t={t}>Stop Map â€” Build Routes + Pin Stops</SLabel><p className={`text-sm font-bold -mt-2 ${t.text}`}>{selectedStopIds.length} stops selected for the route builder</p></div>
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
                        {stop.is_active ? <button type="button" onClick={() => toggleStop(stop.id)} className="rounded-lg bg-indigo-500/15 px-3 py-2 text-[11px] font-bold text-indigo-500">{selectedStopIds.includes(stop.id) ? "Remove" : "Use"}</button> : null}
                        <Pill color={stop.is_active ? "emerald" : "slate"} isDark={isDark}>{stop.is_active ? "ACTIVE" : "INACTIVE"}</Pill>
                      </div>
                    </div>
                  ))}
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
                  <SelectField label="Bus" value={sBusId} onChange={setSBusId} t={t} options={schedOpts.buses.map(b => ({ value: b.id, label: `${b.display_name || b.plate_number} · ${b.plate_number}` }))} />
                  <SelectField label="Driver" value={sDriverId} onChange={setSDriverId} t={t} options={schedOpts.drivers.map(d => ({ value: d.id, label: d.full_name }))} />
                  <SelectField label="Helper" value={sHelperId} onChange={setSHelperId} t={t} options={schedOpts.helpers.map(h => ({ value: h.id, label: h.full_name }))} />
                </div>
                {selectedScheduleBus ? (
                  <div className={`rounded-xl border px-4 py-3 text-xs ${rowBg}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${t.label}`}>Assigned Bus Snapshot</p>
                    <p className={`mt-2 text-sm font-bold ${t.text}`}>{selectedScheduleBus.display_name || selectedScheduleBus.plate_number}</p>
                    <p className={`mt-1 ${t.textSub}`}>{selectedScheduleBus.plate_number} · {selectedScheduleBus.capacity} seats</p>
                    <p className={`mt-2 ${t.textSub}`}>Driver: {selectedScheduleBus.driver_name || "Not assigned"} · Helper: {selectedScheduleBus.helper_name || "Not assigned"}</p>
                  </div>
                ) : null}
                <InputField label="Scheduled Start Time" type="datetime-local" value={sStartTime} onChange={setSStartTime} t={t} />
                <div className={`rounded-xl border px-4 py-3 text-xs ${isDark ? "border-white/5 bg-white/5 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"}`}>Schedules appear on the driver and helper dashboards so they can start assigned trips without manual setup. MetroBus now also blocks same-time conflicts for the same bus, driver, or helper.</div>
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
              <SLabel t={t}>Booking Lifecycle</SLabel>
              {recentBookingFlow.length ? recentBookingFlow.map(flow => (
                <GlassCard key={flow.id} t={t} className="!p-4 mb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm font-bold ${t.text}`}>Booking #{flow.id} · {flow.passenger_name}</p>
                      <p className={`text-xs mt-0.5 ${t.textSub}`}>{flow.route_name} Â· {flow.bus_plate}</p>
                    </div>
                    <Pill color={flow.completed_at ? "emerald" : flow.checked_in_at ? "sky" : flow.accepted_by_helper_at ? "amber" : "slate"} isDark={isDark}>
                      {flow.completed_at ? "Completed" : flow.checked_in_at ? "Onboard" : flow.accepted_by_helper_at ? "Accepted" : "Pending"}
                    </Pill>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className={`rounded-xl px-3 py-2 text-xs ${t.textSub} ${rowBg}`}>Payment: {flow.payment_method || "UNPAID"} Â· {flow.payment_status}</div>
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
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <SLabel t={t}>{editingBusId ? "Edit Bus" : "Add New Bus"}</SLabel>
                    <p className={`text-xs ${t.textSub}`}>{editingBusId ? "Update the selected bus profile, layout, and media." : "Add the full bus profile, media, and seat layout used across the MetroBus system."}</p>
                  </div>
                  {editingBusId ? (
                    <button type="button" onClick={resetBusForm} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${rowBg} ${t.text}`}>
                      Cancel
                    </button>
                  ) : null}
                </div>
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
                  <Btn tone="primary" onClick={saveBus} disabled={busMgmtBusy} className="w-full !py-4">
                    {busMgmtBusy ? (editingBusId ? "Saving..." : "Creating...") : (editingBusId ? "Save Bus Changes" : "Add Bus")}
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
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Btn tone="primary" onClick={() => startEditingBus(bus)} className="!rounded-full !px-3 !py-2 text-[11px]">Edit</Btn>
                        <Btn tone="danger" onClick={() => deleteBus(bus)} disabled={busDeleteBusyId === bus.id} className="!rounded-full !px-3 !py-2 text-[11px]">
                          {busDeleteBusyId === bus.id ? "Deleting..." : "Delete"}
                        </Btn>
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
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <SLabel t={t}>{editingUserId ? "Edit Staff Account" : "Add Staff Account"}</SLabel>
                    <p className={`text-xs ${t.textSub}`}>{editingUserId ? "Update the selected staff profile, login phone, and documents. Leave password blank to keep it unchanged." : "Create fully documented driver, helper, or admin accounts. Passengers still self-register, and admin review happens after upload."}</p>
                  </div>
                  {editingUserId ? (
                    <button type="button" onClick={resetUserForm} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${rowBg} ${t.text}`}>
                      Cancel
                    </button>
                  ) : null}
                </div>
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
                  <SLabel t={t}>Staff Accounts ({userList.filter(u => u.role !== "PASSENGER").length})</SLabel>
                  <div className="flex gap-1">
                    {["ALL", "DRIVER", "HELPER", "ADMIN"].map(r => (
                      <button key={r} type="button" onClick={() => setStaffFilter(r)} className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition ${userRoleFilter === r ? "bg-indigo-600 text-white" : isDark ? "bg-white/10 text-slate-400 hover:bg-white/20" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                {reviewMsg && <div className={`mb-3 rounded-xl border px-4 py-3 text-sm ${t.infoBanner}`}>OK: {reviewMsg}</div>}
                <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
                  {userList.length === 0 && <p className={`text-sm ${t.textSub}`}>No users loaded.</p>}
                  {userList.map(u => (
                    <div key={u.id} className={`rounded-xl border px-4 py-4 ${rowBg}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {u.official_photo_url ? <img src={u.official_photo_url} alt={u.full_name} className="h-14 w-14 rounded-2xl object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-sm font-black text-indigo-600">{(u.full_name || "MB").slice(0, 2).toUpperCase()}</div>}
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
                        {u.official_photo_verified ? <Pill color="emerald" isDark={isDark}>Photo OK</Pill> : u.official_photo_url ? <Pill color="amber" isDark={isDark}>Photo Pending</Pill> : <Pill color="slate" isDark={isDark}>No Photo</Pill>}
                        {u.role === "DRIVER" ? (u.license_verified ? <Pill color="emerald" isDark={isDark}>License OK</Pill> : u.license_photo_url ? <Pill color="amber" isDark={isDark}>License Pending</Pill> : <Pill color="slate" isDark={isDark}>No License</Pill>) : null}
                        {!u.is_active ? <Pill color="slate" isDark={isDark}>Inactive</Pill> : null}
                      </div>
                      {(u.official_photo_url || u.license_photo_url) ? (
                        <div className="mt-3 grid grid-cols-2 gap-2">
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
                            className={`rounded-full px-3 py-2 text-[11px] font-bold transition ${u.is_active ? "bg-slate-200 text-slate-700 hover:bg-slate-300" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"} disabled:cursor-not-allowed disabled:opacity-50`}
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
          </div>
        )}
      </div>
    </div>
  );
}

