import { Link, useParams } from "react-router-dom";
import { all_routes } from "../../routes/all_routes";
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

const DoctorDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchStaffDetails(id);
    } else {
      fetchFirstStaff();
    }
  }, [id]);

  const fetchStaffDetails = async (staffId: string) => {
    setLoading(true);
    try {
      console.log('👤 Fetching staff details for:', staffId);
      
      const response = await axios.get(`${API_URL}/api/staff/${staffId}`, {
        params: { locationId: LOCATION_ID }
      });

      if (response.data.success) {
        setStaff(response.data.staff);
        console.log('✅ Staff details loaded');
      }
    } catch (error) {
      console.error('❌ Error fetching staff details:', error);
      fetchFirstStaff();
    } finally {
      setLoading(false);
    }
  };

  const fetchFirstStaff = async () => {
    setLoading(true);
    try {
      console.log('👥 Fetching staff list...');
      
      const response = await axios.get(`${API_URL}/api/staff`, {
        params: { locationId: LOCATION_ID }
      });

      if (response.data.success && response.data.staff?.length > 0) {
        setStaff(response.data.staff[0]);
        console.log('✅ Showing first staff member');
      }
    } catch (error) {
      console.error('❌ Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2">Loading staff details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="text-center py-5">
            <i className="ti ti-user-off fs-48 text-muted mb-3 d-block" />
            <h5>Staff Member Not Found</h5>
            <p className="text-muted">This staff member does not exist or has been removed</p>
            <Link to={all_routes.doctors} className="btn btn-primary mt-2">
              <i className="ti ti-arrow-left me-1" />
              Back to Staff List
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
              <h4 className="mb-1">Staff Member Details</h4>
              <div className="text-end">
                <ol className="breadcrumb m-0 py-0">
                  <li className="breadcrumb-item">
                    <Link to={all_routes.dashboard}>Home</Link>
                  </li>
                  <li className="breadcrumb-item active">Staff Details</li>
                </ol>
              </div>
            </div>
            <div className="gap-2 d-flex align-items-center flex-wrap">
              <Link
                to={all_routes.doctors}
                className="fw-medium d-flex align-items-center"
              >
                <i className="ti ti-arrow-left me-1" />
                Back to Staff
              </Link>
            </div>
          </div>
          {/* End Page Header */}

          {/* LeadDash Connection Status */}
          <div className="alert alert-info mb-3">
            <i className="ti ti-plug-connected me-2" />
            Connected to LeadDash - Showing real staff data
          </div>

          {/* row start */}
          <div className="row row-gap-4">
            {/* col start */}
            <div className="col-xl-4">
              <div className="card shadow mb-0">
                <div className="card-body">
                  <div className="d-flex align-items-center pb-3 mb-3 border-bottom gap-3">
                    <Link to="#" className="avatar avatar-xxl">
                      <div className="avatar avatar-xxl bg-primary text-white rounded d-flex align-items-center justify-content-center">
                        <span className="fs-24 fw-bold">
                          {staff.firstName.charAt(0)}{staff.lastName.charAt(0)}
                        </span>
                      </div>
                    </Link>
                    <div>
                      <span className="badge badge-md badge-soft-primary">
                        #{staff.id.substring(0, 8)}
                      </span>
                      <h5 className="mb-1 fw-semibold mt-2">
                        <Link to="#">{staff.firstName} {staff.lastName}</Link>
                      </h5>
                      <p className="fs-13 mb-0">{staff.role || 'Staff Member'}</p>
                    </div>
                  </div>
                  <h6 className="mb-3">Basic Information</h6>
                  <p className="mb-3">
                    Role{" "}
                    <span className="float-end text-dark">
                      {staff.role || 'Staff Member'}
                    </span>
                  </p>
                  <p className="mb-3">
                    Account Type{" "}
                    <span className="float-end text-dark">
                      {staff.type || 'ACCOUNT-USER'}
                    </span>
                  </p>
                  <p className="mb-3">
                    Phone Number{" "}
                    <span className="float-end text-dark">
                      {staff.phone || 'Not provided'}
                    </span>
                  </p>
                  <p className="mb-3">
                    Email{" "}
                    <span className="float-end text-dark">
                      {staff.email}
                    </span>
                  </p>
                  <p className="mb-3">
                    Staff ID{" "}
                    <span className="float-end text-dark">
                      {staff.id}
                    </span>
                  </p>
                  <div className="d-flex gap-2 mt-4">
                    <Link 
                      to={all_routes.editDoctors} 
                      className="btn btn-primary w-100"
                    >
                      <i className="ti ti-edit me-1" />
                      Edit Details
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            {/* col end */}

            {/* col start */}
            <div className="col-xl-8">
              <div
                className="accordion accordion-bordered"
                id="BorderedaccordionExample"
              >
                {/* Start About  */}
                <div className="accordion-item bg-white mb-4">
                  <h2 className="accordion-header" id="about_view_header">
                    <button
                      className="accordion-button"
                      type="button"
                      data-bs-toggle="collapse"
                      data-bs-target="#about_view"
                      aria-expanded="true"
                      aria-controls="about_view"
                    >
                      About
                    </button>
                  </h2>
                  <div
                    id="about_view"
                    className="accordion-collapse collapse show"
                    aria-labelledby="about_view_header"
                    data-bs-parent="#BorderedaccordionExample"
                  >
                    <div className="accordion-body">
                      <p className="mb-3">
                        <strong>Name:</strong> {staff.firstName} {staff.lastName}
                      </p>
                      <p className="mb-3">
                        <strong>Email:</strong> <a href={`mailto:${staff.email}`}>{staff.email}</a>
                      </p>
                      {staff.phone && (
                        <p className="mb-3">
                          <strong>Phone:</strong> <a href={`tel:${staff.phone}`}>{staff.phone}</a>
                        </p>
                      )}
                      <p className="mb-3">
                        <strong>Role:</strong> {staff.role || 'Staff Member'}
                      </p>
                      <p className="mb-0">
                        <strong>Account Type:</strong> {staff.type || 'ACCOUNT-USER'}
                      </p>
                    </div>
                  </div>
                </div>
                {/* End About  */}

                {/* Start Contact Information  */}
                <div className="accordion-item bg-white mb-4">
                  <h2 className="accordion-header" id="contact_view_header">
                    <button
                      className="accordion-button collapsed"
                      type="button"
                      data-bs-toggle="collapse"
                      data-bs-target="#contact_view"
                      aria-expanded="false"
                      aria-controls="contact_view"
                    >
                      Contact Information
                    </button>
                  </h2>
                  <div
                    id="contact_view"
                    className="accordion-collapse collapse"
                    aria-labelledby="contact_view_header"
                    data-bs-parent="#BorderedaccordionExample"
                  >
                    <div className="accordion-body">
                      <div className="p-3 rounded border mb-3">
                        <h6 className="fs-14 fw-semibold mb-1">
                          <i className="ti ti-mail me-2" />
                          Email Address
                        </h6>
                        <p className="mb-0">
                          <a href={`mailto:${staff.email}`} className="text-primary">
                            {staff.email}
                          </a>
                        </p>
                      </div>
                      {staff.phone && (
                        <div className="p-3 rounded border">
                          <h6 className="fs-14 fw-semibold mb-1">
                            <i className="ti ti-phone me-2" />
                            Phone Number
                          </h6>
                          <p className="mb-0">
                            <a href={`tel:${staff.phone}`} className="text-primary">
                              {staff.phone}
                            </a>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {/* End Contact Information  */}

                {/* Start Professional Details  */}
                <div className="accordion-item bg-white mb-4">
                  <h2 className="accordion-header" id="professional_view_header">
                    <button
                      className="accordion-button collapsed"
                      type="button"
                      data-bs-toggle="collapse"
                      data-bs-target="#professional_view"
                      aria-expanded="false"
                      aria-controls="professional_view"
                    >
                      Professional Details
                    </button>
                  </h2>
                  <div
                    id="professional_view"
                    className="accordion-collapse collapse"
                    aria-labelledby="professional_view_header"
                    data-bs-parent="#BorderedaccordionExample"
                  >
                    <div className="accordion-body">
                      <div className="p-3 rounded border mb-3">
                        <h6 className="fs-14 fw-semibold mb-1">Role</h6>
                        <p className="mb-0">{staff.role || 'Staff Member'}</p>
                      </div>
                      <div className="p-3 rounded border mb-3">
                        <h6 className="fs-14 fw-semibold mb-1">Account Type</h6>
                        <p className="mb-0">
                          <span className="badge badge-soft-success">
                            {staff.type || 'ACCOUNT-USER'}
                          </span>
                        </p>
                      </div>
                      <div className="p-3 rounded border">
                        <h6 className="fs-14 fw-semibold mb-1">Staff ID</h6>
                        <p className="mb-0">
                          <code>{staff.id}</code>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                {/* End Professional Details  */}

                {/* Start Actions  */}
                <div className="accordion-item bg-white">
                  <h2 className="accordion-header" id="actions_view_header">
                    <button
                      className="accordion-button collapsed"
                      type="button"
                      data-bs-toggle="collapse"
                      data-bs-target="#actions_view"
                      aria-expanded="false"
                      aria-controls="actions_view"
                    >
                      Quick Actions
                    </button>
                  </h2>
                  <div
                    id="actions_view"
                    className="accordion-collapse collapse"
                    aria-labelledby="actions_view_header"
                    data-bs-parent="#BorderedaccordionExample"
                  >
                    <div className="accordion-body">
                      <div className="row">
                        <div className="col-md-6 mb-3">
                          <Link 
                            to={`mailto:${staff.email}`}
                            className="btn btn-outline-primary w-100"
                          >
                            <i className="ti ti-mail me-2" />
                            Send Email
                          </Link>
                        </div>
                        {staff.phone && (
                          <div className="col-md-6 mb-3">
                            <Link 
                              to={`tel:${staff.phone}`}
                              className="btn btn-outline-success w-100"
                            >
                              <i className="ti ti-phone me-2" />
                              Call Now
                            </Link>
                          </div>
                        )}
                        <div className="col-md-6 mb-3">
                          <Link 
                            to={all_routes.editDoctors}
                            className="btn btn-outline-warning w-100"
                          >
                            <i className="ti ti-edit me-2" />
                            Edit Details
                          </Link>
                        </div>
                        <div className="col-md-6 mb-3">
                          <Link 
                            to={all_routes.appointments}
                            className="btn btn-outline-info w-100"
                          >
                            <i className="ti ti-calendar me-2" />
                            View Schedule
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* End Actions  */}
              </div>
            </div>
            {/* col end */}
          </div>
          {/* row end */}
        </div>
        {/* End Content */}
        {/* Start Footer */}
        <footer className="footer text-center">
          <p className="mb-0 text-dark">
            2025 ©{" "}
            <Link to="#" className="link-primary">
              LeadDash EMR
            </Link>{" "}
            - All Rights Reserved.
          </p>
        </footer>
        {/* End Footer */}
      </div>
      {/* ========================
        End Page Content
      ========================= */}
    </>
  );
};

export default DoctorDetails;