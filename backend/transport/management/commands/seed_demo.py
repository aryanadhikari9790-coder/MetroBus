from django.core.management.base import BaseCommand
from transport.models import Stop, Route, RouteStop, Bus, Seat, RouteFare


class Command(BaseCommand):
    help = "Seed demo data for MetroBus (Pokhara)"

    def handle(self, *args, **options):
        # --- Stops (sample) ---
        stops_data = [
            ("Lakeside", 28.2096, 83.9594),
            ("Chipledhunga", 28.2139, 83.9856),
            ("Prithvi Chowk", 28.1997, 83.9820),
            ("Buddha Chowk", 28.2210, 83.9950),
            ("Bagar", 28.2370, 83.9958),
        ]

        stops = {}
        for name, lat, lng in stops_data:
            stop, _ = Stop.objects.get_or_create(
                name=name,
                defaults={"lat": lat, "lng": lng, "is_active": True},
            )
            stops[name] = stop

        # --- Route (two-way = separate routes) ---
        r1, _ = Route.objects.get_or_create(name="Lakeside → Prithvi Chowk", city="Pokhara")
        r2, _ = Route.objects.get_or_create(name="Prithvi Chowk → Lakeside", city="Pokhara")

        # RouteStop orders
        route1_stops = ["Lakeside", "Chipledhunga", "Prithvi Chowk"]
        route2_stops = list(reversed(route1_stops))

        RouteStop.objects.filter(route=r1).delete()
        for idx, sname in enumerate(route1_stops, start=1):
            RouteStop.objects.create(route=r1, stop=stops[sname], stop_order=idx)

        RouteStop.objects.filter(route=r2).delete()
        for idx, sname in enumerate(route2_stops, start=1):
            RouteStop.objects.create(route=r2, stop=stops[sname], stop_order=idx)

        # --- Bus + Seats (A1 style) ---
        bus, _ = Bus.objects.get_or_create(plate_number="GA-01-001-KHA", defaults={"capacity": 35, "is_active": True})
        Seat.objects.filter(bus=bus).delete()

        # Create seats A1..A20, B1..B15 = 35 seats
        seat_labels = [f"A{i}" for i in range(1, 21)] + [f"B{i}" for i in range(1, 16)]
        for label in seat_labels:
            Seat.objects.create(bus=bus, seat_no=label)

        # --- Fare table (F1 stop-to-stop by stop_order) ---
        # For route1: 1->2=20, 2->3=25, 1->3=35 (example)
        RouteFare.objects.filter(route=r1).delete()
        RouteFare.objects.create(route=r1, from_stop_order=1, to_stop_order=2, fare_amount=20)
        RouteFare.objects.create(route=r1, from_stop_order=2, to_stop_order=3, fare_amount=25)
        RouteFare.objects.create(route=r1, from_stop_order=1, to_stop_order=3, fare_amount=35)

        # For route2 (reverse)
        RouteFare.objects.filter(route=r2).delete()
        RouteFare.objects.create(route=r2, from_stop_order=1, to_stop_order=2, fare_amount=25)
        RouteFare.objects.create(route=r2, from_stop_order=2, to_stop_order=3, fare_amount=20)
        RouteFare.objects.create(route=r2, from_stop_order=1, to_stop_order=3, fare_amount=35)

        self.stdout.write(self.style.SUCCESS("✅ Seed demo data created/updated successfully."))
        self.stdout.write(self.style.SUCCESS("Routes: Lakeside → Prithvi Chowk and reverse"))
        self.stdout.write(self.style.SUCCESS("Bus: GA-01-001-KHA with A1 style seats"))
