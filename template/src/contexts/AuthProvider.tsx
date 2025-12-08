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
  isInIframe: boolean;
  isAccessDenied: boolean;
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

// Check if running inside an iframe
const checkIsInIframe = (): boolean => {
  try {
    return window.self !== window.top;
  } catch (e) {
    // If we can't access window.top due to cross-origin, we're in an iframe
    return true;
  }
};

// Check if the parent is from GHL/LeadDash domain
const checkIsFromGHL = (): boolean => {
  try {
    const referrer = document.referrer.toLowerCase();
    const validReferrers = [
      'gohighlevel.com',
      'highlevel.com', 
      'leadconnectorhq.com',
      'app.leaddash.io',
      'leaddash.io'
    ];
    return validReferrers.some(domain => referrer.includes(domain));
  } catch (e) {
    return false;
  }
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [isInIframe] = useState<boolean>(checkIsInIframe());
  const [isFromGHL] = useState<boolean>(checkIsFromGHL());
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

  const logout = () => {
    console.log('Logging out...');
    clearLocalStorage();
    setUser(null);
    setIsAccessDenied(true);
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
        isInIframe,
        isFromGHL,
        currentPath: window.location.pathname 
      });

      // BLOCK: Not in iframe and not from GHL - deny access completely
      if (!isInIframe && !isFromGHL) {
        console.log('ACCESS DENIED: Direct browser access not allowed. Must access through LeadDash.');
        clearLocalStorage();
        setIsAccessDenied(true);
        setIsLoading(false);
        return;
      }

      // In iframe or from GHL - check for SSO params
      if (ssoParam === 'true' && locationId && userId) {
        console.log('SSO in iframe detected - auto-authenticating...');
        clearLocalStorage();
        
        const success = await ssoLogin(locationId, userId);
        
        if (success) {
          // Clean URL after successful SSO
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
          console.log('SSO complete, navigating to dashboard');
          navigate('/dashboard');
        } else {
          console.error('SSO login failed');
          setIsAccessDenied(true);
        }
        
        setIsLoading(false);
        return;
      }

      // In iframe but no SSO params - check localStorage for existing session
      const userId_stored = localStorage.getItem('userId');
      const authToken = localStorage.getItem('authToken');
      
      if (userId_stored && authToken) {
        const existingUser: User = {
          userId: userId_stored,
          userEmail: localStorage.getItem('userEmail') || '',
          userName: localStorage.getItem('userName') || 'User',
          firstName: (localStorage.getItem('userName') || 'User').split(' ')[0],
          lastName: (localStorage.getItem('userName') || '').split(' ').slice(1).join(' '),
          userType: localStorage.getItem('userType') || 'user',
          locationId: localStorage.getItem('locationId') || '',
          isAdmin: localStorage.getItem('isAdmin') === 'true'
        };
        console.log('Found existing auth in iframe:', existingUser.userName);
        setUser(existingUser);
        setIsLoading(false);
        return;
      }

      // In iframe but no auth - deny access
      console.log('In iframe but no valid SSO params or session');
      setIsAccessDenied(true);
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    isInIframe,
    isAccessDenied,
    logout,
    ssoLogin,
    getUserId,
    getLocationId
  };

  // Show access denied screen if not accessed through GHL
  if (isAccessDenied) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#f8f9fa',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '48px',
          borderRadius: '12px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
          maxWidth: '480px'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🔒</div>
          <h1 style={{ 
            color: '#155F3C', 
            fontSize: '28px', 
            marginBottom: '16px',
            fontWeight: '600'
          }}>
            Access Restricted
          </h1>
          <p style={{ 
            color: '#666', 
            fontSize: '16px', 
            lineHeight: '1.6',
            marginBottom: '24px'
          }}>
            LeadDash Health must be accessed through your LeadDash account for HIPAA compliance.
          </p>
          <p style={{ 
            color: '#888', 
            fontSize: '14px',
            lineHeight: '1.5'
          }}>
            Please log in to <strong>app.leaddash.io</strong> and access the Health EMR from the menu.
          </p>
        </div>
        <p style={{ 
          color: '#aaa', 
          fontSize: '12px', 
          marginTop: '32px' 
        }}>
          © 2025 LeadDash Health | HIPAA Compliant
        </p>
      </div>
    );
  }

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
  const { isAuthenticated, isLoading, isAccessDenied } = useAuth();

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (isAccessDenied || !isAuthenticated) {
    return null; // Access denied screen is shown by AuthProvider
  }

  return <>{children}</>;
};

export default AuthProvider;