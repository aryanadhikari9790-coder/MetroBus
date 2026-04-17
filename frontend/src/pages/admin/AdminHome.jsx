import { Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./Dashboard";
import DriverManagement from "./DriverManagement";
import HelperManagement from "./HelperManagement";
import BusManagement from "./BusManagement";
import StationManagement from "./StationManagement";
import RouteManagement from "./RouteManagement";
import AssignmentManagement from "./AssignmentManagement";
import Analytics from "./Analytics";
import Settings from "./Settings";

export default function AdminHome() {
  return (
    <Routes>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="drivers" element={<DriverManagement />} />
      <Route path="helpers" element={<HelperManagement />} />
      <Route path="buses" element={<BusManagement />} />
      <Route path="stops" element={<StationManagement />} />
      <Route path="routes" element={<RouteManagement />} />
      <Route path="assignments" element={<AssignmentManagement />} />
      <Route path="analytics" element={<Analytics />} />
      <Route path="reports" element={<Analytics />} />
      <Route path="settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
}
