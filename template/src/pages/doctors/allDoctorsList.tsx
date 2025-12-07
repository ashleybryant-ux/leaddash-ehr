import { Link } from "react-router-dom";
import CommonFooter from "../../components/common-footer/commonFooter";
import { all_routes } from "../../routes/all_routes";
import ImageWithBasePath from "../../components/image-with-base-path";
import { useEffect, useState } from "react";
import axios from 'axios';
import config from '../../config';

const API_URL = config.apiUrl;
const LOCATION_ID = config.ghlLocationId;

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role?: string;
  type?: string;
  initials?: string;
}

const AllDoctorsList = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      console.log('👥 Fetching staff from LeadDash...');
      
      const response = await axios.get(`${API_URL}/api/staff`, {
        params: { locationId: LOCATION_ID }
      });

      if (response.data.success) {
        setStaff(response.data.staff || []);
        console.log(`✅ Loaded ${response.data.staff?.length || 0} staff members`);
      }
    } catch (error) {
      console.error('❌ Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (staffId: string) => {
    if (!window.confirm('Are you sure you want to delete this staff member?')) {
      return;
    }

    try {
      console.log('🗑️ Deleting staff member:', staffId);
      
      await axios.delete(`${API_URL}/api/staff/${staffId}`, {
        params: { locationId: LOCATION_ID }
      });

      console.log('✅ Staff member deleted');
      setStaff(prev => prev.filter(s => s.id !== staffId));
      alert('Staff member deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting staff member:', error);
      alert('Failed to delete staff member');
    }
  };

  const sortedStaff = [...staff].sort((a, b) => {
    if (sortOrder === 'newest') {
      return b.firstName.localeCompare(a.firstName);
    } else {
      return a.firstName.localeCompare(b.firstName);
    }
  });

  const getRandomAvatar = () => {
    const avatars = [
      "assets/img/doctors/doctor-01.jpg",
      "assets/img/doctors/doctor-02.jpg",
      "assets/img/doctors/doctor-03.jpg",
      "assets/img/doctors/doctor-04.jpg",
      "assets/img/doctors/doctor-05.jpg",
      "assets/img/doctors/doctor-06.jpg",
      "assets/img/doctors/doctor-07.jpg",
      "assets/img/doctors/doctor-08.jpg",
      "assets/img/doctors/doctor-09.jpg",
      "assets/img/doctors/doctor-10.jpg",
    ];
    return avatars[Math.floor(Math.random() * avatars.length)];
  };

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
                className="btn btn-icon btn-white"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                aria-label="Grid"
                data-bs-original-title="Grid View"
              >
                <i className="ti ti-layout-grid" />
              </Link>
              <Link
                to={all_routes.allDoctorsList}
                className="btn btn-icon btn-white active"
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
          {/* End Page Header */}

          {/* LeadDash Connection Status */}
          <div className="alert alert-info mb-3">
            <i className="ti ti-plug-connected me-2" />
            Connected to LeadDash - Showing real staff data
          </div>

          {/* card start */}
          <div className="card mb-0">
            <div className="card-header d-flex align-items-center flex-wrap gap-2 justify-content-between">
              <h5 className="d-inline-flex align-items-center mb-0">
                Total Staff
                <span className="badge bg-danger ms-2">
                  {loading ? '...' : staff.length}
                </span>
              </h5>
              <div className="d-flex align-items-center">
                {/* sort by */}
                <div className="dropdown">
                  <Link
                    to="#"
                    className="dropdown-toggle btn btn-md btn-outline-light d-inline-flex align-items-center"
                    data-bs-toggle="dropdown"
                    aria-label="Staff sorting menu"
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
                  <p className="mt-2">Loading staff from LeadDash...</p>
                </div>
              ) : staff.length === 0 ? (
                <div className="text-center py-5">
                  <i className="ti ti-users-off fs-48 text-muted mb-3 d-block" />
                  <h5>No Staff Members Found</h5>
                  <p className="text-muted">Add your first staff member to get started</p>
                  <Link to={all_routes.addDoctors} className="btn btn-primary mt-2">
                    <i className="ti ti-plus me-1" />
                    Add Staff Member
                  </Link>
                </div>
              ) : (
                <div className="table-responsive table-nowrap">
                  <table className="table mb-0 border">
                    <thead className="table-light">
                      <tr>
                        <th>Staff ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Role</th>
                        <th>Type</th>
                        <th className="no-sort" />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedStaff.map((member) => (
                        <tr key={member.id}>
                          <td>#{member.id.substring(0, 8)}</td>
                          <td>
                            <div className="d-flex align-items-center">
                              <Link
                                to={`${all_routes.doctorDetails}/${member.id}`}
                                className="avatar avatar-xs me-2"
                              >
                                <ImageWithBasePath
                                  src={getRandomAvatar()}
                                  alt={`${member.firstName} ${member.lastName}`}
                                  className="rounded"
                                />
                              </Link>
                              <div>
                                <h6 className="fs-14 mb-0 fw-medium">
                                  <Link to={`${all_routes.doctorDetails}/${member.id}`}>
                                    {member.firstName} {member.lastName}
                                  </Link>
                                </h6>
                              </div>
                            </div>
                          </td>
                          <td>
                            <a href={`mailto:${member.email}`} className="text-primary">
                              {member.email}
                            </a>
                          </td>
                          <td>
                            {member.phone ? (
                              <a href={`tel:${member.phone}`} className="text-primary">
                                {member.phone}
                              </a>
                            ) : (
                              <span className="text-muted">N/A</span>
                            )}
                          </td>
                          <td>
                            <span className="badge badge-soft-primary">
                              {member.role || 'Staff Member'}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-soft-success">
                              {member.type || 'ACCOUNT-USER'}
                            </span>
                          </td>
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
                                  to={`${all_routes.doctorDetails}/${member.id}`}
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
                                  onClick={() => handleDelete(member.id)}
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
          {/* card end */}
        </div>
        {/* End Content */}
        {/* Start Footer */}
        <CommonFooter />
        {/* End Footer */}
      </div>
      {/* ========================
              End Page Content
          ========================= */}

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

export default AllDoctorsList;