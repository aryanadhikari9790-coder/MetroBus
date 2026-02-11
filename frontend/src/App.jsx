import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/auth/Login.jsx";
import Register from "./pages/auth/Register.jsx";
import PassengerHome from "./pages/passenger/PassengerHome.jsx";
import DriverHome from "./pages/driver/DriverHome.jsx";
import HelperHome from "./pages/helper/HelperHome.jsx";
import AdminHome from "./pages/admin/AdminHome.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth/login" element={<Login />} />
      <Route path="/auth/register" element={<Register />} />

      {/* MVP placeholder dashboards */}
      <Route path="/passenger" element={<PassengerHome />} />
      <Route path="/driver" element={<DriverHome />} />
      <Route path="/helper" element={<HelperHome />} />
      <Route path="/admin" element={<AdminHome />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
