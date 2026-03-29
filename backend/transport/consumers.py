import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async

class BusLocationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.trip_id = self.scope['url_route']['kwargs']['trip_id']
        self.group_name = f"trip_{self.trip_id}"

        # Join trip group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        # Leave trip group
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    # Receive message from WebSocket (Driver)
    async def receive_json(self, content):
        lat = content.get('lat')
        lng = content.get('lng')
        bearing = content.get('bearing', 0)
        
        # Note for FYP: Here we would ideally also save the location
        # to the database (Trip.latest_location) using @database_sync_to_async.
        # For pure Triangular Communication, we immediately broker the message out.

        # Send message to specific Trip group
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'bus_location_update',
                'lat': lat,
                'lng': lng,
                'bearing': bearing
            }
        )

    # Receive message from room group (Internal channels method)
    async def bus_location_update(self, event):
        # Broadcast message to WebSocket (Passengers)
        await self.send_json({
            'lat': event['lat'],
            'lng': event['lng'],
            'bearing': event.get('bearing', 0)
        })
