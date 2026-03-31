import math
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from .models import TripLocation, TripSimulation


def _clean_points(points):
    clean = []
    for point in points or []:
        if not isinstance(point, (list, tuple)) or len(point) != 2:
            continue
        try:
            lat = round(float(point[0]), 6)
            lng = round(float(point[1]), 6)
        except (TypeError, ValueError):
            continue
        clean.append([lat, lng])
    return clean


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
    clean_points = _clean_points(points)
    if len(clean_points) < 2:
        raise ValueError("Provide at least two valid route points for simulation.")

    simulation, _ = TripSimulation.objects.get_or_create(trip=trip)
    simulation.points = clean_points
    simulation.current_index = 0
    simulation.last_persisted_index = 0
    simulation.step_interval_ms = max(400, min(int(step_interval_ms or 2000), 10000))
    simulation.is_active = True
    simulation.last_advanced_at = timezone.now()
    simulation.save()

    return _persist_simulation_point(trip, simulation), simulation


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
