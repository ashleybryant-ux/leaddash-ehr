import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

interface Appointment {
  id: string;
  title?: string;
  startTime: string;
  endTime?: string;
  contactId?: string;
  contactName?: string;
  appointmentStatus?: string;
  meetingLocationType?: string;
  googleMeetLink?: string;
  zoomLink?: string;
  meetLink?: string;
  address?: string;
  assignedUserId?: string;
  contact?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
  };
}

interface Patient {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  dateAdded?: string;
  tags?: string[];
  assignedTo?: string;
}

interface ProgressNote {
  id: string;
  patientId: string;
  patientName?: string;
  sessionDate: string;
  status: string;
  updatedAt?: string;
  createdAt?: string;
  appointmentId?: string;
}

const UserDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("User");
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<{ [key: string]: Patient }>({});
  const [appointmentsNeedingNotes, setAppointmentsNeedingNotes] = useState<Appointment[]>([]);
  const [stats, setStats] = useState({
    totalPatients: 0,
    activePatients: 0,
    newPatientsThisMonth: 0,
    appointmentsToday: 0,
    appointmentsThisWeek: 0,
    pendingNotes: 0,
  });

  useEffect(() => {
    const storedUserName = localStorage.getItem("userName") || "User";
    setUserName(storedUserName);
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    const locationId = localStorage.getItem("locationId");
    const userId = localStorage.getItem("userId");

    if (!locationId) {
      console.error("No locationId found");
      setLoading(false);
      return;
    }

    try {
      // Get date ranges
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + 7);
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // Fetch appointments
      const appointmentsRes = await axios.get(`${API_URL}/api/appointments`, {
        params: {
          locationId,
          startTime: startOfDay.toISOString(),
          endTime: endOfWeek.toISOString(),
        },
      }).catch(() => ({ data: { appointments: [] } }));

      const allAppointments: Appointment[] = appointmentsRes.data.appointments || [];

      // Filter today's appointments
      const todayAppts = allAppointments.filter((apt) => {
        const aptDate = new Date(apt.startTime);
        return aptDate >= startOfDay && aptDate <= endOfDay;
      }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      // Filter upcoming appointments (excluding today)
      const upcomingAppts = allAppointments.filter((apt) => {
        const aptDate = new Date(apt.startTime);
        return aptDate > endOfDay;
      }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()).slice(0, 5);

      setTodayAppointments(todayAppts);
      setUpcomingAppointments(upcomingAppts);

      // Fetch patients
      const patientsRes = await axios.get(`${API_URL}/api/patients`, {
        params: { locationId, limit: 500 },
      }).catch(() => ({ data: { patients: [] } }));

      const patientsList: Patient[] = patientsRes.data.patients || [];
      const patientMap: { [key: string]: Patient } = {};
      patientsList.forEach((p) => {
        patientMap[p.id] = p;
      });
      setPatients(patientMap);

      // Calculate patient stats - only count patients assigned to current user
      const myPatients = patientsList.filter((p) => {
        return p.assignedTo === userId;
      });
      
      const newThisMonth = myPatients.filter((p) => {
        if (!p.dateAdded) return false;
        const addedDate = new Date(p.dateAdded);
        return addedDate >= startOfMonth;
      }).length;

      // Fetch progress notes
      const notesRes = await axios.get(`${API_URL}/api/progress-notes`, {
        params: { locationId },
      }).catch(() => ({ data: { notes: [] } }));

      const allNotes: ProgressNote[] = notesRes.data.notes || [];

      // Find past appointments that don't have a progress note
      // Get all appointments from the past (before today)
      const pastApptsRes = await axios.get(`${API_URL}/api/appointments`, {
        params: {
          locationId,
          startTime: new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString(), // Last month
          endTime: startOfDay.toISOString(), // Before today
        },
      }).catch(() => ({ data: { appointments: [] } }));

      const pastAppointments: Appointment[] = pastApptsRes.data.appointments || [];
      
      // Filter to only showed/completed appointments that don't have a note
      const appointmentIdsWithNotes = new Set(
        allNotes.map((n) => n.appointmentId).filter(Boolean)
      );
      
      // Also check by patient + date combination
      const noteDateKeys = new Set(
        allNotes.map((n) => `${n.patientId}_${new Date(n.sessionDate).toDateString()}`)
      );

      const appointmentsNeedingNotes = pastAppointments
        .filter((apt) => {
          // Only include showed/completed appointments
          const status = (apt.appointmentStatus || "").toLowerCase();
          if (status !== "showed" && status !== "completed" && status !== "confirmed") {
            return false;
          }
          
          // Check if this appointment already has a note
          if (apt.id && appointmentIdsWithNotes.has(apt.id)) {
            return false;
          }
          
          // Check if there's a note for this patient on this date
          const dateKey = `${apt.contactId}_${new Date(apt.startTime).toDateString()}`;
          if (noteDateKeys.has(dateKey)) {
            return false;
          }
          
          return true;
        })
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, 5);

      setAppointmentsNeedingNotes(appointmentsNeedingNotes);

      // Set stats
      setStats({
        totalPatients: myPatients.length,
        activePatients: myPatients.length,
        newPatientsThisMonth: newThisMonth,
        appointmentsToday: todayAppts.length,
        appointmentsThisWeek: allAppointments.length,
        pendingNotes: appointmentsNeedingNotes.length,
      });

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPatientName = (apt: Appointment) => {
    // Try contact embedded in appointment
    if (apt.contact) {
      const name = apt.contact.name || `${apt.contact.firstName || ""} ${apt.contact.lastName || ""}`.trim();
      if (name) return name;
    }
    // Try patients map
    if (apt.contactId && patients[apt.contactId]) {
      const p = patients[apt.contactId];
      return p.name || `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Client";
    }
    return apt.contactName || "Client";
  };

  const getVideoLink = (apt: Appointment) => {
    if (apt.googleMeetLink) return apt.googleMeetLink;
    if (apt.zoomLink) return apt.zoomLink;
    if (apt.meetLink) return apt.meetLink;
    if (apt.address && (apt.address.includes("meet.google.com") || apt.address.includes("zoom.us"))) {
      return apt.address;
    }
    return null;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
        return "success";
      case "showed":
      case "completed":
        return "info";
      case "cancelled":
      case "canceled":
        return "danger";
      case "no show":
      case "noshow":
        return "warning";
      default:
        return "secondary";
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between mb-4">
          <div>
            <h4 className="mb-1">{getGreeting()}, {userName.split(" ")[0]}!</h4>
            <p className="text-muted mb-0">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <button className="btn btn-outline-primary btn-sm" onClick={fetchDashboardData} disabled={loading}>
            <i className={`ti ti-refresh me-1 ${loading ? "spin" : ""}`}></i>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2 text-muted">Loading dashboard...</p>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="row mb-4">
              <div className="col-md-3 col-sm-6 mb-3">
                <div className="card h-100">
                  <div className="card-body">
                    <div className="d-flex align-items-center">
                      <div className="avatar avatar-lg bg-primary-light rounded me-3">
                        <i className="ti ti-calendar-event text-primary fs-4"></i>
                      </div>
                      <div>
                        <h3 className="mb-0">{stats.appointmentsToday}</h3>
                        <p className="text-muted mb-0 small">Today's Appointments</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-md-3 col-sm-6 mb-3">
                <div className="card h-100">
                  <div className="card-body">
                    <div className="d-flex align-items-center">
                      <div className="avatar avatar-lg bg-success-light rounded me-3">
                        <i className="ti ti-users text-success fs-4"></i>
                      </div>
                      <div>
                        <h3 className="mb-0">{stats.totalPatients}</h3>
                        <p className="text-muted mb-0 small">Total Clients</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-md-3 col-sm-6 mb-3">
                <div className="card h-100">
                  <div className="card-body">
                    <div className="d-flex align-items-center">
                      <div className="avatar avatar-lg bg-info-light rounded me-3">
                        <i className="ti ti-user-plus text-info fs-4"></i>
                      </div>
                      <div>
                        <h3 className="mb-0">{stats.newPatientsThisMonth}</h3>
                        <p className="text-muted mb-0 small">New This Month</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-md-3 col-sm-6 mb-3">
                <div className="card h-100">
                  <div className="card-body">
                    <div className="d-flex align-items-center">
                      <div className="avatar avatar-lg bg-warning-light rounded me-3">
                        <i className="ti ti-file-text text-warning fs-4"></i>
                      </div>
                      <div>
                        <h3 className="mb-0">{stats.pendingNotes}</h3>
                        <p className="text-muted mb-0 small">Pending Notes</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="row">
              {/* Today's Schedule */}
              <div className="col-lg-6 mb-4">
                <div className="card h-100">
                  <div className="card-header d-flex align-items-center justify-content-between">
                    <h5 className="card-title mb-0">
                      <i className="ti ti-calendar-time me-2 text-primary"></i>
                      Today's Schedule
                    </h5>
                    <Link to="/calendar-view" className="btn btn-sm btn-outline-primary">
                      View Calendar
                    </Link>
                  </div>
                  <div className="card-body p-0">
                    {todayAppointments.length === 0 ? (
                      <div className="text-center py-5 text-muted">
                        <i className="ti ti-calendar-off fs-1 mb-2 d-block"></i>
                        <p className="mb-0">No appointments scheduled for today</p>
                      </div>
                    ) : (
                      <div className="list-group list-group-flush">
                        {todayAppointments.map((apt) => {
                          const videoLink = getVideoLink(apt);
                          return (
                            <div key={apt.id} className="list-group-item">
                              <div className="d-flex align-items-center justify-content-between">
                                <div className="d-flex align-items-center">
                                  <div className="me-3 text-center" style={{ minWidth: "60px" }}>
                                    <span className="d-block fw-semibold text-primary">
                                      {formatTime(apt.startTime)}
                                    </span>
                                    {apt.endTime && (
                                      <small className="text-muted">
                                        {formatTime(apt.endTime)}
                                      </small>
                                    )}
                                  </div>
                                  <div>
                                    <h6 className="mb-1">
                                      <Link 
                                        to={`/patients/${apt.contactId}`} 
                                        className="text-dark text-decoration-none patient-name-link"
                                      >
                                        {getPatientName(apt)}
                                      </Link>
                                    </h6>
                                    <div className="d-flex align-items-center gap-2">
                                      <span className={`badge bg-${getStatusColor(apt.appointmentStatus)}`}>
                                        {apt.appointmentStatus || "Scheduled"}
                                      </span>
                                      {videoLink && (
                                        <span className="badge bg-info">
                                          <i className="ti ti-video me-1"></i>Video
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="d-flex gap-2">
                                  {videoLink && (
                                    <a
                                      href={videoLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn btn-sm btn-success"
                                      title="Join Video"
                                    >
                                      <i className="ti ti-video"></i>
                                    </a>
                                  )}
                                  <Link
                                    to={`/patients/${apt.contactId}`}
                                    className="btn btn-sm btn-outline-primary"
                                    title="View Client"
                                  >
                                    <i className="ti ti-user"></i>
                                  </Link>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Upcoming Appointments */}
              <div className="col-lg-6 mb-4">
                <div className="card h-100">
                  <div className="card-header d-flex align-items-center justify-content-between">
                    <h5 className="card-title mb-0">
                      <i className="ti ti-calendar-plus me-2 text-success"></i>
                      Upcoming This Week
                    </h5>
                    <span className="badge bg-primary">{stats.appointmentsThisWeek} total</span>
                  </div>
                  <div className="card-body p-0">
                    {upcomingAppointments.length === 0 ? (
                      <div className="text-center py-5 text-muted">
                        <i className="ti ti-calendar-check fs-1 mb-2 d-block"></i>
                        <p className="mb-0">No upcoming appointments</p>
                      </div>
                    ) : (
                      <div className="list-group list-group-flush">
                        {upcomingAppointments.map((apt) => {
                          const videoLink = getVideoLink(apt);
                          return (
                            <div key={apt.id} className="list-group-item">
                              <div className="d-flex align-items-center justify-content-between">
                                <div className="d-flex align-items-center">
                                  <div className="me-3 text-center" style={{ minWidth: "80px" }}>
                                    <span className="d-block small text-muted">
                                      {formatDate(apt.startTime)}
                                    </span>
                                    <span className="fw-semibold">
                                      {formatTime(apt.startTime)}
                                    </span>
                                  </div>
                                  <div>
                                    <h6 className="mb-1">
                                      <Link 
                                        to={`/patients/${apt.contactId}`} 
                                        className="text-dark text-decoration-none patient-name-link"
                                      >
                                        {getPatientName(apt)}
                                      </Link>
                                    </h6>
                                    <div className="d-flex align-items-center gap-2">
                                      {videoLink && (
                                        <i className="ti ti-video text-info" title="Video appointment"></i>
                                      )}
                                      {!videoLink && (
                                        <i className="ti ti-building text-muted" title="In-person"></i>
                                      )}
                                      <small className="text-muted">{apt.title || "Session"}</small>
                                    </div>
                                  </div>
                                </div>
                                <Link
                                  to={`/patients/${apt.contactId}`}
                                  className="btn btn-sm btn-light"
                                >
                                  <i className="ti ti-chevron-right"></i>
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="row">
              {/* Pending Notes - Appointments that need a note */}
              <div className="col-lg-12 mb-4">
                <div className="card h-100">
                  <div className="card-header d-flex align-items-center justify-content-between">
                    <h5 className="card-title mb-0">
                      <i className="ti ti-file-alert me-2 text-warning"></i>
                      Needs Documentation
                    </h5>
                    {stats.pendingNotes > 0 && (
                      <span className="badge bg-warning text-dark">
                        {stats.pendingNotes} pending
                      </span>
                    )}
                  </div>
                  <div className="card-body p-0">
                    {appointmentsNeedingNotes.length === 0 ? (
                      <div className="text-center py-5 text-muted">
                        <i className="ti ti-check fs-1 mb-2 d-block text-success"></i>
                        <p className="mb-0">All appointments are documented!</p>
                      </div>
                    ) : (
                      <div className="list-group list-group-flush">
                        {appointmentsNeedingNotes.map((apt) => {
                          const patientName = getPatientName(apt);
                          return (
                            <div key={apt.id} className="list-group-item">
                              <div className="d-flex align-items-center justify-content-between">
                                <div>
                                  <h6 className="mb-1">
                                    <Link 
                                      to={`/patients/${apt.contactId}`} 
                                      className="text-dark text-decoration-none patient-name-link"
                                    >
                                      {patientName}
                                    </Link>
                                  </h6>
                                  <small className="text-muted">
                                    <i className="ti ti-calendar me-1"></i>
                                    {formatDate(apt.startTime)} at {formatTime(apt.startTime)}
                                  </small>
                                </div>
                                <Link 
                                  to={`/patients/${apt.contactId}/add-progress-note?appointmentId=${apt.id}&date=${apt.startTime}`}
                                  className="btn btn-sm btn-warning"
                                >
                                  <i className="ti ti-pencil me-1"></i>
                                  Add Note
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  <div className="card-footer bg-transparent">
                    <Link to="/calendar-view" className="btn btn-sm btn-outline-primary">
                      <i className="ti ti-calendar-plus me-1"></i>View Schedule
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Copyright Footer */}
        <div className="copyright-footer text-center py-4 mt-4">
          <p className="text-muted mb-0">
            © {new Date().getFullYear()} LeadDash EHR. All rights reserved.
          </p>
          <p className="text-muted small mb-0">
            A product of LeadDash Marketing LLC
          </p>
        </div>
      </div>

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .avatar-lg {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .bg-primary-light {
          background-color: rgba(13, 110, 253, 0.1);
        }
        
        .bg-success-light {
          background-color: rgba(25, 135, 84, 0.1);
        }
        
        .bg-info-light {
          background-color: rgba(13, 202, 240, 0.1);
        }
        
        .bg-warning-light {
          background-color: rgba(255, 193, 7, 0.1);
        }
        
        .card {
          border: none;
          box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
        }
        
        .card-header {
          background: transparent;
          border-bottom: 1px solid #f1f1f1;
          padding: 1rem 1.25rem;
        }
        
        .list-group-item {
          border-left: none;
          border-right: none;
          padding: 0.875rem 1.25rem;
        }
        
        .list-group-item:first-child {
          border-top: none;
        }
        
        .patient-name-link {
          transition: color 0.2s ease;
        }
        
        .patient-name-link:hover {
          color: #0d6efd !important;
          text-decoration: underline !important;
        }
        
        .copyright-footer {
          border-top: 1px solid #e9ecef;
          margin-top: 2rem;
        }
      `}</style>
    </div>
  );
};

export default UserDashboard;