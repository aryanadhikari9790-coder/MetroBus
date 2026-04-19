import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { divIcon } from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { api } from "../../api";
import { useAuth } from "../../AuthContext";
import { clearToken } from "../../auth";
import { snapRouteToRoad } from "../../lib/mapRoute";
import { useTheme } from "../../ThemeContext";
import { useNotification } from "../../NotificationContext";

const LIGHT = {
  "--bg": "#f7efe7",
  "--bg-soft": "#fff7f0",
  "--surface": "rgba(255,255,255,0.94)",
  "--surface-strong": "rgba(255,255,255,0.98)",
  "--surface-muted": "rgba(255,244,235,0.92)",
  "--border": "rgba(73,39,94,0.10)",
  "--text": "#2d1838",
  "--muted": "#756681",
  "--primary": "#4b2666",
  "--accent": "#ff8a1f",
  "--accent-strong": "#ff6c2f",
  "--accent-soft": "#fff1df",
  "--success": "#17a567",
  "--warning": "#f39c12",
  "--danger": "#db3d4f",
  "--header": "rgba(255,250,245,0.90)",
  "--sidebar": "linear-gradient(180deg, rgba(255,250,245,0.96), rgba(251,241,232,0.92))",
  "--shadow": "0 18px 36px rgba(73,39,94,0.12)",
  "--shadow-strong": "0 24px 44px rgba(75,38,102,0.18)",
  "--card-alt": "rgba(255,244,235,0.88)",
  "--chart-grid": "rgba(73,39,94,0.10)",
};

const DARK = {
  "--bg": "#190f24",
  "--bg-soft": "#24152f",
  "--surface": "rgba(37,24,49,0.90)",
  "--surface-strong": "rgba(44,27,58,0.96)",
  "--surface-muted": "rgba(53,34,69,0.92)",
  "--border": "rgba(255,255,255,0.09)",
  "--text": "#fff5ef",
  "--muted": "#c8b8c7",
  "--primary": "#8d5abf",
  "--accent": "#ff962d",
  "--accent-strong": "#ff7a3c",
  "--accent-soft": "rgba(255,150,45,0.16)",
  "--success": "#1fcf81",
  "--warning": "#ffb84d",
  "--danger": "#ff6474",
  "--header": "rgba(25,15,36,0.86)",
  "--sidebar": "linear-gradient(180deg, rgba(25,15,36,0.98), rgba(33,21,46,0.96))",
  "--shadow": "0 22px 42px rgba(0,0,0,0.28)",
  "--shadow-strong": "0 26px 48px rgba(0,0,0,0.34)",
  "--card-alt": "rgba(53,34,69,0.88)",
  "--chart-grid": "rgba(255,255,255,0.08)",
};

function GlassCard({ children, className = "" }) { return <div className={`rounded-[1.6rem] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] backdrop-blur-xl ${className}`}>{children}</div>; }
function Pill({ children, color = "slate" }) {
  const tones = {
    emerald: "border-[rgba(23,165,103,0.18)] bg-[rgba(23,165,103,0.12)] text-[var(--success)]",
    sky: "border-[rgba(51,133,255,0.16)] bg-[rgba(51,133,255,0.12)] text-[#2c73d2]",
    amber: "border-[rgba(243,156,18,0.18)] bg-[rgba(243,156,18,0.12)] text-[var(--warning)]",
    red: "border-[rgba(219,61,79,0.18)] bg-[rgba(219,61,79,0.12)] text-[var(--danger)]",
    indigo: "border-[rgba(75,38,102,0.16)] bg-[var(--accent-soft)] text-[var(--primary)]",
    slate: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]",
  };
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${tones[color] || tones.slate}`}>{children}</span>;
}
function Btn({ children, onClick, disabled, tone = "primary", className = "" }) {
  const m = {
    primary: "bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-white shadow-[var(--shadow-strong)] hover:translate-y-[-1px]",
    success: "bg-[linear-gradient(135deg,var(--success),var(--accent))] text-white shadow-[var(--shadow)] hover:translate-y-[-1px]",
    danger: "bg-[linear-gradient(135deg,#a92b3c,#ff6e55)] text-white shadow-[var(--shadow)] hover:translate-y-[-1px]",
    ghost: "border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text)] shadow-[var(--shadow)] hover:translate-y-[-1px]",
  };
  return <button type="button" onClick={onClick} disabled={disabled} className={`rounded-[1rem] px-5 py-3 text-sm font-black tracking-[0.04em] transition disabled:opacity-40 disabled:cursor-not-allowed ${m[tone]} ${className}`}>{children}</button>;
}
function SLabel({ children }) { return <p className="mb-3 text-[0.68rem] font-black uppercase tracking-[0.24em] text-[var(--muted)]">{children}</p>; }
function StatCard({ label, value, sub, accent = "" }) {
  return <GlassCard className="h-full"><p className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">{label}</p><p className={`mt-2 break-words text-3xl font-black leading-tight ${accent || "text-[var(--text)]"}`}>{value}</p>{sub && <p className="mt-1.5 break-words text-xs leading-5 text-[var(--muted)]">{sub}</p>}</GlassCard>;
}
function InputField({ label, value, onChange, placeholder, type = "text" }) {
  return <div><label className="mb-1.5 block text-[0.64rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">{label}</label><input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--primary)]" /></div>;
}
function FileField({ label, onChange, file, accept = "image/*" }) {
  return (
    <div>
      <label className="mb-1.5 block text-[0.64rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">{label}</label>
      <label className="flex cursor-pointer items-center justify-between rounded-[1rem] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--text)] transition">
        <span className={file ? "font-semibold" : ""}>{file?.name || "Choose file"}</span>
        <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">Upload</span>
        <input type="file" accept={accept} onChange={e => onChange(e.target.files?.[0] || null)} className="hidden" />
      </label>
    </div>
  );
}
function SelectField({ label, value, onChange, options }) {
  return <div><label className="mb-1.5 block text-[0.64rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">{label}</label><select value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--text)] outline-none transition focus:border-[var(--primary)]">{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>;
}
function Icon({ name, className = "h-5 w-5" }) {
  const common = { className, fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24" };
  switch (name) {
    case "dashboard": return <svg {...common}><path d="M4 13h6V4H4v9Z" /><path d="M14 20h6v-6h-6v6Z" /><path d="M14 10h6V4h-6v6Z" /><path d="M4 20h6v-3H4v3Z" /></svg>;
    case "drivers": return <svg {...common}><circle cx="12" cy="7.5" r="3.2" /><path d="M5 19a7 7 0 0 1 14 0" /><path d="M17 6h3" /></svg>;
    case "helpers": return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3 19a6 6 0 0 1 12 0" /><path d="M18 8v6" /><path d="M15 11h6" /></svg>;
    case "buses": return <svg {...common}><rect x="5" y="6" width="14" height="11" rx="3" /><path d="M7 11h10" /><path d="M8 17v2" /><path d="M16 17v2" /></svg>;
    case "stops": return <svg {...common}><path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" /><circle cx="12" cy="10" r="2.2" /></svg>;
    case "routes": return <svg {...common}><path d="M5 18c2.4-4.2 3.6-10.1 6.1-13.9 1-1.5 3.5-1.5 4.5 0 1.1 1.6.8 3.6-.7 4.9L9.2 14.8" /><circle cx="6" cy="18" r="1.5" /><circle cx="18" cy="5" r="1.5" /></svg>;
    case "assignments": return <svg {...common}><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 8h6" /><path d="M9 12h6" /><path d="M9 16h4" /></svg>;
    case "analytics": return <svg {...common}><path d="M4 19h16" /><path d="M7 16V9" /><path d="M12 16V5" /><path d="M17 16v-3" /></svg>;
    case "reports": return <svg {...common}><path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h5" /><path d="M6 3h9l3 3v15H6z" /></svg>;
    case "settings": return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .28 1.7 1.7 0 0 0-.8 1.45V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-.8-1.45 1.7 1.7 0 0 0-1-.28 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.28-1 1.7 1.7 0 0 0-1.45-.8H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.45-.8 1.7 1.7 0 0 0 .28-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6c.36 0 .71-.1 1-.28A1.7 1.7 0 0 0 10.8 2.87V2.8a2 2 0 1 1 4 0v.09c0 .6.3 1.16.8 1.45.29.18.64.28 1 .28a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c0 .36.1.71.28 1 .29.5.85.8 1.45.8H21a2 2 0 1 1 0 4h-.09c-.6 0-1.16.3-1.45.8-.18.29-.28.64-.28 1Z" /></svg>;
    case "search": return <svg {...common}><circle cx="11" cy="11" r="6" /><path d="m20 20-3.5-3.5" /></svg>;
    case "bell": return <svg {...common}><path d="M15 17H5l1.4-1.4a2 2 0 0 0 .6-1.4V11a5 5 0 1 1 10 0v3.2a2 2 0 0 0 .6 1.4L19 17h-4" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>;
    case "plus": return <svg {...common}><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
    case "logout": return <svg {...common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>;
    case "refresh": return <svg {...common}><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>;
    case "download": return <svg {...common}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>;
    case "table": return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M9 4v16" /><path d="M15 4v16" /></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>;
  }
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
function RouteWaypointPicker({ enabled, onPick }) {
  useMapEvents({
    click(event) {
      if (!enabled) return;
      onPick?.(event.latlng);
    },
  });
  return null;
}
function RouteStopDraftPicker({ enabled, onPick }) {
  useMapEvents({
    click(event) {
      if (!enabled) return;
      onPick?.(event.latlng);
    },
  });
  return null;
}
function RouteDiversionPicker({ enabled, onPick }) {
  useMapEvents({
    click(event) {
      if (!enabled) return;
      onPick?.(event.latlng);
    },
  });
  return null;
}
function fmt(v) { if (!v) return "--"; try { return new Date(v).toLocaleString(); } catch { return v; } }
function fmtMoney(v) { return `NPR ${Number(v || 0).toLocaleString()}`; }
function buildRouteAnchorPoints(stops, waypoints) {
  if (!stops.length) return [];
  const points = [];
  stops.forEach((stop, index) => {
    const stopPoint = [Number(stop.lat), Number(stop.lng)];
    if (Number.isFinite(stopPoint[0]) && Number.isFinite(stopPoint[1])) points.push(stopPoint);
    const segmentWaypoints = (waypoints || [])
      .filter((waypoint) => Number(waypoint.segment_index) === index)
      .sort((a, b) => Number(a.seq || 0) - Number(b.seq || 0));
    segmentWaypoints.forEach((waypoint) => {
      const point = [Number(waypoint.lat), Number(waypoint.lng)];
      if (Number.isFinite(point[0]) && Number.isFinite(point[1])) points.push(point);
    });
  });
  return points;
}
function buildRouteSegmentLines(stops, waypoints) {
  return stops.slice(0, -1).map((stop, index) => {
    const start = [Number(stop.lat), Number(stop.lng)];
    const endStop = stops[index + 1];
    const end = [Number(endStop.lat), Number(endStop.lng)];
    const segmentWaypoints = (waypoints || [])
      .filter((waypoint) => Number(waypoint.segment_index) === index)
      .sort((a, b) => Number(a.seq || 0) - Number(b.seq || 0))
      .map((waypoint) => [Number(waypoint.lat), Number(waypoint.lng)])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    return [start, ...segmentWaypoints, end].filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  });
}
const routeWaypointIcon = (active = false) => divIcon({
  className: "",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  html: `<div style="width:16px;height:16px;border-radius:999px;background:${active ? "#ff8a1f" : "#fff7f0"};border:3px solid #4b2666;box-shadow:0 6px 14px rgba(75,38,102,0.20);"></div>`,
});

function SimpleLineChart({ points, color = "var(--accent)" }) {
  const values = (points || []).map((point) => Number(point.value || 0));
  const max = Math.max(...values, 1);
  const width = 320;
  const height = 160;
  const coords = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / Math.max(values.length - 1, 1)) * (width - 24) + 12;
    const y = height - ((value / max) * (height - 28) + 14);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full">
      {[0.25, 0.5, 0.75].map((step) => <line key={step} x1="0" x2={width} y1={height * step} y2={height * step} stroke="var(--chart-grid)" strokeDasharray="4 6" />)}
      <polyline fill="none" stroke={color} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" points={coords} />
      {values.map((value, index) => {
        const x = values.length === 1 ? width / 2 : (index / Math.max(values.length - 1, 1)) * (width - 24) + 12;
        const y = height - ((value / max) * (height - 28) + 14);
        return <circle key={`${index}-${value}`} cx={x} cy={y} r="4.5" fill={color} />;
      })}
    </svg>
  );
}

function SimpleBarChart({ items, color = "var(--primary)" }) {
  const max = Math.max(...items.map((item) => Number(item.value || 0)), 1);
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const ratio = Math.max(6, Math.round((Number(item.value || 0) / max) * 100));
        return (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-[var(--text)]">{item.label}</p>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">{item.value}</p>
            </div>
            <div className="h-2.5 rounded-full bg-[var(--card-alt)]">
              <div className="h-2.5 rounded-full" style={{ width: `${ratio}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SimpleDonutChart({ items }) {
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0) || 1;
  let offset = 0;
  const colors = ["var(--primary)", "var(--accent)", "var(--success)", "#3a86ff", "#9d4edd"];
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 42 42" className="h-40 w-40 shrink-0">
        <circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--card-alt)" strokeWidth="6" />
        {items.map((item, index) => {
          const value = Number(item.value || 0);
          const dash = (value / total) * 100;
          const piece = <circle key={item.label} cx="21" cy="21" r="15.915" fill="none" stroke={colors[index % colors.length]} strokeWidth="6" strokeDasharray={`${dash} ${100 - dash}`} strokeDashoffset={25 - offset} />;
          offset += dash;
          return piece;
        })}
        <text x="21" y="20" textAnchor="middle" className="fill-[var(--muted)] text-[4px] font-black uppercase tracking-[0.22em]">Usage</text>
        <text x="21" y="25" textAnchor="middle" className="fill-[var(--text)] text-[5px] font-black">{Math.round(total)}</text>
      </svg>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.label} className="flex items-center gap-3 text-sm">
            <span className="h-3 w-3 rounded-full" style={{ background: colors[index % colors.length] }} />
            <div>
              <p className="font-bold text-[var(--text)]">{item.label}</p>
              <p className="text-xs text-[var(--muted)]">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeatLayoutPreview({ rows = 0, columns = 0, capacity = 0 }) {
  const totalCells = Math.max(0, Number(rows || 0) * Number(columns || 0));
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[0.64rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Seat Layout</p>
        <Pill color="indigo">{capacity} seats</Pill>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(Number(columns || 0), 1)}, minmax(0, 1fr))` }}>
        {Array.from({ length: totalCells }).map((_, index) => {
          const filled = index < capacity;
          return <div key={index} className={`h-8 rounded-xl border ${filled ? "border-[rgba(75,38,102,0.16)] bg-[var(--surface-strong)]" : "border-dashed border-[var(--border)] bg-transparent"}`} />;
        })}
      </div>
    </div>
  );
}

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, busy }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#00000088] p-5 backdrop-blur-sm">
      <GlassCard className="w-full max-w-md !p-8 shadow-[0_32px_64px_rgba(0,0,0,0.4)]">
        <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-[var(--muted)]">{title || "Confirm Action"}</p>
        <p className="mt-4 text-xl font-bold leading-relaxed text-[var(--text)]">{message}</p>
        <div className="mt-8 flex items-center gap-3">
          <Btn tone="ghost" onClick={onCancel} disabled={busy} className="flex-1 !py-4">Cancel</Btn>
          <Btn tone="danger" onClick={onConfirm} disabled={busy} className="flex-1 !py-4">{busy ? "Working..." : "Confirm"}</Btn>
        </div>
      </GlassCard>
    </div>
  );
}

const EMPTY_OBJ = {};
const ADMIN_SECTIONS = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", description: "Overview and control tower" },
  { id: "drivers", label: "Drivers", icon: "drivers", description: "Driver accounts and reviews" },
  { id: "helpers", label: "Helpers", icon: "helpers", description: "Helper accounts and reviews" },
  { id: "buses", label: "Buses", icon: "buses", description: "Fleet setup and seat plans" },
  { id: "stops", label: "Stations / Stops", icon: "stops", description: "Map stops and station points" },
  { id: "routes", label: "Routes", icon: "routes", description: "Route builder and path layout" },
  { id: "assignments", label: "Assignments", icon: "assignments", description: "Bus, driver, helper scheduling" },
  { id: "analytics", label: "Analytics", icon: "analytics", description: "Revenue and occupancy insights" },
  { id: "reports", label: "Reports", icon: "reports", description: "Exportable business summaries" },
  { id: "settings", label: "Settings", icon: "settings", description: "Admin profile and preferences" },
];
const LEGACY_SECTION_ALIASES = {
  staff: "drivers",
};
const DEFAULT_ADMIN_SECTION = "dashboard";

function toLocalDatetimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function AdminHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useAuth();
  const { isDark } = useTheme();
  const { notify } = useNotification();
  const theme = useMemo(() => (isDark ? DARK : LIGHT), [isDark]);

  const [dashboard, setDashboard]           = useState(null);
  const [loading, setLoading]               = useState(true);
  const [err, setErr]                       = useState("");
  const [msg, setMsg]                       = useState("");
  const [confirmModal, setConfirmModal]     = useState(null);
  const [adminSearch, setAdminSearch]       = useState("");
  const [quickOpen, setQuickOpen]           = useState(false);
  const [profileOpen, setProfileOpen]       = useState(false);
  const [reportRange, setReportRange]       = useState("30D");
  const [analyticsRouteFilter, setAnalyticsRouteFilter] = useState("ALL");
  const [analyticsBusFilter, setAnalyticsBusFilter] = useState("ALL");
  const [builderStops, setBuilderStops]     = useState([]);
  const [recentStops, setRecentStops]       = useState([]);
  const [recentRoutes, setRecentRoutes]     = useState([]);
  const [routeBusy, setRouteBusy]           = useState(false);
  const [editingRouteId, setEditingRouteId] = useState(null);
  const [routeDeleteBusyId, setRouteDeleteBusyId] = useState(null);
  const [stopName, setStopName]             = useState("");
  const [stopLat, setStopLat]               = useState("");
  const [stopLng, setStopLng]               = useState("");
  const [stopActive, setStopActive]         = useState(true);
  const [stopBusy, setStopBusy]             = useState(false);
  const [uBusy, setUBusy]                   = useState(false);
  const [routeName, setRouteName]           = useState("");
  const [routeCity, setRouteCity]           = useState("Pokhara");
  const [routeActive, setRouteActive]       = useState(true);
  const [routePinMode, setRoutePinMode]     = useState(false);
  const [routeDraftStopName, setRouteDraftStopName] = useState("");
  const [routeDraftStopLat, setRouteDraftStopLat] = useState("");
  const [routeDraftStopLng, setRouteDraftStopLng] = useState("");
  const [routeDraftStopBusy, setRouteDraftStopBusy] = useState(false);
  const [selectedStopIds, setSelectedStopIds] = useState([]);
  const [segmentFares, setSegmentFares]     = useState([]);
  const [routeWaypoints, setRouteWaypoints] = useState([]);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState(0);
  const [pendingDiversionSegmentIndex, setPendingDiversionSegmentIndex] = useState(null);
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
  const [editingBusId, setEditingBusId]     = useState(null);
  const [busDeleteBusyId, setBusDeleteBusyId] = useState(null);
  const [assignBusId, setAssignBusId]       = useState("");
  const [assignRouteId, setAssignRouteId]   = useState("");
  const [assignDriverId, setAssignDriverId] = useState("");
  const [assignHelperId, setAssignHelperId] = useState("");
  const [assignBusy, setAssignBusy]         = useState(false);
  const [uName, setUName]                   = useState("");
  const [uPhone, setUPhone]                 = useState("");
  const [uEmail, setUEmail]                 = useState("");
  const [uAddress, setUAddress]             = useState("");
  const [uPass, setUPass]                   = useState("");
  const [uOfficialPhoto, setUOfficialPhoto] = useState(null);
  const [uLicenseNumber, setULicenseNumber] = useState("");
  const [uLicensePhoto, setULicensePhoto]   = useState(null);
  const [uRole, setURole]                   = useState("DRIVER");
  const [editingUserId, setEditingUserId]   = useState(null);
  const [userDeleteBusyId, setUserDeleteBusyId] = useState(null);
  const [userRoleFilter, setUserRoleFilter] = useState("ALL");
  const [reviewBusyId, setReviewBusyId]     = useState(null);
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [selectedHelperId, setSelectedHelperId] = useState(null);
  const [selectedBusId, setSelectedBusId] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [selectedStopId, setSelectedStopId] = useState(null);

  const loadDB     = async ({ silent = false } = {}) => { if (!silent) setLoading(true); try { const r = await api.get("/api/auth/admin/dashboard/"); setDashboard(r.data); } catch (e) { notify(e?.response?.data?.detail || "Failed to load dashboard.", "error"); } finally { if (!silent) setLoading(false); } };
  const loadRoute  = async () => { try { const r = await api.get("/api/transport/admin/route-builder/"); setBuilderStops(r.data.stops || []); setRecentStops(r.data.recent_stops || []); setRecentRoutes(r.data.routes || r.data.recent_routes || []); } catch (e) { notify(e?.response?.data?.detail || "Failed to load routes.", "error"); } };
  const loadSched  = async () => { try { const r = await api.get("/api/trips/admin/schedules/"); setSchedOpts({ routes: r.data.routes || [], buses: r.data.buses || [], drivers: r.data.drivers || [], helpers: r.data.helpers || [], recent_schedules: r.data.recent_schedules || [], schedules: r.data.schedules || [] }); } catch (e) { notify(e?.response?.data?.detail || "Failed to load schedules.", "error"); } };
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
    const maxSegmentIndex = Math.max(selectedStopIds.length - 2, 0);
    setRouteWaypoints((current) => current
      .filter((waypoint) => Number(waypoint.segment_index) <= maxSegmentIndex)
      .map((waypoint, index) => ({ ...waypoint, key: waypoint.key || `waypoint-${index}` })));
    setSelectedSegmentIndex((current) => Math.min(Math.max(current, 0), maxSegmentIndex));
    setPendingDiversionSegmentIndex((current) => (current == null ? null : Math.min(Math.max(current, 0), maxSegmentIndex)));
  }, [selectedStopIds.length]);
  useEffect(() => { if (routePinMode) setPendingDiversionSegmentIndex(null); }, [routePinMode]);
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
    setAssignRouteId(selectedAssignBus.route ? String(selectedAssignBus.route) : "");
    setAssignDriverId(selectedAssignBus.driver ? String(selectedAssignBus.driver) : "");
    setAssignHelperId(selectedAssignBus.helper ? String(selectedAssignBus.helper) : "");
  }, [selectedAssignBus]);

  const handleLogout = () => { clearToken(); setUser(null); navigate("/auth/login", { replace: true }); };

  const activeSection = useMemo(() => {
    const rawSection = location.pathname.split("/")[2] || DEFAULT_ADMIN_SECTION;
    const section = LEGACY_SECTION_ALIASES[rawSection] || rawSection;
    return ADMIN_SECTIONS.some((item) => item.id === section) ? section : DEFAULT_ADMIN_SECTION;
  }, [location.pathname]);
  useEffect(() => {
    if (editingUserId) return;
    if (activeSection === "drivers" && uRole !== "DRIVER") setURole("DRIVER");
    if (activeSection === "helpers" && uRole !== "HELPER") setURole("HELPER");
    if (activeSection === "settings" && uRole !== "ADMIN") setURole("ADMIN");
  }, [activeSection, editingUserId, uRole]);
  const overview = dashboard?.overview; const roleCounts = overview?.role_counts || EMPTY_OBJ; const transport = overview?.transport || EMPTY_OBJ; const trips = overview?.trips || EMPTY_OBJ; const bookings = overview?.bookings || EMPTY_OBJ; const rideOps = overview?.ride_ops || EMPTY_OBJ; const payments = overview?.payments || EMPTY_OBJ; const wallets = overview?.wallets || EMPTY_OBJ; const reviews = overview?.reviews || EMPTY_OBJ;
  const paymentRows = useMemo(() => Object.entries(payments?.methods || {}).map(([method, stats]) => ({ method, total: stats.total || 0, success: stats.success || 0, rate: stats.total ? Math.round((stats.success / stats.total) * 100) : 0 })), [payments]);
  const recentBookingFlow = dashboard?.recent_booking_flow || [];
  const rewardLeaderboard = dashboard?.reward_leaderboard || [];
  const recentReviews = dashboard?.recent_reviews || [];
  const reviewTrend = dashboard?.review_trend || [];
  const stationAnalytics = dashboard?.station_analytics || [];
  const routeAnalytics = dashboard?.route_analytics || [];
  const busAnalytics = dashboard?.bus_analytics || [];
  const staffUsers = useMemo(() => userList.filter(item => item.role !== "PASSENGER"), [userList]);
  const selectedStops = useMemo(() => selectedStopIds.map(id => builderStops.find(s => s.id === id)).filter(Boolean), [builderStops, selectedStopIds]);
  const selPts = useMemo(() => selectedStops.map(s => [Number(s.lat), Number(s.lng)]).filter(([la, lo]) => isFinite(la) && isFinite(lo)), [selectedStops]);
  const routeAnchorPoints = useMemo(() => buildRouteAnchorPoints(selectedStops, routeWaypoints), [selectedStops, routeWaypoints]);
  const routeSegmentLines = useMemo(() => buildRouteSegmentLines(selectedStops, routeWaypoints), [selectedStops, routeWaypoints]);
  const segmentWaypointGroups = useMemo(() => selectedStops.slice(0, -1).map((_, index) => routeWaypoints.filter((waypoint) => Number(waypoint.segment_index) === index).sort((a, b) => Number(a.seq || 0) - Number(b.seq || 0))), [routeWaypoints, selectedStops]);
  const dispPts = roadPolyline.length > 1 ? roadPolyline : routeAnchorPoints;
  const mapPts  = useMemo(() => dispPts.length > 0 ? dispPts : builderStops.map(s => [Number(s.lat), Number(s.lng)]).filter(([la, lo]) => isFinite(la) && isFinite(lo)).slice(0, 12), [builderStops, dispPts]);
  const busCapacityPreview = useMemo(() => {
    const rows = parseInt(busRows, 10);
    const cols = parseInt(busCols, 10);
    if (isNaN(rows) || isNaN(cols) || rows < 1 || cols < 1) return 0;
    return rows * cols;
  }, [busCols, busRows]);
  const searchQuery = adminSearch.trim().toLowerCase();
  const matchesSearch = (...values) => !searchQuery || values.some((value) => String(value || "").toLowerCase().includes(searchQuery));
  const driverUsers = useMemo(() => userList.filter((item) => item.role === "DRIVER"), [userList]);
  const helperUsers = useMemo(() => userList.filter((item) => item.role === "HELPER"), [userList]);
  const adminUsers = useMemo(() => userList.filter((item) => item.role === "ADMIN"), [userList]);
  const filteredDrivers = useMemo(() => driverUsers.filter((item) => matchesSearch(item.full_name, item.phone, item.email, item.address, item.license_number)), [driverUsers, searchQuery]);
  const filteredHelpers = useMemo(() => helperUsers.filter((item) => matchesSearch(item.full_name, item.phone, item.email, item.address)), [helperUsers, searchQuery]);
  const filteredBuses = useMemo(() => busList.filter((item) => matchesSearch(item.display_name, item.plate_number, item.driver_name, item.helper_name, item.condition)), [busList, searchQuery]);
  const filteredRoutes = useMemo(() => recentRoutes.filter((item) => matchesSearch(item.name, item.city, item.route_stops?.[0]?.stop?.name, item.route_stops?.[item.route_stops.length - 1]?.stop?.name)), [recentRoutes, searchQuery]);
  const filteredStops = useMemo(() => builderStops.filter((item) => matchesSearch(item.name, item.lat, item.lng)), [builderStops, searchQuery]);
  const filteredSchedules = useMemo(() => (schedOpts.schedules || []).filter((item) => matchesSearch(item.route_name, item.bus_plate, item.driver_name, item.helper_name, item.status)), [schedOpts.schedules, searchQuery]);
  const assignmentRouteOptions = useMemo(() => [{ value: "", label: "Unassigned route" }, ...recentRoutes.map((route) => ({ value: route.id, label: route.name }))], [recentRoutes]);
  const assignmentDriverOptions = useMemo(() => [{ value: "", label: "Unassigned" }, ...driverUsers.map((driver) => ({ value: driver.id, label: driver.full_name }))], [driverUsers]);
  const assignmentHelperOptions = useMemo(() => [{ value: "", label: "Unassigned" }, ...helperUsers.map((helper) => ({ value: helper.id, label: helper.full_name }))], [helperUsers]);
  const assignmentHealth = useMemo(() => ({
    fullyAssigned: busList.filter((bus) => bus.route && bus.driver && bus.helper).length,
    missingRoute: busList.filter((bus) => !bus.route).length,
    missingStaff: busList.filter((bus) => !bus.driver || !bus.helper).length,
  }), [busList]);
  const selectedDriver = useMemo(() => filteredDrivers.find((item) => item.id === selectedDriverId) || filteredDrivers[0] || null, [filteredDrivers, selectedDriverId]);
  const selectedHelper = useMemo(() => filteredHelpers.find((item) => item.id === selectedHelperId) || filteredHelpers[0] || null, [filteredHelpers, selectedHelperId]);
  const selectedBusPreview = useMemo(() => filteredBuses.find((item) => item.id === selectedBusId) || filteredBuses[0] || null, [filteredBuses, selectedBusId]);
  const selectedRoutePreview = useMemo(() => filteredRoutes.find((item) => item.id === selectedRouteId) || filteredRoutes[0] || null, [filteredRoutes, selectedRouteId]);
  const selectedStopPreview = useMemo(() => filteredStops.find((item) => item.id === selectedStopId) || filteredStops[0] || null, [filteredStops, selectedStopId]);
  const overallOccupancyRate = useMemo(() => {
    const total = rideOps.awaiting_acceptance + rideOps.awaiting_payment + rideOps.ready_to_board + rideOps.onboard + (rideOps.completed_today || 0);
    if (!total) return 0;
    return Math.min(100, Math.round(((rideOps.ready_to_board + rideOps.onboard + (rideOps.completed_today || 0)) / total) * 100));
  }, [rideOps.awaiting_acceptance, rideOps.awaiting_payment, rideOps.completed_today, rideOps.onboard, rideOps.ready_to_board]);
  const fleetStatus = useMemo(() => ({
    active: busAnalytics.filter((bus) => bus.is_active).length,
    inactive: busAnalytics.filter((bus) => !bus.is_active).length,
    delayed: (dashboard?.live_trips || []).filter((trip) => trip.deviation_mode).length,
  }), [busAnalytics, dashboard?.live_trips]);
  const earningsTrend = useMemo(() => {
    const paymentSeries = (dashboard?.recent_payments || []).slice().reverse();
    if (!paymentSeries.length) {
      return [
        { label: "Mon", value: Number(payments.revenue_success || 0) * 0.22 },
        { label: "Tue", value: Number(payments.revenue_success || 0) * 0.36 },
        { label: "Wed", value: Number(payments.revenue_success || 0) * 0.41 },
        { label: "Thu", value: Number(payments.revenue_success || 0) * 0.55 },
        { label: "Fri", value: Number(payments.revenue_success || 0) * 0.72 },
        { label: "Sat", value: Number(payments.revenue_success || 0) * 0.82 },
        { label: "Sun", value: Number(payments.revenue_success || 0) },
      ];
    }
    return paymentSeries.map((payment, index) => ({
      label: new Date(payment.created_at).toLocaleDateString([], { month: "short", day: "numeric" }) || `P${index + 1}`,
      value: Number(payment.amount || 0),
    }));
  }, [dashboard?.recent_payments, payments.revenue_success]);
  const routeOccupancyData = useMemo(() => routeAnalytics.slice(0, 6).map((route) => ({
    label: route.route_name,
    value: route.total_trips ? Math.min(100, Math.round((route.completed_bookings / Math.max(route.total_trips * 4, 1)) * 100)) : 0,
  })), [routeAnalytics]);
  const passengerDistribution = useMemo(() => [
    { label: "Passengers", value: roleCounts.PASSENGER || 0 },
    { label: "Drivers", value: roleCounts.DRIVER || 0 },
    { label: "Helpers", value: roleCounts.HELPER || 0 },
    { label: "Admins", value: roleCounts.ADMIN || 0 },
  ], [roleCounts.ADMIN, roleCounts.DRIVER, roleCounts.HELPER, roleCounts.PASSENGER]);
  const recentActivities = useMemo(() => [
    ...(dashboard?.recent_bookings || []).map((item) => ({ id: `booking-${item.id}`, title: `Booking #${item.id}`, subtitle: `${item.passenger_name} reserved ${item.route_name}`, time: item.created_at, tone: item.status === "CONFIRMED" ? "emerald" : item.status === "CANCELLED" ? "red" : "amber" })),
    ...(dashboard?.recent_payments || []).map((item) => ({ id: `payment-${item.id}`, title: `Payment #${item.id}`, subtitle: `${item.method} ${fmtMoney(item.amount)} on ${item.route_name}`, time: item.created_at, tone: item.status === "SUCCESS" ? "emerald" : item.status === "FAILED" ? "red" : "amber" })),
    ...(dashboard?.recent_users || []).map((item) => ({ id: `user-${item.id}`, title: item.full_name, subtitle: `${item.role} account joined MetroBus`, time: item.created_at, tone: "indigo" })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8), [dashboard?.recent_bookings, dashboard?.recent_payments, dashboard?.recent_users]);
  const upcomingSchedules = useMemo(() => (schedOpts.schedules || []).filter((item) => item.status === "PLANNED").slice(0, 6), [schedOpts.schedules]);
  const currentSectionMeta = useMemo(() => ADMIN_SECTIONS.find((section) => section.id === activeSection) || ADMIN_SECTIONS[0], [activeSection]);
  const selectedBusSchedule = useMemo(() => (schedOpts.schedules || []).find((item) => String(item.bus) === String(selectedBusPreview?.id) && item.status === "PLANNED") || null, [schedOpts.schedules, selectedBusPreview?.id]);
  const routeFilterOptions = useMemo(() => [{ value: "ALL", label: "All routes" }, ...routeAnalytics.map((route) => ({ value: String(route.route_id), label: route.route_name }))], [routeAnalytics]);
  const busFilterOptions = useMemo(() => [{ value: "ALL", label: "All buses" }, ...busAnalytics.map((bus) => ({ value: String(bus.bus_id), label: bus.display_name }))], [busAnalytics]);
  const filteredRouteAnalytics = useMemo(() => routeAnalytics.filter((route) => analyticsRouteFilter === "ALL" || String(route.route_id) === String(analyticsRouteFilter)), [analyticsRouteFilter, routeAnalytics]);
  const filteredBusAnalytics = useMemo(() => busAnalytics.filter((bus) => analyticsBusFilter === "ALL" || String(bus.bus_id) === String(analyticsBusFilter)), [analyticsBusFilter, busAnalytics]);
  const topRatedRoutes = useMemo(() => [...routeAnalytics].filter((route) => route.reviews_total > 0).sort((a, b) => (b.avg_rating - a.avg_rating) || (b.reviews_total - a.reviews_total)).slice(0, 5), [routeAnalytics]);
  const topRatedBuses = useMemo(() => [...busAnalytics].filter((bus) => bus.reviews_total > 0).sort((a, b) => (b.avg_rating - a.avg_rating) || (b.reviews_total - a.reviews_total)).slice(0, 5), [busAnalytics]);
  const topStations = useMemo(() => stationAnalytics.slice(0, 6).map((station) => ({ label: station.stop_name, value: station.touchpoints || 0 })), [stationAnalytics]);
  const assignmentConflicts = useMemo(() => {
    const counts = {};
    (schedOpts.schedules || []).forEach((schedule) => {
      ["bus", "driver", "helper"].forEach((key) => {
        const value = schedule[key];
        if (!value) return;
        const mapKey = `${key}-${value}`;
        counts[mapKey] = (counts[mapKey] || 0) + 1;
      });
    });
    return (schedOpts.schedules || []).filter((schedule) => (
      counts[`bus-${schedule.bus}`] > 1 || counts[`driver-${schedule.driver}`] > 1 || counts[`helper-${schedule.helper}`] > 1
    ));
  }, [schedOpts.schedules]);
  const notificationCount = payments.pending + rideOps.awaiting_acceptance + rideOps.awaiting_payment + fleetStatus.delayed;

  useEffect(() => { if (routeAnchorPoints.length < 2) { setRoadPolyline([]); return; } const c = new AbortController(); snapRouteToRoad(routeAnchorPoints, c.signal).then(p => setRoadPolyline(p.length > 1 ? p : [])).catch(e => { if (e.name !== "AbortError") setRoadPolyline([]); }); return () => c.abort(); }, [routeAnchorPoints]);
  useEffect(() => { if (!selectedDriver && selectedDriverId !== null) setSelectedDriverId(null); else if (selectedDriver && selectedDriverId == null) setSelectedDriverId(selectedDriver.id); }, [selectedDriver, selectedDriverId]);
  useEffect(() => { if (!selectedHelper && selectedHelperId !== null) setSelectedHelperId(null); else if (selectedHelper && selectedHelperId == null) setSelectedHelperId(selectedHelper.id); }, [selectedHelper, selectedHelperId]);
  useEffect(() => { if (!selectedBusPreview && selectedBusId !== null) setSelectedBusId(null); else if (selectedBusPreview && selectedBusId == null) setSelectedBusId(selectedBusPreview.id); }, [selectedBusId, selectedBusPreview]);
  useEffect(() => { if (!selectedRoutePreview && selectedRouteId !== null) setSelectedRouteId(null); else if (selectedRoutePreview && selectedRouteId == null) setSelectedRouteId(selectedRoutePreview.id); }, [selectedRouteId, selectedRoutePreview]);
  useEffect(() => { if (!selectedStopPreview && selectedStopId !== null) setSelectedStopId(null); else if (selectedStopPreview && selectedStopId == null) setSelectedStopId(selectedStopPreview.id); }, [selectedStopId, selectedStopPreview]);

  const toggleStop = id => setSelectedStopIds(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]);
  const moveStop = (i, dir) => setSelectedStopIds(c => { const ti = i + dir; if (ti < 0 || ti >= c.length) return c; const n = [...c]; [n[i], n[ti]] = [n[ti], n[i]]; return n; });
  const clearStopForm = () => { setStopName(""); setStopLat(""); setStopLng(""); setStopActive(true); };
  const clearRouteDraftStop = () => { setRouteDraftStopName(""); setRouteDraftStopLat(""); setRouteDraftStopLng(""); setRoutePinMode(false); };
  const clearRoute  = () => { setEditingRouteId(null); setRouteName(""); setRouteCity("Pokhara"); setRouteActive(true); setSelectedStopIds([]); setSegmentFares([]); setRouteWaypoints([]); setSelectedSegmentIndex(0); setPendingDiversionSegmentIndex(null); setRoadPolyline([]); clearRouteDraftStop(); };
  const clearScheduleForm = () => { setEditingScheduleId(null); setSStartTime(""); };
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
  };
  const handleMapPick = ({ lat, lng }) => { setStopLat(Number(lat).toFixed(6)); setStopLng(Number(lng).toFixed(6)); };
  const handleRouteDraftStopPick = ({ lat, lng }) => {
    setRouteDraftStopLat(Number(lat).toFixed(6));
    setRouteDraftStopLng(Number(lng).toFixed(6));
  };
  const beginSegmentDiversionPick = (segmentIndex) => {
    setSelectedSegmentIndex(segmentIndex);
    setPendingDiversionSegmentIndex(segmentIndex);
    notify(`Click the map to add a diversion point for segment ${segmentIndex + 1}.`, "success");
  };
  const addRouteWaypoint = ({ lat, lng }, segmentIndex = selectedSegmentIndex) => {
    if (selectedStops.length < 2) return;
    setRouteWaypoints((current) => {
      const segmentPoints = current.filter((waypoint) => Number(waypoint.segment_index) === segmentIndex);
      return [
        ...current,
        {
          key: `waypoint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          segment_index: segmentIndex,
          seq: segmentPoints.length + 1,
          lat: Number(lat).toFixed(6),
          lng: Number(lng).toFixed(6),
        },
      ];
    });
  };
  const placeDiversionPoint = ({ lat, lng }) => {
    if (pendingDiversionSegmentIndex == null || routePinMode) return;
    addRouteWaypoint({ lat, lng }, pendingDiversionSegmentIndex);
    setPendingDiversionSegmentIndex(null);
  };
  const moveRouteWaypoint = (waypointKey, { lat, lng }) => {
    setRouteWaypoints((current) => current.map((waypoint) => waypoint.key === waypointKey ? { ...waypoint, lat: Number(lat).toFixed(6), lng: Number(lng).toFixed(6) } : waypoint));
  };
  const removeRouteWaypoint = (waypointKey) => {
    setRouteWaypoints((current) => {
      const next = current.filter((waypoint) => waypoint.key !== waypointKey);
      const counts = {};
      return next.map((waypoint) => {
        const segmentKey = String(waypoint.segment_index ?? 0);
        counts[segmentKey] = (counts[segmentKey] || 0) + 1;
        return { ...waypoint, seq: counts[segmentKey] };
      });
    });
  };
  const clearRouteShaping = () => { setRouteWaypoints([]); setPendingDiversionSegmentIndex(null); setRoadPolyline([]); };
  const createStopFromRouteMap = async () => {
    if (!routeDraftStopName.trim()) { notify("Enter a stop name for the dropped pin.", "error"); return; }
    if (routeDraftStopLat === "" || routeDraftStopLng === "") { notify("Drop a pin on the route map first.", "error"); return; }
    if (Number.isNaN(Number(routeDraftStopLat)) || Number.isNaN(Number(routeDraftStopLng))) { notify("Pinned stop coordinates are invalid.", "error"); return; }
    setRouteDraftStopBusy(true);
    try {
      const response = await api.post("/api/transport/admin/stops/", {
        name: routeDraftStopName.trim(),
        lat: Number(routeDraftStopLat),
        lng: Number(routeDraftStopLng),
        is_active: true,
      });
      const createdStop = response?.data?.stop;
      notify("Stop created successfully from the route map.", "success");
      await Promise.all([loadDB({ silent: true }), loadRoute()]);
      if (createdStop?.id) {
        setSelectedStopIds((current) => (current.includes(createdStop.id) ? current : [...current, createdStop.id]));
        setSelectedStopId(createdStop.id);
      }
      clearRouteDraftStop();
    } catch (e) {
      notify(e?.response?.data?.detail || "Failed to create stop from the route map.", "error");
    } finally {
      setRouteDraftStopBusy(false);
    }
  };

  const createStop = async () => {
    if (!stopName.trim()) { notify("Enter a stop name.", "error"); return; }
    if (stopLat === "" || stopLng === "") { notify("Tap the map or enter valid stop coordinates.", "error"); return; }
    if (Number.isNaN(Number(stopLat)) || Number.isNaN(Number(stopLng))) { notify("Stop coordinates must be valid numbers.", "error"); return; }
    setStopBusy(true);
    try {
      await api.post("/api/transport/admin/stops/", {
        name: stopName.trim(),
        lat: Number(stopLat),
        lng: Number(stopLng),
        is_active: stopActive,
      });
      clearStopForm();
      notify("Stop created successfully.", "success");
      await Promise.all([loadDB({ silent: true }), loadRoute()]);
    } catch (e) {
      notify(e?.response?.data?.detail || "Failed to create stop.", "error");
    } finally {
      setStopBusy(false);
    }
  };

  const saveRoute = async () => {
    if (!routeName.trim()) { notify("Enter a route name.", "error"); return; } if (selectedStopIds.length < 2) { notify("Select at least two stops.", "error"); return; } if (segmentFares.some(f => f === "" || Number(f) < 0)) { notify("Fill every segment fare.", "error"); return; }
    setRouteBusy(true);
    try {
      const pathPoints = (roadPolyline.length > 1 ? roadPolyline : routeAnchorPoints).map(([lat, lng], index) => ({ seq: index + 1, lat: Number(lat), lng: Number(lng) }));
      const pathWaypoints = routeWaypoints.map((waypoint, index) => ({ seq: index + 1, segment_index: Number(waypoint.segment_index || 0), lat: Number(waypoint.lat), lng: Number(waypoint.lng) }));
      const payload = { name: routeName.trim(), city: routeCity.trim() || "Pokhara", is_active: routeActive, stop_ids: selectedStopIds, segment_fares: segmentFares.map(Number), path_points: pathPoints, path_waypoints: pathWaypoints };
      editingRouteId
        ? await api.patch(`/api/transport/admin/routes/${editingRouteId}/`, payload)
        : await api.post("/api/transport/admin/route-builder/", payload);
      clearRoute();
      notify(`Route ${editingRouteId ? "updated" : "created"} successfully.`, "success");
      await Promise.all([loadDB({ silent: true }), loadRoute(), loadSched()]);
    }
    catch (e) { notify(e?.response?.data?.detail || `Failed to ${editingRouteId ? "update" : "create"} route.`, "error"); } finally { setRouteBusy(false); }
  };

  const startEditingRoute = (route) => {
    setEditingRouteId(route.id);
    setRouteName(route.name || "");
    setRouteCity(route.city || "Pokhara");
    setRouteActive(Boolean(route.is_active));
    setSelectedStopIds((route.route_stops || []).map(item => item.stop.id));
    setSegmentFares((route.segment_fares || []).map(value => String(value)));
    setRouteWaypoints((route.path_waypoints || []).map((waypoint, index) => ({ key: `waypoint-${route.id}-${index}`, segment_index: Number(waypoint.segment_index || 0), seq: Number(waypoint.seq || index + 1), lat: Number(waypoint.lat).toFixed(6), lng: Number(waypoint.lng).toFixed(6) })));
    setSelectedSegmentIndex(0);
    setRoadPolyline((route.path_points || []).map((point) => [Number(point.lat), Number(point.lng)]).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)));
    navigate("/admin/routes");
  };

  const deleteRoute = async (route) => {
    const performDelete = async () => {
      setRouteDeleteBusyId(route.id);
      try {
        await api.delete(`/api/transport/admin/routes/${route.id}/`);
        if (editingRouteId === route.id) clearRoute();
        notify("Route deleted.", "success");
        await Promise.all([loadRoute(), loadSched(), loadDB({ silent: true })]);
      } catch (e) {
        notify(e?.response?.data?.detail || "Failed to delete route.", "error");
      } finally {
        setRouteDeleteBusyId(null);
        setConfirmModal(null);
      }
    };

    setConfirmModal({
      title: "Delete Route",
      message: `Confirm deletion of ${route.name}? All associated fares and data will be lost.`,
      onConfirm: performDelete,
      onCancel: () => setConfirmModal(null),
    });
  };

  const saveSchedule = async () => {
    if (!(sRouteId && sBusId && sDriverId && sHelperId && sStartTime)) { notify("Fill all schedule fields.", "error"); return; }
    setScheduleBusy(true);
    try {
      const payload = { route_id: +sRouteId, bus_id: +sBusId, driver_id: +sDriverId, helper_id: +sHelperId, scheduled_start_time: new Date(sStartTime).toISOString() };
      editingScheduleId
        ? await api.patch(`/api/trips/admin/schedules/${editingScheduleId}/`, payload)
        : await api.post("/api/trips/admin/schedules/", payload);
      clearScheduleForm();
      notify(`Schedule ${editingScheduleId ? "updated" : "created"} successfully.`, "success");
      await Promise.all([loadDB({ silent: true }), loadSched()]);
    }
    catch (e) { notify(e?.response?.data?.detail || `Failed to ${editingScheduleId ? "update" : "create"} schedule.`, "error"); } finally { setScheduleBusy(false); }
  };

  const startEditingSchedule = (schedule) => {
    setEditingScheduleId(schedule.id);
    setSRouteId(String(schedule.route));
    setSBusId(String(schedule.bus));
    setSDriverId(String(schedule.driver));
    setSHelperId(String(schedule.helper));
    setSStartTime(toLocalDatetimeInput(schedule.scheduled_start_time));
    navigate("/admin/assignments");
  };

  const deleteSchedule = async (schedule) => {
    const performDelete = async () => {
      setScheduleDeleteBusyId(schedule.id);
      try {
        await api.delete(`/api/trips/admin/schedules/${schedule.id}/`);
        if (editingScheduleId === schedule.id) clearScheduleForm();
        notify("Schedule deleted.", "success");
        await Promise.all([loadSched(), loadDB({ silent: true })]);
      } catch (e) {
        notify(e?.response?.data?.detail || "Failed to delete schedule.", "error");
      } finally {
        setScheduleDeleteBusyId(null);
        setConfirmModal(null);
      }
    };

    setConfirmModal({
      title: "Delete Schedule",
      message: `Delete schedule for ${schedule.route_name} at ${fmt(schedule.scheduled_start_time)}? ${schedule.status === "COMPLETED" ? "(This is a completed trip)" : ""}`,
      onConfirm: performDelete,
      onCancel: () => setConfirmModal(null),
    });
  };

  const saveBus = async () => {
    if (!busPlate.trim()) { notify("Enter a plate number.", "error"); return; }
    if (!busName.trim()) { notify("Enter a bus name for identification.", "error"); return; }
    if (!busCapacityPreview || busCapacityPreview > 200) { notify("Seat layout must resolve to 1-200 seats.", "error"); return; }
    setBusMgmtBusy(true);
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
      editingBusId
        ? await api.patch(`/api/transport/admin/buses/${editingBusId}/`, formData)
        : await api.post("/api/transport/admin/buses/", formData);
      resetBusForm();
      notify(`Bus ${editingBusId ? "updated" : "created"} successfully.`, "success");
      await Promise.all([loadBuses(), loadSched(), loadDB({ silent: true })]);
    }
    catch (e) { notify(e?.response?.data?.detail || `Failed to ${editingBusId ? "update" : "create"} bus.`, "error"); } finally { setBusMgmtBusy(false); }
  };

  const startEditingBus = (bus) => {
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
    const performDelete = async () => {
      setBusDeleteBusyId(bus.id);
      try {
        await api.delete(`/api/transport/admin/buses/${bus.id}/`);
        if (editingBusId === bus.id) resetBusForm();
        if (assignBusId === String(bus.id)) {
          setAssignBusId("");
          setAssignRouteId("");
          setAssignDriverId("");
          setAssignHelperId("");
        }
        notify("Bus deleted.", "success");
        await Promise.all([loadBuses(), loadSched(), loadDB({ silent: true })]);
      } catch (e) {
        notify(e?.response?.data?.detail || "Failed to delete bus.", "error");
      } finally {
        setBusDeleteBusyId(null);
        setConfirmModal(null);
      }
    };

    setConfirmModal({
      title: "Delete Bus",
      message: `Delete bus ${bus.display_name || bus.plate_number}? This action cannot be reversed.`,
      onConfirm: performDelete,
      onCancel: () => setConfirmModal(null),
    });
  };

  const assignStaffToBus = async () => {
    if (!assignBusId) { notify("Select a bus to assign staff.", "error"); return; }
    setAssignBusy(true);
    try {
      await api.patch(`/api/transport/admin/buses/${assignBusId}/`, {
        route: assignRouteId || "",
        driver: assignDriverId || "",
        helper: assignHelperId || ""
      });
      setAssignBusId(""); setAssignRouteId(""); setAssignDriverId(""); setAssignHelperId("");
      notify("Bus assignment updated successfully.", "success");
      await loadBuses();
    } catch (e) {
      notify(e?.response?.data?.detail || "Failed to update bus staff.", "error");
    } finally {
      setAssignBusy(false);
    }
  };

  const saveUser = async () => {
    if (!uName.trim() || !uPhone.trim() || (!editingUserId && !uPass.trim())) { notify("Name, phone, and password are required.", "error"); return; }
    if ((uRole === "DRIVER" || uRole === "HELPER") && !uAddress.trim()) { notify("Address is required for staff accounts.", "error"); return; }
    if ((uRole === "DRIVER" || uRole === "HELPER") && !uOfficialPhoto && !editingUserId) { notify("An official photo is required for staff accounts.", "error"); return; }
    if (uRole === "DRIVER" && (!uLicenseNumber.trim() || (!uLicensePhoto && !editingUserId))) { notify("Driver license number and license photo are required.", "error"); return; }
    setUBusy(true);
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
      editingUserId
        ? await api.patch(`/api/auth/admin/users/${editingUserId}/`, formData)
        : await api.post("/api/auth/admin/users/", formData);
      resetUserForm();
      notify(`User ${editingUserId ? "updated" : "created"} successfully.`, "success");
      await Promise.all([reloadFilteredUsers(), loadSched(), loadDB({ silent: true })]);
    }
    catch (e) { const d = e?.response?.data; notify(d?.phone?.[0] || d?.email?.[0] || d?.detail || `Failed to ${editingUserId ? "update" : "create"} user.`, "error"); } finally { setUBusy(false); }
  };

  const startEditingUser = (staffUser) => {
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
    navigate(`/admin/${staffUser.role === "HELPER" ? "helpers" : staffUser.role === "ADMIN" ? "settings" : "drivers"}`);
  };

  const deleteUser = async (targetUser) => {
    const performDelete = async () => {
      setUserDeleteBusyId(targetUser.id);
      try {
        await api.delete(`/api/auth/admin/users/${targetUser.id}/`);
        notify("User deleted.", "success");
        if (editingUserId === targetUser.id) resetUserForm();
        await Promise.all([reloadFilteredUsers(), loadSched(), loadDB({ silent: true })]);
      } catch (e) {
        notify(e?.response?.data?.detail || "Failed to delete user.", "error");
      } finally {
        setUserDeleteBusyId(null);
        setConfirmModal(null);
      }
    };

    setConfirmModal({
      title: "Delete User",
      message: `Are you sure you want to delete ${targetUser.full_name}? This will permanently remove their account.`,
      onConfirm: performDelete,
      onCancel: () => setConfirmModal(null),
    });
  };

  const setStaffFilter = async (role) => {
    setUserRoleFilter(role);
    await loadUsers(role === "ALL" ? null : role);
  };

  const reviewUser = async (staffUser, payload) => {
    setReviewBusyId(staffUser.id);
    try {
      const r = await api.patch(`/api/auth/admin/users/${staffUser.id}/review/`, payload);
      const updatedUser = r.data.user;
      setUserList(current => current.map(row => (row.id === updatedUser.id ? updatedUser : row)));
      notify(r.data.message || `Updated ${staffUser.full_name}.`, "success");
      await loadDB({ silent: true });
      await loadSched();
    } catch (e) {
      const d = e?.response?.data;
      notify(d?.official_photo_verified?.[0] || d?.license_verified?.[0] || d?.detail || "Failed to update staff review.", "error");
    } finally {
      setReviewBusyId(null);
    }
  };

  const triggerQuickAction = (sectionId) => {
    setQuickOpen(false);
    if (sectionId === "drivers") resetUserForm();
    if (sectionId === "helpers") resetUserForm();
    if (sectionId === "buses") resetBusForm();
    if (sectionId === "routes") clearRoute();
    if (sectionId === "assignments") clearScheduleForm();
    if (sectionId === "stops") clearStopForm();
    navigate(`/admin/${sectionId}`);
  };

  const exportReport = () => {
    const rows = [
      ["Category", "Name", "Trips", "Bookings", "Revenue", "Avg Rating", "Reviews"],
      ...routeAnalytics.map((route) => ["Route", route.route_name, route.total_trips, route.bookings, route.revenue_success, route.avg_rating || 0, route.reviews_total || 0]),
      ...busAnalytics.map((bus) => ["Bus", bus.display_name, bus.total_trips, bus.bookings, bus.revenue_success, bus.avg_rating || 0, bus.reviews_total || 0]),
      ...stationAnalytics.map((station) => ["Station", station.stop_name, "", station.touchpoints || 0, "", "", station.completed_bookings || 0]),
    ];
    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `metrobus-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
    notify("MetroBus report exported.", "success");
  };

  if (loading) return <div style={theme} className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#fff5eb_0%,var(--bg)_42%,var(--bg-soft)_100%)]"><div className="text-center"><div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" /><p className="mt-4 text-sm font-semibold text-[var(--muted)]">Loading MetroBus admin dashboard...</p></div></div>;

  const rowBg = "bg-[var(--surface-muted)] border-[var(--border)]";
  const mapTileUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
  const avatarInitials = (name) => (name || "MB").split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  const renderUserForm = (role) => (
    <GlassCard>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <SLabel>{editingUserId ? `Edit ${role}` : `Add ${role}`}</SLabel>
          <p className="text-xl font-black text-[var(--text)]">{role} management form</p>
        </div>
        {editingUserId ? <Btn tone="ghost" onClick={resetUserForm} className="!px-4 !py-2">Cancel</Btn> : null}
      </div>
      <div className="grid gap-4">
        <InputField label="Full Name" value={uName} onChange={setUName} placeholder="Ramesh Kumar" />
        <div className="grid gap-4 xl:grid-cols-2">
          <InputField label="Phone" value={uPhone} onChange={setUPhone} placeholder="9800000000" />
          <InputField label="Email" value={uEmail} onChange={setUEmail} placeholder="ramesh@example.com" />
        </div>
        <InputField label="Address" value={uAddress} onChange={setUAddress} placeholder="Pokhara-8, Nepal" />
        <InputField
          label={editingUserId ? "Password (Optional)" : "Password"}
          value={uPass}
          onChange={setUPass}
          placeholder={editingUserId ? "Leave blank to keep current password" : "Minimum 6 characters"}
          type="password"
        />
        <FileField label="Profile Photo" file={uOfficialPhoto} onChange={setUOfficialPhoto} />
        {role === "Driver" ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <InputField label="License Number" value={uLicenseNumber} onChange={setULicenseNumber} placeholder="NP-DRV-009812" />
            <FileField label="License Photo" file={uLicensePhoto} onChange={setULicensePhoto} />
          </div>
        ) : null}
        <Btn tone="success" onClick={saveUser} disabled={uBusy} className="w-full !py-4">
          {uBusy ? (editingUserId ? "Saving..." : "Creating...") : (editingUserId ? `Save ${role}` : `Add ${role}`)}
        </Btn>
      </div>
    </GlassCard>
  );

  const renderUserTable = (items, title, selectedId, setSelectedId, role) => (
    <GlassCard className="h-full">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <SLabel>{title}</SLabel>
          <p className="text-xl font-black text-[var(--text)]">{items.length} records</p>
        </div>
        <Pill color="indigo">{role.toUpperCase()}</Pill>
      </div>
      <div className="overflow-hidden rounded-[1.2rem] border border-[var(--border)]">
        <div className="grid grid-cols-[1.4fr_1fr_0.8fr_0.8fr] gap-3 bg-[var(--surface-muted)] px-4 py-3 text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
          <span>Profile</span>
          <span>Contact</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        <div className="max-h-[34rem] overflow-y-auto bg-[var(--surface-strong)]">
          {!items.length ? (
            <div className="px-4 py-8 text-sm text-[var(--muted)]">No {role.toLowerCase()} records match the current search.</div>
          ) : items.map((staffUser) => (
            <div
              key={staffUser.id}
              className={`grid grid-cols-[1.4fr_1fr_0.8fr_0.8fr] gap-3 border-t border-[var(--border)] px-4 py-4 text-sm ${selectedId === staffUser.id ? "bg-[var(--accent-soft)]" : "bg-transparent"}`}
            >
              <button type="button" className="flex min-w-0 items-center gap-3 text-left" onClick={() => setSelectedId(staffUser.id)}>
                {staffUser.official_photo_url ? (
                  <img src={staffUser.official_photo_url} alt={staffUser.full_name} className="h-11 w-11 rounded-2xl object-cover" />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-xs font-black text-[var(--primary)]">{avatarInitials(staffUser.full_name)}</div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-bold text-[var(--text)]">{staffUser.full_name}</p>
                  <p className="truncate text-xs text-[var(--muted)]">{staffUser.address || "No address added"}</p>
                </div>
              </button>
              <div className="min-w-0">
                <p className="truncate font-semibold text-[var(--text)]">{staffUser.phone}</p>
                <p className="truncate text-xs text-[var(--muted)]">{staffUser.email || "No email"}</p>
              </div>
              <div className="space-y-2">
                <Pill color={staffUser.is_active ? "emerald" : "slate"}>{staffUser.is_active ? "Active" : "Inactive"}</Pill>
                {role === "Driver" ? (
                  <Pill color={staffUser.license_verified ? "emerald" : staffUser.license_photo_url ? "amber" : "slate"}>
                    {staffUser.license_verified ? "License ok" : staffUser.license_photo_url ? "License review" : "No license"}
                  </Pill>
                ) : (
                  <Pill color={staffUser.official_photo_verified ? "emerald" : staffUser.official_photo_url ? "amber" : "slate"}>
                    {staffUser.official_photo_verified ? "Photo ok" : staffUser.official_photo_url ? "Photo review" : "No photo"}
                  </Pill>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Btn tone="ghost" onClick={() => startEditingUser(staffUser)} className="!px-3 !py-2 text-xs">Edit</Btn>
                {user?.id !== staffUser.id ? <Btn tone="danger" onClick={() => deleteUser(staffUser)} disabled={userDeleteBusyId === staffUser.id} className="!px-3 !py-2 text-xs">{userDeleteBusyId === staffUser.id ? "Deleting..." : "Delete"}</Btn> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );

  const renderUserPreview = (staffUser, role) => (
    <GlassCard className="h-full">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <SLabel>{role} Preview</SLabel>
          <p className="text-xl font-black text-[var(--text)]">{staffUser ? staffUser.full_name : `Select a ${role.toLowerCase()}`}</p>
        </div>
        {staffUser ? <Pill color={staffUser.is_active ? "emerald" : "slate"}>{staffUser.is_active ? "Active" : "Inactive"}</Pill> : null}
      </div>
      {!staffUser ? (
        <p className="text-sm text-[var(--muted)]">Choose a {role.toLowerCase()} from the table to view their profile, verification state, and admin actions.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            {staffUser.official_photo_url ? (
              <img src={staffUser.official_photo_url} alt={staffUser.full_name} className="h-20 w-20 rounded-[1.4rem] object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-[1.4rem] bg-[var(--accent-soft)] text-xl font-black text-[var(--primary)]">{avatarInitials(staffUser.full_name)}</div>
            )}
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-bold text-[var(--text)]">{staffUser.phone}</p>
              <p className="break-all text-sm text-[var(--muted)]">{staffUser.email || "No email provided"}</p>
              <p className="text-sm text-[var(--muted)]">{staffUser.address || "No address recorded"}</p>
              {staffUser.license_number ? <p className="text-sm font-semibold text-[var(--text)]">License: {staffUser.license_number}</p> : null}
            </div>
          </div>
          {(staffUser.official_photo_url || staffUser.license_photo_url) ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {staffUser.official_photo_url ? <img src={staffUser.official_photo_url} alt={`${staffUser.full_name} profile`} className="h-36 w-full rounded-[1.2rem] object-cover" /> : <div className={`flex h-36 items-center justify-center rounded-[1.2rem] border ${rowBg} text-sm text-[var(--muted)]`}>No official photo</div>}
              {role === "Driver" ? (
                staffUser.license_photo_url ? <img src={staffUser.license_photo_url} alt={`${staffUser.full_name} license`} className="h-36 w-full rounded-[1.2rem] object-cover" /> : <div className={`flex h-36 items-center justify-center rounded-[1.2rem] border ${rowBg} text-sm text-[var(--muted)]`}>No license photo</div>
              ) : (
                <div className={`flex h-36 items-center justify-center rounded-[1.2rem] border ${rowBg} text-sm text-[var(--muted)]`}>License not required</div>
              )}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {staffUser.official_photo_url ? (
              <Btn tone="ghost" onClick={() => reviewUser(staffUser, { official_photo_verified: !staffUser.official_photo_verified })} disabled={reviewBusyId === staffUser.id} className="!px-4 !py-2 text-xs">
                {staffUser.official_photo_verified ? "Revoke photo" : "Verify photo"}
              </Btn>
            ) : null}
            {role === "Driver" && staffUser.license_photo_url ? (
              <Btn tone="ghost" onClick={() => reviewUser(staffUser, { license_verified: !staffUser.license_verified })} disabled={reviewBusyId === staffUser.id} className="!px-4 !py-2 text-xs">
                {staffUser.license_verified ? "Revoke license" : "Verify license"}
              </Btn>
            ) : null}
            {user?.id !== staffUser.id ? (
              <Btn tone={staffUser.is_active ? "ghost" : "success"} onClick={() => reviewUser(staffUser, { is_active: !staffUser.is_active })} disabled={reviewBusyId === staffUser.id} className="!px-4 !py-2 text-xs">
                {staffUser.is_active ? "Set inactive" : "Activate account"}
              </Btn>
            ) : <Pill color="indigo">Current admin</Pill>}
          </div>
        </div>
      )}
    </GlassCard>
  );

  const renderSectionContent = () => {
    if (activeSection === "dashboard") {
      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-5">
            <StatCard label="Total Buses" value={busList.length} sub={`${fleetStatus.active} active | ${fleetStatus.inactive} inactive`} />
            <StatCard label="Total Drivers" value={driverUsers.length} sub={`${filteredDrivers.length} visible in current search`} accent="text-[var(--primary)]" />
            <StatCard label="Total Helpers" value={helperUsers.length} sub={`${filteredHelpers.length} visible in current search`} />
            <StatCard label="Total Routes" value={recentRoutes.length} sub={`${builderStops.length} stations mapped`} accent="text-[var(--accent-strong)]" />
            <StatCard label="Total Passengers" value={roleCounts.PASSENGER || 0} sub={`${trips.live || 0} live trips right now`} />
          </div>
          <div className="grid gap-4 xl:grid-cols-4">
            <StatCard label="Today's Trips" value={trips.today || trips.live || 0} sub={`${trips.total || 0} total recorded trips`} accent="text-[var(--success)]" />
            <StatCard label="Total Earnings" value={fmtMoney(payments.revenue_success || 0)} sub={`${payments.success || 0} successful payments`} accent="text-[var(--primary)]" />
            <StatCard label="Occupancy Rate" value={`${overallOccupancyRate}%`} sub={`${rideOps.onboard || 0} onboard | ${rideOps.awaiting_payment || 0} awaiting payment`} accent="text-[var(--accent-strong)]" />
            <StatCard label="Passenger Rating" value={reviews.avg_rating ? `${Number(reviews.avg_rating).toFixed(1)} / 5` : "--"} sub={`${reviews.total || 0} reviews | ${reviews.positive || 0} positive`} accent="text-[var(--success)]" />
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
            <GlassCard>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <SLabel>Earnings Trend</SLabel>
                  <p className="text-2xl font-black text-[var(--text)]">MetroBus revenue movement</p>
                </div>
                <Pill color="emerald">{reportRange}</Pill>
              </div>
              <SimpleLineChart points={earningsTrend} />
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-[var(--muted)] xl:grid-cols-4">
                {earningsTrend.slice(-4).map((point) => <div key={point.label} className={`rounded-[1rem] border px-3 py-3 ${rowBg}`}>{point.label}: {fmtMoney(point.value)}</div>)}
              </div>
            </GlassCard>
            <GlassCard>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <SLabel>Fleet Snapshot</SLabel>
                  <p className="text-2xl font-black text-[var(--text)]">Operations health</p>
                </div>
                <Pill color={fleetStatus.delayed ? "amber" : "emerald"}>{fleetStatus.delayed} delayed</Pill>
              </div>
              <div className="grid gap-3">
                <div className={`rounded-[1.2rem] border px-4 py-4 ${rowBg}`}>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Active buses</p>
                  <p className="mt-2 text-3xl font-black text-[var(--text)]">{fleetStatus.active}</p>
                </div>
                <div className={`rounded-[1.2rem] border px-4 py-4 ${rowBg}`}>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Inactive buses</p>
                  <p className="mt-2 text-3xl font-black text-[var(--text)]">{fleetStatus.inactive}</p>
                </div>
                <div className={`rounded-[1.2rem] border px-4 py-4 ${rowBg}`}>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Notifications</p>
                  <p className="mt-2 text-3xl font-black text-[var(--text)]">{notificationCount}</p>
                </div>
              </div>
            </GlassCard>
          </div>
          <div className="grid gap-5 xl:grid-cols-[1fr_1fr_0.95fr]">
            <GlassCard>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <SLabel>Route-Wise Occupancy</SLabel>
                  <p className="text-xl font-black text-[var(--text)]">Demand by route</p>
                </div>
                <Pill color="indigo">{routeOccupancyData.length} routes</Pill>
              </div>
              <SimpleBarChart items={routeOccupancyData.length ? routeOccupancyData : [{ label: "No data", value: 0 }]} color="var(--accent)" />
            </GlassCard>
            <GlassCard>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <SLabel>Passenger Distribution</SLabel>
                  <p className="text-xl font-black text-[var(--text)]">User mix across MetroBus</p>
                </div>
                <Pill color="sky">{overview?.users_total || 0} users</Pill>
              </div>
              <SimpleDonutChart items={passengerDistribution} />
            </GlassCard>
            <GlassCard>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <SLabel>Upcoming Assignments</SLabel>
                  <p className="text-xl font-black text-[var(--text)]">Next planned departures</p>
                </div>
                <Pill color="amber">{upcomingSchedules.length} scheduled</Pill>
              </div>
              <div className="space-y-3">
                {!upcomingSchedules.length ? <p className="text-sm text-[var(--muted)]">No planned assignments yet.</p> : upcomingSchedules.map((schedule) => (
                  <div key={schedule.id} className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[var(--text)]">{schedule.route_name}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{schedule.bus_plate} | {schedule.driver_name || "--"} | {schedule.helper_name || "--"}</p>
                      </div>
                      <Pill color="amber">{schedule.status}</Pill>
                    </div>
                    <p className="mt-3 text-xs text-[var(--muted)]">Starts {fmt(schedule.scheduled_start_time)}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr_1fr]">
            <GlassCard>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <SLabel>Review Snapshot</SLabel>
                  <p className="text-xl font-black text-[var(--text)]">Passenger satisfaction pulse</p>
                </div>
                <Pill color={reviews.critical ? "amber" : "emerald"}>{reviews.total || 0} total</Pill>
              </div>
              <div className="grid gap-3">
                <div className={`rounded-[1.2rem] border px-4 py-4 ${rowBg}`}>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Average rating</p>
                  <p className="mt-2 text-3xl font-black text-[var(--text)]">{reviews.avg_rating ? Number(reviews.avg_rating).toFixed(1) : "--"}</p>
                </div>
                <div className={`rounded-[1.2rem] border px-4 py-4 ${rowBg}`}>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Positive reviews</p>
                  <p className="mt-2 text-3xl font-black text-[var(--text)]">{reviews.positive || 0}</p>
                </div>
                <div className={`rounded-[1.2rem] border px-4 py-4 ${rowBg}`}>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Critical reviews</p>
                  <p className="mt-2 text-3xl font-black text-[var(--text)]">{reviews.critical || 0}</p>
                </div>
              </div>
            </GlassCard>
            <GlassCard>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <SLabel>Recent Reviews</SLabel>
                  <p className="text-xl font-black text-[var(--text)]">Latest passenger feedback</p>
                </div>
                <Pill color="indigo">{recentReviews.length}</Pill>
              </div>
              <div className="space-y-3">
                {!recentReviews.length ? <p className="text-sm text-[var(--muted)]">No ride reviews submitted yet.</p> : recentReviews.map((review) => (
                  <div key={review.id} className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[var(--text)]">{review.passenger_name}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{review.route_name} | Bus {review.bus_plate}</p>
                      </div>
                      <Pill color={review.rating >= 4 ? "emerald" : review.rating <= 2 ? "red" : "amber"}>{review.rating}/5</Pill>
                    </div>
                    <p className="mt-3 text-sm text-[var(--muted)]">{review.note || "Passenger left a rating without additional notes."}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
            <GlassCard>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <SLabel>Top Rated Corridors</SLabel>
                  <p className="text-xl font-black text-[var(--text)]">Best performing routes</p>
                </div>
                <Pill color="sky">{topRatedRoutes.length}</Pill>
              </div>
              <div className="space-y-3">
                {!topRatedRoutes.length ? <p className="text-sm text-[var(--muted)]">Route review analytics will appear after completed rides are rated.</p> : topRatedRoutes.map((route) => (
                  <div key={route.route_id} className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[var(--text)]">{route.route_name}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{route.city} | {route.reviews_total} reviews</p>
                      </div>
                      <Pill color="emerald">{Number(route.avg_rating || 0).toFixed(1)}/5</Pill>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <GlassCard>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <SLabel>Recent Activity</SLabel>
                  <p className="text-xl font-black text-[var(--text)]">System events and updates</p>
                </div>
                <Btn tone="ghost" onClick={() => { loadDB(); loadRoute(); loadSched(); loadBuses(); loadUsers(); }} className="!px-4 !py-2">Refresh</Btn>
              </div>
              <div className="space-y-3">
                {!recentActivities.length ? <p className="text-sm text-[var(--muted)]">No recent activity yet.</p> : recentActivities.map((activity) => (
                  <div key={activity.id} className={`flex items-start justify-between gap-3 rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                    <div>
                      <p className="font-bold text-[var(--text)]">{activity.title}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{activity.subtitle}</p>
                    </div>
                    <div className="text-right">
                      <Pill color={activity.tone}>{new Date(activity.time).toLocaleDateString()}</Pill>
                      <p className="mt-2 text-xs text-[var(--muted)]">{fmt(activity.time)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
            <GlassCard>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <SLabel>Live Operations</SLabel>
                  <p className="text-xl font-black text-[var(--text)]">Trips happening now</p>
                </div>
                <Pill color={dashboard?.live_trips?.length ? "emerald" : "slate"}>{dashboard?.live_trips?.length || 0} live</Pill>
              </div>
              <div className="space-y-3">
                {!dashboard?.live_trips?.length ? <p className="text-sm text-[var(--muted)]">No live trips right now.</p> : dashboard.live_trips.map((trip) => (
                  <div key={trip.id} className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[var(--text)]">{trip.route_name}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">Bus {trip.bus_plate} | {trip.driver_name || "--"} | {trip.helper_name || "--"}</p>
                      </div>
                      <Pill color={trip.deviation_mode ? "amber" : "emerald"}>{trip.deviation_mode ? "Deviation" : "On route"}</Pill>
                    </div>
                    <div className="mt-3 grid gap-2 xl:grid-cols-2">
                      <div className={`rounded-[0.9rem] border px-3 py-3 text-xs ${rowBg}`}>Started {fmt(trip.started_at)}</div>
                      <div className={`rounded-[0.9rem] border px-3 py-3 text-xs ${rowBg}`}>{trip.latest_location ? `GPS ${Number(trip.latest_location.lat).toFixed(4)}, ${Number(trip.latest_location.lng).toFixed(4)}` : "No GPS data yet"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      );
    }

    if (activeSection === "drivers") {
      return (
        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.25fr_0.9fr]">
          {renderUserForm("Driver")}
          {renderUserTable(filteredDrivers, "Drivers Table", selectedDriver?.id, setSelectedDriverId, "Driver")}
          {renderUserPreview(selectedDriver, "Driver")}
        </div>
      );
    }

    if (activeSection === "helpers") {
      return (
        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.25fr_0.9fr]">
          {renderUserForm("Helper")}
          {renderUserTable(filteredHelpers, "Helpers Table", selectedHelper?.id, setSelectedHelperId, "Helper")}
          {renderUserPreview(selectedHelper, "Helper")}
        </div>
      );
    }

    if (activeSection === "buses") {
      return (
        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.15fr_0.9fr]">
          <GlassCard>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <SLabel>{editingBusId ? "Edit Bus" : "Add New Bus"}</SLabel>
                <p className="text-xl font-black text-[var(--text)]">Fleet registration</p>
              </div>
              {editingBusId ? (
                <button type="button" onClick={resetBusForm} className={`rounded-[1rem] border px-3 py-2 text-xs font-black transition ${rowBg} text-[var(--text)]`}>
                  Cancel
                </button>
              ) : null}
            </div>
            <div className="grid gap-4">
              <InputField label="Bus Name" value={busName} onChange={setBusName} placeholder="MetroBus Lakeside Express" />
              <InputField label="Plate Number" value={busPlate} onChange={setBusPlate} placeholder="BA 1 CHA 2233" />
              <div className="grid gap-4 xl:grid-cols-2">
                <InputField label="Make Year" value={busYear} onChange={setBusYear} placeholder="2024" type="number" />
                <SelectField label="Condition" value={busCondition} onChange={setBusCondition} options={[{ value: "NEW", label: "New" }, { value: "NORMAL", label: "Normal" }, { value: "OLD", label: "Old" }]} />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <InputField label="Seat Rows" value={busRows} onChange={setBusRows} placeholder="9" type="number" />
                <InputField label="Seat Columns" value={busCols} onChange={setBusCols} placeholder="4" type="number" />
              </div>
              <div className={`rounded-[1.2rem] border px-4 py-4 ${rowBg}`}>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Seat arrangement preview</p>
                <p className="mt-2 text-3xl font-black text-[var(--text)]">{busCapacityPreview} seats</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{busRows} rows x {busCols} columns</p>
              </div>
              <FileField label="Exterior Photo" file={busExteriorPhoto} onChange={setBusExteriorPhoto} />
              <FileField label="Interior Photo" file={busInteriorPhoto} onChange={setBusInteriorPhoto} />
              <FileField label="Seats Photo" file={busSeatPhoto} onChange={setBusSeatPhoto} />
              <button type="button" onClick={() => setBusActive((value) => !value)} className={`rounded-[1rem] border px-4 py-3 text-sm font-black ${busActive ? "border-transparent bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-white" : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]"}`}>
                {busActive ? "Active bus" : "Inactive bus"}
              </button>
              <Btn tone="primary" onClick={saveBus} disabled={busMgmtBusy} className="w-full !py-4">
                {busMgmtBusy ? (editingBusId ? "Saving..." : "Creating...") : (editingBusId ? "Save Bus Changes" : "Add Bus")}
              </Btn>
            </div>
          </GlassCard>
          <GlassCard className="h-full">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <SLabel>Fleet Table</SLabel>
                <p className="text-xl font-black text-[var(--text)]">{filteredBuses.length} buses</p>
              </div>
              <Pill color="sky">{fleetStatus.active} active</Pill>
            </div>
            <div className="overflow-hidden rounded-[1.2rem] border border-[var(--border)]">
              <div className="grid grid-cols-[1.3fr_0.7fr_0.85fr_0.85fr] gap-3 bg-[var(--surface-muted)] px-4 py-3 text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
                <span>Bus</span>
                <span>Capacity</span>
                <span>Assignment</span>
                <span>Actions</span>
              </div>
              <div className="max-h-[34rem] overflow-y-auto bg-[var(--surface-strong)]">
                {!filteredBuses.length ? <div className="px-4 py-8 text-sm text-[var(--muted)]">No buses match the current search.</div> : filteredBuses.map((bus) => (
                  <div key={bus.id} className={`grid grid-cols-[1.3fr_0.7fr_0.85fr_0.85fr] gap-3 border-t border-[var(--border)] px-4 py-4 ${selectedBusPreview?.id === bus.id ? "bg-[var(--accent-soft)]" : ""}`}>
                    <button type="button" className="min-w-0 text-left" onClick={() => setSelectedBusId(bus.id)}>
                      <p className="truncate font-bold text-[var(--text)]">{bus.display_name || bus.plate_number}</p>
                      <p className="mt-1 truncate text-xs text-[var(--muted)]">{bus.plate_number} | {bus.condition} | {bus.model_year || "Year N/A"}</p>
                    </button>
                    <div>
                      <p className="font-bold text-[var(--text)]">{bus.capacity}</p>
                      <p className="text-xs text-[var(--muted)]">{bus.layout_rows} x {bus.layout_columns}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-[var(--text)]">{bus.driver_name || "Driver unassigned"}</p>
                      <p className="text-xs text-[var(--muted)]">{bus.helper_name || "Helper unassigned"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Btn tone="ghost" onClick={() => startEditingBus(bus)} className="!px-3 !py-2 text-xs">Edit</Btn>
                      <Btn tone="danger" onClick={() => deleteBus(bus)} disabled={busDeleteBusyId === bus.id} className="!px-3 !py-2 text-xs">{busDeleteBusyId === bus.id ? "Deleting..." : "Delete"}</Btn>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
          <GlassCard className="h-full">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <SLabel>Bus Detail</SLabel>
                <p className="text-xl font-black text-[var(--text)]">{selectedBusPreview ? (selectedBusPreview.display_name || selectedBusPreview.plate_number) : "Select a bus"}</p>
              </div>
              {selectedBusPreview ? <Pill color={selectedBusPreview.is_active ? "emerald" : "slate"}>{selectedBusPreview.is_active ? "Active" : "Inactive"}</Pill> : null}
            </div>
            {!selectedBusPreview ? (
              <p className="text-sm text-[var(--muted)]">Choose a bus from the table to inspect its seat layout, assignment, and photos.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 xl:grid-cols-2">
                  <div className={`rounded-[1.2rem] border px-4 py-4 ${rowBg}`}>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Assigned driver</p>
                    <p className="mt-2 text-sm font-bold text-[var(--text)]">{selectedBusPreview.driver_name || "Unassigned"}</p>
                  </div>
                  <div className={`rounded-[1.2rem] border px-4 py-4 ${rowBg}`}>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Assigned helper</p>
                    <p className="mt-2 text-sm font-bold text-[var(--text)]">{selectedBusPreview.helper_name || "Unassigned"}</p>
                  </div>
                </div>
                <SeatLayoutPreview rows={selectedBusPreview.layout_rows} columns={selectedBusPreview.layout_columns} capacity={selectedBusPreview.capacity} />
                {selectedBusSchedule ? (
                  <div className={`rounded-[1.2rem] border px-4 py-4 ${rowBg}`}>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Upcoming route</p>
                    <p className="mt-2 text-sm font-bold text-[var(--text)]">{selectedBusSchedule.route_name}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">Starts {fmt(selectedBusSchedule.scheduled_start_time)}</p>
                  </div>
                ) : null}
                {(selectedBusPreview.exterior_photo_url || selectedBusPreview.interior_photo_url || selectedBusPreview.seat_photo_url) ? (
                  <div className="grid gap-3">
                    {[selectedBusPreview.exterior_photo_url, selectedBusPreview.interior_photo_url, selectedBusPreview.seat_photo_url].filter(Boolean).map((photoUrl, index) => (
                      <img key={`${selectedBusPreview.id}-${index}`} src={photoUrl} alt={`${selectedBusPreview.display_name || selectedBusPreview.plate_number} ${index + 1}`} className="h-32 w-full rounded-[1.2rem] object-cover" />
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </GlassCard>
        </div>
      );
    }

    if (activeSection === "stops") {
      return (
        <div className="grid gap-5 xl:grid-cols-[0.92fr_1.25fr_0.88fr]">
          <GlassCard>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <SLabel>Add Stop / Station</SLabel>
                <p className="text-xl font-black text-[var(--text)]">Pin new station on map</p>
              </div>
              {stopBusy ? <Pill color="amber">Saving...</Pill> : null}
            </div>
            <div className="grid gap-4">
              <InputField label="Stop Name" value={stopName} onChange={setStopName} placeholder="Bindhyabasini Gate" />
              <div className="grid gap-4 xl:grid-cols-2">
                <InputField label="Latitude" value={stopLat} onChange={setStopLat} placeholder="28.233421" />
                <InputField label="Longitude" value={stopLng} onChange={setStopLng} placeholder="83.996812" />
              </div>
              <div className={`rounded-[1.2rem] border px-4 py-4 ${rowBg}`}>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Pinned coordinate</p>
                <p className="mt-2 text-sm font-bold text-[var(--text)]">{stopLat && stopLng ? `${stopLat}, ${stopLng}` : "Tap the map to pin a stop coordinate."}</p>
              </div>
              <button type="button" onClick={() => setStopActive((value) => !value)} className={`rounded-[1rem] border px-4 py-3 text-sm font-black ${stopActive ? "border-transparent bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-white" : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]"}`}>
                {stopActive ? "Active station" : "Inactive station"}
              </button>
              <div className="grid gap-3 xl:grid-cols-2">
                <Btn tone="ghost" onClick={clearStopForm} className="w-full !py-4">Clear</Btn>
                <Btn tone="success" onClick={createStop} disabled={stopBusy} className="w-full !py-4">{stopBusy ? "Saving..." : "Add Stop"}</Btn>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="overflow-hidden !p-0">
            <div className="border-b border-[var(--border)] px-5 py-5">
              <SLabel>Interactive Stop Map</SLabel>
              <p className="text-xl font-black text-[var(--text)]">MetroBus stop network</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Tap the map to set coordinates, then save the station.</p>
            </div>
            <div className="h-[42rem]">
              <MapContainer center={[28.2096, 83.9856]} zoom={12} scrollWheelZoom className="h-full w-full">
                <TileLayer attribution="&copy; OpenStreetMap &copy; CARTO" url={mapTileUrl} />
                <MapViewport points={mapPts} />
                <StopMapPicker onPick={handleMapPick} />
                {builderStops.map((stop) => {
                  const lat = Number(stop.lat);
                  const lng = Number(stop.lng);
                  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                  const isSelected = selectedStopPreview?.id === stop.id;
                  return (
                    <CircleMarker
                      key={stop.id}
                      center={[lat, lng]}
                      radius={isSelected ? 9 : 6}
                      eventHandlers={{ click: () => setSelectedStopId(stop.id) }}
                      pathOptions={{ color: isSelected ? "#ff8a1f" : "#4b2666", fillColor: isSelected ? "#ff8a1f" : "#4b2666", fillOpacity: 0.9 }}
                    >
                      <Popup>
                        <div className="text-sm font-semibold text-slate-900">{stop.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{lat.toFixed(4)}, {lng.toFixed(4)}</div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>
          </GlassCard>
          <GlassCard className="h-full">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <SLabel>Station List</SLabel>
                <p className="text-xl font-black text-[var(--text)]">{filteredStops.length} mapped stops</p>
              </div>
              <Pill color="sky">{recentStops.length} recent</Pill>
            </div>
            <div className="space-y-3">
              {!filteredStops.length ? <p className="text-sm text-[var(--muted)]">No stations match the current search.</p> : filteredStops.map((stop) => (
                <button key={stop.id} type="button" onClick={() => setSelectedStopId(stop.id)} className={`w-full rounded-[1.1rem] border px-4 py-4 text-left ${selectedStopPreview?.id === stop.id ? "border-transparent bg-[var(--accent-soft)]" : rowBg}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-[var(--text)]">{stop.name}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{Number(stop.lat).toFixed(4)}, {Number(stop.lng).toFixed(4)}</p>
                    </div>
                    <Pill color={stop.is_active ? "emerald" : "slate"}>{stop.is_active ? "Active" : "Inactive"}</Pill>
                  </div>
                </button>
              ))}
            </div>
            {selectedStopPreview ? (
              <div className={`mt-4 rounded-[1.2rem] border px-4 py-4 ${rowBg}`}>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Selected station</p>
                <p className="mt-2 font-bold text-[var(--text)]">{selectedStopPreview.name}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{Number(selectedStopPreview.lat).toFixed(6)}, {Number(selectedStopPreview.lng).toFixed(6)}</p>
                <p className="mt-3 text-xs text-[var(--muted)]">Creation and route usage are live. Stop edit and delete can be wired in once the stop detail backend endpoint is exposed.</p>
              </div>
            ) : null}
          </GlassCard>
        </div>
      );
    }

    if (activeSection === "routes") {
      return (
        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.2fr_0.9fr]">
          <div className="space-y-5">
            <GlassCard>
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <SLabel>{editingRouteId ? "Edit Route" : "Route Builder"}</SLabel>
                  <p className="text-xl font-black text-[var(--text)]">Create and shape route paths</p>
                </div>
                {editingRouteId ? <Btn tone="ghost" onClick={clearRoute} className="!px-4 !py-2">Cancel</Btn> : null}
              </div>
              <div className="grid gap-4">
                <InputField label="Route Name" value={routeName} onChange={setRouteName} placeholder="Lakeside to Prithvi Chowk" />
                <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
                  <InputField label="City" value={routeCity} onChange={setRouteCity} placeholder="Pokhara" />
                  <button type="button" onClick={() => setRouteActive((value) => !value)} className={`rounded-[1rem] border px-4 py-3 text-sm font-black ${routeActive ? "border-transparent bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-white" : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]"}`}>
                    {routeActive ? "Active route" : "Inactive route"}
                  </button>
                </div>
              </div>
            </GlassCard>
            <GlassCard>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <SLabel>Selected Stops</SLabel>
                  <p className="text-xl font-black text-[var(--text)]">{selectedStops.length} stops in sequence</p>
                </div>
                <Btn tone="ghost" onClick={clearRoute} className="!px-4 !py-2">Clear</Btn>
              </div>
              <div className="space-y-3">
                {!selectedStops.length ? <p className="text-sm text-[var(--muted)]">Click map markers to add route stops in order.</p> : selectedStops.map((stop, index) => (
                  <div key={stop.id} className={`flex items-center gap-3 rounded-[1.1rem] border px-4 py-3 ${rowBg}`}>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-black text-[var(--primary)]">{index + 1}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-[var(--text)]">{stop.name}</p>
                      <p className="text-xs text-[var(--muted)]">{Number(stop.lat).toFixed(4)}, {Number(stop.lng).toFixed(4)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Btn tone="ghost" onClick={() => moveStop(index, -1)} className="!px-3 !py-2 text-xs">Up</Btn>
                      <Btn tone="ghost" onClick={() => moveStop(index, 1)} className="!px-3 !py-2 text-xs">Down</Btn>
                      <Btn tone="danger" onClick={() => toggleStop(stop.id)} className="!px-3 !py-2 text-xs">Remove</Btn>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
            {selectedStops.length >= 2 ? (
              <GlassCard>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <SLabel>Segment Fare Editor</SLabel>
                    <p className="text-xl font-black text-[var(--text)]">Fare and route shaping controls</p>
                  </div>
                  <Btn tone="ghost" onClick={clearRouteShaping} className="!px-4 !py-2">Reset Path</Btn>
                </div>
                <div className="space-y-4">
                  {selectedStops.slice(0, -1).map((stop, index) => (
                    <div key={`${stop.id}-${index}`} className={`rounded-[1rem] border px-4 py-4 ${selectedSegmentIndex === index ? "border-[var(--accent)] bg-[var(--accent-soft)]" : rowBg}`}>
                      <label className="mb-1.5 block text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">{stop.name} to {selectedStops[index + 1].name}</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={segmentFares[index] || ""}
                        onChange={(event) => {
                          const next = [...segmentFares];
                          next[index] = event.target.value;
                          setSegmentFares(next);
                        }}
                        className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--text)] outline-none focus:border-[var(--primary)]"
                        placeholder="Enter fare"
                      />
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Btn tone={selectedSegmentIndex === index ? "primary" : "ghost"} onClick={() => setSelectedSegmentIndex(index)} className="!px-3 !py-2 text-xs">
                          {selectedSegmentIndex === index ? "Selected Segment" : "Select Segment"}
                        </Btn>
                        <Btn tone={pendingDiversionSegmentIndex === index ? "success" : "ghost"} onClick={() => beginSegmentDiversionPick(index)} className="!px-3 !py-2 text-xs">
                          {pendingDiversionSegmentIndex === index ? "Click Map Now" : "Add Diversion"}
                        </Btn>
                        <Pill color="indigo">{segmentWaypointGroups[index]?.length || 0} control point{(segmentWaypointGroups[index]?.length || 0) === 1 ? "" : "s"}</Pill>
                      </div>
                      {segmentWaypointGroups[index]?.length ? (
                        <div className="mt-3 space-y-2">
                          {segmentWaypointGroups[index].map((waypoint, waypointIndex) => (
                            <div key={waypoint.key} className="flex items-center justify-between gap-3 rounded-[0.9rem] border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2">
                              <div>
                                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--primary)]">Control Point {waypointIndex + 1}</p>
                                <p className="text-xs text-[var(--muted)]">{Number(waypoint.lat).toFixed(5)}, {Number(waypoint.lng).toFixed(5)}</p>
                              </div>
                              <Btn tone="danger" onClick={() => removeRouteWaypoint(waypoint.key)} className="!px-3 !py-2 text-xs">Remove</Btn>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-[var(--muted)]">Select the segment, click `Add Diversion`, then click the map where the route should pass. The system will recalculate the shortest road path while covering that diversion point.</p>
                      )}
                    </div>
                  ))}
                  <Btn tone="success" onClick={saveRoute} disabled={routeBusy} className="w-full !py-4">
                    {routeBusy ? (editingRouteId ? "Saving..." : "Creating...") : (editingRouteId ? "Save Route Changes" : "Create Route")}
                  </Btn>
                </div>
              </GlassCard>
            ) : null}
          </div>
          <GlassCard className="overflow-hidden !p-0">
            <div className="border-b border-[var(--border)] px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <SLabel>Route Map</SLabel>
                  <p className="text-xl font-black text-[var(--text)]">Stations and visual route path</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Click stations to add or remove stops. Then choose a segment, press `Add Diversion`, and click the map where you want the road route to pass. Existing handles can still be dragged to fine-tune the path.</p>
                </div>
                <Btn tone={routePinMode ? "danger" : "ghost"} onClick={() => { if (routePinMode) clearRouteDraftStop(); else setRoutePinMode(true); }} className="!px-4 !py-2">
                  {routePinMode ? "Cancel Pin" : "Pin New Stop"}
                </Btn>
              </div>
              {(routePinMode || routeDraftStopLat || routeDraftStopLng) ? (
                <div className={`mt-4 rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Route map pin</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">{routePinMode ? "Click the map to drop a new stop pin, then give the stop a name." : "Review the dropped pin, name the stop, and save it into MetroBus."}</p>
                  <div className="mt-4 grid gap-4">
                    <InputField label="Stop Name" value={routeDraftStopName} onChange={setRouteDraftStopName} placeholder="Zero KM Gate" />
                    <div className="grid gap-4 xl:grid-cols-2">
                      <InputField label="Latitude" value={routeDraftStopLat} onChange={setRouteDraftStopLat} placeholder="28.233421" />
                      <InputField label="Longitude" value={routeDraftStopLng} onChange={setRouteDraftStopLng} placeholder="83.996812" />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Btn tone="success" onClick={createStopFromRouteMap} disabled={routeDraftStopBusy} className="!px-4 !py-2">
                        {routeDraftStopBusy ? "Saving..." : "Create Stop"}
                      </Btn>
                      <Btn tone="ghost" onClick={clearRouteDraftStop} className="!px-4 !py-2">Remove Pin</Btn>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="h-[42rem]">
              <MapContainer center={[28.2096, 83.9856]} zoom={12} scrollWheelZoom className="h-full w-full">
                <TileLayer attribution="&copy; OpenStreetMap &copy; CARTO" url={mapTileUrl} />
                <MapViewport points={mapPts} />
                <RouteStopDraftPicker enabled={routePinMode} onPick={handleRouteDraftStopPick} />
                <RouteDiversionPicker enabled={!routePinMode && pendingDiversionSegmentIndex != null} onPick={placeDiversionPoint} />
                {routeSegmentLines.map((segmentPoints, index) => (
                  segmentPoints.length > 1 ? (
                    <Polyline
                      key={`segment-hit-${index}`}
                      positions={segmentPoints}
                      pathOptions={{ color: selectedSegmentIndex === index ? "#ff8a1f" : "#4b2666", weight: selectedSegmentIndex === index ? 14 : 12, opacity: 0.001 }}
                      eventHandlers={{ click: () => { if (routePinMode) return; beginSegmentDiversionPick(index); } }}
                    />
                  ) : null
                ))}
                {dispPts.length > 1 ? <Polyline positions={dispPts} pathOptions={{ color: "#ff8a1f", weight: 5, opacity: 0.9 }} /> : null}
                {routeDraftStopLat && routeDraftStopLng ? (
                  <Marker
                    position={[Number(routeDraftStopLat), Number(routeDraftStopLng)]}
                    draggable
                    icon={routeWaypointIcon(true)}
                    eventHandlers={{
                      dragend: (event) => handleRouteDraftStopPick(event.target.getLatLng()),
                    }}
                  >
                    <Popup>
                      <div className="text-sm font-semibold text-slate-900">{routeDraftStopName?.trim() || "New stop pin"}</div>
                      <div className="mt-1 text-xs text-slate-500">Drag to fine-tune the location, or remove this pin.</div>
                      <button
                        type="button"
                        onClick={clearRouteDraftStop}
                        className="mt-3 rounded-lg bg-[#fce7eb] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#b4233d]"
                      >
                        Remove Pin
                      </button>
                    </Popup>
                  </Marker>
                ) : null}
                {routeWaypoints.map((waypoint) => (
                  <Marker
                    key={waypoint.key}
                    position={[Number(waypoint.lat), Number(waypoint.lng)]}
                    draggable
                    icon={routeWaypointIcon(Number(waypoint.segment_index) === selectedSegmentIndex)}
                    eventHandlers={{
                      click: () => setSelectedSegmentIndex(Number(waypoint.segment_index) || 0),
                      dblclick: () => removeRouteWaypoint(waypoint.key),
                      contextmenu: () => removeRouteWaypoint(waypoint.key),
                      dragend: (event) => {
                        const latlng = event.target.getLatLng();
                        moveRouteWaypoint(waypoint.key, latlng);
                      },
                    }}
                  >
                    <Popup>
                      <div className="text-sm font-semibold text-slate-900">Segment {(Number(waypoint.segment_index) || 0) + 1} route handle</div>
                      <div className="mt-1 text-xs text-slate-500">Drag to bend the route line, or remove this handle.</div>
                      <button
                        type="button"
                        onClick={() => removeRouteWaypoint(waypoint.key)}
                        className="mt-3 rounded-lg bg-[#fce7eb] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#b4233d]"
                      >
                        Remove Handle
                      </button>
                    </Popup>
                  </Marker>
                ))}
                {builderStops.map((stop) => {
                  const lat = Number(stop.lat);
                  const lng = Number(stop.lng);
                  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                  const order = selectedStopIds.indexOf(stop.id);
                  const selected = order !== -1;
                  return (
                    <CircleMarker
                      key={stop.id}
                      center={[lat, lng]}
                      radius={selected ? 9 : 6}
                      eventHandlers={{ click: () => toggleStop(stop.id) }}
                      pathOptions={{ color: selected ? "#ff8a1f" : "#4b2666", fillColor: selected ? "#ff8a1f" : "#4b2666", fillOpacity: 0.9 }}
                    >
                      <Popup>
                        <div className="text-sm font-semibold text-slate-900">{stop.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{selected ? `Stop ${order + 1}` : "Click to add to route"}</div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>
          </GlassCard>
          <GlassCard className="h-full">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <SLabel>Route Catalog</SLabel>
                <p className="text-xl font-black text-[var(--text)]">{filteredRoutes.length} routes</p>
              </div>
              <Pill color="indigo">{recentRoutes.length} total</Pill>
            </div>
            <div className="space-y-3">
              {!filteredRoutes.length ? <p className="text-sm text-[var(--muted)]">No routes match the current search.</p> : filteredRoutes.map((route) => (
                <div key={route.id} className={`rounded-[1.1rem] border px-4 py-4 ${selectedRoutePreview?.id === route.id ? "border-transparent bg-[var(--accent-soft)]" : rowBg}`}>
                  <button type="button" className="w-full text-left" onClick={() => setSelectedRouteId(route.id)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[var(--text)]">{route.name}</p>
                        <p className="mt-1 truncate text-xs text-[var(--muted)]">{route.city} | {route.stops_count} stops</p>
                        {route.route_stops?.length ? <p className="mt-2 text-xs text-[var(--muted)]">{route.route_stops[0].stop.name} to {route.route_stops[route.route_stops.length - 1].stop.name}</p> : null}
                      </div>
                      <Pill color={route.is_active ? "emerald" : "slate"}>{route.is_active ? "Active" : "Inactive"}</Pill>
                    </div>
                  </button>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn tone="ghost" onClick={() => startEditingRoute(route)} className="!px-3 !py-2 text-xs">Edit</Btn>
                    <Btn tone="danger" onClick={() => deleteRoute(route)} disabled={routeDeleteBusyId === route.id} className="!px-3 !py-2 text-xs">{routeDeleteBusyId === route.id ? "Deleting..." : "Delete"}</Btn>
                  </div>
                </div>
              ))}
            </div>
            {selectedRoutePreview ? (
              <div className={`mt-4 rounded-[1.2rem] border px-4 py-4 ${rowBg}`}>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Selected route</p>
                <p className="mt-2 font-bold text-[var(--text)]">{selectedRoutePreview.name}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{selectedRoutePreview.city}</p>
                <p className="mt-3 text-xs text-[var(--muted)]">Stops: {(selectedRoutePreview.route_stops || []).map((item) => item.stop.name).join(" -> ") || "No stop detail available"}</p>
              </div>
            ) : null}
          </GlassCard>
        </div>
      );
    }

    if (activeSection === "assignments") {
      return (
        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr_1fr]">
          <GlassCard>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <SLabel>Permanent Assignment</SLabel>
                <p className="text-xl font-black text-[var(--text)]">Bus, route, driver, and helper</p>
              </div>
            </div>
            <div className="grid gap-4">
              <SelectField label="Bus" value={assignBusId} onChange={setAssignBusId} options={[{ value: "", label: "-- Select Bus --" }, ...busList.map((bus) => ({ value: bus.id, label: `${bus.display_name || bus.plate_number} | ${bus.plate_number}` }))]} />
              <SelectField label="Route" value={assignRouteId} onChange={setAssignRouteId} options={assignmentRouteOptions} />
              <div className="grid gap-4 xl:grid-cols-2">
                <SelectField label="Driver" value={assignDriverId} onChange={setAssignDriverId} options={assignmentDriverOptions} />
                <SelectField label="Helper" value={assignHelperId} onChange={setAssignHelperId} options={assignmentHelperOptions} />
              </div>
              {selectedAssignBus ? (
                <div className={`rounded-[1.2rem] border px-4 py-4 ${rowBg}`}>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Current assignment</p>
                  <p className="mt-2 font-bold text-[var(--text)]">{selectedAssignBus.display_name || selectedAssignBus.plate_number}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{selectedAssignBus.plate_number} | {selectedAssignBus.capacity} seats | {selectedAssignBus.condition}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">Route: {selectedAssignBus.route_name || "Unassigned"}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Driver: {selectedAssignBus.driver_name || "Unassigned"} | Helper: {selectedAssignBus.helper_name || "Unassigned"}</p>
                  <p className="mt-3 text-xs text-[var(--muted)]">Once this is saved, the same bus, route, driver, and helper stay linked until admin edits the assignment.</p>
                </div>
              ) : null}
              <Btn tone="primary" onClick={assignStaffToBus} disabled={assignBusy} className="w-full !py-4">{assignBusy ? "Updating..." : "Save Assignment"}</Btn>
            </div>
          </GlassCard>
          <GlassCard>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <SLabel>Assignment Registry</SLabel>
                <p className="text-xl font-black text-[var(--text)]">Current fleet assignment list</p>
              </div>
            </div>
            <div className="space-y-3">
              {!filteredBuses.length ? <p className="text-sm text-[var(--muted)]">No buses match the current search.</p> : filteredBuses.map((bus) => (
                <div key={bus.id} className={`rounded-[1.1rem] border px-4 py-4 ${selectedAssignBus?.id === bus.id ? "border-transparent bg-[var(--accent-soft)]" : rowBg}`}>
                  <button type="button" className="w-full text-left" onClick={() => setAssignBusId(String(bus.id))}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-[var(--text)]">{bus.display_name || bus.plate_number}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{bus.plate_number} | {bus.capacity} seats | {bus.condition}</p>
                        <p className="mt-2 text-xs text-[var(--muted)]">Route: {bus.route_name || "Unassigned"}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">Driver: {bus.driver_name || "Unassigned"} | Helper: {bus.helper_name || "Unassigned"}</p>
                      </div>
                      <Pill color={bus.route && bus.driver && bus.helper ? "emerald" : "amber"}>{bus.route && bus.driver && bus.helper ? "Ready" : "Needs setup"}</Pill>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </GlassCard>
          <div className="space-y-5">
            <GlassCard>
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <SLabel>Assignment Health</SLabel>
                  <p className="text-xl font-black text-[var(--text)]">Permanent setup summary</p>
                </div>
                <Pill color={assignmentHealth.missingRoute || assignmentHealth.missingStaff ? "amber" : "emerald"}>{assignmentHealth.fullyAssigned} ready</Pill>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className={`rounded-[1.2rem] border px-4 py-4 ${rowBg}`}>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Fully assigned</p>
                  <p className="mt-2 text-3xl font-black text-[var(--text)]">{assignmentHealth.fullyAssigned}</p>
                </div>
                <div className={`rounded-[1.2rem] border px-4 py-4 ${rowBg}`}>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Missing route</p>
                  <p className="mt-2 text-3xl font-black text-[var(--text)]">{assignmentHealth.missingRoute}</p>
                </div>
                <div className={`rounded-[1.2rem] border px-4 py-4 ${rowBg}`}>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Missing staff</p>
                  <p className="mt-2 text-3xl font-black text-[var(--text)]">{assignmentHealth.missingStaff}</p>
                </div>
              </div>
            </GlassCard>
            <GlassCard>
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <SLabel>How It Works</SLabel>
                  <p className="text-xl font-black text-[var(--text)]">No trip scheduling required</p>
                </div>
                <Pill color="indigo">MetroBus flow</Pill>
              </div>
              <div className={`rounded-[1.2rem] border px-4 py-4 ${rowBg}`}>
                <p className="text-sm leading-7 text-[var(--muted)]">Admin now assigns one permanent bus setup: route, driver, and helper. The driver and helper keep using that same bus until you edit the assignment here. When they start a ride from their dashboard, MetroBus creates the pending/live trip from that saved setup automatically.</p>
              </div>
            </GlassCard>
          </div>
        </div>
      );
    }

    if (activeSection === "analytics") {
      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
            <GlassCard>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <SLabel>Route Revenue</SLabel>
                  <p className="text-xl font-black text-[var(--text)]">Route-wise system performance</p>
                </div>
                <Pill color="indigo">{filteredRouteAnalytics.length} routes</Pill>
              </div>
              <SimpleBarChart items={filteredRouteAnalytics.slice(0, 6).map((route) => ({ label: route.route_name, value: route.revenue_success || 0 })) || []} color="var(--accent)" />
            </GlassCard>
            <GlassCard>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <SLabel>Bus-Wise Revenue</SLabel>
                  <p className="text-xl font-black text-[var(--text)]">Fleet revenue contribution</p>
                </div>
                <Pill color="sky">{filteredBusAnalytics.length} buses</Pill>
              </div>
              <SimpleBarChart items={filteredBusAnalytics.slice(0, 6).map((bus) => ({ label: bus.display_name, value: bus.revenue_success || 0 })) || []} color="var(--primary)" />
            </GlassCard>
            <GlassCard>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <SLabel>Passenger Turnover</SLabel>
                  <p className="text-xl font-black text-[var(--text)]">Wallet and booking movement</p>
                </div>
                <Pill color="amber">{bookings.total || 0} bookings</Pill>
              </div>
              <div className="grid gap-3">
                <div className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Wallet balance</p>
                  <p className="mt-2 text-3xl font-black text-[var(--text)]">{fmtMoney(wallets.total_balance || 0)}</p>
                </div>
                <div className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Reward points</p>
                  <p className="mt-2 text-3xl font-black text-[var(--text)]">{wallets.total_reward_points || 0}</p>
                </div>
                <div className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Ride passes</p>
                  <p className="mt-2 text-3xl font-black text-[var(--text)]">{(wallets.weekly_passes || 0) + (wallets.monthly_passes || 0) + (wallets.flex_passes || 0)}</p>
                </div>
              </div>
            </GlassCard>
          </div>
          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <GlassCard>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <SLabel>Review Trend</SLabel>
                  <p className="text-xl font-black text-[var(--text)]">Passenger ratings over time</p>
                </div>
                <Pill color="emerald">{reviewTrend.length} days</Pill>
              </div>
              <SimpleLineChart points={reviewTrend.length ? reviewTrend.map((item) => ({ label: item.label, value: item.avg_rating || 0 })) : [{ label: "No data", value: 0 }]} />
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-[var(--muted)] xl:grid-cols-4">
                {(reviewTrend.length ? reviewTrend.slice(-4) : []).map((point) => <div key={point.label} className={`rounded-[1rem] border px-3 py-3 ${rowBg}`}>{point.label}: {Number(point.avg_rating || 0).toFixed(1)} / 5</div>)}
              </div>
            </GlassCard>
            <GlassCard>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <SLabel>Station Activity</SLabel>
                  <p className="text-xl font-black text-[var(--text)]">Most used stops across MetroBus</p>
                </div>
                <Pill color="amber">{stationAnalytics.length} stations</Pill>
              </div>
              <SimpleBarChart items={topStations.length ? topStations : [{ label: "No data", value: 0 }]} color="var(--success)" />
            </GlassCard>
          </div>
          <GlassCard>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <SLabel>Analytics Filters</SLabel>
                <p className="text-xl font-black text-[var(--text)]">Refine revenue and occupancy views</p>
              </div>
              <Btn tone="ghost" onClick={exportReport} className="!px-4 !py-2"><Icon name="download" className="mr-2 h-4 w-4" />Export</Btn>
            </div>
            <div className="grid gap-4 xl:grid-cols-5">
              <SelectField label="Date Range" value={reportRange} onChange={setReportRange} options={[{ value: "7D", label: "Last 7 days" }, { value: "30D", label: "Last 30 days" }, { value: "90D", label: "Last 90 days" }]} />
              <SelectField label="Route Filter" value={analyticsRouteFilter} onChange={setAnalyticsRouteFilter} options={routeFilterOptions} />
              <SelectField label="Bus Filter" value={analyticsBusFilter} onChange={setAnalyticsBusFilter} options={busFilterOptions} />
              <div className={`rounded-[1rem] border px-4 py-4 ${rowBg}`}>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Growth indicator</p>
                <p className="mt-2 text-3xl font-black text-[var(--success)]">+{Math.max(8, Math.round(overallOccupancyRate / 2))}%</p>
              </div>
              <div className={`rounded-[1rem] border px-4 py-4 ${rowBg}`}>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Average rating</p>
                <p className="mt-2 text-3xl font-black text-[var(--text)]">{reviews.avg_rating ? Number(reviews.avg_rating).toFixed(1) : "--"}</p>
              </div>
            </div>
          </GlassCard>
          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <GlassCard>
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <SLabel>Route Analytics Table</SLabel>
                  <p className="text-xl font-black text-[var(--text)]">Route-wise revenue and occupancy</p>
                </div>
                <Pill color="indigo">{filteredRouteAnalytics.length}</Pill>
              </div>
              <div className="overflow-hidden rounded-[1.2rem] border border-[var(--border)]">
                <div className="grid grid-cols-[1.2fr_0.75fr_0.75fr_0.8fr_0.7fr] gap-3 bg-[var(--surface-muted)] px-4 py-3 text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
                  <span>Route</span>
                  <span>Trips</span>
                  <span>Bookings</span>
                  <span>Revenue</span>
                  <span>Rating</span>
                </div>
                <div className="max-h-[30rem] overflow-y-auto bg-[var(--surface-strong)]">
                  {!filteredRouteAnalytics.length ? <div className="px-4 py-8 text-sm text-[var(--muted)]">No route analytics available.</div> : filteredRouteAnalytics.map((route) => (
                    <div key={route.route_id} className="grid grid-cols-[1.2fr_0.75fr_0.75fr_0.8fr_0.7fr] gap-3 border-t border-[var(--border)] px-4 py-4 text-sm">
                      <div>
                        <p className="font-bold text-[var(--text)]">{route.route_name}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{route.city}</p>
                      </div>
                      <span className="font-semibold text-[var(--text)]">{route.total_trips}</span>
                      <span className="font-semibold text-[var(--text)]">{route.bookings}</span>
                      <span className="font-semibold text-[var(--text)]">{fmtMoney(route.revenue_success)}</span>
                      <span className="font-semibold text-[var(--text)]">{route.reviews_total ? `${Number(route.avg_rating || 0).toFixed(1)} (${route.reviews_total})` : "--"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>
            <GlassCard>
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <SLabel>Bus Analytics Table</SLabel>
                  <p className="text-xl font-black text-[var(--text)]">Bus-wise occupancy and earnings</p>
                </div>
                <Pill color="sky">{filteredBusAnalytics.length}</Pill>
              </div>
              <div className="overflow-hidden rounded-[1.2rem] border border-[var(--border)]">
                <div className="grid grid-cols-[1.2fr_0.7fr_0.7fr_0.85fr_0.7fr] gap-3 bg-[var(--surface-muted)] px-4 py-3 text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
                  <span>Bus</span>
                  <span>Trips</span>
                  <span>Bookings</span>
                  <span>Revenue</span>
                  <span>Rating</span>
                </div>
                <div className="max-h-[30rem] overflow-y-auto bg-[var(--surface-strong)]">
                  {!filteredBusAnalytics.length ? <div className="px-4 py-8 text-sm text-[var(--muted)]">No bus analytics available.</div> : filteredBusAnalytics.map((bus) => (
                    <div key={bus.bus_id} className="grid grid-cols-[1.2fr_0.7fr_0.7fr_0.85fr_0.7fr] gap-3 border-t border-[var(--border)] px-4 py-4 text-sm">
                      <div>
                        <p className="font-bold text-[var(--text)]">{bus.display_name}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{bus.plate_number}</p>
                      </div>
                      <span className="font-semibold text-[var(--text)]">{bus.total_trips}</span>
                      <span className="font-semibold text-[var(--text)]">{bus.bookings}</span>
                      <span className="font-semibold text-[var(--text)]">{fmtMoney(bus.revenue_success)}</span>
                      <span className="font-semibold text-[var(--text)]">{bus.reviews_total ? `${Number(bus.avg_rating || 0).toFixed(1)} (${bus.reviews_total})` : "--"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>
          </div>
          <div className="grid gap-5 xl:grid-cols-[1fr_1fr_1fr]">
            <GlassCard>
              <SLabel>Reward Leaderboard</SLabel>
              <div className="mt-4 space-y-3">
                {!rewardLeaderboard.length ? <p className="text-sm text-[var(--muted)]">No passenger reward activity yet.</p> : rewardLeaderboard.slice(0, 6).map((row, index) => (
                  <div key={row.passenger_id} className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[var(--text)]">{index + 1}. {row.passenger_name}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{row.phone}</p>
                      </div>
                      <Pill color={row.reward_points >= (wallets.reward_threshold || 100) ? "emerald" : "amber"}>{row.reward_points} pts</Pill>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
            <GlassCard>
              <SLabel>Booking Lifecycle</SLabel>
              <div className="mt-4 space-y-3">
                {!recentBookingFlow.length ? <p className="text-sm text-[var(--muted)]">No lifecycle data yet.</p> : recentBookingFlow.slice(0, 5).map((flow) => (
                  <div key={flow.id} className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[var(--text)]">Booking #{flow.id}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{flow.passenger_name} | {flow.route_name}</p>
                      </div>
                      <Pill color={flow.completed_at ? "emerald" : flow.checked_in_at ? "sky" : flow.accepted_by_helper_at ? "amber" : "slate"}>
                        {flow.completed_at ? "Completed" : flow.checked_in_at ? "Onboard" : flow.accepted_by_helper_at ? "Accepted" : "Pending"}
                      </Pill>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
            <GlassCard>
              <SLabel>Ride Reviews</SLabel>
              <div className="mt-4 space-y-3">
                {!recentReviews.length ? <p className="text-sm text-[var(--muted)]">No recent reviews to inspect yet.</p> : recentReviews.slice(0, 5).map((review) => (
                  <div key={review.id} className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[var(--text)]">{review.route_name}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{review.passenger_name} | Bus {review.bus_plate}</p>
                      </div>
                      <Pill color={review.rating >= 4 ? "emerald" : review.rating <= 2 ? "red" : "amber"}>{review.rating}/5</Pill>
                    </div>
                    <p className="mt-2 text-xs text-[var(--muted)]">{review.note || "No written feedback left."}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
            <GlassCard>
              <SLabel>Payment Status</SLabel>
              <div className="mt-4 space-y-3">
                {[{ label: "Success", value: payments.success || 0, color: "emerald" }, { label: "Pending", value: payments.pending || 0, color: "amber" }, { label: "Failed", value: payments.failed || 0, color: "red" }].map((item) => (
                  <div key={item.label} className={`flex items-center justify-between rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                    <p className="font-bold text-[var(--text)]">{item.label}</p>
                    <Pill color={item.color}>{item.value}</Pill>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      );
    }

    if (activeSection === "reports") {
      return (
        <div className="space-y-6">
          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <GlassCard>
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <SLabel>Reports Export</SLabel>
                  <p className="text-2xl font-black text-[var(--text)]">Operational reporting center</p>
                </div>
                <Btn tone="primary" onClick={exportReport} className="!px-4 !py-2"><Icon name="download" className="mr-2 h-4 w-4" />Export report</Btn>
              </div>
              <div className="grid gap-4">
                <div className={`rounded-[1.2rem] border px-4 py-4 ${rowBg}`}>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Included sheets</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text)]">Route revenue, bus revenue, trip volume, booking summary, and ride ratings</p>
                </div>
                <div className={`rounded-[1.2rem] border px-4 py-4 ${rowBg}`}>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Reporting range</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text)]">{reportRange} rolling export</p>
                </div>
                <div className={`rounded-[1.2rem] border px-4 py-4 ${rowBg}`}>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Snapshot time</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text)]">{new Date().toLocaleString()}</p>
                </div>
              </div>
            </GlassCard>
            <GlassCard>
              <SLabel>Recent Payments Feed</SLabel>
              <div className="mt-4 space-y-3">
                {!dashboard?.recent_payments?.length ? <p className="text-sm text-[var(--muted)]">No payment activity yet.</p> : dashboard.recent_payments.map((payment) => (
                  <div key={payment.id} className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[var(--text)]">Payment #{payment.id}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">Booking #{payment.booking_id} | {payment.route_name}</p>
                        <p className="mt-2 text-sm text-[var(--muted)]">{payment.method} | {fmtMoney(payment.amount)} | by {payment.created_by_name || "system"}</p>
                      </div>
                      <Pill color={payment.status === "SUCCESS" ? "emerald" : payment.status === "FAILED" ? "red" : "amber"}>{payment.status}</Pill>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <GlassCard>
              <SLabel>Route Report Table</SLabel>
              <div className="mt-4 space-y-3">
                {!routeAnalytics.length ? <p className="text-sm text-[var(--muted)]">No route report rows yet.</p> : routeAnalytics.map((route) => (
                  <div key={route.route_id} className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[var(--text)]">{route.route_name}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{route.city}</p>
                      </div>
                      <Pill color="indigo">{fmtMoney(route.revenue_success)}</Pill>
                    </div>
                    <div className="mt-3 grid gap-2 xl:grid-cols-4">
                      <div className={`rounded-[0.9rem] border px-3 py-3 text-xs ${rowBg}`}>Trips {route.total_trips}</div>
                      <div className={`rounded-[0.9rem] border px-3 py-3 text-xs ${rowBg}`}>Bookings {route.bookings}</div>
                      <div className={`rounded-[0.9rem] border px-3 py-3 text-xs ${rowBg}`}>Completed {route.completed_bookings}</div>
                      <div className={`rounded-[0.9rem] border px-3 py-3 text-xs ${rowBg}`}>Rating {route.reviews_total ? `${Number(route.avg_rating || 0).toFixed(1)}/5` : "--"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
            <GlassCard>
              <SLabel>Bus Report Table</SLabel>
              <div className="mt-4 space-y-3">
                {!busAnalytics.length ? <p className="text-sm text-[var(--muted)]">No fleet report rows yet.</p> : busAnalytics.map((bus) => (
                  <div key={bus.bus_id} className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[var(--text)]">{bus.display_name}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{bus.plate_number} | {bus.capacity} seats</p>
                      </div>
                      <Pill color={bus.is_active ? "emerald" : "slate"}>{bus.is_active ? "Active" : "Inactive"}</Pill>
                    </div>
                    <div className="mt-3 grid gap-2 xl:grid-cols-4">
                      <div className={`rounded-[0.9rem] border px-3 py-3 text-xs ${rowBg}`}>Trips {bus.total_trips}</div>
                      <div className={`rounded-[0.9rem] border px-3 py-3 text-xs ${rowBg}`}>Bookings {bus.bookings}</div>
                      <div className={`rounded-[0.9rem] border px-3 py-3 text-xs ${rowBg}`}>Revenue {fmtMoney(bus.revenue_success)}</div>
                      <div className={`rounded-[0.9rem] border px-3 py-3 text-xs ${rowBg}`}>Rating {bus.reviews_total ? `${Number(bus.avg_rating || 0).toFixed(1)}/5` : "--"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <GlassCard>
              <SLabel>Top Rated Routes</SLabel>
              <div className="mt-4 space-y-3">
                {!topRatedRoutes.length ? <p className="text-sm text-[var(--muted)]">No route review scores yet.</p> : topRatedRoutes.map((route) => (
                  <div key={route.route_id} className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[var(--text)]">{route.route_name}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{route.city} | {route.reviews_total} reviews</p>
                      </div>
                      <Pill color="emerald">{Number(route.avg_rating || 0).toFixed(1)}/5</Pill>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
            <GlassCard>
              <SLabel>Top Rated Buses</SLabel>
              <div className="mt-4 space-y-3">
                {!topRatedBuses.length ? <p className="text-sm text-[var(--muted)]">No bus review scores yet.</p> : topRatedBuses.map((bus) => (
                  <div key={bus.bus_id} className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[var(--text)]">{bus.display_name}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{bus.plate_number} | {bus.reviews_total} reviews</p>
                      </div>
                      <Pill color="emerald">{Number(bus.avg_rating || 0).toFixed(1)}/5</Pill>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <GlassCard>
              <SLabel>Station Report Table</SLabel>
              <div className="mt-4 space-y-3">
                {!stationAnalytics.length ? <p className="text-sm text-[var(--muted)]">No station analytics available yet.</p> : stationAnalytics.map((station) => (
                  <div key={station.stop_id} className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[var(--text)]">{station.stop_name}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{station.touchpoints} total touchpoints</p>
                      </div>
                      <Pill color="sky">{station.completed_bookings} completed</Pill>
                    </div>
                    <div className="mt-3 grid gap-2 xl:grid-cols-3">
                      <div className={`rounded-[0.9rem] border px-3 py-3 text-xs ${rowBg}`}>Pickups {station.pickups}</div>
                      <div className={`rounded-[0.9rem] border px-3 py-3 text-xs ${rowBg}`}>Dropoffs {station.dropoffs}</div>
                      <div className={`rounded-[0.9rem] border px-3 py-3 text-xs ${rowBg}`}>Completed {station.completed_bookings}</div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
            <GlassCard>
              <SLabel>Review Trend Feed</SLabel>
              <div className="mt-4 space-y-3">
                {!reviewTrend.length ? <p className="text-sm text-[var(--muted)]">No review trend data available yet.</p> : reviewTrend.map((item) => (
                  <div key={item.label} className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[var(--text)]">{item.label}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{item.total} reviews recorded</p>
                      </div>
                      <Pill color={item.avg_rating >= 4 ? "emerald" : item.avg_rating <= 2 ? "red" : "amber"}>{Number(item.avg_rating || 0).toFixed(1)}/5</Pill>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      );
    }

    if (activeSection === "settings") {
      return (
        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.2fr_0.95fr]">
          <div className="space-y-5">
            <GlassCard>
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <SLabel>Admin Profile</SLabel>
                  <p className="text-xl font-black text-[var(--text)]">{user?.full_name || "MetroBus Admin"}</p>
                </div>
                <Pill color="red">ADMIN</Pill>
              </div>
              <div className="space-y-3">
                <div className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Login phone</p>
                  <p className="mt-2 text-sm font-bold text-[var(--text)]">{user?.phone || "--"}</p>
                </div>
                <div className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Theme</p>
                  <p className="mt-2 text-sm font-bold text-[var(--text)]">{isDark ? "MetroBus Night" : "MetroBus Light"}</p>
                </div>
                <div className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Notifications</p>
                  <p className="mt-2 text-sm font-bold text-[var(--text)]">{notificationCount} pending admin alerts</p>
                </div>
              </div>
            </GlassCard>
            {renderUserForm("Admin")}
          </div>
          <GlassCard className="h-full">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <SLabel>Admin Accounts</SLabel>
                <p className="text-xl font-black text-[var(--text)]">{adminUsers.length} admin users</p>
              </div>
              <div className="flex gap-2">
                {["ALL", "DRIVER", "HELPER", "ADMIN"].map((role) => (
                  <button key={role} type="button" onClick={() => setStaffFilter(role)} className={`rounded-full px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.12em] ${userRoleFilter === role ? "bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-white" : "border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]"}`}>
                    {role}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {!adminUsers.length ? <p className="text-sm text-[var(--muted)]">No additional admin accounts found.</p> : adminUsers.map((adminUser) => (
                <div key={adminUser.id} className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[var(--text)]">{adminUser.full_name}</p>
                      <p className="mt-1 truncate text-xs text-[var(--muted)]">{adminUser.phone}{adminUser.email ? ` | ${adminUser.email}` : ""}</p>
                    </div>
                    <Pill color={adminUser.is_active ? "emerald" : "slate"}>{adminUser.is_active ? "Active" : "Inactive"}</Pill>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn tone="ghost" onClick={() => startEditingUser(adminUser)} className="!px-3 !py-2 text-xs">Edit</Btn>
                    {user?.id !== adminUser.id ? <Btn tone="danger" onClick={() => deleteUser(adminUser)} disabled={userDeleteBusyId === adminUser.id} className="!px-3 !py-2 text-xs">{userDeleteBusyId === adminUser.id ? "Deleting..." : "Delete"}</Btn> : <Pill color="indigo">Current admin</Pill>}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
          <GlassCard className="h-full">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <SLabel>System Preferences</SLabel>
                <p className="text-xl font-black text-[var(--text)]">MetroBus operations settings</p>
              </div>
              <Pill color="sky">Desktop only</Pill>
            </div>
            <div className="space-y-4">
              <div className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Theme mode</p>
                <p className="mt-2 text-sm font-bold text-[var(--text)]">{isDark ? "Dark operations mode" : "Light operations mode"}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Theme switching is still handled globally from the shared MetroBus theme provider.</p>
              </div>
              <div className="space-y-4">
                <div className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Notification settings</p>
                  <p className="mt-2 text-sm font-bold text-[var(--text)]">Live alerts active</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">Admin is currently watching bookings, pending payments, and delayed buses.</p>
                </div>
                <div className={`rounded-[1.1rem] border px-4 py-4 ${rowBg}`}>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Password change</p>
                  <p className="mt-2 text-sm font-bold text-[var(--text)]">Use the admin form to update credentials</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">Editing an admin account with a new password acts as the password reset flow for the dashboard.</p>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      );
    }

    return null;
  };

  return (
    <div style={theme} className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fff5eb_0%,var(--bg)_35%,var(--bg-soft)_100%)] text-[var(--text)]">
      <div className="mx-auto flex min-h-screen max-w-[1680px] gap-6 px-5 py-5">
        <aside className="sticky top-5 hidden h-[calc(100vh-2.5rem)] w-[280px] shrink-0 overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--sidebar)] p-5 shadow-[var(--shadow)] xl:flex xl:flex-col">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-lg font-black text-white shadow-[var(--shadow-strong)]">MB</div>
            <div>
              <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[var(--muted)]">MetroBus</p>
              <p className="text-2xl font-black text-[var(--text)]">Admin Panel</p>
            </div>
          </div>
          <div className="space-y-1.5">
            {ADMIN_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => navigate(`/admin/${section.id}`)}
                className={`flex w-full items-center gap-3 rounded-[1.2rem] px-4 py-3 text-left transition ${activeSection === section.id ? "bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-white shadow-[var(--shadow-strong)]" : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"}`}
              >
                <Icon name={section.icon} className="h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-black">{section.label}</p>
                  <p className={`text-xs ${activeSection === section.id ? "text-white/80" : "text-[var(--muted)]"}`}>{section.description}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-auto rounded-[1.4rem] border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Control Tower</p>
            <p className="mt-2 text-sm font-bold text-[var(--text)]">{trips.live || 0} trips live right now</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{payments.pending || 0} payments pending and {fleetStatus.delayed} delayed buses need review.</p>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <div className="sticky top-5 z-30 mb-6 rounded-[2rem] border border-[var(--border)] bg-[var(--header)] px-6 py-5 shadow-[var(--shadow)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[var(--muted)]">{currentSectionMeta.label}</p>
                <h1 className="mt-1 text-3xl font-black text-[var(--text)]">{currentSectionMeta.description}</h1>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative hidden w-[320px] xl:block">
                  <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                  <input
                    value={adminSearch}
                    onChange={(event) => setAdminSearch(event.target.value)}
                    placeholder="Search drivers, buses, routes, stations..."
                    className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--surface-strong)] py-3 pl-11 pr-4 text-sm font-semibold text-[var(--text)] outline-none focus:border-[var(--primary)]"
                  />
                </div>
                <button type="button" onClick={() => setQuickOpen((value) => !value)} className="flex h-12 items-center gap-2 rounded-[1rem] bg-[linear-gradient(135deg,var(--primary),var(--accent))] px-4 text-sm font-black text-white shadow-[var(--shadow-strong)]">
                  <Icon name="plus" className="h-4 w-4" />
                  Add New
                </button>
                <button type="button" onClick={() => setMsg(`You have ${notificationCount} admin alerts to review.`)} className="relative flex h-12 w-12 items-center justify-center rounded-[1rem] border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text)] shadow-[var(--shadow)]">
                  <Icon name="bell" className="h-5 w-5" />
                  {notificationCount ? <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[var(--danger)]" /> : null}
                </button>
                <div className="relative">
                  <button type="button" onClick={() => setProfileOpen((value) => !value)} className="flex items-center gap-3 rounded-[1rem] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 shadow-[var(--shadow)]">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-black text-[var(--primary)]">{avatarInitials(user?.full_name)}</div>
                    <div className="text-left">
                      <p className="text-sm font-black text-[var(--text)]">{user?.full_name || "Admin"}</p>
                      <p className="text-xs text-[var(--muted)]">MetroBus operations</p>
                    </div>
                  </button>
                  {profileOpen ? (
                    <div className="absolute right-0 top-[calc(100%+0.75rem)] z-40 w-72 rounded-[1.4rem] border border-[var(--border)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow-strong)]">
                      <p className="text-sm font-black text-[var(--text)]">{user?.full_name || "MetroBus Admin"}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{user?.phone || "No phone linked"}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Btn tone="ghost" onClick={() => { setProfileOpen(false); navigate("/admin/settings"); }} className="!px-4 !py-2 text-xs">Settings</Btn>
                        <Btn tone="danger" onClick={handleLogout} className="!px-4 !py-2 text-xs">Logout</Btn>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            {quickOpen ? (
              <div className="mt-4 grid gap-3 rounded-[1.4rem] border border-[var(--border)] bg-[var(--surface-strong)] p-4 xl:grid-cols-5">
                {[
                  { section: "drivers", label: "Driver" },
                  { section: "helpers", label: "Helper" },
                  { section: "buses", label: "Bus" },
                  { section: "routes", label: "Route" },
                  { section: "assignments", label: "Assignment" },
                ].map((item) => (
                  <button key={item.section} type="button" onClick={() => triggerQuickAction(item.section)} className="rounded-[1rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4 text-left transition hover:border-[var(--primary)] hover:bg-[var(--accent-soft)]">
                    <p className="text-sm font-black text-[var(--text)]">Add {item.label}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">Jump to the create flow</p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mb-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <GlassCard className="bg-[linear-gradient(135deg,rgba(75,38,102,0.96),rgba(255,138,31,0.92))] text-white shadow-[var(--shadow-strong)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-white/70">MetroBus HQ</p>
                  <p className="mt-2 max-w-3xl text-3xl font-black leading-tight">Premium desktop control center for fleet, people, routes, assignments, and revenue.</p>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78">Everything stays inside the same MetroBus visual language as the rest of the app, while keeping the existing operations tools live and ready for demo.</p>
                </div>
                <div className="grid gap-3 text-right">
                  <div>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/65">Live trips</p>
                    <p className="mt-1 text-3xl font-black">{trips.live || 0}</p>
                  </div>
                  <div>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/65">Occupancy</p>
                    <p className="mt-1 text-3xl font-black">{overallOccupancyRate}%</p>
                  </div>
                </div>
              </div>
            </GlassCard>
            <div className="grid gap-4">
              {msg ? <GlassCard><p className="text-sm font-semibold text-[var(--success)]">{msg}</p></GlassCard> : null}
              {err ? <GlassCard><p className="text-sm font-semibold text-[var(--danger)]">{err}</p></GlassCard> : null}
            </div>
          </div>

          {renderSectionContent()}
        </main>
      </div>
      <ConfirmModal
        isOpen={!!confirmModal}
        title={confirmModal?.title}
        message={confirmModal?.msg}
        onConfirm={confirmModal?.confirm}
        onCancel={() => setConfirmModal(null)}
        busy={busDeleteBusyId || routeDeleteBusyId || scheduleDeleteBusyId || userDeleteBusyId}
      />
    </div>
  );
}

