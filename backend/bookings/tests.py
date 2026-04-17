from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from bookings.models import Booking, BookingSeat
from payments.models import Payment
from transport.models import Bus, Route, RouteFare, RouteStop, Stop
from transport.services import ensure_bus_seats
from trips.models import Trip


class PassengerSeatHoldTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.passenger_one = user_model.objects.create_user(
            phone="+9779800000001",
            password="pass1234",
            full_name="Passenger One",
            role=user_model.Role.PASSENGER,
        )
        self.passenger_two = user_model.objects.create_user(
            phone="+9779800000002",
            password="pass1234",
            full_name="Passenger Two",
            role=user_model.Role.PASSENGER,
        )
        self.driver = user_model.objects.create_user(
            phone="+9779800000003",
            password="pass1234",
            full_name="Driver Demo",
            role=user_model.Role.DRIVER,
        )
        self.helper = user_model.objects.create_user(
            phone="+9779800000004",
            password="pass1234",
            full_name="Helper Demo",
            role=user_model.Role.HELPER,
        )

        self.stop_one = Stop.objects.create(name="Alpha", lat="28.209600", lng="83.985600")
        self.stop_two = Stop.objects.create(name="Bravo", lat="28.219600", lng="83.995600")
        self.route = Route.objects.create(name="Alpha to Bravo", city="Pokhara")
        RouteStop.objects.create(route=self.route, stop=self.stop_one, stop_order=1)
        RouteStop.objects.create(route=self.route, stop=self.stop_two, stop_order=2)
        RouteFare.objects.create(route=self.route, from_stop_order=1, to_stop_order=2, fare_amount="50.00")

        self.bus = Bus.objects.create(
            display_name="Metro One",
            plate_number="GA-01-TEST-01",
            capacity=4,
            layout_rows=1,
            layout_columns=4,
            driver=self.driver,
            helper=self.helper,
        )
        ensure_bus_seats(self.bus)
        self.seat = self.bus.seats.order_by("seat_no").first()

        self.trip = Trip.objects.create(
            route=self.route,
            bus=self.bus,
            driver=self.driver,
            helper=self.helper,
            status=Trip.Status.LIVE,
        )

    def test_seat_hold_is_hidden_from_other_passengers(self):
        self.client.force_authenticate(self.passenger_one)
        hold_response = self.client.post(
            f"/api/bookings/trips/{self.trip.id}/holds/",
            {"from_stop_order": 1, "to_stop_order": 2, "seat_ids": [self.seat.id]},
            format="json",
        )
        self.assertEqual(hold_response.status_code, status.HTTP_200_OK)
        self.assertEqual(hold_response.data["selected_seat_ids"], [self.seat.id])

        availability_for_owner = self.client.get(
            f"/api/bookings/trips/{self.trip.id}/availability/?from=1&to=2"
        )
        owner_seat = next(item for item in availability_for_owner.data["seats"] if item["seat_id"] == self.seat.id)
        self.assertFalse(owner_seat["available"])
        self.assertTrue(owner_seat["held_by_me"])
        self.assertEqual(owner_seat["seat_state"], "HELD")

        self.client.force_authenticate(self.passenger_two)
        availability_for_other = self.client.get(
            f"/api/bookings/trips/{self.trip.id}/availability/?from=1&to=2"
        )
        other_seat = next(item for item in availability_for_other.data["seats"] if item["seat_id"] == self.seat.id)
        self.assertFalse(other_seat["available"])
        self.assertFalse(other_seat["held_by_me"])
        self.assertEqual(other_seat["seat_state"], "HELD")

    def test_other_passenger_cannot_book_held_seat(self):
        self.client.force_authenticate(self.passenger_one)
        self.client.post(
            f"/api/bookings/trips/{self.trip.id}/holds/",
            {"from_stop_order": 1, "to_stop_order": 2, "seat_ids": [self.seat.id]},
            format="json",
        )

        self.client.force_authenticate(self.passenger_two)
        booking_response = self.client.post(
            f"/api/bookings/trips/{self.trip.id}/book/",
            {"from_stop_order": 1, "to_stop_order": 2, "seat_ids": [self.seat.id]},
            format="json",
        )
        self.assertEqual(booking_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Seats not available", booking_response.data["detail"])


class HelperOtpBoardingFlowTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.passenger = user_model.objects.create_user(
            phone="+9779811000001",
            password="pass1234",
            full_name="Passenger Rider",
            role=user_model.Role.PASSENGER,
        )
        self.driver = user_model.objects.create_user(
            phone="+9779811000002",
            password="pass1234",
            full_name="Driver Rider",
            role=user_model.Role.DRIVER,
        )
        self.helper = user_model.objects.create_user(
            phone="+9779811000003",
            password="pass1234",
            full_name="Helper Rider",
            role=user_model.Role.HELPER,
        )

        self.stop_one = Stop.objects.create(name="City Center", lat="28.209600", lng="83.985600")
        self.stop_two = Stop.objects.create(name="Lake Side", lat="28.219600", lng="83.995600")
        self.route = Route.objects.create(name="City Center to Lake Side", city="Pokhara")
        RouteStop.objects.create(route=self.route, stop=self.stop_one, stop_order=1)
        RouteStop.objects.create(route=self.route, stop=self.stop_two, stop_order=2)
        RouteFare.objects.create(route=self.route, from_stop_order=1, to_stop_order=2, fare_amount="120.00")

        self.bus = Bus.objects.create(
            display_name="Metro Rider",
            plate_number="GA-02-TEST-02",
            capacity=8,
            layout_rows=2,
            layout_columns=4,
            driver=self.driver,
            helper=self.helper,
        )
        ensure_bus_seats(self.bus)
        self.seat = self.bus.seats.order_by("seat_no").first()

        self.trip = Trip.objects.create(
            route=self.route,
            bus=self.bus,
            driver=self.driver,
            helper=self.helper,
            status=Trip.Status.LIVE,
        )

        self.booking = Booking.objects.create(
            trip=self.trip,
            passenger=self.passenger,
            from_stop_order=1,
            to_stop_order=2,
            seats_count=1,
            fare_total="120.00",
            status=Booking.Status.CONFIRMED,
        )
        BookingSeat.objects.create(booking=self.booking, seat=self.seat)

    def test_helper_can_board_passenger_without_payment_and_leave_status_pending(self):
        self.client.force_authenticate(self.helper)

        verify_response = self.client.post(
            "/api/bookings/otp/verify/",
            {"reference": self.booking.boarding_otp},
            format="json",
        )
        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)

        board_response = self.client.post(
            f"/api/bookings/{self.booking.id}/board/",
            {"request_payment": False},
            format="json",
        )
        self.assertEqual(board_response.status_code, status.HTTP_200_OK)
        self.assertEqual(board_response.data["booking"]["payment_status"], "PENDING")
        self.assertIsNone(board_response.data["booking"]["payment"])

        self.booking.refresh_from_db()
        self.assertIsNotNone(self.booking.accepted_by_helper_at)
        self.assertIsNotNone(self.booking.checked_in_at)
        self.assertIsNone(self.booking.payment_requested_at)
        self.assertEqual(self.booking.journey_status, Booking.JourneyStatus.BOARDED)

    def test_helper_can_board_and_request_payment_then_passenger_can_pay(self):
        self.client.force_authenticate(self.helper)
        board_response = self.client.post(
            f"/api/bookings/{self.booking.id}/board/",
            {"request_payment": True},
            format="json",
        )
        self.assertEqual(board_response.status_code, status.HTTP_200_OK)
        self.assertIn("payment request sent", board_response.data["message"].lower())
        self.assertEqual(board_response.data["booking"]["payment_status"], "PENDING")

        self.booking.refresh_from_db()
        self.assertIsNotNone(self.booking.checked_in_at)
        self.assertIsNotNone(self.booking.payment_requested_at)

        self.client.force_authenticate(self.passenger)
        passenger_bookings = self.client.get("/api/bookings/my/")
        self.assertEqual(passenger_bookings.status_code, status.HTTP_200_OK)
        passenger_booking = next(item for item in passenger_bookings.data["bookings"] if item["id"] == self.booking.id)
        self.assertTrue(passenger_booking["needs_payment_selection"])
        self.assertEqual(passenger_booking["payment_status"], "PENDING")

        payment_response = self.client.post(
            "/api/payments/create/",
            {"booking_id": self.booking.id, "method": Payment.Method.MOCK_ONLINE},
            format="json",
        )
        self.assertEqual(payment_response.status_code, status.HTTP_201_CREATED)

        self.booking.refresh_from_db()
        self.assertIsNotNone(self.booking.checked_in_at)
        self.assertEqual(self.booking.journey_status, Booking.JourneyStatus.BOARDED)

        passenger_bookings_after_payment = self.client.get("/api/bookings/my/")
        self.assertEqual(passenger_bookings_after_payment.status_code, status.HTTP_200_OK)
        updated_booking = next(
            item for item in passenger_bookings_after_payment.data["bookings"] if item["id"] == self.booking.id
        )
        self.assertEqual(updated_booking["payment_status"], "SUCCESS")
        self.assertFalse(updated_booking["needs_payment_selection"])
