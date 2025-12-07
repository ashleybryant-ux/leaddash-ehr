import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';

const DashboardRouter = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        // First check URL params (for iframe), then localStorage (for normal login)
        const params = new URLSearchParams(window.location.search);
        let userId = params.get('userId');
        let locationId = params.get('locationId');

        // If not in URL, check localStorage
        if (!userId) {
          userId = localStorage.getItem('userId') || localStorage.getItem('ghl_user_id');
        }
        if (!locationId) {
          locationId = localStorage.getItem('locationId') || localStorage.getItem('ghl_location_id');
        }

        console.log('🔐 DashboardRouter checking role:', { userId, locationId });

        if (!userId || !locationId) {
          console.error('❌ Missing userId or locationId');
          setError('Missing authentication parameters');
          setLoading(false);
          return;
        }

        // Call backend to check role
        const response = await axios.post(`${config.apiUrl}/api/auth/check-role`, {
          userId,
          locationId
        });

        console.log('✅ Role check response:', response.data);

        if (response.data.success) {
          if (response.data.isAdmin) {
            console.log('→ Redirecting to Admin Dashboard');
            navigate('/admin-dashboard', { replace: true });
          } else {
            console.log('→ Redirecting to User Dashboard');
            navigate('/user-dashboard', { replace: true });
          }
        } else {
          console.error('❌ Role check failed:', response.data.error);
          setError(response.data.error || 'Authentication failed');
          setLoading(false);
        }
      } catch (error: any) {
        console.error('❌ Error checking user role:', error);
        setError(error.response?.data?.error || error.message || 'Authentication error');
        setLoading(false);
      }
    };

    checkUserRole();
  }, [navigate]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="text-muted">Verifying your access...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        padding: '20px'
      }}>
        <div className="alert alert-danger" style={{ maxWidth: '500px' }}>
          <i className="ti ti-alert-circle me-2"></i>
          <strong>Access Denied</strong>
          <p className="mb-0 mt-2">{error}</p>
          <p className="mb-0 mt-2 text-muted small">Please contact your administrator if this problem persists.</p>
        </div>
      </div>
    );
  }

  return null;
};

export default DashboardRouter;