import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import PassengerHome from "./pages/passenger/PassengerHomeRedesigned";
import HelperHome from "./pages/helper/HelperHome";
import DriverHome from "./pages/driver/DriverHome";
import AdminHome from "./pages/admin/AdminHome";
import PaymentResult from "./pages/PaymentResult";
import ProtectedRoute from "./ProtectedRoute";
import GlobalNotification from "./components/GlobalNotification";

export default function App() {
  return (
    <>
      <GlobalNotification />
      <Routes>
        <Route path="/" element={<Navigate to="/passenger" replace />} />

        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/register" element={<Register />} />

        <Route path="/payment/result" element={<PaymentResult />} />

        <Route
          path="/passenger"
          element={
            <ProtectedRoute allowRoles={["PASSENGER"]}>
              <PassengerHome />
            </ProtectedRoute>
          }
        />

        <Route
          path="/helper"
          element={
            <ProtectedRoute allowRoles={["HELPER"]}>
              <HelperHome />
            </ProtectedRoute>
          }
        />

        <Route
          path="/driver"
          element={
            <ProtectedRoute allowRoles={["DRIVER"]}>
              <DriverHome />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowRoles={["ADMIN"]}>
              <AdminHome />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
