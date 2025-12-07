import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const DEV_BYPASS_AUTH = false;

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

  const checkAuth = useCallback(async () => {
    if (hasCheckedAuth.current) return;
    hasCheckedAuth.current = true;

    try {
      setIsLoading(true);
      setError(null);

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

      const urlParams = new URLSearchParams(window.location.search);
      const isSsoRequest = urlParams.get('sso') === 'true';
      const locationId = urlParams.get('locationId');
      const userId = urlParams.get('userId');
      const userName = urlParams.get('userName');
      const userEmail = urlParams.get('userEmail');
      const userType = urlParams.get('userType');
      const tokenFromUrl = urlParams.get('token');
      let authToken = localStorage.getItem('authToken');

      if (isSsoRequest && locationId && userId) {
        console.log('🔐 SSO Request detected, calling backend...');
        
        try {
          const response = await fetch(`${API_URL}/api/auth/sso-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              locationId,
              userId,
              userName: userName || 'User',
              userEmail: userEmail || '',
              userType: userType || 'user',
            }),
          });
          
          const data = await response.json();
          console.log('📦 SSO Login response:', data);
          
          if (data.success && data.token) {
            authToken = data.token;
            localStorage.setItem('authToken', data.token);
            window.history.replaceState({}, '', window.location.pathname);
          } else {
            console.log('❌ SSO Login failed:', data.error);
            setUser(null);
            setIsLoading(false);
            if (!window.location.pathname.includes('access-denied')) {
              navigate('/access-denied?reason=sso_failed');
            }
            return;
          }
        } catch (err) {
          console.error('❌ SSO Login error:', err);
          setUser(null);
          setIsLoading(false);
          if (!window.location.pathname.includes('access-denied')) {
            navigate('/access-denied?reason=sso_error');
          }
          return;
        }
      }
      
      if (tokenFromUrl && !authToken) {
        console.log('🔑 Token found in URL');
        authToken = tokenFromUrl;
        localStorage.setItem('authToken', tokenFromUrl);
        window.history.replaceState({}, '', window.location.pathname);
      }

      if (!authToken) {
        console.log('❌ No auth token available');
        setUser(null);
        setIsLoading(false);
        if (!window.location.pathname.includes('access-denied')) {
          navigate('/access-denied?reason=no_token');
        }
        return;
      }

      console.log('🔐 Verifying token with backend...');
      
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      console.log('📦 Auth response:', data);

      if (data.authenticated && data.user) {
        const authenticatedUser: User = {
          userId: data.user.userId || data.user.id,
          userEmail: data.user.userEmail || data.user.email || '',
          userName: data.user.userName || data.user.name || 'User',
          userType: data.user.userType || data.user.role || 'user',
          locationId: data.user.locationId || '',
        };
        
        console.log('✅ User authenticated:', authenticatedUser.userName);
        
        setUser(authenticatedUser);
        localStorage.setItem('userId', authenticatedUser.userId);
        localStorage.setItem('userName', authenticatedUser.userName);
        localStorage.setItem('userEmail', authenticatedUser.userEmail);
        localStorage.setItem('userType', authenticatedUser.userType);
        localStorage.setItem('locationId', authenticatedUser.locationId);
        localStorage.setItem('isAdmin', authenticatedUser.userType === 'admin' ? 'true' : 'false');
      } else {
        console.log('❌ Token invalid or expired');
        setUser(null);
        localStorage.removeItem('authToken');
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
  }, [navigate]);

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

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;
