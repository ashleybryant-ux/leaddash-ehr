import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import config from '../config';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: string;
  type: string;
  initials: string;
  locationId: string;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  iframeLogin: (locationId: string, userId: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  getUserId: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem('auth_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      console.log('🔐 Attempting login for:', email);
      
      const response = await axios.post(`${config.apiUrl}/api/auth/login`, {
        email,
        password
      });

      if (response.data.success && response.data.user) {
        const userData = response.data.user;
        
        // Store user data
        setUser(userData);
        localStorage.setItem('auth_user', JSON.stringify(userData));
        localStorage.setItem('auth_token', response.data.token || 'demo-token');
        
        // IMPORTANT: Store locationId and userId separately for compatibility
        localStorage.setItem('ghl_location_id', userData.locationId);
        localStorage.setItem('ghl_user_id', userData.id);
        localStorage.setItem('userId', userData.id);
        localStorage.setItem('locationId', userData.locationId);
        
        console.log('✅ Login successful:', userData.email);
        console.log('   User ID:', userData.id);
        console.log('   Location ID:', userData.locationId);
        return true;
      }

      console.log('❌ Login failed: Invalid credentials');
      return false;
    } catch (error) {
      console.error('❌ Login error:', error);
      return false;
    }
  };

  const iframeLogin = async (locationId: string, userId: string): Promise<boolean> => {
    try {
      console.log('🔐 GHL iframe authentication attempt');
      console.log('   Location ID:', locationId);
      console.log('   User ID:', userId);
      
      const response = await axios.post(`${config.apiUrl}/api/auth/iframe`, {
        locationId,
        userId
      });

      if (response.data.success && response.data.user) {
        const userData = {
          ...response.data.user,
          initials: `${response.data.user.firstName?.[0] || ''}${response.data.user.lastName?.[0] || ''}`.toUpperCase()
        };
        
        setUser(userData);
        localStorage.setItem('auth_user', JSON.stringify(userData));
        localStorage.setItem('auth_token', 'iframe-token');
        localStorage.setItem('ghl_location_id', locationId);
        localStorage.setItem('ghl_user_id', userId);
        localStorage.setItem('userId', userId);
        localStorage.setItem('locationId', locationId);
        
        console.log('✅ GHL iframe authentication successful:', userData.email);
        return true;
      }

      console.log('❌ Iframe authentication failed');
      return false;
    } catch (error) {
      console.error('❌ Iframe authentication error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('ghl_location_id');
    localStorage.removeItem('ghl_user_id');
    localStorage.removeItem('userId');
    localStorage.removeItem('locationId');
    console.log('👋 User logged out');
  };

  const getUserId = (): string | null => {
    return user?.id || null;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        iframeLogin,
        logout,
        isAuthenticated: !!user,
        isLoading,
        getUserId
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
