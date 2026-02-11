class Bus:
    def __init__(self, bus_id, capacity, route):
        self.bus_id = bus_id
        self.capacity = capacity
        self.route = route

class Route:
    def __init__(self, route_id, start_station, end_station, distance):
        self.route_id = route_id
        self.start_station = start_station
        self.end_station = end_station
        self.distance = distance

class Station:
    def __init__(self, station_id, name, location):
        self.station_id = station_id
        self.name = name
        self.location = location

