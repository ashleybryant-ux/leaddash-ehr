import { Link, useParams, useNavigate } from "react-router-dom";
import { all_routes } from "../../routes/all_routes";
import { useState, useEffect, useRef } from "react";
import axios from 'axios';
import config from '../../config';

// Import audit service
import { 
  auditPatientView, 
  auditPatientUpdate, 
  auditFileUpload, 
  auditFileDelete,
  auditNoteCreate,
  auditNoteDelete 
} from '../../services/auditService';

const API_URL = config.apiUrl;
const LOCATION_ID = config.ghlLocationId;

// Common ICD-10 Mental Health Diagnosis Codes
const DIAGNOSIS_CODES = [
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
  { code: 'F40.10', description: 'Social anxiety disorder' },
  { code: 'F42.9', description: 'Obsessive-compulsive disorder, unspecified' },
  { code: 'F31.9', description: 'Bipolar disorder, unspecified' },
  { code: 'F50.9', description: 'Eating disorder, unspecified' },
  { code: 'F90.9', description: 'Attention-deficit hyperactivity disorder, unspecified type' },
  { code: 'F60.3', description: 'Borderline personality disorder' },
  { code: 'F10.10', description: 'Alcohol use disorder, mild' },
  { code: 'F10.20', description: 'Alcohol use disorder, moderate' },
  { code: 'F34.1', description: 'Dysthymic disorder' },
  { code: 'F44.9', description: 'Dissociative disorder, unspecified' },
  { code: 'F51.01', description: 'Primary insomnia' },
  { code: 'Z63.0', description: 'Problems in relationship with spouse or partner' },
  { code: 'Z71.9', description: 'Counseling, unspecified' },
];

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
];

// CPT Code descriptions
const CPT_DESCRIPTIONS: { [key: string]: string } = {
  '90791': 'Psychiatric Diagnostic Evaluation',
  '90832': 'Psychotherapy, 16-37 min',
  '90834': 'Psychotherapy, 38-52 min',
  '90837': 'Psychotherapy, 53+ min',
  '90839': 'Psychotherapy for Crisis, first 60 min',
  '90840': 'Psychotherapy for Crisis, additional 30 min',
  '90846': 'Family Psychotherapy without Patient',
  '90847': 'Family Psychotherapy with Patient',
  '90853': 'Group Psychotherapy'
};

const PatientDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [progressNotes, setProgressNotes] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [chartNote, setChartNote] = useState("");
  const [chartNoteDate, setChartNoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [chartNoteTime, setChartNoteTime] = useState(new Date().toTimeString().slice(0, 5));
  const [savingNote, setSavingNote] = useState(false);
  const [dateRangeFilter, setDateRangeFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [locationName, setLocationName] = useState('');

  // Track if we've already logged the view for this patient
  const hasLoggedView = useRef(false);

  // Editable states for Admin Notes
  const [isEditingAdminNotes, setIsEditingAdminNotes] = useState(false);
  const [savingAdminNotes, setSavingAdminNotes] = useState(false);
  const [adminNotesForm, setAdminNotesForm] = useState('');

  // Editable states for Clinical Info
  const [isEditingClinical, setIsEditingClinical] = useState(false);
  const [savingClinical, setSavingClinical] = useState(false);
  const [clinicalForm, setClinicalForm] = useState({
    primaryDiagnosisCode: '',
    primaryDiagnosisDescription: '',
    secondaryDiagnosisCode: '',
    secondaryDiagnosisDescription: '',
    renderingProviderName: '',
    renderingProviderNpi: '',
    currentMedications: '',
    allergies: '',
    previousMentalHealthTreatment: ''
  });

  // Diagnosis picker state for clinical tab
  const [primaryDiagnosisSearch, setPrimaryDiagnosisSearch] = useState('');
  const [secondaryDiagnosisSearch, setSecondaryDiagnosisSearch] = useState('');
  const [showPrimaryDiagnosisDropdown, setShowPrimaryDiagnosisDropdown] = useState(false);
  const [showSecondaryDiagnosisDropdown, setShowSecondaryDiagnosisDropdown] = useState(false);

  const filteredPrimaryDiagnoses = DIAGNOSIS_CODES.filter(d => 
    d.code.toLowerCase().includes(primaryDiagnosisSearch.toLowerCase()) ||
    d.description.toLowerCase().includes(primaryDiagnosisSearch.toLowerCase())
  );

  const filteredSecondaryDiagnoses = DIAGNOSIS_CODES.filter(d => 
    d.code.toLowerCase().includes(secondaryDiagnosisSearch.toLowerCase()) ||
    d.description.toLowerCase().includes(secondaryDiagnosisSearch.toLowerCase())
  );

  const selectPrimaryDiagnosis = (diagnosis: {code: string, description: string}) => {
    setClinicalForm({
      ...clinicalForm,
      primaryDiagnosisCode: diagnosis.code,
      primaryDiagnosisDescription: diagnosis.description
    });
    setPrimaryDiagnosisSearch('');
    setShowPrimaryDiagnosisDropdown(false);
  };

  const selectSecondaryDiagnosis = (diagnosis: {code: string, description: string}) => {
    setClinicalForm({
      ...clinicalForm,
      secondaryDiagnosisCode: diagnosis.code,
      secondaryDiagnosisDescription: diagnosis.description
    });
    setSecondaryDiagnosisSearch('');
    setShowSecondaryDiagnosisDropdown(false);
  };

  // Files state
  const [files, setFiles] = useState<any[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  // State for forms tracking
  const [sendingFormId, setSendingFormId] = useState<string | null>(null);
  const [showFormPreview, setShowFormPreview] = useState(false);
  const [selectedForm, setSelectedForm] = useState<any>(null);

  // State for slide-out drawers
  const [showClientDrawer, setShowClientDrawer] = useState(false);
  const [showBillingDrawer, setShowBillingDrawer] = useState(false);

  // Editable states for Insurance
  const [isEditingInsurance, setIsEditingInsurance] = useState(false);
  const [savingInsurance, setSavingInsurance] = useState(false);
  const [insuranceForm, setInsuranceForm] = useState({
    carrier: '',
    payerId: '',
    memberId: '',
    groupNumber: '',
    insurancePhone: '',
    copayAmount: '',
    deductibleRemaining: '',
    policyHolderName: '',
    policyHolderDob: '',
    policyHolderRelationship: '',
    eligibilityStatus: '',
    lastVerified: '',
    insuranceNotes: '',
    clientDob: ''
  });

  // Editable states for Client Info
  const [isEditingClientInfo, setIsEditingClientInfo] = useState(false);
  const [savingClientInfo, setSavingClientInfo] = useState(false);
  const [clientInfoForm, setClientInfoForm] = useState({
    sex: '',
    gender: '',
    pronouns: '',
    phone: '',
    email: '',
    address1: '',
    city: '',
    state: '',
    postalCode: ''
  });

  // Helper function to get custom field value
  const getCustomFieldValue = (customFields: any[], fieldKey: string): string => {
    if (!customFields || !Array.isArray(customFields)) return '';
    
    const normalizedKey = fieldKey.replace(/^contact\./, '');
    
    const field = customFields.find((cf: any) => {
      const cfKey = (cf.key || cf.fieldKey || '').replace(/^contact\./, '');
      return cfKey === normalizedKey || cfKey === fieldKey;
    });
    
    if (field) {
      const value = field.value ?? field.field_value ?? '';
      return value;
    }
    
    return '';
  };

  // Calculate age from DOB
  const calculateAge = (dob: string) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Get the client's DOB
  const getClientDob = () => {
    return insuranceForm.clientDob || patient?.dateOfBirth || '';
  };

  // Check if client is a minor (under 18)
  const isMinor = () => {
    const dob = getClientDob();
    const age = calculateAge(dob);
    return age !== null && age < 18;
  };

  // Fetch admin notes
  const fetchAdminNotes = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const locationId = user.locationId || LOCATION_ID;

      const response = await axios.get(`${API_URL}/api/patients/${id}/admin-notes`, {
        params: { locationId },
        headers: { 'x-location-id': locationId }
      });

      if (response.data.success) {
        setAdminNotesForm(response.data.note || '');
      }
    } catch (error) {
      console.error('Error fetching admin notes:', error);
    }
  };

  // Initialize forms when patient data loads
  useEffect(() => {
    if (patient) {
      const customFields = patient.customFields || [];

      setClinicalForm({
        primaryDiagnosisCode: getCustomFieldValue(customFields, 'primary_diagnosis_code') || '',
        primaryDiagnosisDescription: getCustomFieldValue(customFields, 'primary_diagnosis_description') || '',
        secondaryDiagnosisCode: getCustomFieldValue(customFields, 'secondary_diagnosis_code') || '',
        secondaryDiagnosisDescription: getCustomFieldValue(customFields, 'secondary_diagnosis_description') || '',
        renderingProviderName: getCustomFieldValue(customFields, 'referring_provider_name') || '',
        renderingProviderNpi: getCustomFieldValue(customFields, 'referring_provider_npi') || '',
        currentMedications: getCustomFieldValue(customFields, 'current_medications') || '',
        allergies: getCustomFieldValue(customFields, 'allergies') || '',
        previousMentalHealthTreatment: getCustomFieldValue(customFields, 'previous_mental_health_treatment') || ''
      });

      const newInsuranceForm = {
        carrier: getCustomFieldValue(customFields, 'insurance_primary_carrier') || '',
        payerId: getCustomFieldValue(customFields, 'insurance_payer_id') || '',
        memberId: getCustomFieldValue(customFields, 'insurance_primary_member_id') || '',
        groupNumber: getCustomFieldValue(customFields, 'insurance_primary_group_number') || '',
        insurancePhone: getCustomFieldValue(customFields, 'insurance_primary_phone') || '',
        copayAmount: getCustomFieldValue(customFields, 'insurance_copay_amount') || '',
        deductibleRemaining: getCustomFieldValue(customFields, 'insurance_deductible_remaining') || '',
        policyHolderName: getCustomFieldValue(customFields, 'insurance_policy_holder_name') || '',
        policyHolderDob: getCustomFieldValue(customFields, 'insurance_policy_holder_date_of_birth') || '',
        policyHolderRelationship: getCustomFieldValue(customFields, 'insurance_relationship_to_patient') || '',
        eligibilityStatus: getCustomFieldValue(customFields, 'insurance_eligibility') || '',
        lastVerified: getCustomFieldValue(customFields, 'insurance_eligibility_checked_date') || '',
        insuranceNotes: getCustomFieldValue(customFields, 'insurance_notes') || '',
        clientDob: patient.dateOfBirth || ''
      };
      
      if (newInsuranceForm.carrier && !newInsuranceForm.payerId) {
        const matchedPayer = COMMON_PAYERS.find(p => p.name === newInsuranceForm.carrier);
        if (matchedPayer) {
          newInsuranceForm.payerId = matchedPayer.id;
        }
      }
      
      setInsuranceForm(newInsuranceForm);

      setClientInfoForm({
        sex: '',
        gender: getCustomFieldValue(customFields, 'gender') || '',
        pronouns: getCustomFieldValue(customFields, 'preferred_pronouns') || '',
        phone: patient.phone || '',
        email: patient.email || '',
        address1: patient.address1 || '',
        city: patient.city || '',
        state: patient.state || '',
        postalCode: patient.postalCode || ''
      });
    }
  }, [patient]);

  // Save admin notes
  const saveAdminNotes = async () => {
    setSavingAdminNotes(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const locationId = user.locationId || LOCATION_ID;

      const response = await axios.put(
        `${API_URL}/api/patients/${id}/admin-notes`,
        { note: adminNotesForm, locationId },
        { headers: { 'x-location-id': locationId } }
      );

      if (response.data.success) {
        setIsEditingAdminNotes(false);
        // Log the update
        auditPatientUpdate(id || '', `${patient?.firstName} ${patient?.lastName}`, ['adminNotes']);
      } else {
        alert('Failed to save admin notes: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error saving admin notes:', error);
      alert('Failed to save admin notes: ' + (error.response?.data?.message || error.message));
    } finally {
      setSavingAdminNotes(false);
    }
  };

  // Save clinical info
  const saveClinicalInfo = async () => {
    setSavingClinical(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const locationId = user.locationId || LOCATION_ID;

      const customFields = [
        { key: 'contact.primary_diagnosis_code', field_value: clinicalForm.primaryDiagnosisCode },
        { key: 'contact.primary_diagnosis_description', field_value: clinicalForm.primaryDiagnosisDescription },
        { key: 'contact.secondary_diagnosis_code', field_value: clinicalForm.secondaryDiagnosisCode },
        { key: 'contact.secondary_diagnosis_description', field_value: clinicalForm.secondaryDiagnosisDescription },
        { key: 'contact.referring_provider_name', field_value: clinicalForm.renderingProviderName },
        { key: 'contact.referring_provider_npi', field_value: clinicalForm.renderingProviderNpi },
        { key: 'contact.current_medications', field_value: clinicalForm.currentMedications },
        { key: 'contact.allergies', field_value: clinicalForm.allergies },
        { key: 'contact.previous_mental_health_treatment', field_value: clinicalForm.previousMentalHealthTreatment }
      ];

      const response = await axios.put(
        `${API_URL}/api/patients/${id}/update`,
        { customFields, locationId },
        { headers: { 'x-location-id': locationId } }
      );

      if (response.data.success) {
        setIsEditingClinical(false);
        // Log the update
        auditPatientUpdate(id || '', `${patient?.firstName} ${patient?.lastName}`, ['clinicalInfo']);
        fetchAllData();
      } else {
        alert('Failed to save clinical info: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error saving clinical info:', error);
      alert('Failed to save clinical info: ' + (error.response?.data?.message || error.message));
    } finally {
      setSavingClinical(false);
    }
  };

  // Upload file
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const locationId = user.locationId || LOCATION_ID;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('patientId', id || '');
      formData.append('locationId', locationId);
      formData.append('fileName', file.name);
      formData.append('fileType', file.type);
      formData.append('uploadedBy', user.userId || user.id || 'unknown');

      const response = await axios.post(
        `${API_URL}/api/patients/${id}/files`,
        formData,
        { 
          headers: { 
            'Content-Type': 'multipart/form-data',
            'x-location-id': locationId 
          } 
        }
      );

      if (response.data.success) {
        fetchPatientFiles();
        // Log the upload
        auditFileUpload(response.data.fileId || 'unknown', file.name, id || '', `${patient?.firstName} ${patient?.lastName}`);
        alert('File uploaded successfully');
      } else {
        alert('Failed to upload file: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file: ' + (error.response?.data?.message || error.message));
    } finally {
      setUploadingFile(false);
      event.target.value = '';
    }
  };

  // Fetch patient files
  const fetchPatientFiles = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const locationId = user.locationId || LOCATION_ID;

      const response = await axios.get(`${API_URL}/api/patients/${id}/files`, {
        headers: { 'x-location-id': locationId }
      });

      if (response.data.success) {
        setFiles(response.data.files || []);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  // Delete file
  const deleteFile = async (fileId: string, fileName?: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const locationId = user.locationId || LOCATION_ID;

      const response = await axios.delete(`${API_URL}/api/patients/${id}/files/${fileId}`, {
        headers: { 'x-location-id': locationId }
      });

      if (response.data.success) {
        // Log the deletion
        auditFileDelete(fileId, fileName || 'file', id || '', `${patient?.firstName} ${patient?.lastName}`);
        fetchPatientFiles();
      } else {
        alert('Failed to delete file: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file: ' + (error.response?.data?.message || error.message));
    }
  };

  // Delete chart note
  const deleteChartNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this chart note?')) return;

    setDeletingNoteId(noteId);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const locationId = user.locationId || LOCATION_ID;

      const response = await axios.delete(`${API_URL}/api/patients/${id}/notes/${noteId}`, {
        headers: { 'x-location-id': locationId },
        params: { locationId }
      });

      if (response.data.success) {
        // Log the deletion
        auditNoteDelete(noteId, id || '', `${patient?.firstName} ${patient?.lastName}`);
        fetchAllData();
      } else {
        alert('Failed to delete note: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note: ' + (error.response?.data?.message || error.message));
    } finally {
      setDeletingNoteId(null);
    }
  };

  // Save insurance info
  const saveInsurance = async () => {
    setSavingInsurance(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const locationId = user.locationId || LOCATION_ID;

      const customFields = [
        { key: 'contact.insurance_primary_carrier', field_value: insuranceForm.carrier },
        { key: 'contact.insurance_primary_member_id', field_value: insuranceForm.memberId },
        { key: 'contact.insurance_primary_group_number', field_value: insuranceForm.groupNumber },
        { key: 'contact.insurance_primary_phone', field_value: insuranceForm.insurancePhone },
        { key: 'contact.insurance_copay_amount', field_value: insuranceForm.copayAmount },
        { key: 'contact.insurance_deductible_remaining', field_value: insuranceForm.deductibleRemaining },
        { key: 'contact.insurance_policy_holder_name', field_value: insuranceForm.policyHolderName },
        { key: 'contact.insurance_policy_holder_date_of_birth', field_value: insuranceForm.policyHolderDob },
        { key: 'contact.insurance_relationship_to_patient', field_value: insuranceForm.policyHolderRelationship },
        { key: 'contact.insurance_eligibility', field_value: insuranceForm.eligibilityStatus },
        { key: 'contact.insurance_eligibility_checked_date', field_value: insuranceForm.lastVerified },
        { key: 'contact.insurance_notes', field_value: insuranceForm.insuranceNotes }
      ];

      const payload: any = { customFields, locationId };
      if (insuranceForm.clientDob) {
        payload.dateOfBirth = insuranceForm.clientDob;
      }

      const response = await axios.put(
        `${API_URL}/api/patients/${id}/update`,
        payload,
        { headers: { 'x-location-id': locationId } }
      );

      if (response.data.success) {
        setIsEditingInsurance(false);
        // Log the update
        auditPatientUpdate(id || '', `${patient?.firstName} ${patient?.lastName}`, ['insurance']);
        fetchAllData();
      } else {
        alert('Failed to save insurance info: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error saving insurance:', error);
      alert('Failed to save insurance info: ' + (error.response?.data?.message || error.message));
    } finally {
      setSavingInsurance(false);
    }
  };

  // Save client info
  const saveClientInfo = async () => {
    setSavingClientInfo(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const locationId = user.locationId || LOCATION_ID;

      const payload = {
        phone: clientInfoForm.phone,
        email: clientInfoForm.email,
        address1: clientInfoForm.address1,
        city: clientInfoForm.city,
        state: clientInfoForm.state,
        postalCode: clientInfoForm.postalCode,
        customFields: [
          { key: 'contact.gender', field_value: clientInfoForm.gender },
          { key: 'contact.preferred_pronouns', field_value: clientInfoForm.pronouns }
        ],
        locationId
      };

      const response = await axios.put(
        `${API_URL}/api/patients/${id}/update`,
        payload,
        { headers: { 'x-location-id': locationId } }
      );

      if (response.data.success) {
        setIsEditingClientInfo(false);
        // Log the update
        auditPatientUpdate(id || '', `${patient?.firstName} ${patient?.lastName}`, ['contactInfo']);
        fetchAllData();
      } else {
        alert('Failed to save client info: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error saving client info:', error);
      alert('Failed to save client info: ' + (error.response?.data?.message || error.message));
    } finally {
      setSavingClientInfo(false);
    }
  };

  // Helper function to generate professional note HTML for print preview
  const generateProfessionalNoteHTML = (note: any, patientData: any, location: string) => {
    const noteType = note.noteType === 'progress_note' ? 'Progress Note' : 
                     note.noteType === 'chart_note' ? 'Chart Note' :
                     note.noteType === 'diagnosis_treatment' ? 'Diagnosis & Treatment Plan' :
                     note.noteType === 'treatment_plan' ? 'Treatment Plan' :
                     'Clinical Note';

    const sessionDate = note.sessionDate 
      ? new Date(note.sessionDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'N/A';

    const sessionTime = note.sessionDate
      ? new Date(note.sessionDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : 'N/A';

    const createdDate = note.createdAt
      ? new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + new Date(note.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : 'N/A';

    const updatedDate = note.updatedAt
      ? new Date(note.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + new Date(note.updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : createdDate;

    const signedDateTime = note.signedAt
      ? new Date(note.signedAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + ' at ' + new Date(note.signedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : '';

    const generatedDate = new Date().toLocaleString('en-US');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${noteType} - ${patientData.firstName} ${patientData.lastName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 0; max-width: 900px; margin: 0 auto; line-height: 1.5; color: #333; font-size: 14px; }
            .preview-header { background: #f8f9fa; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e0e0e0; }
            .preview-title { color: #9ca3af; font-size: 14px; }
            .download-btn { background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
            .download-btn:hover { background: #2563eb; }
            .main-content { padding: 30px 40px; }
            .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
            .note-title { font-size: 28px; font-weight: 700; color: #1f2937; }
            .location-info { text-align: right; }
            .location-name { color: #3b82f6; font-size: 18px; font-weight: 600; }
            .location-subtitle { color: #9ca3af; font-size: 12px; }
            .status-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-top: 8px; }
            .status-signed { background: #dcfce7; color: #16a34a; }
            .status-draft { background: #fef3c7; color: #d97706; }
            .divider { height: 1px; background: linear-gradient(to right, #f97316, #f97316 50%, transparent 50%); margin: 16px 0; }
            .meta-row { display: flex; justify-content: space-between; color: #6b7280; font-size: 13px; margin-bottom: 20px; }
            .info-section { margin-bottom: 24px; }
            .info-section-title { font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
            .info-value { font-size: 15px; font-weight: 500; color: #1f2937; }
            .section { margin-bottom: 20px; }
            .section-title { font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
            .section-content { padding: 8px 0; }
            .signature-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-top: 24px; }
            .signature-check { color: #10b981; font-weight: 600; font-size: 15px; margin-bottom: 8px; }
            .signature-name { font-weight: 600; font-size: 14px; color: #1f2937; }
            .signature-date { font-size: 13px; color: #6b7280; }
            .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
            .footer-text { font-size: 11px; color: #9ca3af; }
            .footer-confidential { font-size: 11px; color: #9ca3af; margin-top: 4px; }
            @media print { .preview-header { display: none; } body { padding: 20px; } .main-content { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="preview-header">
            <span class="preview-title">${noteType} Preview</span>
            <button class="download-btn" onclick="window.print()">Download PDF / Print</button>
          </div>
          <div class="main-content">
            <div class="header-row">
              <div>
                <h1 class="note-title">${noteType}</h1>
                <span class="status-badge ${note.status === 'signed' ? 'status-signed' : 'status-draft'}">
                  ${note.status === 'signed' ? 'SIGNED & LOCKED' : 'DRAFT'}
                </span>
              </div>
              <div class="location-info">
                <div class="location-name">${location || 'Healthcare Practice'}</div>
                <div class="location-subtitle">Electronic Medical Records</div>
              </div>
            </div>
            <div class="divider"></div>
            <div class="meta-row">
              <span><strong>Created:</strong> ${createdDate}</span>
              <span><strong>Last Updated:</strong> ${updatedDate}</span>
            </div>
            <div class="info-section">
              <div class="info-grid">
                <div>
                  <div class="info-section-title">Patient Information</div>
                  <div class="info-value">${patientData.firstName} ${patientData.lastName}</div>
                </div>
                <div>
                  <div class="info-section-title">Provider</div>
                  <div class="info-value">${note.signedBy || note.createdBy || 'Provider'}</div>
                </div>
              </div>
            </div>
            ${note.diagnosis ? `<div class="section"><div class="section-title">Diagnosis</div><div class="section-content">${note.diagnosis}</div></div>` : ''}
            <div class="section">
              <div class="section-title">Session Details</div>
              <div>Date of Service: ${sessionDate} at ${sessionTime}${note.duration ? ' | Duration: ' + note.duration + ' min' : ''}${note.cptCode ? ' | CPT: ' + note.cptCode : ''}</div>
            </div>
            ${note.content ? `<div class="section"><div class="section-title">Clinical Documentation</div><div class="section-content">${note.content.replace(/\n/g, '<br>')}</div></div>` : ''}
            ${note.treatmentGoals ? `<div class="section"><div class="section-title">Treatment Goals</div><div class="section-content">${note.treatmentGoals.replace(/\n/g, '<br>')}</div></div>` : ''}
            ${note.status === 'signed' && note.signedBy ? `
            <div class="signature-box">
              <div class="signature-check">✓ Electronically Signed</div>
              <div class="signature-name">${note.signedBy}</div>
              <div class="signature-date">Signed: ${signedDateTime}</div>
            </div>
            ` : ''}
            <div class="footer">
              <div class="footer-text">${location || 'Healthcare Practice'} | Created: ${createdDate} | Updated: ${updatedDate}</div>
              <div class="footer-confidential">Generated on ${generatedDate} | CONFIDENTIAL - Protected Health Information</div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  // Send form to client
  const sendForm = async (sentField: string) => {
    setSendingFormId(sentField);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const locationId = user.locationId || LOCATION_ID;
      const now = new Date().toISOString();

      const payload = {
        customFields: [
          { key: `contact.${sentField}`, field_value: now }
        ],
        locationId
      };

      const response = await axios.put(
        `${API_URL}/api/patients/${id}/update`,
        payload,
        { headers: { 'x-location-id': locationId } }
      );

      if (response.data.success) {
        fetchAllData();
      } else {
        alert('Failed to send form: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error sending form:', error);
      alert('Failed to send form: ' + (error.response?.data?.message || error.message));
    } finally {
      setSendingFormId(null);
    }
  };

  // Download PDF for a progress note
  const handleDownloadNotePDF = async (note: any) => {
    if (!patient) return;

    const sessionDateFormatted = note.sessionDate || note.dateOfService
      ? new Date(note.sessionDate || note.dateOfService).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'N/A';

    let startTimeFormatted = '';
    let endTimeFormatted = '';
    
    if (note.timeOfService) {
      const [hours, minutes] = note.timeOfService.split(':');
      const tempDate = new Date();
      tempDate.setHours(parseInt(hours), parseInt(minutes));
      startTimeFormatted = tempDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      
      if (note.duration) {
        const endDate = new Date(tempDate.getTime() + parseInt(note.duration) * 60000);
        endTimeFormatted = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      }
    } else if (note.startTime) {
      startTimeFormatted = new Date(note.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      if (note.endTime) {
        endTimeFormatted = new Date(note.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      }
    }

    const cptCode = note.cptCode || note.billingCode || '';
    const cptDescription = CPT_DESCRIPTIONS[cptCode] || '';

    let diagnosisHTML = '';
    if (note.diagnosis) {
      const diagnoses = note.diagnosis.split('\n').filter((d: string) => d.trim());
      diagnosisHTML = diagnoses.map((d: string) => `<div style="color: #555;">${d}</div>`).join('');
    }

    const isSigned = note.status === 'signed' && note.signedAt;
    const signedDateStr = isSigned 
      ? new Date(note.signedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : '';
    const signedTimeStr = isSigned
      ? new Date(note.signedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) + ' CT'
      : '';

    const formatTimestamp = (isoStr: string) => {
      if (!isoStr) return 'N/A';
      const date = new Date(isoStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + 
             ' at ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) + ' CT';
    };
    const createdFormatted = formatTimestamp(note.createdAt);
    const updatedFormatted = formatTimestamp(note.updatedAt || note.createdAt);

    let noteContentHTML = '';
    if (note.noteStyle === 'soap') {
      noteContentHTML = `
        ${note.subjective ? `<p style="margin-bottom: 12px;"><strong>SUBJECTIVE:</strong><br/>${note.subjective.replace(/\n/g, '<br/>')}</p>` : ''}
        ${note.objective ? `<p style="margin-bottom: 12px;"><strong>OBJECTIVE:</strong><br/>${note.objective.replace(/\n/g, '<br/>')}</p>` : ''}
        ${note.assessment ? `<p style="margin-bottom: 12px;"><strong>ASSESSMENT:</strong><br/>${note.assessment.replace(/\n/g, '<br/>')}</p>` : ''}
        ${note.plan ? `<p style="margin-bottom: 12px;"><strong>PLAN:</strong><br/>${note.plan.replace(/\n/g, '<br/>')}</p>` : ''}
      `;
    } else if (note.noteStyle === 'dap') {
      noteContentHTML = `
        ${note.data ? `<p style="margin-bottom: 12px;"><strong>DATA:</strong><br/>${note.data.replace(/\n/g, '<br/>')}</p>` : ''}
        ${note.assessment ? `<p style="margin-bottom: 12px;"><strong>ASSESSMENT:</strong><br/>${note.assessment.replace(/\n/g, '<br/>')}</p>` : ''}
        ${note.plan ? `<p style="margin-bottom: 12px;"><strong>PLAN:</strong><br/>${note.plan.replace(/\n/g, '<br/>')}</p>` : ''}
      `;
    } else if (note.noteStyle === 'birp') {
      noteContentHTML = `
        ${note.behavior ? `<p style="margin-bottom: 12px;"><strong>BEHAVIOR:</strong><br/>${note.behavior.replace(/\n/g, '<br/>')}</p>` : ''}
        ${note.intervention ? `<p style="margin-bottom: 12px;"><strong>INTERVENTION:</strong><br/>${note.intervention.replace(/\n/g, '<br/>')}</p>` : ''}
        ${note.response ? `<p style="margin-bottom: 12px;"><strong>RESPONSE:</strong><br/>${note.response.replace(/\n/g, '<br/>')}</p>` : ''}
        ${note.plan ? `<p style="margin-bottom: 12px;"><strong>PLAN:</strong><br/>${note.plan.replace(/\n/g, '<br/>')}</p>` : ''}
      `;
    } else if (note.content) {
      noteContentHTML = `<p style="margin-bottom: 12px;">${note.content.replace(/\n/g, '<br/>')}</p>`;
    }

    const showRisk = note.suicidalIdeation !== 'Denied' || note.homicidalIdeation !== 'Denied' || note.selfHarmBehavior !== 'Denied';
    const riskHTML = showRisk ? `
      <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px; margin: 16px 0;">
        <div style="font-weight: bold; margin-bottom: 8px;">Risk Assessment</div>
        <div style="display: flex; gap: 24px;">
          <div><strong>Suicidal Ideation:</strong> ${note.suicidalIdeation || 'Denied'}</div>
          <div><strong>Homicidal Ideation:</strong> ${note.homicidalIdeation || 'Denied'}</div>
          <div><strong>Self-Harm:</strong> ${note.selfHarmBehavior || 'Denied'}</div>
        </div>
      </div>
    ` : '';

    const treatmentGoalsHTML = note.treatmentGoals ? `
      <div style="margin-top: 16px;">
        <div style="font-weight: bold; margin-bottom: 4px;">Treatment Goals</div>
        <div>${note.treatmentGoals.replace(/\n/g, '<br/>')}</div>
      </div>
    ` : '';

    const container = document.createElement('div');
    container.style.cssText = 'position: absolute; left: -9999px; top: 0; width: 8.5in; padding: 0.5in; background: white; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 12px; line-height: 1.5; color: #333;';
    document.body.appendChild(container);

    container.innerHTML = `
      <div style="margin-bottom: 20px;">
        <div style="margin-bottom: 4px;"><strong style="display: inline-block; width: 80px;">Client:</strong> ${patient.firstName} ${patient.lastName}</div>
        <div style="margin-bottom: 4px;"><strong style="display: inline-block; width: 80px;">DOB:</strong> ${patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}</div>
        <div style="margin-bottom: 4px;"><strong style="display: inline-block; width: 80px;">Provider:</strong> ${note.clinicianName || note.signedBy || 'Provider'}</div>
        ${note.providerLicense ? `<div style="margin-bottom: 4px;"><strong style="display: inline-block; width: 80px;">License:</strong> ${note.providerLicense}</div>` : ''}
      </div>
      
      <div style="display: flex; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #ccc;">
        <div style="flex: 1;">
          <div style="font-weight: bold; margin-bottom: 4px;">Appointment:</div>
          <div style="color: #555;">${note.sessionType ? note.sessionType.charAt(0).toUpperCase() + note.sessionType.slice(1) : 'Session'} on ${sessionDateFormatted}</div>
          ${startTimeFormatted ? `<div style="color: #555; margin-left: 15px;">${startTimeFormatted}${endTimeFormatted ? ' - ' + endTimeFormatted : ''} CT${note.duration ? ', ' + note.duration + ' min' : ''}</div>` : ''}
          ${cptCode ? `<div style="color: #555; margin-left: 15px;">Billing: ${cptCode}${cptDescription ? ' - ' + cptDescription : ''}</div>` : ''}
        </div>
        <div style="flex: 1; padding-left: 30px;">
          ${diagnosisHTML ? `<div style="font-weight: bold; margin-bottom: 4px;">Diagnosis:</div>${diagnosisHTML}` : ''}
        </div>
      </div>

      <div style="text-align: center; font-size: 16px; font-weight: bold; margin: 20px 0;">Progress Note</div>

      <div style="text-align: justify; line-height: 1.6;">
        ${noteContentHTML}
      </div>

      ${riskHTML}
      ${treatmentGoalsHTML}

      <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #333;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-family: 'Brush Script MT', cursive; font-size: 22px; color: #1a365d;">${note.signedBy || note.clinicianName || ''}</div>
            <div style="border-top: 1px solid #333; width: 250px; margin-top: 4px; padding-top: 4px;">
              <div>${note.clinicianName || note.signedBy || ''}</div>
              ${note.providerLicense ? `<div style="color: #666; font-size: 11px;">${note.providerLicense}</div>` : ''}
            </div>
          </div>
          <div style="text-align: right;">
            ${isSigned ? `
              <div style="color: #16a34a; font-weight: 600;">✓ Electronically Signed</div>
              <div style="color: #666; font-size: 11px;">${signedDateStr}</div>
              <div style="color: #666; font-size: 11px;">${signedTimeStr}</div>
              ${note.signerIP ? `<div style="color: #999; font-size: 10px;">IP: ${note.signerIP}</div>` : ''}
            ` : `<div style="color: #999;">Not Yet Signed</div>`}
          </div>
        </div>
      </div>

      <div style="margin-top: 30px; padding-top: 12px; border-top: 2px solid #f97316; font-size: 10px; color: #666;">
        <div>Created: ${createdFormatted} | Updated: ${updatedFormatted}</div>
        <div style="text-align: right;">Page 1 of 1</div>
      </div>
    `;

    try {
      if (!(window as any).html2canvas) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load html2canvas'));
          document.head.appendChild(script);
        });
      }

      if (!(window as any).jspdf) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load jsPDF'));
          document.head.appendChild(script);
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const html2canvas = (window as any).html2canvas;
      const jsPDF = (window as any).jspdf.jsPDF;

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'letter'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 36;

      const imgWidth = pageWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(
        canvas.toDataURL('image/jpeg', 0.95),
        'JPEG',
        margin,
        margin,
        imgWidth,
        Math.min(imgHeight, pageHeight - (margin * 2))
      );

      const patientName = `${patient.firstName}_${patient.lastName}`.replace(/\s+/g, '_');
      const dateStr = note.sessionDate 
        ? new Date(note.sessionDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      const filename = `Progress_Note_${patientName}_${dateStr}.pdf`;

      pdf.save(filename);

    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF. Please try using the View button and print from there.');
    } finally {
      document.body.removeChild(container);
    }
  };

  useEffect(() => {
    if (id) {
      fetchAllData();
      fetchLocationName();
      fetchPatientFiles();
      fetchAdminNotes();
    }
  }, [id]);

  // Reset the view tracking when patient ID changes
  useEffect(() => {
    hasLoggedView.current = false;
  }, [id]);

  const fetchLocationName = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const locationId = user.locationId || LOCATION_ID;
      const response = await axios.get(`${API_URL}/api/location/${locationId}`);
      if (response.data.success && response.data.location?.name) {
        setLocationName(response.data.location.name);
      }
    } catch (error) {
      console.error('Error fetching location:', error);
      setLocationName('');
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const locationId = user.locationId || LOCATION_ID;

      const [patientRes, appointmentsRes, notesRes, invoicesRes] = await Promise.all([
        axios.get(`${API_URL}/api/patients/${id}`, {
          params: { locationId }
        }).catch(() => ({ data: { patient: null } })),
        
        axios.get(`${API_URL}/api/appointments`, {
          params: { locationId, contactId: id }
        }).catch(() => ({ data: { appointments: [] } })),
        
        axios.get(`${API_URL}/api/patients/${id}/notes`, {
          params: { locationId }
        }).catch(() => ({ data: { notes: [] } })),
        
        axios.get(`${API_URL}/api/invoices/${id}`, {
          headers: { 'x-location-id': locationId }
        }).catch(() => ({ data: { invoices: [] } }))
      ]);

      if (patientRes.data.success && patientRes.data.patient) {
        setPatient(patientRes.data.patient);
        
        // Log patient view (only once per page load)
        if (!hasLoggedView.current) {
          const p = patientRes.data.patient;
          auditPatientView(id || '', `${p.firstName} ${p.lastName}`);
          hasLoggedView.current = true;
        }
      }

      if (appointmentsRes.data.success) {
        const patientAppointments = (appointmentsRes.data.appointments || [])
          .filter((apt: any) => apt.contactId === id)
          .sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        setAppointments(patientAppointments);
      }

      if (notesRes.data.success) {
        setProgressNotes(notesRes.data.notes || []);
      }

      if (invoicesRes.data.success) {
        setInvoices(invoicesRes.data.invoices || []);
      }

    } catch (error) {
      console.error('Error fetching patient data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const getUpcomingAppointments = () => {
    const now = new Date();
    return appointments.filter(apt => 
      new Date(apt.startTime) >= now && 
      apt.appointmentStatus !== 'cancelled' &&
      apt.appointmentStatus !== 'canceled'
    ).slice(0, 3);
  };

  const getClientBalance = () => {
    let total = 0;
    invoices.forEach(inv => {
      const balance = (inv.total || 0) - (inv.amountPaid || 0);
      total += balance;
    });
    return total;
  };

  const getUnpaidInvoices = () => {
    return invoices.filter(inv => {
      const balance = (inv.total || 0) - (inv.amountPaid || 0);
      return balance > 0;
    });
  };

  const saveChartNote = async () => {
    if (!chartNote.trim()) {
      alert('Please enter a note');
      return;
    }

    setSavingNote(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const locationId = user.locationId || LOCATION_ID;

      const noteData = {
        patientId: id,
        locationId,
        noteType: 'chart_note',
        sessionDate: `${chartNoteDate}T${chartNoteTime}:00`,
        content: chartNote,
        summary: chartNote.substring(0, 200),
        status: 'completed',
        createdBy: user.userId || user.id
      };

      const response = await axios.post(`${API_URL}/api/patients/${id}/notes?locationId=${locationId}`, noteData);

      if (response.data.success) {
        setChartNote("");
        // Log the note creation
        auditNoteCreate(response.data.noteId || response.data.note?.id || 'unknown', id || '', `${patient?.firstName} ${patient?.lastName}`, 'chart_note');
        fetchAllData();
        alert('Chart note saved successfully');
      } else {
        alert('Failed to save note: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error saving chart note:', error);
      alert('Failed to save note: ' + (error.response?.data?.message || error.message));
    } finally {
      setSavingNote(false);
    }
  };

  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + durationMinutes * 60000);
    return end.toISOString();
  };

  const buildTimeline = () => {
    const timeline: any[] = [];
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    const now = new Date();
    
    switch (dateRangeFilter) {
      case "30days":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      case "90days":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      case "6months":
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      case "1year":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      case "custom":
        if (customStartDate) startDate = new Date(customStartDate);
        if (customEndDate) endDate = new Date(customEndDate + "T23:59:59");
        break;
      default:
        break;
    }

    const noteIdsWithAppointments = new Set<string>();

    appointments.forEach(apt => {
      const aptDate = new Date(apt.startTime);
      
      if (startDate && aptDate < startDate) return;
      if (endDate && aptDate > endDate) return;
      
      const associatedNote = progressNotes.find(note => {
        if (note.noteType === 'chart_note' || note.noteType === 'diagnosis' || note.noteType === 'diagnosis_treatment' || note.noteType === 'treatment_plan') {
          return false;
        }
        if (note.appointmentId && note.appointmentId === apt.id) {
          return true;
        }
        const noteDate = new Date(note.sessionDate || note.createdAt).toDateString();
        const aptDateStr = aptDate.toDateString();
        return noteDate === aptDateStr && note.noteType === 'progress_note';
      });

      if (associatedNote) {
        noteIdsWithAppointments.add(associatedNote.id || associatedNote._id);
      }

      const aptTimestamp = new Date(apt.startTime).getTime();
      timeline.push({
        type: 'appointment',
        date: apt.startTime,
        sortTimestamp: aptTimestamp,
        data: apt,
        hasNote: !!associatedNote,
        note: associatedNote || null,
        isNumbered: true
      });
    });

    progressNotes.forEach(note => {
      const noteId = note.id || note._id;
      
      let noteTimestamp: number;
      if (note.dateOfService && note.timeOfService) {
        noteTimestamp = new Date(`${note.dateOfService}T${note.timeOfService}:00`).getTime();
      } else if (note.startTime) {
        noteTimestamp = new Date(note.startTime).getTime();
      } else if (note.sessionDate) {
        const sessionDate = new Date(note.sessionDate);
        if (note.sessionTime && (sessionDate.getHours() === 0 && sessionDate.getMinutes() === 0)) {
          const dateOnly = note.sessionDate.includes('T') ? note.sessionDate.split('T')[0] : note.sessionDate;
          noteTimestamp = new Date(`${dateOnly}T${note.sessionTime}:00`).getTime();
        } else {
          noteTimestamp = sessionDate.getTime();
        }
      } else {
        noteTimestamp = new Date(note.createdAt).getTime();
      }
      
      const noteDate = new Date(noteTimestamp);
      
      if (startDate && noteDate < startDate) return;
      if (endDate && noteDate > endDate) return;
      
      if (note.noteType === 'progress_note' && noteIdsWithAppointments.has(noteId)) {
        return;
      }
      
      const isNumbered = note.noteType === 'progress_note';
      
      timeline.push({
        type: 'note',
        date: note.sessionDate || note.createdAt,
        sortTimestamp: noteTimestamp,
        data: note,
        isNumbered: isNumbered
      });
    });

    timeline.sort((a, b) => b.sortTimestamp - a.sortTimestamp);

    const numberedItems = timeline.filter(item => item.isNumbered);
    
    const numberedItemsSortedAsc = [...numberedItems].sort((a, b) => {
      const aDayStart = Math.floor(a.sortTimestamp / ONE_DAY_MS);
      const bDayStart = Math.floor(b.sortTimestamp / ONE_DAY_MS);
      
      if (aDayStart !== bDayStart) {
        return a.sortTimestamp - b.sortTimestamp;
      }
      
      const aCreated = new Date(a.data.createdAt || 0).getTime();
      const bCreated = new Date(b.data.createdAt || 0).getTime();
      if (aCreated !== bCreated) {
        return aCreated - bCreated;
      }
      
      if (a.type === 'appointment' && b.type !== 'appointment') return -1;
      if (a.type !== 'appointment' && b.type === 'appointment') return 1;
      return 0;
    });
    
    const sessionNumberMap = new Map<string, number>();
    numberedItemsSortedAsc.forEach((item, index) => {
      const key = item.type === 'appointment' 
        ? `apt-${item.data.id}` 
        : `note-${item.data.id || item.data._id}`;
      sessionNumberMap.set(key, index + 1);
    });
    
    timeline.forEach(item => {
      if (item.isNumbered) {
        const key = item.type === 'appointment' 
          ? `apt-${item.data.id}` 
          : `note-${item.data.id || item.data._id}`;
        item.sessionNumber = sessionNumberMap.get(key);
      }
    });

    timeline.sort((a, b) => {
      const aDayStart = Math.floor(a.sortTimestamp / ONE_DAY_MS);
      const bDayStart = Math.floor(b.sortTimestamp / ONE_DAY_MS);
      
      if (aDayStart !== bDayStart) {
        return b.sortTimestamp - a.sortTimestamp;
      }
      
      const aNum = a.sessionNumber || 0;
      const bNum = b.sessionNumber || 0;
      if (aNum !== bNum) {
        return bNum - aNum;
      }
      
      return b.sortTimestamp - a.sortTimestamp;
    });

    const grouped: { [key: string]: any[] } = {};
    timeline.forEach(item => {
      const year = new Date(item.date).getFullYear().toString();
      if (!grouped[year]) grouped[year] = [];
      grouped[year].push(item);
    });

    return grouped;
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
            <div className="text-center">
              <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }} role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="text-muted">Loading client record...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
            <div className="text-center">
              <div className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '80px', height: '80px' }}>
                <i className="ti ti-user-x fs-1 text-muted"></i>
              </div>
              <h5>Client Not Found</h5>
              <p className="text-muted mb-3">This record doesn't exist or has been removed</p>
              <Link to={all_routes.patients} className="btn btn-primary">
                <i className="ti ti-arrow-left me-2"></i>Return to Clients
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const timeline = buildTimeline();
  const upcomingAppointments = getUpcomingAppointments();
  const clientBalance = getClientBalance();
  const unpaidInvoices = getUnpaidInvoices();
  const clientDob = getClientDob();
  const age = calculateAge(clientDob);
  const clientIsMinor = isMinor();

  const allVisits: any[] = [];
  Object.entries(timeline).forEach(([year, items]) => {
    (items as any[]).forEach(item => allVisits.push(item));
  });
  
  const DAY_MS = 24 * 60 * 60 * 1000;
  allVisits.sort((a, b) => {
    const aDayStart = Math.floor(a.sortTimestamp / DAY_MS);
    const bDayStart = Math.floor(b.sortTimestamp / DAY_MS);
    
    if (aDayStart !== bDayStart) {
      return b.sortTimestamp - a.sortTimestamp;
    }
    
    const aNum = a.sessionNumber || 0;
    const bNum = b.sessionNumber || 0;
    if (aNum !== bNum) {
      return bNum - aNum;
    }
    
    return b.sortTimestamp - a.sortTimestamp;
  });

  return (
    <div className="page-wrapper">
      <div className="content">
        
        {/* TOP HEADER */}
        <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
          <div className="row align-items-center">
            <div className="col-lg-4">
              <div className="d-flex align-items-center gap-3">
                <div 
                  className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                  style={{ width: '56px', height: '56px', fontSize: '20px', backgroundColor: '#059669' }}
                >
                  {patient.firstName?.charAt(0)}{patient.lastName?.charAt(0)}
                </div>
                <div>
                  <h4 className="mb-1 fw-semibold">{patient.firstName} {patient.lastName}</h4>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    {clientIsMinor && (
                      <span className="badge rounded-pill" style={{ backgroundColor: '#fef3c7', color: '#b45309' }}>
                        <i className="ti ti-alert-circle me-1"></i>Minor
                      </span>
                    )}
                    <span className="badge rounded-pill bg-success-subtle text-success">Active</span>
                    <span className="text-muted small">
                      {formatDate(clientDob)} {age !== null && `• ${age} years old`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="row g-3">
                <div className="col-4">
                  <div className="text-center p-2 rounded-3" style={{ backgroundColor: '#f8fafc' }}>
                    <div className="text-muted small mb-1">Balance</div>
                    <div className={`fw-bold fs-5 ${clientBalance > 0 ? 'text-danger' : 'text-success'}`}>
                      {formatCurrency(clientBalance)}
                    </div>
                  </div>
                </div>
                <div className="col-4">
                  <div className="text-center p-2 rounded-3" style={{ backgroundColor: '#f8fafc' }}>
                    <div className="text-muted small mb-1">Visits</div>
                    <div className="fw-bold fs-5" style={{ color: '#059669' }}>{allVisits.filter(v => v.isNumbered).length}</div>
                  </div>
                </div>
                <div className="col-4">
                  <div className="text-center p-2 rounded-3" style={{ backgroundColor: '#f8fafc' }}>
                    <div className="text-muted small mb-1">Next Appt</div>
                    <div className="fw-bold small text-dark">
                      {upcomingAppointments.length > 0 
                        ? <>
                            {new Date(upcomingAppointments[0].startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            <span className="text-muted ms-1">
                              {new Date(upcomingAppointments[0].startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </span>
                          </>
                        : '—'
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-3">
              <div className="d-flex gap-2 justify-content-lg-end flex-wrap">
                <button 
                  className="btn btn-outline-secondary btn-sm rounded-pill"
                  onClick={() => setShowClientDrawer(true)}
                >
                  <i className="ti ti-user me-1"></i>Profile
                </button>
                <button 
                  className="btn btn-outline-secondary btn-sm rounded-pill"
                  onClick={() => setShowBillingDrawer(true)}
                >
                  <i className="ti ti-receipt me-1"></i>Billing
                </button>
                <Link to={all_routes.patients} className="btn btn-outline-secondary btn-sm rounded-pill">
                  <i className="ti ti-arrow-left me-1"></i>Back
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* INTERNAL NOTES BAR */}
        <div className="bg-white rounded-4 shadow-sm p-3 mb-4">
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2 flex-grow-1">
              <i className="ti ti-note text-muted"></i>
              <span className="text-muted small fw-medium">Internal Notes:</span>
              {isEditingAdminNotes ? (
                <input
                  type="text"
                  className="form-control form-control-sm flex-grow-1 rounded-pill"
                  value={adminNotesForm}
                  onChange={(e) => setAdminNotesForm(e.target.value)}
                  placeholder="Add private notes about this client..."
                  style={{ maxWidth: '500px' }}
                  autoFocus
                />
              ) : (
                <span 
                  className="text-muted small cursor-pointer flex-grow-1"
                  onClick={() => setIsEditingAdminNotes(true)}
                  style={{ fontStyle: adminNotesForm ? 'normal' : 'italic' }}
                >
                  {adminNotesForm || 'Click to add notes...'}
                </span>
              )}
            </div>
            <div className="d-flex gap-2">
              {isEditingAdminNotes ? (
                <>
                  <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => { setIsEditingAdminNotes(false); fetchAdminNotes(); }}>Cancel</button>
                  <button className="btn btn-sm btn-primary rounded-pill" onClick={() => { saveAdminNotes(); setIsEditingAdminNotes(false); }} disabled={savingAdminNotes}>
                    {savingAdminNotes ? <span className="spinner-border spinner-border-sm"></span> : 'Save'}
                  </button>
                </>
              ) : (
                <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => setIsEditingAdminNotes(true)}>
                  <i className="ti ti-edit me-1"></i>Edit
                </button>
              )}
            </div>
          </div>
        </div>

        {/* MAIN LAYOUT */}
        <div className="row">
          {/* Left Navigation */}
          <div className="col-lg-2 col-md-3 mb-4">
            <div className="bg-white rounded-4 shadow-sm p-3">
              <nav className="nav nav-pills flex-column gap-1">
                <button className={`nav-link text-start rounded-3 ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
                  <i className="ti ti-layout-dashboard me-2"></i>Visit History
                </button>
                <button className={`nav-link text-start rounded-3 ${activeTab === 'clinical' ? 'active' : ''}`} onClick={() => setActiveTab('clinical')}>
                  <i className="ti ti-stethoscope me-2"></i>Clinical
                </button>
                <button className={`nav-link text-start rounded-3 ${activeTab === 'insurance' ? 'active' : ''}`} onClick={() => setActiveTab('insurance')}>
                  <i className="ti ti-shield-check me-2"></i>Coverage
                </button>
                <button className={`nav-link text-start rounded-3 ${activeTab === 'billing' ? 'active' : ''}`} onClick={() => setActiveTab('billing')}>
                  <i className="ti ti-credit-card me-2"></i>Payments
                </button>
                <button className={`nav-link text-start rounded-3 ${activeTab === 'files' ? 'active' : ''}`} onClick={() => setActiveTab('files')}>
                  <i className="ti ti-folder me-2"></i>Documents
                </button>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-lg-10 col-md-9">
            
            {/* VISIT HISTORY TAB */}
            {activeTab === 'overview' && (
              <div className="overview-content">
                {/* Quick Add Section */}
                <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                  <div className="row align-items-end g-3">
                    <div className="col-lg-6">
                      <label className="form-label small text-muted mb-1">Quick Chart Note</label>
                      <textarea 
                        className="form-control rounded-3" 
                        rows={2}
                        placeholder="Document a phone call, email, or quick note..."
                        value={chartNote}
                        onChange={(e) => setChartNote(e.target.value)}
                        style={{ resize: 'none' }}
                      />
                    </div>
                    <div className="col-lg-3">
                      <div className="row g-2">
                        <div className="col-6">
                          <label className="form-label small text-muted mb-1">Date</label>
                          <input type="date" className="form-control form-control-sm rounded-3" value={chartNoteDate} onChange={(e) => setChartNoteDate(e.target.value)} />
                        </div>
                        <div className="col-6">
                          <label className="form-label small text-muted mb-1">Time</label>
                          <input type="time" className="form-control form-control-sm rounded-3" value={chartNoteTime} onChange={(e) => setChartNoteTime(e.target.value)} />
                        </div>
                      </div>
                    </div>
                    <div className="col-lg-3">
                      <div className="d-flex gap-2">
                        <button className="btn btn-outline-primary rounded-pill flex-grow-1" onClick={saveChartNote} disabled={savingNote || !chartNote.trim()}>
                          {savingNote ? <span className="spinner-border spinner-border-sm"></span> : <><i className="ti ti-plus me-1"></i>Add</>}
                        </button>
                        <button className="btn btn-primary rounded-pill flex-grow-1" onClick={() => navigate(`/patients/${id}/add-progress-note`, { state: { newNote: true } })}>
                          <i className="ti ti-file-plus me-1"></i>Progress Note
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filter Bar */}
                <div className="d-flex align-items-center gap-3 mb-3">
                  <span className="text-muted small">Filter:</span>
                  <select className="form-select form-select-sm rounded-pill" style={{ width: 'auto' }} value={dateRangeFilter} onChange={(e) => setDateRangeFilter(e.target.value)}>
                    <option value="all">All Records</option>
                    <option value="30days">Past 30 Days</option>
                    <option value="90days">Past 90 Days</option>
                    <option value="6months">Past 6 Months</option>
                    <option value="1year">Past Year</option>
                    <option value="custom">Custom Range</option>
                  </select>
                  
                  {dateRangeFilter === "custom" && (
                    <>
                      <input type="date" className="form-control form-control-sm rounded-pill" style={{ width: 'auto' }} value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
                      <span className="text-muted">to</span>
                      <input type="date" className="form-control form-control-sm rounded-pill" style={{ width: 'auto' }} value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
                    </>
                  )}
                  
                  <span className="ms-auto text-muted small">{allVisits.length} records</span>
                </div>

                {/* Visit History Table */}
                <div className="bg-white rounded-4 shadow-sm overflow-hidden">
                  {allVisits.length === 0 ? (
                    <div className="text-center py-5">
                      <div className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '64px', height: '64px' }}>
                        <i className="ti ti-calendar-off fs-3 text-muted"></i>
                      </div>
                      <p className="text-muted mb-0">No visit records yet</p>
                    </div>
                  ) : (
                    <table className="table table-hover mb-0">
                      <thead style={{ backgroundColor: '#f8fafc' }}>
                        <tr>
                          <th className="border-0 py-3 ps-4" style={{ width: '180px' }}>Date</th>
                          <th className="border-0 py-3">Type</th>
                          <th className="border-0 py-3">Code</th>
                          <th className="border-0 py-3">Status</th>
                          <th className="border-0 py-3 pe-4 text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allVisits.map((item: any, idx: number) => {
                          const displayDate = new Date(item.sortTimestamp);
                          
                          let timeRange = '';
                          if (item.type === 'appointment') {
                            const startTime = new Date(item.data.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                            const endTime = new Date(item.data.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                            timeRange = `${startTime} - ${endTime}`;
                          } else {
                            let startTime = '';
                            let endTime = '';
                            
                            if (item.data.timeOfService) {
                              const [hours, minutes] = item.data.timeOfService.split(':');
                              const tempDate = new Date();
                              tempDate.setHours(parseInt(hours), parseInt(minutes));
                              startTime = tempDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                              
                              if (item.data.duration) {
                                const endDate = new Date(tempDate.getTime() + parseInt(item.data.duration) * 60000);
                                endTime = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                              }
                            } else if (item.data.startTime && item.data.endTime) {
                              startTime = new Date(item.data.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                              endTime = new Date(item.data.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                            }
                            
                            timeRange = endTime ? `${startTime} - ${endTime}` : startTime;
                          }
                          
                          return (
                          <tr key={idx} className="align-middle">
                            <td className="ps-4" style={{ whiteSpace: 'nowrap' }}>
                              <div className="fw-medium">
                                {displayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </div>
                              {timeRange && <div className="text-muted small">{timeRange}</div>}
                            </td>
                            <td>
                              {item.type === 'appointment' ? (
                                <span className="badge bg-primary-subtle text-primary rounded-pill">Visit #{item.sessionNumber}</span>
                              ) : item.data.noteType === 'progress_note' ? (
                                <span className="badge bg-success-subtle text-success rounded-pill">Visit #{item.sessionNumber}</span>
                              ) : item.data.noteType === 'chart_note' ? (
                                <span className="badge bg-secondary-subtle text-secondary rounded-pill">Chart Note</span>
                              ) : (
                                <span className="badge bg-info-subtle text-info rounded-pill">
                                  {item.data.noteType?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Note'}
                                </span>
                              )}
                            </td>
                            <td>
                              <code style={{ color: '#059669' }}>{item.data.title || item.data.cptCode || item.data.billingCode || '—'}</code>
                            </td>
                            <td>
                              {item.type === 'appointment' ? (
                                item.hasNote ? (
                                  item.note?.status === 'signed' ? (
                                    <span className="text-success small"><i className="ti ti-lock me-1"></i>Signed</span>
                                  ) : (
                                    <span className="small" style={{ color: '#b45309' }}><i className="ti ti-pencil me-1"></i>Draft</span>
                                  )
                                ) : item.data.appointmentStatus === 'cancelled' ? (
                                  <span className="text-muted small">Cancelled</span>
                                ) : (
                                  <span className="small" style={{ color: '#dc2626' }}><i className="ti ti-alert-circle me-1"></i>Needs Note</span>
                                )
                              ) : (
                                item.data.status === 'signed' ? (
                                  <span className="text-success small"><i className="ti ti-lock me-1"></i>Signed</span>
                                ) : (
                                  <span className="small" style={{ color: '#b45309' }}><i className="ti ti-pencil me-1"></i>Draft</span>
                                )
                              )}
                            </td>
                            <td className="pe-4 text-end">
                              {item.type === 'appointment' ? (
                                !item.hasNote && item.data.appointmentStatus !== 'cancelled' ? (
                                  <button 
                                    className="btn btn-sm btn-outline-primary rounded-pill"
                                    onClick={() => navigate(`/patients/${id}/add-progress-note?appointmentId=${item.data.id}&date=${item.data.startTime}`, { state: { newNote: true } })}
                                  >
                                    <i className="ti ti-plus me-1"></i>Add Note
                                  </button>
                                ) : item.note ? (
                                  item.note.status === 'signed' ? (
                                    // SIGNED: Open read-only modal + Download button
                                    <div className="d-flex gap-1 justify-content-end">
                                      <button 
                                        className="btn btn-sm btn-outline-secondary rounded-pill"
                                        onClick={() => { setSelectedNote(item.note); setShowNoteModal(true); }}
                                        title="View signed note"
                                      >
                                        <i className="ti ti-eye me-1"></i>View
                                      </button>
                                      <button 
                                        className="btn btn-sm btn-outline-primary rounded-pill"
                                        onClick={() => handleDownloadNotePDF(item.note)}
                                        title="Download PDF"
                                      >
                                        <i className="ti ti-download"></i>
                                      </button>
                                    </div>
                                  ) : (
                                    // DRAFT: Navigate to edit page
                                    <button 
                                      className="btn btn-sm btn-outline-warning rounded-pill"
                                      onClick={() => navigate(`/patients/${id}/add-progress-note`, { state: { draftData: item.note } })}
                                    >
                                      <i className="ti ti-pencil me-1"></i>Edit
                                    </button>
                                  )
                                ) : null
                              ) : item.data.noteType === 'progress_note' ? (
                                item.data.status === 'signed' ? (
                                  // SIGNED: Open read-only modal + Download button
                                  <div className="d-flex gap-1 justify-content-end">
                                    <button 
                                      className="btn btn-sm btn-outline-secondary rounded-pill"
                                      onClick={() => { setSelectedNote(item.data); setShowNoteModal(true); }}
                                      title="View signed note"
                                    >
                                      <i className="ti ti-eye me-1"></i>View
                                    </button>
                                    <button 
                                      className="btn btn-sm btn-outline-primary rounded-pill"
                                      onClick={() => handleDownloadNotePDF(item.data)}
                                      title="Download PDF"
                                    >
                                      <i className="ti ti-download"></i>
                                    </button>
                                  </div>
                                ) : (
                                  // DRAFT: Navigate to edit page
                                  <button 
                                    className="btn btn-sm btn-outline-warning rounded-pill"
                                    onClick={() => navigate(`/patients/${id}/add-progress-note`, { state: { draftData: item.data } })}
                                  >
                                    <i className="ti ti-pencil me-1"></i>Edit
                                  </button>
                                )
                              ) : (
                                <button 
                                  className="btn btn-sm btn-outline-secondary rounded-pill"
                                  onClick={() => { setSelectedNote(item.data); setShowNoteModal(true); }}
                                >
                                  <i className="ti ti-eye me-1"></i>View
                                </button>
                              )}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* CLINICAL TAB */}
            {activeTab === 'clinical' && (
              <div className="clinical-content">
                <div className="bg-white rounded-4 shadow-sm p-4">
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <h5 className="mb-0 fw-semibold">Clinical Information</h5>
                    {!isEditingClinical ? (
                      <button className="btn btn-outline-primary btn-sm rounded-pill" onClick={() => setIsEditingClinical(true)}>
                        <i className="ti ti-edit me-1"></i>Edit
                      </button>
                    ) : (
                      <div className="d-flex gap-2">
                        <button className="btn btn-outline-secondary btn-sm rounded-pill" onClick={() => setIsEditingClinical(false)}>Cancel</button>
                        <button className="btn btn-primary btn-sm rounded-pill" onClick={saveClinicalInfo}>
                          {savingClinical ? <span className="spinner-border spinner-border-sm"></span> : 'Save'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="row g-4">
                    <div className="col-md-6">
                      <label className="form-label small text-muted">Primary Diagnosis</label>
                      {isEditingClinical ? (
                        <div className="position-relative">
                          <input
                            type="text"
                            className="form-control rounded-3"
                            value={primaryDiagnosisSearch || (clinicalForm.primaryDiagnosisCode ? `${clinicalForm.primaryDiagnosisCode} - ${clinicalForm.primaryDiagnosisDescription}` : '')}
                            onChange={(e) => { setPrimaryDiagnosisSearch(e.target.value); setShowPrimaryDiagnosisDropdown(true); }}
                            onFocus={() => setShowPrimaryDiagnosisDropdown(true)}
                            placeholder="Search diagnosis code..."
                          />
                          {showPrimaryDiagnosisDropdown && primaryDiagnosisSearch && (
                            <div className="position-absolute w-100 bg-white border rounded-3 shadow-sm mt-1" style={{ zIndex: 1000, maxHeight: '200px', overflow: 'auto' }}>
                              {filteredPrimaryDiagnoses.map(d => (
                                <div key={d.code} className="p-2 cursor-pointer hover-bg-light" onClick={() => selectPrimaryDiagnosis(d)}>
                                  <strong>{d.code}</strong> - {d.description}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="mb-0">
                          {clinicalForm.primaryDiagnosisCode 
                            ? <><code style={{ color: '#059669' }}>{clinicalForm.primaryDiagnosisCode}</code> - {clinicalForm.primaryDiagnosisDescription}</>
                            : <span className="text-muted">Not specified</span>
                          }
                        </p>
                      )}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small text-muted">Secondary Diagnosis</label>
                      {isEditingClinical ? (
                        <div className="position-relative">
                          <input
                            type="text"
                            className="form-control rounded-3"
                            value={secondaryDiagnosisSearch || (clinicalForm.secondaryDiagnosisCode ? `${clinicalForm.secondaryDiagnosisCode} - ${clinicalForm.secondaryDiagnosisDescription}` : '')}
                            onChange={(e) => { setSecondaryDiagnosisSearch(e.target.value); setShowSecondaryDiagnosisDropdown(true); }}
                            onFocus={() => setShowSecondaryDiagnosisDropdown(true)}
                            placeholder="Search diagnosis code..."
                          />
                          {showSecondaryDiagnosisDropdown && secondaryDiagnosisSearch && (
                            <div className="position-absolute w-100 bg-white border rounded-3 shadow-sm mt-1" style={{ zIndex: 1000, maxHeight: '200px', overflow: 'auto' }}>
                              {filteredSecondaryDiagnoses.map(d => (
                                <div key={d.code} className="p-2 cursor-pointer hover-bg-light" onClick={() => selectSecondaryDiagnosis(d)}>
                                  <strong>{d.code}</strong> - {d.description}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="mb-0">
                          {clinicalForm.secondaryDiagnosisCode 
                            ? <><code style={{ color: '#059669' }}>{clinicalForm.secondaryDiagnosisCode}</code> - {clinicalForm.secondaryDiagnosisDescription}</>
                            : <span className="text-muted">Not specified</span>
                          }
                        </p>
                      )}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small text-muted">Rendering Provider</label>
                      {isEditingClinical ? (
                        <input type="text" className="form-control rounded-3" value={clinicalForm.renderingProviderName} onChange={(e) => setClinicalForm({...clinicalForm, renderingProviderName: e.target.value})} placeholder="Provider name" />
                      ) : (
                        <p className="mb-0">{clinicalForm.renderingProviderName || <span className="text-muted">Not specified</span>}</p>
                      )}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small text-muted">Provider NPI</label>
                      {isEditingClinical ? (
                        <input type="text" className="form-control rounded-3" value={clinicalForm.renderingProviderNpi} onChange={(e) => setClinicalForm({...clinicalForm, renderingProviderNpi: e.target.value})} placeholder="NPI number" />
                      ) : (
                        <p className="mb-0">{clinicalForm.renderingProviderNpi || <span className="text-muted">Not specified</span>}</p>
                      )}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small text-muted">Current Medications</label>
                      {isEditingClinical ? (
                        <textarea className="form-control rounded-3" rows={3} value={clinicalForm.currentMedications} onChange={(e) => setClinicalForm({...clinicalForm, currentMedications: e.target.value})} placeholder="List current medications..." />
                      ) : (
                        <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>{clinicalForm.currentMedications || <span className="text-muted">None listed</span>}</p>
                      )}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small text-muted">Allergies</label>
                      {isEditingClinical ? (
                        <textarea className="form-control rounded-3" rows={3} value={clinicalForm.allergies} onChange={(e) => setClinicalForm({...clinicalForm, allergies: e.target.value})} placeholder="List known allergies..." />
                      ) : (
                        <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>{clinicalForm.allergies || <span className="text-muted">None listed</span>}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* INSURANCE TAB */}
            {activeTab === 'insurance' && (
              <div className="insurance-content">
                <div className="bg-white rounded-4 shadow-sm p-4">
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <h5 className="mb-0 fw-semibold">Insurance Coverage</h5>
                    {!isEditingInsurance ? (
                      <button className="btn btn-outline-primary btn-sm rounded-pill" onClick={() => setIsEditingInsurance(true)}>
                        <i className="ti ti-edit me-1"></i>Edit
                      </button>
                    ) : (
                      <div className="d-flex gap-2">
                        <button className="btn btn-outline-secondary btn-sm rounded-pill" onClick={() => setIsEditingInsurance(false)}>Cancel</button>
                        <button className="btn btn-primary btn-sm rounded-pill" onClick={saveInsurance}>
                          {savingInsurance ? <span className="spinner-border spinner-border-sm"></span> : 'Save'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="row g-4">
                    <div className="col-md-6">
                      <label className="form-label small text-muted">Insurance Carrier</label>
                      {isEditingInsurance ? (
                        <select className="form-select rounded-3" value={insuranceForm.payerId} onChange={(e) => {
                          const payer = COMMON_PAYERS.find(p => p.id === e.target.value);
                          setInsuranceForm({ ...insuranceForm, payerId: e.target.value, carrier: payer?.name || '' });
                        }}>
                          <option value="">Select carrier...</option>
                          {COMMON_PAYERS.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                        </select>
                      ) : (
                        <p className="mb-0">{insuranceForm.carrier || <span className="text-muted">Not specified</span>}</p>
                      )}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small text-muted">Payer ID</label>
                      {isEditingInsurance ? (
                        <input type="text" className="form-control rounded-3" value={insuranceForm.payerId} onChange={(e) => setInsuranceForm({...insuranceForm, payerId: e.target.value})} placeholder="Payer ID" />
                      ) : (
                        <p className="mb-0"><code>{insuranceForm.payerId || <span className="text-muted">—</span>}</code></p>
                      )}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small text-muted">Member ID</label>
                      {isEditingInsurance ? (
                        <input type="text" className="form-control rounded-3" value={insuranceForm.memberId} onChange={(e) => setInsuranceForm({...insuranceForm, memberId: e.target.value})} placeholder="Member ID" />
                      ) : (
                        <p className="mb-0">{insuranceForm.memberId || <span className="text-muted">Not specified</span>}</p>
                      )}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small text-muted">Group Number</label>
                      {isEditingInsurance ? (
                        <input type="text" className="form-control rounded-3" value={insuranceForm.groupNumber} onChange={(e) => setInsuranceForm({...insuranceForm, groupNumber: e.target.value})} placeholder="Group number" />
                      ) : (
                        <p className="mb-0">{insuranceForm.groupNumber || <span className="text-muted">Not specified</span>}</p>
                      )}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small text-muted">Policy Holder Name</label>
                      {isEditingInsurance ? (
                        <input type="text" className="form-control rounded-3" value={insuranceForm.policyHolderName} onChange={(e) => setInsuranceForm({...insuranceForm, policyHolderName: e.target.value})} placeholder="Policy holder name" />
                      ) : (
                        <p className="mb-0">{insuranceForm.policyHolderName || <span className="text-muted">Not specified</span>}</p>
                      )}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small text-muted">Relationship to Policy Holder</label>
                      {isEditingInsurance ? (
                        <select className="form-select rounded-3" value={insuranceForm.policyHolderRelationship} onChange={(e) => setInsuranceForm({...insuranceForm, policyHolderRelationship: e.target.value})}>
                          <option value="">Select...</option>
                          <option value="self">Self</option>
                          <option value="spouse">Spouse</option>
                          <option value="child">Child</option>
                          <option value="other">Other</option>
                        </select>
                      ) : (
                        <p className="mb-0">{insuranceForm.policyHolderRelationship || <span className="text-muted">Not specified</span>}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* BILLING TAB */}
            {activeTab === 'billing' && (
              <div className="billing-content">
                <div className="row g-4">
                  <div className="col-md-4">
                    <div className="bg-white rounded-4 shadow-sm p-4 text-center">
                      <div className="text-muted small mb-2">Outstanding Balance</div>
                      <div className={`fs-3 fw-bold ${clientBalance > 0 ? 'text-danger' : 'text-success'}`}>
                        {formatCurrency(clientBalance)}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="bg-white rounded-4 shadow-sm p-4 text-center">
                      <div className="text-muted small mb-2">Pending Claims</div>
                      <div className="fs-3 fw-bold" style={{ color: '#b45309' }}>{unpaidInvoices.length}</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="bg-white rounded-4 shadow-sm p-4 text-center">
                      <Link to={`/insurance/add-payment/${id}`} className="btn btn-primary rounded-pill w-100">
                        <i className="ti ti-plus me-2"></i>Record Payment
                      </Link>
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm overflow-hidden">
                      <div className="p-4 border-bottom">
                        <h5 className="mb-0 fw-semibold">Payment History</h5>
                      </div>
                      {invoices.length === 0 ? (
                        <div className="text-center py-5">
                          <i className="ti ti-receipt-off fs-1 text-muted mb-2 d-block"></i>
                          <p className="text-muted">No payment records</p>
                        </div>
                      ) : (
                        <table className="table table-hover mb-0">
                          <thead style={{ backgroundColor: '#f8fafc' }}>
                            <tr>
                              <th className="border-0 py-3 ps-4">Date</th>
                              <th className="border-0 py-3">Description</th>
                              <th className="border-0 py-3">Amount</th>
                              <th className="border-0 py-3 pe-4">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoices.map((inv: any, idx: number) => (
                              <tr key={idx}>
                                <td className="ps-4">{formatDate(inv.createdAt || inv.date)}</td>
                                <td>{inv.description || 'Service charge'}</td>
                                <td>{formatCurrency(inv.amount)}</td>
                                <td className="pe-4">
                                  <span className={`badge rounded-pill ${inv.status === 'paid' ? 'bg-success-subtle text-success' : 'bg-warning-subtle'}`} style={inv.status !== 'paid' ? { color: '#b45309' } : {}}>
                                    {inv.status || 'Pending'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FILES TAB */}
            {activeTab === 'files' && (
              <div className="files-content">
                <div className="bg-white rounded-4 shadow-sm p-4">
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <h5 className="mb-0 fw-semibold">Documents</h5>
                    <label className="btn btn-primary btn-sm rounded-pill mb-0">
                      <i className="ti ti-upload me-1"></i>Upload
                      <input type="file" className="d-none" onChange={handleFileUpload} disabled={uploadingFile} />
                    </label>
                  </div>

                  {files.length === 0 ? (
                    <div className="text-center py-5">
                      <div className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '64px', height: '64px' }}>
                        <i className="ti ti-folder-off fs-3 text-muted"></i>
                      </div>
                      <p className="text-muted mb-0">No documents uploaded</p>
                    </div>
                  ) : (
                    <div className="row g-3">
                      {files.map((file: any, idx: number) => (
                        <div key={idx} className="col-md-4">
                          <div className="border rounded-3 p-3 d-flex align-items-center gap-3">
                            <div className="rounded-2 bg-primary-subtle text-primary d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                              <i className="ti ti-file-text"></i>
                            </div>
                            <div className="flex-grow-1 overflow-hidden">
                              <div className="fw-medium text-truncate">{file.name}</div>
                              <div className="text-muted small">{file.size}</div>
                            </div>
                            <a href={file.url} target="_blank" className="btn btn-sm btn-outline-secondary rounded-pill">
                              <i className="ti ti-download"></i>
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CLIENT DRAWER */}
        {showClientDrawer && (
          <>
            <div className="position-fixed top-0 start-0 w-100 h-100" style={{ backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 1040 }} onClick={() => setShowClientDrawer(false)}></div>
            <div className="position-fixed top-0 end-0 h-100 bg-white shadow-lg" style={{ width: '400px', zIndex: 1050, overflowY: 'auto' }}>
              <div className="p-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h5 className="mb-0 fw-semibold">Client Profile</h5>
                  <button className="btn btn-close" onClick={() => setShowClientDrawer(false)}></button>
                </div>

                <div className="text-center mb-4">
                  <div className="rounded-circle d-inline-flex align-items-center justify-content-center text-white fw-bold mb-3" style={{ width: '80px', height: '80px', backgroundColor: '#059669', fontSize: '28px' }}>
                    {patient.firstName?.charAt(0)}{patient.lastName?.charAt(0)}
                  </div>
                  <h4 className="mb-1">{patient.firstName} {patient.lastName}</h4>
                  <p className="text-muted mb-0">{formatDate(clientDob)} {age !== null && `(${age} y/o)`}</p>
                </div>

                <hr />

                <div className="mb-4">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="mb-0 text-muted">Contact Information</h6>
                    {!isEditingClientInfo ? (
                      <button className="btn btn-sm btn-link p-0" onClick={() => setIsEditingClientInfo(true)}>Edit</button>
                    ) : (
                      <div className="d-flex gap-2">
                        <button className="btn btn-sm btn-link p-0" onClick={() => setIsEditingClientInfo(false)}>Cancel</button>
                        <button className="btn btn-sm btn-link p-0" onClick={saveClientInfo}>{savingClientInfo ? '...' : 'Save'}</button>
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="form-label small text-muted mb-1">Phone</label>
                    {isEditingClientInfo ? (
                      <input type="tel" className="form-control rounded-3" value={clientInfoForm.phone} onChange={(e) => setClientInfoForm({...clientInfoForm, phone: e.target.value})} />
                    ) : (
                      <p className="mb-0">{clientInfoForm.phone || <span className="text-muted">Not provided</span>}</p>
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="form-label small text-muted mb-1">Email</label>
                    {isEditingClientInfo ? (
                      <input type="email" className="form-control rounded-3" value={clientInfoForm.email} onChange={(e) => setClientInfoForm({...clientInfoForm, email: e.target.value})} />
                    ) : (
                      <p className="mb-0">{clientInfoForm.email || <span className="text-muted">Not provided</span>}</p>
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="form-label small text-muted mb-1">Address</label>
                    {isEditingClientInfo ? (
                      <>
                        <input type="text" className="form-control rounded-3 mb-2" value={clientInfoForm.address1} onChange={(e) => setClientInfoForm({...clientInfoForm, address1: e.target.value})} placeholder="Street address" />
                        <div className="row g-2">
                          <div className="col-5">
                            <input type="text" className="form-control rounded-3" value={clientInfoForm.city} onChange={(e) => setClientInfoForm({...clientInfoForm, city: e.target.value})} placeholder="City" />
                          </div>
                          <div className="col-3">
                            <input type="text" className="form-control rounded-3" value={clientInfoForm.state} onChange={(e) => setClientInfoForm({...clientInfoForm, state: e.target.value})} placeholder="State" maxLength={2} />
                          </div>
                          <div className="col-4">
                            <input type="text" className="form-control rounded-3" value={clientInfoForm.postalCode} onChange={(e) => setClientInfoForm({...clientInfoForm, postalCode: e.target.value})} placeholder="ZIP" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="mb-0">
                        {clientInfoForm.address1 || clientInfoForm.city 
                          ? `${clientInfoForm.address1 || ''} ${clientInfoForm.city || ''}${clientInfoForm.city && clientInfoForm.state ? ', ' : ''}${clientInfoForm.state || ''} ${clientInfoForm.postalCode || ''}`
                          : <span className="text-muted">Not provided</span>
                        }
                      </p>
                    )}
                  </div>
                </div>

                <hr />

                <div className="mb-4">
                  <h6 className="mb-3 text-muted">Demographics</h6>
                  
                  <div className="mb-3">
                    <label className="form-label small text-muted mb-1">Gender</label>
                    {isEditingClientInfo ? (
                      <select className="form-select rounded-3" value={clientInfoForm.gender} onChange={(e) => setClientInfoForm({...clientInfoForm, gender: e.target.value})}>
                        <option value="">Select...</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Non-binary">Non-binary</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    ) : (
                      <p className="mb-0">{clientInfoForm.gender || <span className="text-muted">Not specified</span>}</p>
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="form-label small text-muted mb-1">Pronouns</label>
                    {isEditingClientInfo ? (
                      <select className="form-select rounded-3" value={clientInfoForm.pronouns} onChange={(e) => setClientInfoForm({...clientInfoForm, pronouns: e.target.value})}>
                        <option value="">Select...</option>
                        <option value="He/Him">He/Him</option>
                        <option value="She/Her">She/Her</option>
                        <option value="They/Them">They/Them</option>
                        <option value="Other">Other</option>
                      </select>
                    ) : (
                      <p className="mb-0">{clientInfoForm.pronouns || <span className="text-muted">Not specified</span>}</p>
                    )}
                  </div>
                </div>

                <hr />

                {/* Upcoming Appointments */}
                <div className="mb-4">
                  <h6 className="mb-3 text-muted">Upcoming Appointments</h6>
                  {upcomingAppointments.length === 0 ? (
                    <p className="text-muted small text-center py-3">No upcoming appointments scheduled</p>
                  ) : (
                    <div className="list-group list-group-flush">
                      {upcomingAppointments.slice(0, 5).map((apt: any, idx: number) => (
                        <div key={idx} className="list-group-item px-0 py-2">
                          <div className="d-flex justify-content-between align-items-start">
                            <div>
                              <div className="fw-medium">
                                {new Date(apt.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              </div>
                              <div className="text-muted small">
                                {new Date(apt.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} - {new Date(apt.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                              </div>
                            </div>
                            <span className="badge bg-primary-subtle text-primary rounded-pill small">
                              {apt.title || 'Session'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {upcomingAppointments.length > 5 && (
                    <p className="text-muted small text-center mt-2">
                      +{upcomingAppointments.length - 5} more appointments
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* BILLING DRAWER */}
        {showBillingDrawer && (
          <>
            <div className="position-fixed top-0 start-0 w-100 h-100" style={{ backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 1040 }} onClick={() => setShowBillingDrawer(false)}></div>
            <div className="position-fixed top-0 end-0 h-100 bg-white shadow-lg" style={{ width: '400px', zIndex: 1050, overflowY: 'auto' }}>
              <div className="p-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h5 className="mb-0 fw-semibold">Billing Summary</h5>
                  <button className="btn btn-close" onClick={() => setShowBillingDrawer(false)}></button>
                </div>

                <div className="rounded-4 p-4 mb-4" style={{ backgroundColor: clientBalance > 0 ? '#fef2f2' : '#f0fdf4' }}>
                  <div className="text-center">
                    <div className="text-muted small mb-1">Current Balance</div>
                    <div className={`fs-2 fw-bold ${clientBalance > 0 ? 'text-danger' : 'text-success'}`}>
                      {formatCurrency(clientBalance)}
                    </div>
                  </div>
                </div>

                <Link to={`/insurance/add-payment/${id}`} className="btn btn-primary w-100 rounded-pill mb-4">
                  <i className="ti ti-plus me-2"></i>Record Payment
                </Link>

                <hr />

                <h6 className="mb-3 text-muted">Recent Activity</h6>
                {invoices.length === 0 ? (
                  <p className="text-muted text-center py-3">No billing activity</p>
                ) : (
                  <div className="list-group list-group-flush">
                    {invoices.slice(0, 5).map((inv: any, idx: number) => (
                      <div key={idx} className="list-group-item px-0 d-flex justify-content-between">
                        <div>
                          <div className="fw-medium">{formatDate(inv.createdAt || inv.date)}</div>
                          <div className="text-muted small">{inv.description || 'Service'}</div>
                        </div>
                        <div className="text-end">
                          <div className="fw-medium">{formatCurrency(inv.amount)}</div>
                          <span className={`badge rounded-pill small ${inv.status === 'paid' ? 'bg-success' : 'bg-warning'}`}>
                            {inv.status || 'Pending'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* NOTE PREVIEW MODAL - Enhanced for Progress Notes */}
        {showNoteModal && selectedNote && (
          <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowNoteModal(false)}>
            <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content rounded-4">
                <div className="modal-header border-0 pb-0">
                  <div>
                    <h5 className="modal-title fw-semibold">
                      {selectedNote.noteType === 'chart_note' ? 'Chart Note' : 
                       selectedNote.noteType === 'progress_note' ? 'Progress Note' : 
                       selectedNote.noteType?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Note'}
                    </h5>
                    <p className="text-muted small mb-0">
                      {formatDate(selectedNote.sessionDate || selectedNote.dateOfService || selectedNote.createdAt)}
                      {selectedNote.status === 'signed' && <span className="ms-2 badge bg-success-subtle text-success"><i className="ti ti-lock me-1"></i>Signed & Locked</span>}
                      {selectedNote.status !== 'signed' && <span className="ms-2 badge bg-warning-subtle" style={{ color: '#b45309' }}><i className="ti ti-pencil me-1"></i>Draft</span>}
                    </p>
                  </div>
                  <button type="button" className="btn-close" onClick={() => setShowNoteModal(false)}></button>
                </div>
                <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                  {/* Session Details */}
                  <div className="row mb-4">
                    <div className="col-md-6">
                      <div className="bg-light rounded-3 p-3">
                        <h6 className="text-muted small mb-2">SESSION DETAILS</h6>
                        <div className="row g-2">
                          <div className="col-6">
                            <div className="small text-muted">Date</div>
                            <div className="fw-medium">{formatDate(selectedNote.sessionDate || selectedNote.dateOfService || selectedNote.createdAt)}</div>
                          </div>
                          <div className="col-6">
                            <div className="small text-muted">Time</div>
                            <div className="fw-medium">{selectedNote.timeOfService || selectedNote.sessionTime || formatTime(selectedNote.startTime || selectedNote.sessionDate) || '—'}</div>
                          </div>
                          <div className="col-6">
                            <div className="small text-muted">Duration</div>
                            <div className="fw-medium">{selectedNote.duration ? `${selectedNote.duration} min` : '—'}</div>
                          </div>
                          <div className="col-6">
                            <div className="small text-muted">Session Type</div>
                            <div className="fw-medium">{selectedNote.sessionType || selectedNote.serviceType || '—'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="bg-light rounded-3 p-3">
                        <h6 className="text-muted small mb-2">BILLING</h6>
                        <div className="row g-2">
                          <div className="col-6">
                            <div className="small text-muted">CPT Code</div>
                            <div className="fw-medium"><code className="text-primary">{selectedNote.cptCode || selectedNote.billingCode || '—'}</code></div>
                          </div>
                          <div className="col-6">
                            <div className="small text-muted">Provider</div>
                            <div className="fw-medium">{selectedNote.clinicianName || selectedNote.signedBy || '—'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Diagnosis */}
                  {selectedNote.diagnosis && (
                    <div className="mb-4">
                      <h6 className="text-muted small mb-2">DIAGNOSIS</h6>
                      <div className="bg-primary-subtle rounded-3 p-3" style={{ borderLeft: '4px solid #059669' }}>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{selectedNote.diagnosis}</div>
                      </div>
                    </div>
                  )}

                  {/* Clinical Content - SOAP/DAP/BIRP or freeform */}
                  <div className="mb-4">
                    <h6 className="text-muted small mb-2">CLINICAL DOCUMENTATION {selectedNote.noteStyle && `(${selectedNote.noteStyle.toUpperCase()})`}</h6>
                    <div className="bg-light rounded-3 p-3">
                      {selectedNote.noteStyle === 'soap' ? (
                        <>
                          {selectedNote.subjective && <div className="mb-3"><strong>Subjective:</strong><div style={{ whiteSpace: 'pre-wrap' }}>{selectedNote.subjective}</div></div>}
                          {selectedNote.objective && <div className="mb-3"><strong>Objective:</strong><div style={{ whiteSpace: 'pre-wrap' }}>{selectedNote.objective}</div></div>}
                          {selectedNote.assessment && <div className="mb-3"><strong>Assessment:</strong><div style={{ whiteSpace: 'pre-wrap' }}>{selectedNote.assessment}</div></div>}
                          {selectedNote.plan && <div className="mb-3"><strong>Plan:</strong><div style={{ whiteSpace: 'pre-wrap' }}>{selectedNote.plan}</div></div>}
                        </>
                      ) : selectedNote.noteStyle === 'dap' ? (
                        <>
                          {selectedNote.data && <div className="mb-3"><strong>Data:</strong><div style={{ whiteSpace: 'pre-wrap' }}>{selectedNote.data}</div></div>}
                          {selectedNote.assessment && <div className="mb-3"><strong>Assessment:</strong><div style={{ whiteSpace: 'pre-wrap' }}>{selectedNote.assessment}</div></div>}
                          {selectedNote.plan && <div className="mb-3"><strong>Plan:</strong><div style={{ whiteSpace: 'pre-wrap' }}>{selectedNote.plan}</div></div>}
                        </>
                      ) : selectedNote.noteStyle === 'birp' ? (
                        <>
                          {selectedNote.behavior && <div className="mb-3"><strong>Behavior:</strong><div style={{ whiteSpace: 'pre-wrap' }}>{selectedNote.behavior}</div></div>}
                          {selectedNote.intervention && <div className="mb-3"><strong>Intervention:</strong><div style={{ whiteSpace: 'pre-wrap' }}>{selectedNote.intervention}</div></div>}
                          {selectedNote.response && <div className="mb-3"><strong>Response:</strong><div style={{ whiteSpace: 'pre-wrap' }}>{selectedNote.response}</div></div>}
                          {selectedNote.plan && <div className="mb-3"><strong>Plan:</strong><div style={{ whiteSpace: 'pre-wrap' }}>{selectedNote.plan}</div></div>}
                        </>
                      ) : (
                        <div style={{ whiteSpace: 'pre-wrap' }}>{selectedNote.content || selectedNote.chartNoteContent || 'No content'}</div>
                      )}
                    </div>
                  </div>

                  {/* Mental Status Exam */}
                  {(selectedNote.appearance?.length > 0 || selectedNote.mood || selectedNote.affect?.length > 0) && (
                    <div className="mb-4">
                      <h6 className="text-muted small mb-2">MENTAL STATUS EXAMINATION</h6>
                      <div className="row g-2">
                        {selectedNote.appearance?.length > 0 && (
                          <div className="col-md-4"><div className="bg-light rounded-3 p-2"><div className="small text-muted">Appearance</div><div>{selectedNote.appearance.join(', ')}</div></div></div>
                        )}
                        {selectedNote.behavior?.length > 0 && (
                          <div className="col-md-4"><div className="bg-light rounded-3 p-2"><div className="small text-muted">Behavior</div><div>{selectedNote.behavior.join(', ')}</div></div></div>
                        )}
                        {selectedNote.speech?.length > 0 && (
                          <div className="col-md-4"><div className="bg-light rounded-3 p-2"><div className="small text-muted">Speech</div><div>{selectedNote.speech.join(', ')}</div></div></div>
                        )}
                        {selectedNote.mood && (
                          <div className="col-md-4"><div className="bg-light rounded-3 p-2"><div className="small text-muted">Mood</div><div>{selectedNote.mood}</div></div></div>
                        )}
                        {selectedNote.affect?.length > 0 && (
                          <div className="col-md-4"><div className="bg-light rounded-3 p-2"><div className="small text-muted">Affect</div><div>{selectedNote.affect.join(', ')}</div></div></div>
                        )}
                        {selectedNote.thoughtProcess?.length > 0 && (
                          <div className="col-md-4"><div className="bg-light rounded-3 p-2"><div className="small text-muted">Thought Process</div><div>{selectedNote.thoughtProcess.join(', ')}</div></div></div>
                        )}
                        {selectedNote.insight && (
                          <div className="col-md-4"><div className="bg-light rounded-3 p-2"><div className="small text-muted">Insight</div><div>{selectedNote.insight}</div></div></div>
                        )}
                        {selectedNote.judgment && (
                          <div className="col-md-4"><div className="bg-light rounded-3 p-2"><div className="small text-muted">Judgment</div><div>{selectedNote.judgment}</div></div></div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Risk Assessment */}
                  {(selectedNote.suicidalIdeation || selectedNote.homicidalIdeation || selectedNote.selfHarmBehavior) && (
                    <div className="mb-4">
                      <h6 className="text-muted small mb-2">RISK ASSESSMENT</h6>
                      <div className="row g-2">
                        <div className="col-md-4">
                          <div className="bg-light rounded-3 p-2">
                            <div className="small text-muted">Suicidal Ideation</div>
                            <div className={selectedNote.suicidalIdeation === 'Denied' ? 'text-success' : 'text-danger fw-bold'}>{selectedNote.suicidalIdeation || 'Denied'}</div>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="bg-light rounded-3 p-2">
                            <div className="small text-muted">Homicidal Ideation</div>
                            <div className={selectedNote.homicidalIdeation === 'Denied' ? 'text-success' : 'text-danger fw-bold'}>{selectedNote.homicidalIdeation || 'Denied'}</div>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="bg-light rounded-3 p-2">
                            <div className="small text-muted">Self-Harm</div>
                            <div className={selectedNote.selfHarmBehavior === 'Denied' ? 'text-success' : 'text-danger fw-bold'}>{selectedNote.selfHarmBehavior || 'Denied'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Treatment Goals */}
                  {selectedNote.treatmentGoals && (
                    <div className="mb-4">
                      <h6 className="text-muted small mb-2">TREATMENT GOALS</h6>
                      <div className="bg-light rounded-3 p-3" style={{ whiteSpace: 'pre-wrap' }}>{selectedNote.treatmentGoals}</div>
                    </div>
                  )}

                  {/* Signature Block */}
                  {selectedNote.status === 'signed' && selectedNote.signedBy && (
                    <div className="bg-success-subtle rounded-3 p-3 mt-4" style={{ borderLeft: '4px solid #16a34a' }}>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="text-success fw-bold"><i className="ti ti-check me-1"></i>Electronically Signed</div>
                          <div className="fw-medium">{selectedNote.signedBy}</div>
                          {selectedNote.providerLicense && <div className="small text-muted">{selectedNote.providerLicense}</div>}
                        </div>
                        <div className="text-end">
                          <div className="small text-muted">Signed on</div>
                          <div>{formatDate(selectedNote.signedAt)} at {formatTime(selectedNote.signedAt)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button 
                    className="btn btn-outline-primary rounded-pill"
                    onClick={() => handleDownloadNotePDF(selectedNote)}
                  >
                    <i className="ti ti-download me-1"></i>Download PDF
                  </button>
                  <button 
                    className="btn btn-outline-secondary rounded-pill"
                    onClick={() => {
                      const printWindow = window.open('', '_blank');
                      if (printWindow) {
                        const content = generateProfessionalNoteHTML(selectedNote, patient, locationName);
                        printWindow.document.write(content);
                        printWindow.document.close();
                      }
                    }}
                  >
                    <i className="ti ti-printer me-1"></i>Print Preview
                  </button>
                  {selectedNote.status !== 'signed' && (
                    <button 
                      className="btn btn-primary rounded-pill"
                      onClick={() => {
                        setShowNoteModal(false);
                        navigate(`/patients/${id}/add-progress-note`, { state: { draftData: selectedNote } });
                      }}
                    >
                      <i className="ti ti-edit me-1"></i>Edit
                    </button>
                  )}
                  <button className="btn btn-secondary rounded-pill" onClick={() => setShowNoteModal(false)}>Close</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .nav-pills .nav-link { color: #64748b; padding: 10px 16px; font-size: 14px; }
        .nav-pills .nav-link:hover { background-color: #f1f5f9; }
        .nav-pills .nav-link.active { background-color: #059669; color: white; }
        .cursor-pointer { cursor: pointer; }
        .hover-bg-light:hover { background-color: #f8fafc; }
        .rounded-4 { border-radius: 16px !important; }
        .bg-primary-subtle { background-color: #d1fae5 !important; }
        .bg-success-subtle { background-color: #dcfce7 !important; }
        .bg-warning-subtle { background-color: #fef3c7 !important; }
        .bg-secondary-subtle { background-color: #f1f5f9 !important; }
        .bg-info-subtle { background-color: #e0f2fe !important; }
        .text-primary { color: #059669 !important; }
        .btn-primary { background-color: #059669; border-color: #059669; }
        .btn-primary:hover { background-color: #047857; border-color: #047857; }
        .btn-outline-primary { color: #059669; border-color: #059669; }
        .btn-outline-primary:hover { background-color: #059669; color: white; }
        .avatar-green { background-color: #059669 !important; }
      `}</style>
    </div>
  );
};

export default PatientDetails;