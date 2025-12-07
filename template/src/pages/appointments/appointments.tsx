import { Link, useNavigate } from "react-router-dom";
import CommonFooter from "../../components/common-footer/commonFooter";
import { useState, useEffect } from "react";
import { all_routes } from "../../routes/all_routes";
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = config.apiUrl;
const LOCATION_ID = config.ghlLocationId;

const Appointment = () => {
  const { getUserId } = useAuth();
  const navigate = useNavigate();
  
  // ============================================
  // STATE MANAGEMENT
  // ============================================
  
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('newest');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);
  
  // 🆕 Bulk Selection State
  const [selectedAppointments, setSelectedAppointments] = useState<Set<string>>(new Set());
  const [bulkFilingClaims, setBulkFilingClaims] = useState(false);

  // ============================================
  // FETCH APPOINTMENTS FROM LEADDASH
  // ============================================
  
  useEffect(() => {
    fetchAppointments();
  }, [sortOrder]);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      console.log('📅 Fetching appointments from LeadDash...');
      
      const response = await axios.get(`${API_URL}/api/appointments`, {
        params: {
          userId: getUserId(),
          locationId: LOCATION_ID
        }
      });

      if (response.data.success) {
        let appointmentsData = response.data.appointments || [];
        
        // Fetch patient details for each appointment
        console.log('👥 Enriching appointments with patient data...');
        const enrichedAppointments = await Promise.all(
          appointmentsData.map(async (apt: any) => {
            if (apt.contactId) {
              try {
                const patientResponse = await axios.get(`${API_URL}/api/patients/${apt.contactId}`, {
                  params: { locationId: LOCATION_ID }
                });
                
                if (patientResponse.data.success && patientResponse.data.patient) {
                  return {
                    ...apt,
                    contact: patientResponse.data.patient,
                    contactName: `${patientResponse.data.patient.firstName || ''} ${patientResponse.data.patient.lastName || ''}`.trim()
                  };
                }
              } catch (error) {
                console.warn(`Failed to fetch patient ${apt.contactId}:`, error);
              }
            }
            return apt;
          })
        );
        
        // Sort appointments
        if (sortOrder === 'newest') {
          enrichedAppointments.sort((a: any, b: any) => 
            new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
          );
        } else {
          enrichedAppointments.sort((a: any, b: any) => 
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
          );
        }
        
        setAppointments(enrichedAppointments);
        console.log(`✅ Loaded ${enrichedAppointments.length} appointments with patient data`);
      }
    } catch (error) {
      console.error('❌ Error fetching appointments:', error);
      alert('Failed to load appointments from LeadDash');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // 🆕 BULK SELECTION HANDLERS
  // ============================================
  
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select all completed appointments
      const completedIds = appointments
        .filter(apt => {
          const status = getAppointmentStatus(apt);
          return status.label === 'Completed';
        })
        .map(apt => apt.id);
      setSelectedAppointments(new Set(completedIds));
    } else {
      setSelectedAppointments(new Set());
    }
  };

  const handleSelectAppointment = (appointmentId: string, checked: boolean) => {
    const newSelected = new Set(selectedAppointments);
    if (checked) {
      newSelected.add(appointmentId);
    } else {
      newSelected.delete(appointmentId);
    }
    setSelectedAppointments(newSelected);
  };

  const clearSelection = () => {
    setSelectedAppointments(new Set());
  };

  // ============================================
  // 🆕 BULK CLAIM FILING
  // ============================================
  
  const handleBulkFileClaims = async () => {
    if (selectedAppointments.size === 0) {
      alert('Please select at least one appointment to file claims');
      return;
    }

    const selectedAppts = appointments.filter(apt => selectedAppointments.has(apt.id));
    
    // Check if all selected appointments have patient IDs
    const appointmentsWithoutPatients = selectedAppts.filter(apt => !apt.contactId);
    if (appointmentsWithoutPatients.length > 0) {
      alert(`Cannot file claims: ${appointmentsWithoutPatients.length} selected appointment(s) do not have associated patient records.`);
      return;
    }

    if (!confirm(`File insurance claims for ${selectedAppointments.size} appointment(s)?`)) {
      return;
    }

    setBulkFilingClaims(true);
    const results: any[] = [];

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      for (const appointment of selectedAppts) {
        try {
          console.log(`📋 Filing claim for appointment: ${appointment.id}`);
          
          // Fetch invoices for this patient
          const invoicesResponse = await axios.get(`${API_URL}/api/invoices/${appointment.contactId}`, {
            headers: {
              'x-location-id': user.locationId || LOCATION_ID
            }
          });

          if (invoicesResponse.data.success && invoicesResponse.data.invoices?.length > 0) {
            // Find the most recent unpaid or partially paid invoice
            const eligibleInvoice = invoicesResponse.data.invoices.find((inv: any) => {
              const balance = (inv.total || 0) - (inv.amountPaid || 0);
              return balance > 0;
            });

            if (eligibleInvoice) {
              // Create claim from invoice
              const claimResponse = await axios.post(
                `${API_URL}/api/claims/from-invoice/${eligibleInvoice._id || eligibleInvoice.id}`,
                {
                  contactId: appointment.contactId,
                  invoiceData: eligibleInvoice,
                  appointmentId: appointment.id,
                  appointmentDate: appointment.startTime
                },
                {
                  headers: {
                    'x-location-id': user.locationId || LOCATION_ID
                  }
                }
              );

              if (claimResponse.data.success) {
                results.push({
                  appointmentId: appointment.id,
                  patientName: getPatientName(appointment),
                  success: true,
                  claimNumber: claimResponse.data.claim.claimNumber
                });
              } else {
                results.push({
                  appointmentId: appointment.id,
                  patientName: getPatientName(appointment),
                  success: false,
                  error: claimResponse.data.error || 'Failed to create claim'
                });
              }
            } else {
              results.push({
                appointmentId: appointment.id,
                patientName: getPatientName(appointment),
                success: false,
                error: 'No unpaid invoices found'
              });
            }
          } else {
            results.push({
              appointmentId: appointment.id,
              patientName: getPatientName(appointment),
              success: false,
              error: 'No invoices found for patient'
            });
          }
        } catch (error: any) {
          console.error(`❌ Error filing claim for appointment ${appointment.id}:`, error);
          results.push({
            appointmentId: appointment.id,
            patientName: getPatientName(appointment),
            success: false,
            error: error.response?.data?.error || error.message
          });
        }
      }

      // Show results summary
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      let message = `✅ Successfully filed ${successful.length} claim(s)\n`;
      
      if (failed.length > 0) {
        message += `\n❌ Failed to file ${failed.length} claim(s):\n`;
        failed.forEach(f => {
          message += `  • ${f.patientName}: ${f.error}\n`;
        });
      }

      alert(message);
      
      // Clear selection
      clearSelection();

      // Navigate to claims page if at least one was successful
      if (successful.length > 0) {
        if (confirm('Would you like to view the insurance claims page?')) {
          navigate('/insurance/claims');
        }
      }

    } catch (error) {
      console.error('❌ Error in bulk claim filing:', error);
      alert('An unexpected error occurred while filing claims');
    } finally {
      setBulkFilingClaims(false);
    }
  };

  // ============================================
  // DELETE APPOINTMENT
  // ============================================
  
  const handleDeleteAppointment = async () => {
    if (!appointmentToDelete) return;

    setDeleteLoading(true);
    try {
      console.log('🗑️ Deleting appointment:', appointmentToDelete);
      
      await axios.delete(`${API_URL}/api/appointments/${appointmentToDelete}`, {
        params: { locationId: LOCATION_ID }
      });

      console.log('✅ Appointment deleted');
      
      setAppointments(prev => prev.filter(apt => apt.id !== appointmentToDelete));
      
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
      setAppointmentToDelete(null);
    }
  };

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  
  const formatTimeRange = (startTime: string, endTime: string) => {
    if (!startTime) return 'N/A';
    
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date(start.getTime() + 60 * 60 * 1000);
    
    const dateStr = start.toLocaleDateString('en-US', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric'
    });
    
    const startTimeStr = start.toLocaleTimeString('en-US', { 
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    const endTimeStr = end.toLocaleTimeString('en-US', { 
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    return `${dateStr}, ${startTimeStr} to ${endTimeStr}`;
  };

  const getAppointmentStatus = (appointment: any) => {
    const now = new Date();
    const aptDate = new Date(appointment.startTime);
    const endDate = appointment.endTime ? new Date(appointment.endTime) : new Date(aptDate.getTime() + 60 * 60 * 1000);
    
    if (appointment.appointmentStatus === 'confirmed' && aptDate > now) {
      return { label: 'Upcoming', class: 'badge-soft-purple' };
    } else if (appointment.appointmentStatus === 'completed' || appointment.appointmentStatus === 'showed' || endDate < now) {
      return { label: 'Completed', class: 'badge-soft-success' };
    } else if (appointment.appointmentStatus === 'cancelled') {
      return { label: 'Cancelled', class: 'badge-soft-danger' };
    } else if (now >= aptDate && now <= endDate) {
      return { label: 'In Progress', class: 'badge-soft-info' };
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

  const getPatientName = (appointment: any) => {
    if (appointment.contactName && appointment.contactName !== ' ') {
      return appointment.contactName;
    }
    
    if (appointment.contact) {
      const firstName = appointment.contact.firstName || '';
      const lastName = appointment.contact.lastName || '';
      const fullName = `${firstName} ${lastName}`.trim();
      if (fullName) return fullName;
    }
    
    if (appointment.title && !appointment.title.toLowerCase().includes('appointment')) {
      return appointment.title;
    }
    
    return 'Walk-in Patient';
  };

  const getPatientId = (appointment: any) => {
    if (appointment.contactId) {
      return `#PT${appointment.contactId.substring(0, 4).toUpperCase()}`;
    }
    return '#PT0000';
  };

  const getPatientDetailsLink = (appointment: any) => {
    if (appointment.contactId) {
      return `/patients/${appointment.contactId}`;
    }
    return '#';
  };

  // Check if appointment is selectable (completed and has patient)
  const isAppointmentSelectable = (appointment: any) => {
    const status = getAppointmentStatus(appointment);
    return status.label === 'Completed' && appointment.contactId;
  };

  const allSelectableSelected = () => {
    const selectableAppointments = appointments.filter(isAppointmentSelectable);
    if (selectableAppointments.length === 0) return false;
    return selectableAppointments.every(apt => selectedAppointments.has(apt.id));
  };

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex align-items-center justify-content-between gap-2 mb-4 flex-wrap">
            <div className="breadcrumb-arrow">
              <h4 className="mb-1">Appointments</h4>
              <div className="text-end">
                <ol className="breadcrumb m-0 py-0">
                  <li className="breadcrumb-item">
                    <Link to={all_routes.dashboard}>Home</Link>
                  </li>
                  <li className="breadcrumb-item active">Appointments</li>
                </ol>
              </div>
            </div>
            <div className="gap-2 d-flex align-items-center flex-wrap">
              <button
                onClick={fetchAppointments}
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
            </div>
          </div>

          <div className="alert alert-info mb-3">
            <i className="ti ti-plug-connected me-2" />
            Connected to LeadDash - Showing real calendar appointments with patient data
          </div>

          {/* 🆕 Bulk Action Bar */}
          {selectedAppointments.size > 0 && (
            <div className="alert alert-primary d-flex align-items-center justify-content-between mb-3">
              <div>
                <i className="ti ti-checkbox me-2" />
                <strong>{selectedAppointments.size}</strong> appointment(s) selected
              </div>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-success btn-sm"
                  onClick={handleBulkFileClaims}
                  disabled={bulkFilingClaims}
                >
                  {bulkFilingClaims ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" />
                      Filing Claims...
                    </>
                  ) : (
                    <>
                      <i className="ti ti-file-invoice me-1" />
                      File Insurance Claims ({selectedAppointments.size})
                    </>
                  )}
                </button>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={clearSelection}
                  disabled={bulkFilingClaims}
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          <div className="card mb-0">
            <div className="card-header d-flex align-items-center flex-wrap gap-2 justify-content-between">
              <h5 className="d-inline-flex align-items-center mb-0">
                Total Appointments
                <span className="badge bg-danger ms-2">{appointments.length}</span>
              </h5>
              <div className="d-flex align-items-center flex-wrap gap-2">
                <div className="dropdown">
                  <Link
                    to="#"
                    className="dropdown-toggle btn btn-md btn-outline-light d-inline-flex align-items-center"
                    data-bs-toggle="dropdown"
                    aria-label="Sort options menu" 
                    aria-haspopup="true" 
                    aria-expanded="false"
                  >
                    <i className="ti ti-sort-descending-2 me-1" />
                    <span className="me-1">Sort By : </span> {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
                  </Link>
                  <ul className="dropdown-menu dropdown-menu-end p-2">
                    <li>
                      <button 
                        className="dropdown-item rounded-1"
                        onClick={() => setSortOrder('newest')}
                      >
                        Newest
                      </button>
                    </li>
                    <li>
                      <button 
                        className="dropdown-item rounded-1"
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

              {!loading && appointments.length === 0 && (
                <div className="text-center py-5">
                  <i className="ti ti-calendar-off fs-48 text-muted mb-3 d-block" />
                  <h5>No Appointments Found</h5>
                  <p className="text-muted">No appointments scheduled in GHL</p>
                </div>
              )}

              {!loading && appointments.length > 0 && (
                <div className="table-responsive table-nowrap">
                  <table className="table mb-0 border">
                    <thead className="table-light">
                      <tr>
                        {/* 🆕 Select All Checkbox */}
                        <th style={{ width: '40px' }}>
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={allSelectableSelected()}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            disabled={bulkFilingClaims}
                          />
                        </th>
                        <th>Patient ID</th>
                        <th>Patient Name</th>
                        <th>Title</th>
                        <th className="no-sort">Calendar</th>
                        <th className="no-sort">Appointment Date</th>
                        <th className="no-sort">Status</th>
                        <th className="no-sort" />
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.map((appointment) => {
                        const status = getAppointmentStatus(appointment);
                        const patientName = getPatientName(appointment);
                        const patientId = getPatientId(appointment);
                        const patientLink = getPatientDetailsLink(appointment);
                        const selectable = isAppointmentSelectable(appointment);
                        const isSelected = selectedAppointments.has(appointment.id);
                        
                        return (
                          <tr 
                            key={appointment.id}
                            className={isSelected ? 'table-active' : ''}
                          >
                            {/* 🆕 Row Checkbox */}
                            <td>
                              {selectable ? (
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={isSelected}
                                  onChange={(e) => handleSelectAppointment(appointment.id, e.target.checked)}
                                  disabled={bulkFilingClaims}
                                />
                              ) : (
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  disabled
                                  title={!appointment.contactId ? 'No patient record' : 'Not completed'}
                                />
                              )}
                            </td>
                            <td>
                              {appointment.contactId ? (
                                <Link to={patientLink}>
                                  {patientId}
                                </Link>
                              ) : (
                                <span className="text-muted">{patientId}</span>
                              )}
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
                                    {appointment.contactId ? (
                                      <Link to={patientLink}>
                                        {patientName}
                                      </Link>
                                    ) : (
                                      <span>{patientName}</span>
                                    )}
                                  </h6>
                                  {appointment.contact?.email && (
                                    <span className="fs-11 text-muted d-block">
                                      {appointment.contact.email}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="text-truncate" style={{ maxWidth: '200px' }}>
                                {appointment.title || 'Appointment'}
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-soft-info">
                                {appointment.calendarName || 'Calendar'}
                              </span>
                            </td>
                            <td>{formatTimeRange(appointment.startTime, appointment.endTime)}</td>
                            <td>
                              <span className={`badge ${status.class}`}>
                                {status.label}
                              </span>
                            </td>
                            <td className="text-end">
                              <Link
                                to="#"
                                className="btn btn-icon btn-sm btn-outline-light"
                                data-bs-toggle="dropdown"
                                aria-label="Appointment actions menu" 
                                aria-haspopup="true" 
                                aria-expanded="false"
                              >
                                <i className="ti ti-dots-vertical" aria-hidden="true" />
                              </Link>
                              <ul className="dropdown-menu p-2">
                                <li>
                                  <Link
                                    to={patientLink}
                                    className="dropdown-item d-flex align-items-center"
                                  >
                                    <i className="ti ti-eye me-1" />
                                    View Patient
                                  </Link>
                                </li>
                                <li>
                                  <button
                                    className="dropdown-item d-flex align-items-center text-danger"
                                    data-bs-toggle="modal"
                                    data-bs-target="#delete_modal"
                                    onClick={() => setAppointmentToDelete(appointment.id)}
                                  >
                                    <i className="ti ti-trash me-1" />
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
                  onClick={handleDeleteAppointment}
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

        .table-active {
          background-color: rgba(13, 110, 253, 0.05);
        }

        .form-check-input:disabled {
          opacity: 0.3;
        }
      `}</style>
    </>
  );
};

export default Appointment;