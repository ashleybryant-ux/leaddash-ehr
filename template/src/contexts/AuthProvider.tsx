import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

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

  const loadUserFromLocalStorage = (): User | null => {
    const userId = localStorage.getItem('userId');
    const authToken = localStorage.getItem('authToken');
    
    if (!userId || !authToken) {
      return null;
    }

    return {
      userId: userId,
      userEmail: localStorage.getItem('userEmail') || '',
      userName: localStorage.getItem('userName') || 'User',
      firstName: (localStorage.getItem('userName') || 'User').split(' ')[0],
      lastName: (localStorage.getItem('userName') || '').split(' ').slice(1).join(' '),
      userType: localStorage.getItem('userType') || 'user',
      locationId: localStorage.getItem('locationId') || '',
      isAdmin: localStorage.getItem('isAdmin') === 'true'
    };
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
      console.log('SSO login response:', data);
      
      if (data.success && data.token) {
        const nameParts = (data.user.userName || 'User').split(' ');
        const firstName = nameParts[0] || 'User';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        const userData: User = {
          userId: data.user.userId,
          userEmail: data.user.userEmail || '',
          userName: data.user.userName || 'User',
          firstName: firstName,
          lastName: lastName,
          userType: data.user.userType || 'user',
          locationId: data.user.locationId,
          isAdmin: data.user.isAdmin || false
        };
        
        saveUserToLocalStorage(userData, data.token);
        setUser(userData);
        console.log('SSO login successful:', userData.userName);
        return true;
      }
      
      console.error('SSO login failed:', data.error);
      return false;
    } catch (error) {
      console.error('SSO login error:', error);
      return false;
    }
  };

  const login = async (email: string): Promise<boolean> => {
    try {
      console.log('Email login attempt:', email);
      
      const response = await fetch(`${API_URL}/api/auth/email-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      console.log('Email login response:', data);
      
      if (data.success && data.token) {
        const nameParts = (data.user.userName || 'User').split(' ');
        const firstName = nameParts[0] || 'User';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        const userData: User = {
          userId: data.user.userId,
          userEmail: data.user.userEmail || email,
          userName: data.user.userName || 'User',
          firstName: firstName,
          lastName: lastName,
          userType: data.user.userType || 'user',
          locationId: data.user.locationId,
          isAdmin: data.user.isAdmin || false
        };
        
        saveUserToLocalStorage(userData, data.token);
        setUser(userData);
        console.log('Email login successful:', userData.userName);
        return true;
      }
      
      console.error('Email login failed:', data.error);
      return false;
    } catch (error) {
      console.error('Email login error:', error);
      return false;
    }
  };

  const logout = () => {
    console.log('Logging out...');
    clearLocalStorage();
    setUser(null);
    navigate('/login');
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const ssoParam = urlParams.get('sso');
      const locationId = urlParams.get('locationId');
      const userId = urlParams.get('userId');

      console.log('Auth initialization:', { 
        ssoParam, 
        locationId, 
        userId,
        currentPath: window.location.pathname 
      });

      // SSO params present - ALWAYS do fresh SSO login (clear old data first)
      if (ssoParam === 'true' && locationId && userId) {
        console.log('SSO params detected - clearing old auth and doing fresh login');
        clearLocalStorage();
        
        const success = await ssoLogin(locationId, userId);
        
        if (success) {
          // Clean URL after successful SSO
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
          console.log('SSO complete, navigating to dashboard');
          navigate('/dashboard');
        } else {
          console.error('SSO login failed, redirecting to login page');
          navigate('/login');
        }
        
        setIsLoading(false);
        return;
      }

      // No SSO params - check for existing auth in localStorage
      const existingUser = loadUserFromLocalStorage();
      
      if (existingUser) {
        console.log('Found existing auth:', existingUser.userName);
        setUser(existingUser);
        setIsLoading(false);
        return;
      }

      // No auth at all - redirect to login (unless already on login page)
      console.log('No auth found');
      if (!window.location.pathname.includes('/login')) {
        console.log('Redirecting to login page');
        navigate('/login');
      }
      
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

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

// ProtectedRoute component
interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isLoading, isAuthenticated, navigate]);

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
    return null;
  }

  return <>{children}</>;
};

export default AuthProvider;