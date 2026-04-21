import math
from json import load as json_load
from datetime import timedelta
from decimal import Decimal
from urllib.error import URLError
from urllib.request import urlopen

from django.utils import timezone

from transport.models import RouteStop

from .models import TripLocation, TripSimulation


def _clean_points(points):
    clean = []
    for point in points or []:
        if isinstance(point, dict):
            lat_value = point.get("lat")
            lng_value = point.get("lng")
        elif isinstance(point, (list, tuple)) and len(point) >= 2:
            lat_value = point[0]
            lng_value = point[1]
        else:
            continue
        try:
            lat = round(float(lat_value), 6)
            lng = round(float(lng_value), 6)
        except (TypeError, ValueError):
            continue
        clean.append([lat, lng])
    return clean


def route_stops_for_trip(trip, route_stops=None):
    rows = (
        list(route_stops)
        if route_stops is not None
        else list(
            RouteStop.objects.filter(route=trip.route)
            .select_related("stop")
            .order_by("stop_order")
        )
    )
    start_order = getattr(trip, "start_stop_order", None)
    end_order = getattr(trip, "end_stop_order", None)
    if start_order:
        rows = [row for row in rows if row.stop_order >= start_order]
    if end_order:
        rows = [row for row in rows if row.stop_order <= end_order]
    return rows


def _nearest_path_index(points, target):
    if not points or not target:
        return None
    best_index = None
    best_distance = float("inf")
    for index, point in enumerate(points):
        distance = math.dist(point, target)
        if distance < best_distance:
            best_distance = distance
            best_index = index
    return best_index


def route_points_for_trip(trip, route_path=None, route_stops=None):
    full_route_path = _clean_points(
        route_path if route_path is not None else getattr(trip.route, "path_points", None)
    )
    segment_stops = route_stops_for_trip(trip, route_stops=route_stops)
    segment_stop_points = _clean_points(
        [
            [row.stop.lat, row.stop.lng]
            for row in segment_stops
            if row.stop and row.stop.lat is not None and row.stop.lng is not None
        ]
    )

    if len(full_route_path) >= 2 and len(segment_stop_points) >= 2:
        start_index = _nearest_path_index(full_route_path, segment_stop_points[0])
        end_index = _nearest_path_index(full_route_path, segment_stop_points[-1])
        if start_index is not None and end_index is not None and end_index > start_index:
            sliced = full_route_path[start_index : end_index + 1]
            if len(sliced) >= 2:
                return sliced

    if len(segment_stop_points) >= 2:
        return segment_stop_points

    if len(full_route_path) >= 2:
        return full_route_path

    return segment_stop_points


def _route_points_for_trip(trip):
    return route_points_for_trip(trip)


def _snap_points_to_road(points):
    clean = _clean_points(points)
    if len(clean) < 2:
        return clean

    try:
        coordinates = ";".join(f"{lng},{lat}" for lat, lng in clean)
        with urlopen(
            f"https://router.project-osrm.org/route/v1/driving/{coordinates}?overview=full&geometries=geojson",
            timeout=5,
        ) as response:
            payload = json_load(response)
        geometry = payload.get("routes", [{}])[0].get("geometry", {}).get("coordinates", [])
        snapped = _clean_points([[lat, lng] for lng, lat in geometry])
        return snapped if len(snapped) >= 2 else clean
    except (OSError, ValueError, URLError):
        return clean


def _simulation_points_for_trip(trip):
    return _snap_points_to_road(_route_points_for_trip(trip))


def _densify_points(points, target_points=100):
    clean = _clean_points(points)
    if len(clean) < 2:
        return clean
    if len(clean) >= target_points:
        return clean

    segment_lengths = []
    total_length = 0.0
    for index in range(len(clean) - 1):
        start = clean[index]
        end = clean[index + 1]
        length = math.dist(start, end)
        segment_lengths.append(length)
        total_length += length

    if total_length <= 0:
        return clean

    densified = []
    for index, start in enumerate(clean[:-1]):
        end = clean[index + 1]
        densified.append(start)
        segment_share = segment_lengths[index] / total_length
        extra_points = max(1, round(segment_share * (target_points - len(clean))))
        for step in range(1, extra_points + 1):
            ratio = step / (extra_points + 1)
            densified.append(
                [
                    round(start[0] + (end[0] - start[0]) * ratio, 6),
                    round(start[1] + (end[1] - start[1]) * ratio, 6),
                ]
            )
    densified.append(clean[-1])
    return densified[: target_points - 1] + [clean[-1]]


def _heading_for(points, index):
    if not points:
        return Decimal("0")
    current = points[index]
    nxt = points[min(index + 1, len(points) - 1)]
    lat1 = current[0] * 3.141592653589793 / 180
    lat2 = nxt[0] * 3.141592653589793 / 180
    lng_delta = (nxt[1] - current[1]) * 3.141592653589793 / 180
    y = math.sin(lng_delta) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(lng_delta)
    heading = (math.atan2(y, x) * 180 / 3.141592653589793 + 360) % 360
    return Decimal(f"{heading:.2f}")


