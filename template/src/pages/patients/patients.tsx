import { Link } from "react-router-dom";
import CommonFooter from "../../components/common-footer/commonFooter";
import { all_routes } from "../../routes/all_routes";
import { useCallback, useState, useEffect, useRef } from "react";
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = config.apiUrl;
const LOCATION_ID = config.ghlLocationId;

const Patients = () => {
  // ============================================
  // AUTH & STATE MANAGEMENT
  // ============================================
  
  const { getUserId, user } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<string | null>(null);
  const hasFetchedRef = useRef(false); // Prevent double-fetch

  // ============================================
  // FETCH PATIENTS FROM GHL (Auto-sync)
  // ============================================
  
  useEffect(() => {
    const userId = getUserId();
    if (userId && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchPatientsFromGHL();

      // Auto-sync every 30 seconds for real-time updates
      const interval = setInterval(() => {
        fetchPatientsFromGHL(true); // Silent sync
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [getUserId]);

  const fetchPatientsFromGHL = async (silent = false) => {
    const userId = getUserId();
    
    if (!userId) {
      console.error('❌ No user ID found - user must be logged in');
      setLoading(false);
      return;
    }

    if (!silent) {
      setLoading(true);
    }

    try {
      console.log('📋 Fetching patients from GHL for user:', userId);
      
      const response = await axios.get(`${API_URL}/api/patients`, {
        params: {
          locationId: LOCATION_ID,
          userId: userId,
          limit: 1000,
          sync: 'true' // Always fetch fresh data from GHL
        }
      });

      if (response.data.success) {
        const patientsData = response.data.patients.sort((a: any, b: any) => {
          const nameA = `${a.firstName || ''} ${a.lastName || ''}`.toLowerCase().trim();
          const nameB = `${b.firstName || ''} ${b.lastName || ''}`.toLowerCase().trim();
          return nameA.localeCompare(nameB);
        });
        
        setPatients(patientsData);
        
        if (!silent) {
          console.log(`✅ Loaded ${patientsData.length} patients assigned to user`);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching patients:', error);
      if (!silent) {
        alert('Failed to load patients from GHL');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // ============================================
  // DELETE PATIENT
  // ============================================
  
  const handleDeletePatient = async () => {
    const userId = getUserId();
    
    if (!userId) {
      alert('You must be logged in to delete patients');
      return;
    }

    if (!patientToDelete) return;

    setDeleteLoading(true);
    try {
      console.log('🗑️ Deleting patient:', patientToDelete);
      
      await axios.delete(`${API_URL}/api/patients/${patientToDelete}`, {
        params: { 
          locationId: LOCATION_ID,
          userId: userId
        }
      });

      console.log('✅ Patient deleted');
      
      setPatients(prev => prev.filter(p => p.id !== patientToDelete));
      
      const modal = document.getElementById('delete_modal');
      if (modal) {
        // @ts-ignore
        const bsModal = window.bootstrap.Modal.getInstance(modal);
        if (bsModal) bsModal.hide();
      }
      
      alert('Patient deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting patient:', error);
      alert('Failed to delete patient');
    } finally {
      setDeleteLoading(false);
      setPatientToDelete(null);
    }
  };

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const getInitials = (firstName: string, lastName: string) => {
    const first = firstName ? firstName[0] : '';
    const last = lastName ? lastName[0] : '';
    return (first + last).toUpperCase();
  };

  const getAvatarColor = (index: number) => {
    const colors = [
      'bg-primary-subtle text-primary',
      'bg-success-subtle text-success',
      'bg-info-subtle text-info',
      'bg-warning-subtle text-warning',
      'bg-danger-subtle text-danger',
      'bg-purple-subtle text-purple'
    ];
    return colors[index % colors.length];
  };

  // Memoized handlers for dropdown actions
  const handleViewDetails = useCallback(() => {}, []);

  return (
<>
  {/* ========================
			Start Page Content
		========================= */}
  <div className="page-wrapper">
    {/* Start Content */}
    <div className="content">
      {/* Page Header */}
      <div className="d-flex align-items-center justify-content-between gap-2 mb-4 flex-wrap">
        <div className="breadcrumb-arrow">
          <h4 className="mb-1">My Patients</h4>
          <div className="text-end">
            <ol className="breadcrumb m-0 py-0">
              <li className="breadcrumb-item">
                <Link to={all_routes.dashboard}>Home</Link>
              </li>
              <li className="breadcrumb-item active">My Patients</li>
            </ol>
          </div>
        </div>
        <div className="gap-2 d-flex align-items-center flex-wrap">
          <Link
            to={all_routes.patients}
            className="btn btn-icon btn-white active"
            data-bs-toggle="tooltip"
            data-bs-placement="top"
            aria-label="Grid"
            data-bs-original-title="Grid View"
          >
            <i className="ti ti-layout-grid" />
          </Link>
          <Link
            to={all_routes.allPatientsList}
            className="btn btn-icon btn-white"
            data-bs-toggle="tooltip"
            data-bs-placement="top"
            aria-label="List"
            data-bs-original-title="List View"
          >
            <i className="ti ti-layout-list" />
          </Link>
          <button
            onClick={() => fetchPatientsFromGHL(false)}
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
      {/* End Page Header */}

      {/* Real-time GHL Status */}
      <div className="alert alert-success mb-3 d-flex align-items-center justify-content-between">
        <div>
          <i className="ti ti-refresh me-2 spin" />
          Real-time sync enabled - Showing patients assigned to {user?.firstName} {user?.lastName}
        </div>
        <small className="text-muted">Auto-updating every 30s</small>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Syncing your patients from GHL...</p>
        </div>
      )}

      {/* No Patients */}
      {!loading && patients.length === 0 && (
        <div className="text-center py-5">
          <i className="ti ti-users-off fs-48 text-muted mb-3 d-block" />
          <h5>No Patients Assigned</h5>
          <p className="text-muted">No contacts are currently assigned to you in GHL</p>
          <button 
            onClick={() => fetchPatientsFromGHL(false)} 
            className="btn btn-primary mt-2"
          >
            <i className="ti ti-refresh me-1" />
            Sync Now
          </button>
        </div>
      )}

      {/* row start */}
      {!loading && patients.length > 0 && (
        <div className="row justify-content-center">
          {patients.map((patient, index) => {
            return (
              <div key={`${patient.id}-${index}`} className="col-xl-4 col-md-6 d-flex">
                <div className="card shadow flex-fill w-100">
                  <div className="card-body">
                    <div className="d-flex align-items-center justify-content-end mb-3">
                      <Link
                        to="#"
                        className="btn btn-icon btn-outline-light border-0"
                        data-bs-toggle="dropdown"
                        aria-label="Patient actions menu"
                        aria-haspopup="true"
                        aria-expanded="false"
                      >
                        <i className="ti ti-dots-vertical" aria-hidden="true" />
                      </Link>
                      <ul className="dropdown-menu p-2">
                        <li>
                          <Link
                            to={`${all_routes.patientDetails}/${patient.id}`}
                            className="dropdown-item d-flex align-items-center"
                            onClick={handleViewDetails}
                          >
                            <i className="ti ti-eye me-1" />
                            View Details
                          </Link>
                        </li>
                        <li>
                          <button
                            className="dropdown-item d-flex align-items-center text-danger"
                            data-bs-toggle="modal"
                            data-bs-target="#delete_modal"
                            onClick={() => setPatientToDelete(patient.id)}
                          >
                            <i className="ti ti-trash me-1" />
                            Delete
                          </button>
                        </li>
                      </ul>
                    </div>
                    <div className="text-center mb-3">
                      <span className={`avatar avatar-xl avatar-rounded d-block mx-auto mb-2 ${getAvatarColor(index)}`}>
                        <Link
                          to={`${all_routes.patientDetails}/${patient.id}`}
                          className="d-inline-flex align-items-center justify-content-center w-100 h-100 fs-20 fw-bold"
                        >
                          {getInitials(patient.firstName, patient.lastName)}
                        </Link>
                      </span>
                      <Link
                        to={`${all_routes.patientDetails}/${patient.id}`}
                        className="d-inline-block mb-1"
                      >
                        #{patient.id.substring(0, 8)}
                      </Link>
                      <h6 className="mb-0">
                        <Link to={`${all_routes.patientDetails}/${patient.id}`}>
                          {patient.firstName} {patient.lastName}
                        </Link>
                      </h6>
                    </div>
                    <div className="border p-1 rounded">
                      <div className="row g-0">
                        <div className="col-4 text-center border-end p-1">
                          <h6 className="fw-semibold fs-14 text-truncate mb-1">
                            Date Added
                          </h6>
                          <p className="fs-13 mb-0">{formatDate(patient.dateAdded || patient.lastUpdated)}</p>
                        </div>
                        <div className="col-4 text-center border-end p-1">
                          <h6 className="fw-semibold fs-14 text-truncate mb-1">
                            Phone
                          </h6>
                          <p className="fs-13 mb-0">{patient.phone || 'N/A'}</p>
                        </div>
                        <div className="col-4 text-center p-1">
                          <h6 className="fw-semibold fs-14 text-truncate mb-1">
                            Location
                          </h6>
                          <p className="fs-13 mb-0">{patient.city || patient.state || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* row end */}
    </div>
    {/* End Content */}
    {/* Start Footer */}
    <CommonFooter />
    {/* End Footer */}
  </div>
  {/* ========================
			End Page Content
		========================= */}
      <>
        {/* Start Delete Modal  */}
        <div className="modal fade" id="delete_modal">
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="modal-body text-center position-relative">
                <div className="mb-2 position-relative z-1">
                  <span className="avatar avatar-md bg-danger rounded-circle">
                    <i className="ti ti-trash fs-24" />
                  </span>
                </div>
                <h5 className="mb-1">Delete Confirmation</h5>
                <p className="mb-3">
                  Are you sure you want to delete this patient?<br />
                  <small className="text-muted">This action cannot be undone.</small>
                </p>
                <div className="d-flex justify-content-center gap-2">
                  <button
                    className="btn btn-white position-relative z-1 w-100"
                    data-bs-dismiss="modal"
                    disabled={deleteLoading}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-danger position-relative z-1 w-100"
                    onClick={handleDeletePatient}
                    disabled={deleteLoading}
                  >
                    {deleteLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" />
                        Deleting...
                      </>
                    ) : (
                      'Yes, Delete'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* End Delete Modal  */}
      </>

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

export default Patients;