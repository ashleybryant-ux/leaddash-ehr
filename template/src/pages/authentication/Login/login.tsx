import { useNavigate } from "react-router-dom";
import { all_routes } from "../../../routes/all_routes";
import { useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      console.log('Attempting login with:', email);
      const success = await login(email);
      
      if (success) {
        console.log('Login successful, redirecting to dashboard');
        navigate(all_routes.dashboard, { replace: true });
      } else {
        setError('Email not found. Please contact your administrator.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '450px',
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '48px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h1 style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#1a1a1a',
              marginBottom: '8px'
            }}>
              LeadDash EHR
            </h1>
            <p style={{
              fontSize: '16px',
              color: '#666'
            }}>
              Enter your email to sign in
            </p>
          </div>

          {error && (
            <div style={{
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '24px',
              color: '#c33'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '8px'
              }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="you@example.com"
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '16px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'border-color 0.3s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                fontWeight: '600',
                color: '#fff',
                background: loading ? '#999' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'transform 0.2s',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
              }}
              onMouseOver={(e) => !loading && (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {loading ? 'Signing In...' : 'Continue'}
            </button>
          </form>

          <div style={{
            marginTop: '24px',
            padding: '16px',
            backgroundColor: '#f0f8ff',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#666',
            textAlign: 'center'
          }}>
            Use the email associated with your LeadDash account.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;