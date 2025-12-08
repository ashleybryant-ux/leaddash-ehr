import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface User {
  userId: string;
  userEmail: string;
  userName: string;
  firstName: string;
  lastName: string;
  userType: string;
  locationId: string;
  isAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string) => Promise<boolean>;
  logout: () => void;
  ssoLogin: (locationId: string, userId: string) => Promise<boolean>;
  getUserId: () => string | null;
  getLocationId: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const saveUserToLocalStorage = (userData: User, token: string) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('userName', userData.userName);
    localStorage.setItem('userId', userData.userId);
    localStorage.setItem('locationId', userData.locationId);
    localStorage.setItem('userEmail', userData.userEmail);
    localStorage.setItem('userType', userData.userType);
    localStorage.setItem('isAdmin', String(userData.isAdmin));
  };

  const clearLocalStorage = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    localStorage.removeItem('locationId');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userType');
    localStorage.removeItem('isAdmin');
  };

  const getUserId = (): string | null => {
    return user?.userId || localStorage.getItem('userId');
  };

  const getLocationId = (): string | null => {
    return user?.locationId || localStorage.getItem('locationId');
  };

  const verifyToken = async (token: string): Promise<boolean> => {
    try {
      console.log('Verifying token with backend...');
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Auth response:', data);
        
        if (data.authenticated && data.user) {
          const nameParts = (data.user.userName || 'User').split(' ');
          const firstName = nameParts[0] || 'User';
          const lastName = nameParts.slice(1).join(' ') || '';
          
          const userData: User = {
            userId: data.user.userId,
            userEmail: data.user.userEmail,
            userName: data.user.userName,
            firstName: firstName,
            lastName: lastName,
            userType: data.user.userType,
            locationId: data.user.locationId,
            isAdmin: data.user.isAdmin
          };
          
          console.log('User authenticated:', firstName, lastName);
          setUser(userData);
          saveUserToLocalStorage(userData, token);
          return true;
        }
      }
      
      clearLocalStorage();
      setUser(null);
      return false;
    } catch (error) {
      console.error('Token verification failed:', error);
      clearLocalStorage();
      setUser(null);
      return false;
    }
  };

  const ssoLogin = async (locationId: string, userId: string): Promise<boolean> => {
    try {
      console.log('SSO login attempt:', { locationId, userId });
      const response = await fetch(`${API_URL}/api/auth/sso-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ locationId, userId })
      });

      const data = await response.json();
      
      if (data.success && data.token) {
        const nameParts = (data.user.userName || 'User').split(' ');
        const firstName = nameParts[0] || 'User';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        const userData: User = {
          userId: data.user.userId,
          userEmail: data.user.userEmail,
          userName: data.user.userName,
          firstName: firstName,
          lastName: lastName,
          userType: data.user.userType,
          locationId: data.user.locationId,
          isAdmin: data.user.isAdmin
        };
        
        saveUserToLocalStorage(userData, data.token);
        setUser(userData);
        console.log('SSO login successful');
        return true;
      }
      
      console.error('SSO login failed:', data.error);
      return false;
    } catch (error) {
      console.error('SSO login error:', error);
      return false;
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const ssoParam = urlParams.get('sso');
      const locationId = urlParams.get('locationId');
      const userId = urlParams.get('userId');

      if (ssoParam === 'true' && locationId && userId) {
        console.log('SSO login detected, authenticating...');
        const success = await ssoLogin(locationId, userId);
        if (success) {
          urlParams.delete('sso');
          urlParams.delete('locationId');
          urlParams.delete('userId');
          const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
          window.history.replaceState({}, '', newUrl);
        }
        setIsLoading(false);
        return;
      }

      const token = localStorage.getItem('authToken');
      if (token) {
        await verifyToken(token);
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email: string): Promise<boolean> => {
    try {
      console.log('Attempting login with:', email);
      const response = await fetch(`${API_URL}/api/auth/email-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      
      if (data.success && data.token) {
        const nameParts = (data.user.userName || 'User').split(' ');
        const firstName = nameParts[0] || 'User';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        const userData: User = {
          userId: data.user.userId,
          userEmail: data.user.userEmail,
          userName: data.user.userName,
          firstName: firstName,
          lastName: lastName,
          userType: data.user.userType,
          locationId: data.user.locationId,
          isAdmin: data.user.isAdmin
        };
        
        saveUserToLocalStorage(userData, data.token);
        setUser(userData);
        console.log('Login successful, redirecting to dashboard');
        return true;
      }
      
      console.error('Login failed:', data.error);
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    clearLocalStorage();
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    ssoLogin,
    getUserId,
    getLocationId
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = '/login';
    return null;
  }

  return <>{children}</>;
};

export default AuthProvider;