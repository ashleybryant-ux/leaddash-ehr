import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { logAudit } from '../../services/auditService';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

interface Appointment {
  id: string;
  contactId: string;
  title?: string;
  startTime: string;
  endTime?: string;
  appointmentStatus?: string;
  calendarId?: string;
  assignedUserId?: string;
  address?: string;
  locationId?: string;
  meetingLocationType?: string;
  // Meeting link fields from GHL
  googleMeetLink?: string;
  zoomLink?: string;
  meetLink?: string;
  locationAddress?: string;
  calendarName?: string;
  contact?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
}

interface Patient {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  insurancePrimaryCarrier?: string;
  insurancePrimaryMemberId?: string;
  primaryDiagnosisCode?: string;
  secondaryDiagnosisCode?: string;
  customFields?: any[];
}

interface ProgressNote {
  id: string;
  patientId: string;
  appointmentId?: string;
  sessionDate: string;
  status: string;
}

interface User {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

const CalendarView: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<{ [key: string]: Patient }>({});
  const [progressNotes, setProgressNotes] = useState<ProgressNote[]>([]);
  const [users, setUsers] = useState<{ [key: string]: User }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Popup state
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const [showPopup, setShowPopup] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // Filter state
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Calculate date range for fetching appointments
  const getDateRange = () => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);
    
    if (viewMode === "day") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (viewMode === "week") {
      // Start of week (Sunday)
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
      // End of week (Saturday)
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (viewMode === "month") {
      // Start of month
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      // End of month
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
    }
    
    return { startTime: start.toISOString(), endTime: end.toISOString() };
  };

  useEffect(() => {
    fetchData();
  }, [currentDate, viewMode]);

  useEffect(() => {
    // Close popup when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setShowPopup(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const locationId = localStorage.getItem("locationId");
    const userId = localStorage.getItem("userId");

    if (!locationId) {
      setError("Location ID not found. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      const { startTime, endTime } = getDateRange();
      
      console.log("📅 Fetching calendar data...");
      console.log("   Location:", locationId);
      console.log("   Date range:", startTime, "to", endTime);

      // FIRST: Fetch patients so we have the names ready
      let patientMap: { [key: string]: Patient } = {};
      try {
        const patientsResponse = await fetch(
          `${API_URL}/api/patients?locationId=${locationId}&limit=500`
        );
        const patientsData = await patientsResponse.json();
        if (patientsData.success) {
          (patientsData.patients || []).forEach((p: Patient) => {
            patientMap[p.id] = p;
          });
          console.log(`✅ Loaded ${Object.keys(patientMap).length} patients into map`);
          setPatients(patientMap);
        }
      } catch (patientsErr) {
        console.warn("Could not fetch patients:", patientsErr);
      }

      // SECOND: Fetch appointments with date range - GHL Calendar API requires startTime and endTime
      const appointmentsResponse = await fetch(
        `${API_URL}/api/appointments?locationId=${locationId}&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`
      );
      const appointmentsData = await appointmentsResponse.json();
      
      if (appointmentsData.success) {
        console.log(`✅ Fetched ${appointmentsData.appointments?.length || 0} appointments`);
        // Debug: log all appointments with their dates and patient lookup
        if (appointmentsData.appointments?.length > 0) {
          console.log("📋 All appointments:");
          appointmentsData.appointments.forEach((apt: Appointment) => {
            const aptDate = new Date(apt.startTime);
            const patient = patientMap[apt.contactId];
            const patientName = patient 
              ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || patient.name || 'Unknown'
              : 'NOT IN MAP';
            console.log(`   ${aptDate.toLocaleDateString()} ${aptDate.toLocaleTimeString()} - ${patientName} (${apt.contactId})`);
          });
        }
        setAppointments(appointmentsData.appointments || []);
      } else {
        console.warn("⚠️ Appointments fetch returned:", appointmentsData);
        setAppointments([]);
      }

      // Fetch progress notes to check which appointments have notes
      try {
        const notesResponse = await fetch(
          `${API_URL}/api/progress-notes?locationId=${locationId}`
        );
        const notesData = await notesResponse.json();
        if (notesData.success) {
          setProgressNotes(notesData.notes || []);
        }
      } catch (notesErr) {
        console.warn("Could not fetch progress notes:", notesErr);
      }

      // Fetch users/clinicians
      try {
        const usersResponse = await fetch(
          `${API_URL}/api/users?locationId=${locationId}`
        );
        const usersData = await usersResponse.json();
        if (usersData.success) {
          const userMap: { [key: string]: User } = {};
          (usersData.users || []).forEach((u: User) => {
            userMap[u.id] = u;
          });
          setUsers(userMap);
        }
      } catch (usersErr) {
        console.warn("Could not fetch users:", usersErr);
      }
    } catch (err) {
      console.error("Error fetching calendar data:", err);
      setError("Failed to load calendar data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Get week dates
  const getWeekDates = (date: Date) => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const weekDates = getWeekDates(currentDate);

  // Navigate functions
  const goToToday = () => setCurrentDate(new Date());
  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "week") newDate.setDate(newDate.getDate() - 7);
    else if (viewMode === "day") newDate.setDate(newDate.getDate() - 1);
    else newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };
  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "week") newDate.setDate(newDate.getDate() + 7);
    else if (viewMode === "day") newDate.setDate(newDate.getDate() + 1);
    else newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  // Format date header
  const formatDateRange = () => {
    const options: Intl.DateTimeFormatOptions = { month: "short", year: "numeric" };
    if (viewMode === "week") {
      const start = weekDates[0];
      const end = weekDates[6];
      if (start.getMonth() === end.getMonth()) {
        return `${start.toLocaleDateString("en-US", { month: "long" })} ${start.getFullYear()}`;
      }
      return `${start.toLocaleDateString("en-US", { month: "short" })} - ${end.toLocaleDateString("en-US", options)}`;
    }
    return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  // Get appointments for a specific day - handles timezone properly
  const getAppointmentsForDay = (date: Date) => {
    // Get year, month, day for the target date in local timezone
    const targetYear = date.getFullYear();
    const targetMonth = date.getMonth();
    const targetDay = date.getDate();
    
    return appointments.filter((apt) => {
      // Parse the appointment start time
      const aptDate = new Date(apt.startTime);
      // Compare in local timezone
      const aptYear = aptDate.getFullYear();
      const aptMonth = aptDate.getMonth();
      const aptDay = aptDate.getDate();
      
      const matchesDate = aptYear === targetYear && aptMonth === targetMonth && aptDay === targetDay;
      const matchesUser = selectedUser === "all" || apt.assignedUserId === selectedUser;
      const matchesStatus = statusFilter === "all" || 
        (apt.appointmentStatus || "").toLowerCase() === statusFilter.toLowerCase();
      return matchesDate && matchesUser && matchesStatus;
    }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  };

  // Get patient name - GHL Calendar Events don't include contact details,
  // so we need to look up the patient from our patients map using contactId
  const getPatientName = (apt: Appointment, abbreviated = false) => {
    let fullName = "";
    
    // FIRST: Try the patients map (most reliable since GHL calendar events don't include contact details)
    if (apt.contactId && patients[apt.contactId]) {
      const patient = patients[apt.contactId];
      if (patient.name && patient.name.trim()) {
        fullName = patient.name.trim();
      } else if (patient.firstName || patient.lastName) {
        fullName = `${patient.firstName || ""} ${patient.lastName || ""}`.trim();
      }
    }
    
    // SECOND: Try the contact embedded in the appointment (in case GHL changes behavior)
    if (!fullName && apt.contact) {
      if (apt.contact.name && apt.contact.name.trim()) {
        fullName = apt.contact.name.trim();
      } else if (apt.contact.firstName || apt.contact.lastName) {
        fullName = `${apt.contact.firstName || ""} ${apt.contact.lastName || ""}`.trim();
      }
    }
    
    // THIRD: Check if title looks like a name (not a CPT code)
    if (!fullName && apt.title) {
      // CPT codes are typically 5 digits, skip those
      const isCptCode = /^\d{5}$/.test(apt.title.trim());
      const isGenericTitle = apt.title.toLowerCase().includes("appointment") || 
                             apt.title.toLowerCase().includes("session");
      if (!isCptCode && !isGenericTitle) {
        fullName = apt.title;
      }
    }
    
    // Final fallback
    if (!fullName) {
      return "Client";
    }
    
    if (abbreviated) {
      const parts = fullName.split(" ");
      const firstInitial = parts[0] ? parts[0].charAt(0) : "";
      const lastInitial = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
      if (firstInitial && lastInitial) {
        return `${firstInitial}. ${lastInitial}.`;
      }
      return fullName.charAt(0) + ".";
    }
    
    return fullName;
  };

  // Get location icon - show video icon if there's a meeting link, otherwise building
  const getLocationIcon = (apt: Appointment) => {
    // Check if appointment has any video meeting link
    const hasVideoLink = apt.googleMeetLink || 
                         apt.zoomLink || 
                         apt.meetLink ||
                         (apt.address && (
                           apt.address.includes('meet.google.com') ||
                           apt.address.includes('zoom.us') ||
                           apt.address.includes('teams.microsoft.com') ||
                           apt.address.includes('webex.com')
                         )) ||
                         (apt.locationAddress && (
                           apt.locationAddress.includes('meet.google.com') ||
                           apt.locationAddress.includes('zoom.us') ||
                           apt.locationAddress.includes('teams.microsoft.com') ||
                           apt.locationAddress.includes('webex.com')
                         ));
    
    if (hasVideoLink) {
      return (
        <span className="location-icon video" title="Video Meeting">
          <i className="ti ti-video"></i>
        </span>
      );
    }
    
    // Default: In-person (building icon)
    return (
      <span className="location-icon office" title="In-Person">
        <i className="ti ti-building"></i>
      </span>
    );
  };

  // Get status color
  const getStatusColor = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "confirmed" || s === "scheduled") return "#4CAF50";
    if (s === "showed" || s === "completed") return "#2196F3";
    if (s === "cancelled" || s === "canceled") return "#f44336";
    if (s === "no show" || s === "noshow" || s === "no_show") return "#ff9800";
    if (s === "pending" || s === "unconfirmed") return "#9e9e9e";
    return "#4CAF50"; // default green
  };

  // Check if appointment has progress note
  const hasProgressNote = (appointmentId: string, contactId: string, date: string) => {
    const dateStr = new Date(date).toISOString().split("T")[0];
    return progressNotes.some(
      (note) =>
        note.appointmentId === appointmentId ||
        (note.patientId === contactId && note.sessionDate.split("T")[0] === dateStr)
    );
  };

  // Get video meeting link - check all possible GHL fields
  const getVideoLink = (apt: Appointment) => {
    // Direct meeting link fields
    if (apt.googleMeetLink) return apt.googleMeetLink;
    if (apt.zoomLink) return apt.zoomLink;
    if (apt.meetLink) return apt.meetLink;
    
    // Check locationAddress field (GHL sometimes puts the link here)
    if (apt.locationAddress) {
      if (apt.locationAddress.includes("meet.google.com") || 
          apt.locationAddress.includes("zoom.us") ||
          apt.locationAddress.includes("teams.microsoft.com") ||
          apt.locationAddress.includes("webex.com")) {
        return apt.locationAddress;
      }
    }
    
    // Check address field
    if (apt.address) {
      if (apt.address.includes("meet.google.com") || 
          apt.address.includes("zoom.us") ||
          apt.address.includes("teams.microsoft.com") ||
          apt.address.includes("webex.com") ||
          apt.address.startsWith("http")) {
        return apt.address;
      }
    }
    
    return null;
  };

  // Handle appointment click - WITH AUDIT LOGGING
  const handleAppointmentClick = async (apt: Appointment, event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Calculate popup position
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let left = rect.right + 10;
    let top = rect.top;
    
    // Adjust if popup would go off screen
    if (left + 400 > viewportWidth) {
      left = rect.left - 410;
    }
    if (top + 500 > viewportHeight) {
      top = viewportHeight - 520;
    }
    if (top < 10) top = 10;
    
    setPopupPosition({ top, left });
    setSelectedAppointment(apt);
    
    // Get patient name for audit log
    const patientName = getPatientName(apt);
    
    // Audit: Log viewing appointment details
    logAudit({
      action: 'VIEW',
      resourceType: 'appointment',
      resourceId: apt.id,
      patientId: apt.contactId,
      patientName: patientName,
      description: `Viewed appointment details for ${patientName} on ${new Date(apt.startTime).toLocaleDateString()}`,
      metadata: {
        appointmentDate: apt.startTime,
        appointmentStatus: apt.appointmentStatus,
        clinicianId: apt.assignedUserId,
        hasVideoLink: !!getVideoLink(apt)
      }
    });
    
    // Use contact from appointment or fetch patient details
    let patient = apt.contact ? {
      id: apt.contactId,
      firstName: apt.contact.firstName,
      lastName: apt.contact.lastName,
      name: apt.contact.name,
      email: apt.contact.email,
      phone: apt.contact.phone,
    } as Patient : patients[apt.contactId];
    
    if (!patient) {
      try {
        const locationId = localStorage.getItem("locationId");
        const response = await fetch(
          `${API_URL}/api/patients/${apt.contactId}?locationId=${locationId}`
        );
        const data = await response.json();
        if (data.success) {
          patient = data.patient;
          setPatients((prev) => ({ ...prev, [apt.contactId]: patient }));
        }
      } catch (err) {
        console.error("Error fetching patient:", err);
      }
    }
    setSelectedPatient(patient || null);
    setShowPopup(true);
  };

  // Handle join video session click - WITH AUDIT LOGGING
  const handleJoinVideoSession = (apt: Appointment, videoLink: string) => {
    const patientName = getPatientName(apt);
    
    // Audit: Log joining video session
    logAudit({
      action: 'VIEW',
      resourceType: 'appointment',
      resourceId: apt.id,
      patientId: apt.contactId,
      patientName: patientName,
      description: `Joined video session for ${patientName}`,
      metadata: {
        appointmentId: apt.id,
        appointmentDate: apt.startTime,
        videoLink: videoLink,
        clinicianId: apt.assignedUserId
      }
    });
    
    // Open the video link in a new tab
    window.open(videoLink, '_blank', 'noopener,noreferrer');
  };

  // Format time
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Format duration
  const formatDuration = (start: string, end?: string) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date(startDate.getTime() + 50 * 60 * 1000);
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffMins = Math.round(diffMs / 60000);
    return `${diffMins} min`;
  };

  // Time slots for the calendar (7 AM to 8 PM)
  const timeSlots = [];
  for (let hour = 7; hour <= 20; hour++) {
    timeSlots.push(hour);
  }

  // Check if date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Get clinician name
  const getClinicianName = (userId?: string) => {
    if (!userId) return "Unassigned";
    const user = users[userId];
    if (user) {
      return user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown";
    }
    // Try to get from localStorage if it's the current user
    const currentUserId = localStorage.getItem("userId");
    const currentUserName = localStorage.getItem("userName");
    if (userId === currentUserId && currentUserName) {
      return currentUserName;
    }
    return "Unknown";
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between mb-4">
          <div>
            <h4 className="mb-1">Calendar</h4>
            <nav aria-label="breadcrumb">
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to="/">Dashboard</Link>
                </li>
                <li className="breadcrumb-item active">Calendar</li>
              </ol>
            </nav>
          </div>
          <div className="text-muted small">
            {appointments.length} appointments loaded
          </div>
        </div>

        {/* Calendar Controls */}
        <div className="card mb-3">
          <div className="card-body py-2">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              {/* Navigation */}
              <div className="d-flex align-items-center gap-2">
                <button className="btn btn-sm btn-outline-primary" onClick={goToToday}>
                  Today
                </button>
                <div className="btn-group">
                  <button className="btn btn-sm btn-outline-secondary" onClick={goToPrevious}>
                    <i className="ti ti-chevron-left"></i>
                  </button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={goToNext}>
                    <i className="ti ti-chevron-right"></i>
                  </button>
                </div>
                <h5 className="mb-0 ms-2">{formatDateRange()}</h5>
              </div>

              {/* View Mode & Filters */}
              <div className="d-flex align-items-center gap-2">
                {/* Clinician Filter */}
                {Object.keys(users).length > 0 && (
                  <select
                    className="form-select form-select-sm"
                    style={{ width: "auto" }}
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                  >
                    <option value="all">All Clinicians</option>
                    {Object.values(users).map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name || `${user.firstName} ${user.lastName}`}
                      </option>
                    ))}
                  </select>
                )}

                {/* Status Filter */}
                <select
                  className="form-select form-select-sm"
                  style={{ width: "auto" }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="showed">Showed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no show">No Show</option>
                </select>

                {/* View Mode */}
                <div className="btn-group">
                  <button
                    className={`btn btn-sm ${viewMode === "day" ? "btn-primary" : "btn-outline-secondary"}`}
                    onClick={() => setViewMode("day")}
                  >
                    Day
                  </button>
                  <button
                    className={`btn btn-sm ${viewMode === "week" ? "btn-primary" : "btn-outline-secondary"}`}
                    onClick={() => setViewMode("week")}
                  >
                    Week
                  </button>
                  <button
                    className={`btn btn-sm ${viewMode === "month" ? "btn-primary" : "btn-outline-secondary"}`}
                    onClick={() => setViewMode("month")}
                  >
                    Month
                  </button>
                </div>

                <button className="btn btn-sm btn-outline-primary" onClick={fetchData} title="Refresh">
                  <i className="ti ti-refresh"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="card">
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-2 text-muted">Loading appointments...</p>
              </div>
            ) : error ? (
              <div className="alert alert-danger m-3">
                <i className="ti ti-alert-circle me-2"></i>
                {error}
                <button className="btn btn-sm btn-outline-danger ms-3" onClick={fetchData}>
                  Retry
                </button>
              </div>
            ) : (
              <div className="calendar-container">
                {/* Week View */}
                {viewMode === "week" && (
                  <div className="week-view">
                    {/* Header Row */}
                    <div className="calendar-header">
                      <div className="time-gutter"></div>
                      {weekDates.map((date, index) => (
                        <div
                          key={index}
                          className={`day-header ${isToday(date) ? "today" : ""}`}
                        >
                          <div className="day-name">
                            {date.toLocaleDateString("en-US", { weekday: "short" })}
                          </div>
                          <div className={`day-number ${isToday(date) ? "today-number" : ""}`}>
                            {date.getDate()}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* All Day Row */}
                    <div className="all-day-row">
                      <div className="time-gutter">
                        <span className="time-label">All day</span>
                      </div>
                      {weekDates.map((date, index) => {
                        const dayAppointments = getAppointmentsForDay(date).filter(
                          (apt) => apt.title?.toLowerCase().includes("all day")
                        );
                        return (
                          <div key={index} className="all-day-cell">
                            {dayAppointments.map((apt) => (
                              <div
                                key={apt.id}
                                className="all-day-event"
                                style={{ backgroundColor: getStatusColor(apt.appointmentStatus || "") }}
                                onClick={(e) => handleAppointmentClick(apt, e)}
                              >
                                {getPatientName(apt)}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>

                    {/* Time Grid */}
                    <div className="time-grid">
                      {timeSlots.map((hour) => (
                        <div key={hour} className="time-row">
                          <div className="time-gutter">
                            <span className="time-label">
                              {hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                            </span>
                          </div>
                          {weekDates.map((date, dayIndex) => {
                            const dayAppointments = getAppointmentsForDay(date).filter((apt) => {
                              // Get hour in local timezone
                              const aptDate = new Date(apt.startTime);
                              const aptHour = aptDate.getHours();
                              return aptHour === hour;
                            });

                            return (
                              <div
                                key={dayIndex}
                                className={`time-cell ${isToday(date) ? "today-column" : ""}`}
                              >
                                {dayAppointments.map((apt) => {
                                  const startTime = new Date(apt.startTime);
                                  const endTime = apt.endTime
                                    ? new Date(apt.endTime)
                                    : new Date(startTime.getTime() + 50 * 60 * 1000);
                                  const durationMins = (endTime.getTime() - startTime.getTime()) / 60000;
                                  const heightPx = Math.max((durationMins / 60) * 60, 28);
                                  const topOffset = (startTime.getMinutes() / 60) * 60;
                                  
                                  // Get patient name for this appointment
                                  const patientName = getPatientName(apt);

                                  return (
                                    <div
                                      key={apt.id}
                                      className="appointment-block"
                                      style={{
                                        top: `${topOffset}px`,
                                        height: `${heightPx}px`,
                                        borderLeftColor: getStatusColor(apt.appointmentStatus || ""),
                                      }}
                                      onClick={(e) => handleAppointmentClick(apt, e)}
                                      title={`${formatTime(apt.startTime)} - ${patientName}`}
                                    >
                                      <span className="appointment-time">
                                        {formatTime(apt.startTime)}
                                      </span>
                                      {getLocationIcon(apt)}
                                      <span className="patient-name">
                                        {patientName}
                                      </span>
                                      {hasProgressNote(apt.id, apt.contactId, apt.startTime) && (
                                        <span className="note-indicator" title="Has Progress Note">
                                          <i className="ti ti-file-text"></i>
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Day View */}
                {viewMode === "day" && (
                  <div className="day-view">
                    <div className="calendar-header">
                      <div className="time-gutter"></div>
                      <div className={`day-header today`}>
                        <div className="day-name">
                          {currentDate.toLocaleDateString("en-US", { weekday: "long" })}
                        </div>
                        <div className="day-number today-number">{currentDate.getDate()}</div>
                      </div>
                    </div>

                    <div className="time-grid single-day">
                      {timeSlots.map((hour) => {
                        const dayAppointments = getAppointmentsForDay(currentDate).filter((apt) => {
                          // Get hour in local timezone
                          const aptDate = new Date(apt.startTime);
                          const aptHour = aptDate.getHours();
                          return aptHour === hour;
                        });

                        return (
                          <div key={hour} className="time-row">
                            <div className="time-gutter">
                              <span className="time-label">
                                {hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                              </span>
                            </div>
                            <div className="time-cell today-column">
                              {dayAppointments.map((apt) => {
                                const startTime = new Date(apt.startTime);
                                const endTime = apt.endTime
                                  ? new Date(apt.endTime)
                                  : new Date(startTime.getTime() + 50 * 60 * 1000);
                                const durationMins = (endTime.getTime() - startTime.getTime()) / 60000;
                                const heightPx = Math.max((durationMins / 60) * 60, 28);
                                const topOffset = (startTime.getMinutes() / 60) * 60;
                                
                                // Get patient name for this appointment
                                const patientName = getPatientName(apt);

                                return (
                                  <div
                                    key={apt.id}
                                    className="appointment-block"
                                    style={{
                                      top: `${topOffset}px`,
                                      height: `${heightPx}px`,
                                      borderLeftColor: getStatusColor(apt.appointmentStatus || ""),
                                    }}
                                    onClick={(e) => handleAppointmentClick(apt, e)}
                                    title={`${formatTime(apt.startTime)} - ${formatTime(endTime.toISOString())} | ${patientName}`}
                                  >
                                    <span className="appointment-time">
                                      {formatTime(apt.startTime)}
                                    </span>
                                    {getLocationIcon(apt)}
                                    <span className="patient-name">
                                      {patientName}
                                    </span>
                                    {hasProgressNote(apt.id, apt.contactId, apt.startTime) && (
                                      <span className="note-indicator" title="Has Progress Note">
                                        <i className="ti ti-file-text"></i>
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Month View */}
                {viewMode === "month" && (
                  <div className="month-view">
                    {/* Month Header */}
                    <div className="month-header">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                        <div key={day} className="month-day-header">
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Month Grid */}
                    <div className="month-grid">
                      {(() => {
                        const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                        const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                        const startDate = new Date(firstDay);
                        startDate.setDate(startDate.getDate() - firstDay.getDay());

                        const weeks = [];
                        let currentWeek: Date[] = [];

                        for (let i = 0; i < 42; i++) {
                          const date = new Date(startDate);
                          date.setDate(startDate.getDate() + i);
                          currentWeek.push(date);

                          if (currentWeek.length === 7) {
                            weeks.push(currentWeek);
                            currentWeek = [];
                          }
                        }

                        return weeks.map((week, weekIndex) => (
                          <div key={weekIndex} className="month-week">
                            {week.map((date, dayIndex) => {
                              const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                              const dayAppointments = getAppointmentsForDay(date);

                              return (
                                <div
                                  key={dayIndex}
                                  className={`month-cell ${!isCurrentMonth ? "other-month" : ""} ${isToday(date) ? "today" : ""}`}
                                >
                                  <div className="month-date">{date.getDate()}</div>
                                  <div className="month-appointments">
                                    {dayAppointments.slice(0, 3).map((apt) => (
                                      <div
                                        key={apt.id}
                                        className="month-appointment"
                                        style={{
                                          backgroundColor: getStatusColor(apt.appointmentStatus || ""),
                                        }}
                                        onClick={(e) => handleAppointmentClick(apt, e)}
                                      >
                                        {getLocationIcon(apt)}
                                        <span>{formatTime(apt.startTime)}</span>
                                        <span className="patient-initials">
                                          {getPatientName(apt)}
                                        </span>
                                      </div>
                                    ))}
                                    {dayAppointments.length > 3 && (
                                      <div className="more-appointments">
                                        +{dayAppointments.length - 3} more
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                {/* No Appointments Message */}
                {!loading && appointments.length === 0 && (
                  <div className="text-center py-5 text-muted">
                    <i className="ti ti-calendar-off" style={{ fontSize: "48px" }}></i>
                    <p className="mt-3">No appointments found for this period.</p>
                    <button className="btn btn-sm btn-primary" onClick={fetchData}>
                      <i className="ti ti-refresh me-1"></i>
                      Refresh
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Appointment Detail Popup */}
        {showPopup && selectedAppointment && (
          <div
            ref={popupRef}
            className="appointment-popup"
            style={{
              position: "fixed",
              top: popupPosition.top,
              left: popupPosition.left,
              zIndex: 1050,
            }}
          >
            <div className="popup-header">
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <span
                    className={`status-badge ${(selectedAppointment.appointmentStatus || "confirmed").toLowerCase().replace(" ", "-")}`}
                  >
                    {selectedAppointment.appointmentStatus || "Confirmed"}
                  </span>
                  {getLocationIcon(selectedAppointment)}
                </div>
                <button className="btn-close btn-sm" onClick={() => setShowPopup(false)}></button>
              </div>
            </div>

            <div className="popup-body">
              {/* Video/Meeting Link Button - Prominent at top - WITH AUDIT LOGGING */}
              {getVideoLink(selectedAppointment) ? (
                <button
                  onClick={() => handleJoinVideoSession(selectedAppointment, getVideoLink(selectedAppointment)!)}
                  className="btn btn-success w-100 mb-3 d-flex align-items-center justify-content-center gap-2"
                  style={{ padding: "12px" }}
                >
                  <i className="ti ti-video" style={{ fontSize: "18px" }}></i>
                  <span>Join Video Appointment</span>
                </button>
              ) : (
                <div className="alert alert-light mb-3 d-flex align-items-center gap-2" style={{ padding: "10px 12px" }}>
                  <i className="ti ti-video-off text-muted"></i>
                  <span className="text-muted small">No video link available for this appointment</span>
                </div>
              )}

              {/* Appointment Details */}
              <div className="detail-section">
                <h6 className="section-title">Appointment details</h6>
                <div className="detail-row">
                  <span className="detail-label">Client</span>
                  <span className="detail-value">
                    {getPatientName(selectedAppointment)}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Date</span>
                  <span className="detail-value">
                    {new Date(selectedAppointment.startTime).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Time</span>
                  <span className="detail-value">
                    {formatTime(selectedAppointment.startTime)} to{" "}
                    {formatTime(
                      selectedAppointment.endTime ||
                        new Date(
                          new Date(selectedAppointment.startTime).getTime() + 50 * 60 * 1000
                        ).toISOString()
                    )}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Duration</span>
                  <span className="detail-value">
                    {formatDuration(selectedAppointment.startTime, selectedAppointment.endTime)}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Clinician</span>
                  <span className="detail-value">
                    {getClinicianName(selectedAppointment.assignedUserId)}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Type</span>
                  <span className="detail-value">
                    {selectedAppointment.title || selectedAppointment.meetingLocationType || "Session"}
                  </span>
                </div>
              </div>

              {/* Notes Section */}
              <div className="detail-section">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="section-title mb-0">Notes</h6>
                  <Link
                    to={`/patients/${selectedAppointment.contactId}/add-progress-note?appointmentId=${selectedAppointment.id}`}
                    className="btn btn-sm btn-outline-primary"
                  >
                    Add Note
                  </Link>
                </div>
                {hasProgressNote(
                  selectedAppointment.id,
                  selectedAppointment.contactId,
                  selectedAppointment.startTime
                ) ? (
                  <div className="notes-list">
                    <Link
                      to={`/patients/${selectedAppointment.contactId}/progress-notes`}
                      className="note-link"
                    >
                      <i className="ti ti-file-text me-2"></i>
                      View Progress Notes
                    </Link>
                  </div>
                ) : (
                  <p className="text-muted small mb-0">No notes for this appointment</p>
                )}
              </div>

              {/* Contact Info */}
              {selectedPatient && (
                <div className="detail-section">
                  <h6 className="section-title">Contact Info</h6>
                  {selectedPatient.email && (
                    <div className="detail-row">
                      <span className="detail-label">Email</span>
                      <span className="detail-value">{selectedPatient.email}</span>
                    </div>
                  )}
                  {selectedPatient.phone && (
                    <div className="detail-row">
                      <span className="detail-label">Phone</span>
                      <span className="detail-value">{selectedPatient.phone}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="popup-footer">
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setShowPopup(false)}>
                Close
              </button>
              <Link
                to={`/patients/${selectedAppointment.contactId}`}
                className="btn btn-sm btn-primary"
              >
                View Client
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Inline Styles */}
      <style>{`
        .calendar-container {
          background: #fff;
          overflow-x: auto;
        }

        /* Week View Styles */
        .week-view {
          min-width: 800px;
        }

        .calendar-header {
          display: flex;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .time-gutter {
          width: 70px;
          min-width: 70px;
          padding: 8px;
          text-align: right;
          border-right: 1px solid #e5e7eb;
        }

        .time-label {
          font-size: 11px;
          color: #6b7280;
        }

        .day-header {
          flex: 1;
          text-align: center;
          padding: 10px 5px;
          border-right: 1px solid #e5e7eb;
        }

        .day-header:last-child {
          border-right: none;
        }

        .day-header.today {
          background: #eff6ff;
        }

        .day-name {
          font-size: 12px;
          color: #6b7280;
          text-transform: uppercase;
        }

        .day-number {
          font-size: 24px;
          font-weight: 500;
          color: #1f2937;
        }

        .day-number.today-number {
          background: #3b82f6;
          color: white;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          line-height: 36px;
          margin: 0 auto;
        }

        .all-day-row {
          display: flex;
          border-bottom: 1px solid #e5e7eb;
          min-height: 30px;
        }

        .all-day-cell {
          flex: 1;
          padding: 2px;
          border-right: 1px solid #e5e7eb;
        }

        .all-day-event {
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 3px;
          color: white;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .time-grid {
          position: relative;
        }

        .time-grid.single-day .time-cell {
          flex: 1;
        }

        .time-row {
          display: flex;
          height: 60px;
          border-bottom: 1px solid #f3f4f6;
        }
        
        .time-grid.single-day .time-row {
          height: 80px;
        }

        .time-cell {
          flex: 1;
          position: relative;
          border-right: 1px solid #e5e7eb;
        }

        .time-cell:last-child {
          border-right: none;
        }

        .time-cell.today-column {
          background: #fafbff;
        }

        .appointment-block {
          position: absolute;
          left: 2px;
          right: 2px;
          background: white;
          border-radius: 4px;
          border-left: 3px solid #4CAF50;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          padding: 2px 6px;
          cursor: pointer;
          overflow: hidden;
          z-index: 5;
          transition: box-shadow 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .appointment-block:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 6;
        }

        .appointment-block.expanded {
          padding: 8px 10px;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          min-height: 70px;
        }

        .appointment-time {
          font-size: 11px;
          color: #6b7280;
          font-weight: 600;
          white-space: nowrap;
        }

        .appointment-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }

        .appointment-title {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 500;
          color: #1f2937;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
          min-width: 0;
        }
        
        .patient-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .note-indicator {
          font-size: 12px;
          color: #10b981;
          flex-shrink: 0;
          margin-left: 4px;
        }
        
        .appointment-row {
          display: flex;
          align-items: center;
          gap: 4px;
          width: 100%;
        }

        .location-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 3px;
          font-size: 10px;
        }

        .location-icon.video {
          background: #dbeafe;
          color: #2563eb;
        }

        .location-icon.phone {
          background: #fef3c7;
          color: #d97706;
        }

        .location-icon.office {
          background: #d1fae5;
          color: #059669;
        }

        .location-icon.home {
          background: #fce7f3;
          color: #db2777;
        }

        .note-indicator {
          font-size: 12px;
          color: #10b981;
        }

        .appointment-details {
          margin-top: 4px;
        }

        /* Month View Styles */
        .month-view {
          min-width: 700px;
        }

        .month-header {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .month-day-header {
          padding: 10px;
          text-align: center;
          font-size: 12px;
          font-weight: 500;
          color: #6b7280;
          text-transform: uppercase;
        }

        .month-grid {
          display: flex;
          flex-direction: column;
        }

        .month-week {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          min-height: 100px;
        }

        .month-cell {
          border-right: 1px solid #e5e7eb;
          border-bottom: 1px solid #e5e7eb;
          padding: 4px;
          background: white;
        }

        .month-cell:nth-child(7n) {
          border-right: none;
        }

        .month-cell.other-month {
          background: #f9fafb;
        }

        .month-cell.other-month .month-date {
          color: #9ca3af;
        }

        .month-cell.today {
          background: #eff6ff;
        }

        .month-cell.today .month-date {
          background: #3b82f6;
          color: white;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          line-height: 24px;
          text-align: center;
        }

        .month-date {
          font-size: 12px;
          font-weight: 500;
          color: #1f2937;
          margin-bottom: 4px;
        }

        .month-appointments {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .month-appointment {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          padding: 2px 4px;
          border-radius: 3px;
          color: white;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
        }

        .month-appointment .location-icon {
          width: 14px;
          height: 14px;
          font-size: 9px;
          border-radius: 2px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .month-appointment .location-icon.video {
          background: rgba(255, 255, 255, 0.9);
          color: #2563eb;
        }
        
        .month-appointment .location-icon.office {
          background: rgba(255, 255, 255, 0.3);
          color: white;
        }

        .more-appointments {
          font-size: 10px;
          color: #6b7280;
          padding: 2px 4px;
        }

        /* Appointment Popup */
        .appointment-popup {
          width: 380px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          overflow: hidden;
        }

        .popup-header {
          padding: 12px 16px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
          text-transform: capitalize;
        }

        .status-badge.confirmed, .status-badge.scheduled {
          background: #d1fae5;
          color: #059669;
        }

        .status-badge.showed, .status-badge.completed {
          background: #dbeafe;
          color: #2563eb;
        }

        .status-badge.cancelled, .status-badge.canceled {
          background: #fee2e2;
          color: #dc2626;
        }

        .status-badge.no-show, .status-badge.noshow, .status-badge.no_show {
          background: #ffedd5;
          color: #ea580c;
        }

        .popup-body {
          padding: 16px;
          max-height: 400px;
          overflow-y: auto;
        }

        .detail-section {
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid #f3f4f6;
        }

        .detail-section:last-child {
          border-bottom: none;
          margin-bottom: 0;
        }

        .section-title {
          font-size: 12px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
        }

        .detail-label {
          font-size: 13px;
          color: #6b7280;
        }

        .detail-value {
          font-size: 13px;
          color: #1f2937;
          font-weight: 500;
        }

        .note-link {
          display: block;
          padding: 8px 12px;
          background: #f3f4f6;
          border-radius: 6px;
          color: #4b5563;
          text-decoration: none;
          font-size: 13px;
        }

        .note-link:hover {
          background: #e5e7eb;
          color: #1f2937;
        }

        .popup-footer {
          padding: 12px 16px;
          background: #f9fafb;
          border-top: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .calendar-header .day-name {
            font-size: 10px;
          }

          .day-number {
            font-size: 18px;
          }

          .appointment-block {
            padding: 2px 4px;
          }

          .appointment-time {
            font-size: 9px;
          }

          .appointment-title {
            font-size: 10px;
          }
        }
      `}</style>
    </div>
  );
};

export default CalendarView;