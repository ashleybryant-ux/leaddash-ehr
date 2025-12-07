import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// ============================================
// DEV MODE BYPASS - Set to false before deploying!
// ============================================
const DEV_BYPASS_AUTH = false;

// ============================================
// Types
// ============================================

interface User {
  userId: string;
  userEmail: string;
  userName: string;
  userType: string;
  locationId: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInIframe: boolean;
  isFromGHL: boolean;
  error: string | null;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

// ============================================
// Context
// ============================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================
// Helper Functions
// ============================================

const checkIsInIframe = (): boolean => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
};

const checkIsFromGHL = (): boolean => {
  const referrer = document.referrer.toLowerCase();
  const allowedDomains = ['app.leaddash.io', 'leaddash.io'];
  return allowedDomains.some(domain => referrer.includes(domain));
};

// ============================================
// Provider Component
// ============================================

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInIframe] = useState(checkIsInIframe);
  const [isFromGHL] = useState(checkIsFromGHL);
  const [searchParams, setSearchParams] = useSearchParams();

  const navigate = useNavigate();

  const checkAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // ========== DEV BYPASS ==========
      if (DEV_BYPASS_AUTH) {
        const devUser: User = {
          userId: 'dev-user-123',
          userEmail: 'dev@leaddash.io',
          userName: 'Dev User',
          userType: 'account-admin',
          locationId: 'puLPmzfdCvfQRANPM2WA',
        };
        
        setUser(devUser);
        localStorage.setItem('userId', devUser.userId);
        localStorage.setItem('userName', devUser.userName);
        localStorage.setItem('userEmail', devUser.userEmail);
        localStorage.setItem('userType', devUser.userType);
        localStorage.setItem('locationId', devUser.locationId);
        localStorage.setItem('isAdmin', 'true');
        
        console.log('🔓 DEV MODE: Auth bypassed');
        setIsLoading(false);
        return;
      }
      // ========== END DEV BYPASS ==========

      // Check for token in URL (from SSO redirect)
      const tokenFromUrl = searchParams.get('token');
      let authToken = localStorage.getItem('authToken');

      if (tokenFromUrl) {
        // Store the new token
        authToken = tokenFromUrl;
        localStorage.setItem('authToken', tokenFromUrl);
        
        // Clean up URL
        searchParams.delete('token');
        setSearchParams(searchParams, { replace: true });
      }

      if (!authToken) {
        // No token available - redirect to access denied
        setUser(null);
        if (!window.location.pathname.includes('access-denied')) {
          navigate('/access-denied?reason=no_token');
        }
        setIsLoading(false);
        return;
      }

      // Call /api/auth/me with the token
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.authenticated && data.user) {
        const authenticatedUser: User = {
          userId: data.user.userId || data.user.id,
          userEmail: data.user.email || '',
          userName: data.user.name || 'User',
          userType: data.user.role || 'user',
          locationId: data.user.locationId || '',
        };
        
        setUser(authenticatedUser);
        localStorage.setItem('userId', authenticatedUser.userId);
        localStorage.setItem('userName', authenticatedUser.userName);
        localStorage.setItem('userEmail', authenticatedUser.userEmail);
        localStorage.setItem('userType', authenticatedUser.userType);
        localStorage.setItem('locationId', authenticatedUser.locationId);
        localStorage.setItem('isAdmin', authenticatedUser.userType === 'admin' ? 'true' : 'false');
      } else {
        // Token invalid or expired
        setUser(null);
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userName');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userType');
        localStorage.removeItem('locationId');
        
        if (!window.location.pathname.includes('access-denied')) {
          navigate('/access-denied?reason=' + (data.reason || 'invalid_token'));
        }
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      setError('Failed to verify authentication');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [navigate, searchParams, setSearchParams]);

  const logout = useCallback(async () => {
    try {
      const authToken = localStorage.getItem('authToken');
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
      });
    } catch (err) {
      console.error('Logout failed:', err);
    }

    setUser(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userType');
    localStorage.removeItem('locationId');

    navigate('/access-denied?reason=logged_out');
  }, [navigate]);

  useEffect(() => {
    if (window.location.pathname.includes('access-denied') || 
        window.location.pathname.includes('/auth/sso')) {
      setIsLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    isInIframe,
    isFromGHL,
    error,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ============================================
// Hook
// ============================================

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ============================================
// Protected Route Component
// ============================================

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles 
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/access-denied?reason=not_authenticated');
    }

    if (!isLoading && isAuthenticated && allowedRoles && user) {
      const userRole = user.userType?.toUpperCase().replace(/_/g, '-');
      const hasRole = allowedRoles.some(role => 
        userRole.includes(role.toUpperCase().replace(/_/g, '-'))
      );
      
      if (!hasRole) {
        navigate('/access-denied?reason=insufficient_permissions');
      }
    }
  }, [isAuthenticated, isLoading, user, allowedRoles, navigate]);

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
};

export default AuthProvider;