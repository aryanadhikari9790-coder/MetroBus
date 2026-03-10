import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

const roleToHome = {
  PASSENGER: "/passenger",
  DRIVER: "/driver",
  HELPER: "/helper",
  ADMIN: "/admin",
};

export default function ProtectedRoute({ allowRoles, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600 dark:text-slate-300">
        Loading...
      </div>
    );
  }

  if (!user) return <Navigate to="/auth/login" replace />;

  if (allowRoles && !allowRoles.includes(user.role)) {
    const dest = roleToHome[user.role] || "/passenger";
    return <Navigate to={dest} replace />;
  }

  return children;
}
