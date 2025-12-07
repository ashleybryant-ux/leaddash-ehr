import { Link } from "react-router-dom";
import CommonFooter from "../../components/common-footer/commonFooter";
import { all_routes } from "../../routes/all_routes";
import { useState, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import axios from 'axios';
import config from '../../config';

const API_URL = config.apiUrl;
const LOCATION_ID = config.ghlLocationId;
const CALENDAR_ID = 'T2nQIjrOCDbeHce8OII5';

const Calendar = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState({
    title: "",
    description: "",
    date: "",
    id: ""
  });
  const [eventTitle, setEventTitle] = useState("");

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      console.log('📅 Fetching appointments for calendar...');
      
      const response = await axios.get(`${API_URL}/api/appointments`, {
        params: {
          locationId: LOCATION_ID,
          limit: 100
        }
      });

      if (response.data.success) {
        const calendarEvents = response.data.appointments.map((apt: any) => ({
          id: apt.id,
          title: apt.title || 'Appointment',
          start: apt.startTime,
          end: apt.endTime,
          backgroundColor: getEventColor(apt.status),
          borderColor: getEventColor(apt.status),
          extendedProps: {
            description: apt.notes || apt.title || '',
            status: apt.status,
            contactId: apt.contactId,
            contactName: apt.contactName || 'Unknown',
            calendarId: apt.calendarId
          }
        }));
        
        setEvents(calendarEvents);
        console.log(`✅ Loaded ${calendarEvents.length} calendar events`);
      }
    } catch (error) {
      console.error('❌ Error fetching appointments:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const getEventColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return '#28a745';
      case 'cancelled':
        return '#dc3545';
      case 'pending':
        return '#ffc107';
      case 'completed':
        return '#17a2b8';
      default:
        return '#6c5ce7';
    }
  };

  const formatEventDate = (dateStr: string) => {
    if (!dateStr) return 'No date';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleEventClick = (info: any) => {
    const event = info.event;
    setSelectedEvent({
      id: event.id,
      title: event.title,
      description: event.extendedProps.description || event.title,
      date: formatEventDate(event.start)
    });
    
    setTimeout(() => {
      const modal = document.getElementById('event_modal');
      if (modal && (window as any).bootstrap) {
        // @ts-ignore
        const bsModal = new window.bootstrap.Modal(modal);
        bsModal.show();
      }
    }, 100);
  };

  const handleDateClick = () => {
    setTimeout(() => {
      const modal = document.getElementById('add_new');
      if (modal && (window as any).bootstrap) {
        // @ts-ignore
        const bsModal = new window.bootstrap.Modal(modal);
        bsModal.show();
      }
    }, 100);
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent.id) return;

    try {
      console.log('🗑️ Deleting appointment:', selectedEvent.id);
      
      await axios.delete(`${API_URL}/api/appointments/${selectedEvent.id}`, {
        params: { locationId: LOCATION_ID }
      });

      console.log('✅ Appointment deleted');
      
      setEvents(prev => prev.filter(e => e.id !== selectedEvent.id));
      
      const modal = document.getElementById('event_modal');
      if (modal) {
        // @ts-ignore
        const bsModal = window.bootstrap.Modal.getInstance(modal);
        if (bsModal) bsModal.hide();
      }
      
      alert('Appointment deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting appointment:', error);
      alert('Failed to delete appointment');
    }
  };

  const handleAddEvent = async () => {
    if (!eventTitle.trim()) return;

    try {
      console.log('➕ Creating new appointment:', eventTitle);
      
      const newAppointment = {
        title: eventTitle,
        calendarId: CALENDAR_ID,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      };

      const response = await axios.post(
        `${API_URL}/api/appointments`,
        newAppointment,
        {
          params: { locationId: LOCATION_ID }
        }
      );

      if (response.data.success) {
        console.log('✅ Appointment created');
        setEventTitle("");
        fetchAppointments();
        
        const modal = document.getElementById('add_new');
        if (modal) {
          // @ts-ignore
          const bsModal = window.bootstrap.Modal.getInstance(modal);
          if (bsModal) bsModal.hide();
        }
        
        alert('Appointment created successfully');
      }
    } catch (error) {
      console.error('❌ Error creating appointment:', error);
      alert('Failed to create appointment');
    }
  };

  const handleCancelAdd = () => {
    setEventTitle("");
  };

  const handleClose = () => {
    // Modal closes automatically
  };

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-flex align-items-center justify-content-between gap-2 mb-4 flex-wrap">
            <div className="breadcrumb-arrow">
              <h4 className="mb-1">Calendar</h4>
              <div className="text-end">
                <ol className="breadcrumb m-0 py-0">
                  <li className="breadcrumb-item">
                    <Link to={all_routes.dashboard}>Home</Link>
                  </li>
                  <li className="breadcrumb-item active">Calendar</li>
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
              <button
                className="btn btn-primary"
                onClick={handleDateClick}
              >
                <i className="ti ti-square-rounded-plus me-1" />
                Add Event
              </button>
            </div>
          </div>
          {/* End Page Header */}

          {/* LeadDash Status */}
          <div className="alert alert-info mb-3">
            <i className="ti ti-plug-connected me-2" />
            Connected to LeadDash - Showing real calendar appointments
          </div>

          {/* Calendar Card */}
          <div className="card">
            <div className="card-body">
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2">Loading calendar from LeadDash...</p>
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-5">
                  <i className="ti ti-calendar-off fs-48 text-muted mb-3 d-block" />
                  <h5>No Events Found</h5>
                  <p className="text-muted">Start by adding your first event</p>
                  <button
                    className="btn btn-primary mt-2"
                    onClick={handleDateClick}
                  >
                    <i className="ti ti-plus me-1" />
                    Add Event
                  </button>
                </div>
              ) : (
                <FullCalendar
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  headerToolbar={{
                    left: "prev,next today",
                    center: "title",
                    right: "dayGridMonth,timeGridWeek,timeGridDay"
                  }}
                  initialView="dayGridMonth"
                  editable={true}
                  selectable={true}
                  selectMirror={true}
                  dayMaxEvents={true}
                  weekends={true}
                  events={events}
                  eventClick={handleEventClick}
                  dateClick={handleDateClick}
                  height="auto"
                />
              )}
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>

      {/* Add Event Modal */}
      <div className="modal fade" id="add_new">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="text-dark modal-title fw-bold">Add Event</h4>
              <button
                type="button"
                className="btn-close btn-close-modal"
                data-bs-dismiss="modal"
                aria-label="Close"
                onClick={handleCancelAdd}
              >
                <i className="ti ti-circle-x-filled" />
              </button>
            </div>
            <div className="modal-body">
              <div className="row">
                <div className="col-12">
                  <div className="mb-3">
                    <label className="form-label">
                      Event Name <span className="text-danger">*</span>
                    </label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      placeholder="Enter event name"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline-light me-2"
                data-bs-dismiss="modal"
                onClick={handleCancelAdd}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handleAddEvent}
              >
                Add Event
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Event Detail Modal */}
      <div className="modal fade" id="event_modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="text-dark modal-title fw-bold">Event Detail</h4>
              <button
                type="button"
                className="btn-close btn-close-modal"
                data-bs-dismiss="modal"
                aria-label="Close"
                onClick={handleClose}
              >
                <i className="ti ti-circle-x-filled" />
              </button>
            </div>
            <div className="modal-body">
              <h6 className="mb-1">{selectedEvent.title}</h6>
              <p className="mb-3">
                {selectedEvent.description || "No description available"}
              </p>
              <span className="fw-semibold mb-1 d-block">Event Date</span>
              <p className="mb-0">{selectedEvent.date}</p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-light me-2"
                data-bs-dismiss="modal"
                onClick={handleClose}
              >
                Close
              </button>
              <button 
                type="button" 
                className="btn btn-danger"
                onClick={handleDeleteEvent}
              >
                Delete
              </button>
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

        .fc {
          font-family: inherit;
        }

        .fc-event {
          cursor: pointer;
        }

        .fc-event:hover {
          opacity: 0.8;
        }

        .fc .fc-button {
          background-color: #6c5ce7;
          border-color: #6c5ce7;
        }

        .fc .fc-button:hover {
          background-color: #5f50d4;
          border-color: #5f50d4;
        }

        .fc .fc-button:focus {
          box-shadow: none;
        }

        .fc .fc-button-active {
          background-color: #5f50d4 !important;
          border-color: #5f50d4 !important;
        }

        .fc-day-today {
          background-color: rgba(108, 92, 231, 0.1) !important;
        }

        .fc-timegrid-slot-label {
          font-size: 0.85rem;
        }

        .fc-event-title {
          font-weight: 500;
        }
      `}</style>
    </>
  );
};

export default Calendar;