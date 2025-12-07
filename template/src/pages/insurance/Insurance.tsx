import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  auditClaimSubmit, 
  logAudit
} from '../../services/auditService';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

// Allowed user types for this page
const ALLOWED_USER_TYPES = ['AGENCY-OWNER', 'AGENCY-ADMIN', 'ACCOUNT-ADMIN'];

// Common Insurance Payers with IDs
const COMMON_PAYERS = [
  { id: "HCHHP", name: "Healthcare Highways Health Plan" },
  { id: "87726", name: "United HealthCare" },
  { id: "00840", name: "BCBS Oklahoma" },
  { id: "BCBSOK", name: "Blue Cross Blue Shield of Oklahoma" },
  { id: "SB840", name: "Blue Shield of Oklahoma" },
  { id: "APTS87", name: "Aetna" },
  { id: "CIGNK1", name: "Cigna" },
  { id: "SX155", name: "Humana" },
  { id: "77076", name: "Medicare" },
  { id: "SKOKP", name: "Oklahoma Medicaid (SoonerCare)" },
  { id: "TREST", name: "Tricare" },
  { id: "91131", name: "Anthem" },
  { id: "73100", name: "Kempton Group Administrators" },
  { id: "OTHER", name: "Other" },
];

// CPT Codes for mental health
const CPT_CODES = [
  { code: "90832", description: "Psychotherapy, 16-37 minutes", defaultRate: 95 },
  { code: "90834", description: "Psychotherapy, 38-52 minutes", defaultRate: 130 },
  { code: "90837", description: "Psychotherapy, 53+ minutes", defaultRate: 175 },
  { code: "90847", description: "Family therapy with patient", defaultRate: 150 },
  { code: "90846", description: "Family therapy without patient", defaultRate: 150 },
  { code: "90853", description: "Group psychotherapy", defaultRate: 50 },
  { code: "90791", description: "Psychiatric diagnostic evaluation", defaultRate: 200 },
  { code: "90792", description: "Psychiatric evaluation with medical", defaultRate: 250 },
  { code: "99213", description: "E/M Office visit, established, low", defaultRate: 95 },
  { code: "99214", description: "E/M Office visit, established, moderate", defaultRate: 130 },
  { code: "99215", description: "E/M Office visit, established, high", defaultRate: 175 },
];

// Place of Service codes
const PLACE_OF_SERVICE_CODES = [
  { code: "02", description: "Telehealth - Provider Site" },
  { code: "10", description: "Telehealth - Patient Home" },
  { code: "11", description: "Office" },
  { code: "12", description: "Home" },
  { code: "22", description: "Outpatient Hospital" },
  { code: "53", description: "Community Mental Health Center" },
];

// Common modifiers for mental health
const MODIFIERS = [
  { code: "", description: "None" },
  { code: "95", description: "Synchronous Telemedicine Service" },
  { code: "GT", description: "Interactive Telecommunications" },
  { code: "HO", description: "Master's Level Clinician" },
  { code: "HN", description: "Bachelor's Level Clinician" },
  { code: "HP", description: "Doctoral Level Clinician" },
];

// US States
const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

interface GHLUser {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  type?: string;
}

interface Appointment {
  id: string;
  contactId: string;
  title?: string;
  startTime: string;
  endTime?: string;
  appointmentStatus?: string;
  calendarId?: string;
  assignedUserId?: string;
  contact?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  contactName?: string;
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
  customFields?: any[];
}

interface UnbilledSession {
  appointment: Appointment;
  patient: Patient | null;
  payer?: string;
  payerId?: string;
  chargeAmount: number;
  clinicianName: string;
  clinicianId?: string;
}

interface Claim {
  id: string;
  patientId: string;
  patientControlNumber?: string;
  appointmentId?: string;
  noteId?: string;
  payerId: string;
  payerName: string;
  cptCode: string;
  diagnosisCodes?: string[];
  chargeAmount: number;
  sessionDate: string;
  clinicianName?: string;
  status: 'ready' | 'submitted' | 'accepted' | 'rejected' | 'paid' | 'denied';
  createdAt: string;
  submittedAt?: string | null;
  paidAt?: string | null;
  paidAmount?: number | null;
  notes?: string;
  patientInfo?: any;
  cms1500Data?: any;
}

interface ClaimFormData {
  // Payer Info (Box 1, 1a)
  payerId: string;
  payerName: string;
  payerAddress1: string;
  payerAddress2: string;
  payerCity: string;
  payerState: string;
  payerZip: string;
  memberId: string;
  
  // Patient Info (Box 2, 3, 5)
  patientLastName: string;
  patientFirstName: string;
  patientMiddleName: string;
  patientDob: string;
  patientSex: string;
  patientAddress1: string;
  patientAddress2: string;
  patientCity: string;
  patientState: string;
  patientZip: string;
  patientPhone: string;
  
  // Insured Info (Box 4, 7)
  insuredLastName: string;
  insuredFirstName: string;
  insuredMiddleName: string;
  insuredAddress1: string;
  insuredAddress2: string;
  insuredCity: string;
  insuredState: string;
  insuredZip: string;
  insuredPhone: string;
  
  // Relationship & Other (Box 6, 9, 10, 11)
  patientRelationship: string;
  otherInsuredName: string;
  otherInsuredPolicyId: string;
  otherInsuredGroupNumber: string;
  insurancePlanName: string;
  insuredPolicyGroupId: string;
  insuredDob: string;
  insuredSex: string;
  employerName: string;
  
  // Condition Related (Box 10)
  conditionEmployment: boolean;
  conditionAutoAccident: boolean;
  conditionAutoAccidentState: string;
  conditionOtherAccident: boolean;
  
  // Claim Codes (Box 10d)
  claimCodes: string;
  
  // Other Insurance (Box 11d)
  hasOtherHealthPlan: boolean;
  
  // Signatures (Box 12, 13)
  signatureOnFile: boolean;
  acceptAssignment: boolean;
  
  // Dates (Box 14, 15, 16, 18)
  dateOfIllness: string;
  otherDate: string;
  unableToWorkFrom: string;
  unableToWorkTo: string;
  hospitalizationFrom: string;
  hospitalizationTo: string;
  
  // Referring Provider (Box 17)
  referringProviderName: string;
  referringProviderNpi: string;
  referringProviderType: string;
  
  // Additional Info (Box 19)
  additionalClaimInfo: string;
  
  // Outside Lab (Box 20)
  outsideLab: boolean;
  outsideLabCharges: string;
  
  // Diagnosis Codes (Box 21)
  diagnosisCodes: string[];
  icdIndicator: string;
  
  // Resubmission (Box 22)
  resubmissionCode: string;
  originalRefNumber: string;
  
  // Prior Auth (Box 23)
  priorAuthNumber: string;
  
  // Service Lines (Box 24)
  serviceLines: ServiceLine[];
  
  // Federal Tax ID (Box 25)
  federalTaxId: string;
  federalTaxIdType: string;
  
  // Patient Account (Box 26)
  patientAccountNumber: string;
  
  // Total Charge (Box 28)
  totalCharge: number;
  
  // Amount Paid (Box 29)
  amountPaid: number;
  
  // Service Facility (Box 32)
  facilityName: string;
  facilityAddress1: string;
  facilityAddress2: string;
  facilityCity: string;
  facilityState: string;
  facilityZip: string;
  facilityNpi: string;
  facilityOtherId: string;
  
  // Billing Provider (Box 33)
  billingProviderName: string;
  billingProviderAddress1: string;
  billingProviderAddress2: string;
  billingProviderCity: string;
  billingProviderState: string;
  billingProviderZip: string;
  billingProviderPhone: string;
  billingProviderNpi: string;
  billingProviderTaxonomy: string;
}

interface ServiceLine {
  dateFrom: string;
  dateTo: string;
  placeOfService: string;
  emg: string;
  cptCode: string;
  modifier1: string;
  modifier2: string;
  modifier3: string;
  modifier4: string;
  diagnosisPointer: string;
  charges: number;
  units: number;
  renderingProviderNpi: string;
  renderingProviderName: string;
}