def _persist_simulation_point(trip, simulation):
    points = simulation.points or []
    if not points:
        return None

    point = points[simulation.current_index]
    location = TripLocation.objects.create(
        trip=trip,
        lat=Decimal(f"{point[0]:.6f}"),
        lng=Decimal(f"{point[1]:.6f}"),
        speed=Decimal("18.00"),
        heading=_heading_for(points, simulation.current_index),
    )
    simulation.last_persisted_index = simulation.current_index
    simulation.save(update_fields=["last_persisted_index", "updated_at"])
    return location


def start_trip_simulation(trip, points, step_interval_ms):
    clean_points = _densify_points(_clean_points(points), target_points=160)
    if len(clean_points) < 2:
        clean_points = _densify_points(_simulation_points_for_trip(trip), target_points=160)
    if len(clean_points) < 2:
        raise ValueError("Provide at least two valid route points for simulation.")

    simulation, _ = TripSimulation.objects.get_or_create(trip=trip)
    simulation.points = clean_points
    simulation.current_index = 0
    simulation.last_persisted_index = 0
    simulation.step_interval_ms = max(1000, min(int(step_interval_ms or 3000), 10000))
    simulation.is_active = True
    simulation.last_advanced_at = timezone.now()
    simulation.save()

    return _persist_simulation_point(trip, simulation), simulation


def ensure_trip_simulation(trip, step_interval_ms=3000):
    simulation = getattr(trip, "simulation", None)
    if simulation and simulation.points:
        return trip.locations.order_by("-recorded_at").first(), simulation

    route_points = _densify_points(_simulation_points_for_trip(trip), target_points=160)
    if len(route_points) < 2:
        return trip.locations.order_by("-recorded_at").first(), simulation

    return start_trip_simulation(trip, route_points, step_interval_ms)


def sync_trip_simulation(trip):
    simulation = getattr(trip, "simulation", None)
    if not simulation or not simulation.points:
        return trip.locations.order_by("-recorded_at").first()

    if simulation.is_active and simulation.last_advanced_at:
        elapsed_ms = int((timezone.now() - simulation.last_advanced_at).total_seconds() * 1000)
        if elapsed_ms >= simulation.step_interval_ms:
            steps = elapsed_ms // simulation.step_interval_ms
            next_index = min(simulation.current_index + steps, len(simulation.points) - 1)
            if next_index != simulation.current_index:
                simulation.current_index = next_index
                simulation.last_advanced_at = simulation.last_advanced_at + timedelta(milliseconds=steps * simulation.step_interval_ms)
                if simulation.current_index >= len(simulation.points) - 1:
                    simulation.is_active = False
                simulation.save(update_fields=["current_index", "last_advanced_at", "is_active", "updated_at"])

    if simulation.current_index > simulation.last_persisted_index:
        return _persist_simulation_point(trip, simulation)

    if trip.locations.exists():
        return trip.locations.order_by("-recorded_at").first()

    return _persist_simulation_point(trip, simulation)


def pause_trip_simulation(trip):
    simulation = getattr(trip, "simulation", None)
    if not simulation:
        raise ValueError("No simulation has been started for this trip.")
    sync_trip_simulation(trip)
    simulation.is_active = False
    simulation.save(update_fields=["is_active", "updated_at"])
    return trip.locations.order_by("-recorded_at").first(), simulation


def resume_trip_simulation(trip, step_interval_ms=None):
    simulation = getattr(trip, "simulation", None)
    if not simulation or not simulation.points:
        return ensure_trip_simulation(trip, step_interval_ms or 3000)

    sync_trip_simulation(trip)
    simulation.is_active = True
    simulation.last_advanced_at = timezone.now()
    if step_interval_ms is not None:
        simulation.step_interval_ms = max(1000, min(int(step_interval_ms or simulation.step_interval_ms), 10000))
        simulation.save(update_fields=["is_active", "last_advanced_at", "step_interval_ms", "updated_at"])
    else:
        simulation.save(update_fields=["is_active", "last_advanced_at", "updated_at"])
    return trip.locations.order_by("-recorded_at").first(), simulation


def reset_trip_simulation(trip):
    simulation = getattr(trip, "simulation", None)
    if not simulation or not simulation.points:
        raise ValueError("No simulation has been started for this trip.")
    simulation.current_index = 0
    simulation.last_persisted_index = 0
    simulation.is_active = False
    simulation.last_advanced_at = None
    simulation.save(update_fields=["current_index", "last_persisted_index", "is_active", "last_advanced_at", "updated_at"])
    return _persist_simulation_point(trip, simulation), simulation


def step_trip_simulation(trip):
    simulation = getattr(trip, "simulation", None)
    if not simulation or not simulation.points:
        raise ValueError("No simulation has been started for this trip.")
    simulation.is_active = False
    simulation.current_index = min(simulation.current_index + 1, len(simulation.points) - 1)
    simulation.last_advanced_at = timezone.now()
    simulation.save(update_fields=["current_index", "is_active", "last_advanced_at", "updated_at"])
    return _persist_simulation_point(trip, simulation), simulation


def stop_trip_simulation(trip):
    simulation = getattr(trip, "simulation", None)
    if not simulation:
        return
    simulation.is_active = False
    simulation.save(update_fields=["is_active", "updated_at"])
