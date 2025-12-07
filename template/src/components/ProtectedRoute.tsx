import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { all_routes } from '../routes/all_routes';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={all_routes.login} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;