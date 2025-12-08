import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const DEV_BYPASS_AUTH = false;

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  type: string;
  locationId: string;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInIframe: boolean;
  isFromGHL: boolean;
  error: string | null;
  login: (email: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  getUserId: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInIframe] = useState(checkIsInIframe);
  const [isFromGHL] = useState(checkIsFromGHL);
  const hasCheckedAuth = useRef(false);

  const navigate = useNavigate();

  const getUserId = useCallback((): string | null => {
    return user?.id || null;
  }, [user]);

  const login = useCallback(async (email: string): Promise<boolean> => {
    try {
      setError(null);
      const response = await fetch(API_URL + '/api/auth/email-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (data.success && data.token) {
        localStorage.setItem('authToken', data.token);
        
        const nameParts = (data.user?.userName || '').split(' ');
        const authenticatedUser: User = {
          id: data.user?.userId || '',
          firstName: nameParts[0] || 'User',
          lastName: nameParts.slice(1).join(' ') || '',
          email: data.user?.userEmail || email,
          role: data.user?.userType || 'user',
          type: data.user?.userType || 'user',
          locationId: data.user?.locationId || '',
          isAdmin: data.user?.isAdmin || false,
        };
        
        setUser(authenticatedUser);
        localStorage.setItem('userId', authenticatedUser.id);
        localStorage.setItem('locationId', authenticatedUser.locationId);
        localStorage.setItem('isAdmin', authenticatedUser.isAdmin ? 'true' : 'false');
        
        return true;
      } else {
        setError(data.error || 'Email not found');
        return false;
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Login failed. Please try again.');
      return false;
    }
  }, []);

  const checkAuth = useCallback(async () => {
    if (hasCheckedAuth.current) return;
    hasCheckedAuth.current = true;

    try {
      setIsLoading(true);
      setError(null);

      if (DEV_BYPASS_AUTH) {
        const devUser: User = {
          id: 'dev-user-123',
          firstName: 'Dev',
          lastName: 'User',
          email: 'dev@leaddash.io',
          role: 'Agency Owner',
          type: 'AGENCY-OWNER',
          locationId: 'puLPmzfdCvfQRANPM2WA',
          isAdmin: true,
        };
        setUser(devUser);
        localStorage.setItem('userId', devUser.id);
        localStorage.setItem('locationId', devUser.locationId);
        localStorage.setItem('isAdmin', 'true');
        console.log('DEV MODE: Auth bypassed');
        setIsLoading(false);
        return;
      }

      const urlParams = new URLSearchParams(window.location.search);
      const isSsoRequest = urlParams.get('sso') === 'true';
      const locationId = urlParams.get('locationId');
      const userId = urlParams.get('userId');
      const tokenFromUrl = urlParams.get('token');
      let authToken = localStorage.getItem('authToken');

      if (isSsoRequest && locationId && userId) {
        console.log('SSO Request detected, calling backend...');
        
        try {
          const response = await fetch(API_URL + '/api/auth/sso-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locationId, userId }),
          });
          
          const data = await response.json();
          console.log('SSO Login response:', data);
          
          if (data.success && data.token) {
            authToken = data.token;
            localStorage.setItem('authToken', data.token);
            window.history.replaceState({}, '', window.location.pathname);
          } else {
            console.log('SSO Login failed:', data.error);
            setUser(null);
            setIsLoading(false);
            if (!window.location.pathname.includes('access-denied')) {
              navigate('/access-denied?reason=sso_failed');
            }
            return;
          }
        } catch (err) {
          console.error('SSO Login error:', err);
          setUser(null);
          setIsLoading(false);
          if (!window.location.pathname.includes('access-denied')) {
            navigate('/access-denied?reason=sso_error');
          }
          return;
        }
      }
      
      if (tokenFromUrl && !authToken) {
        console.log('Token found in URL');
        authToken = tokenFromUrl;
        localStorage.setItem('authToken', tokenFromUrl);
        window.history.replaceState({}, '', window.location.pathname);
      }

      if (!authToken) {
        console.log('No auth token available');
        setUser(null);
        setIsLoading(false);
        if (!window.location.pathname.includes('access-denied') && !window.location.pathname.includes('login')) {
          navigate('/access-denied?reason=no_token');
        }
        return;
      }

      console.log('Verifying token with backend...');
      
      const response = await fetch(API_URL + '/api/auth/me', {
        headers: {
          'Authorization': 'Bearer ' + authToken,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      console.log('Auth response:', data);

      if (data.authenticated && data.user) {
        const nameParts = (data.user.userName || '').split(' ');
        const authenticatedUser: User = {
          id: data.user.userId,
          firstName: nameParts[0] || 'User',
          lastName: nameParts.slice(1).join(' ') || '',
          email: data.user.userEmail || '',
          role: data.user.userType || 'user',
          type: data.user.userType || 'user',
          locationId: data.user.locationId || '',
          isAdmin: data.user.isAdmin || false,
        };
        
        console.log('User authenticated:', authenticatedUser.firstName, authenticatedUser.lastName);
        
        setUser(authenticatedUser);
        localStorage.setItem('userId', authenticatedUser.id);
        localStorage.setItem('locationId', authenticatedUser.locationId);
        localStorage.setItem('isAdmin', authenticatedUser.isAdmin ? 'true' : 'false');
      } else {
        console.log('Token invalid or expired');
        setUser(null);
        localStorage.removeItem('authToken');
        if (!window.location.pathname.includes('access-denied') && !window.location.pathname.includes('login')) {
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
  }, [navigate]);

  const logout = useCallback(async () => {
    try {
      const authToken = localStorage.getItem('authToken');
      await fetch(API_URL + '/api/auth/logout', {
        method: 'POST',
        headers: authToken ? { 'Authorization': 'Bearer ' + authToken } : {},
      });
    } catch (err) {
      console.error('Logout failed:', err);
    }

    setUser(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('locationId');
    navigate('/access-denied?reason=logged_out');
  }, [navigate]);

  useEffect(() => {
    if (window.location.pathname.includes('access-denied') || 
        window.location.pathname.includes('/auth/sso') ||
        window.location.pathname.includes('login')) {
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
    login,
    logout,
    checkAuth,
    getUserId,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

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
      const userRole = user.type?.toUpperCase().replace(/_/g, '-');
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