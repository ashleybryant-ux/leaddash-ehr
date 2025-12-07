import { Link } from "react-router-dom";
import CommonFooter from "../../components/common-footer/commonFooter";
import { all_routes } from "../../routes/all_routes";
import { useState, useEffect } from "react";
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = config.apiUrl;
const LOCATION_ID = config.ghlLocationId;

// Mental Health Visit Types with CPT Codes
const MENTAL_HEALTH_VISIT_TYPES = {
  'intake': { name: 'Initial Psychiatric Evaluation', cpt: '90791', duration: 60 },
  'therapy-individual': { name: 'Individual Therapy (45 min)', cpt: '90834', duration: 45 },
  'therapy-individual-extended': { name: 'Individual Therapy (60 min)', cpt: '90837', duration: 60 },
  'therapy-family': { name: 'Family Therapy', cpt: '90847', duration: 50 },
  'therapy-group': { name: 'Group Therapy', cpt: '90853', duration: 60 },
  'medication-management': { name: 'Medication Management', cpt: '90863', duration: 30 },
  'psychiatric-eval': { name: 'Psychiatric Evaluation', cpt: '90792', duration: 60 },
  'crisis': { name: 'Crisis Intervention', cpt: '90839', duration: 60 },
  'follow-up': { name: 'Follow-up Visit', cpt: '99213', duration: 30 },
  'telehealth': { name: 'Telehealth Session', cpt: '90834-95', duration: 45 },
};

