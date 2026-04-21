import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from trips.models import TripSchedule, Trip

def test_delete():
    print("Listing schedules...")
    schedules = TripSchedule.objects.all()
    if not schedules.exists():
        print("No schedules found.")
        return

    for s in schedules:
        print(f"Schedule ID={s.id}, Route={s.route.name}, Status={s.status}, Trips={s.trips.count()}")
        try:
            # We will NOT actually commit here if possible, or just delete one that looks safe.
            # But let's just see if calling .delete() raises an error.
            # actually, let's just try to delete the one the user is showing if we can identify it.
            # Lake to market, starts 4/17/2026 11:54 PM.
            pass
        except Exception as e:
            print(f"Error checking schedule {s.id}: {e}")

if __name__ == "__main__":
    test_delete()
