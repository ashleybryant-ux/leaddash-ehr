import { Link } from "react-router-dom";
import CommonFooter from "../../components/common-footer/commonFooter";
import { all_routes } from "../../routes/all_routes";
import { useState, useEffect } from "react";
import axios from 'axios';
import config from '../../config';

const API_URL = config.apiUrl;
const LOCATION_ID = config.ghlLocationId;

const Doctors = () => {
  // ============================================
  // STATE MANAGEMENT
  // ============================================
  
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<string | null>(null);

  // ============================================
  // FETCH STAFF FROM LEADDASH
  // ============================================
  
  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      console.log('👥 Fetching staff from LeadDash...');
      
      const response = await axios.get(`${API_URL}/api/staff`, {
        params: {
          locationId: LOCATION_ID,
          limit: 100
        }
      });

      if (response.data.success) {
        setStaff(response.data.staff || []);
        console.log(`✅ Loaded ${response.data.staff?.length || 0} staff members`);
      }
    } catch (error) {
      console.error('❌ Error fetching staff:', error);
      // Use empty array on error instead of showing alert
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // DELETE STAFF
  // ============================================
  
  const handleDeleteStaff = async () => {
    if (!staffToDelete) return;

    setDeleteLoading(true);
    try {
      console.log('🗑️ Deleting staff member:', staffToDelete);
      
      await axios.delete(`${API_URL}/api/staff/${staffToDelete}`, {
        params: { locationId: LOCATION_ID }
      });

      console.log('✅ Staff member deleted');
      
      setStaff(prev => prev.filter(s => s.id !== staffToDelete));
      
      const modal = document.getElementById('delete_modal');
      if (modal) {
        // @ts-ignore
        const bsModal = window.bootstrap.Modal.getInstance(modal);
        if (bsModal) bsModal.hide();
      }
      
      alert('Staff member deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting staff:', error);
      alert('Failed to delete staff member');
    } finally {
      setDeleteLoading(false);
      setStaffToDelete(null);
    }
  };

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  
  const getInitials = (firstName: string, lastName: string) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || '??';
  };

  const getStaffId = (index: number) => {
    return `#ST${String(index + 1).padStart(4, '0')}`;
  };

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex align-items-center justify-content-between gap-2 mb-4 flex-wrap">
            <div className="breadcrumb-arrow">
              <h4 className="mb-1">Staff</h4>
              <div className="text-end">
                <ol className="breadcrumb m-0 py-0">
                  <li className="breadcrumb-item">
                    <Link to={all_routes.dashboard}>Home</Link>
                  </li>
                  <li className="breadcrumb-item active">Staff</li>
                </ol>
              </div>
            </div>
            <div className="gap-2 d-flex align-items-center flex-wrap">
              <Link
                to={all_routes.doctors}
                className="btn btn-icon btn-white active"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                aria-label="Grid"
                data-bs-original-title="Grid View"
              >
                <i className="ti ti-layout-grid" />
              </Link>
              <Link
                to={all_routes.allDoctorsList}
                className="btn btn-icon btn-white"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                aria-label="List"
                data-bs-original-title="List View"
              >
                <i className="ti ti-layout-list" />
              </Link>
              <button
                onClick={fetchStaff}
                className="btn btn-icon btn-white"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                aria-label="Refresh"
                data-bs-original-title="Refresh"
                disabled={loading}
              >
                <i className={`ti ti-refresh ${loading ? 'spin' : ''}`} />
              </button>
              <Link
                to="#"
                className="btn btn-icon btn-white"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                aria-label="Print"
                data-bs-original-title="Print"
              >
                <i className="ti ti-printer" />
              </Link>
              <Link
                to="#"
                className="btn btn-icon btn-white"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                aria-label="Download"
                data-bs-original-title="Download"
              >
                <i className="ti ti-cloud-download" />
              </Link>
              <Link to={all_routes.addDoctors} className="btn btn-primary">
                <i className="ti ti-square-rounded-plus me-1" />
                New Staff Member
              </Link>
            </div>
          </div>

          <div className="alert alert-info mb-3">
            <i className="ti ti-plug-connected me-2" />
            Connected to LeadDash - Showing location staff members
          </div>

          {loading && (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2">Loading staff from LeadDash...</p>
            </div>
          )}

          {!loading && staff.length === 0 && (
            <div className="text-center py-5">
              <i className="ti ti-users-off fs-48 text-muted mb-3 d-block" />
              <h5>No Staff Members Found</h5>
              <p className="text-muted">Start by adding your first staff member</p>
              <Link to={all_routes.addDoctors} className="btn btn-primary mt-2">
                <i className="ti ti-plus me-1" />
                Add Staff Member
              </Link>
            </div>
          )}

          {!loading && staff.length > 0 && (
            <div className="row row-gap-4 justify-content-center">
              {staff.map((member, index) => (
                <div key={member.id} className="col-xxl-3 col-xl-4 col-lg-6 d-flex">
                  <div className="card shadow flex-fill w-100 mb-0">
                    <div className="card-body">
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <span className="badge badge-soft-primary">{getStaffId(index)}</span>
                        <Link
                          to="#"
                          className="btn btn-icon btn-outline-light border-0"
                          data-bs-toggle="dropdown"
                          aria-label="Staff actions menu"
                          aria-haspopup="true"
                          aria-expanded="false"
                        >
                          <i className="ti ti-dots-vertical" aria-hidden="true" />
                        </Link>
                        <ul className="dropdown-menu p-2">
                          <li>
                            <Link
                              to={all_routes.doctorDetails}
                              className="dropdown-item d-flex align-items-center"
                            >
                              <i className="ti ti-eye me-1" />
                              View Details
                            </Link>
                          </li>
                          <li>
                            <Link
                              to={all_routes.editDoctors}
                              className="dropdown-item d-flex align-items-center"
                            >
                              <i className="ti ti-edit me-1" />
                              Edit
                            </Link>
                          </li>
                          <li>
                            <button
                              type="button"
                              className="dropdown-item d-flex align-items-center text-danger"
                              data-bs-toggle="modal"
                              data-bs-target="#delete_modal"
                              onClick={() => setStaffToDelete(member.id)}
                            >
                              <i className="ti ti-trash me-1" />
                              Delete
                            </button>
                          </li>
                        </ul>
                      </div>
                      <div className="text-center mb-3">
                        <span className="avatar avatar-xl online avatar-rounded bg-primary-subtle text-primary">
                          <span className="fs-20 fw-bold">
                            {getInitials(member.firstName, member.lastName)}
                          </span>
                        </span>
                        <h6 className="mt-2 mb-1">
                          <Link to={all_routes.doctorDetails}>
                            {member.firstName} {member.lastName}
                          </Link>
                        </h6>
                        <span className="fs-14">{member.role || 'Staff Member'}</span>
                      </div>
                      <p className="mb-2 text-dark d-flex align-items-center">
                        <i className="ti ti-mail me-1 text-body" />
                        {member.email || 'No email'}
                      </p>
                      <p className="mb-0 text-dark d-flex align-items-center">
                        <i className="ti ti-phone me-1 text-body" />
                        {member.phone || 'No phone'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <CommonFooter />
      </div>

      {/* Delete Modal */}
      <div className="modal fade" id="delete_modal">
        <div className="modal-dialog modal-dialog-centered modal-sm">
          <div className="modal-content">
            <div className="modal-body text-center">
              <div className="mb-2">
                <span className="avatar avatar-md rounded-circle bg-danger">
                  <i className="ti ti-trash fs-24" />
                </span>
              </div>
              <h6 className="fs-16 mb-1">Confirm Deletion</h6>
              <p className="mb-3">Are you sure you want to delete this staff member?</p>
              <div className="d-flex justify-content-center gap-2">
                <button
                  className="btn btn-outline-light w-100"
                  data-bs-dismiss="modal"
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger w-100"
                  onClick={handleDeleteStaff}
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

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
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

export default Doctors;