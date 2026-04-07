import { useEffect, useState } from "react";
import { divIcon } from "leaflet";

export const PASSENGER_THEME = {
  "--mb-bg": "#f8f6ff",
  "--mb-bg-alt": "#f2ecff",
  "--mb-card": "rgba(255,255,255,0.96)",
  "--mb-card-strong": "#f5f1ff",
  "--mb-card-soft": "#f4efff",
  "--mb-text": "#1d1722",
  "--mb-muted": "#7a738b",
  "--mb-purple": "#5f19e6",
  "--mb-purple-2": "#8d2fff",
  "--mb-magenta": "#ff4fd8",
  "--mb-border": "rgba(95, 25, 230, 0.1)",
  "--mb-success": "#16a34a",
  "--mb-danger": "#c1002b",
  "--mb-shadow": "0 22px 48px rgba(93, 39, 180, 0.11)",
  "--mb-shadow-strong": "0 24px 44px rgba(104, 16, 255, 0.2)",
  "--mb-nav": "rgba(251, 249, 255, 0.94)",
};

export function useSplash() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShow(false), 1300);
    return () => clearTimeout(timer);
  }, []);

  return show;
}

export function fmtMoney(value) {
  return `NPR ${Number(value || 0).toLocaleString()}`;
}

export function fmtTime(value) {
  if (!value) return "--:--";
  try {
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return value;
  }
}

export function fmtDate(value) {
  if (!value) return "Today";
  try {
    return new Date(value).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return value;
  }
}

export function fmtEta(eta) {
  if (!eta) return "ETA unavailable";
  if (eta.status === "arriving") return "Arriving now";
  if (eta.status === "passed") return "Passed pickup";
  if (Number.isFinite(eta.minutes)) return `${eta.minutes} min`;
  return "ETA unavailable";
}

export function toPoint(lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  return Number.isFinite(la) && Number.isFinite(lo) ? [la, lo] : null;
}

export function toLocPoint(location) {
  return location ? toPoint(location.lat, location.lng) : null;
}

export function distKm(a, b) {
  if (!a || !b) return 0;
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function cumDist(points) {
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative[index] = cumulative[index - 1] + distKm(points[index - 1], points[index]);
  }
  return cumulative;
}

function nearestIdx(points, target) {
  if (!points.length || !target) return -1;
  let best = 0;
  let bestDistance = Infinity;
  points.forEach((point, index) => {
    const distance = distKm(point, target);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

function speedKmh(speed) {
  const value = Number(speed);
  if (!Number.isFinite(value) || value <= 0) return 22;
  return value <= 30 ? value * 3.6 : value;
}

export function estimateEta(busPoint, targetPoint, path, speed) {
  if (!busPoint || !targetPoint) return null;
  const points = path.length > 1 ? path : [busPoint, targetPoint];
  const cumulative = cumDist(points);
  const busIndex = nearestIdx(points, busPoint);
  const targetIndex = nearestIdx(points, targetPoint);
  if (busIndex === -1 || targetIndex === -1) return null;
  const directDistance = distKm(busPoint, targetPoint);
  if (directDistance <= 0.15) return { status: "arriving", minutes: 1 };
  if (busIndex > targetIndex + 3 && directDistance > 0.2) return { status: "passed", minutes: null };
  const routeDistance = targetIndex >= busIndex ? Math.max(0, cumulative[targetIndex] - cumulative[busIndex]) : directDistance;
  return { status: "enroute", minutes: Math.max(1, Math.round((routeDistance / speedKmh(speed)) * 60)) };
}

export function buildFormPost(redirect) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = redirect.url;
  Object.entries(redirect.fields || {}).forEach(([key, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

export function routeCode(trip, index = 0) {
  if (trip?.bus_plate) {
    const compact = String(trip.bus_plate).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    return compact.slice(-3) || `V${index + 1}`;
  }
  return `V${String(index + 1).padStart(2, "0")}`;
}

export function statusTone(trip, now) {
  const overwrite = trip.live_override;
  const stale = overwrite && now - overwrite.lastSeen > 30000;
  if (stale || trip.eta?.status === "passed") return { label: "Delayed", color: "text-[var(--mb-danger)]" };
  return { label: "On Time", color: "text-[var(--mb-success)]" };
}

export function snapPolylineWithAngle(point, line) {
  if (!point || !line || !line.length) return { pt: point, angle: 0 };
  if (line.length === 1) return { pt: line[0], angle: 0 };
  let closest = line[0];
  let minDistance = Infinity;
  let bestAngle = 0;
  for (let index = 0; index < line.length - 1; index += 1) {
    const a = line[index];
    const b = line[index + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    let t = 0;
    if (dx !== 0 || dy !== 0) {
      t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    }
    const projection = [a[0] + t * dx, a[1] + t * dy];
    const distanceSquared = (point[0] - projection[0]) ** 2 + (point[1] - projection[1]) ** 2;
    if (distanceSquared < minDistance) {
      minDistance = distanceSquared;
      closest = projection;
      bestAngle = Math.atan2(b[1] - a[1], b[0] - a[0]) * (180 / Math.PI);
    }
  }
  return { pt: closest, angle: bestAngle };
}

export function getBusPoint(trip, polyline) {
  let point = trip.live_override ? toPoint(trip.live_override.lat, trip.live_override.lng) : toLocPoint(trip.latest_location);
  let heading = trip.live_override ? Number(trip.live_override.heading || 0) : Number(trip.latest_location?.heading || 0);
  if (!point) return null;
  if (polyline.length > 1) {
    const snapped = snapPolylineWithAngle(point, polyline);
    point = snapped.pt;
    heading = snapped.angle;
  }
  return { point, heading };
}

export function createBusIcon({ label = "Bus", heading = 0 }) {
  const rotation = (heading + 90) % 360;
  return divIcon({
    className: "",
    iconSize: [74, 82],
    iconAnchor: [37, 44],
    html: `
      <div style="position:relative;width:74px;height:82px;">
        <div style="position:absolute;left:50%;top:0;transform:translateX(-50%);padding:8px 14px;border-radius:18px;background:linear-gradient(135deg,#8d12eb,#c243ff);box-shadow:0 16px 30px rgba(141,18,235,.28);color:white;font-weight:800;font-size:12px;letter-spacing:.02em;white-space:nowrap;">${label}</div>
        <div style="position:absolute;left:50%;top:46px;transform:translateX(-50%) rotate(${rotation}deg);width:22px;height:22px;background:#ffffff;border:6px solid #8d12eb;border-radius:999px;box-shadow:0 8px 20px rgba(141,18,235,.24);"></div>
      </div>
    `,
  });
}

export function downloadInvoice(booking) {
  const contents = [
    "MetroBus Ride Invoice",
    `Booking ID: ${booking.id}`,
    `Date: ${fmtDate(booking.created_at)}`,
    `Route: ${booking.route_name}`,
    `Pickup: ${booking.pickup_stop_name}`,
    `Destination: ${booking.destination_stop_name}`,
    `Seats: ${(booking.seat_labels || []).join(", ") || booking.seats_count}`,
    `Fare: ${fmtMoney(booking.fare_total)}`,
    `Payment: ${booking.payment_status}`,
  ].join("\n");
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `metrobus-booking-${booking.id}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export function paymentHandle(latestPaidBooking) {
  if (!latestPaidBooking) return "alex@ybl";
  return `ride${latestPaidBooking.id}@metrobus`;
}
