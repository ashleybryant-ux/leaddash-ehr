import React from 'react';
import { useSearchParams } from 'react-router-dom';

// Reason messages mapping
const REASON_MESSAGES: Record<string, { title: string; message: string }> = {
  missing_params: {
    title: 'Invalid Access Link',
    message: 'The access link is missing required information. Please use the LeadDash EHR link from your GoHighLevel menu.',
  },
  not_authorized: {
    title: 'Account Not Activated',
    message: 'Your LeadDash EHR account has not been activated yet. Please contact your administrator or LeadDash support.',
  },
  location_suspended: {
    title: 'Access Suspended',
    message: 'Access to LeadDash EHR has been suspended for this location. Please contact LeadDash support for assistance.',
  },
  no_session: {
    title: 'Session Not Found',
    message: 'No active session was found. Please access LeadDash EHR through your GoHighLevel dashboard.',
  },
  invalid_session: {
    title: 'Session Expired',
    message: 'Your session has expired. Please return to GoHighLevel and click the LeadDash EHR menu link again.',
  },
  not_authenticated: {
    title: 'Authentication Required',
    message: 'You must be logged in to access this page. Please access LeadDash EHR through your GoHighLevel dashboard.',
  },
  logged_out: {
    title: 'Logged Out',
    message: 'You have been logged out. To continue using LeadDash EHR, please return to GoHighLevel and click the LeadDash EHR menu link.',
  },
  insufficient_permissions: {
    title: 'Permission Denied',
    message: 'You do not have permission to access this feature. Please contact your administrator if you believe this is an error.',
  },
  invalid_domain: {
    title: 'Access Not Allowed',
    message: 'LeadDash EHR can only be accessed through the LeadDash platform. Please contact LeadDash support if you need access.',
  },
  default: {
    title: 'Access Denied',
    message: 'You do not have permission to access LeadDash EHR. Please contact support if you believe this is an error.',
  },
};

const AccessDenied: React.FC = () => {
  const [searchParams] = useSearchParams();
  const reason = searchParams.get('reason') || 'default';
  
  const { title, message } = REASON_MESSAGES[reason] || REASON_MESSAGES.default;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8f9fa',
      padding: '20px',
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        padding: '40px',
        textAlign: 'center',
      }}>
        {/* Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          backgroundColor: '#fee2e2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <svg 
            width="40" 
            height="40" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="#dc2626" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: '24px',
          fontWeight: '600',
          color: '#1f2937',
          marginBottom: '12px',
        }}>
          {title}
        </h1>

        {/* Message */}
        <p style={{
          fontSize: '16px',
          color: '#6b7280',
          lineHeight: '1.6',
          marginBottom: '32px',
        }}>
          {message}
        </p>

        {/* Help Section */}
        <div style={{
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'left',
        }}>
          <h3 style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '12px',
          }}>
            How to Access LeadDash EHR:
          </h3>
          <ol style={{
            fontSize: '14px',
            color: '#6b7280',
            paddingLeft: '20px',
            margin: '0',
            lineHeight: '1.8',
          }}>
            <li>Log in to your LeadDash account at <strong>app.leaddash.io</strong></li>
            <li>Navigate to the sidebar menu</li>
            <li>Click on <strong>"LeadDash EHR"</strong></li>
          </ol>
        </div>

        {/* Support Contact */}
        <div style={{
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '1px solid #e5e7eb',
        }}>
          <p style={{
            fontSize: '14px',
            color: '#9ca3af',
          }}>
            Need help? Contact us at{' '}
            <a 
              href="mailto:support@leaddash.io" 
              style={{ color: '#2563eb', textDecoration: 'none' }}
            >
              support@leaddash.io
            </a>
          </p>
        </div>

        {/* Branding */}
        <div style={{
          marginTop: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}>
          <svg 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="#2563eb"
          >
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
            <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
          </svg>
          <span style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#2563eb',
          }}>
            LeadDash EHR
          </span>
        </div>
      </div>
    </div>
  );
};

export default AccessDenied;