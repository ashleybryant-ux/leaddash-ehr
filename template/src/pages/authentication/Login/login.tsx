import { useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthProvider';

const Login = () => {
  const { isAccessDenied, isInIframe } = useAuth();

  useEffect(() => {
    // If somehow they reach this page, the AuthProvider will handle showing
    // the Access Restricted screen for non-iframe access
    console.log('Login page loaded - access should be handled by AuthProvider');
  }, []);

  // This page should never really be seen since AuthProvider blocks non-iframe access
  // But just in case, show a simple message
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
};

export default Login;