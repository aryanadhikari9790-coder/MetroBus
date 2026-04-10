from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .realtime import booking_user_group


class BookingEventConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if not user or getattr(user, "is_anonymous", True):
            await self.close(code=4401)
            return

        self.user_group_name = booking_user_group(user.id)
        await self.channel_layer.group_add(self.user_group_name, self.channel_name)
        await self.accept()
        await self.send_json(
            {
                "type": "SOCKET_CONNECTED",
                "message": "Booking event stream connected.",
                "user_id": user.id,
                "role": getattr(user, "role", ""),
            }
        )

    async def disconnect(self, close_code):
        if hasattr(self, "user_group_name"):
            await self.channel_layer.group_discard(self.user_group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        if content.get("type") == "PING":
            await self.send_json({"type": "PONG"})

    async def booking_event(self, event):
        await self.send_json(event["payload"])
