from django.db import models


class Trip(models.Model):
    trip_id = models.AutoField(primary_key=True)
    origin = models.CharField(max_length=100)
    destination = models.CharField(max_length=100)
    departure_time = models.DateTimeField()
    arrival_time = models.DateTimeField()
    duration = models.IntegerField(help_text="Duration in minutes")

    def __str__(self):
        return f'Trip {self.trip_id} from {self.origin} to {self.destination}'


class TripStop(models.Model):
    trip = models.ForeignKey(Trip, related_name='stops', on_delete=models.CASCADE)
    stop_name = models.CharField(max_length=100)
    stop_order = models.IntegerField()
    schedule_time = models.DateTimeField()

    def __str__(self):
        return f'Stop {self.stop_order} at {self.stop_name} for Trip {self.trip.trip_id}'