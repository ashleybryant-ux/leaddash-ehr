import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import CommonFooter from '../../components/common-footer/commonFooter';
import AutoBreadcrumb from '../../components/breadcrumb/AutoBreadcrumb';
import { all_routes } from '../../routes/all_routes';
import config from '../../config';
import { logAudit } from '../../services/auditService';

const API_URL = config.apiUrl;
const LOCATION_ID = config.ghlLocationId;

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  phone?: string;
  email?: string;
}

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
}

// Note style templates
const NOTE_STYLES = [
  { 
    id: 'soap', 
    name: 'SOAP', 
    description: 'Subjective, Objective, Assessment, Plan',
    icon: 'ti-list-check'
  },
  { 
    id: 'dap', 
    name: 'DAP', 
    description: 'Data, Assessment, Plan',
    icon: 'ti-file-description'
  },
  { 
    id: 'birp', 
    name: 'BIRP', 
    description: 'Behavior, Intervention, Response, Plan',
    icon: 'ti-arrows-exchange'
  },
  { 
    id: 'girp', 
    name: 'GIRP', 
    description: 'Goals, Intervention, Response, Plan',
    icon: 'ti-target'
  },
  { 
    id: 'comprehensive', 
    name: 'Comprehensive', 
    description: 'Full clinical note with MSE',
    icon: 'ti-clipboard-check'
  },
  { 
    id: 'freeform', 
    name: 'Free-form', 
    description: 'Simple narrative note',
    icon: 'ti-edit'
  }
];

// Helper functions to get current date/time in LOCAL timezone (not UTC)
const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalTimeString = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Helper to parse ISO date string to local date components
const parseISOToLocal = (isoString: string) => {
  const dt = new Date(isoString);
  const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const time = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  return { date, time };
};

// Helper to get custom field value from patient data
// Supports both customFields array and customField object formats from GHL
const getCustomFieldValue = (patientData: any, fieldKey: string): string => {
  if (!patientData) return '';
  
  // Normalize the field key (remove contact. prefix if present)
  const normalizedKey = fieldKey.replace(/^contact\./, '');
  
  // Try customFields array first (GHL format)
  if (patientData.customFields && Array.isArray(patientData.customFields)) {
    const field = patientData.customFields.find((f: any) => {
      const fKey = (f.key || f.fieldKey || f.id || '').replace(/^contact\./, '');
      // Check exact match
      if (fKey === normalizedKey) return true;
      // Check with underscores/spaces normalized
      const fKeyNorm = fKey.toLowerCase().replace(/[_\s]/g, '');
      const searchNorm = normalizedKey.toLowerCase().replace(/[_\s]/g, '');
      return fKeyNorm === searchNorm;
    });
    if (field) {
      return field.value || field.field_value || '';
    }
  }
  
  // Try customField object (alternative format)
  if (patientData.customField && typeof patientData.customField === 'object') {
    // Try exact key
    if (patientData.customField[normalizedKey]) {
      return patientData.customField[normalizedKey];
    }
    // Try with contact. prefix
    if (patientData.customField[`contact.${normalizedKey}`]) {
      return patientData.customField[`contact.${normalizedKey}`];
    }
    // Try variations
    const variations = [
      normalizedKey,
      normalizedKey.replace(/[_\s]/g, ''),
      normalizedKey.replace(/\s/g, '_'),
      normalizedKey.toLowerCase(),
      normalizedKey.toLowerCase().replace(/[_\s]/g, ''),
      normalizedKey.toLowerCase().replace(/\s/g, '_')
    ];
    for (const variant of variations) {
      if (patientData.customField[variant]) {
        return patientData.customField[variant];
      }
    }
  }
  
  return '';
};

