import { Link } from "react-router-dom";
import CommonFooter from "../../components/common-footer/commonFooter";
import { all_routes } from "../../routes/all_routes";
import { useEffect, useState, useRef } from "react";
import axios from 'axios';
import config from '../../config';
import { logAudit } from '../../services/auditService';

const API_URL = config.apiUrl;
const LOCATION_ID = config.ghlLocationId;

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  tags?: string[];
  dateAdded?: string;
  lastUpdated?: string;
}

const AllPatientsList = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [lastSync, setLastSync] = useState<string | null>(null);
  
  // Access control
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  
  // Audit: Track if we've logged the initial view
  const hasLoggedView = useRef(false);

  useEffect(() => {
    checkUserAccess();
  }, []);

  useEffect(() => {
    if (hasAccess) {
      // Auto-sync on component mount
      fetchPatientsFromGHL();

      // Auto-sync every 30 seconds for real-time updates
      const interval = setInterval(() => {
        fetchPatientsFromGHL(true); // Silent sync (no loading spinner)
      }, 30000); // 30 seconds

      return () => clearInterval(interval);
    }
  }, [hasAccess]);

  const checkUserAccess = () => {
    const userType = localStorage.getItem("userType");
    const allowedRoles = ["AGENCY-OWNER", "AGENCY-ADMIN", "ACCOUNT-ADMIN"];
    
    if (userType && allowedRoles.includes(userType)) {
      setHasAccess(true);
    } else {
      setHasAccess(false);
    }
    setCheckingAccess(false);
  };

  const fetchPatientsFromGHL = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    
    try {
      console.log('👥 Fetching real-time patients from GHL...');
      
      // Always sync=true to get fresh data from GHL
      const response = await axios.get(`${API_URL}/api/patients`, {
        params: { 
          locationId: LOCATION_ID, 
          limit: 1000,
          sync: 'true' // Always fetch fresh data
        }
      });

      if (response.data.success) {
        const patientList = response.data.patients || [];
        setPatients(patientList);
        setLastSync(new Date().toISOString());
        
        if (!silent) {
          console.log(`✅ Loaded ${patientList.length} patients with "patient" tag`);
          
          // Audit: Log viewing patient list (only on initial load, not silent syncs)
          if (!hasLoggedView.current) {
            hasLoggedView.current = true;
            logAudit({
              action: 'VIEW',
              resourceType: 'patient',
              resourceId: 'patient_list',
              description: `Viewed patient list (${patientList.length} patients)`,
              metadata: {
                patientCount: patientList.length,
                viewType: 'list'
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('❌ Error fetching patients:', error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const handleManualSync = () => {
    fetchPatientsFromGHL(false);
  };

  const handleDelete = async (patientId: string) => {
    // Find patient info before deleting for audit log
    const patientToDelete = patients.find(p => p.id === patientId);
    const patientName = patientToDelete 
      ? `${patientToDelete.firstName} ${patientToDelete.lastName}`.trim()
      : 'Unknown';
    
    if (!window.confirm(`Are you sure you want to delete patient ${patientName}?`)) {
      return;
    }

    try {
      console.log('🗑️ Deleting patient:', patientId);
      
      await axios.delete(`${API_URL}/api/patients/${patientId}`, {
        params: { locationId: LOCATION_ID }
      });

      console.log('✅ Patient deleted');
      setPatients(prev => prev.filter(p => p.id !== patientId));
      
      // Audit: Log patient deletion
      logAudit({
        action: 'DELETE',
        resourceType: 'patient',
        resourceId: patientId,
        patientId: patientId,
        patientName: patientName,
        description: `Deleted patient ${patientName}`,
        metadata: {
          patientEmail: patientToDelete?.email,
          patientPhone: patientToDelete?.phone
        }
      });
      
      alert('Patient deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting patient:', error);
      alert('Failed to delete patient');
    }
  };

  const sortedPatients = [...patients].sort((a, b) => {
    const dateA = new Date(a.dateAdded || a.lastUpdated || 0).getTime();
    const dateB = new Date(b.dateAdded || b.lastUpdated || 0).getTime();
    
    if (sortOrder === 'newest') {
      return dateB - dateA;
    } else {
      return dateA - dateB;
    }
  });

  const getRandomAvatar = () => {
    const avatars = [
      "assets/img/avatars/avatar-31.jpg",
      "assets/img/avatars/avatar-41.jpg",
      "assets/img/avatars/avatar-42.jpg",
      "assets/img/avatars/avatar-45.jpg",
      "assets/img/avatars/avatar-48.jpg",
      "assets/img/avatars/avatar-50.jpg",
      "assets/img/avatars/avatar-51.jpg",
      "assets/img/avatars/avatar-53.jpg",
      "assets/img/avatars/avatar-54.jpg",
      "assets/img/avatars/avatar-56.jpg",
    ];
    return avatars[Math.floor(Math.random() * avatars.length)];
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  };

  const formatLastSync = (syncTime: string | null) => {
    if (!syncTime) return 'Never';
    const date = new Date(syncTime);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 10) return 'Just now';
    if (diffSecs < 60) return `${diffSecs}s ago`;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Show loading while checking access
  if (checkingAccess) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show access denied message
  if (!hasAccess) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="card">
            <div className="card-body text-center py-5">
              <i className="ti ti-lock fs-48 text-muted mb-3 d-block"></i>
              <h4>Access Restricted</h4>
              <p className="text-muted mb-4">
                You don't have permission to view the full patient list.<br />
                This feature is only available to administrators.
              </p>
              <Link to={all_routes.dashboard} className="btn btn-primary">
                <i className="ti ti-arrow-left me-1"></i>
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>
    );
  }

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-flex align-items-center justify-content-between gap-2 mb-4 flex-wrap">
            <div className="breadcrumb-arrow">
              <h4 className="mb-1">Patients</h4>
              <div className="text-end">
                <ol className="breadcrumb m-0 py-0">
                  <li className="breadcrumb-item">
                    <Link to={all_routes.dashboard}>Home</Link>
                  </li>
                  <li className="breadcrumb-item active">Patients</li>
                </ol>
              </div>
            </div>
            <div className="gap-2 d-flex align-items-center flex-wrap">
              <Link
                to={all_routes.patients}
                className="btn btn-icon btn-white"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                aria-label="Grid"
                data-bs-original-title="Grid View"
              >
                <i className="ti ti-layout-grid" />
              </Link>
              <Link
                to={all_routes.allPatientsList}
                className="btn btn-icon btn-white active"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                aria-label="List"
                data-bs-original-title="List View"
              >
                <i className="ti ti-layout-list" />
              </Link>
              <button
                onClick={handleManualSync}
                className="btn btn-icon btn-white"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                aria-label="Refresh"
                data-bs-original-title="Sync Now"
                disabled={loading}
              >
                <i className={`ti ti-refresh ${loading ? 'spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Real-time Connection Status */}
          <div className="alert alert-success mb-3 d-flex align-items-center justify-content-between">
            <div>
              <i className="ti ti-refresh me-2 spin" />
              Real-time sync enabled - Auto-updating every 30s
            </div>
            <small className="text-muted">
              Last sync: {formatLastSync(lastSync)}
            </small>
          </div>

          {/* card start */}
          <div className="card mb-0">
            <div className="card-header d-flex align-items-center flex-wrap gap-2 justify-content-between">
              <h5 className="d-inline-flex align-items-center mb-0">
                Patients
                <span className="badge bg-primary ms-2">
                  {loading ? '...' : patients.length}
                </span>
              </h5>
              <div className="d-flex align-items-center">
                <div className="dropdown">
                  <Link
                    to="#"
                    className="dropdown-toggle btn btn-md btn-outline-light d-inline-flex align-items-center"
                    data-bs-toggle="dropdown"
                    aria-label="Patient sorting menu"
                    aria-haspopup="true"
                    aria-expanded="false"
                  >
                    <i className="ti ti-sort-descending-2 me-1" />
                    <span className="me-1">Sort By : </span>{" "}
                    {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
                  </Link>
                  <ul className="dropdown-menu dropdown-menu-end p-2">
                    <li>
                      <Link
                        to="#"
                        className="dropdown-item rounded-1"
                        onClick={() => setSortOrder('newest')}
                      >
                        Newest
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="#"
                        className="dropdown-item rounded-1"
                        onClick={() => setSortOrder('oldest')}
                      >
                        Oldest
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="card-body">
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2">Syncing patients from GHL...</p>
                </div>
              ) : patients.length === 0 ? (
                <div className="text-center py-5">
                  <i className="ti ti-users-off fs-48 text-muted mb-3 d-block" />
                  <h5>No Patients Found</h5>
                  <p className="text-muted">
                    No contacts found with "patient" tag in GHL
                  </p>
                  <button 
                    onClick={handleManualSync}
                    className="btn btn-primary mt-2"
                  >
                    <i className="ti ti-refresh me-1" />
                    Sync Now
                  </button>
                </div>
              ) : (
                <div className="table-responsive table-nowrap">
                  <table className="table mb-0 border">
                    <thead className="table-light">
                      <tr>
                        <th>Patient ID</th>
                        <th>Patient Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Gender</th>
                        <th>Date Added</th>
                        <th className="no-sort" />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPatients.map((patient) => (
                        <tr key={patient.id}>
                          <td>#{patient.id.substring(0, 8)}</td>
                          <td>
                            <div className="d-flex align-items-center">
                              <Link
                                to={`${all_routes.patientDetails}/${patient.id}`}
                                className="avatar avatar-xs me-2"
                              >
                                <img
                                  src={getRandomAvatar()}
                                  alt={`${patient.firstName} ${patient.lastName}`}
                                  className="rounded"
                                />
                              </Link>
                              <div>
                                <h6 className="fs-14 mb-0 fw-medium">
                                  <Link to={`${all_routes.patientDetails}/${patient.id}`}>
                                    {patient.firstName} {patient.lastName}
                                  </Link>
                                </h6>
                              </div>
                            </div>
                          </td>
                          <td>
                            {patient.email ? (
                              <a href={`mailto:${patient.email}`} className="text-primary">
                                {patient.email}
                              </a>
                            ) : (
                              <span className="text-muted">N/A</span>
                            )}
                          </td>
                          <td>
                            {patient.phone ? (
                              <a href={`tel:${patient.phone}`} className="text-primary">
                                {patient.phone}
                              </a>
                            ) : (
                              <span className="text-muted">N/A</span>
                            )}
                          </td>
                          <td>{patient.gender || 'N/A'}</td>
                          <td>{formatDate(patient.dateAdded || patient.lastUpdated)}</td>
                          <td className="text-end">
                            <Link
                              to="#"
                              className="btn btn-icon btn-outline-light"
                              data-bs-toggle="dropdown"
                              aria-label="more options"
                            >
                              <i className="ti ti-dots-vertical" aria-hidden="true" />
                            </Link>
                            <ul className="dropdown-menu dropdown-menu-end p-2">
                              <li>
                                <Link
                                  to={`${all_routes.patientDetails}/${patient.id}`}
                                  className="dropdown-item d-flex align-items-center"
                                >
                                  <i className="ti ti-eye me-1" />
                                  View Details
                                </Link>
                              </li>
                              <li>
                                <Link
                                  to={all_routes.editPatient}
                                  className="dropdown-item d-flex align-items-centers"
                                >
                                  <i className="ti ti-edit me-1" />
                                  Edit
                                </Link>
                              </li>
                              <li>
                                <button
                                  onClick={() => handleDelete(patient.id)}
                                  className="dropdown-item d-flex align-items-center btn btn-link text-start p-0 w-100 border-0 bg-transparent"
                                  style={{ textDecoration: 'none' }}
                                >
                                  <i className="ti ti-trash me-1" />
                                  Delete
                                </button>
                              </li>
                            </ul>
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
        <CommonFooter />
      </div>

      <style>{`
        .spin {
          animation: spin 2s linear infinite;
        }
        
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
};

export default AllPatientsList;