const Visits = () => {
  const { getUserId, user } = useAuth();
  
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('newest');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [visitToDelete, setVisitToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchVisits();
  }, [sortOrder]);

  const fetchVisits = async () => {
    setLoading(true);
    try {
      console.log('📅 Fetching appointments from LeadDash...');
      
      const userId = getUserId();
      
      if (!userId) {
        console.error('No user ID found');
        setLoading(false);
        return;
      }
      
      const response = await axios.get(`${API_URL}/api/appointments`, {
        params: {
          locationId: LOCATION_ID,
          userId: userId
        }
      });

      if (response.data.success) {
        let appointments = response.data.appointments || [];
        
        if (sortOrder === 'newest') {
          appointments.sort((a: any, b: any) => 
            new Date(b.startTime || b.dateAdded).getTime() - new Date(a.startTime || a.dateAdded).getTime()
          );
        } else {
          appointments.sort((a: any, b: any) => 
            new Date(a.startTime || a.dateAdded).getTime() - new Date(b.startTime || b.dateAdded).getTime()
          );
        }

        setVisits(appointments);
        console.log(`✅ Loaded ${appointments.length} appointments`);
      }
    } catch (error) {
      console.error('❌ Error fetching appointments:', error);
      alert('Failed to load appointments from LeadDash');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVisit = async () => {
    if (!visitToDelete) return;

    setDeleteLoading(true);
    try {
      console.log('🗑️ Deleting appointment:', visitToDelete);
      
      await axios.delete(`${API_URL}/api/appointments/${visitToDelete}`, {
        params: { locationId: LOCATION_ID }
      });

      console.log('✅ Appointment deleted');
      
      setVisits(prev => prev.filter(v => v.id !== visitToDelete));
      
      const modal = document.getElementById('delete_modal');
      if (modal) {
        // @ts-ignore
        const bsModal = window.bootstrap.Modal.getInstance(modal);
        if (bsModal) bsModal.hide();
      }
      
      alert('Appointment deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting appointment:', error);
      alert('Failed to delete appointment');
    } finally {
      setDeleteLoading(false);
      setVisitToDelete(null);
    }
  };

  const formatDate = (dateString: string | number) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusFromAppointment = (appointment: any) => {
    const now = new Date();
    const appointmentDate = new Date(appointment.startTime || appointment.dateAdded);
    const endTime = appointment.endTime ? new Date(appointment.endTime) : new Date(appointmentDate.getTime() + 60 * 60 * 1000);
    
    if (endTime < now) {
      return { label: 'Completed', class: 'badge-soft-success' };
    }
    
    if (appointmentDate > now) {
      return { label: 'Upcoming', class: 'badge-soft-purple' };
    }
    
    if (appointmentDate <= now && endTime >= now) {
      return { label: 'In Progress', class: 'badge-soft-info' };
    }
    
    const status = appointment.appointmentStatus?.toLowerCase() || '';
    if (status === 'cancelled') {
      return { label: 'Cancelled', class: 'badge-soft-danger' };
    }
    
    return { label: 'Scheduled', class: 'badge-soft-warning' };
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getVisitId = (visit: any, index: number) => {
    return `#VS${String(visits.length - index).padStart(4, '0')}`;
  };

  const getVisitTypeFromAppointment = (appointment: any) => {
    const title = appointment.title?.toLowerCase() || '';
    const calendarName = appointment.calendarName?.toLowerCase() || '';
    const notes = appointment.notes?.toLowerCase() || '';
    const combined = `${title} ${calendarName} ${notes}`;

    if (combined.includes('intake') || combined.includes('initial')) {
      return MENTAL_HEALTH_VISIT_TYPES['intake'];
    }
    if (combined.includes('family')) {
      return MENTAL_HEALTH_VISIT_TYPES['therapy-family'];
    }
    if (combined.includes('group')) {
      return MENTAL_HEALTH_VISIT_TYPES['therapy-group'];
    }
    if (combined.includes('medication') || combined.includes('med management')) {
      return MENTAL_HEALTH_VISIT_TYPES['medication-management'];
    }
    if (combined.includes('psychiatric') || combined.includes('psych eval')) {
      return MENTAL_HEALTH_VISIT_TYPES['psychiatric-eval'];
    }
    if (combined.includes('crisis') || combined.includes('emergency')) {
      return MENTAL_HEALTH_VISIT_TYPES['crisis'];
    }
    if (combined.includes('follow') || combined.includes('followup')) {
      return MENTAL_HEALTH_VISIT_TYPES['follow-up'];
    }
    if (combined.includes('telehealth') || combined.includes('virtual') || combined.includes('online')) {
      return MENTAL_HEALTH_VISIT_TYPES['telehealth'];
    }
    if (combined.includes('individual') || combined.includes('therapy')) {
      if (combined.includes('45')) {
        return MENTAL_HEALTH_VISIT_TYPES['therapy-individual'];
      }
      return MENTAL_HEALTH_VISIT_TYPES['therapy-individual-extended'];
    }

    return MENTAL_HEALTH_VISIT_TYPES['therapy-individual-extended'];
  };

  const getPatientName = (appointment: any) => {
    if (appointment.contact?.name) return appointment.contact.name;
    if (appointment.contactName) return appointment.contactName;
    if (appointment.title) return appointment.title;
    return 'Unknown Patient';
  };

  const getPatientId = (appointment: any) => {
    return appointment.contactId || appointment.contact?.id || '';
  };

  const getTherapistName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user?.firstName) {
      return user.firstName;
    }
    return 'Therapist';
  };

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex align-items-center justify-content-between gap-2 mb-4 flex-wrap">
            <div className="breadcrumb-arrow">
              <h4 className="mb-1">Visits</h4>
              <div className="text-end">
                <ol className="breadcrumb m-0 py-0">
                  <li className="breadcrumb-item">
                    <Link to={all_routes.dashboard}>Home</Link>
                  </li>
                  <li className="breadcrumb-item active">Visits</li>
                </ol>
              </div>
            </div>
            <div className="gap-2 d-flex align-items-center flex-wrap">
              <button
                onClick={fetchVisits}
                className="btn btn-icon btn-white"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                aria-label="Refresh visits list"
                data-bs-original-title="Refresh"
                disabled={loading}
              >
                <i className={`ti ti-refresh ${loading ? 'spin' : ''}`} aria-hidden="true" />
              </button>
              <Link
                to="#"
                className="btn btn-icon btn-white"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                aria-label="Print visits list"
                data-bs-original-title="Print"
              >
                <i className="ti ti-printer" aria-hidden="true" />
              </Link>
              <Link
                to="#"
                className="btn btn-icon btn-white"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                aria-label="Download visits data"
                data-bs-original-title="Download"
              >
                <i className="ti ti-cloud-download" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="alert alert-info mb-3">
            <i className="ti ti-plug-connected me-2" />
            Connected to LeadDash - Showing appointments as visits with CPT codes
          </div>

          <div className="card mb-0">
            <div className="card-header d-flex align-items-center flex-wrap gap-2 justify-content-between">
              <h5 className="d-inline-flex align-items-center mb-0">
                Total Visits<span className="badge bg-danger ms-2">{visits.length}</span>
              </h5>
              <div className="d-flex align-items-center">
                <div className="dropdown">
                  <Link
                    to="#"
                    className="dropdown-toggle btn btn-md btn-outline-light d-inline-flex align-items-center"
                    data-bs-toggle="dropdown"
                    aria-haspopup="true"
                    aria-expanded="false"
                    aria-label="Sort visits by"
                  >
                    <i className="ti ti-sort-descending-2 me-1" aria-hidden="true" />
                    <span className="me-1">Sort By : </span> {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
                  </Link>
                  <ul className="dropdown-menu dropdown-menu-end p-2" role="menu">
                    <li>
                      <button 
                        type="button" 
                        className="dropdown-item rounded-1" 
                        role="menuitem"
                        onClick={() => setSortOrder('newest')}
                      >
                        Newest
                      </button>
                    </li>
                    <li>
                      <button 
                        type="button" 
                        className="dropdown-item rounded-1" 
                        role="menuitem"
                        onClick={() => setSortOrder('oldest')}
                      >
                        Oldest
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="card-body">
              {loading && (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2">Loading appointments from LeadDash...</p>
                </div>
              )}

              {!loading && visits.length === 0 && (
                <div className="text-center py-5">
                  <i className="ti ti-calendar-off fs-48 text-muted mb-3 d-block" />
                  <h5>No Appointments Found</h5>
                  <p className="text-muted">No appointments scheduled yet</p>
                </div>
              )}

              {!loading && visits.length > 0 && (
                <div className="table-responsive table-nowrap">
                  <table className="table mb-0 border">
                    <thead className="table-light">
                      <tr>
                        <th>Visit ID</th>
                        <th>Patient Name</th>
                        <th className="no-sort">Visit Type</th>
                        <th className="no-sort">CPT Code</th>
                        <th>Therapist</th>
                        <th className="no-sort">Visit Date</th>
                        <th>Status</th>
                        <th className="no-sort" />
                      </tr>
                    </thead>
                    <tbody>
                      {visits.map((visit, index) => {
                        const status = getStatusFromAppointment(visit);
                        const visitId = getVisitId(visit, index);
                        const visitType = getVisitTypeFromAppointment(visit);
                        const patientName = getPatientName(visit);
                        const patientId = getPatientId(visit);
                        const therapistName = getTherapistName();
                        
                        return (
                          <tr key={visit.id}>
                            <td>
                              <Link to={all_routes.startVisits} aria-label={`Start visit for ${patientName}`}>
                                {visitId}
                              </Link>
                            </td>
                            <td>
                              <div className="d-flex align-items-center">
                                <div className="avatar avatar-xs me-2 bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center">
                                  <span className="fs-10 fw-bold">
                                    {getInitials(patientName)}
                                  </span>
                                </div>
                                <div>
                                  <h6 className="fs-14 mb-0 fw-medium">
                                    {patientId ? (
                                      <Link to={`/patients/${patientId}`}>
                                        {patientName}
                                      </Link>
                                    ) : (
                                      patientName
                                    )}
                                  </h6>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="fs-13">{visitType.name}</span>
                              <br />
                              <span className="text-muted fs-11">{visitType.duration} min</span>
                            </td>
                            <td>
                              <span className="badge badge-soft-primary fs-12">
                                {visitType.cpt}
                              </span>
                            </td>
                            <td>
                              <span className="fs-14">
                                {therapistName}
                              </span>
                            </td>
                            <td>{formatDate(visit.startTime || visit.dateAdded)}</td>
                            <td>
                              <span className={`badge ${status.class}`}>
                                {status.label}
                              </span>
                            </td>
                            <td className="text-end">
                              <button
                                type="button"
                                className="btn btn-icon btn-outline-light"
                                data-bs-toggle="dropdown"
                                aria-label="Visit actions menu"
                                aria-haspopup="true"
                                aria-expanded="false"
                              >
                                <i className="ti ti-dots-vertical" aria-hidden="true" />
                              </button>
                              <ul className="dropdown-menu p-2" role="menu">
                                <li>
                                  <Link
                                    to={all_routes.startVisits}
                                    className="dropdown-item d-flex align-items-center"
                                    role="menuitem"
                                  >
                                    <i className="ti ti-eye me-1" aria-hidden="true" />
                                    View Details
                                  </Link>
                                </li>
                                <li>
                                  <button
                                    type="button"
                                    className="dropdown-item d-flex align-items-center text-danger"
                                    data-bs-toggle="modal"
                                    data-bs-target="#delete_modal"
                                    role="menuitem"
                                    onClick={() => setVisitToDelete(visit.id)}
                                  >
                                    <i className="ti ti-trash me-1" aria-hidden="true" />
                                    Delete
                                  </button>
                                </li>
                              </ul>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>

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
              <p className="mb-3">
                Are you sure you want to delete this appointment from LeadDash?
              </p>
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
                  onClick={handleDeleteVisit}
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

export default Visits;