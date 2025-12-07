import { Link } from "react-router-dom";
import CommonFooter from "../../../components/common-footer/commonFooter";
import { all_routes } from "../../../routes/all_routes";
import ImageWithBasePath from "../../../components/image-with-base-path";
import { Suspense, lazy, useState, useEffect } from "react";
import axios from 'axios';
import config from '../../../config';

const API_URL = config.apiUrl;

const StaffsModal = lazy(() => import("./modal/staffsModal"));

interface Staff {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  permissions: string[];
  createdAt: string;
  profileImage?: string;
}

const Staffs = () => {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationId, setLocationId] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const locId = params.get('locationId');
    
    if (locId) {
      setLocationId(locId);
      fetchStaff(locId);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchStaff = async (locId: string) => {
    setLoading(true);
    try {
      console.log('👥 Fetching staff members...');
      
      const response = await axios.get(`${API_URL}/api/staff`, {
        params: { 
          locationId: locId,
          sortBy: sortOrder 
        }
      });

      if (response.data?.staff) {
        setStaffList(response.data.staff);
        console.log('✅ Staff loaded:', response.data.staff.length);
      }
    } catch (error) {
      console.error('❌ Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (order: string) => {
    setSortOrder(order);
    if (locationId) {
      fetchStaff(locationId);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getRoleDisplay = (role: string) => {
    const roleMap: Record<string, string> = {
      'admin': 'Administrator',
      'user': 'Staff User',
      'limited': 'Limited User',
      'account': 'Account Owner'
    };
    return roleMap[role] || role;
  };

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex align-items-center justify-content-between gap-2 mb-4 flex-wrap">
            <div className="breadcrumb-arrow">
              <h4 className="mb-1">Staffs</h4>
              <div className="text-end">
                <ol className="breadcrumb m-0 py-0">
                  <li className="breadcrumb-item">
                    <Link to={all_routes.dashboard}>Home</Link>
                  </li>
                  <li className="breadcrumb-item active">Staffs</li>
                </ol>
              </div>
            </div>
            <div className="gap-2 d-flex align-items-center flex-wrap">
              <button
                onClick={() => fetchStaff(locationId)}
                className="btn btn-icon btn-white"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                aria-label="Refresh"
                disabled={loading}
              >
                <i className={`ti ti-refresh ${loading ? 'rotating' : ''}`} />
              </button>
              <Link
                to="#"
                className="btn btn-primary"
                data-bs-toggle="modal"
                data-bs-target="#add_staff"
              >
                <i className="ti ti-square-rounded-plus me-1" />
                New Staff
              </Link>
            </div>
          </div>

          <div className="card mb-0">
            <div className="card-header d-flex align-items-center flex-wrap gap-2 justify-content-between">
              <h5 className="d-inline-flex align-items-center mb-0">
                Total Staffs
                {staffList.length > 0 && (
                  <span className="badge bg-danger ms-2">{staffList.length}</span>
                )}
              </h5>
              <div className="d-flex align-items-center">
                <div className="dropdown">
                  <Link
                    to="#"
                    className="dropdown-toggle btn btn-md btn-outline-light d-inline-flex align-items-center"
                    data-bs-toggle="dropdown"
                    aria-label="Sort staff"
                    aria-haspopup="true"
                    aria-expanded="false"
                  >
                    <i className="ti ti-sort-descending-2 me-1" />
                    <span className="me-1">Sort By : </span> 
                    {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
                  </Link>
                  <ul className="dropdown-menu dropdown-menu-end p-2">
                    <li>
                      <button 
                        onClick={() => handleSort('newest')}
                        className="dropdown-item rounded-1"
                      >
                        Newest
                      </button>
                    </li>
                    <li>
                      <button 
                        onClick={() => handleSort('oldest')}
                        className="dropdown-item rounded-1"
                      >
                        Oldest
                      </button>
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
                </div>
              ) : staffList.length === 0 ? (
                <div className="text-center py-5">
                  <i className="ti ti-users-off fs-48 text-muted mb-3"></i>
                  <p className="text-muted">No staff members found</p>
                  <button
                    className="btn btn-primary mt-2"
                    data-bs-toggle="modal"
                    data-bs-target="#add_staff"
                  >
                    <i className="ti ti-plus me-1" />
                    Add First Staff Member
                  </button>
                </div>
              ) : (
                <div className="table-responsive table-nowrap">
                  <table className="table border mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Staff ID</th>
                        <th>Staff Name</th>
                        <th className="no-sort">Role</th>
                        <th className="no-sort">Phone Number</th>
                        <th>Email</th>
                        <th className="no-sort">Date Added</th>
                        <th className="no-sort" />
                      </tr>
                    </thead>
                    <tbody>
                      {staffList.map((staff, index) => (
                        <tr key={staff.id}>
                          <td>
                            <Link 
                              to="#"
                              aria-label={`View staff member ${staff.firstName} ${staff.lastName} details`}
                            >
                              #SF{String(staffList.length - index).padStart(4, '0')}
                            </Link>
                          </td>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="avatar avatar-xs me-2">
                                {staff.profileImage ? (
                                  <ImageWithBasePath
                                    src={staff.profileImage}
                                    alt={`${staff.firstName} ${staff.lastName}`}
                                    className="rounded"
                                  />
                                ) : (
                                  <span className="avatar-text rounded bg-primary text-white">
                                    {getInitials(staff.firstName, staff.lastName)}
                                  </span>
                                )}
                              </div>
                              <div>
                                <h6 className="fs-14 mb-0 fw-medium">
                                  {staff.firstName} {staff.lastName}
                                </h6>
                              </div>
                            </div>
                          </td>
                          <td>{getRoleDisplay(staff.role)}</td>
                          <td>{staff.phone || 'N/A'}</td>
                          <td>{staff.email}</td>
                          <td>{formatDate(staff.createdAt)}</td>
                          <td className="text-end">
                            <Link
                              to="#"
                              className="btn btn-icon btn-outline-light"
                              data-bs-toggle="dropdown"
                              aria-label="Staff actions menu"
                            >
                              <i className="ti ti-dots-vertical" aria-hidden="true" />
                            </Link>
                            <ul className="dropdown-menu p-2">
                              <li>
                                <Link
                                  to="#"
                                  className="dropdown-item d-flex align-items-center"
                                  data-bs-toggle="modal"
                                  data-bs-target="#view_staff"
                                >
                                  <i className="ti ti-eye me-1" />
                                  View Details
                                </Link>
                              </li>
                              <li>
                                <Link
                                  to="#"
                                  className="dropdown-item d-flex align-items-center"
                                  data-bs-toggle="modal"
                                  data-bs-target="#edit_staff"
                                >
                                  <i className="ti ti-edit me-1" />
                                  Edit
                                </Link>
                              </li>
                              <li>
                                <Link
                                  to="#"
                                  className="dropdown-item d-flex align-items-center"
                                  data-bs-toggle="modal"
                                  data-bs-target="#delete_modal"
                                >
                                  <i className="ti ti-trash me-1" />
                                  Delete
                                </Link>
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

      <Suspense fallback={<div />}>
        <StaffsModal />
      </Suspense>
    </>
  );
};

export default Staffs;