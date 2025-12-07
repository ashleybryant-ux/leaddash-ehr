import { Link } from "react-router-dom";
import CommonFooter from "../../components/common-footer/commonFooter";
import { useEffect, useState } from "react";
import { all_routes } from "../../routes/all_routes";
import axios from 'axios';
import config from '../../config';

const API_URL = config.apiUrl;

interface LocationStats {
  activeUsers: number;
  patientsCount: number;
  appointmentsCount: number;
  notesCount: number;
  basePrice: number;
  perUserPrice: number;
  additionalUsers: number;
  totalCharge: number;
}

interface UserActivity {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  isAdmin: boolean;
  lastAccess: string;
  accessCount: number;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<LocationStats>({
    activeUsers: 0,
    patientsCount: 0,
    appointmentsCount: 0,
    notesCount: 0,
    basePrice: 297,
    perUserPrice: 40,
    additionalUsers: 0,
    totalCharge: 297
  });
  
  const [users, setUsers] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationId, setLocationId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const locId = params.get('locationId');
    
    if (locId) {
      setLocationId(locId);
      fetchAdminData(locId);
    }
  }, []);

  const fetchAdminData = async (locId: string) => {
    setLoading(true);
    try {
      console.log('📊 Fetching admin dashboard data...');

      const currentMonth = new Date().toISOString().substring(0, 7);

      const [billingRes, patientsRes, appointmentsRes] = await Promise.all([
        axios.get(`${API_URL}/api/billing/active-users`, {
          params: { locationId: locId, month: currentMonth }
        }).catch(err => {
          console.error('Error fetching billing:', err);
          return { data: { activeUsers: 0, users: [] } };
        }),
        axios.get(`${API_URL}/api/patients`, {
          params: { locationId: locId, limit: 1000 }
        }).catch(err => {
          console.error('Error fetching patients:', err);
          return { data: { patients: [] } };
        }),
        axios.get(`${API_URL}/api/appointments`, {
          params: { locationId: locId, limit: 1000 }
        }).catch(err => {
          console.error('Error fetching appointments:', err);
          return { data: { appointments: [] } };
        })
      ]);

      const activeUsers = billingRes.data.activeUsers || 0;
      const additionalUsers = Math.max(0, activeUsers - 1);
      const totalCharge = 297 + (additionalUsers * 40);

      setStats({
        activeUsers,
        patientsCount: patientsRes.data.patients?.length || 0,
        appointmentsCount: appointmentsRes.data.appointments?.length || 0,
        notesCount: 0,
        basePrice: 297,
        perUserPrice: 40,
        additionalUsers,
        totalCharge
      });

      setUsers(billingRes.data.users || []);

      console.log('✅ Admin data loaded:', {
        activeUsers,
        totalCharge,
        patients: patientsRes.data.patients?.length
      });

    } catch (error) {
      console.error('❌ Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <div className="page-wrapper" id="main-content">
        <div className="content">
          <div className="d-flex align-items-center justify-content-between gap-2 mb-4 flex-wrap">
            <div className="breadcrumb-arrow">
              <h4 className="mb-1">
                <i className="ti ti-shield-check text-primary me-2"></i>
                Admin Dashboard
              </h4>
              <p className="mb-0 text-muted">
                Location management and billing overview
              </p>
            </div>
            <div className="d-flex gap-2 align-items-center">
              <button 
                onClick={() => locationId && fetchAdminData(locationId)}
                className="btn btn-icon btn-white"
                disabled={loading}
              >
                <i className={`ti ti-refresh ${loading ? 'spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="alert alert-info mb-4 d-flex align-items-center justify-content-between">
            <div>
              <i className="ti ti-crown me-2" />
              You have administrator access for this location
            </div>
            <small className="text-muted">Full management privileges</small>
          </div>

          <div className="card mb-4 shadow-sm border-primary">
            <div className="card-header bg-primary text-white">
              <div className="d-flex align-items-center justify-content-between">
                <h5 className="mb-0">
                  <i className="ti ti-credit-card me-2"></i>
                  Current Billing Cycle
                </h5>
                <span className="badge bg-white text-primary">
                  {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-3">
                  <div className="border-end pe-3">
                    <p className="text-muted mb-1">Base Subscription</p>
                    <h4 className="mb-0">${stats.basePrice}/mo</h4>
                    <small className="text-success">Includes 1 user</small>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="border-end pe-3">
                    <p className="text-muted mb-1">Active Users</p>
                    <h4 className="mb-0">{loading ? '...' : stats.activeUsers}</h4>
                    <small className="text-muted">This billing period</small>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="border-end pe-3">
                    <p className="text-muted mb-1">Additional Users</p>
                    <h4 className="mb-0">{loading ? '...' : stats.additionalUsers}</h4>
                    <small className="text-muted">{stats.additionalUsers} × ${stats.perUserPrice}/mo</small>
                  </div>
                </div>
                <div className="col-md-3">
                  <div>
                    <p className="text-muted mb-1">Total This Month</p>
                    <h3 className="mb-0 text-primary">${loading ? '...' : stats.totalCharge}</h3>
                    <small className="text-success">
                      <i className="ti ti-check me-1"></i>
                      Current
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row mb-4">
            <div className="col-xl-3 col-md-6 d-flex">
              <div className="card flex-fill">
                <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                      <span className="avatar bg-primary rounded-circle">
                        <i className="ti ti-users fs-20" />
                      </span>
                      <div className="ms-3">
                        <p className="mb-1 text-muted">Total Patients</p>
                        <h5 className="mb-0">{loading ? '...' : stats.patientsCount}</h5>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-xl-3 col-md-6 d-flex">
              <div className="card flex-fill">
                <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                      <span className="avatar bg-orange rounded-circle">
                        <i className="ti ti-calendar-check fs-20" />
                      </span>
                      <div className="ms-3">
                        <p className="mb-1 text-muted">Appointments</p>
                        <h5 className="mb-0">{loading ? '...' : stats.appointmentsCount}</h5>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-xl-3 col-md-6 d-flex">
              <div className="card flex-fill">
                <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                      <span className="avatar bg-purple rounded-circle">
                        <i className="ti ti-user-check fs-20" />
                      </span>
                      <div className="ms-3">
                        <p className="mb-1 text-muted">Active Staff</p>
                        <h5 className="mb-0">{loading ? '...' : stats.activeUsers}</h5>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-xl-3 col-md-6 d-flex">
              <div className="card flex-fill">
                <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                      <span className="avatar bg-success rounded-circle">
                        <i className="ti ti-file-text fs-20" />
                      </span>
                      <div className="ms-3">
                        <p className="mb-1 text-muted">Clinical Notes</p>
                        <h5 className="mb-0">{loading ? '...' : stats.notesCount}</h5>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-12">
              <div className="card">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h5 className="mb-0">
                    <i className="ti ti-users me-2"></i>
                    User Activity & Management
                  </h5>
                  <Link to={all_routes.staff} className="btn btn-sm btn-primary">
                    <i className="ti ti-user-plus me-1"></i>
                    Manage Users
                  </Link>
                </div>
                <div className="card-body">
                  {loading ? (
                    <div className="text-center py-4">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </div>
                  ) : users.length === 0 ? (
                    <div className="text-center py-4">
                      <i className="ti ti-users-off fs-48 text-muted mb-3"></i>
                      <p className="text-muted">No active users this billing period</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover">
                        <thead>
                          <tr>
                            <th>User</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Last Access</th>
                            <th>Access Count</th>
                            <th className="text-end">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((user) => (
                            <tr key={user.userId}>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="avatar avatar-sm bg-soft-primary rounded-circle me-2">
                                    <span className="text-primary fw-bold">
                                      {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                                    </span>
                                  </div>
                                  <div>
                                    <h6 className="mb-0">{user.firstName} {user.lastName}</h6>
                                  </div>
                                </div>
                              </td>
                              <td>{user.email}</td>
                              <td>
                                {user.isAdmin ? (
                                  <span className="badge bg-danger">
                                    <i className="ti ti-crown me-1"></i>
                                    Admin
                                  </span>
                                ) : (
                                  <span className="badge bg-info">
                                    <i className="ti ti-user me-1"></i>
                                    User
                                  </span>
                                )}
                              </td>
                              <td>
                                <small className="text-muted">{formatDate(user.lastAccess)}</small>
                              </td>
                              <td>
                                <span className="badge badge-soft-success">
                                  {user.accessCount} times
                                </span>
                              </td>
                              <td className="text-end">
                                <Link 
                                  to={all_routes.staff} 
                                  className="btn btn-sm btn-outline-primary"
                                >
                                  <i className="ti ti-eye"></i>
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="row mt-4">
            <div className="col-12">
              <h5 className="mb-3">Administrator Tools</h5>
            </div>
            <div className="col-xl-2 col-md-4 col-sm-6">
              <Link to={all_routes.allPatientsList} className="card">
                <div className="card-body text-center">
                  <span className="badge-soft-primary rounded w-100 d-flex p-3 justify-content-center fs-32 mb-2">
                    <i className="ti ti-users" />
                  </span>
                  <h6 className="fs-14 fw-semibold mb-0">All Patients</h6>
                  <p className="text-muted mb-0">{stats.patientsCount}</p>
                </div>
              </Link>
            </div>

            <div className="col-xl-2 col-md-4 col-sm-6">
              <Link to={all_routes.staff} className="card">
                <div className="card-body text-center">
                  <span className="badge-soft-success rounded w-100 d-flex p-3 justify-content-center fs-32 mb-2">
                    <i className="ti ti-user-cog" />
                  </span>
                  <h6 className="fs-14 fw-semibold mb-0">Manage Staff</h6>
                  <p className="text-muted mb-0">{stats.activeUsers} active</p>
                </div>
              </Link>
            </div>

            <div className="col-xl-2 col-md-4 col-sm-6">
              <Link to={all_routes.appointments} className="card">
                <div className="card-body text-center">
                  <span className="badge-soft-warning rounded w-100 d-flex p-3 justify-content-center fs-32 mb-2">
                    <i className="ti ti-calendar" />
                  </span>
                  <h6 className="fs-14 fw-semibold mb-0">Appointments</h6>
                  <p className="text-muted mb-0">{stats.appointmentsCount}</p>
                </div>
              </Link>
            </div>

            <div className="col-xl-2 col-md-4 col-sm-6">
              <Link to={all_routes.manageInvoices} className="card">
                <div className="card-body text-center">
                  <span className="badge-soft-danger rounded w-100 d-flex p-3 justify-content-center fs-32 mb-2">
                    <i className="ti ti-file-invoice" />
                  </span>
                  <h6 className="fs-14 fw-semibold mb-0">Billing</h6>
                  <p className="text-muted mb-0">Invoices</p>
                </div>
              </Link>
            </div>

            <div className="col-xl-2 col-md-4 col-sm-6">
              <Link to={all_routes.generalSettings} className="card">
                <div className="card-body text-center">
                  <span className="badge-soft-purple rounded w-100 d-flex p-3 justify-content-center fs-32 mb-2">
                    <i className="ti ti-settings" />
                  </span>
                  <h6 className="fs-14 fw-semibold mb-0">Settings</h6>
                  <p className="text-muted mb-0">Configure</p>
                </div>
              </Link>
            </div>

            <div className="col-xl-2 col-md-4 col-sm-6">
              <Link to={all_routes.claimsList} className="card">
                <div className="card-body text-center">
                  <span className="badge-soft-teal rounded w-100 d-flex p-3 justify-content-center fs-32 mb-2">
                    <i className="ti ti-file-check" />
                  </span>
                  <h6 className="fs-14 fw-semibold mb-0">Claims</h6>
                  <p className="text-muted mb-0">Insurance</p>
                </div>
              </Link>
            </div>
          </div>
        </div>

        <CommonFooter/>
      </div>

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default AdminDashboard;