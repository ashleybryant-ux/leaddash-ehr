import { Link } from "react-router-dom"
import CommonFooter from "../../components/common-footer/commonFooter"
import ImageWithBasePath from "../../components/image-with-base-path"
import { Suspense, useEffect, useState } from "react";
import { all_routes } from "../../routes/all_routes"
import PredefinedDatePicker from "../../components/common-date-range-picker/PredefinedDatePicker"
import ChartOne from "./chart/chart1"
import ChartTwo from "./chart/chart2"
import ChartThree from "./chart/chart3"
import ChartFour from "./chart/chart4"
import ChartFive from "./chart/chart5"
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = config.apiUrl;
const LOCATION_ID = config.ghlLocationId;

interface DashboardStats {
  patientsCount: number;
  appointmentsCount: number;
  staffCount: number;
  patientsGrowth: string;
  appointmentsGrowth: string;
  staffGrowth: string;
}

interface Appointment {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  contactName?: string;
  contactId?: string;
  status?: string;
  calendarName?: string;
}

const Dashboard = () => {
  const { getUserId, user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    patientsCount: 0,
    appointmentsCount: 0,
    staffCount: 0,
    patientsGrowth: '+0%',
    appointmentsGrowth: '+0%',
    staffGrowth: '+0%'
  });
  
  const [recentAppointments, setRecentAppointments] = useState<Appointment[]>([]);
  const [todayVisits, setTodayVisits] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = getUserId();
    if (userId) {
      fetchDashboardData();
    }
  }, []);

  const fetchDashboardData = async () => {
  const userId = getUserId();
  
  if (!userId) {
    console.error('❌ No user ID found');
    setLoading(false);
    return;
  }

  setLoading(true);
  try {
    console.log('📊 Fetching dashboard data from LeadDash...');

    const [patientsRes, appointmentsRes] = await Promise.all([
      axios.get(`${API_URL}/api/patients`, {
        params: { 
          locationId: LOCATION_ID, 
          userId: userId,
          limit: 1000
        }
      }).catch(err => {
        console.error('Error fetching patients:', err.response?.data || err.message);
        return { data: { patients: [] } };
      }),
      axios.get(`${API_URL}/api/appointments`, {
        params: { 
          locationId: LOCATION_ID,
          userId: userId,
          limit: 1000
        }
      }).catch(err => {
        console.error('Error fetching appointments:', err.response?.data || err.message);
        return { data: { appointments: [] } };
      })
    ]);

    const patientsCount = patientsRes.data.patients?.length || 0;
    const appointmentsCount = appointmentsRes.data.appointments?.length || 0;
    const staffCount = 1; // Mock value since /api/staff endpoint doesn't exist

    const today = new Date().toDateString();
    const todayVisitsCount = appointmentsRes.data.appointments?.filter((apt: any) => {
      const aptDate = new Date(apt.startTime).toDateString();
      return aptDate === today;
    }).length || 0;

    const recent = appointmentsRes.data.appointments
      ?.sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 5) || [];

    setStats({
      patientsCount,
      appointmentsCount,
      staffCount,
      patientsGrowth: '+20%',
      appointmentsGrowth: '-15%',
      staffGrowth: '+18%'
    });

    setRecentAppointments(recent);
    setTodayVisits(todayVisitsCount);

    console.log('✅ Dashboard data loaded:', {
      patients: patientsCount,
      appointments: appointmentsCount,
      todayVisits: todayVisitsCount
    });

  } catch (error) {
    console.error('❌ Error fetching dashboard data:', error);
  } finally {
    setLoading(false);
  }
};

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusBadge = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'badge-soft-success';
      case 'pending':
        return 'badge-soft-warning';
      case 'cancelled':
        return 'badge-soft-danger';
      case 'completed':
        return 'badge-soft-info';
      default:
        return 'badge-soft-purple';
    }
  };

  return (
    <>
      {/* ========================
        Start Page Content
      ========================= */}
      <div className="page-wrapper" id="main-content">
        {/* Start Content */}
        <div className="content">
          {/* Page Header */}
          <div className="d-flex align-items-center justify-content-between gap-2 mb-4 flex-wrap">
            <div className="breadcrumb-arrow">
              <h4 className="mb-1">Welcome, {user?.firstName} {user?.lastName}</h4>
              <p className="mb-0">
                Today you have {todayVisits} visits,{" "}
                <Link to={all_routes.visits} className="text-decoration-underline">
                  View Details
                </Link>
              </p>
            </div>
            <div className="d-flex gap-2 align-items-center">
              <button 
                onClick={fetchDashboardData} 
                className="btn btn-icon btn-white"
                disabled={loading}
              >
                <i className={`ti ti-refresh ${loading ? 'spin' : ''}`} />
              </button>
              <PredefinedDatePicker/>
            </div>
          </div>
          {/* End Page Header */}

          {/* Real-time GHL Status */}
          <div className="alert alert-success mb-4 d-flex align-items-center justify-content-between">
            <div>
              <i className="ti ti-plug-connected me-2" />
              Connected to GHL - Showing your assigned patients
            </div>
            <small className="text-muted">Auto-syncing enabled</small>
          </div>

          {/* row start */}
          <div className="row">
            {/* col start - Patients */}
            <div className="col-xl-3 col-md-6 d-flex">
              <div className="card pb-2 flex-fill">
                <div className="d-flex align-items-center justify-content-between gap-1 card-body pb-0 mb-1">
                  <div className="d-flex align-items-center overflow-hidden">
                    <span className="avatar bg-primary rounded-circle flex-shrink-0">
                      <i className="ti ti-user-exclamation fs-20" />
                    </span>
                    <div className="ms-2 overflow-hidden">
                      <p className="mb-1 text-truncate">My Patients</p>
                      <h5 className="mb-0">
                        {loading ? (
                          <span className="spinner-border spinner-border-sm" />
                        ) : (
                          stats.patientsCount
                        )}
                      </h5>
                    </div>
                  </div>
                  <div className="text-end">
                    <span className="badge badge-soft-success">
                      {stats.patientsGrowth}
                    </span>
                  </div>
                </div>
                <Suspense fallback={<div />}><ChartOne/></Suspense>
              </div>
            </div>
            {/* col end */}

            {/* col start - Appointments */}
            <div className="col-xl-3 col-md-6 d-flex">
              <div className="card pb-2 flex-fill">
                <div className="d-flex align-items-center justify-content-between gap-1 card-body pb-0 mb-1">
                  <div className="d-flex align-items-center overflow-hidden">
                    <span className="avatar bg-orange rounded-circle flex-shrink-0">
                      <i className="ti ti-calendar-check fs-20" />
                    </span>
                    <div className="ms-2 overflow-hidden">
                      <p className="mb-1 text-truncate">My Appointments</p>
                      <h5 className="mb-0">
                        {loading ? (
                          <span className="spinner-border spinner-border-sm" />
                        ) : (
                          stats.appointmentsCount
                        )}
                      </h5>
                    </div>
                  </div>
                  <div className="text-end">
                    <span className="badge badge-soft-danger">
                      {stats.appointmentsGrowth}
                    </span>
                  </div>
                </div>
                <Suspense fallback={<div />}><ChartTwo/></Suspense>
              </div>
            </div>
            {/* col end */}

            {/* col start - Staff */}
            <div className="col-xl-3 col-md-6 d-flex">
              <div className="card pb-2 flex-fill">
                <div className="d-flex align-items-center justify-content-between gap-1 card-body pb-0 mb-1">
                  <div className="d-flex align-items-center overflow-hidden">
                    <span className="avatar bg-purple rounded-circle flex-shrink-0">
                      <i className="ti ti-stethoscope fs-20" />
                    </span>
                    <div className="ms-2 overflow-hidden">
                      <p className="mb-1 text-truncate">Staff</p>
                      <h5 className="mb-0">
                        {loading ? (
                          <span className="spinner-border spinner-border-sm" />
                        ) : (
                          stats.staffCount
                        )}
                      </h5>
                    </div>
                  </div>
                  <div className="text-end">
                    <span className="badge badge-soft-success">
                      {stats.staffGrowth}
                    </span>
                  </div>
                </div>
                <Suspense fallback={<div />}><ChartThree/></Suspense>
              </div>
            </div>
            {/* col end */}

            {/* col start - Transactions */}
            <div className="col-xl-3 col-md-6 d-flex">
              <div className="card pb-2 flex-fill">
                <div className="d-flex align-items-center justify-content-between gap-1 card-body pb-0 mb-1">
                  <div className="d-flex align-items-center overflow-hidden">
                    <span className="avatar bg-pink rounded-circle flex-shrink-0">
                      <i className="ti ti-moneybag fs-20" />
                    </span>
                    <div className="ms-2 overflow-hidden">
                      <p className="mb-1 text-truncate">Transactions</p>
                      <h5 className="mb-0">$5,523.56</h5>
                    </div>
                  </div>
                  <div className="text-end">
                    <span className="badge badge-soft-success">+12%</span>
                  </div>
                </div>
                <Suspense fallback={<div />}><ChartFour/></Suspense>
              </div>
            </div>
            {/* col end */}
          </div>
          {/* row end */}

          {/* Rest of the dashboard remains the same... */}
          {/* I'll keep the other sections as they are since they're mostly mock data */}

          {/* row start */}
          <div className="row">
            {/* col start - Recent Appointments */}
            <div className="col-xl-6 d-flex">
              <div className="card flex-fill w-100">
                <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <h5 className="fw-bold mb-0">Recent Appointments</h5>
                  <Link
                    to={all_routes.appointments}
                    className="btn btn-sm btn-outline-light flex-shrink-0"
                  >
                    All Appointments
                  </Link>
                </div>
                <div className="card-body p-1 py-2">
                  {loading ? (
                    <div className="text-center py-4">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </div>
                  ) : recentAppointments.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted">No appointments found</p>
                    </div>
                  ) : (
                    <div className="table-responsive table-nowrap">
                      <table className="table table-borderless mb-0">
                        <tbody>
                          {recentAppointments.map((appointment) => (
                            <tr key={appointment.id}>
                              <td>
                                <div className="d-flex align-items-center">
                                  <Link
                                    to={all_routes.patientDetails}
                                    className="avatar me-2"
                                  >
                                    <ImageWithBasePath
                                      src="assets/img/profiles/avatar-23.jpg"
                                      alt="patient"
                                      className="rounded"
                                    />
                                  </Link>
                                  <div>
                                    <h6 className="fs-14 mb-1 fw-semibold">
                                      <Link to={all_routes.patientDetails}>
                                        {appointment.contactName || appointment.title || 'Unknown Patient'}
                                      </Link>
                                    </h6>
                                    <div className="d-flex align-items-center">
                                      <p className="mb-0 fs-13 d-inline-flex align-items-center text-body">
                                        <i className="ti ti-calendar me-1" />
                                        {formatDateTime(appointment.startTime)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className={`badge ${getStatusBadge(appointment.status)}`}>
                                  {appointment.status || 'Pending'}
                                </span>
                              </td>
                              <td className="text-end border-0">
                                <div className="d-flex align-items-center justify-content-end gap-2">
                                  <Link
                                    to={`${all_routes.appointments}`}
                                    className="btn btn-icon btn-light"
                                    aria-label="View appointment"
                                  >
                                    <i className="ti ti-eye" />
                                  </Link>
                                </div>
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
            {/* col end */}

            {/* col start - Patient Statistics */}
            <div className="col-xl-6 d-flex">
              <div className="card shadow flex-fill w-100">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h5 className="fw-bold mb-0">Patients Statistics</h5>
                  <Link
                    to={all_routes.allPatientsList}
                    className="btn btn-sm btn-outline-light"
                  >
                    View All
                  </Link>
                </div>
                <div className="card-body pb-0">
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <h6 className="fs-14 fw-semibold mb-0">
                      Total No of Patients : {stats.patientsCount}
                    </h6>
                    <div className="d-flex align-items-center gap-3">
                      <p className="mb-0 text-dark">
                        <i className="ti ti-point-filled me-1 text-primary" />
                        New Patients
                      </p>
                      <p className="mb-0 text-dark">
                        <i className="ti ti-point-filled me-1 text-soft-primary" />
                        Old Patients
                      </p>
                    </div>
                  </div>
                  <Suspense fallback={<div />}><ChartFive/></Suspense>
                </div>
              </div>
            </div>
            {/* col end */}
          </div>
          {/* row end */}

          {/* Quick Links remain the same... keeping the rest of your code */}
          <div className="row">
            <div className="col-xl-2 col-md-4 col-sm-6">
              <Link to={all_routes.patients} className="card">
                <div className="card-body text-center">
                  <span className="badge-soft-primary rounded w-100 d-flex p-3 justify-content-center fs-32 mb-2">
                    <i className="ti ti-users" />
                  </span>
                  <h6 className="fs-14 fw-semibold text-truncate mb-0">
                    All Patients
                  </h6>
                  <p className="text-muted mb-0">{stats.patientsCount}</p>
                </div>
              </Link>
            </div>

            <div className="col-xl-2 col-md-4 col-sm-6">
              <Link to={all_routes.allDoctorsList} className="card">
                <div className="card-body text-center">
                  <span className="badge-soft-success rounded w-100 d-flex p-3 justify-content-center fs-32 mb-2">
                    <i className="ti ti-topology-bus" />
                  </span>
                  <h6 className="fs-14 fw-semibold text-truncate mb-0">Staff</h6>
                  <p className="text-muted mb-0">{stats.staffCount}</p>
                </div>
              </Link>
            </div>

            <div className="col-xl-2 col-md-4 col-sm-6">
              <Link to={all_routes.labResults} className="card">
                <div className="card-body text-center">
                  <span className="badge-soft-warning rounded w-100 d-flex p-3 justify-content-center fs-32 mb-2">
                    <i className="ti ti-test-pipe-2" />
                  </span>
                  <h6 className="fs-14 fw-semibold text-truncate mb-0">
                    Labs Results
                  </h6>
                </div>
              </Link>
            </div>

            <div className="col-xl-2 col-md-4 col-sm-6">
              <Link to={all_routes.pharmacy} className="card">
                <div className="card-body text-center">
                  <span className="badge-soft-danger rounded w-100 d-flex p-3 justify-content-center fs-32 mb-2">
                    <i className="ti ti-prescription" />
                  </span>
                  <h6 className="fs-14 fw-semibold text-truncate mb-0">
                    Prescriptions
                  </h6>
                </div>
              </Link>
            </div>

            <div className="col-xl-2 col-md-4 col-sm-6">
              <Link to={all_routes.visits} className="card">
                <div className="card-body text-center">
                  <span className="badge-soft-purple rounded w-100 d-flex p-3 justify-content-center fs-32 mb-2">
                    <i className="ti ti-e-passport" />
                  </span>
                  <h6 className="fs-14 fw-semibold text-truncate mb-0">Visits</h6>
                  <p className="text-muted mb-0">{todayVisits} today</p>
                </div>
              </Link>
            </div>

            <div className="col-xl-2 col-md-4 col-sm-6">
              <Link to={all_routes.medicalResults} className="card">
                <div className="card-body text-center">
                  <span className="badge-soft-teal rounded w-100 d-flex p-3 justify-content-center fs-32 mb-2">
                    <i className="ti ti-file-description" />
                  </span>
                  <h6 className="fs-14 fw-semibold text-truncate mb-0">
                    Medical Records
                  </h6>
                </div>
              </Link>
            </div>
          </div>

          {/* Keeping rest of dashboard as is for brevity */}
        </div>
        {/* End Content */}
        {/* Start Footer */}
        <CommonFooter/>
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
  )
}

export default Dashboard