const AddProgressNote = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get('appointmentId');
  const noteId = searchParams.get('noteId'); // For viewing existing notes
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false); // Read-only mode for signed notes
  const [patientDiagnosis, setPatientDiagnosis] = useState('');
  const [clinician, setClinician] = useState({
    name: '',
    credentials: '',
    npi: '',
    license: ''
  });
  const [activeSection, setActiveSection] = useState('session');
  const [diagnosisSearch, setDiagnosisSearch] = useState('');
  const [showDiagnosisDropdown, setShowDiagnosisDropdown] = useState(false);
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<{code: string, description: string}[]>([]);
  const [noteStyle, setNoteStyle] = useState('soap');
  
  // Signature modal state
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [signerIP, setSignerIP] = useState('');
  const [signedAt, setSignedAt] = useState(''); // Store the actual signature timestamp
  const [noteCreatedAt, setNoteCreatedAt] = useState('');
  const [noteUpdatedAt, setNoteUpdatedAt] = useState('');

  // Common ICD-10 Mental Health Diagnosis Codes
  const diagnosisCodes = [
    { code: 'F32.0', description: 'Major depressive disorder, single episode, mild' },
    { code: 'F32.1', description: 'Major depressive disorder, single episode, moderate' },
    { code: 'F32.2', description: 'Major depressive disorder, single episode, severe without psychotic features' },
    { code: 'F32.9', description: 'Major depressive disorder, single episode, unspecified' },
    { code: 'F33.0', description: 'Major depressive disorder, recurrent, mild' },
    { code: 'F33.1', description: 'Major depressive disorder, recurrent, moderate' },
    { code: 'F33.2', description: 'Major depressive disorder, recurrent, severe without psychotic features' },
    { code: 'F33.9', description: 'Major depressive disorder, recurrent, unspecified' },
    { code: 'F41.0', description: 'Panic disorder without agoraphobia' },
    { code: 'F41.1', description: 'Generalized anxiety disorder' },
    { code: 'F41.9', description: 'Anxiety disorder, unspecified' },
    { code: 'F43.10', description: 'Post-traumatic stress disorder, unspecified' },
    { code: 'F43.11', description: 'Post-traumatic stress disorder, acute' },
    { code: 'F43.12', description: 'Post-traumatic stress disorder, chronic' },
    { code: 'F43.20', description: 'Adjustment disorder, unspecified' },
    { code: 'F43.21', description: 'Adjustment disorder with depressed mood' },
    { code: 'F43.22', description: 'Adjustment disorder with anxiety' },
    { code: 'F43.23', description: 'Adjustment disorder with mixed anxiety and depressed mood' },
    { code: 'F43.24', description: 'Adjustment disorder with disturbance of conduct' },
    { code: 'F43.25', description: 'Adjustment disorder with mixed disturbance of emotions and conduct' },
    { code: 'F40.10', description: 'Social anxiety disorder' },
    { code: 'F40.11', description: 'Social anxiety disorder, generalized' },
    { code: 'F42.2', description: 'Mixed obsessional thoughts and acts' },
    { code: 'F42.9', description: 'Obsessive-compulsive disorder, unspecified' },
    { code: 'F31.0', description: 'Bipolar disorder, current episode hypomanic' },
    { code: 'F31.10', description: 'Bipolar disorder, current episode manic without psychotic features, unspecified' },
    { code: 'F31.30', description: 'Bipolar disorder, current episode depressed, mild or moderate severity, unspecified' },
    { code: 'F31.9', description: 'Bipolar disorder, unspecified' },
    { code: 'F50.00', description: 'Anorexia nervosa, unspecified' },
    { code: 'F50.01', description: 'Anorexia nervosa, restricting type' },
    { code: 'F50.02', description: 'Anorexia nervosa, binge eating/purging type' },
    { code: 'F50.2', description: 'Bulimia nervosa' },
    { code: 'F50.81', description: 'Binge eating disorder' },
    { code: 'F50.9', description: 'Eating disorder, unspecified' },
    { code: 'F90.0', description: 'Attention-deficit hyperactivity disorder, predominantly inattentive type' },
    { code: 'F90.1', description: 'Attention-deficit hyperactivity disorder, predominantly hyperactive type' },
    { code: 'F90.2', description: 'Attention-deficit hyperactivity disorder, combined type' },
    { code: 'F90.9', description: 'Attention-deficit hyperactivity disorder, unspecified type' },
    { code: 'F60.3', description: 'Borderline personality disorder' },
    { code: 'F60.4', description: 'Histrionic personality disorder' },
    { code: 'F60.5', description: 'Obsessive-compulsive personality disorder' },
    { code: 'F60.6', description: 'Avoidant personality disorder' },
    { code: 'F60.7', description: 'Dependent personality disorder' },
    { code: 'F60.81', description: 'Narcissistic personality disorder' },
    { code: 'F60.9', description: 'Personality disorder, unspecified' },
    { code: 'F10.10', description: 'Alcohol use disorder, mild' },
    { code: 'F10.20', description: 'Alcohol use disorder, moderate' },
    { code: 'F10.21', description: 'Alcohol dependence, in remission' },
    { code: 'F12.10', description: 'Cannabis use disorder, mild' },
    { code: 'F12.20', description: 'Cannabis use disorder, moderate' },
    { code: 'F19.10', description: 'Other psychoactive substance abuse, uncomplicated' },
    { code: 'F19.20', description: 'Other psychoactive substance dependence, uncomplicated' },
    { code: 'F84.0', description: 'Autistic disorder' },
    { code: 'F34.1', description: 'Dysthymic disorder' },
    { code: 'F34.81', description: 'Disruptive mood dysregulation disorder' },
    { code: 'F45.1', description: 'Undifferentiated somatoform disorder' },
    { code: 'F44.9', description: 'Dissociative disorder, unspecified' },
    { code: 'F51.01', description: 'Primary insomnia' },
    { code: 'F51.09', description: 'Other insomnia not due to a substance or known physiological condition' },
    { code: 'Z63.0', description: 'Problems in relationship with spouse or partner' },
    { code: 'Z56.9', description: 'Unspecified problems related to employment' },
    { code: 'Z60.0', description: 'Problems of adjustment to life-cycle transitions' },
    { code: 'Z71.1', description: 'Person with feared health complaint in whom no diagnosis is made' },
    { code: 'Z71.9', description: 'Counseling, unspecified' },
  ];

  const filteredDiagnoses = diagnosisCodes.filter(d => 
    d.code.toLowerCase().includes(diagnosisSearch.toLowerCase()) ||
    d.description.toLowerCase().includes(diagnosisSearch.toLowerCase())
  );

  const addDiagnosis = (diagnosis: {code: string, description: string}) => {
    if (!selectedDiagnoses.find(d => d.code === diagnosis.code)) {
      const newDiagnoses = [...selectedDiagnoses, diagnosis];
      setSelectedDiagnoses(newDiagnoses);
      const diagnosisText = newDiagnoses.map(d => `${d.code} - ${d.description}`).join('\n');
      handleInputChange('diagnosis', diagnosisText);
    }
    setDiagnosisSearch('');
    setShowDiagnosisDropdown(false);
  };

  const removeDiagnosis = (code: string) => {
    const newDiagnoses = selectedDiagnoses.filter(d => d.code !== code);
    setSelectedDiagnoses(newDiagnoses);
    const diagnosisText = newDiagnoses.map(d => `${d.code} - ${d.description}`).join('\n');
    handleInputChange('diagnosis', diagnosisText);
  };

  // Initialize with empty strings - will be populated from appointment or draft data
  const [formData, setFormData] = useState({
    patientName: '',
    patientId: id || '',
    appointmentDate: '',
    clinicianName: '',
    clinicianCredentials: '',
    diagnosis: '',
    noteType: 'progress_note',
    noteStyle: 'soap',
    sessionDate: '',
    sessionTime: '',
    duration: '50',
    cptCode: '90834',
    sessionType: 'individual',
    
    // SOAP fields
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    
    // DAP fields
    data: '',
    dapAssessment: '',
    dapPlan: '',
    
    // BIRP fields
    behavior: '',
    intervention: '',
    response: '',
    birpPlan: '',
    
    // GIRP fields
    goals: '',
    girpIntervention: '',
    girpResponse: '',
    girpPlan: '',
    
    // Free-form
    freeformNote: '',
    
    // Comprehensive fields (existing)
    chiefComplaint: '',
    presentingProblem: '',
    appearance: [] as string[],
    behaviorMse: [] as string[],
    speech: [] as string[],
    mood: '',
    affect: [] as string[],
    thoughtProcess: [] as string[],
    thoughtContent: [] as string[],
    orientation: [] as string[],
    memory: [] as string[],
    insight: '',
    judgment: '',
    suicidalIdeation: 'Denied',
    homicidalIdeation: 'Denied',
    selfHarmBehavior: 'Denied',
    safetyPlan: '',
    interventions: '',
    treatmentGoals: '',
    progress: '',
    clinicalImpression: '',
    prognosis: 'Good',
    nextSession: '',
    homework: '',
    recommendations: '',
    treatmentPlanText: '',
    estimatedDuration: '6 months',
    chartNoteContent: '',
    
    // Risk assessment (shared)
    riskAssessment: 'low'
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Variable to track patient name across different blocks
        let fetchedPatientName = '';
        
        // Get logged-in user as fallback for clinician info
        const userStr = localStorage.getItem('user');
        let fallbackClinicianName = '';
        let fallbackClinicianCredentials = 'LCSW';
        if (userStr) {
          const user = JSON.parse(userStr);
          fallbackClinicianName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
          fallbackClinicianCredentials = user.credentials || 'LCSW';
        }

        if (id) {
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          const locationId = user.locationId || LOCATION_ID;
          
          const patientResponse = await axios.get(`${API_URL}/api/patients/${id}?locationId=${locationId}`);
          const patientData = patientResponse.data.patient;
          setPatient(patientData);
          const fullName = `${patientData.firstName || ''} ${patientData.lastName || ''}`.trim();
          fetchedPatientName = fullName; // Store for use in noteId block
          
          // Get rendering provider from GHL custom field
          // The GHL field key is "referring_provider_name" (displayed as "Rendering Provider Name")
          const renderingProvider = getCustomFieldValue(patientData, 'referring_provider_name');
          const providerLicense = getCustomFieldValue(patientData, 'provider_license');
          
          console.log('📋 Patient customFields:', patientData.customFields);
          console.log('👤 Rendering Provider from GHL:', renderingProvider);
          console.log('📜 Provider License from GHL:', providerLicense);
          
          // Use rendering provider if available, otherwise fall back to logged-in user
          const clinicianName = renderingProvider || fallbackClinicianName;
          const clinicianCredentials = fallbackClinicianCredentials;
          
          setClinician({
            name: clinicianName,
            credentials: clinicianCredentials,
            npi: '',
            license: providerLicense
          });
          
          // Fetch user's IP address for signature
          try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();
            setSignerIP(ipData.ip);
          } catch (ipError) {
            console.log('Could not fetch IP address');
            setSignerIP('Unknown');
          }
          
          // Set initial timestamps
          const now = new Date().toISOString();
          setNoteCreatedAt(now);
          setNoteUpdatedAt(now);
          
          // Get diagnosis from custom fields
          let diagnosisText = '';
          if (patientData.customFields && Array.isArray(patientData.customFields)) {
            const diagnosisField = patientData.customFields.find(
              (f: any) => f.key === 'diagnosis' || f.id === 'diagnosis' || f.fieldKey === 'diagnosis'
            );
            if (diagnosisField) {
              diagnosisText = diagnosisField.value || diagnosisField.field_value || '';
            }
          }
          if (!diagnosisText && patientData.customField) {
            diagnosisText = patientData.customField.diagnosis || '';
          }
          if (!diagnosisText && patientData.diagnosis) {
            diagnosisText = patientData.diagnosis;
          }
          if (!diagnosisText) {
            const storedDiagnosis = localStorage.getItem(`diagnosis_${id}`);
            if (storedDiagnosis) {
              diagnosisText = storedDiagnosis;
            }
          }

          setPatientDiagnosis(diagnosisText);
          
          if (diagnosisText) {
            const parsedDiagnoses = diagnosisText.split('\n').map(line => {
              const parts = line.split(' - ');
              if (parts.length >= 2) {
                return { code: parts[0].trim(), description: parts.slice(1).join(' - ').trim() };
              }
              return null;
            }).filter(d => d !== null) as {code: string, description: string}[];
            setSelectedDiagnoses(parsedDiagnoses);
          }

          setFormData(prev => ({
            ...prev,
            patientName: fullName,
            patientId: id,
            diagnosis: diagnosisText,
            clinicianName: clinicianName,
            clinicianCredentials: clinicianCredentials
          }));
        }

        // Store appointment date/time to use for notes opened from appointments
        let appointmentDateFromApi = '';
        let appointmentTimeFromApi = '';
        let appointmentDuration = '50';
        let hasAppointment = false;

        if (appointmentId) {
          hasAppointment = true;
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          const locationId = user.locationId || LOCATION_ID;
          
          const appointmentResponse = await axios.get(`${API_URL}/api/appointments/${appointmentId}?locationId=${locationId}`);
          const appointmentData = appointmentResponse.data.appointment;
          setAppointment(appointmentData);
          const startTime = new Date(appointmentData.startTime);
          // Use local date/time extraction
          const year = startTime.getFullYear();
          const month = String(startTime.getMonth() + 1).padStart(2, '0');
          const day = String(startTime.getDate()).padStart(2, '0');
          appointmentDateFromApi = `${year}-${month}-${day}`;
          const hours = String(startTime.getHours()).padStart(2, '0');
          const minutes = String(startTime.getMinutes()).padStart(2, '0');
          appointmentTimeFromApi = `${hours}:${minutes}`;
          const endTime = new Date(appointmentData.endTime);
          const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
          appointmentDuration = durationMinutes.toString();

          // Set appointment date/time as initial values
          setFormData(prev => ({
            ...prev,
            appointmentDate: appointmentDateFromApi,
            sessionDate: appointmentDateFromApi,
            sessionTime: appointmentTimeFromApi,
            duration: appointmentDuration
          }));
        }

        // If noteId is provided, load the existing note (for viewing signed notes)
        if (noteId) {
          try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const locationId = user.locationId || LOCATION_ID;
            const noteResponse = await axios.get(`${API_URL}/api/patients/${id}/notes/${noteId}?locationId=${locationId}`);
            const noteData = noteResponse.data.note;
            
            if (noteData) {
              // Load note style
              if (noteData.noteStyle) {
                setNoteStyle(noteData.noteStyle);
              }
              
              // Load timestamps
              if (noteData.createdAt) setNoteCreatedAt(noteData.createdAt);
              if (noteData.updatedAt) setNoteUpdatedAt(noteData.updatedAt);
              
              // Load signature data
              if (noteData.signedAt) setSignedAt(noteData.signedAt);
              if (noteData.signedBy) setSignatureName(noteData.signedBy);
              if (noteData.signerIP) setSignerIP(noteData.signerIP);
              
              // If note is signed, set read-only mode
              if (noteData.status === 'signed') {
                setIsReadOnly(true);
              }
              
              // Audit: Log viewing any note (draft or signed)
              const noteStatusLabel = noteData.status === 'signed' ? 'signed' : 'draft';
              logAudit({
                action: 'VIEW',
                resourceType: 'progress_note',
                resourceId: noteId,
                patientId: id || '',
                patientName: fetchedPatientName,
                description: `Viewed ${noteStatusLabel} progress note for ${fetchedPatientName}`,
                metadata: {
                  noteType: noteData.noteType,
                  noteStyle: noteData.noteStyle,
                  noteStatus: noteData.status,
                  sessionDate: noteData.dateOfService || noteData.sessionDate
                }
              });
              
              // Load diagnoses
              if (noteData.diagnosis) {
                const parsedDiagnoses = noteData.diagnosis.split('\n').map((line: string) => {
                  const parts = line.split(' - ');
                  if (parts.length >= 2) {
                    return { code: parts[0].trim(), description: parts.slice(1).join(' - ').trim() };
                  }
                  return null;
                }).filter((d: any) => d !== null);
                setSelectedDiagnoses(parsedDiagnoses);
              }
              
              // Load clinician info from note
              if (noteData.providerLicense) {
                setClinician(prev => ({ ...prev, license: noteData.providerLicense }));
              }
              
              // Load form data
              setFormData(prev => ({
                ...prev,
                noteType: noteData.noteType || 'progress_note',
                sessionType: noteData.sessionType || 'individual',
                sessionDate: noteData.dateOfService || noteData.sessionDate?.split('T')[0] || prev.sessionDate,
                sessionTime: noteData.timeOfService || prev.sessionTime,
                duration: noteData.duration || '53',
                cptCode: noteData.cptCode || noteData.billingCode || '90837',
                diagnosis: noteData.diagnosis || '',
                clinicianName: noteData.clinicianName || prev.clinicianName,
                clinicianCredentials: noteData.clinicianCredentials || prev.clinicianCredentials,
                // Load SOAP/DAP/BIRP fields based on note style
                subjective: noteData.subjective || '',
                objective: noteData.objective || '',
                assessment: noteData.assessment || '',
                plan: noteData.plan || '',
                data: noteData.data || '',
                intervention: noteData.intervention || '',
                response: noteData.response || '',
                behavior: noteData.behavior || '',
                // Risk assessment
                suicidalIdeation: noteData.suicidalIdeation || 'Denied',
                homicidalIdeation: noteData.homicidalIdeation || 'Denied',
                selfHarmBehavior: noteData.selfHarmBehavior || 'Denied',
                // Treatment
                treatmentGoals: noteData.treatmentGoals || '',
                treatmentPlanText: noteData.treatmentPlanText || ''
              }));
              
              setLoading(false);
              return; // Skip draft loading since we loaded an existing note
            }
          } catch (noteError) {
            console.log('Could not load note:', noteError);
          }
        }

        const navState = location.state as { draftData?: any; newNote?: boolean } | null;
        if (navState?.newNote) {
          // Creating new note - use appointment date/time if available, otherwise use current date/time
          if (!appointmentDateFromApi) {
            setFormData(prev => ({
              ...prev,
              sessionDate: prev.sessionDate || getLocalDateString(),
              sessionTime: prev.sessionTime || getLocalTimeString()
            }));
          }
        } else if (navState?.draftData) {
          // Editing draft passed via navigation state
          setIsEditingDraft(true);
          // If opening from appointment, use appointment time; otherwise use draft's saved time
          loadDraftData(navState.draftData, appointmentDateFromApi, appointmentTimeFromApi, hasAppointment);
          
          // Audit: Log viewing/editing a draft note
          logAudit({
            action: 'VIEW',
            resourceType: 'progress_note',
            resourceId: navState.draftData.id || `draft_${id}`,
            patientId: id || '',
            patientName: fetchedPatientName,
            description: `Opened draft progress note for editing for ${fetchedPatientName}`,
            metadata: {
              noteType: navState.draftData.noteType || 'progress_note',
              noteStyle: navState.draftData.noteStyle,
              noteStatus: 'draft',
              sessionDate: navState.draftData.dateOfService || navState.draftData.sessionDate
            }
          });
        } else {
          // Check for existing draft in database
          try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const locationId = user.locationId || LOCATION_ID;
            const draftResponse = await axios.get(`${API_URL}/api/patients/${id}/draft?locationId=${locationId}`);
            if (draftResponse.data.draft) {
              setIsEditingDraft(true);
              // If opening from appointment, use appointment time; otherwise use draft's saved time
              loadDraftData(draftResponse.data.draft, appointmentDateFromApi, appointmentTimeFromApi, hasAppointment);
              
              // Audit: Log viewing/editing a draft note from database
              logAudit({
                action: 'VIEW',
                resourceType: 'progress_note',
                resourceId: draftResponse.data.draft.id || `draft_${id}`,
                patientId: id || '',
                patientName: fetchedPatientName,
                description: `Opened draft progress note for editing for ${fetchedPatientName}`,
                metadata: {
                  noteType: draftResponse.data.draft.noteType || 'progress_note',
                  noteStyle: draftResponse.data.draft.noteStyle,
                  noteStatus: 'draft',
                  sessionDate: draftResponse.data.draft.dateOfService || draftResponse.data.draft.sessionDate
                }
              });
            } else if (!appointmentDateFromApi) {
              // No draft and no appointment - use current date/time
              setFormData(prev => ({
                ...prev,
                sessionDate: prev.sessionDate || getLocalDateString(),
                sessionTime: prev.sessionTime || getLocalTimeString()
              }));
            }
          } catch (draftError: any) {
            console.log('No existing draft found');
            // No draft found - if no appointment either, use current date/time
            if (!appointmentDateFromApi) {
              setFormData(prev => ({
                ...prev,
                sessionDate: prev.sessionDate || getLocalDateString(),
                sessionTime: prev.sessionTime || getLocalTimeString()
              }));
            }
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, appointmentId, noteId, location.state]);

  const loadDraftData = (draftData: any, appointmentDate?: string, appointmentTime?: string, useAppointmentDateTime: boolean = false) => {
    if (draftData.noteStyle) {
      setNoteStyle(draftData.noteStyle);
    }
    
    // Load timestamps from draft
    if (draftData.createdAt) {
      setNoteCreatedAt(draftData.createdAt);
    }
    if (draftData.updatedAt) {
      setNoteUpdatedAt(draftData.updatedAt);
    }
    
    let sessionDate = '';
    let sessionTime = '';
    
    // If we're opening from an appointment, ALWAYS use the appointment's date/time
    // This ensures clicking on "APPOINTMENT #2 - Dec 4 1:30 PM" uses Dec 4 1:30 PM
    if (useAppointmentDateTime && appointmentDate && appointmentTime) {
      sessionDate = appointmentDate;
      sessionTime = appointmentTime;
    } else {
      // Not from appointment - use the draft's saved date/time
      // PRIORITY ORDER for date/time:
      // 1. dateOfService/timeOfService (clean YYYY-MM-DD and HH:MM format we explicitly save)
      // 2. Parse from sessionDate if it's ISO format
      // 3. Parse from startTime if available
      
      // Try dateOfService/timeOfService first (these are saved in clean format)
      if (draftData.dateOfService) {
        sessionDate = draftData.dateOfService;
      }
      if (draftData.timeOfService) {
        sessionTime = draftData.timeOfService;
      }
      
      // If not found, try to parse from sessionDate (might be ISO format)
      if (!sessionDate && draftData.sessionDate) {
        if (draftData.sessionDate.includes('T')) {
          const parsed = parseISOToLocal(draftData.sessionDate);
          sessionDate = parsed.date;
          if (!sessionTime) {
            sessionTime = parsed.time;
          }
        } else {
          sessionDate = draftData.sessionDate;
        }
      }
      
      // If still not found, try startTime
      if (!sessionDate && draftData.startTime) {
        const parsed = parseISOToLocal(draftData.startTime);
        sessionDate = parsed.date;
        if (!sessionTime) {
          sessionTime = parsed.time;
        }
      }
    }
    
    setFormData(prev => ({
      ...prev,
      noteStyle: draftData.noteStyle || prev.noteStyle,
      sessionDate: sessionDate || prev.sessionDate,
      sessionTime: sessionTime || prev.sessionTime,
      duration: draftData.duration || prev.duration,
      cptCode: draftData.cptCode || prev.cptCode,
      sessionType: draftData.sessionType || prev.sessionType,
      // SOAP
      subjective: draftData.subjective || '',
      objective: draftData.objective || '',
      assessment: draftData.assessment || '',
      plan: draftData.plan || '',
      // DAP
      data: draftData.data || '',
      dapAssessment: draftData.dapAssessment || '',
      dapPlan: draftData.dapPlan || '',
      // BIRP
      behavior: draftData.behavior || '',
      intervention: draftData.intervention || '',
      response: draftData.response || '',
      birpPlan: draftData.birpPlan || '',
      // GIRP
      goals: draftData.goals || '',
      girpIntervention: draftData.girpIntervention || '',
      girpResponse: draftData.girpResponse || '',
      girpPlan: draftData.girpPlan || '',
      // Free-form
      freeformNote: draftData.freeformNote || '',
      // Comprehensive
      chiefComplaint: draftData.chiefComplaint || '',
      presentingProblem: draftData.presentingProblem || '',
      appearance: draftData.appearance || [],
      behaviorMse: draftData.behaviorMse || draftData.behavior || [],
      speech: draftData.speech || [],
      mood: draftData.mood || '',
      affect: draftData.affect || [],
      thoughtProcess: draftData.thoughtProcess || [],
      thoughtContent: draftData.thoughtContent || [],
      orientation: draftData.orientation || [],
      memory: draftData.memory || [],
      insight: draftData.insight || '',
      judgment: draftData.judgment || '',
      suicidalIdeation: draftData.suicidalIdeation || 'Denied',
      homicidalIdeation: draftData.homicidalIdeation || 'Denied',
      selfHarmBehavior: draftData.selfHarmBehavior || 'Denied',
      safetyPlan: draftData.safetyPlan || '',
      interventions: draftData.interventions || '',
      treatmentGoals: draftData.treatmentGoals || '',
      progress: draftData.progress || '',
      clinicalImpression: draftData.clinicalImpression || '',
      prognosis: draftData.prognosis || 'Good',
      nextSession: draftData.nextSession || '',
      homework: draftData.homework || '',
      recommendations: draftData.recommendations || '',
      riskAssessment: draftData.riskAssessment || 'low',
      patientName: prev.patientName,
      patientId: prev.patientId,
      diagnosis: draftData.diagnosis || prev.diagnosis,
      // Keep clinician from patient's rendering provider (already set), don't override from draft
      clinicianName: prev.clinicianName,
      clinicianCredentials: prev.clinicianCredentials
    }));
  };

  const handleInputChange = (field: string, value: string | string[]) => {
    if (isReadOnly) return; // Don't allow changes when viewing signed notes
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (field: string, value: string) => {
    if (isReadOnly) return; // Don't allow changes when viewing signed notes
    const currentValues = formData[field as keyof typeof formData] as string[];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    handleInputChange(field, newValues);
  };

  const handleNoteStyleChange = (style: string) => {
    if (isReadOnly) return; // Don't allow changes when viewing signed notes
    setNoteStyle(style);
    setFormData(prev => ({ ...prev, noteStyle: style }));
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const locationId = user.locationId || LOCATION_ID;
      
      const diagnosisText = selectedDiagnoses.map(d => `${d.code} - ${d.description}`).join('\n');
      
      // Calculate startTime and endTime for proper display in overview
      const startDateTime = new Date(`${formData.sessionDate}T${formData.sessionTime}:00`);
      const endDateTime = new Date(startDateTime.getTime() + parseInt(formData.duration) * 60000);
      
      const now = new Date().toISOString();
      const createdTime = noteCreatedAt || now;
      
      // Update the timestamps
      setNoteUpdatedAt(now);
      if (!noteCreatedAt) {
        setNoteCreatedAt(now);
      }
      
      const draftData = {
        ...formData,
        patientId: id,
        contactId: id,
        locationId: locationId,
        noteType: formData.noteType,
        noteStyle: noteStyle,
        diagnosis: diagnosisText,
        status: 'draft',
        // Time fields for overview display (matching appointment format)
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        sessionDate: startDateTime.toISOString(),
        // IMPORTANT: Save clean date/time formats for proper retrieval when editing
        dateOfService: formData.sessionDate,
        timeOfService: formData.sessionTime,
        // Billing code for overview display
        billingCode: formData.cptCode,
        cptCode: formData.cptCode,
        duration: formData.duration,
        providerLicense: clinician.license,
        createdAt: createdTime,
        updatedAt: now
      };

      // Save to the draft endpoint
      await axios.post(`${API_URL}/api/patients/${id}/draft?locationId=${locationId}`, draftData);
      
      // Also save to notes endpoint so it appears in patient timeline/overview
      await axios.post(`${API_URL}/api/patients/${id}/notes?locationId=${locationId}`, draftData);
      
      // Audit: Log saving draft
      logAudit({
        action: 'UPDATE',
        resourceType: 'progress_note',
        resourceId: `draft_${id}_${formData.sessionDate}`,
        patientId: id || '',
        patientName: formData.patientName,
        description: `Saved progress note draft for ${formData.patientName}`,
        metadata: {
          noteType: formData.noteType,
          noteStyle: noteStyle,
          noteStatus: 'draft',
          sessionDate: formData.sessionDate,
          cptCode: formData.cptCode
        }
      });
      
      alert('Progress note saved as draft!');
      navigate(`/patients/${id}`);
    } catch (error: any) {
      alert(`Failed to save draft: ${error.response?.data?.error || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const validateForm = () => {
    if (formData.noteType === 'progress_note') {
      switch (noteStyle) {
        case 'soap':
          if (!formData.subjective || !formData.objective || !formData.assessment || !formData.plan) {
            alert('Please fill in all SOAP fields (Subjective, Objective, Assessment, Plan).');
            return false;
          }
          break;
        case 'dap':
          if (!formData.data || !formData.dapAssessment || !formData.dapPlan) {
            alert('Please fill in all DAP fields (Data, Assessment, Plan).');
            return false;
          }
          break;
        case 'birp':
          if (!formData.behavior || !formData.intervention || !formData.response || !formData.birpPlan) {
            alert('Please fill in all BIRP fields (Behavior, Intervention, Response, Plan).');
            return false;
          }
          break;
        case 'girp':
          if (!formData.goals || !formData.girpIntervention || !formData.girpResponse || !formData.girpPlan) {
            alert('Please fill in all GIRP fields (Goals, Intervention, Response, Plan).');
            return false;
          }
          break;
        case 'comprehensive':
          if (!formData.chiefComplaint || !formData.presentingProblem || !formData.interventions || !formData.clinicalImpression) {
            alert('Please fill in all required fields before signing the note.');
            return false;
          }
          break;
        case 'freeform':
          if (!formData.freeformNote) {
            alert('Please enter the note content.');
            return false;
          }
          break;
      }
    } else if (formData.noteType === 'diagnosis_treatment') {
      if (selectedDiagnoses.length === 0) {
        alert('Please select at least one diagnosis.');
        return false;
      }
    } else if (formData.noteType === 'chart_note') {
      if (!formData.chartNoteContent) {
        alert('Please enter the chart note content.');
        return false;
      }
    }
    return true;
  };

  const buildNoteContent = () => {
    switch (noteStyle) {
      case 'soap':
        return `SUBJECTIVE:\n${formData.subjective}\n\nOBJECTIVE:\n${formData.objective}\n\nASSESSMENT:\n${formData.assessment}\n\nPLAN:\n${formData.plan}`;
      case 'dap':
        return `DATA:\n${formData.data}\n\nASSESSMENT:\n${formData.dapAssessment}\n\nPLAN:\n${formData.dapPlan}`;
      case 'birp':
        return `BEHAVIOR:\n${formData.behavior}\n\nINTERVENTION:\n${formData.intervention}\n\nRESPONSE:\n${formData.response}\n\nPLAN:\n${formData.birpPlan}`;
      case 'girp':
        return `GOALS:\n${formData.goals}\n\nINTERVENTION:\n${formData.girpIntervention}\n\nRESPONSE:\n${formData.girpResponse}\n\nPLAN:\n${formData.girpPlan}`;
      case 'freeform':
        return formData.freeformNote;
      case 'comprehensive':
        return formData.clinicalImpression;
      default:
        return '';
    }
  };

  // Show signature modal before signing
  const handleSignAndLockClick = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    // Pre-populate signature name with clinician name
    if (!signatureName && formData.clinicianName) {
      setSignatureName(formData.clinicianName);
    }
    
    // Show signature modal
    setShowSignatureModal(true);
  };

  // Actually sign and lock the note after signature confirmation
  const handleConfirmSignature = async () => {
    if (!signatureName.trim()) {
      alert('Please enter your full name to sign the note.');
      return;
    }

    setShowSignatureModal(false);
    setSaving(true);
    
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const locationId = user.locationId || LOCATION_ID;
      const diagnosisText = selectedDiagnoses.map(d => `${d.code} - ${d.description}`).join('\n');
      
      if (formData.noteType === 'diagnosis_treatment' && diagnosisText) {
        localStorage.setItem(`diagnosis_${id}`, diagnosisText);
      }

      const noteContent = buildNoteContent();
      
      // Calculate startTime and endTime for proper display in overview
      const startDateTime = new Date(`${formData.sessionDate}T${formData.sessionTime}:00`);
      const endDateTime = new Date(startDateTime.getTime() + parseInt(formData.duration) * 60000);
      
      const now = new Date().toISOString();
      
      // Store the signature timestamp in state for View/Print
      setSignedAt(now);

      const noteData = {
        ...formData,
        patientId: id,
        contactId: id,
        locationId: locationId,
        noteType: formData.noteType,
        noteStyle: noteStyle,
        diagnosis: diagnosisText,
        content: noteContent,
        summary: noteContent.substring(0, 200),
        treatmentGoals: formData.noteType === 'diagnosis_treatment' ? formData.treatmentPlanText : formData.treatmentGoals,
        status: 'signed',
        // Time fields for overview display (matching appointment format)
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        sessionDate: startDateTime.toISOString(),
        // IMPORTANT: Save clean date/time formats for proper retrieval when editing
        dateOfService: formData.sessionDate,
        timeOfService: formData.sessionTime,
        // Billing code for overview display
        billingCode: formData.cptCode,
        cptCode: formData.cptCode,
        duration: formData.duration,
        // Clinician information
        clinicianName: formData.clinicianName,
        clinicianCredentials: formData.clinicianCredentials,
        providerLicense: clinician.license,
        // Signature information
        signedBy: signatureName.trim(),
        signedAt: now,
        signerIP: signerIP,
        // Timestamps
        createdAt: noteCreatedAt || now,
        updatedAt: now
      };

      // Save to notes endpoint
      const response = await axios.post(`${API_URL}/api/patients/${id}/notes?locationId=${locationId}`, noteData);

      // Delete draft if exists
      try {
        await axios.delete(`${API_URL}/api/patients/${id}/draft?locationId=${locationId}`);
      } catch (draftError) {
        console.log('No draft to delete');
      }

      // Audit: Log signing the note
      logAudit({
        action: 'SIGN',
        resourceType: 'progress_note',
        resourceId: response.data?.note?.id || `note_${id}_${formData.sessionDate}`,
        patientId: id || '',
        patientName: formData.patientName,
        description: `Signed and locked progress note for ${formData.patientName}`,
        metadata: {
          noteType: formData.noteType,
          noteStyle: noteStyle,
          noteStatus: 'signed',
          sessionDate: formData.sessionDate,
          cptCode: formData.cptCode,
          signedBy: signatureName.trim(),
          signerIP: signerIP
        }
      });

      const noteTypeLabels: { [key: string]: string } = {
        'progress_note': 'Progress note',
        'diagnosis_treatment': 'Diagnosis & Treatment Plan',
        'chart_note': 'Chart note'
      };
      
      alert(`${noteTypeLabels[formData.noteType] || 'Note'} signed and saved successfully!`);
      navigate(`/patients/${id}`);
    } catch (error: any) {
      alert(`Failed to save note: ${error.response?.data?.error || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSignAndLock = async (e: React.FormEvent) => {
    e.preventDefault();
    handleSignAndLockClick(e);
  };

  const sections = [
    { id: 'session', label: 'Session Info', icon: 'ti-calendar' },
    { id: 'diagnosis', label: 'Diagnosis', icon: 'ti-stethoscope' },
    { id: 'presenting', label: 'Presenting Problem', icon: 'ti-message-circle' },
    { id: 'mse', label: 'Mental Status Exam', icon: 'ti-brain' },
    { id: 'risk', label: 'Risk Assessment', icon: 'ti-alert-triangle' },
    { id: 'clinical', label: 'Clinical Notes', icon: 'ti-notes' },
    { id: 'plan', label: 'Plan', icon: 'ti-calendar-check' }
  ];

  // Generate printable/downloadable note HTML matching Legacy Family Services format
  const generateNoteHTML = (isSigned: boolean = false, signedByName?: string, signedAtTime?: string) => {
    const noteContent = buildNoteContent();
    const diagnosisText = selectedDiagnoses.map(d => `${d.code} - ${d.description}`).join('\n');
    
    // Use provided signature info, stored state, or fallback to current time
    const finalSignatureName = signedByName || signatureName || formData.clinicianName;
    // IMPORTANT: Only use actual signedAt timestamp, don't fallback to current time
    const finalSignedAt = signedAtTime || signedAt || '';
    const noteIsSigned = !!finalSignedAt;
    
    // Format date for display
    const formatDisplayDate = (dateStr: string) => {
      if (!dateStr) return 'N/A';
      const date = new Date(dateStr + 'T12:00:00');
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    };
    
    // Format time for display (convert 24hr to 12hr)
    const formatDisplayTime = (timeStr: string) => {
      if (!timeStr) return '';
      const [hours, minutes] = timeStr.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'pm' : 'am';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    };
    
    // Calculate end time
    const calculateEndTime = (startTime: string, durationMin: string) => {
      if (!startTime) return '';
      const [hours, minutes] = startTime.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + parseInt(durationMin);
      const endHours = Math.floor(totalMinutes / 60) % 24;
      const endMinutes = totalMinutes % 60;
      const ampm = endHours >= 12 ? 'pm' : 'am';
      const hour12 = endHours % 12 || 12;
      return `${hour12}:${endMinutes.toString().padStart(2, '0')} ${ampm}`;
    };
    
    // Format timestamp for footer
    const formatTimestamp = (isoStr: string) => {
      if (!isoStr) return 'N/A';
      const date = new Date(isoStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + 
             ' at ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) + ' CT';
    };
    
    // Format signature date/time
    const formatSignatureDateTime = (isoStr: string): { date: string; time: string } => {
      if (!isoStr) {
        return { date: 'N/A', time: '' };
      }
      const date = new Date(isoStr);
      return {
        date: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) + ' CT'
      };
    };
    
    const sessionDateFormatted = formatDisplayDate(formData.sessionDate);
    const startTimeFormatted = formatDisplayTime(formData.sessionTime);
    const endTimeFormatted = calculateEndTime(formData.sessionTime, formData.duration);
    const createdFormatted = formatTimestamp(noteCreatedAt);
    const updatedFormatted = formatTimestamp(noteUpdatedAt);
    const signatureDateTime = formatSignatureDateTime(finalSignedAt);
    
    // Get CPT code description
    const cptDescriptions: {[key: string]: string} = {
      // Diagnostic Evaluation
      '90791': 'Intake and Assessment',
      '90792': 'Psychiatric Diagnostic Eval w/ Medical Services',
      // Individual Psychotherapy
      '90832': 'Psychotherapy, 16-37 min',
      '90834': 'Psychotherapy, 38-52 min',
      '90837': 'Psychotherapy, 53+ min',
      // Crisis Psychotherapy
      '90839': 'Psychotherapy for Crisis, first 60 min',
      '90840': 'Psychotherapy for Crisis, +30 min add-on',
      // Family/Couples Therapy
      '90846': 'Family Psychotherapy w/o Patient, 50 min',
      '90847': 'Family Psychotherapy w/ Patient, 50 min',
      '90849': 'Multiple Family Group Psychotherapy',
      // Group Therapy
      '90853': 'Group Psychotherapy',
      // Psychotherapy Add-Ons
      '90833': 'Psychotherapy, 16-37 min add-on',
      '90836': 'Psychotherapy, 38-52 min add-on',
      '90838': 'Psychotherapy, 53+ min add-on',
      '90785': 'Interactive Complexity add-on',
      // Psychological Testing
      '96130': 'Psychological Testing Evaluation, first hour',
      '96131': 'Psychological Testing Evaluation, +hour',
      '96136': 'Psychological Test Administration, first 30 min',
      '96137': 'Psychological Test Administration, +30 min',
      '96138': 'Psych Test Technician Administration, first 30 min',
      '96139': 'Psych Test Technician Administration, +30 min',
      // Other Services
      '90882': 'Environmental Intervention',
      '90887': 'Interpretation or Explanation of Results',
      '99354': 'Prolonged Service, first hour',
      '99355': 'Prolonged Service, +30 min'
    };
    const cptDescription = cptDescriptions[formData.cptCode] || formData.cptCode;
    
    // Get patient DOB from patient state
    const patientDob = patient?.dateOfBirth 
      ? new Date(patient.dateOfBirth).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
      : 'N/A';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Progress Note - ${formData.patientName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; max-width: 850px; margin: 0 auto; line-height: 1.6; color: #333; font-size: 14px; }
            
            .header { display: flex; justify-content: space-between; margin-bottom: 24px; }
            .header-left { flex: 1; }
            .header-right { text-align: right; }
            .header-row { margin-bottom: 4px; }
            .header-label { font-weight: 600; display: inline-block; width: 120px; }
            .header-value { display: inline; }
            
            .logo-placeholder { 
              width: 180px; 
              height: 60px; 
              display: flex; 
              align-items: center; 
              justify-content: flex-end;
              color: #666;
              font-style: italic;
            }
            
            .details-section { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 24px; 
              padding-bottom: 16px;
              border-bottom: 1px solid #ddd;
            }
            .details-left { flex: 1; }
            .details-right { flex: 1; padding-left: 40px; }
            
            .section-label { font-weight: 600; margin-bottom: 4px; }
            .detail-line { margin-bottom: 2px; color: #555; }
            .detail-indent { margin-left: 20px; }
            
            .diagnosis-item { margin-bottom: 4px; }
            
            .note-title { 
              text-align: center; 
              font-size: 20px; 
              font-weight: 600; 
              margin: 24px 0 16px 0;
            }
            
            .note-content { 
              text-align: justify; 
              line-height: 1.7;
              margin-bottom: 40px;
            }
            
            .risk-section {
              margin-top: 20px;
              padding: 12px;
              background: #fef3c7;
              border-radius: 6px;
            }
            .risk-title {
              font-weight: 600;
              color: #b45309;
              margin-bottom: 4px;
            }
            
            .signature-block {
              margin-top: 60px;
              padding-top: 24px;
              border-top: 2px solid #333;
            }
            .signature-container {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .signature-left {
              flex: 1;
            }
            .signature-line {
              border-bottom: 1px solid #333;
              width: 320px;
              padding-bottom: 8px;
              margin-bottom: 8px;
            }
            .signature-name {
              font-family: 'Brush Script MT', 'Segoe Script', cursive;
              font-size: 28px;
              color: #1a365d;
            }
            .signature-credentials {
              font-weight: 600;
              font-size: 14px;
              margin-top: 4px;
            }
            .signature-license {
              color: #666;
              font-size: 12px;
              margin-top: 2px;
            }
            .signature-right {
              text-align: right;
              font-size: 12px;
              color: #666;
            }
            .signature-label {
              font-weight: 600;
              color: #333;
              margin-bottom: 4px;
            }
            .signature-ip {
              margin-top: 8px;
              font-size: 10px;
              color: #999;
            }
            
            .footer { 
              border-top: 1px solid #f97316;
              padding-top: 12px;
              font-size: 12px;
              color: #666;
              margin-top: 40px;
            }
            
            @media print { 
              body { padding: 20px; }
              .print-header { display: none !important; }
            }
            
            .print-header {
              background: #f8f9fa;
              padding: 12px 20px;
              margin: -40px -40px 30px -40px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 1px solid #e0e0e0;
            }
            .print-title { color: #9ca3af; font-size: 14px; }
            .print-btn { 
              background: #3b82f6; 
              color: white; 
              border: none; 
              padding: 8px 16px; 
              border-radius: 6px; 
              cursor: pointer; 
              font-size: 13px; 
              font-weight: 500; 
            }
            .print-btn:hover { background: #2563eb; }
          </style>
        </head>
        <body>
          <div class="print-header">
            <span class="print-title">Progress Note Preview${isSigned ? ' (Signed)' : ''}</span>
            <button class="print-btn" onclick="window.print()">Print</button>
          </div>
          
          <div class="header">
            <div class="header-left">
              <div class="header-row"><span class="header-label">Client:</span><span class="header-value">${formData.patientName}</span></div>
              <div class="header-row"><span class="header-label">DOB:</span><span class="header-value">${patientDob}</span></div>
              <div class="header-row"><span class="header-label">Provider:</span><span class="header-value">${formData.clinicianName}</span></div>
              ${clinician.license ? `<div class="header-row"><span class="header-label">License:</span><span class="header-value">${clinician.license}</span></div>` : ''}
            </div>
            <div class="header-right">
              <div class="logo-placeholder">
                <!-- Logo placeholder -->
              </div>
            </div>
          </div>
          
          <div class="details-section">
            <div class="details-left">
              <div class="section-label">Appointment:</div>
              <div class="detail-line">${formData.sessionType.charAt(0).toUpperCase() + formData.sessionType.slice(1)} appointment on ${sessionDateFormatted}</div>
              <div class="detail-line detail-indent">${startTimeFormatted} - ${endTimeFormatted} CT, ${formData.duration} min</div>
              <div class="detail-line detail-indent">Billing code: ${formData.cptCode} - ${cptDescription}</div>
            </div>
            <div class="details-right">
              ${diagnosisText ? `
              <div class="section-label">Diagnosis:</div>
              ${selectedDiagnoses.map(d => `<div class="diagnosis-item">${d.code} - ${d.description}</div>`).join('')}
              ` : ''}
            </div>
          </div>
          
          <h2 class="note-title">Progress Note</h2>
          
          <div class="note-content">
            ${noteContent.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>').replace(/^/, '<p>').replace(/$/, '</p>').replace(/(SUBJECTIVE:|OBJECTIVE:|ASSESSMENT:|PLAN:|DATA:|BEHAVIOR:|INTERVENTION:|RESPONSE:|GOALS:)/g, '<strong>$1</strong>')}
          </div>
          
          ${formData.suicidalIdeation !== 'Denied' || formData.homicidalIdeation !== 'Denied' || formData.selfHarmBehavior !== 'Denied' ? `
          <div class="risk-section">
            <div class="risk-title">Risk Assessment:</div>
            <div>Suicidal Ideation: ${formData.suicidalIdeation} | Homicidal Ideation: ${formData.homicidalIdeation} | Self-Harm: ${formData.selfHarmBehavior}</div>
          </div>
          ` : ''}
          
          <!-- CLINICIAN SIGNATURE BLOCK -->
          <div class="signature-block">
            <div class="signature-container">
              <div class="signature-left">
                <div class="signature-line">
                  <span class="signature-name">${finalSignatureName}</span>
                </div>
                <div class="signature-credentials">${formData.clinicianName}</div>
                ${clinician.license ? `<div class="signature-license">License: ${clinician.license}</div>` : ''}
              </div>
              <div class="signature-right">
                ${noteIsSigned ? `
                  <div class="signature-label">Electronically Signed</div>
                  <div>${signatureDateTime.date}</div>
                  <div>${signatureDateTime.time}</div>
                  ${signerIP ? `<div class="signature-ip">IP: ${signerIP}</div>` : ''}
                ` : `
                  <div class="signature-label" style="color: #999;">Not Yet Signed</div>
                `}
              </div>
            </div>
          </div>
          
          <div class="footer">
            <div style="margin-bottom: 4px;">Created on ${createdFormatted}. Last updated on ${updatedFormatted}.</div>
            <div style="text-align: right;">Page 1 of 1</div>
          </div>
        </body>
      </html>
    `;
  };

  // View note in new window - WITH AUDIT LOGGING
  const handleView = () => {
    // Audit: Log viewing/printing note
    logAudit({
      action: 'VIEW',
      resourceType: 'progress_note',
      resourceId: noteId || `note_${id}_${formData.sessionDate}`,
      patientId: id || '',
      patientName: formData.patientName,
      description: `Viewed/printed progress note for ${formData.patientName}`,
      metadata: {
        noteType: formData.noteType,
        noteStyle: noteStyle,
        noteStatus: isReadOnly ? 'signed' : 'draft',
        sessionDate: formData.sessionDate,
        action: 'view_print'
      }
    });
    
    const content = generateNoteHTML(false);
    const viewWindow = window.open('', '_blank');
    if (!viewWindow) {
      alert('Please allow popups to view the note');
      return;
    }
    viewWindow.document.write(content);
    viewWindow.document.close();
  };

  // Download as PDF using jsPDF - WITH AUDIT LOGGING
  const handleDownloadPDF = async () => {
    // Audit: Log downloading PDF
    logAudit({
      action: 'DOWNLOAD',
      resourceType: 'progress_note',
      resourceId: noteId || `note_${id}_${formData.sessionDate}`,
      patientId: id || '',
      patientName: formData.patientName,
      description: `Downloaded PDF of progress note for ${formData.patientName}`,
      metadata: {
        noteType: formData.noteType,
        noteStyle: noteStyle,
        noteStatus: isReadOnly ? 'signed' : 'draft',
        sessionDate: formData.sessionDate,
        action: 'download_pdf'
      }
    });
    
    // Create a container div for PDF content
    const container = document.createElement('div');
    container.id = 'pdf-render-container';
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '8.5in';
    container.style.backgroundColor = 'white';
    container.style.padding = '0.5in';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.fontSize = '12px';
    container.style.lineHeight = '1.5';
    container.style.color = '#333';
    
    // Build PDF content directly (not using generateNoteHTML to avoid extra HTML structure)
    const noteContent = buildNoteContent();
    const diagnosisText = selectedDiagnoses.map(d => `${d.code} - ${d.description}`).join('\n');
    
    // Format dates
    const formatDate = (dateStr: string) => {
      if (!dateStr) return 'N/A';
      const date = new Date(dateStr + 'T12:00:00');
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    };
    
    const formatTime = (timeStr: string) => {
      if (!timeStr) return '';
      const [hours, minutes] = timeStr.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'pm' : 'am';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    };
    
    const calculateEndTime = (startTime: string, durationMin: string) => {
      if (!startTime) return '';
      const [hours, minutes] = startTime.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + parseInt(durationMin);
      const endHours = Math.floor(totalMinutes / 60) % 24;
      const endMinutes = totalMinutes % 60;
      const ampm = endHours >= 12 ? 'pm' : 'am';
      const hour12 = endHours % 12 || 12;
      return `${hour12}:${endMinutes.toString().padStart(2, '0')} ${ampm}`;
    };
    
    const cptDescriptions: {[key: string]: string} = {
      '90791': 'Intake and Assessment',
      '90792': 'Psychiatric Diagnostic Eval w/ Medical Services',
      '90832': 'Psychotherapy, 16-37 min',
      '90834': 'Psychotherapy, 38-52 min',
      '90837': 'Psychotherapy, 53+ min',
      '90839': 'Psychotherapy for Crisis, first 60 min',
      '90840': 'Psychotherapy for Crisis, +30 min add-on',
      '90846': 'Family Psychotherapy w/o Patient, 50 min',
      '90847': 'Family Psychotherapy w/ Patient, 50 min',
      '90849': 'Multiple Family Group Psychotherapy',
      '90853': 'Group Psychotherapy'
    };
    
    const sessionDateFormatted = formatDate(formData.sessionDate);
    const startTimeFormatted = formatTime(formData.sessionTime);
    const endTimeFormatted = calculateEndTime(formData.sessionTime, formData.duration);
    const cptDescription = cptDescriptions[formData.cptCode] || formData.cptCode;
    const patientDob = patient?.dateOfBirth 
      ? new Date(patient.dateOfBirth).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
      : 'N/A';
    
    // Signature info - only use actual signed time, not current time
    const finalSignatureName = signatureName || formData.clinicianName;
    const isSigned = !!signedAt; // Only true if note has been signed
    const signedDateStr = isSigned 
      ? new Date(signedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : '';
    const signedTimeStr = isSigned
      ? new Date(signedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) + ' CT'
      : '';
    
    // Timestamps
    const formatTimestamp = (isoStr: string) => {
      if (!isoStr) return 'N/A';
      const date = new Date(isoStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + 
             ' at ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) + ' CT';
    };
    const createdFormatted = formatTimestamp(noteCreatedAt);
    const updatedFormatted = formatTimestamp(noteUpdatedAt);

    container.innerHTML = `
      <div style="margin-bottom: 20px;">
        <div style="margin-bottom: 4px;"><strong style="display: inline-block; width: 80px;">Client:</strong> ${formData.patientName}</div>
        <div style="margin-bottom: 4px;"><strong style="display: inline-block; width: 80px;">DOB:</strong> ${patientDob}</div>
        <div style="margin-bottom: 4px;"><strong style="display: inline-block; width: 80px;">Provider:</strong> ${formData.clinicianName}</div>
        ${clinician.license ? `<div style="margin-bottom: 4px;"><strong style="display: inline-block; width: 80px;">License:</strong> ${clinician.license}</div>` : ''}
      </div>
      
      <div style="display: flex; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #ccc;">
        <div style="flex: 1;">
          <div style="font-weight: bold; margin-bottom: 4px;">Appointment:</div>
          <div style="color: #555;">${formData.sessionType.charAt(0).toUpperCase() + formData.sessionType.slice(1)} on ${sessionDateFormatted}</div>
          <div style="color: #555; margin-left: 15px;">${startTimeFormatted} - ${endTimeFormatted} CT, ${formData.duration} min</div>
          <div style="color: #555; margin-left: 15px;">Billing: ${formData.cptCode} - ${cptDescription}</div>
        </div>
        <div style="flex: 1; padding-left: 30px;">
          ${selectedDiagnoses.length > 0 ? `
            <div style="font-weight: bold; margin-bottom: 4px;">Diagnosis:</div>
            ${selectedDiagnoses.map(d => `<div style="color: #555;">${d.code} - ${d.description}</div>`).join('')}
          ` : ''}
        </div>
      </div>
      
      <h2 style="text-align: center; font-size: 16px; font-weight: bold; margin: 15px 0;">Progress Note</h2>
      
      <div style="text-align: justify; line-height: 1.6; margin-bottom: 25px;">
        ${noteContent.split('\n\n').map(p => `<p style="margin-bottom: 10px;">${p.replace(/\n/g, '<br>').replace(/(SUBJECTIVE:|OBJECTIVE:|ASSESSMENT:|PLAN:|DATA:|BEHAVIOR:|INTERVENTION:|RESPONSE:|GOALS:)/g, '<strong>$1</strong>')}</p>`).join('')}
      </div>
      
      ${formData.suicidalIdeation !== 'Denied' || formData.homicidalIdeation !== 'Denied' || formData.selfHarmBehavior !== 'Denied' ? `
        <div style="margin: 15px 0; padding: 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">
          <div style="font-weight: bold; color: #856404; margin-bottom: 4px;">Risk Assessment:</div>
          <div>Suicidal Ideation: ${formData.suicidalIdeation} | Homicidal Ideation: ${formData.homicidalIdeation} | Self-Harm: ${formData.selfHarmBehavior}</div>
        </div>
      ` : ''}
      
      <div style="margin-top: 40px; padding-top: 15px; border-top: 2px solid #333;">
        <div style="display: flex; justify-content: space-between;">
          <div>
            <div style="border-bottom: 1px solid #333; width: 250px; padding-bottom: 5px; margin-bottom: 5px;">
              <span style="font-family: 'Brush Script MT', cursive; font-size: 22px; color: #1a365d;">${finalSignatureName}</span>
            </div>
            <div style="font-weight: bold;">${formData.clinicianName}</div>
            ${clinician.license ? `<div style="color: #666; font-size: 10px;">License: ${clinician.license}</div>` : ''}
          </div>
          <div style="text-align: right; font-size: 11px; color: #666;">
            ${isSigned ? `
              <div style="font-weight: bold; color: #333;">Electronically Signed</div>
              <div>${signedDateStr}</div>
              <div>${signedTimeStr}</div>
              ${signerIP ? `<div style="margin-top: 4px; font-size: 9px; color: #999;">IP: ${signerIP}</div>` : ''}
            ` : `
              <div style="font-weight: bold; color: #999;">Not Yet Signed</div>
            `}
          </div>
        </div>
      </div>
      
      <div style="margin-top: 30px; padding-top: 10px; border-top: 1px solid #f97316; font-size: 10px; color: #666;">
        <div style="margin-bottom: 4px;">Created on ${createdFormatted}. Last updated on ${updatedFormatted}.</div>
        <div style="text-align: right;">Page 1 of 1</div>
      </div>
    `;
    
    document.body.appendChild(container);

    // Wait for fonts to load
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      // Load html2canvas if not loaded
      if (!(window as any).html2canvas) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load html2canvas'));
          document.head.appendChild(script);
        });
      }

      // Load jsPDF if not loaded
      if (!(window as any).jspdf) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load jsPDF'));
          document.head.appendChild(script);
        });
      }

      // Capture the container
      const canvas = await (window as any).html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: container.scrollWidth,
        height: container.scrollHeight
      });

      // Create PDF
      const { jsPDF } = (window as any).jspdf;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'letter'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Calculate image dimensions to fit page with margins
      const margin = 36; // 0.5 inch margins
      const maxWidth = pageWidth - (margin * 2);
      const maxHeight = pageHeight - (margin * 2);
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // Scale to fit width
      const scale = maxWidth / imgWidth;
      const finalWidth = imgWidth * scale;
      const finalHeight = imgHeight * scale;

      // Add image to PDF
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', margin, margin, finalWidth, finalHeight);
      
      // Save PDF
      const filename = `Progress_Note_${formData.patientName.replace(/\s+/g, '_')}_${formData.sessionDate}.pdf`;
      pdf.save(filename);

    } catch (error) {
      console.error('PDF generation error:', error);
      alert('PDF download failed. Please use View button and then File > Print > Save as PDF');
    } finally {
      document.body.removeChild(container);
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
          </div>
        </div>
      </div>
    );
  }

  // Render diagnosis picker component
  const renderDiagnosisPicker = () => (
    <div className="card mb-3 border-primary">
      <div className="card-header py-2 bg-primary bg-opacity-10">
        <h6 className="card-title text-primary mb-0"><i className="ti ti-stethoscope me-2" />Diagnosis</h6>
      </div>
      <div className="card-body py-3">
        {selectedDiagnoses.length > 0 && (
          <div className="mb-3">
            <label className="form-label small mb-2">Selected Diagnoses:</label>
            <div className="d-flex flex-wrap gap-2">
              {selectedDiagnoses.map((d, idx) => (
                <div key={idx} className="badge bg-primary d-flex align-items-center gap-2 py-2 px-3" style={{ fontSize: '0.875rem' }}>
                  <span><strong>{d.code}</strong> - {d.description}</span>
                  <button type="button" className="btn-close btn-close-white" style={{ fontSize: '0.6rem' }} onClick={() => removeDiagnosis(d.code)}></button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="position-relative">
          <label className="form-label small mb-1">{selectedDiagnoses.length > 0 ? 'Add Another Diagnosis' : 'Search & Add Diagnosis'}</label>
          <div className="input-group">
            <span className="input-group-text"><i className="ti ti-search"></i></span>
            <input type="text" className="form-control" disabled={isReadOnly} placeholder="Search by ICD-10 code or description..." value={diagnosisSearch} onChange={(e) => { setDiagnosisSearch(e.target.value); setShowDiagnosisDropdown(true); }} onFocus={() => setShowDiagnosisDropdown(true)} />
          </div>
          {showDiagnosisDropdown && diagnosisSearch && (
            <div className="position-absolute w-100 bg-white border rounded shadow-sm mt-1" style={{ maxHeight: '250px', overflowY: 'auto', zIndex: 1000 }}>
              {filteredDiagnoses.length === 0 ? <div className="p-3 text-muted">No matching diagnoses found</div> : filteredDiagnoses.slice(0, 10).map((d, idx) => (
                <div key={idx} className={`p-2 ${selectedDiagnoses.find(sd => sd.code === d.code) ? 'bg-light' : ''}`} style={{ cursor: 'pointer' }} onClick={() => addDiagnosis(d)} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedDiagnoses.find(sd => sd.code === d.code) ? '#f8f9fa' : ''}>
                  <span className="badge bg-secondary me-2">{d.code}</span><span>{d.description}</span>
                  {selectedDiagnoses.find(sd => sd.code === d.code) && <i className="ti ti-check text-success ms-2"></i>}
                </div>
              ))}
            </div>
          )}
        </div>
        {showDiagnosisDropdown && <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 999 }} onClick={() => setShowDiagnosisDropdown(false)}></div>}
      </div>
    </div>
  );

  // Render risk assessment component
  const renderRiskAssessment = () => (
    <div className="card mb-3 border-warning">
      <div className="card-header py-2 bg-warning bg-opacity-10">
        <h6 className="card-title text-warning mb-0"><i className="ti ti-alert-triangle me-2" />Risk Assessment</h6>
      </div>
      <div className="card-body py-3">
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label small mb-1">Suicidal Ideation</label>
            <select disabled={isReadOnly} className="form-select form-select-sm" value={formData.suicidalIdeation} onChange={(e) => handleInputChange('suicidalIdeation', e.target.value)}>
              <option value="Denied">Denied</option>
              <option value="Passive">Passive (no plan)</option>
              <option value="Active">Active (with plan)</option>
              <option value="Intent">Intent</option>
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label small mb-1">Homicidal Ideation</label>
            <select disabled={isReadOnly} className="form-select form-select-sm" value={formData.homicidalIdeation} onChange={(e) => handleInputChange('homicidalIdeation', e.target.value)}>
              <option value="Denied">Denied</option>
              <option value="Passive">Passive (no plan)</option>
              <option value="Active">Active (with plan)</option>
              <option value="Intent">Intent</option>
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label small mb-1">Self-Harm</label>
            <select disabled={isReadOnly} className="form-select form-select-sm" value={formData.selfHarmBehavior} onChange={(e) => handleInputChange('selfHarmBehavior', e.target.value)}>
              <option value="Denied">Denied</option>
              <option value="Past history">Past history</option>
              <option value="Recent">Recent (past month)</option>
              <option value="Current">Current</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <AutoBreadcrumb title={isReadOnly ? "View Progress Note (Signed)" : isEditingDraft ? "Edit Progress Note (Draft)" : "Add Progress Note"} />

          {isEditingDraft && (
            <div className="alert alert-warning mb-3 py-2">
              <i className="ti ti-edit me-2" />
              Editing draft - changes saved when you click Save.
            </div>
          )}

          <form onSubmit={handleSignAndLock}>
            <div className="row">
              {/* Read-Only Banner for Signed Notes */}
              {isReadOnly && (
                <div className="col-12 mb-3">
                  <div className="alert alert-success d-flex align-items-center" role="alert">
                    <i className="ti ti-lock me-2 fs-4"></i>
                    <div>
                      <strong>This note is signed and locked.</strong>
                      <span className="ms-2">
                        Signed by {signatureName} on {new Date(signedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at {new Date(signedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} CT
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Note Type Selector */}
              <div className="col-12 mb-3">
                <div className="card">
                  <div className="card-body py-2">
                    <div className="d-flex align-items-center gap-2">
                      <span className="text-muted small me-2">Note Type:</span>
                      <div className="btn-group" role="group">
                        <input type="radio" className="btn-check" name="noteType" id="noteType-progress" value="progress_note" checked={formData.noteType === 'progress_note'} onChange={(e) => handleInputChange('noteType', e.target.value)} disabled={isReadOnly} />
                        <label className={`btn btn-outline-primary btn-sm ${isReadOnly ? 'disabled' : ''}`} htmlFor="noteType-progress"><i className="ti ti-notes me-1"></i>Progress Note</label>

                        <input type="radio" className="btn-check" name="noteType" id="noteType-diagnosis" value="diagnosis_treatment" checked={formData.noteType === 'diagnosis_treatment'} onChange={(e) => handleInputChange('noteType', e.target.value)} disabled={isReadOnly} />
                        <label className={`btn btn-outline-primary btn-sm ${isReadOnly ? 'disabled' : ''}`} htmlFor="noteType-diagnosis"><i className="ti ti-stethoscope me-1"></i>Diagnosis & Treatment Plan</label>

                        <input type="radio" className="btn-check" name="noteType" id="noteType-chart" value="chart_note" checked={formData.noteType === 'chart_note'} onChange={(e) => handleInputChange('noteType', e.target.value)} disabled={isReadOnly} />
                        <label className={`btn btn-outline-primary btn-sm ${isReadOnly ? 'disabled' : ''}`} htmlFor="noteType-chart"><i className="ti ti-file-text me-1"></i>Chart Note</label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Note Style Selector - Only for Progress Notes */}
              {formData.noteType === 'progress_note' && (
                <div className="col-12 mb-3">
                  <div className="card">
                    <div className="card-header py-2">
                      <h6 className="card-title mb-0"><i className="ti ti-template me-2"></i>Note Style</h6>
                    </div>
                    <div className="card-body py-3">
                      <div className="row g-2">
                        {NOTE_STYLES.map((style) => (
                          <div key={style.id} className="col-md-4 col-lg-2">
                            <div 
                              className={`card h-100 cursor-pointer border-2 ${noteStyle === style.id ? 'border-primary bg-primary bg-opacity-10' : 'border-light'}`}
                              onClick={() => handleNoteStyleChange(style.id)}
                              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                            >
                              <div className="card-body py-2 px-3 text-center">
                                <i className={`ti ${style.icon} fs-4 ${noteStyle === style.id ? 'text-primary' : 'text-muted'}`}></i>
                                <h6 className={`mb-0 mt-1 ${noteStyle === style.id ? 'text-primary' : ''}`}>{style.name}</h6>
                                <small className="text-muted" style={{ fontSize: '0.7rem' }}>{style.description}</small>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Left Sidebar Navigation - Only for Comprehensive Progress Notes */}
              {formData.noteType === 'progress_note' && noteStyle === 'comprehensive' && (
                <div className="col-lg-2 d-none d-lg-block">
                  <div className="card sticky-top" style={{ top: '80px' }}>
                    <div className="card-body p-2">
                      <nav className="nav flex-column">
                        {sections.map(section => (
                          <a key={section.id} href={`#${section.id}`} className={`nav-link py-2 px-2 ${activeSection === section.id ? 'active bg-primary text-white rounded' : 'text-secondary'}`} onClick={(e) => { e.preventDefault(); setActiveSection(section.id); document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} style={{ fontSize: '0.8rem' }}>
                            <i className={`ti ${section.icon} me-1`}></i>{section.label}
                          </a>
                        ))}
                      </nav>
                    </div>
                  </div>
                </div>
              )}

              {/* Main Content */}
              <div className={formData.noteType === 'progress_note' && noteStyle === 'comprehensive' ? 'col-lg-10' : 'col-lg-12'}>
                
                {/* Session Header - WITH EDITABLE DATE AND TIME */}
                <div className="card mb-3">
                  <div className="card-header py-3 bg-light">
                    <div className="row align-items-center g-3">
                      <div className="col-md-3">
                        <small className="text-muted d-block">Client</small>
                        <Link to={`/patients/${id}`} className="text-primary text-decoration-none" style={{ fontSize: '18px', fontWeight: '600' }}>{formData.patientName}</Link>
                      </div>
                      <div className="col-md-3">
                        <label className="text-muted small d-block mb-1">Date of Service</label>
                        <input 
                          type="date" 
                          className="form-control" 
                          value={formData.sessionDate} 
                          onChange={(e) => handleInputChange('sessionDate', e.target.value)} 
                          disabled={isReadOnly}
                          required 
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="text-muted small d-block mb-1">Time of Service</label>
                        <input 
                          type="time" 
                          className="form-control" 
                          value={formData.sessionTime} 
                          onChange={(e) => handleInputChange('sessionTime', e.target.value)} 
                          disabled={isReadOnly}
                          required 
                        />
                      </div>
                      <div className="col-md-3">
                        <small className="text-muted d-block">Provider</small>
                        <strong>{formData.clinicianName}</strong>
                        {clinician.license && <div className="text-muted" style={{ fontSize: '11px' }}>License: {clinician.license}</div>}
                      </div>
                    </div>
                  </div>
                  {/* Row below header - Duration, CPT Code, Session Type ONLY (no date/time) */}
                  <div className="card-body py-3">
                    <div className="row g-2">
                      <div className="col-md-3">
                        <label className="form-label small mb-1">Duration</label>
                        <select disabled={isReadOnly} className="form-select form-select-sm" value={formData.duration} onChange={(e) => handleInputChange('duration', e.target.value)} required>
                          <option value="30">30 min</option>
                          <option value="45">45 min</option>
                          <option value="50">50 min</option>
                          <option value="60">60 min</option>
                          <option value="90">90 min</option>
                        </select>
                      </div>
                      <div className="col-md-5">
                        <label className="form-label small mb-1">CPT Code</label>
                        <select disabled={isReadOnly} className="form-select form-select-sm" value={formData.cptCode} onChange={(e) => handleInputChange('cptCode', e.target.value)} required>
                          <optgroup label="Diagnostic Evaluation">
                            <option value="90791">90791 - Intake and Assessment</option>
                            <option value="90792">90792 - Psych Diagnostic Eval w/ Medical</option>
                          </optgroup>
                          <optgroup label="Individual Psychotherapy">
                            <option value="90832">90832 - Psychotherapy 16-37 min</option>
                            <option value="90834">90834 - Psychotherapy 38-52 min</option>
                            <option value="90837">90837 - Psychotherapy 53+ min</option>
                          </optgroup>
                          <optgroup label="Crisis Psychotherapy">
                            <option value="90839">90839 - Crisis Psychotherapy, first 60 min</option>
                            <option value="90840">90840 - Crisis Psychotherapy, +30 min add-on</option>
                          </optgroup>
                          <optgroup label="Family/Couples Therapy">
                            <option value="90846">90846 - Family Therapy w/o Patient, 50 min</option>
                            <option value="90847">90847 - Family Therapy w/ Patient, 50 min</option>
                            <option value="90849">90849 - Multiple Family Group Therapy</option>
                          </optgroup>
                          <optgroup label="Group Therapy">
                            <option value="90853">90853 - Group Psychotherapy</option>
                          </optgroup>
                          <optgroup label="Psychotherapy Add-Ons (with E/M)">
                            <option value="90833">90833 - Psychotherapy 16-37 min add-on</option>
                            <option value="90836">90836 - Psychotherapy 38-52 min add-on</option>
                            <option value="90838">90838 - Psychotherapy 53+ min add-on</option>
                            <option value="90785">90785 - Interactive Complexity add-on</option>
                          </optgroup>
                          <optgroup label="Psychological Testing">
                            <option value="96130">96130 - Psych Testing Evaluation, first hour</option>
                            <option value="96131">96131 - Psych Testing Evaluation, +hour</option>
                            <option value="96136">96136 - Psych Test Admin, first 30 min</option>
                            <option value="96137">96137 - Psych Test Admin, +30 min</option>
                            <option value="96138">96138 - Psych Test Tech Admin, first 30 min</option>
                            <option value="96139">96139 - Psych Test Tech Admin, +30 min</option>
                          </optgroup>
                          <optgroup label="Other Services">
                            <option value="90882">90882 - Environmental Intervention</option>
                            <option value="90887">90887 - Interpretation/Explanation</option>
                            <option value="99354">99354 - Prolonged Service, first hour</option>
                            <option value="99355">99355 - Prolonged Service, +30 min</option>
                          </optgroup>
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small mb-1">Session Type</label>
                        <select disabled={isReadOnly} className="form-select form-select-sm" value={formData.sessionType} onChange={(e) => handleInputChange('sessionType', e.target.value)}>
                          <option value="individual">Individual</option>
                          <option value="family">Family</option>
                          <option value="group">Group</option>
                          <option value="telehealth">Telehealth</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CHART NOTE FORM */}
                {formData.noteType === 'chart_note' && (
                  <div className="card mb-3">
                    <div className="card-body">
                      <label className="form-label small mb-1">Chart Note</label>
                      <textarea className="form-control" readOnly={isReadOnly} rows={6} placeholder="Enter chart note..." value={formData.chartNoteContent} onChange={(e) => handleInputChange('chartNoteContent', e.target.value)} required />
                    </div>
                  </div>
                )}

                {/* DIAGNOSIS & TREATMENT PLAN FORM */}
                {formData.noteType === 'diagnosis_treatment' && (
                  <>
                    <div className="card mb-3 border-primary">
                      <div className="card-header py-2 bg-primary bg-opacity-10">
                        <h6 className="card-title text-primary mb-0"><i className="ti ti-stethoscope me-2"></i>Diagnosis</h6>
                      </div>
                      <div className="card-body">
                        {selectedDiagnoses.length > 0 && (
                          <div className="mb-3">
                            <label className="form-label small mb-2">Selected Diagnoses:</label>
                            <div className="d-flex flex-wrap gap-2">
                              {selectedDiagnoses.map((d, idx) => (
                                <div key={idx} className="badge bg-primary d-flex align-items-center gap-2 py-2 px-3" style={{ fontSize: '0.875rem' }}>
                                  <span><strong>{d.code}</strong> - {d.description}</span>
                                  <button type="button" className="btn-close btn-close-white" style={{ fontSize: '0.6rem' }} onClick={() => removeDiagnosis(d.code)}></button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="position-relative">
                          <label className="form-label fw-semibold">{selectedDiagnoses.length > 0 ? 'Add Another Diagnosis' : 'Search & Add Diagnosis *'}</label>
                          <div className="input-group">
                            <span className="input-group-text"><i className="ti ti-search"></i></span>
                            <input type="text" className="form-control" disabled={isReadOnly} placeholder="Search by ICD-10 code or description..." value={diagnosisSearch} onChange={(e) => { setDiagnosisSearch(e.target.value); setShowDiagnosisDropdown(true); }} onFocus={() => setShowDiagnosisDropdown(true)} />
                          </div>
                          {showDiagnosisDropdown && diagnosisSearch && (
                            <div className="position-absolute w-100 bg-white border rounded shadow-sm mt-1" style={{ maxHeight: '250px', overflowY: 'auto', zIndex: 1000 }}>
                              {filteredDiagnoses.length === 0 ? (
                                <div className="p-3 text-muted">No matching diagnoses found</div>
                              ) : (
                                filteredDiagnoses.slice(0, 10).map((d, idx) => (
                                  <div key={idx} className={`p-2 ${selectedDiagnoses.find(sd => sd.code === d.code) ? 'bg-light' : ''}`} style={{ cursor: 'pointer' }} onClick={() => addDiagnosis(d)} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedDiagnoses.find(sd => sd.code === d.code) ? '#f8f9fa' : ''}>
                                    <span className="badge bg-secondary me-2">{d.code}</span><span>{d.description}</span>
                                    {selectedDiagnoses.find(sd => sd.code === d.code) && <i className="ti ti-check text-success ms-2"></i>}
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                        {showDiagnosisDropdown && <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 999 }} onClick={() => setShowDiagnosisDropdown(false)}></div>}
                      </div>
                    </div>

                    <div className="card mb-3 border-success">
                      <div className="card-header py-2 bg-success bg-opacity-10">
                        <h6 className="card-title text-success mb-0"><i className="ti ti-list-check me-2"></i>Treatment Plan</h6>
                      </div>
                      <div className="card-body">
                        <div className="mb-3">
                          <label className="form-label fw-semibold">Treatment Goals & Interventions</label>
                          <textarea className="form-control" readOnly={isReadOnly} rows={6} placeholder="Enter treatment goals, objectives, and planned interventions..." value={formData.treatmentPlanText} onChange={(e) => handleInputChange('treatmentPlanText', e.target.value)} />
                        </div>
                        <div className="row g-3">
                          <div className="col-md-4">
                            <label className="form-label small">Estimated Duration</label>
                            <select disabled={isReadOnly} className="form-select" value={formData.estimatedDuration} onChange={(e) => handleInputChange('estimatedDuration', e.target.value)}>
                              <option value="3 months">3 months</option>
                              <option value="6 months">6 months</option>
                              <option value="12 months">12 months</option>
                              <option value="Ongoing">Ongoing</option>
                            </select>
                          </div>
                          <div className="col-md-4">
                            <label className="form-label small">Session Frequency</label>
                            <select disabled={isReadOnly} className="form-select" value={formData.sessionType} onChange={(e) => handleInputChange('sessionType', e.target.value)}>
                              <option value="weekly">Weekly</option>
                              <option value="biweekly">Bi-weekly</option>
                              <option value="monthly">Monthly</option>
                              <option value="as needed">As needed</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* PROGRESS NOTE FORMS BY STYLE */}
                {formData.noteType === 'progress_note' && (
                  <>
                    {/* Diagnosis Picker - Shared for all progress note styles */}
                    {renderDiagnosisPicker()}

                    {/* SOAP Note */}
                    {noteStyle === 'soap' && (
                      <>
                        <div className="card mb-3">
                          <div className="card-header py-2 bg-info bg-opacity-10">
                            <h6 className="card-title text-info mb-0"><i className="ti ti-user me-2"></i>S - Subjective</h6>
                          </div>
                          <div className="card-body">
                            <textarea className="form-control" readOnly={isReadOnly} rows={4} placeholder="What the client reports: symptoms, feelings, concerns, history, and any changes since last session. Include direct quotes when relevant." value={formData.subjective} onChange={(e) => handleInputChange('subjective', e.target.value)} required />
                          </div>
                        </div>

                        <div className="card mb-3">
                          <div className="card-header py-2 bg-success bg-opacity-10">
                            <h6 className="card-title text-success mb-0"><i className="ti ti-eye me-2"></i>O - Objective</h6>
                          </div>
                          <div className="card-body">
                            <textarea className="form-control" readOnly={isReadOnly} rows={4} placeholder="Observable data: appearance, behavior, mood, affect, speech, thought process, mental status observations, and any measurable data (PHQ-9, GAD-7 scores, etc.)." value={formData.objective} onChange={(e) => handleInputChange('objective', e.target.value)} required />
                          </div>
                        </div>

                        <div className="card mb-3">
                          <div className="card-header py-2 bg-warning bg-opacity-10">
                            <h6 className="card-title text-warning mb-0"><i className="ti ti-brain me-2"></i>A - Assessment</h6>
                          </div>
                          <div className="card-body">
                            <textarea className="form-control" readOnly={isReadOnly} rows={4} placeholder="Clinical interpretation: progress toward goals, therapeutic insights, changes in symptoms, risk assessment, clinical impressions, and prognosis." value={formData.assessment} onChange={(e) => handleInputChange('assessment', e.target.value)} required />
                          </div>
                        </div>

                        <div className="card mb-3">
                          <div className="card-header py-2 bg-primary bg-opacity-10">
                            <h6 className="card-title text-primary mb-0"><i className="ti ti-list-check me-2"></i>P - Plan</h6>
                          </div>
                          <div className="card-body">
                            <textarea className="form-control" readOnly={isReadOnly} rows={4} placeholder="Next steps: treatment modifications, interventions for next session, homework assignments, referrals, and scheduling (frequency, next appointment)." value={formData.plan} onChange={(e) => handleInputChange('plan', e.target.value)} required />
                          </div>
                        </div>

                        {renderRiskAssessment()}
                      </>
                    )}

                    {/* DAP Note */}
                    {noteStyle === 'dap' && (
                      <>
                        <div className="card mb-3">
                          <div className="card-header py-2 bg-info bg-opacity-10">
                            <h6 className="card-title text-info mb-0"><i className="ti ti-database me-2"></i>D - Data</h6>
                          </div>
                          <div className="card-body">
                            <textarea className="form-control" readOnly={isReadOnly} rows={5} placeholder="All information gathered during the session: what the client shared (subjective) and what you observed (objective). Include presenting concerns, relevant history, observations of appearance, mood, behavior, and any assessment results." value={formData.data} onChange={(e) => handleInputChange('data', e.target.value)} required />
                          </div>
                        </div>

                        <div className="card mb-3">
                          <div className="card-header py-2 bg-warning bg-opacity-10">
                            <h6 className="card-title text-warning mb-0"><i className="ti ti-brain me-2"></i>A - Assessment</h6>
                          </div>
                          <div className="card-body">
                            <textarea className="form-control" readOnly={isReadOnly} rows={5} placeholder="Your clinical interpretation of the data: diagnosis considerations, progress toward treatment goals, response to interventions, risk level, prognosis, and any clinical insights." value={formData.dapAssessment} onChange={(e) => handleInputChange('dapAssessment', e.target.value)} required />
                          </div>
                        </div>

                        <div className="card mb-3">
                          <div className="card-header py-2 bg-primary bg-opacity-10">
                            <h6 className="card-title text-primary mb-0"><i className="ti ti-list-check me-2"></i>P - Plan</h6>
                          </div>
                          <div className="card-body">
                            <textarea className="form-control" readOnly={isReadOnly} rows={5} placeholder="Next steps for treatment: interventions used today, recommendations, homework assignments, treatment plan modifications, referrals, and next session scheduling." value={formData.dapPlan} onChange={(e) => handleInputChange('dapPlan', e.target.value)} required />
                          </div>
                        </div>

                        {renderRiskAssessment()}
                      </>
                    )}

                    {/* BIRP Note */}
                    {noteStyle === 'birp' && (
                      <>
                        <div className="card mb-3">
                          <div className="card-header py-2 bg-info bg-opacity-10">
                            <h6 className="card-title text-info mb-0"><i className="ti ti-activity me-2"></i>B - Behavior</h6>
                          </div>
                          <div className="card-body">
                            <textarea className="form-control" readOnly={isReadOnly} rows={4} placeholder="Observable behaviors and client's presentation: what you saw and heard. Include appearance, mood, affect, speech patterns, body language, and what the client reported about their behaviors since last session." value={formData.behavior} onChange={(e) => handleInputChange('behavior', e.target.value)} required />
                          </div>
                        </div>

                        <div className="card mb-3">
                          <div className="card-header py-2 bg-success bg-opacity-10">
                            <h6 className="card-title text-success mb-0"><i className="ti ti-tool me-2"></i>I - Intervention</h6>
                          </div>
                          <div className="card-body">
                            <textarea className="form-control" readOnly={isReadOnly} rows={4} placeholder="Therapeutic techniques and actions taken: CBT, DBT skills, psychoeducation, active listening, reframing, role-playing, grounding techniques, motivational interviewing, etc." value={formData.intervention} onChange={(e) => handleInputChange('intervention', e.target.value)} required />
                          </div>
                        </div>

                        <div className="card mb-3">
                          <div className="card-header py-2 bg-warning bg-opacity-10">
                            <h6 className="card-title text-warning mb-0"><i className="ti ti-message-2 me-2"></i>R - Response</h6>
                          </div>
                          <div className="card-body">
                            <textarea className="form-control" readOnly={isReadOnly} rows={4} placeholder="How the client responded to interventions: engagement level, insights gained, emotional reactions, skill demonstration, resistance or openness, and any observable changes during the session." value={formData.response} onChange={(e) => handleInputChange('response', e.target.value)} required />
                          </div>
                        </div>

                        <div className="card mb-3">
                          <div className="card-header py-2 bg-primary bg-opacity-10">
                            <h6 className="card-title text-primary mb-0"><i className="ti ti-list-check me-2"></i>P - Plan</h6>
                          </div>
                          <div className="card-body">
                            <textarea className="form-control" readOnly={isReadOnly} rows={4} placeholder="Future treatment direction: next session focus, homework assignments, skills to practice, treatment modifications, referrals, and scheduling." value={formData.birpPlan} onChange={(e) => handleInputChange('birpPlan', e.target.value)} required />
                          </div>
                        </div>

                        {renderRiskAssessment()}
                      </>
                    )}

                    {/* GIRP Note */}
                    {noteStyle === 'girp' && (
                      <>
                        <div className="card mb-3">
                          <div className="card-header py-2 bg-success bg-opacity-10">
                            <h6 className="card-title text-success mb-0"><i className="ti ti-target me-2"></i>G - Goals</h6>
                          </div>
                          <div className="card-body">
                            <textarea className="form-control" readOnly={isReadOnly} rows={4} placeholder="Treatment goals addressed in this session: specific, measurable objectives from the treatment plan. Include both long-term goals and short-term objectives worked on today." value={formData.goals} onChange={(e) => handleInputChange('goals', e.target.value)} required />
                          </div>
                        </div>

                        <div className="card mb-3">
                          <div className="card-header py-2 bg-info bg-opacity-10">
                            <h6 className="card-title text-info mb-0"><i className="ti ti-tool me-2"></i>I - Intervention</h6>
                          </div>
                          <div className="card-body">
                            <textarea className="form-control" readOnly={isReadOnly} rows={4} placeholder="Therapeutic interventions used: specific techniques, modalities, and approaches employed to address the goals (e.g., cognitive restructuring, exposure, mindfulness, skill-building)." value={formData.girpIntervention} onChange={(e) => handleInputChange('girpIntervention', e.target.value)} required />
                          </div>
                        </div>

                        <div className="card mb-3">
                          <div className="card-header py-2 bg-warning bg-opacity-10">
                            <h6 className="card-title text-warning mb-0"><i className="ti ti-trending-up me-2"></i>R - Response</h6>
                          </div>
                          <div className="card-body">
                            <textarea className="form-control" readOnly={isReadOnly} rows={4} placeholder="Client's response and progress: how they engaged with interventions, progress toward goals, barriers encountered, insights gained, and measurable changes." value={formData.girpResponse} onChange={(e) => handleInputChange('girpResponse', e.target.value)} required />
                          </div>
                        </div>

                        <div className="card mb-3">
                          <div className="card-header py-2 bg-primary bg-opacity-10">
                            <h6 className="card-title text-primary mb-0"><i className="ti ti-list-check me-2"></i>P - Plan</h6>
                          </div>
                          <div className="card-body">
                            <textarea className="form-control" readOnly={isReadOnly} rows={4} placeholder="Plan moving forward: continued goals to address, new interventions to try, homework assignments, treatment plan updates, referrals, and next session scheduling." value={formData.girpPlan} onChange={(e) => handleInputChange('girpPlan', e.target.value)} required />
                          </div>
                        </div>

                        {renderRiskAssessment()}
                      </>
                    )}

                    {/* Free-form Note */}
                    {noteStyle === 'freeform' && (
                      <>
                        <div className="card mb-3">
                          <div className="card-header py-2">
                            <h6 className="card-title mb-0"><i className="ti ti-edit me-2"></i>Session Notes</h6>
                          </div>
                          <div className="card-body">
                            <textarea className="form-control" readOnly={isReadOnly} rows={12} placeholder="Enter your session notes in narrative format. Include relevant clinical observations, interventions used, client response, and plan for continued treatment." value={formData.freeformNote} onChange={(e) => handleInputChange('freeformNote', e.target.value)} required />
                          </div>
                        </div>

                        {renderRiskAssessment()}
                      </>
                    )}

                    {/* Comprehensive Note (Original full form) */}
                    {noteStyle === 'comprehensive' && (
                      <>
                        <div id="presenting" className="card mb-3">
                          <div className="card-header py-2"><h6 className="card-title mb-0"><i className="ti ti-message-circle me-2" />Presenting Problem</h6></div>
                          <div className="card-body py-3">
                            <div className="row g-3">
                              <div className="col-12">
                                <label className="form-label small mb-1">Chief Complaint *</label>
                                <input type="text" className="form-control" disabled={isReadOnly} placeholder="Patient's primary concern for today's session" value={formData.chiefComplaint} onChange={(e) => handleInputChange('chiefComplaint', e.target.value)} required />
                              </div>
                              <div className="col-12">
                                <label className="form-label small mb-1">Presenting Problem *</label>
                                <textarea className="form-control" readOnly={isReadOnly} rows={3} placeholder="Detailed description of symptoms, duration, severity, and impact on functioning" value={formData.presentingProblem} onChange={(e) => handleInputChange('presentingProblem', e.target.value)} required />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div id="mse" className="card mb-3">
                          <div className="card-header py-2"><h6 className="card-title mb-0"><i className="ti ti-brain me-2" />Mental Status Examination</h6></div>
                          <div className="card-body py-3">
                            <div className="row g-3">
                              <div className="col-md-6">
                                <label className="form-label small mb-1 fw-semibold">Appearance</label>
                                <div className="d-flex flex-wrap gap-2">
                                  {['Well-groomed', 'Disheveled', 'Appropriate dress', 'Poor hygiene', 'Good eye contact', 'Poor eye contact'].map((option) => (
                                    <div key={option} className="form-check form-check-inline m-0">
                                      <input className="form-check-input" type="checkbox" id={`appearance-${option}`} checked={formData.appearance.includes(option)} onChange={() => handleCheckboxChange('appearance', option)} />
                                      <label className="form-check-label small" htmlFor={`appearance-${option}`}>{option}</label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="col-md-6">
                                <label className="form-label small mb-1 fw-semibold">Behavior</label>
                                <div className="d-flex flex-wrap gap-2">
                                  {['Cooperative', 'Uncooperative', 'Agitated', 'Calm', 'Restless', 'Withdrawn'].map((option) => (
                                    <div key={option} className="form-check form-check-inline m-0">
                                      <input className="form-check-input" type="checkbox" id={`behaviorMse-${option}`} checked={formData.behaviorMse.includes(option)} onChange={() => handleCheckboxChange('behaviorMse', option)} />
                                      <label className="form-check-label small" htmlFor={`behaviorMse-${option}`}>{option}</label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="col-md-6">
                                <label className="form-label small mb-1 fw-semibold">Speech</label>
                                <div className="d-flex flex-wrap gap-2">
                                  {['Normal rate', 'Rapid', 'Slow', 'Clear', 'Slurred', 'Pressured'].map((option) => (
                                    <div key={option} className="form-check form-check-inline m-0">
                                      <input className="form-check-input" type="checkbox" id={`speech-${option}`} checked={formData.speech.includes(option)} onChange={() => handleCheckboxChange('speech', option)} />
                                      <label className="form-check-label small" htmlFor={`speech-${option}`}>{option}</label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="col-md-3">
                                <label className="form-label small mb-1 fw-semibold">Mood (Self-reported)</label>
                                <input type="text" disabled={isReadOnly} className="form-control form-control-sm" placeholder="e.g., Depressed, Anxious" value={formData.mood} onChange={(e) => handleInputChange('mood', e.target.value)} />
                              </div>
                              <div className="col-md-3">
                                <label className="form-label small mb-1 fw-semibold">Affect (Observed)</label>
                                <div className="d-flex flex-wrap gap-1">
                                  {['Appropriate', 'Flat', 'Blunted', 'Labile', 'Constricted', 'Full range'].map((option) => (
                                    <div key={option} className="form-check form-check-inline m-0">
                                      <input className="form-check-input" type="checkbox" id={`affect-${option}`} checked={formData.affect.includes(option)} onChange={() => handleCheckboxChange('affect', option)} />
                                      <label className="form-check-label small" htmlFor={`affect-${option}`}>{option}</label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="col-md-6">
                                <label className="form-label small mb-1 fw-semibold">Thought Process</label>
                                <div className="d-flex flex-wrap gap-2">
                                  {['Logical', 'Goal-directed', 'Tangential', 'Circumstantial', 'Flight of ideas', 'Disorganized'].map((option) => (
                                    <div key={option} className="form-check form-check-inline m-0">
                                      <input className="form-check-input" type="checkbox" id={`thoughtProcess-${option}`} checked={formData.thoughtProcess.includes(option)} onChange={() => handleCheckboxChange('thoughtProcess', option)} />
                                      <label className="form-check-label small" htmlFor={`thoughtProcess-${option}`}>{option}</label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="col-md-6">
                                <label className="form-label small mb-1 fw-semibold">Thought Content</label>
                                <div className="d-flex flex-wrap gap-2">
                                  {['Normal', 'Obsessions', 'Delusions', 'Paranoia', 'Preoccupations', 'Ruminations'].map((option) => (
                                    <div key={option} className="form-check form-check-inline m-0">
                                      <input className="form-check-input" type="checkbox" id={`thoughtContent-${option}`} checked={formData.thoughtContent.includes(option)} onChange={() => handleCheckboxChange('thoughtContent', option)} />
                                      <label className="form-check-label small" htmlFor={`thoughtContent-${option}`}>{option}</label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="col-md-6">
                                <label className="form-label small mb-1 fw-semibold">Orientation</label>
                                <div className="d-flex flex-wrap gap-2">
                                  {['Person', 'Place', 'Time', 'Situation'].map((option) => (
                                    <div key={option} className="form-check form-check-inline m-0">
                                      <input className="form-check-input" type="checkbox" id={`orientation-${option}`} checked={formData.orientation.includes(option)} onChange={() => handleCheckboxChange('orientation', option)} />
                                      <label className="form-check-label small" htmlFor={`orientation-${option}`}>{option}</label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="col-md-6">
                                <label className="form-label small mb-1 fw-semibold">Memory</label>
                                <div className="d-flex flex-wrap gap-2">
                                  {['Immediate intact', 'Recent intact', 'Remote intact', 'Impaired'].map((option) => (
                                    <div key={option} className="form-check form-check-inline m-0">
                                      <input className="form-check-input" type="checkbox" id={`memory-${option}`} checked={formData.memory.includes(option)} onChange={() => handleCheckboxChange('memory', option)} />
                                      <label className="form-check-label small" htmlFor={`memory-${option}`}>{option}</label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="col-md-3">
                                <label className="form-label small mb-1 fw-semibold">Insight</label>
                                <select disabled={isReadOnly} className="form-select form-select-sm" value={formData.insight} onChange={(e) => handleInputChange('insight', e.target.value)}>
                                  <option value="">Select...</option>
                                  <option value="Good">Good</option>
                                  <option value="Fair">Fair</option>
                                  <option value="Poor">Poor</option>
                                  <option value="Limited">Limited</option>
                                </select>
                              </div>
                              <div className="col-md-3">
                                <label className="form-label small mb-1 fw-semibold">Judgment</label>
                                <select disabled={isReadOnly} className="form-select form-select-sm" value={formData.judgment} onChange={(e) => handleInputChange('judgment', e.target.value)}>
                                  <option value="">Select...</option>
                                  <option value="Good">Good</option>
                                  <option value="Fair">Fair</option>
                                  <option value="Poor">Poor</option>
                                  <option value="Impaired">Impaired</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div id="risk" className="card mb-3 border-danger">
                          <div className="card-header py-2 bg-danger bg-opacity-10"><h6 className="card-title text-danger mb-0"><i className="ti ti-alert-triangle me-2" />Risk Assessment</h6></div>
                          <div className="card-body py-3">
                            <div className="row g-3">
                              <div className="col-md-4">
                                <label className="form-label small mb-1">Suicidal Ideation *</label>
                                <select disabled={isReadOnly} className="form-select form-select-sm" value={formData.suicidalIdeation} onChange={(e) => handleInputChange('suicidalIdeation', e.target.value)} required>
                                  <option value="Denied">Denied</option>
                                  <option value="Passive">Passive (no plan)</option>
                                  <option value="Active">Active (with plan)</option>
                                  <option value="Intent">Intent</option>
                                </select>
                              </div>
                              <div className="col-md-4">
                                <label className="form-label small mb-1">Homicidal Ideation *</label>
                                <select disabled={isReadOnly} className="form-select form-select-sm" value={formData.homicidalIdeation} onChange={(e) => handleInputChange('homicidalIdeation', e.target.value)} required>
                                  <option value="Denied">Denied</option>
                                  <option value="Passive">Passive (no plan)</option>
                                  <option value="Active">Active (with plan)</option>
                                  <option value="Intent">Intent</option>
                                </select>
                              </div>
                              <div className="col-md-4">
                                <label className="form-label small mb-1">Self-Harm Behavior *</label>
                                <select disabled={isReadOnly} className="form-select form-select-sm" value={formData.selfHarmBehavior} onChange={(e) => handleInputChange('selfHarmBehavior', e.target.value)} required>
                                  <option value="Denied">Denied</option>
                                  <option value="Past history">Past history</option>
                                  <option value="Recent">Recent (past month)</option>
                                  <option value="Current">Current</option>
                                </select>
                              </div>
                              <div className="col-12">
                                <label className="form-label small mb-1">Safety Plan / Crisis Interventions</label>
                                <textarea readOnly={isReadOnly} className="form-control form-control-sm" rows={2} placeholder="Describe safety measures, coping strategies, emergency contacts" value={formData.safetyPlan} onChange={(e) => handleInputChange('safetyPlan', e.target.value)} />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div id="clinical" className="card mb-3">
                          <div className="card-header py-2"><h6 className="card-title mb-0"><i className="ti ti-notes me-2" />Clinical Information</h6></div>
                          <div className="card-body py-3">
                            <div className="row g-3">
                              <div className="col-12">
                                <label className="form-label small mb-1">Interventions Used *</label>
                                <textarea className="form-control" readOnly={isReadOnly} rows={3} placeholder="Describe therapeutic interventions (CBT, DBT, Motivational Interviewing, Psychoeducation)" value={formData.interventions} onChange={(e) => handleInputChange('interventions', e.target.value)} required />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label small mb-1">Treatment Goals</label>
                                <textarea readOnly={isReadOnly} className="form-control form-control-sm" rows={2} placeholder="Current treatment goals being addressed" value={formData.treatmentGoals} onChange={(e) => handleInputChange('treatmentGoals', e.target.value)} />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label small mb-1">Progress Toward Goals</label>
                                <textarea readOnly={isReadOnly} className="form-control form-control-sm" rows={2} placeholder="Patient's progress and response to treatment" value={formData.progress} onChange={(e) => handleInputChange('progress', e.target.value)} />
                              </div>
                              <div className="col-12">
                                <label className="form-label small mb-1">Clinical Impression *</label>
                                <textarea className="form-control" readOnly={isReadOnly} rows={3} placeholder="Summary of clinical findings, overall assessment, and treatment response" value={formData.clinicalImpression} onChange={(e) => handleInputChange('clinicalImpression', e.target.value)} required />
                              </div>
                              <div className="col-md-4">
                                <label className="form-label small mb-1">Prognosis</label>
                                <select disabled={isReadOnly} className="form-select form-select-sm" value={formData.prognosis} onChange={(e) => handleInputChange('prognosis', e.target.value)}>
                                  <option value="Excellent">Excellent</option>
                                  <option value="Good">Good</option>
                                  <option value="Fair">Fair</option>
                                  <option value="Guarded">Guarded</option>
                                  <option value="Poor">Poor</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div id="plan" className="card mb-3">
                          <div className="card-header py-2"><h6 className="card-title mb-0"><i className="ti ti-calendar-check me-2" />Plan</h6></div>
                          <div className="card-body py-3">
                            <div className="row g-3">
                              <div className="col-md-4">
                                <label className="form-label small mb-1">Next Session</label>
                                <input type="date" disabled={isReadOnly} className="form-control form-control-sm" value={formData.nextSession} onChange={(e) => handleInputChange('nextSession', e.target.value)} />
                              </div>
                              <div className="col-md-8">
                                <label className="form-label small mb-1">Homework / Between-Session Tasks</label>
                                <textarea readOnly={isReadOnly} className="form-control form-control-sm" rows={2} placeholder="Assignments or activities for patient before next session" value={formData.homework} onChange={(e) => handleInputChange('homework', e.target.value)} />
                              </div>
                              <div className="col-12">
                                <label className="form-label small mb-1">Recommendations</label>
                                <textarea readOnly={isReadOnly} className="form-control form-control-sm" rows={2} placeholder="Referrals, testing, medication consultation" value={formData.recommendations} onChange={(e) => handleInputChange('recommendations', e.target.value)} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Action Buttons */}
                <div className="card">
                  <div className="card-body py-3">
                    <div className="d-flex justify-content-between">
                      <div>
                        <Link to={`/patients/${id}`} className="btn btn-outline-secondary me-2"><i className="ti ti-x me-1" />Cancel</Link>
                        <button type="button" className="btn btn-outline-secondary me-2" onClick={handleView}>
                          <i className="ti ti-eye me-1" />View
                        </button>
                        <button type="button" className="btn btn-outline-secondary me-2" onClick={handleDownloadPDF}>
                          <i className="ti ti-download me-1" />Download PDF
                        </button>
                      </div>
                      {!isReadOnly && (
                      <div>
                        {formData.noteType === 'progress_note' && (
                          <button type="button" className="btn btn-outline-primary me-2" onClick={handleSaveDraft} disabled={saving}>
                            {saving ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : <><i className="ti ti-device-floppy me-1" />Save as Draft</>}
                          </button>
                        )}
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                          {saving ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : <><i className="ti ti-check me-1" />Save & Sign</>}
                        </button>
                      </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </form>
        </div>
        <CommonFooter />
      </div>

      <style>{`
        .form-check-inline { margin-right: 0 !important; }
        .nav-link { transition: all 0.2s; }
        .nav-link:hover:not(.active) { background: #f8f9fa; border-radius: 4px; }
        .btn-check:checked + .btn-outline-primary { background-color: #0d6efd; color: white; }
        .cursor-pointer { cursor: pointer; }
      `}</style>

      {/* Signature Modal */}
      {showSignatureModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowSignatureModal(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="ti ti-signature me-2"></i>Sign & Lock Note
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowSignatureModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-warning mb-3">
                  <i className="ti ti-alert-triangle me-2"></i>
                  <strong>Warning:</strong> Once signed, this note will be locked and cannot be edited.
                </div>
                
                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Enter your full legal name to sign this note <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    placeholder="Type your full name..."
                    value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                    autoFocus
                  />
                  <div className="form-text">
                    By typing your name, you are electronically signing this document.
                  </div>
                </div>
                
                {/* Signature Preview */}
                {signatureName && (
                  <div className="mb-3 p-3 border rounded bg-light">
                    <small className="text-muted d-block mb-2">Signature Preview:</small>
                    <div style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive", fontSize: '28px', color: '#1a365d' }}>
                      {signatureName}
                    </div>
                    <div className="mt-2">
                      <strong>{formData.clinicianName}</strong>
                      {clinician.license && <div className="text-muted" style={{ fontSize: '12px' }}>License: {clinician.license}</div>}
                    </div>
                  </div>
                )}
                
                <div className="bg-light p-3 rounded">
                  <div className="row">
                    <div className="col-6">
                      <small className="text-muted d-block">Date & Time</small>
                      <strong>{new Date().toLocaleString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}</strong>
                    </div>
                    <div className="col-6">
                      <small className="text-muted d-block">IP Address</small>
                      <strong>{signerIP || 'Fetching...'}</strong>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-outline-secondary" 
                  onClick={() => setShowSignatureModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-success"
                  onClick={handleConfirmSignature}
                  disabled={!signatureName.trim() || saving}
                >
                  {saving ? (
                    <><span className="spinner-border spinner-border-sm me-1"></span>Signing...</>
                  ) : (
                    <><i className="ti ti-check me-1"></i>Sign & Lock Note</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AddProgressNote;