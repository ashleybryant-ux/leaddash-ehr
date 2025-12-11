import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthProvider';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const OAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Authenticating...');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const sid = searchParams.get('sid');
      
      if (!sid) {
        setError('No session ID provided');
        setTimeout(() => navigate('/login'), 2000);
        return;
      }

      setStatus('Validating session...');

      try {
        // Call backend to get session data
        const response = await fetch(`${API_URL}/auth/session?sid=${encodeURIComponent(sid)}`);
        const data = await response.json();

        if (!response.ok || !data.ok) {
          setError(data.error || 'Session validation failed');
          setTimeout(() => navigate('/login'), 2000);
          return;
        }

        setStatus('Session valid, setting up authentication...');

        // Extract user data from session
        const { session } = data;
        const { user, ghlAccessToken } = session;

        // Store auth data in localStorage (matching AuthProvider format)
        const nameParts = (user.name || 'User').split(' ');
        const firstName = nameParts[0] || 'User';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Determine if user is admin
        const isAdmin = user.roles?.type === 'agency' && user.roles?.role === 'admin';

        // Store in localStorage
        localStorage.setItem('authToken', ghlAccessToken);
        localStorage.setItem('userName', user.name || 'User');
        localStorage.setItem('userId', user.id);
        localStorage.setItem('locationId', user.roles?.locationIds?.[0] || '');
        localStorage.setItem('userEmail', user.email || '');
        localStorage.setItem('userType', user.roles?.type || 'user');
        localStorage.setItem('isAdmin', String(isAdmin));

        setStatus('Authentication complete! Redirecting...');

        // Navigate to dashboard
        setTimeout(() => {
          window.location.href = '/index';
        }, 500);

      } catch (err) {
        console.error('OAuth callback error:', err);
        setError('Failed to validate session');
        setTimeout(() => navigate('/login'), 2000);
      }
    };

    handleOAuthCallback();
  }, [searchParams, navigate]);

  return (
    <div className="d-flex flex-column justify-content-center align-items-center" style={{ height: '100vh' }}>
      {error ? (
        <>
          <div className="alert alert-danger" role="alert">
            <i className="ti ti-alert-circle me-2"></i>
            {error}
          </div>
          <p className="text-muted">Redirecting to login...</p>
        </>
      ) : (
        <>
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">{status}</p>
        </>
      )}
    </div>
  );
};

export default OAuthCallback;