const Insurance: React.FC = () => {
  const navigate = useNavigate();
  const [unbilledSessions, setUnbilledSessions] = useState<UnbilledSession[]>([]);
  const [submittedClaims, setSubmittedClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"unbilled" | "claims">("unbilled");
  
  // User access control
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // GHL Users (for clinician/provider names)
  const [ghlUsers, setGhlUsers] = useState<GHLUser[]>([]);
  
  // Selection state
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  
  // Filters
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [payerFilter, setPayerFilter] = useState("all");
  const [clinicianFilter, setClinicianFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Claim form state
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [currentSession, setCurrentSession] = useState<UnbilledSession | null>(null);
  const [claimFormData, setClaimFormData] = useState<ClaimFormData | null>(null);
  const [claimStatus, setClaimStatus] = useState<"new" | "draft" | "prepared" | "submitted">("new");
  const [submitting, setSubmitting] = useState(false);
  
  // Save draft state
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [savedClaims, setSavedClaims] = useState<Record<string, any>>({});
  
  // Create claims modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Claim status update modal
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  // Editing existing claim
  const [editingClaim, setEditingClaim] = useState<Claim | null>(null);

  // Check user access on mount
  // TODO: Re-enable access control after development
  useEffect(() => {
    // checkUserAccess();
    setHasAccess(true); // Open access while building
    
    // Load saved claims from localStorage
    try {
      const saved = localStorage.getItem('savedClaims');
      if (saved) {
        setSavedClaims(JSON.parse(saved));
      }
    } catch (err) {
      console.error('Error loading saved claims:', err);
    }
  }, []);

  useEffect(() => {
    if (hasAccess) {
      fetchData();
    }
  }, [hasAccess]);

  const checkUserAccess = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        setHasAccess(false);
        return;
      }
      
      const user = JSON.parse(userStr);
      setCurrentUser(user);
      
      // Check if user type is allowed
      const userType = user.type || user.role || user.userType || '';
      const normalizedType = userType.toUpperCase().replace(/_/g, '-');
      
      const allowed = ALLOWED_USER_TYPES.some(allowedType => 
        normalizedType.includes(allowedType.replace('-', '')) || 
        normalizedType === allowedType
      );
      
      setHasAccess(allowed);
    } catch (err) {
      console.error('Error checking user access:', err);
      setHasAccess(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const locationId = localStorage.getItem("locationId");
      const userId = localStorage.getItem("userId");
      
      if (!locationId) {
        setError("Location ID not found");
        return;
      }
      
      // Fetch GHL users for clinician names
      try {
        const usersResponse = await fetch(
          `${API_URL}/api/users?locationId=${locationId}`
        );
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          setGhlUsers(usersData.users || []);
        }
      } catch (userErr) {
        console.log("Could not fetch users:", userErr);
      }
      
      // Fetch appointments
      const appointmentsResponse = await fetch(
        `${API_URL}/api/appointments?locationId=${locationId}&userId=${userId || ""}`
      );
      
      if (!appointmentsResponse.ok) {
        throw new Error("Failed to fetch appointments");
      }
      
      const appointmentsData = await appointmentsResponse.json();
      const appointments: Appointment[] = appointmentsData.appointments || [];
      
      // Filter to completed appointments (confirmed/showed, end time passed)
      const now = new Date();
      const completedAppointments = appointments.filter((apt) => {
        const status = apt.appointmentStatus?.toLowerCase() || "";
        const isCompleted = status === "confirmed" || status === "showed";
        
        if (apt.endTime) {
          const endTime = new Date(apt.endTime);
          return isCompleted && endTime < now;
        } else if (apt.startTime) {
          const startTime = new Date(apt.startTime);
          const estimatedEnd = new Date(startTime.getTime() + 60 * 60 * 1000);
          return isCompleted && estimatedEnd < now;
        }
        
        return false;
      });
      
      // Fetch patient details for each appointment
      const sessionsWithPatients: UnbilledSession[] = await Promise.all(
        completedAppointments.map(async (apt) => {
          let patient: Patient | null = null;
          let payer = "";
          let payerId = "";
          let clinicianName = "Unknown Provider";
          let clinicianId = apt.assignedUserId || "";
          
          // Get clinician name from GHL users
          if (apt.assignedUserId && ghlUsers.length > 0) {
            const assignedUser = ghlUsers.find(u => u.id === apt.assignedUserId);
            if (assignedUser) {
              clinicianName = assignedUser.name || 
                `${assignedUser.firstName || ''} ${assignedUser.lastName || ''}`.trim() ||
                assignedUser.email || 
                "Unknown Provider";
            }
          }
          
          if (apt.contactId) {
            try {
              const patientResponse = await fetch(
                `${API_URL}/api/patients/${apt.contactId}?locationId=${locationId}`
              );
              
              if (patientResponse.ok) {
                const patientData = await patientResponse.json();
                patient = patientData.patient || patientData;
                
                // Get insurance info from custom fields
                const customFields = patient?.customFields || [];
                const getField = (key: string) => {
                  const field = customFields.find((f: any) => 
                    f.key === key || f.id === key || f.fieldKey === key ||
                    f.key?.includes(key) || f.fieldKey?.includes(key)
                  );
                  return field?.value || field?.fieldValue || field?.field_value || "";
                };
                
                payer = getField("insurance_carrier") || getField("insurance_company") || getField("carrier") || "";
                payerId = getField("insurance_payer_id") || getField("payer_id") || "";
                
                // Also try to get rendering provider from custom field if not set
                if (clinicianName === "Unknown Provider") {
                  const referringProvider = getField("referring_provider_name") || getField("provider_name");
                  if (referringProvider) {
                    clinicianName = referringProvider;
                  }
                }
              }
            } catch (err) {
              console.log("Could not fetch patient:", apt.contactId);
            }
          }
          
          return {
            appointment: apt,
            patient,
            payer,
            payerId,
            chargeAmount: 175, // Default charge
            clinicianName,
            clinicianId,
          };
        })
      );
      
      setUnbilledSessions(sessionsWithPatients);
      
      // Fetch submitted claims
      try {
        const claimsResponse = await fetch(`${API_URL}/api/claims/all?locationId=${locationId}`);
        if (claimsResponse.ok) {
          const claimsData = await claimsResponse.json();
          setSubmittedClaims(claimsData.claims || []);
        }
      } catch (claimErr) {
        console.log("No claims found or claims endpoint not available");
      }
      
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch with updated GHL users
  useEffect(() => {
    if (ghlUsers.length > 0 && unbilledSessions.length > 0) {
      // Update clinician names in existing sessions
      setUnbilledSessions(prev => prev.map(session => {
        if (session.appointment.assignedUserId) {
          const assignedUser = ghlUsers.find(u => u.id === session.appointment.assignedUserId);
          if (assignedUser) {
            const name = assignedUser.name || 
              `${assignedUser.firstName || ''} ${assignedUser.lastName || ''}`.trim() ||
              assignedUser.email || 
              "Unknown Provider";
            return { ...session, clinicianName: name };
          }
        }
        return session;
      }));
    }
  }, [ghlUsers]);

  const getPatientName = (session: UnbilledSession) => {
    if (session.patient) {
      const first = session.patient.firstName || "";
      const last = session.patient.lastName || "";
      if (first || last) {
        return `${first} ${last}`.trim();
      }
      if (session.patient.name) {
        return session.patient.name;
      }
    }
    if (session.appointment.contact) {
      const first = session.appointment.contact.firstName || "";
      const last = session.appointment.contact.lastName || "";
      if (first || last) {
        return `${first} ${last}`.trim();
      }
    }
    if (session.appointment.contactName) {
      return session.appointment.contactName;
    }
    return "Unknown Patient";
  };

  const getPayerDisplay = (session: UnbilledSession) => {
    if (session.payer) {
      const payerInfo = COMMON_PAYERS.find(p => 
        p.name.toLowerCase().includes(session.payer!.toLowerCase()) ||
        session.payer!.toLowerCase().includes(p.name.toLowerCase())
      );
      if (payerInfo) {
        return `${session.payer} (${payerInfo.id})`;
      }
      return session.payer;
    }
    return "No payer assigned";
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase() || "";
    switch (statusLower) {
      case "confirmed":
        return <span className="badge bg-success rounded-pill">Confirmed</span>;
      case "showed":
        return <span className="badge bg-info rounded-pill">Showed</span>;
      case "completed":
        return <span className="badge bg-primary rounded-pill">Completed</span>;
      case "cancelled":
      case "canceled":
        return <span className="badge bg-danger rounded-pill">Cancelled</span>;
      case "no-show":
      case "noshow":
        return <span className="badge rounded-pill" style={{ backgroundColor: '#fef3c7', color: '#b45309' }}>No Show</span>;
      default:
        return <span className="badge bg-secondary rounded-pill">{status || "Unknown"}</span>;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const toggleSessionSelection = (sessionId: string) => {
    const newSelected = new Set(selectedSessions);
    if (newSelected.has(sessionId)) {
      newSelected.delete(sessionId);
    } else {
      newSelected.add(sessionId);
    }
    setSelectedSessions(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedSessions.size === unbilledSessions.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(unbilledSessions.map(s => s.appointment.id)));
    }
  };

  const openCreateClaimsModal = () => {
    if (selectedSessions.size === 0) {
      alert("Please select at least one appointment");
      return;
    }
    setShowCreateModal(true);
  };

  const initializeClaimForm = (session: UnbilledSession): ClaimFormData => {
    const patient = session.patient;
    const apt = session.appointment;
    const serviceDate = apt.startTime ? new Date(apt.startTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    
    // Get custom fields
    const customFields = patient?.customFields || [];
    const getField = (key: string) => {
      const field = customFields.find((f: any) => 
        f.key === key || f.id === key || f.fieldKey === key ||
        f.key?.includes(key) || f.fieldKey?.includes(key)
      );
      return field?.value || field?.fieldValue || field?.field_value || "";
    };
    
    // Get payer info from COMMON_PAYERS list or custom fields
    const payerInfo = COMMON_PAYERS.find(p => 
      p.name.toLowerCase().includes((session.payer || '').toLowerCase()) ||
      p.id === session.payerId
    );
    
    return {
      // Payer Info
      payerId: session.payerId || payerInfo?.id || "HCHHP",
      payerName: session.payer || payerInfo?.name || "Healthcare Highways Health Plan",
      payerAddress1: getField("payer_address") || "P.O. Box 2476",
      payerAddress2: "",
      payerCity: getField("payer_city") || "Grapevine",
      payerState: getField("payer_state") || "TX",
      payerZip: getField("payer_zip") || "76099",
      memberId: getField("insurance_member_id") || getField("member_id") || "",
      
      // Patient Info
      patientLastName: patient?.lastName || "",
      patientFirstName: patient?.firstName || "",
      patientMiddleName: "",
      patientDob: patient?.dateOfBirth || getField("date_of_birth") || "",
      patientSex: getField("gender") || "M",
      patientAddress1: patient?.address1 || getField("address") || "",
      patientAddress2: "",
      patientCity: patient?.city || getField("city") || "Oklahoma City",
      patientState: patient?.state || getField("state") || "OK",
      patientZip: patient?.postalCode || getField("zip") || "",
      patientPhone: patient?.phone || getField("phone") || "",
      
      // Insured Info (same as patient if self)
      insuredLastName: patient?.lastName || "",
      insuredFirstName: patient?.firstName || "",
      insuredMiddleName: "",
      insuredAddress1: patient?.address1 || getField("address") || "",
      insuredAddress2: "",
      insuredCity: patient?.city || getField("city") || "Oklahoma City",
      insuredState: patient?.state || getField("state") || "OK",
      insuredZip: patient?.postalCode || getField("zip") || "",
      insuredPhone: patient?.phone || getField("phone") || "",
      
      // Relationship
      patientRelationship: getField("patient_relationship") || "Self",
      otherInsuredName: "",
      otherInsuredPolicyId: "",
      otherInsuredGroupNumber: "",
      insurancePlanName: session.payer || "",
      insuredPolicyGroupId: getField("insurance_group_number") || getField("group_number") || "",
      insuredDob: getField("insured_dob") || patient?.dateOfBirth || getField("date_of_birth") || "",
      insuredSex: getField("insured_sex") || getField("gender") || "M",
      employerName: getField("employer_name") || "",
      
      // Condition
      conditionEmployment: false,
      conditionAutoAccident: false,
      conditionAutoAccidentState: "",
      conditionOtherAccident: false,
      claimCodes: "",
      hasOtherHealthPlan: false,
      
      // Signatures
      signatureOnFile: true,
      acceptAssignment: true,
      
      // Dates
      dateOfIllness: "",
      otherDate: serviceDate,
      unableToWorkFrom: "",
      unableToWorkTo: "",
      hospitalizationFrom: "",
      hospitalizationTo: "",
      
      // Referring Provider
      referringProviderName: getField("referring_provider_name") || "",
      referringProviderNpi: getField("referring_provider_npi") || "",
      referringProviderType: "",
      
      // Additional Info
      additionalClaimInfo: "",
      outsideLab: false,
      outsideLabCharges: "",
      
      // Diagnosis
      diagnosisCodes: [getField("primary_diagnosis_code") || getField("diagnosis") || "F41.1"],
      icdIndicator: "10",
      
      // Resubmission
      resubmissionCode: "1",
      originalRefNumber: "",
      
      // Prior Auth
      priorAuthNumber: getField("prior_auth_number") || "",
      
      // Service Lines
      serviceLines: [{
        dateFrom: serviceDate,
        dateTo: serviceDate,
        placeOfService: "02",
        emg: "",
        cptCode: "90837",
        modifier1: "95",
        modifier2: "",
        modifier3: "",
        modifier4: "",
        diagnosisPointer: "A",
        charges: 175,
        units: 1,
        renderingProviderNpi: "1740590264",
        renderingProviderName: session.clinicianName || "Unknown Provider",
      }],
      
      // Federal Tax ID
      federalTaxId: "475528305",
      federalTaxIdType: "EIN",
      
      // Patient Account
      patientAccountNumber: apt.contactId?.slice(-8) || "",
      
      // Totals
      totalCharge: 175,
      amountPaid: 0,
      
      // Service Facility
      facilityName: "",
      facilityAddress1: "",
      facilityAddress2: "",
      facilityCity: "",
      facilityState: "",
      facilityZip: "",
      facilityNpi: "",
      facilityOtherId: "",
      
      // Billing Provider
      billingProviderName: "Legacy Family Services, Inc",
      billingProviderAddress1: "11901 N MacArthur",
      billingProviderAddress2: "",
      billingProviderCity: "Oklahoma City",
      billingProviderState: "OK",
      billingProviderZip: "73162-1852",
      billingProviderPhone: "(405) 370-4594",
      billingProviderNpi: "1902270267",
      billingProviderTaxonomy: "101YM0800X",
    };
  };

  const openClaimForm = (session: UnbilledSession) => {
    setCurrentSession(session);
    setEditingClaim(null); // Not editing an existing claim
    
    // Check for saved draft first
    const savedDraft = loadSavedClaimData(session.appointment.id);
    if (savedDraft) {
      // Remove metadata fields before setting form data
      const { _savedAt, _appointmentId, _patientId, _patientName, ...formData } = savedDraft;
      setClaimFormData(formData);
      setClaimStatus("draft");
      setLastSaved(new Date(_savedAt));
    } else {
      setClaimFormData(initializeClaimForm(session));
      setClaimStatus("prepared");
      setLastSaved(null);
    }
    
    setShowClaimForm(true);
  };

  // Reopen a submitted claim for editing
  const reopenClaimForEdit = (claim: Claim) => {
    setEditingClaim(claim);
    setCurrentSession(null); // No session when editing existing claim
    
    // Audit: Log that user is viewing/editing a claim
    logAudit({
      action: 'VIEW',
      resourceType: 'claim',
      resourceId: claim.id,
      patientId: claim.patientId,
      patientName: claim.patientInfo?.name || `${claim.patientInfo?.firstName || ''} ${claim.patientInfo?.lastName || ''}`.trim(),
      description: `Opened claim for editing: ${claim.patientControlNumber || claim.id}`,
      metadata: { claimStatus: claim.status, payerName: claim.payerName }
    });
    
    // If we have saved CMS-1500 data, use it
    const cms1500 = claim.cms1500Data || {};
    
    // Convert CMS-1500 payload back to ClaimFormData format
    // Fall back to claim record fields for older claims without cms1500Data
    const formData: ClaimFormData = {
      // Payer Info
      payerId: cms1500.payer?.payerId || claim.payerId || '',
      payerName: cms1500.payer?.payerName || claim.payerName || '',
      payerAddress1: cms1500.payer?.address1 || '',
      payerAddress2: cms1500.payer?.address2 || '',
      payerCity: cms1500.payer?.city || '',
      payerState: cms1500.payer?.state || '',
      payerZip: cms1500.payer?.zip || '',
      memberId: cms1500.payer?.memberId || claim.patientInfo?.memberId || '',
      
      // Patient Info - use patientInfo from claim if no cms1500Data
      patientLastName: cms1500.patient?.lastName || claim.patientInfo?.lastName || '',
      patientFirstName: cms1500.patient?.firstName || claim.patientInfo?.firstName || '',
      patientMiddleName: cms1500.patient?.middleName || '',
      patientDob: cms1500.patient?.dob || '',
      patientSex: cms1500.patient?.sex || '',
      patientAddress1: cms1500.patient?.address1 || '',
      patientAddress2: cms1500.patient?.address2 || '',
      patientCity: cms1500.patient?.city || '',
      patientState: cms1500.patient?.state || 'OK',
      patientZip: cms1500.patient?.zip || '',
      patientPhone: cms1500.patient?.phone || '',
      
      // Insured Info
      insuredLastName: cms1500.insured?.lastName || claim.patientInfo?.lastName || '',
      insuredFirstName: cms1500.insured?.firstName || claim.patientInfo?.firstName || '',
      insuredMiddleName: cms1500.insured?.middleName || '',
      insuredAddress1: cms1500.insured?.address1 || '',
      insuredAddress2: cms1500.insured?.address2 || '',
      insuredCity: cms1500.insured?.city || '',
      insuredState: cms1500.insured?.state || '',
      insuredZip: cms1500.insured?.zip || '',
      insuredPhone: cms1500.insured?.phone || '',
      insuredDob: cms1500.insured?.dob || '',
      insuredSex: cms1500.insured?.sex || '',
      insuredPolicyGroupId: cms1500.insured?.policyGroupId || '',
      employerName: cms1500.insured?.employerName || '',
      
      // Patient Relationship
      patientRelationship: cms1500.patientRelationship || 'self',
      
      // Other Insured
      otherInsuredName: cms1500.otherInsured?.name || '',
      otherInsuredPolicyId: cms1500.otherInsured?.policyId || '',
      otherInsuredGroupNumber: cms1500.otherInsured?.groupNumber || '',
      
      // Condition Related To
      conditionEmployment: cms1500.conditionRelatedTo?.employment || false,
      conditionAutoAccident: cms1500.conditionRelatedTo?.autoAccident || false,
      conditionAutoAccidentState: cms1500.conditionRelatedTo?.autoAccidentState || '',
      conditionOtherAccident: cms1500.conditionRelatedTo?.otherAccident || false,
      
      // Other fields
      claimCodes: cms1500.claimCodes || '',
      insurancePlanName: cms1500.insurancePlanName || '',
      hasOtherHealthPlan: cms1500.hasOtherHealthPlan || false,
      signatureOnFile: cms1500.signatureOnFile !== false,
      dateOfIllness: cms1500.dateOfIllness || '',
      otherDate: cms1500.otherDate || '',
      unableToWorkFrom: cms1500.unableToWork?.from || '',
      unableToWorkTo: cms1500.unableToWork?.to || '',
      referringProviderName: cms1500.referringProvider?.name || '',
      referringProviderNpi: cms1500.referringProvider?.npi || '',
      referringProviderType: cms1500.referringProvider?.qualifier || 'DN',
      hospitalizationFrom: cms1500.hospitalization?.from || '',
      hospitalizationTo: cms1500.hospitalization?.to || '',
      additionalClaimInfo: cms1500.additionalClaimInfo || '',
      outsideLab: cms1500.outsideLab || false,
      outsideLabCharges: cms1500.outsideLabCharges?.toString() || '0',
      diagnosisCodes: cms1500.diagnosisCodes || claim.diagnosisCodes || ['F41.1', '', '', '', '', '', '', '', '', '', '', ''],
      icdIndicator: cms1500.icdIndicator || '10',
      resubmissionCode: cms1500.resubmission?.code || '1',
      originalRefNumber: cms1500.resubmission?.originalRefNumber || '',
      priorAuthNumber: cms1500.priorAuthNumber || '',
      
      // Service Lines - fall back to claim data if no cms1500Data
      serviceLines: cms1500.serviceLines?.length > 0 ? cms1500.serviceLines.map((line: any) => ({
        dateFrom: line.dateFrom || '',
        dateTo: line.dateTo || '',
        placeOfService: line.placeOfService || '02',
        emg: line.emg || '',
        cptCode: line.cptCode || '90837',
        modifier1: line.modifier1 || '95',
        modifier2: line.modifier2 || '',
        modifier3: line.modifier3 || '',
        modifier4: line.modifier4 || '',
        diagnosisPointer: line.diagnosisPointer || 'A',
        charges: line.charges || 175,
        units: line.units || 1,
        renderingProviderNpi: line.renderingProviderNpi || '',
        renderingProviderName: line.renderingProviderName || claim.clinicianName || '',
      })) : [{
        dateFrom: claim.sessionDate || '',
        dateTo: claim.sessionDate || '',
        placeOfService: '02',
        emg: '',
        cptCode: claim.cptCode || '90837',
        modifier1: '95',
        modifier2: '',
        modifier3: '',
        modifier4: '',
        diagnosisPointer: 'A',
        charges: claim.chargeAmount || 175,
        units: 1,
        renderingProviderNpi: '',
        renderingProviderName: claim.clinicianName || '',
      }],
      
      // Totals
      totalCharge: cms1500.totalCharge || claim.chargeAmount || 0,
      amountPaid: cms1500.amountPaid || 0,
      
      // Federal Tax ID
      federalTaxId: cms1500.federalTaxId || '47-5528305',
      federalTaxIdType: cms1500.federalTaxIdType || 'EIN',
      
      // Patient Account
      patientAccountNumber: cms1500.patientAccountNumber || claim.patientControlNumber || '',
      
      // Accept Assignment
      acceptAssignment: cms1500.acceptAssignment !== false,
      
      // Service Facility
      facilityName: cms1500.serviceFacility?.name || '',
      facilityAddress1: cms1500.serviceFacility?.address1 || '',
      facilityAddress2: cms1500.serviceFacility?.address2 || '',
      facilityCity: cms1500.serviceFacility?.city || '',
      facilityState: cms1500.serviceFacility?.state || '',
      facilityZip: cms1500.serviceFacility?.zip || '',
      facilityNpi: cms1500.serviceFacility?.npi || '',
      facilityOtherId: cms1500.serviceFacility?.otherId || '',
      
      // Billing Provider - use defaults
      billingProviderPhone: cms1500.billingProvider?.phone || '(405) 370-4594',
      billingProviderName: cms1500.billingProvider?.name || 'Legacy Family Services, Inc',
      billingProviderAddress1: cms1500.billingProvider?.address1 || '11901 N MacArthur',
      billingProviderAddress2: cms1500.billingProvider?.address2 || '',
      billingProviderCity: cms1500.billingProvider?.city || 'Oklahoma City',
      billingProviderState: cms1500.billingProvider?.state || 'OK',
      billingProviderZip: cms1500.billingProvider?.zip || '73162-1852',
      billingProviderNpi: cms1500.billingProvider?.npi || '1902270267',
      billingProviderTaxonomy: cms1500.billingProvider?.taxonomyCode || '101YM0800X',
    };
    
    setClaimFormData(formData);
    setClaimStatus("draft");
    setLastSaved(null);
    setShowClaimForm(true);
  };

  const createClaims = () => {
    // Get first selected session to open claim form
    const selectedSession = unbilledSessions.find(s => selectedSessions.has(s.appointment.id));
    if (selectedSession) {
      openClaimForm(selectedSession);
    }
    setShowCreateModal(false);
  };

  const updateClaimField = (field: keyof ClaimFormData, value: any) => {
    if (claimFormData) {
      setClaimFormData({ ...claimFormData, [field]: value });
    }
  };

  const updateServiceLine = (index: number, field: keyof ServiceLine, value: any) => {
    if (claimFormData) {
      const newLines = [...claimFormData.serviceLines];
      newLines[index] = { ...newLines[index], [field]: value };
      
      // Recalculate total
      const total = newLines.reduce((sum, line) => sum + (line.charges * line.units), 0);
      
      setClaimFormData({ 
        ...claimFormData, 
        serviceLines: newLines,
        totalCharge: total
      });
    }
  };

  // Save claim progress (draft)
  const saveClaimProgress = async () => {
    if (!claimFormData || !currentSession) return;
    
    setSaving(true);
    
    try {
      const locationId = localStorage.getItem("locationId");
      const claimKey = `claim_${currentSession.appointment.id}`;
      
      // Save to localStorage
      const draftData = {
        ...claimFormData,
        _savedAt: new Date().toISOString(),
        _appointmentId: currentSession.appointment.id,
        _patientId: currentSession.appointment.contactId,
        _patientName: getPatientName(currentSession),
      };
      
      const updatedSavedClaims = {
        ...savedClaims,
        [claimKey]: draftData
      };
      
      localStorage.setItem('savedClaims', JSON.stringify(updatedSavedClaims));
      setSavedClaims(updatedSavedClaims);
      setLastSaved(new Date());
      setClaimStatus("draft");
      
      // Also save to backend
      try {
        await fetch(`${API_URL}/api/claims/draft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locationId,
            appointmentId: currentSession.appointment.id,
            patientId: currentSession.appointment.contactId,
            claimData: claimFormData,
            status: 'draft'
          }),
        });
        console.log("Draft saved to backend");
      } catch (backendErr) {
        // If backend save fails, local save still worked
        console.log("Backend save failed, but local save succeeded:", backendErr);
      }
      
    } catch (err: any) {
      console.error("Error saving claim:", err);
      alert("Failed to save claim progress: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Load saved claim data when opening a claim form
  const loadSavedClaimData = (appointmentId: string): any | null => {
    const claimKey = `claim_${appointmentId}`;
    return savedClaims[claimKey] || null;
  };

  // Delete saved claim draft
  const deleteSavedClaim = (appointmentId: string) => {
    const claimKey = `claim_${appointmentId}`;
    const updatedSavedClaims = { ...savedClaims };
    delete updatedSavedClaims[claimKey];
    localStorage.setItem('savedClaims', JSON.stringify(updatedSavedClaims));
    setSavedClaims(updatedSavedClaims);
  };

  const submitClaimToStedi = async () => {
    if (!claimFormData) return;
    if (!currentSession && !editingClaim) return;
    
    setSubmitting(true);
    
    try {
      const locationId = localStorage.getItem("locationId");
      
      // Get patient/appointment info from either currentSession or editingClaim
      const appointmentId = currentSession?.appointment.id || editingClaim?.appointmentId || editingClaim?.id;
      const patientId = currentSession?.appointment.contactId || editingClaim?.patientId;
      const patientControlNumber = editingClaim?.patientControlNumber || `${patientId?.slice(-6) || "000000"}-${Date.now().toString().slice(-6)}`;
      
      // Get patient name for audit logging
      const patientName = currentSession 
        ? getPatientName(currentSession)
        : editingClaim?.patientInfo?.name || `${editingClaim?.patientInfo?.firstName || ''} ${editingClaim?.patientInfo?.lastName || ''}`.trim() || 'Unknown';
      
      // Build complete CMS-1500 payload with ALL fields
      const payload = {
        locationId,
        appointmentId,
        patientId,
        patientControlNumber,
        editingClaimId: editingClaim?.id, // Include if editing existing claim
        
        // Box 1, 1a - Payer Info
        payer: {
          payerId: claimFormData.payerId,
          payerName: claimFormData.payerName,
          address1: claimFormData.payerAddress1,
          address2: claimFormData.payerAddress2,
          city: claimFormData.payerCity,
          state: claimFormData.payerState,
          zip: claimFormData.payerZip,
          memberId: claimFormData.memberId,
        },
        
        // Box 2, 3, 5 - Patient Info
        patient: {
          lastName: claimFormData.patientLastName,
          firstName: claimFormData.patientFirstName,
          middleName: claimFormData.patientMiddleName,
          dob: claimFormData.patientDob,
          dobFormatted: claimFormData.patientDob.replace(/-/g, ""),
          sex: claimFormData.patientSex,
          address1: claimFormData.patientAddress1,
          address2: claimFormData.patientAddress2,
          city: claimFormData.patientCity,
          state: claimFormData.patientState,
          zip: claimFormData.patientZip,
          phone: claimFormData.patientPhone,
        },
        
        // Box 4, 7, 11 - Insured Info
        insured: {
          lastName: claimFormData.insuredLastName,
          firstName: claimFormData.insuredFirstName,
          middleName: claimFormData.insuredMiddleName,
          address1: claimFormData.insuredAddress1,
          address2: claimFormData.insuredAddress2,
          city: claimFormData.insuredCity,
          state: claimFormData.insuredState,
          zip: claimFormData.insuredZip,
          phone: claimFormData.insuredPhone,
          dob: claimFormData.insuredDob,
          dobFormatted: claimFormData.insuredDob ? claimFormData.insuredDob.replace(/-/g, "") : "",
          sex: claimFormData.insuredSex,
          policyGroupId: claimFormData.insuredPolicyGroupId,
          employerName: claimFormData.employerName,
        },
        
        // Box 6 - Patient Relationship to Insured
        patientRelationship: claimFormData.patientRelationship,
        
        // Box 9 - Other Insured
        otherInsured: {
          name: claimFormData.otherInsuredName,
          policyId: claimFormData.otherInsuredPolicyId,
          groupNumber: claimFormData.otherInsuredGroupNumber,
        },
        
        // Box 10 - Condition Related To
        conditionRelatedTo: {
          employment: claimFormData.conditionEmployment,
          autoAccident: claimFormData.conditionAutoAccident,
          autoAccidentState: claimFormData.conditionAutoAccidentState,
          otherAccident: claimFormData.conditionOtherAccident,
        },
        
        // Box 10d - Claim Codes
        claimCodes: claimFormData.claimCodes,
        
        // Box 11c - Insurance Plan Name
        insurancePlanName: claimFormData.insurancePlanName,
        
        // Box 11d - Other Health Benefit Plan
        hasOtherHealthPlan: claimFormData.hasOtherHealthPlan,
        
        // Box 12, 13 - Signatures
        signatureOnFile: claimFormData.signatureOnFile,
        
        // Box 14 - Date of Current Illness/Injury
        dateOfIllness: claimFormData.dateOfIllness,
        dateOfIllnessFormatted: claimFormData.dateOfIllness ? claimFormData.dateOfIllness.replace(/-/g, "") : "",
        
        // Box 15 - Other Date
        otherDate: claimFormData.otherDate,
        otherDateFormatted: claimFormData.otherDate ? claimFormData.otherDate.replace(/-/g, "") : "",
        
        // Box 16 - Dates Unable to Work
        unableToWork: {
          from: claimFormData.unableToWorkFrom,
          fromFormatted: claimFormData.unableToWorkFrom ? claimFormData.unableToWorkFrom.replace(/-/g, "") : "",
          to: claimFormData.unableToWorkTo,
          toFormatted: claimFormData.unableToWorkTo ? claimFormData.unableToWorkTo.replace(/-/g, "") : "",
        },
        
        // Box 17, 17a, 17b - Referring Provider
        referringProvider: {
          name: claimFormData.referringProviderName,
          npi: claimFormData.referringProviderNpi,
          qualifier: claimFormData.referringProviderType,
        },
        
        // Box 18 - Hospitalization Dates
        hospitalization: {
          from: claimFormData.hospitalizationFrom,
          fromFormatted: claimFormData.hospitalizationFrom ? claimFormData.hospitalizationFrom.replace(/-/g, "") : "",
          to: claimFormData.hospitalizationTo,
          toFormatted: claimFormData.hospitalizationTo ? claimFormData.hospitalizationTo.replace(/-/g, "") : "",
        },
        
        // Box 19 - Additional Claim Info
        additionalClaimInfo: claimFormData.additionalClaimInfo,
        
        // Box 20 - Outside Lab
        outsideLab: claimFormData.outsideLab,
        outsideLabCharges: claimFormData.outsideLabCharges,
        
        // Box 21 - Diagnosis Codes
        diagnosisCodes: claimFormData.diagnosisCodes,
        icdIndicator: claimFormData.icdIndicator,
        
        // Box 22 - Resubmission
        resubmission: {
          code: claimFormData.resubmissionCode,
          originalRefNumber: claimFormData.originalRefNumber,
        },
        
        // Box 23 - Prior Authorization
        priorAuthNumber: claimFormData.priorAuthNumber,
        
        // Box 24 - Service Lines (ALL fields)
        serviceLines: claimFormData.serviceLines.map(line => ({
          dateFrom: line.dateFrom,
          dateFromFormatted: line.dateFrom ? line.dateFrom.replace(/-/g, "") : "",
          dateTo: line.dateTo,
          dateToFormatted: line.dateTo ? line.dateTo.replace(/-/g, "") : "",
          placeOfService: line.placeOfService,
          emg: line.emg,
          cptCode: line.cptCode,
          modifier1: line.modifier1,
          modifier2: line.modifier2,
          modifier3: line.modifier3,
          modifier4: line.modifier4,
          diagnosisPointer: line.diagnosisPointer,
          charges: line.charges,
          units: line.units,
          renderingProviderNpi: line.renderingProviderNpi,
          renderingProviderName: line.renderingProviderName,
        })),
        
        // Box 25 - Federal Tax ID
        federalTaxId: claimFormData.federalTaxId,
        federalTaxIdFormatted: claimFormData.federalTaxId.replace(/-/g, ""),
        federalTaxIdType: claimFormData.federalTaxIdType,
        
        // Box 26 - Patient Account Number
        patientAccountNumber: claimFormData.patientAccountNumber,
        
        // Box 27 - Accept Assignment
        acceptAssignment: claimFormData.acceptAssignment,
        
        // Box 28 - Total Charge
        totalCharge: claimFormData.totalCharge,
        
        // Box 29 - Amount Paid
        amountPaid: claimFormData.amountPaid,
        
        // Box 32 - Service Facility
        serviceFacility: {
          name: claimFormData.facilityName,
          address1: claimFormData.facilityAddress1,
          address2: claimFormData.facilityAddress2,
          city: claimFormData.facilityCity,
          state: claimFormData.facilityState,
          zip: claimFormData.facilityZip,
          npi: claimFormData.facilityNpi,
          otherId: claimFormData.facilityOtherId,
        },
        
        // Box 33 - Billing Provider
        billingProvider: {
          name: claimFormData.billingProviderName,
          address1: claimFormData.billingProviderAddress1,
          address2: claimFormData.billingProviderAddress2,
          city: claimFormData.billingProviderCity,
          state: claimFormData.billingProviderState,
          zip: claimFormData.billingProviderZip,
          phone: claimFormData.billingProviderPhone,
          npi: claimFormData.billingProviderNpi,
          taxonomyCode: claimFormData.billingProviderTaxonomy,
        },
        
        // Rendering Provider (from first service line)
        renderingProvider: {
          firstName: claimFormData.serviceLines[0]?.renderingProviderName.split(" ")[0] || "",
          lastName: claimFormData.serviceLines[0]?.renderingProviderName.split(" ").slice(1).join(" ") || "",
          npi: claimFormData.serviceLines[0]?.renderingProviderNpi || "",
          taxonomyCode: claimFormData.billingProviderTaxonomy,
        },
        
        // Legacy fields for backward compatibility
        payerId: claimFormData.payerId,
        payerName: claimFormData.payerName,
        patientInfo: {
          firstName: claimFormData.patientFirstName,
          lastName: claimFormData.patientLastName,
          dob: claimFormData.patientDob,
          dobFormatted: claimFormData.patientDob.replace(/-/g, ""),
          gender: claimFormData.patientSex,
          memberId: claimFormData.memberId,
          groupNumber: claimFormData.insuredPolicyGroupId,
          address: claimFormData.patientAddress1,
          city: claimFormData.patientCity,
          state: claimFormData.patientState,
          zip: claimFormData.patientZip,
        },
        serviceDate: claimFormData.serviceLines[0]?.dateFrom || "",
        serviceDateFormatted: (claimFormData.serviceLines[0]?.dateFrom || "").replace(/-/g, ""),
        cptCode: claimFormData.serviceLines[0]?.cptCode || "90837",
        chargeAmount: claimFormData.totalCharge,
        units: claimFormData.serviceLines[0]?.units || 1,
        placeOfService: claimFormData.serviceLines[0]?.placeOfService || "02",
        modifiers: [
          claimFormData.serviceLines[0]?.modifier1,
          claimFormData.serviceLines[0]?.modifier2,
          claimFormData.serviceLines[0]?.modifier3,
          claimFormData.serviceLines[0]?.modifier4,
        ].filter(m => m),
      };
      
      const response = await fetch(`${API_URL}/api/claims/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Failed to submit claim");
      }
      
      if (editingClaim) {
        // Editing existing claim - update in the list
        if (result.claim) {
          setSubmittedClaims(prev => prev.map(c => 
            c.id === editingClaim.id ? result.claim : c
          ));
        }
        
        // Audit: Log claim update
        logAudit({
          action: 'UPDATE',
          resourceType: 'claim',
          resourceId: editingClaim.id,
          patientId: patientId || '',
          patientName: patientName,
          description: `Updated claim ${patientControlNumber} for ${patientName} - $${claimFormData.totalCharge}`,
          metadata: {
            payerId: claimFormData.payerId,
            payerName: claimFormData.payerName,
            chargeAmount: claimFormData.totalCharge,
            cptCode: claimFormData.serviceLines[0]?.cptCode
          }
        });
        
        alert("Claim updated and ready for resubmission!");
      } else {
        // New claim - remove from unbilled and add to claims
        if (currentSession) {
          setUnbilledSessions(prev => prev.filter(s => s.appointment.id !== currentSession.appointment.id));
          deleteSavedClaim(currentSession.appointment.id);
        }
        
        if (result.claim) {
          setSubmittedClaims(prev => [result.claim, ...prev]);
        }
        
        // Audit: Log new claim creation
        auditClaimSubmit(
          result.claim?.id || appointmentId || '',
          patientId || '',
          patientName,
          claimFormData.totalCharge
        );
        
        alert("Claim saved! Ready for manual submission to payer.");
      }
      
      setShowClaimForm(false);
      setCurrentSession(null);
      setEditingClaim(null);
      setClaimFormData(null);
      setLastSaved(null);
      
    } catch (err: any) {
      console.error("Error submitting claim:", err);
      alert(`Failed to submit claim: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Update claim status
  const updateClaimStatus = async (claimId: string, newStatus: string, additionalData?: any) => {
    setUpdatingStatus(true);
    try {
      // Find the claim to get patient info for audit
      const claim = submittedClaims.find(c => c.id === claimId);
      const patientName = claim?.patientInfo?.name || 
        `${claim?.patientInfo?.firstName || ''} ${claim?.patientInfo?.lastName || ''}`.trim() || 
        'Unknown';
      
      const response = await fetch(`${API_URL}/api/claims/${claimId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          submittedAt: newStatus === 'submitted' ? new Date().toISOString() : undefined,
          paidAt: newStatus === 'paid' ? new Date().toISOString() : undefined,
          ...additionalData
        }),
      });
      
      const result = await response.json();
      
      if (result.success && result.claim) {
        // Update local state
        setSubmittedClaims(prev => 
          prev.map(c => c.id === claimId ? result.claim : c)
        );
        
        // Audit: Log status change
        logAudit({
          action: 'UPDATE',
          resourceType: 'claim',
          resourceId: claimId,
          patientId: claim?.patientId || '',
          patientName: patientName,
          description: `Claim status changed to ${newStatus} for ${patientName}${newStatus === 'paid' && additionalData?.paidAmount ? ` - Paid $${additionalData.paidAmount}` : ''}`,
          metadata: {
            previousStatus: claim?.status,
            newStatus: newStatus,
            paidAmount: additionalData?.paidAmount,
            notes: additionalData?.notes
          }
        });
        
        setShowStatusModal(false);
        setSelectedClaim(null);
      } else {
        alert("Failed to update claim status");
      }
    } catch (err: any) {
      console.error("Error updating claim status:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Get unique clinicians for filter dropdown
  const uniqueClinicians = Array.from(new Set(unbilledSessions.map(s => s.clinicianName))).filter(Boolean);

  // Access Denied View
  if (hasAccess === false) {
    return (
      <div className="page-wrapper">
        <div className="content container-fluid">
          <div className="d-flex flex-column justify-content-center align-items-center" style={{ minHeight: "400px" }}>
            <div className="rounded-circle bg-danger-subtle d-flex align-items-center justify-content-center mb-4" style={{ width: '80px', height: '80px' }}>
              <i className="ti ti-lock fs-1 text-danger"></i>
            </div>
            <h4 className="mb-2">Access Restricted</h4>
            <p className="text-muted text-center mb-4" style={{ maxWidth: '400px' }}>
              This page is only accessible to Agency Owners, Agency Admins, and Account Admins.
            </p>
            <button 
              className="btn btn-primary rounded-pill"
              onClick={() => navigate('/dashboard')}
            >
              <i className="ti ti-arrow-left me-2"></i>
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || hasAccess === null) {
    return (
      <div className="page-wrapper">
        <div className="content container-fluid">
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px" }}>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // CMS-1500 Claim Form View
  if (showClaimForm && claimFormData && (currentSession || editingClaim)) {
    return (
      <div className="page-wrapper">
        <div className="content container-fluid">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <button className="btn btn-link text-primary p-0" onClick={() => { setShowClaimForm(false); setEditingClaim(null); }}>
                <i className="ti ti-arrow-left me-2"></i>
                {editingClaim ? (
                  <>Edit Claim: {editingClaim.patientInfo?.name || editingClaim.patientInfo?.firstName + ' ' + editingClaim.patientInfo?.lastName || 'Unknown'}</>
                ) : (
                  <>Insurance Claim for {currentSession ? getPatientName(currentSession) : 'Unknown'}</>
                )}
              </button>
            </div>
            <div className="d-flex gap-2 align-items-center">
              {lastSaved && (
                <span className="text-muted small me-2">
                  <i className="ti ti-check text-success me-1"></i>
                  Saved {lastSaved.toLocaleTimeString()}
                </span>
              )}
              <button className="btn btn-outline-secondary btn-sm rounded-pill">
                <i className="ti ti-printer me-1"></i>Print
              </button>
              <button className="btn btn-outline-secondary btn-sm rounded-pill">
                <i className="ti ti-download me-1"></i>Download
              </button>
              <button 
                className="btn btn-outline-primary btn-sm rounded-pill"
                onClick={saveClaimProgress}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="ti ti-device-floppy me-1"></i>Save Draft
                  </>
                )}
              </button>
              <button 
                className="btn btn-primary btn-sm rounded-pill"
                onClick={submitClaimToStedi}
                disabled={submitting || saving}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1"></span>
                    Submitting...
                  </>
                ) : (
                  <>
                    <i className="ti ti-send me-1"></i>Submit Claim
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Status Badge */}
          <div className="mb-3">
            <span className="text-muted">CMS-1500 Health Insurance Claim Form</span>
            <span className={`badge ms-2 rounded-pill ${
              claimStatus === 'draft' ? 'bg-info-subtle text-info' :
              claimStatus === 'prepared' ? 'bg-warning-subtle' : 
              claimStatus === 'submitted' ? 'bg-success-subtle text-success' : 
              'bg-secondary-subtle text-secondary'
            }`} style={claimStatus === 'prepared' ? { color: '#b45309' } : {}}>
              {claimStatus === 'draft' ? 'Draft' : claimStatus === 'prepared' ? 'Prepared' : claimStatus === 'submitted' ? 'Submitted' : 'New'}
            </span>
            <Link to="#" className="ms-2 text-primary small">Claim Details →</Link>
          </div>
          
          {/* CMS-1500 Form */}
          <div className="card">
            <div className="card-body p-0">
              <div className="cms-1500-form" style={{ fontSize: "12px", border: "1px solid #ccc" }}>
                {/* Row 1: Payer Info */}
                <div className="row g-0 border-bottom">
                  <div className="col-4 border-end p-2">
                    <div className="fw-bold text-muted small">1. Payer</div>
                    <div className="d-flex gap-3">
                      <span>Payer ID ○</span>
                      <input 
                        type="text" 
                        className="form-control form-control-sm border-0 border-bottom rounded-0 p-0"
                        value={claimFormData.payerId}
                        onChange={(e) => updateClaimField('payerId', e.target.value)}
                        style={{ width: "80px" }}
                      />
                    </div>
                  </div>
                  <div className="col-4 border-end p-2">
                    <div className="fw-bold text-muted small">Payer name</div>
                    <input 
                      type="text" 
                      className="form-control form-control-sm border-0 p-0"
                      value={claimFormData.payerName}
                      onChange={(e) => updateClaimField('payerName', e.target.value)}
                    />
                  </div>
                  <div className="col-4 p-2">
                    <div className="fw-bold text-muted small">1a. Insured member ID</div>
                    <div className="d-flex align-items-center">
                      <span className="me-2">Member ID</span>
                      <input 
                        type="text" 
                        className="form-control form-control-sm border-0 border-bottom rounded-0 p-0"
                        value={claimFormData.memberId}
                        onChange={(e) => updateClaimField('memberId', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Payer Address Row */}
                <div className="row g-0 border-bottom">
                  <div className="col-4 border-end p-2">
                    <div className="row g-1">
                      <div className="col-6">
                        <small className="text-muted">Address line 1</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.payerAddress1}
                          onChange={(e) => updateClaimField('payerAddress1', e.target.value)}
                        />
                      </div>
                      <div className="col-6">
                        <small className="text-muted">Address line 2</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.payerAddress2}
                          onChange={(e) => updateClaimField('payerAddress2', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col-4 border-end p-2">
                    <div className="row g-1">
                      <div className="col-5">
                        <small className="text-muted">City</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.payerCity}
                          onChange={(e) => updateClaimField('payerCity', e.target.value)}
                        />
                      </div>
                      <div className="col-3">
                        <small className="text-muted">State</small>
                        <select 
                          className="form-select form-select-sm"
                          value={claimFormData.payerState}
                          onChange={(e) => updateClaimField('payerState', e.target.value)}
                        >
                          {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="col-4">
                        <small className="text-muted">Zip</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.payerZip}
                          onChange={(e) => updateClaimField('payerZip', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col-4 p-2"></div>
                </div>
                
                {/* Patient Name Row */}
                <div className="row g-0 border-bottom">
                  <div className="col-4 border-end p-2">
                    <div className="fw-bold text-muted small">2. Patient name</div>
                    <div className="row g-1">
                      <div className="col-4">
                        <small className="text-muted">Last name</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.patientLastName}
                          onChange={(e) => updateClaimField('patientLastName', e.target.value)}
                        />
                      </div>
                      <div className="col-4">
                        <small className="text-muted">First name</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.patientFirstName}
                          onChange={(e) => updateClaimField('patientFirstName', e.target.value)}
                        />
                      </div>
                      <div className="col-4">
                        <small className="text-muted">Middle name</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.patientMiddleName}
                          onChange={(e) => updateClaimField('patientMiddleName', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col-4 border-end p-2">
                    <div className="fw-bold text-muted small">3. Patient info</div>
                    <div className="row g-1">
                      <div className="col-6">
                        <small className="text-muted">Date of birth</small>
                        <input 
                          type="date" 
                          className="form-control form-control-sm"
                          value={claimFormData.patientDob}
                          onChange={(e) => updateClaimField('patientDob', e.target.value)}
                        />
                      </div>
                      <div className="col-6">
                        <small className="text-muted">Sex</small>
                        <div className="d-flex gap-2 mt-1">
                          <label className="form-check-label">
                            <input 
                              type="radio" 
                              className="form-check-input me-1"
                              checked={claimFormData.patientSex === "M"}
                              onChange={() => updateClaimField('patientSex', 'M')}
                            />
                            M
                          </label>
                          <label className="form-check-label">
                            <input 
                              type="radio" 
                              className="form-check-input me-1"
                              checked={claimFormData.patientSex === "F"}
                              onChange={() => updateClaimField('patientSex', 'F')}
                            />
                            F
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-4 p-2">
                    <div className="fw-bold text-muted small">4. Insured's name</div>
                    <div className="row g-1">
                      <div className="col-4">
                        <small className="text-muted">Last name</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.insuredLastName}
                          onChange={(e) => updateClaimField('insuredLastName', e.target.value)}
                        />
                      </div>
                      <div className="col-4">
                        <small className="text-muted">First name</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.insuredFirstName}
                          onChange={(e) => updateClaimField('insuredFirstName', e.target.value)}
                        />
                      </div>
                      <div className="col-4">
                        <small className="text-muted">Middle name</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.insuredMiddleName}
                          onChange={(e) => updateClaimField('insuredMiddleName', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Patient Address Row */}
                <div className="row g-0 border-bottom">
                  <div className="col-4 border-end p-2">
                    <div className="fw-bold text-muted small">5. Patient's address</div>
                    <div className="row g-1">
                      <div className="col-6">
                        <small className="text-muted">Address line 1</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.patientAddress1}
                          onChange={(e) => updateClaimField('patientAddress1', e.target.value)}
                        />
                      </div>
                      <div className="col-6">
                        <small className="text-muted">Address line 2</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.patientAddress2}
                          onChange={(e) => updateClaimField('patientAddress2', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col-4 border-end p-2">
                    <div className="fw-bold text-muted small">6. Patient relationship to insured</div>
                    <div className="d-flex gap-3 mt-1">
                      {["Self", "Spouse", "Child", "Other"].map(rel => (
                        <label key={rel} className="form-check-label">
                          <input 
                            type="radio" 
                            className="form-check-input me-1"
                            checked={claimFormData.patientRelationship === rel}
                            onChange={() => updateClaimField('patientRelationship', rel)}
                          />
                          {rel}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="col-4 p-2">
                    <div className="fw-bold text-muted small">7. Insured's address</div>
                    <div className="row g-1">
                      <div className="col-6">
                        <small className="text-muted">Address line 1</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.insuredAddress1}
                          onChange={(e) => updateClaimField('insuredAddress1', e.target.value)}
                        />
                      </div>
                      <div className="col-6">
                        <small className="text-muted">Address line 2</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.insuredAddress2}
                          onChange={(e) => updateClaimField('insuredAddress2', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* City/State/Zip Row */}
                <div className="row g-0 border-bottom">
                  <div className="col-4 border-end p-2">
                    <div className="row g-1">
                      <div className="col-5">
                        <small className="text-muted">City</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.patientCity}
                          onChange={(e) => updateClaimField('patientCity', e.target.value)}
                        />
                      </div>
                      <div className="col-3">
                        <small className="text-muted">State</small>
                        <select 
                          className="form-select form-select-sm"
                          value={claimFormData.patientState}
                          onChange={(e) => updateClaimField('patientState', e.target.value)}
                        >
                          {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="col-4">
                        <small className="text-muted">Zip code</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.patientZip}
                          onChange={(e) => updateClaimField('patientZip', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="mt-1">
                      <small className="text-muted">Telephone (include area code)</small>
                      <input 
                        type="text" 
                        className="form-control form-control-sm"
                        value={claimFormData.patientPhone}
                        onChange={(e) => updateClaimField('patientPhone', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-4 border-end p-2">
                    <div className="fw-bold text-muted small">8. Reserved for NUCC use</div>
                  </div>
                  <div className="col-4 p-2">
                    <div className="row g-1">
                      <div className="col-5">
                        <small className="text-muted">City</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.insuredCity}
                          onChange={(e) => updateClaimField('insuredCity', e.target.value)}
                        />
                      </div>
                      <div className="col-3">
                        <small className="text-muted">State</small>
                        <select 
                          className="form-select form-select-sm"
                          value={claimFormData.insuredState}
                          onChange={(e) => updateClaimField('insuredState', e.target.value)}
                        >
                          {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="col-4">
                        <small className="text-muted">Zip code</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.insuredZip}
                          onChange={(e) => updateClaimField('insuredZip', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="mt-1">
                      <small className="text-muted">Telephone (include area code)</small>
                      <input 
                        type="text" 
                        className="form-control form-control-sm"
                        value={claimFormData.insuredPhone}
                        onChange={(e) => updateClaimField('insuredPhone', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Box 9-11 Row */}
                <div className="row g-0 border-bottom">
                  <div className="col-4 border-end p-2">
                    <div className="fw-bold text-muted small">9. Other insured</div>
                    <div className="row g-1">
                      <div className="col-4">
                        <small className="text-muted">Last name</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.otherInsuredName}
                          onChange={(e) => updateClaimField('otherInsuredName', e.target.value)}
                        />
                      </div>
                      <div className="col-4">
                        <small className="text-muted">First name</small>
                        <input type="text" className="form-control form-control-sm" />
                      </div>
                      <div className="col-4">
                        <small className="text-muted">M.I.</small>
                        <input type="text" className="form-control form-control-sm" />
                      </div>
                    </div>
                    <div className="row g-1 mt-1">
                      <div className="col-4">
                        <small className="text-muted">a1. Policy/Group ID</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.otherInsuredPolicyId}
                          onChange={(e) => updateClaimField('otherInsuredPolicyId', e.target.value)}
                        />
                      </div>
                      <div className="col-4">
                        <small className="text-muted">a2. Insured's ID</small>
                        <input type="text" className="form-control form-control-sm" />
                      </div>
                      <div className="col-4">
                        <small className="text-muted">a3. Indicator code</small>
                        <input type="text" className="form-control form-control-sm" />
                      </div>
                    </div>
                  </div>
                  <div className="col-4 border-end p-2">
                    <div className="fw-bold text-muted small">10. Is patient's condition related to:</div>
                    <div className="mt-1">
                      <div className="d-flex justify-content-between">
                        <span>a. Employment? (current or previous)</span>
                        <div className="d-flex gap-2">
                          <label><input type="radio" className="me-1" name="employment" checked={claimFormData.conditionEmployment} onChange={() => updateClaimField('conditionEmployment', true)} />YES</label>
                          <label><input type="radio" className="me-1" name="employment" checked={!claimFormData.conditionEmployment} onChange={() => updateClaimField('conditionEmployment', false)} />NO</label>
                        </div>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span>b. Auto accident?</span>
                        <div className="d-flex gap-2">
                          <label><input type="radio" className="me-1" name="auto" checked={claimFormData.conditionAutoAccident} onChange={() => updateClaimField('conditionAutoAccident', true)} />YES</label>
                          <label><input type="radio" className="me-1" name="auto" checked={!claimFormData.conditionAutoAccident} onChange={() => updateClaimField('conditionAutoAccident', false)} />NO</label>
                          <select 
                            className="form-select form-select-sm" 
                            style={{ width: "60px" }}
                            value={claimFormData.conditionAutoAccidentState}
                            onChange={(e) => updateClaimField('conditionAutoAccidentState', e.target.value)}
                          >
                            <option>N/A</option>
                            {US_STATES.map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span>c. Other accident?</span>
                        <div className="d-flex gap-2">
                          <label><input type="radio" className="me-1" name="other" checked={claimFormData.conditionOtherAccident} onChange={() => updateClaimField('conditionOtherAccident', true)} />YES</label>
                          <label><input type="radio" className="me-1" name="other" checked={!claimFormData.conditionOtherAccident} onChange={() => updateClaimField('conditionOtherAccident', false)} />NO</label>
                        </div>
                      </div>
                      <div className="mt-1">
                        <small className="text-muted">10d. Claim codes (designated by NUCC)</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.claimCodes}
                          onChange={(e) => updateClaimField('claimCodes', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col-4 p-2">
                    <div className="fw-bold text-muted small">11. Insured's policy group or FECA number</div>
                    <div className="row g-1">
                      <div className="col-12">
                        <small className="text-muted">Policy/Group ID</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.insuredPolicyGroupId}
                          onChange={(e) => updateClaimField('insuredPolicyGroupId', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="row g-1 mt-1">
                      <div className="col-6">
                        <small className="text-muted">a. Insured's date of birth</small>
                        <input 
                          type="date" 
                          className="form-control form-control-sm"
                          value={claimFormData.insuredDob}
                          onChange={(e) => updateClaimField('insuredDob', e.target.value)}
                        />
                      </div>
                      <div className="col-6">
                        <small className="text-muted">Insured's sex</small>
                        <div className="d-flex gap-2 mt-1">
                          <label><input type="radio" className="me-1" checked={claimFormData.insuredSex === "M"} onChange={() => updateClaimField('insuredSex', 'M')} />M</label>
                          <label><input type="radio" className="me-1" checked={claimFormData.insuredSex === "F"} onChange={() => updateClaimField('insuredSex', 'F')} />F</label>
                        </div>
                      </div>
                    </div>
                    <div className="row g-1 mt-1">
                      <div className="col-12">
                        <small className="text-muted">b. Other claim ID (designated by NUCC)</small>
                        <input type="text" className="form-control form-control-sm" />
                      </div>
                    </div>
                    <div className="row g-1 mt-1">
                      <div className="col-12">
                        <small className="text-muted">c. Insurance plan name or program name</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.insurancePlanName}
                          onChange={(e) => updateClaimField('insurancePlanName', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="mt-1">
                      <small className="text-muted">d. Is there another health benefit plan?</small>
                      <div className="d-flex gap-2">
                        <label><input type="radio" className="me-1" checked={claimFormData.hasOtherHealthPlan} onChange={() => updateClaimField('hasOtherHealthPlan', true)} />YES</label>
                        <label><input type="radio" className="me-1" checked={!claimFormData.hasOtherHealthPlan} onChange={() => updateClaimField('hasOtherHealthPlan', false)} />NO</label>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Signatures Row - Box 12, 13 */}
                <div className="row g-0 border-bottom">
                  <div className="col-6 border-end p-2">
                    <div className="fw-bold text-muted small">12. Patient's or authorized person's signature</div>
                    <div className="d-flex gap-2 align-items-center mt-1">
                      <label><input type="checkbox" className="me-1" checked={claimFormData.signatureOnFile} onChange={(e) => updateClaimField('signatureOnFile', e.target.checked)} />Signature on file</label>
                      <span className="text-muted small">Date: {new Date().toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="col-6 p-2">
                    <div className="fw-bold text-muted small">13. Insured's or authorized person's signature</div>
                    <div className="d-flex gap-2 align-items-center mt-1">
                      <label><input type="checkbox" className="me-1" checked={claimFormData.signatureOnFile} onChange={(e) => updateClaimField('signatureOnFile', e.target.checked)} />Signature on file</label>
                    </div>
                  </div>
                </div>
                
                {/* Dates Row - Box 14-18 */}
                <div className="row g-0 border-bottom">
                  <div className="col-3 border-end p-2">
                    <div className="fw-bold text-muted small">14. Date of current illness, injury, or pregnancy (LMP)</div>
                    <input 
                      type="date" 
                      className="form-control form-control-sm"
                      value={claimFormData.dateOfIllness}
                      onChange={(e) => updateClaimField('dateOfIllness', e.target.value)}
                    />
                  </div>
                  <div className="col-3 border-end p-2">
                    <div className="fw-bold text-muted small">15. Other date</div>
                    <input 
                      type="date" 
                      className="form-control form-control-sm"
                      value={claimFormData.otherDate}
                      onChange={(e) => updateClaimField('otherDate', e.target.value)}
                    />
                  </div>
                  <div className="col-3 border-end p-2">
                    <div className="fw-bold text-muted small">16. Dates patient unable to work</div>
                    <div className="d-flex gap-1">
                      <input 
                        type="date" 
                        className="form-control form-control-sm"
                        placeholder="From"
                        value={claimFormData.unableToWorkFrom}
                        onChange={(e) => updateClaimField('unableToWorkFrom', e.target.value)}
                      />
                      <input 
                        type="date" 
                        className="form-control form-control-sm"
                        placeholder="To"
                        value={claimFormData.unableToWorkTo}
                        onChange={(e) => updateClaimField('unableToWorkTo', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-3 p-2">
                    <div className="fw-bold text-muted small">18. Hospitalization dates related to current services</div>
                    <div className="d-flex gap-1">
                      <input 
                        type="date" 
                        className="form-control form-control-sm"
                        placeholder="From"
                        value={claimFormData.hospitalizationFrom}
                        onChange={(e) => updateClaimField('hospitalizationFrom', e.target.value)}
                      />
                      <input 
                        type="date" 
                        className="form-control form-control-sm"
                        placeholder="To"
                        value={claimFormData.hospitalizationTo}
                        onChange={(e) => updateClaimField('hospitalizationTo', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Box 17, 19, 20 */}
                <div className="row g-0 border-bottom">
                  <div className="col-4 border-end p-2">
                    <div className="fw-bold text-muted small">17. Name of referring provider or other source</div>
                    <input 
                      type="text" 
                      className="form-control form-control-sm mb-1"
                      placeholder="Provider name"
                      value={claimFormData.referringProviderName}
                      onChange={(e) => updateClaimField('referringProviderName', e.target.value)}
                    />
                    <div className="row g-1">
                      <div className="col-6">
                        <small className="text-muted">17a. NPI</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.referringProviderNpi}
                          onChange={(e) => updateClaimField('referringProviderNpi', e.target.value)}
                        />
                      </div>
                      <div className="col-6">
                        <small className="text-muted">17b. Qualifier</small>
                        <select 
                          className="form-select form-select-sm"
                          value={claimFormData.referringProviderType}
                          onChange={(e) => updateClaimField('referringProviderType', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="DN">Referring Provider</option>
                          <option value="DK">Ordering Provider</option>
                          <option value="DQ">Supervising Provider</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="col-4 border-end p-2">
                    <div className="fw-bold text-muted small">19. Additional claim information</div>
                    <textarea 
                      className="form-control form-control-sm"
                      rows={3}
                      value={claimFormData.additionalClaimInfo}
                      onChange={(e) => updateClaimField('additionalClaimInfo', e.target.value)}
                    ></textarea>
                  </div>
                  <div className="col-4 p-2">
                    <div className="fw-bold text-muted small">20. Outside lab?</div>
                    <div className="d-flex gap-2 align-items-center">
                      <label><input type="radio" className="me-1" checked={claimFormData.outsideLab} onChange={() => updateClaimField('outsideLab', true)} />YES</label>
                      <label><input type="radio" className="me-1" checked={!claimFormData.outsideLab} onChange={() => updateClaimField('outsideLab', false)} />NO</label>
                      <span className="ms-2">$ Charges:</span>
                      <input 
                        type="text" 
                        className="form-control form-control-sm"
                        style={{ width: "80px" }}
                        value={claimFormData.outsideLabCharges}
                        onChange={(e) => updateClaimField('outsideLabCharges', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Diagnosis Codes - Box 21 */}
                <div className="row g-0 border-bottom">
                  <div className="col-8 border-end p-2">
                    <div className="fw-bold text-muted small">21. Diagnosis or nature of illness or injury (relate A-L to service line below (24E))</div>
                    <div className="row g-1 mt-1">
                      <div className="col-1 text-center">
                        <small className="text-muted">ICD Ind.</small>
                        <div>{claimFormData.icdIndicator}</div>
                      </div>
                      {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].map((letter, idx) => (
                        <div key={letter} className="col">
                          <small className="text-muted">{letter}</small>
                          <input 
                            type="text" 
                            className="form-control form-control-sm"
                            value={claimFormData.diagnosisCodes[idx] || ""}
                            onChange={(e) => {
                              const newCodes = [...claimFormData.diagnosisCodes];
                              newCodes[idx] = e.target.value;
                              updateClaimField('diagnosisCodes', newCodes.filter(c => c));
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="col-4 p-2">
                    <div className="fw-bold text-muted small">22. Resubmission code</div>
                    <div className="d-flex gap-2 mt-1">
                      <label><input type="radio" className="me-1" checked={claimFormData.resubmissionCode === "1"} onChange={() => updateClaimField('resubmissionCode', '1')} />Original (1)</label>
                      <label><input type="radio" className="me-1" checked={claimFormData.resubmissionCode === "7"} onChange={() => updateClaimField('resubmissionCode', '7')} />Replacement (7)</label>
                      <label><input type="radio" className="me-1" checked={claimFormData.resubmissionCode === "8"} onChange={() => updateClaimField('resubmissionCode', '8')} />Void (8)</label>
                    </div>
                    <div className="mt-2">
                      <small className="text-muted">Original ref. no.</small>
                      <input 
                        type="text" 
                        className="form-control form-control-sm"
                        value={claimFormData.originalRefNumber}
                        onChange={(e) => updateClaimField('originalRefNumber', e.target.value)}
                      />
                    </div>
                    <div className="mt-2">
                      <div className="fw-bold text-muted small">23. Prior authorization number</div>
                      <input 
                        type="text" 
                        className="form-control form-control-sm"
                        value={claimFormData.priorAuthNumber}
                        onChange={(e) => updateClaimField('priorAuthNumber', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Service Lines - Box 24 */}
                <div className="row g-0 border-bottom">
                  <div className="col-12 p-2">
                    <div className="fw-bold text-muted small">24. Service Lines</div>
                    <table className="table table-sm table-bordered mb-0 mt-1" style={{ fontSize: "11px" }}>
                      <thead className="table-light">
                        <tr>
                          <th>a. Date(s) of service<br/><small>From / To</small></th>
                          <th>b. Place of service</th>
                          <th>c. EMG</th>
                          <th>d. Procedures, services, or supplies<br/><small>CPT/HCPCS / Modifier</small></th>
                          <th>e. Diagnosis pointer</th>
                          <th>f. $ Charges</th>
                          <th>g. Days or units</th>
                          <th>h. EPSDT Family plan</th>
                          <th>i. ID Qual.</th>
                          <th>j. Rendering Provider ID #</th>
                        </tr>
                      </thead>
                      <tbody>
                        {claimFormData.serviceLines.map((line, idx) => (
                          <tr key={idx}>
                            <td>
                              <input 
                                type="date" 
                                className="form-control form-control-sm"
                                value={line.dateFrom}
                                onChange={(e) => updateServiceLine(idx, 'dateFrom', e.target.value)}
                                style={{ fontSize: "10px" }}
                              />
                              <input 
                                type="date" 
                                className="form-control form-control-sm mt-1"
                                value={line.dateTo}
                                onChange={(e) => updateServiceLine(idx, 'dateTo', e.target.value)}
                                style={{ fontSize: "10px" }}
                              />
                            </td>
                            <td>
                              <select 
                                className="form-select form-select-sm"
                                value={line.placeOfService}
                                onChange={(e) => updateServiceLine(idx, 'placeOfService', e.target.value)}
                                style={{ fontSize: "10px" }}
                              >
                                {PLACE_OF_SERVICE_CODES.map(pos => (
                                  <option key={pos.code} value={pos.code}>{pos.code}</option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input 
                                type="text" 
                                className="form-control form-control-sm"
                                value={line.emg}
                                onChange={(e) => updateServiceLine(idx, 'emg', e.target.value)}
                                style={{ width: "40px", fontSize: "10px" }}
                              />
                            </td>
                            <td>
                              <div className="d-flex gap-1">
                                <select 
                                  className="form-select form-select-sm"
                                  value={line.cptCode}
                                  onChange={(e) => updateServiceLine(idx, 'cptCode', e.target.value)}
                                  style={{ fontSize: "10px" }}
                                >
                                  {CPT_CODES.map(cpt => (
                                    <option key={cpt.code} value={cpt.code}>{cpt.code}</option>
                                  ))}
                                </select>
                                <select 
                                  className="form-select form-select-sm"
                                  value={line.modifier1}
                                  onChange={(e) => updateServiceLine(idx, 'modifier1', e.target.value)}
                                  style={{ width: "60px", fontSize: "10px" }}
                                >
                                  {MODIFIERS.map(mod => (
                                    <option key={mod.code} value={mod.code}>{mod.code || "-"}</option>
                                  ))}
                                </select>
                                <select 
                                  className="form-select form-select-sm"
                                  value={line.modifier2}
                                  onChange={(e) => updateServiceLine(idx, 'modifier2', e.target.value)}
                                  style={{ width: "60px", fontSize: "10px" }}
                                >
                                  {MODIFIERS.map(mod => (
                                    <option key={mod.code} value={mod.code}>{mod.code || "-"}</option>
                                  ))}
                                </select>
                              </div>
                            </td>
                            <td>
                              <input 
                                type="text" 
                                className="form-control form-control-sm"
                                value={line.diagnosisPointer}
                                onChange={(e) => updateServiceLine(idx, 'diagnosisPointer', e.target.value)}
                                style={{ width: "60px", fontSize: "10px" }}
                              />
                            </td>
                            <td>
                              <input 
                                type="number" 
                                className="form-control form-control-sm"
                                value={line.charges}
                                onChange={(e) => updateServiceLine(idx, 'charges', parseFloat(e.target.value) || 0)}
                                style={{ width: "80px", fontSize: "10px" }}
                              />
                            </td>
                            <td>
                              <input 
                                type="number" 
                                className="form-control form-control-sm"
                                value={line.units}
                                onChange={(e) => updateServiceLine(idx, 'units', parseInt(e.target.value) || 1)}
                                style={{ width: "50px", fontSize: "10px" }}
                              />
                            </td>
                            <td>
                              <input 
                                type="text" 
                                className="form-control form-control-sm"
                                style={{ width: "50px", fontSize: "10px" }}
                              />
                            </td>
                            <td>
                              <input 
                                type="text" 
                                className="form-control form-control-sm"
                                style={{ width: "50px", fontSize: "10px" }}
                              />
                            </td>
                            <td>
                              <input 
                                type="text" 
                                className="form-control form-control-sm"
                                value={line.renderingProviderName}
                                onChange={(e) => updateServiceLine(idx, 'renderingProviderName', e.target.value)}
                                style={{ fontSize: "10px" }}
                              />
                              <input 
                                type="text" 
                                className="form-control form-control-sm mt-1"
                                value={line.renderingProviderNpi}
                                onChange={(e) => updateServiceLine(idx, 'renderingProviderNpi', e.target.value)}
                                placeholder="NPI"
                                style={{ fontSize: "10px" }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                {/* Bottom Section - Box 25-33 */}
                <div className="row g-0">
                  <div className="col-3 border-end p-2">
                    <div className="fw-bold text-muted small">25. Federal tax ID number</div>
                    <div className="d-flex gap-2 align-items-center">
                      <input 
                        type="text" 
                        className="form-control form-control-sm"
                        value={claimFormData.federalTaxId}
                        onChange={(e) => updateClaimField('federalTaxId', e.target.value)}
                      />
                      <label><input type="radio" className="me-1" checked={claimFormData.federalTaxIdType === "SSN"} onChange={() => updateClaimField('federalTaxIdType', 'SSN')} />SSN</label>
                      <label><input type="radio" className="me-1" checked={claimFormData.federalTaxIdType === "EIN"} onChange={() => updateClaimField('federalTaxIdType', 'EIN')} />EIN</label>
                    </div>
                  </div>
                  <div className="col-2 border-end p-2">
                    <div className="fw-bold text-muted small">26. Patient's account NO.</div>
                    <input 
                      type="text" 
                      className="form-control form-control-sm"
                      value={claimFormData.patientAccountNumber}
                      onChange={(e) => updateClaimField('patientAccountNumber', e.target.value)}
                    />
                  </div>
                  <div className="col-2 border-end p-2">
                    <div className="fw-bold text-muted small">27. Accept assignment?</div>
                    <div className="d-flex gap-2">
                      <label><input type="radio" className="me-1" checked={claimFormData.acceptAssignment} onChange={() => updateClaimField('acceptAssignment', true)} />YES</label>
                      <label><input type="radio" className="me-1" checked={!claimFormData.acceptAssignment} onChange={() => updateClaimField('acceptAssignment', false)} />NO</label>
                    </div>
                  </div>
                  <div className="col-2 border-end p-2">
                    <div className="fw-bold text-muted small">28. Total charge</div>
                    <div className="fw-bold">${claimFormData.totalCharge.toFixed(2)}</div>
                  </div>
                  <div className="col-2 border-end p-2">
                    <div className="fw-bold text-muted small">29. Amount paid</div>
                    <input 
                      type="number" 
                      className="form-control form-control-sm"
                      value={claimFormData.amountPaid}
                      onChange={(e) => updateClaimField('amountPaid', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-1 p-2">
                    <div className="fw-bold text-muted small">30. Rsvd for NUCC use</div>
                  </div>
                </div>
                
                {/* Billing Provider - Box 31-33 */}
                <div className="row g-0 border-top">
                  <div className="col-4 border-end p-2">
                    <div className="fw-bold text-muted small">31. Signature of physician or supplier</div>
                    <div className="mt-2">ELECTRONICALLY SIGNED</div>
                    <div className="mt-1">Date: {new Date().toLocaleDateString()}</div>
                  </div>
                  <div className="col-4 border-end p-2">
                    <div className="fw-bold text-muted small">32. Service facility location information</div>
                    <input 
                      type="text" 
                      className="form-control form-control-sm mb-1" 
                      placeholder="Facility name"
                      value={claimFormData.facilityName}
                      onChange={(e) => updateClaimField('facilityName', e.target.value)}
                    />
                    <input 
                      type="text" 
                      className="form-control form-control-sm mb-1" 
                      placeholder="Address"
                      value={claimFormData.facilityAddress1}
                      onChange={(e) => updateClaimField('facilityAddress1', e.target.value)}
                    />
                    <div className="row g-1">
                      <div className="col-5"><input type="text" className="form-control form-control-sm" placeholder="City" value={claimFormData.facilityCity} onChange={(e) => updateClaimField('facilityCity', e.target.value)} /></div>
                      <div className="col-3"><input type="text" className="form-control form-control-sm" placeholder="State" value={claimFormData.facilityState} onChange={(e) => updateClaimField('facilityState', e.target.value)} /></div>
                      <div className="col-4"><input type="text" className="form-control form-control-sm" placeholder="Zip" value={claimFormData.facilityZip} onChange={(e) => updateClaimField('facilityZip', e.target.value)} /></div>
                    </div>
                    <div className="row g-1 mt-1">
                      <div className="col-6">
                        <small className="text-muted">32a. NPI</small>
                        <input type="text" className="form-control form-control-sm" value={claimFormData.facilityNpi} onChange={(e) => updateClaimField('facilityNpi', e.target.value)} />
                      </div>
                      <div className="col-6">
                        <small className="text-muted">32b. Other ID</small>
                        <input type="text" className="form-control form-control-sm" value={claimFormData.facilityOtherId} onChange={(e) => updateClaimField('facilityOtherId', e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <div className="col-4 p-2">
                    <div className="fw-bold text-muted small">33. Billing provider info & PH #</div>
                    <div className="d-flex gap-2 mb-1">
                      <label><input type="radio" className="me-1" />Individual</label>
                      <label><input type="radio" className="me-1" defaultChecked />Organization</label>
                    </div>
                    <div className="row g-1">
                      <div className="col-6">
                        <small className="text-muted">Phone number</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.billingProviderPhone}
                          onChange={(e) => updateClaimField('billingProviderPhone', e.target.value)}
                        />
                      </div>
                      <div className="col-6">
                        <small className="text-muted">Organization name</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.billingProviderName}
                          onChange={(e) => updateClaimField('billingProviderName', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="row g-1 mt-1">
                      <div className="col-12">
                        <small className="text-muted">Address</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.billingProviderAddress1}
                          onChange={(e) => updateClaimField('billingProviderAddress1', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="row g-1 mt-1">
                      <div className="col-5">
                        <small className="text-muted">City</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.billingProviderCity}
                          onChange={(e) => updateClaimField('billingProviderCity', e.target.value)}
                        />
                      </div>
                      <div className="col-3">
                        <small className="text-muted">State</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.billingProviderState}
                          onChange={(e) => updateClaimField('billingProviderState', e.target.value)}
                        />
                      </div>
                      <div className="col-4">
                        <small className="text-muted">Zip</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.billingProviderZip}
                          onChange={(e) => updateClaimField('billingProviderZip', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="row g-1 mt-1">
                      <div className="col-6">
                        <small className="text-muted">33a. Billing provider NPI</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.billingProviderNpi}
                          onChange={(e) => updateClaimField('billingProviderNpi', e.target.value)}
                        />
                      </div>
                      <div className="col-6">
                        <small className="text-muted">33b. Taxonomy code</small>
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={claimFormData.billingProviderTaxonomy}
                          onChange={(e) => updateClaimField('billingProviderTaxonomy', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  // Calculate KPI metrics
  const kpiMetrics = {
    readyToBill: unbilledSessions.length,
    pendingClaims: submittedClaims.filter(c => c.status === 'submitted').length,
    needsAttention: submittedClaims.filter(c => c.status === 'denied' || c.status === 'rejected').length,
    totalOutstanding: submittedClaims
      .filter(c => c.status !== 'paid')
      .reduce((sum, c) => sum + (c.chargeAmount || 0), 0),
    paidThisMonth: submittedClaims
      .filter(c => c.status === 'paid' && c.paidAt && new Date(c.paidAt).getMonth() === new Date().getMonth())
      .reduce((sum, c) => sum + (c.paidAmount || 0), 0),
  };

  // Main Insurance Page
  return (
    <div className="page-wrapper">
      <div className="content container-fluid">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h4 className="mb-1 fw-semibold">Claims Center</h4>
            <p className="text-muted mb-0 small">Manage claims, track payments, and monitor billing workflow</p>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary rounded-pill">
              <i className="ti ti-download me-1"></i>
              Export
            </button>
            <button className="btn btn-primary rounded-pill">
              <i className="ti ti-plus me-1"></i>
              Record Payment
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger rounded-3" role="alert">
            {error}
          </div>
        )}

        {/* KPI Tiles */}
        <div className="row g-3 mb-4">
          <div className="col-lg-3 col-md-6">
            <div 
              className={`card border-0 shadow-sm h-100 ${activeTab === 'unbilled' ? 'border-start border-4 border-primary' : ''}`}
              style={{ cursor: 'pointer', borderRadius: '12px' }}
              onClick={() => setActiveTab('unbilled')}
            >
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted small mb-1">Ready to Bill</p>
                    <h3 className="mb-0 fw-bold">{kpiMetrics.readyToBill}</h3>
                    <small className="text-muted">sessions</small>
                  </div>
                  <div className="rounded-circle bg-primary-subtle d-flex align-items-center justify-content-center" style={{ width: '48px', height: '48px' }}>
                    <i className="ti ti-receipt fs-4 text-primary"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-3 col-md-6">
            <div 
              className={`card border-0 shadow-sm h-100 ${activeTab === 'claims' && statusFilter === 'submitted' ? 'border-start border-4' : ''}`}
              style={{ cursor: 'pointer', borderRadius: '12px', borderColor: '#f59e0b' }}
              onClick={() => { setActiveTab('claims'); setStatusFilter('submitted'); }}
            >
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted small mb-1">Pending Response</p>
                    <h3 className="mb-0 fw-bold">{kpiMetrics.pendingClaims}</h3>
                    <small className="text-muted">claims awaiting</small>
                  </div>
                  <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: '48px', height: '48px', backgroundColor: '#fef3c7' }}>
                    <i className="ti ti-clock fs-4" style={{ color: '#f59e0b' }}></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-3 col-md-6">
            <div 
              className={`card border-0 shadow-sm h-100 ${activeTab === 'claims' && statusFilter === 'denied' ? 'border-start border-4 border-danger' : ''}`}
              style={{ cursor: 'pointer', borderRadius: '12px' }}
              onClick={() => { setActiveTab('claims'); setStatusFilter('denied'); }}
            >
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted small mb-1">Needs Attention</p>
                    <h3 className="mb-0 fw-bold text-danger">{kpiMetrics.needsAttention}</h3>
                    <small className="text-muted">denied/rejected</small>
                  </div>
                  <div className="rounded-circle bg-danger-subtle d-flex align-items-center justify-content-center" style={{ width: '48px', height: '48px' }}>
                    <i className="ti ti-alert-circle fs-4 text-danger"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-3 col-md-6">
            <div 
              className="card border-0 shadow-sm h-100"
              style={{ cursor: 'pointer', borderRadius: '12px' }}
              onClick={() => { setActiveTab('claims'); setStatusFilter('all'); }}
            >
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted small mb-1">Outstanding</p>
                    <h3 className="mb-0 fw-bold">${kpiMetrics.totalOutstanding.toLocaleString()}</h3>
                    <small className="text-success">
                      <i className="ti ti-trending-up me-1"></i>
                      ${kpiMetrics.paidThisMonth.toLocaleString()} collected this month
                    </small>
                  </div>
                  <div className="rounded-circle bg-success-subtle d-flex align-items-center justify-content-center" style={{ width: '48px', height: '48px' }}>
                    <i className="ti ti-currency-dollar fs-4 text-success"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Workflow Tabs */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="btn-group" role="group">
            <button
              type="button"
              className={`btn ${activeTab === "unbilled" ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => setActiveTab("unbilled")}
              style={activeTab === "unbilled" ? { backgroundColor: '#059669', borderColor: '#059669' } : {}}
            >
              <i className="ti ti-list-check me-1"></i>
              Work Queue
              {unbilledSessions.length > 0 && (
                <span className={`badge ms-2 ${activeTab === "unbilled" ? "bg-white text-primary" : "bg-secondary"}`}>{unbilledSessions.length}</span>
              )}
            </button>
            <button
              type="button"
              className={`btn ${activeTab === "claims" ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => setActiveTab("claims")}
              style={activeTab === "claims" ? { backgroundColor: '#059669', borderColor: '#059669' } : {}}
            >
              <i className="ti ti-file-text me-1"></i>
              Claims & Payments
              {submittedClaims.length > 0 && (
                <span className={`badge ms-2 ${activeTab === "claims" ? "bg-white text-primary" : "bg-secondary"}`}>{submittedClaims.length}</span>
              )}
            </button>
          </div>
          
          {activeTab === "claims" && (
            <div className="d-flex gap-2">
              <select 
                className="form-select form-select-sm rounded-pill" 
                style={{ width: "140px" }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="ready">Ready to Submit</option>
                <option value="submitted">Submitted</option>
                <option value="paid">Paid</option>
                <option value="denied">Denied</option>
              </select>
            </div>
          )}
        </div>

        {/* Work Queue Tab (formerly Unbilled Appointments) */}
        {activeTab === "unbilled" && (
          <>
            {/* Compact Filter Bar */}
            <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: '12px' }}>
              <div className="card-body py-2">
                <div className="d-flex flex-wrap gap-3 align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-3">
                    <div className="d-flex align-items-center gap-2">
                      <span className="text-muted small">Provider:</span>
                      <select 
                        className="form-select form-select-sm border-0 bg-light rounded-pill" 
                        style={{ width: "160px" }}
                        value={clinicianFilter}
                        onChange={(e) => setClinicianFilter(e.target.value)}
                      >
                        <option value="all">All Providers</option>
                        {uniqueClinicians.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span className="text-muted small">Payer:</span>
                      <select 
                        className="form-select form-select-sm border-0 bg-light rounded-pill" 
                        style={{ width: "180px" }}
                        value={payerFilter}
                        onChange={(e) => setPayerFilter(e.target.value)}
                      >
                        <option value="all">All Payers</option>
                        {COMMON_PAYERS.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span className="text-muted small">Date:</span>
                      <input 
                        type="date" 
                        className="form-control form-control-sm border-0 bg-light rounded-pill" 
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        style={{ width: "130px" }}
                      />
                      <span className="text-muted">–</span>
                      <input 
                        type="date" 
                        className="form-control form-control-sm border-0 bg-light rounded-pill" 
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        style={{ width: "130px" }}
                      />
                    </div>
                  </div>
                  
                  {/* Selection Actions */}
                  {selectedSessions.size > 0 ? (
                    <div className="d-flex align-items-center gap-2">
                      <span className="text-muted small">{selectedSessions.size} selected</span>
                      <button 
                        className="btn btn-primary btn-sm rounded-pill"
                        onClick={openCreateClaimsModal}
                      >
                        <i className="ti ti-file-plus me-1"></i>
                        Generate Claims
                      </button>
                      <button 
                        className="btn btn-outline-secondary btn-sm rounded-pill"
                        onClick={() => setSelectedSessions(new Set())}
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <button 
                      className="btn btn-outline-primary btn-sm rounded-pill"
                      onClick={toggleSelectAll}
                    >
                      <i className="ti ti-checkbox me-1"></i>
                      Select All
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Work Queue Table */}
            <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
              {unbilledSessions.length === 0 ? (
                <div className="card-body text-center py-5">
                  <div className="rounded-circle bg-success-subtle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '64px', height: '64px' }}>
                    <i className="ti ti-check fs-2 text-success"></i>
                  </div>
                  <h5>All Caught Up!</h5>
                  <p className="text-muted mb-0">No sessions waiting to be billed.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc' }}>
                        <th className="border-0 py-3 ps-3" style={{ width: "40px" }}>
                          <input 
                            type="checkbox" 
                            className="form-check-input"
                            checked={selectedSessions.size === unbilledSessions.length && unbilledSessions.length > 0}
                            onChange={toggleSelectAll}
                          />
                        </th>
                        <th className="border-0 py-3">Session</th>
                        <th className="border-0 py-3">Client</th>
                        <th className="border-0 py-3">Provider</th>
                        <th className="border-0 py-3">Payer</th>
                        <th className="border-0 py-3">Next Step</th>
                        <th className="border-0 py-3 text-end pe-3">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unbilledSessions
                        .filter(session => {
                          if (clinicianFilter !== 'all' && session.clinicianName !== clinicianFilter) return false;
                          return true;
                        })
                        .map((session) => {
                          // Determine next step based on data completeness
                          const hasPayer = !!session.payer;
                          const hasDraft = !!savedClaims[`claim_${session.appointment.id}`];
                          let nextStep = { label: 'Create Claim', color: 'primary', icon: 'file-plus' };
                          if (!hasPayer) {
                            nextStep = { label: 'Add Payer', color: 'warning', icon: 'alert-triangle' };
                          } else if (hasDraft) {
                            nextStep = { label: 'Complete Draft', color: 'info', icon: 'edit' };
                          }
                          
                          return (
                            <tr key={session.appointment.id}>
                              <td className="ps-3">
                                <input 
                                  type="checkbox" 
                                  className="form-check-input"
                                  checked={selectedSessions.has(session.appointment.id)}
                                  onChange={() => toggleSessionSelection(session.appointment.id)}
                                />
                              </td>
                              <td>
                                <div className="d-flex align-items-center gap-2">
                                  <div className="rounded bg-light p-2 d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px' }}>
                                    <i className="ti ti-calendar-event text-muted"></i>
                                  </div>
                                  <div>
                                    <div className="fw-medium small">{formatDate(session.appointment.startTime)}</div>
                                    <div className="text-muted" style={{ fontSize: '11px' }}>
                                      {session.appointment.title || '90837'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <Link 
                                  to={`/patients/${session.appointment.contactId}`}
                                  className="text-decoration-none"
                                >
                                  <span className="fw-medium text-dark">{getPatientName(session)}</span>
                                </Link>
                              </td>
                              <td>
                                <span className="text-muted">{session.clinicianName}</span>
                              </td>
                              <td>
                                {session.payer ? (
                                  <span className="badge bg-light text-dark rounded-pill">{session.payer}</span>
                                ) : (
                                  <span className="text-danger small">
                                    <i className="ti ti-alert-circle me-1"></i>Missing
                                  </span>
                                )}
                              </td>
                              <td>
                                <button 
                                  className={`btn btn-sm btn-${nextStep.color === 'warning' ? 'outline-warning' : nextStep.color === 'info' ? 'info' : 'outline-primary'} rounded-pill`}
                                  onClick={() => openClaimForm(session)}
                                  style={{ fontSize: '12px' }}
                                >
                                  <i className={`ti ti-${nextStep.icon} me-1`}></i>
                                  {nextStep.label}
                                </button>
                              </td>
                              <td className="text-end pe-3">
                                <span className="fw-semibold">${session.chargeAmount.toFixed(2)}</span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
              
              {unbilledSessions.length > 0 && (
                <div className="card-footer bg-transparent border-0 py-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="text-muted small">
                      {unbilledSessions.length} session{unbilledSessions.length !== 1 ? 's' : ''} ready to bill
                    </span>
                    <span className="fw-medium">
                      Total: ${unbilledSessions.reduce((sum, s) => sum + s.chargeAmount, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Claims & Payments Tab (Combined) */}
        {activeTab === "claims" && (
          <div className="row g-3">
            {/* Claims List */}
            <div className="col-12">
              <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                <div className="card-header bg-transparent border-0 py-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-3">
                      <h6 className="mb-0 fw-semibold">
                        {statusFilter === 'all' ? 'All Claims' : 
                         statusFilter === 'ready' ? 'Ready to Submit' :
                         statusFilter === 'submitted' ? 'Awaiting Response' :
                         statusFilter === 'paid' ? 'Paid Claims' :
                         statusFilter === 'denied' ? 'Denied/Rejected' : 'Claims'}
                      </h6>
                      <span className="badge bg-light text-dark rounded-pill">
                        {submittedClaims.filter(c => statusFilter === 'all' || c.status === statusFilter).length}
                      </span>
                    </div>
                    <div className="d-flex gap-2">
                      <input 
                        type="search" 
                        className="form-control form-control-sm rounded-pill" 
                        placeholder="Search claims..."
                        style={{ width: '200px' }}
                      />
                    </div>
                  </div>
                </div>
                
                {submittedClaims.filter(c => statusFilter === 'all' || c.status === statusFilter).length === 0 ? (
                  <div className="card-body text-center py-5">
                    <div className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '64px', height: '64px' }}>
                      <i className="ti ti-file-text fs-2 text-muted"></i>
                    </div>
                    <h5>No Claims Found</h5>
                    <p className="text-muted mb-0">
                      {statusFilter === 'all' 
                        ? 'Claims you create will appear here.' 
                        : `No claims with "${statusFilter}" status.`}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0">
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc' }}>
                            <th className="border-0 py-3 ps-3">Claim</th>
                            <th className="border-0 py-3">Client</th>
                            <th className="border-0 py-3">Service</th>
                            <th className="border-0 py-3">Payer</th>
                            <th className="border-0 py-3 text-end">Billed</th>
                            <th className="border-0 py-3">Status</th>
                            <th className="border-0 py-3 text-end pe-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {submittedClaims
                            .filter(c => statusFilter === 'all' || c.status === statusFilter)
                            .map((claim) => (
                            <tr key={claim.id}>
                              <td className="ps-3">
                                <div>
                                  <code className="small" style={{ color: '#059669' }}>
                                    {claim.patientControlNumber || claim.id.slice(0, 12)}
                                  </code>
                                  <div className="text-muted" style={{ fontSize: '11px' }}>
                                    Created {formatDate(claim.createdAt)}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <Link to={`/patients/${claim.patientId}`} className="text-decoration-none">
                                  <span className="fw-medium text-dark">
                                    {claim.patientInfo?.firstName && claim.patientInfo?.lastName 
                                      ? `${claim.patientInfo.firstName} ${claim.patientInfo.lastName}`
                                      : claim.patientInfo?.name || 'Unknown'
                                    }
                                  </span>
                                </Link>
                              </td>
                              <td>
                                <div>
                                  <span className="badge bg-light text-dark rounded-pill">{claim.cptCode}</span>
                                  <div className="text-muted" style={{ fontSize: '11px' }}>
                                    {formatDate(claim.sessionDate)}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="text-truncate d-inline-block" style={{ maxWidth: '140px' }} title={claim.payerName}>
                                  {claim.payerName}
                                </span>
                              </td>
                              <td className="text-end">
                                <span className="fw-semibold">${claim.chargeAmount?.toFixed(2) || '0.00'}</span>
                                {claim.paidAmount && claim.status === 'paid' && (
                                  <div className="text-success small">Paid: ${claim.paidAmount.toFixed(2)}</div>
                                )}
                              </td>
                              <td>
                                <div className="d-flex align-items-center gap-2">
                                  <span className={`badge rounded-pill ${
                                    claim.status === 'ready' ? 'bg-info-subtle text-info' :
                                    claim.status === 'submitted' ? 'bg-warning-subtle' :
                                    claim.status === 'accepted' ? 'bg-primary-subtle text-primary' :
                                    claim.status === 'paid' ? 'bg-success-subtle text-success' :
                                    claim.status === 'denied' || claim.status === 'rejected' ? 'bg-danger-subtle text-danger' : 
                                    'bg-secondary-subtle text-secondary'
                                  }`} style={claim.status === 'submitted' ? { color: '#b45309' } : {}}>
                                    <i className={`ti ti-${
                                      claim.status === 'ready' ? 'clock' :
                                      claim.status === 'submitted' ? 'send' :
                                      claim.status === 'paid' ? 'check' :
                                      claim.status === 'denied' ? 'x' : 'dots'
                                    } me-1`} style={{ fontSize: '10px' }}></i>
                                    {claim.status === 'ready' ? 'Ready' : 
                                     claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                                  </span>
                                  {claim.submittedAt && claim.status !== 'ready' && (
                                    <span className="text-muted" style={{ fontSize: '10px' }}>
                                      {formatDate(claim.submittedAt)}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="text-end pe-3">
                                <div className="d-flex justify-content-end gap-1">
                                  {claim.status === 'ready' && (
                                    <button 
                                      className="btn btn-sm btn-primary rounded-pill"
                                      onClick={() => updateClaimStatus(claim.id, 'submitted')}
                                      style={{ fontSize: '11px' }}
                                    >
                                      <i className="ti ti-send me-1"></i>Mark Submitted
                                    </button>
                                  )}
                                  {claim.status === 'submitted' && (
                                    <div className="btn-group btn-group-sm">
                                      <button 
                                        className="btn btn-outline-success rounded-start-pill"
                                        onClick={() => {
                                          setSelectedClaim(claim);
                                          setShowStatusModal(true);
                                        }}
                                        style={{ fontSize: '11px' }}
                                      >
                                        <i className="ti ti-check"></i> Paid
                                      </button>
                                      <button 
                                        className="btn btn-outline-danger rounded-end-pill"
                                        onClick={() => updateClaimStatus(claim.id, 'denied')}
                                        style={{ fontSize: '11px' }}
                                      >
                                        <i className="ti ti-x"></i>
                                      </button>
                                    </div>
                                  )}
                                  <button 
                                    className="btn btn-sm btn-light rounded-pill"
                                    onClick={() => reopenClaimForEdit(claim)}
                                    title="Edit"
                                    style={{ fontSize: '11px' }}
                                  >
                                    <i className="ti ti-pencil"></i>
                                  </button>
                                  <button 
                                    className="btn btn-sm btn-light rounded-pill"
                                    onClick={() => {
                                      setSelectedClaim(claim);
                                      setShowStatusModal(true);
                                    }}
                                    title="Details"
                                    style={{ fontSize: '11px' }}
                                  >
                                    <i className="ti ti-dots"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Summary Footer */}
                    <div className="card-footer bg-transparent border-top py-3">
                      <div className="row text-center">
                        <div className="col">
                          <div className="text-muted small">Total Billed</div>
                          <div className="fw-semibold">
                            ${submittedClaims.reduce((sum, c) => sum + (c.chargeAmount || 0), 0).toLocaleString()}
                          </div>
                        </div>
                        <div className="col border-start">
                          <div className="text-muted small">Collected</div>
                          <div className="fw-semibold text-success">
                            ${submittedClaims.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.paidAmount || 0), 0).toLocaleString()}
                          </div>
                        </div>
                        <div className="col border-start">
                          <div className="text-muted small">Pending</div>
                          <div className="fw-semibold" style={{ color: '#f59e0b' }}>
                            ${submittedClaims.filter(c => c.status === 'submitted').reduce((sum, c) => sum + (c.chargeAmount || 0), 0).toLocaleString()}
                          </div>
                        </div>
                        <div className="col border-start">
                          <div className="text-muted small">Denied</div>
                          <div className="fw-semibold text-danger">
                            ${submittedClaims.filter(c => c.status === 'denied' || c.status === 'rejected').reduce((sum, c) => sum + (c.chargeAmount || 0), 0).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Claim Status Update Modal */}
        {showStatusModal && selectedClaim && (
          <>
            <div className="modal-backdrop fade show"></div>
            <div className="modal fade show d-block" tabIndex={-1}>
              <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content rounded-4">
                  <div className="modal-header border-0">
                    <h5 className="modal-title fw-semibold">Update Claim Status</h5>
                    <button type="button" className="btn-close" onClick={() => { setShowStatusModal(false); setSelectedClaim(null); }}></button>
                  </div>
                  <div className="modal-body">
                    <div className="mb-3">
                      <strong>Claim:</strong> {selectedClaim.patientControlNumber || selectedClaim.id.slice(0, 12)}
                    </div>
                    <div className="mb-3">
                      <strong>Client:</strong> {selectedClaim.patientInfo?.name || 'Unknown'}
                    </div>
                    <div className="mb-3">
                      <strong>Payer:</strong> {selectedClaim.payerName}
                    </div>
                    <div className="mb-3">
                      <strong>Amount Billed:</strong> ${selectedClaim.chargeAmount?.toFixed(2)}
                    </div>
                    <hr />
                    <div className="mb-3">
                      <label className="form-label fw-medium">Status</label>
                      <select 
                        className="form-select"
                        value={selectedClaim.status}
                        onChange={(e) => setSelectedClaim({ ...selectedClaim, status: e.target.value as any })}
                      >
                        <option value="ready">Ready to Submit</option>
                        <option value="submitted">Submitted to Payer</option>
                        <option value="accepted">Accepted</option>
                        <option value="paid">Paid</option>
                        <option value="denied">Denied</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                    {(selectedClaim.status === 'paid') && (
                      <div className="mb-3">
                        <label className="form-label fw-medium">Amount Paid</label>
                        <div className="input-group">
                          <span className="input-group-text">$</span>
                          <input 
                            type="number" 
                            className="form-control"
                            placeholder={selectedClaim.chargeAmount?.toString()}
                            value={selectedClaim.paidAmount || ''}
                            onChange={(e) => setSelectedClaim({ ...selectedClaim, paidAmount: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                    )}
                    <div className="mb-3">
                      <label className="form-label fw-medium">Notes</label>
                      <textarea 
                        className="form-control"
                        rows={2}
                        placeholder="Add notes about this claim..."
                        value={selectedClaim.notes || ''}
                        onChange={(e) => setSelectedClaim({ ...selectedClaim, notes: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="modal-footer border-0">
                    <button type="button" className="btn btn-outline-secondary rounded-pill" onClick={() => { setShowStatusModal(false); setSelectedClaim(null); }}>
                      Cancel
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-primary rounded-pill"
                      onClick={() => updateClaimStatus(selectedClaim.id, selectedClaim.status, {
                        paidAmount: selectedClaim.paidAmount,
                        notes: selectedClaim.notes
                      })}
                      disabled={updatingStatus}
                    >
                      {updatingStatus ? (
                        <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</>
                      ) : (
                        <><i className="ti ti-check me-1"></i>Save Changes</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Create Claims Modal */}
        {showCreateModal && (
          <>
            <div className="modal-backdrop fade show"></div>
            <div className="modal fade show d-block" tabIndex={-1}>
              <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content rounded-4">
                  <div className="modal-header border-0">
                    <h5 className="modal-title fw-semibold">Create claims for {selectedSessions.size} client{selectedSessions.size > 1 ? 's' : ''}?</h5>
                    <button type="button" className="btn-close" onClick={() => setShowCreateModal(false)}></button>
                  </div>
                  <div className="modal-body">
                    <p>Created claims will enter the <strong>Prepared</strong> state for you to review before submitting each individually.</p>
                  </div>
                  <div className="modal-footer border-0">
                    <button type="button" className="btn btn-outline-secondary rounded-pill" onClick={() => setShowCreateModal(false)}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-primary rounded-pill" onClick={createClaims}>
                      <i className="ti ti-file-plus me-1"></i>Create claims
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Green theme styles */}
      <style>{`
        .nav-pills .nav-link.active { background-color: #059669; }
        .nav-pills .nav-link:not(.active) { color: #6b7280; }
        .nav-pills .nav-link:not(.active):hover { color: #059669; background-color: #f0fdf4; }
        .text-primary { color: #059669 !important; }
        .btn-primary { background-color: #059669; border-color: #059669; }
        .btn-primary:hover { background-color: #047857; border-color: #047857; }
        .btn-outline-primary { color: #059669; border-color: #059669; }
        .btn-outline-primary:hover { background-color: #059669; color: white; }
        .bg-primary-subtle { background-color: #d1fae5 !important; }
        .bg-success-subtle { background-color: #d1fae5 !important; }
        .text-success { color: #059669 !important; }
      `}</style>
    </div>
  );
};

export default Insurance;