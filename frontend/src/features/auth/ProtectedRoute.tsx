import { Navigate, Outlet, useLocation } from "react-router-dom";
import { PageLoader } from "../../components/PageLoader";
import { useAuth } from "./AuthContext";
import type { UserRole } from "./auth.types";

export function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === "initializing")
    return <PageLoader label="Restoring session" />;
  if (auth.status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && !auth.hasRole(...roles))
    return <Navigate to="/forbidden" replace />;
  return <Outlet />;
}
