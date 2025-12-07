import { Link, useNavigate, useSearchParams } from "react-router-dom";
import CommonFooter from "../../../components/common-footer/commonFooter";
import { all_routes } from "../../../routes/all_routes";
import { useState, useEffect } from "react";
import axios from 'axios';
import config from '../../../config';
import { useAuth } from '../../../contexts/AuthContext';

const API_URL = config.apiUrl;
const LOCATION_ID = config.ghlLocationId;

interface FormDataType {
  chiefComplaint: string;
  referralSource: string;
  presentingProblem: string;
  onsetDuration: string;
  previousTreatment: string;
  currentMedications: string;
  appearance: string[];
  behavior: string[];
  speech: string[];
  mood: string;
  affect: string[];
  thoughtProcess: string[];
  thoughtContent: string[];
  perceptions: string[];
  cognition: {
    oriented: string[];
    memory: string;
    concentration: string;
    insight: string;
    judgment: string;
  };
  suicidalIdeation: string;
  suicidalPlan: string;
  homicidalIdeation: string;
  homicidalPlan: string;
  selfHarmBehavior: string;
  psychiatricHistory: string;
  medicalHistory: string;
  substanceUseHistory: string;
  familyHistory: string;
  socialHistory: string;
  legalHistory: string;
  diagnosisAxis1: string;
  diagnosisAxis2: string;
  diagnosisAxis3: string;
  treatmentGoals: string;
  interventions: string[];
  frequency: string;
  estimatedDuration: string;
  clinicalImpression: string;
  prognosis: string;
  additionalNotes: string;
}

const InitialAssessment = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  const appointmentId = searchParams.get('appointmentId');
  const patientId = searchParams.get('patientId');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<any>(null);
  const [ipAddress, setIpAddress] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  const [sessionInfo, setSessionInfo] = useState({
    sessionNumber: 1,
    sessionDate: new Date().toISOString().split('T')[0],
    sessionTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    duration: 60,
    cptCode: '90791'
  });

  const [timestamps, setTimestamps] = useState({
    created: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    signedAt: null as string | null
  });

  const [formData, setFormData] = useState<FormDataType>({
    chiefComplaint: '',
    referralSource: '',
    presentingProblem: '',
    onsetDuration: '',
    previousTreatment: '',
    currentMedications: '',
    appearance: [],
    behavior: [],
    speech: [],
    mood: '',
    affect: [],
    thoughtProcess: [],
    thoughtContent: [],
    perceptions: [],
    cognition: {
      oriented: [],
      memory: '',
      concentration: '',
      insight: '',
      judgment: ''
    },
    suicidalIdeation: 'none',
    suicidalPlan: '',
    homicidalIdeation: 'none',
    homicidalPlan: '',
    selfHarmBehavior: 'none',
    psychiatricHistory: '',
    medicalHistory: '',
    substanceUseHistory: '',
    familyHistory: '',
    socialHistory: '',
    legalHistory: '',
    diagnosisAxis1: '',
    diagnosisAxis2: '',
    diagnosisAxis3: '',
    treatmentGoals: '',
    interventions: [],
    frequency: '',
    estimatedDuration: '',
    clinicalImpression: '',
    prognosis: '',
    additionalNotes: ''
  });

  // Helper function to get credentials
  const getCredentials = () => {
    return 'LMFT';
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!isLocked) {
      const autoSaveInterval = setInterval(() => {
        handleAutoSave();
      }, 30000);
      
      return () => clearInterval(autoSaveInterval);
    }
  }, [formData, isLocked]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      if (patientId) {
        const patientResponse = await axios.get(`${API_URL}/api/patients/${patientId}`, {
          params: { locationId: LOCATION_ID }
        });
        setPatient(patientResponse.data.patient);
      }

      if (appointmentId) {
        const appointmentResponse = await axios.get(`${API_URL}/api/appointments/${appointmentId}`, {
          params: { locationId: LOCATION_ID }
        });
        
        if (appointmentResponse.data.appointment) {
          const apt = appointmentResponse.data.appointment;
          setSessionInfo({
            sessionNumber: 1,
            sessionDate: new Date(apt.startTime).toISOString().split('T')[0],
            sessionTime: new Date(apt.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            duration: 60,
            cptCode: '90791'
          });
        }
      }

      const ipResponse = await axios.get(`${API_URL}/api/get-ip`);
      setIpAddress(ipResponse.data.ip);

    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to load patient/appointment data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof FormDataType, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    updateTimestamp();
  };

  const handleCheckboxChange = (field: keyof FormDataType, value: string) => {
    const currentValue = formData[field];
    if (Array.isArray(currentValue)) {
      setFormData(prev => ({
        ...prev,
        [field]: currentValue.includes(value)
          ? currentValue.filter(item => item !== value)
          : [...currentValue, value]
      }));
      updateTimestamp();
    }
  };

  const handleCognitionChange = (field: keyof FormDataType['cognition'], value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      cognition: {
        ...prev.cognition,
        [field]: value
      }
    }));
    updateTimestamp();
  };

  const updateTimestamp = () => {
    setTimestamps(prev => ({
      ...prev,
      lastUpdated: new Date().toISOString()
    }));
  };

  const handleAutoSave = async () => {
    if (isLocked) return;
    
    try {
      const noteData = {
        type: 'initial-assessment',
        patientId,
        appointmentId,
        sessionInfo,
        formData,
        timestamps,
        status: 'draft',
        therapist: {
          name: `${user?.firstName} ${user?.lastName}`,
          credentials: getCredentials(),
          id: user?.id
        }
      };

      await axios.post(`${API_URL}/api/notes/save`, {
        locationId: LOCATION_ID,
        contactId: patientId,
        noteData
      });
      
      console.log('✅ Auto-saved at', new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const noteData = {
        type: 'initial-assessment',
        patientId,
        appointmentId,
        sessionInfo,
        formData,
        timestamps,
        status: 'draft',
        therapist: {
          name: `${user?.firstName} ${user?.lastName}`,
          credentials: getCredentials(),
          id: user?.id
        }
      };

      await axios.post(`${API_URL}/api/notes/save`, {
        locationId: LOCATION_ID,
        contactId: patientId,
        noteData
      });
      
      alert('Draft saved successfully!');
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleSignAndLock = async () => {
    if (!confirm('Once signed and locked, this note cannot be edited. Continue?')) {
      return;
    }

    setSaving(true);
    try {
      const signedTimestamp = new Date().toISOString();
      
      const noteData = {
        type: 'initial-assessment',
        patientId,
        appointmentId,
        sessionInfo,
        formData,
        timestamps: {
          ...timestamps,
          signedAt: signedTimestamp
        },
        status: 'signed',
        signature: {
          therapistName: `${user?.firstName} ${user?.lastName}`,
          credentials: getCredentials(),
          signedAt: signedTimestamp,
          ipAddress: ipAddress
        },
        therapist: {
          name: `${user?.firstName} ${user?.lastName}`,
          credentials: getCredentials(),
          id: user?.id
        }
      };

      await axios.post(`${API_URL}/api/notes/save`, {
        locationId: LOCATION_ID,
        contactId: patientId,
        noteData
      });
      
      setIsLocked(true);
      setTimestamps(prev => ({
        ...prev,
        signedAt: signedTimestamp
      }));
      
      alert('Note signed and locked successfully!');
      navigate(all_routes.visits);
    } catch (error) {
      console.error('Sign and lock failed:', error);
      alert('Failed to sign and lock note');
    } finally {
      setSaving(false);
    }
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPatientName = () => {
    if (!patient) return 'Unknown Patient';
    return `${patient.firstName || ''} ${patient.lastName || ''}`.trim();
  };

  const getPatientDOB = () => {
    if (!patient?.dateOfBirth) return 'N/A';
    return new Date(patient.dateOfBirth).toLocaleDateString('en-US');
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2">Loading assessment form...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-flex align-items-center justify-content-between gap-2 mb-4 flex-wrap">
            <div className="breadcrumb-arrow">
              <h4 className="mb-1">Initial Assessment</h4>
              <div className="text-end">
                <ol className="breadcrumb m-0 py-0">
                  <li className="breadcrumb-item">
                    <Link to={all_routes.dashboard}>Home</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to={all_routes.visits}>Visits</Link>
                  </li>
                  <li className="breadcrumb-item active">Initial Assessment</li>
                </ol>
              </div>
            </div>
            <div className="d-flex gap-2">
              {!isLocked && (
                <>
                  <button
                    onClick={handleSaveDraft}
                    className="btn btn-outline-primary"
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Draft'}
                  </button>
                  <button
                    onClick={handleSignAndLock}
                    className="btn btn-success"
                    disabled={saving}
                  >
                    <i className="ti ti-lock me-1" />
                    Sign & Lock
                  </button>
                </>
              )}
              {isLocked && (
                <span className="badge bg-success fs-14 px-3 py-2">
                  <i className="ti ti-lock me-1" />
                  Signed & Locked
                </span>
              )}
            </div>
          </div>

          {/* Status Bar */}
          <div className="alert alert-info d-flex justify-content-between align-items-center mb-3">
            <div>
              <i className="ti ti-info-circle me-2" />
              <strong>Auto-save enabled</strong> - Changes are automatically saved every 30 seconds
            </div>
            <div className="text-end">
              <small className="d-block">Created: {formatDateTime(timestamps.created)}</small>
              <small className="d-block">Last Updated: {formatDateTime(timestamps.lastUpdated)}</small>
              {timestamps.signedAt && (
                <small className="d-block text-success">
                  <strong>Signed: {formatDateTime(timestamps.signedAt)}</strong>
                </small>
              )}
            </div>
          </div>

          {/* Main Form Card */}
          <div className="card mb-0">
            <div className="card-body">
              <form onSubmit={(e) => e.preventDefault()}>
                
                {/* ========== SECTION 1: PATIENT & SESSION INFO ========== */}
                <div className="border-bottom pb-4 mb-4">
                  <h5 className="mb-3 text-primary">
                    <i className="ti ti-user me-2" />
                    Patient & Session Information
                  </h5>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="card bg-light">
                        <div className="card-body">
                          <h6 className="mb-3">Patient Information</h6>
                          <div className="mb-2">
                            <strong>Name:</strong> {getPatientName()}
                          </div>
                          <div className="mb-2">
                            <strong>Date of Birth:</strong> {getPatientDOB()}
                          </div>
                          <div className="mb-2">
                            <strong>Email:</strong> {patient?.email || 'N/A'}
                          </div>
                          <div className="mb-2">
                            <strong>Phone:</strong> {patient?.phone || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="card bg-light">
                        <div className="card-body">
                          <h6 className="mb-3">Session Information</h6>
                          <div className="mb-2">
                            <strong>Therapist:</strong> {user?.firstName} {user?.lastName}, {getCredentials()}
                          </div>
                          <div className="mb-2">
                            <strong>Session Date:</strong> {new Date(sessionInfo.sessionDate).toLocaleDateString()}
                          </div>
                          <div className="mb-2">
                            <strong>Session Time:</strong> {sessionInfo.sessionTime}
                          </div>
                          <div className="mb-2">
                            <strong>Duration:</strong> {sessionInfo.duration} minutes
                          </div>
                          <div className="mb-2">
                            <strong>CPT Code:</strong> <span className="badge badge-soft-primary">{sessionInfo.cptCode}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ========== SECTION 2: IDENTIFYING INFORMATION ========== */}
                <div className="border-bottom pb-4 mb-4">
                  <h5 className="mb-3 text-primary">
                    <i className="ti ti-clipboard me-2" />
                    Identifying Information
                  </h5>
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Chief Complaint *</label>
                        <textarea
                          className="form-control"
                          rows={3}
                          value={formData.chiefComplaint}
                          onChange={(e) => handleInputChange('chiefComplaint', e.target.value)}
                          placeholder="What brings you to therapy today?"
                          disabled={isLocked}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Referral Source</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.referralSource}
                          onChange={(e) => handleInputChange('referralSource', e.target.value)}
                          placeholder="How did you hear about our services?"
                          disabled={isLocked}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ========== SECTION 3: PRESENTING PROBLEM ========== */}
                <div className="border-bottom pb-4 mb-4">
                  <h5 className="mb-3 text-primary">
                    <i className="ti ti-alert-circle me-2" />
                    Presenting Problem
                  </h5>
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Detailed Description of Presenting Problem *</label>
                        <textarea
                          className="form-control"
                          rows={5}
                          value={formData.presentingProblem}
                          onChange={(e) => handleInputChange('presentingProblem', e.target.value)}
                          placeholder="Provide a detailed description of the current problem, including symptoms, severity, and impact on daily functioning..."
                          disabled={isLocked}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Onset & Duration</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.onsetDuration}
                          onChange={(e) => handleInputChange('onsetDuration', e.target.value)}
                          placeholder="When did symptoms begin? How long have they lasted?"
                          disabled={isLocked}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Previous Treatment</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.previousTreatment}
                          onChange={(e) => handleInputChange('previousTreatment', e.target.value)}
                          placeholder="Prior therapy, medications, or other interventions"
                          disabled={isLocked}
                        />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Current Medications</label>
                        <textarea
                          className="form-control"
                          rows={2}
                          value={formData.currentMedications}
                          onChange={(e) => handleInputChange('currentMedications', e.target.value)}
                          placeholder="List all current medications, dosages, and prescribing physician"
                          disabled={isLocked}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ========== SECTION 4: MENTAL STATUS EXAMINATION ========== */}
                <div className="border-bottom pb-4 mb-4">
                  <h5 className="mb-3 text-primary">
                    <i className="ti ti-brain me-2" />
                    Mental Status Examination
                  </h5>
                  
                  {/* Appearance */}
                  <div className="mb-4">
                    <label className="form-label fw-semibold">Appearance</label>
                    <div className="row">
                      {['Well-groomed', 'Disheveled', 'Appropriately dressed', 'Inappropriate attire', 'Poor hygiene'].map(item => (
                        <div className="col-md-3" key={item}>
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={formData.appearance.includes(item)}
                              onChange={() => handleCheckboxChange('appearance', item)}
                              disabled={isLocked}
                            />
                            <label className="form-check-label">{item}</label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Behavior */}
                  <div className="mb-4">
                    <label className="form-label fw-semibold">Behavior</label>
                    <div className="row">
                      {['Cooperative', 'Uncooperative', 'Agitated', 'Calm', 'Withdrawn', 'Guarded'].map(item => (
                        <div className="col-md-3" key={item}>
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={formData.behavior.includes(item)}
                              onChange={() => handleCheckboxChange('behavior', item)}
                              disabled={isLocked}
                            />
                            <label className="form-check-label">{item}</label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Speech */}
                  <div className="mb-4">
                    <label className="form-label fw-semibold">Speech</label>
                    <div className="row">
                      {['Normal rate/tone', 'Rapid', 'Slowed', 'Pressured', 'Soft', 'Loud'].map(item => (
                        <div className="col-md-3" key={item}>
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={formData.speech.includes(item)}
                              onChange={() => handleCheckboxChange('speech', item)}
                              disabled={isLocked}
                            />
                            <label className="form-check-label">{item}</label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mood & Affect */}
                  <div className="row mb-4">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Mood (Subjective)</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.mood}
                        onChange={(e) => handleInputChange('mood', e.target.value)}
                        placeholder="Client's description of their mood"
                        disabled={isLocked}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Affect (Objective)</label>
                      <div className="d-flex flex-wrap gap-2">
                        {['Appropriate', 'Flat', 'Blunted', 'Labile', 'Constricted', 'Full range'].map(item => (
                          <div className="form-check" key={item}>
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={formData.affect.includes(item)}
                              onChange={() => handleCheckboxChange('affect', item)}
                              disabled={isLocked}
                            />
                            <label className="form-check-label">{item}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Thought Process */}
                  <div className="mb-4">
                    <label className="form-label fw-semibold">Thought Process</label>
                    <div className="row">
                      {['Logical', 'Goal-directed', 'Tangential', 'Circumstantial', 'Loose associations', 'Flight of ideas'].map(item => (
                        <div className="col-md-3" key={item}>
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={formData.thoughtProcess.includes(item)}
                              onChange={() => handleCheckboxChange('thoughtProcess', item)}
                              disabled={isLocked}
                            />
                            <label className="form-check-label">{item}</label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Thought Content */}
                  <div className="mb-4">
                    <label className="form-label fw-semibold">Thought Content</label>
                    <div className="row">
                      {['Appropriate', 'Obsessions', 'Ruminations', 'Delusions', 'Paranoia', 'Preoccupations'].map(item => (
                        <div className="col-md-3" key={item}>
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={formData.thoughtContent.includes(item)}
                              onChange={() => handleCheckboxChange('thoughtContent', item)}
                              disabled={isLocked}
                            />
                            <label className="form-check-label">{item}</label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Perceptions */}
                  <div className="mb-4">
                    <label className="form-label fw-semibold">Perceptions</label>
                    <div className="row">
                      {['No disturbances', 'Auditory hallucinations', 'Visual hallucinations', 'Illusions', 'Depersonalization', 'Derealization'].map(item => (
                        <div className="col-md-3" key={item}>
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={formData.perceptions.includes(item)}
                              onChange={() => handleCheckboxChange('perceptions', item)}
                              disabled={isLocked}
                            />
                            <label className="form-check-label">{item}</label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cognition */}
                  <div className="card bg-light">
                    <div className="card-body">
                      <h6 className="mb-3">Cognition</h6>
                      <div className="row">
                        <div className="col-md-12 mb-3">
                          <label className="form-label">Oriented to:</label>
                          <div className="d-flex gap-3">
                            {['Person', 'Place', 'Time', 'Situation'].map(item => (
                              <div className="form-check" key={item}>
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={formData.cognition.oriented.includes(item)}
                                  onChange={() => {
                                    const newOriented = formData.cognition.oriented.includes(item)
                                      ? formData.cognition.oriented.filter(i => i !== item)
                                      : [...formData.cognition.oriented, item];
                                    handleCognitionChange('oriented', newOriented);
                                  }}
                                  disabled={isLocked}
                                />
                                <label className="form-check-label">{item}</label>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Memory</label>
                          <select
                            className="form-select"
                            value={formData.cognition.memory}
                            onChange={(e) => handleCognitionChange('memory', e.target.value)}
                            disabled={isLocked}
                          >
                            <option value="">Select...</option>
                            <option value="Intact">Intact</option>
                            <option value="Impaired - Recent">Impaired - Recent</option>
                            <option value="Impaired - Remote">Impaired - Remote</option>
                            <option value="Impaired - Both">Impaired - Both</option>
                          </select>
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Concentration</label>
                          <select
                            className="form-select"
                            value={formData.cognition.concentration}
                            onChange={(e) => handleCognitionChange('concentration', e.target.value)}
                            disabled={isLocked}
                          >
                            <option value="">Select...</option>
                            <option value="Good">Good</option>
                            <option value="Fair">Fair</option>
                            <option value="Poor">Poor</option>
                          </select>
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Insight</label>
                          <select
                            className="form-select"
                            value={formData.cognition.insight}
                            onChange={(e) => handleCognitionChange('insight', e.target.value)}
                            disabled={isLocked}
                          >
                            <option value="">Select...</option>
                            <option value="Good">Good</option>
                            <option value="Fair">Fair</option>
                            <option value="Poor">Poor</option>
                            <option value="Limited">Limited</option>
                          </select>
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Judgment</label>
                          <select
                            className="form-select"
                            value={formData.cognition.judgment}
                            onChange={(e) => handleCognitionChange('judgment', e.target.value)}
                            disabled={isLocked}
                          >
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
                </div>

                {/* ========== SECTION 5: RISK ASSESSMENT ========== */}
                <div className="border-bottom pb-4 mb-4">
                  <h5 className="mb-3 text-danger">
                    <i className="ti ti-alert-triangle me-2" />
                    Risk Assessment
                  </h5>
                  <div className="card border-danger">
                    <div className="card-body">
                      <div className="row">
                        <div className="col-md-6 mb-3">
                          <label className="form-label fw-semibold">Suicidal Ideation</label>
                          <select
                            className="form-select"
                            value={formData.suicidalIdeation}
                            onChange={(e) => handleInputChange('suicidalIdeation', e.target.value)}
                            disabled={isLocked}
                          >
                            <option value="none">None</option>
                            <option value="passive">Passive (no plan)</option>
                            <option value="active">Active (with plan)</option>
                            <option value="intent">Active with intent</option>
                          </select>
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Suicidal Plan Details (if applicable)</label>
                          <input
                            type="text"
                            className="form-control"
                            value={formData.suicidalPlan}
                            onChange={(e) => handleInputChange('suicidalPlan', e.target.value)}
                            disabled={isLocked || formData.suicidalIdeation === 'none'}
                          />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label fw-semibold">Homicidal Ideation</label>
                          <select
                            className="form-select"
                            value={formData.homicidalIdeation}
                            onChange={(e) => handleInputChange('homicidalIdeation', e.target.value)}
                            disabled={isLocked}
                          >
                            <option value="none">None</option>
                            <option value="passive">Passive (no plan)</option>
                            <option value="active">Active (with plan)</option>
                            <option value="intent">Active with intent</option>
                          </select>
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Homicidal Plan Details (if applicable)</label>
                          <input
                            type="text"
                            className="form-control"
                            value={formData.homicidalPlan}
                            onChange={(e) => handleInputChange('homicidalPlan', e.target.value)}
                            disabled={isLocked || formData.homicidalIdeation === 'none'}
                          />
                        </div>
                        <div className="col-md-12 mb-3">
                          <label className="form-label fw-semibold">Self-Harm Behavior</label>
                          <select
                            className="form-select"
                            value={formData.selfHarmBehavior}
                            onChange={(e) => handleInputChange('selfHarmBehavior', e.target.value)}
                            disabled={isLocked}
                          >
                            <option value="none">None</option>
                            <option value="past">Past history</option>
                            <option value="recent">Recent (within 30 days)</option>
                            <option value="current">Current/Active</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ========== SECTION 6: HISTORY ========== */}
                <div className="border-bottom pb-4 mb-4">
                  <h5 className="mb-3 text-primary">
                    <i className="ti ti-history me-2" />
                    History
                  </h5>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Psychiatric History</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={formData.psychiatricHistory}
                        onChange={(e) => handleInputChange('psychiatricHistory', e.target.value)}
                        placeholder="Previous diagnoses, hospitalizations, treatments"
                        disabled={isLocked}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Medical History</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={formData.medicalHistory}
                        onChange={(e) => handleInputChange('medicalHistory', e.target.value)}
                        placeholder="Chronic conditions, surgeries, current health status"
                        disabled={isLocked}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Substance Use History</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={formData.substanceUseHistory}
                        onChange={(e) => handleInputChange('substanceUseHistory', e.target.value)}
                        placeholder="Current/past substance use, treatment history"
                        disabled={isLocked}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Family History</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={formData.familyHistory}
                        onChange={(e) => handleInputChange('familyHistory', e.target.value)}
                        placeholder="Mental health, substance use, medical conditions in family"
                        disabled={isLocked}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Social History</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={formData.socialHistory}
                        onChange={(e) => handleInputChange('socialHistory', e.target.value)}
                        placeholder="Living situation, relationships, employment, education"
                        disabled={isLocked}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Legal History</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={formData.legalHistory}
                        onChange={(e) => handleInputChange('legalHistory', e.target.value)}
                        placeholder="Current/past legal issues, court-ordered treatment"
                        disabled={isLocked}
                      />
                    </div>
                  </div>
                </div>

                {/* ========== SECTION 7: DIAGNOSIS ========== */}
                <div className="border-bottom pb-4 mb-4">
                  <h5 className="mb-3 text-primary">
                    <i className="ti ti-stethoscope me-2" />
                    Diagnosis
                  </h5>
                  <div className="row">
                    <div className="col-md-12 mb-3">
                      <label className="form-label">Primary Diagnosis (Axis I / ICD-10)</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.diagnosisAxis1}
                        onChange={(e) => handleInputChange('diagnosisAxis1', e.target.value)}
                        placeholder="e.g., F33.1 Major Depressive Disorder, Recurrent, Moderate"
                        disabled={isLocked}
                      />
                    </div>
                    <div className="col-md-12 mb-3">
                      <label className="form-label">Secondary Diagnosis (if applicable)</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.diagnosisAxis2}
                        onChange={(e) => handleInputChange('diagnosisAxis2', e.target.value)}
                        placeholder="e.g., F41.1 Generalized Anxiety Disorder"
                        disabled={isLocked}
                      />
                    </div>
                    <div className="col-md-12 mb-3">
                      <label className="form-label">Medical Conditions (Axis III)</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.diagnosisAxis3}
                        onChange={(e) => handleInputChange('diagnosisAxis3', e.target.value)}
                        placeholder="Relevant medical conditions affecting mental health"
                        disabled={isLocked}
                      />
                    </div>
                  </div>
                </div>

                {/* ========== SECTION 8: TREATMENT PLAN ========== */}
                <div className="border-bottom pb-4 mb-4">
                  <h5 className="mb-3 text-primary">
                    <i className="ti ti-target me-2" />
                    Treatment Plan
                  </h5>
                  <div className="row">
                    <div className="col-md-12 mb-3">
                      <label className="form-label">Treatment Goals *</label>
                      <textarea
                        className="form-control"
                        rows={4}
                        value={formData.treatmentGoals}
                        onChange={(e) => handleInputChange('treatmentGoals', e.target.value)}
                        placeholder="List specific, measurable treatment goals (e.g., 1. Reduce depressive symptoms by 50% within 8 weeks, 2. Develop coping strategies for anxiety...)"
                        disabled={isLocked}
                      />
                    </div>
                    <div className="col-md-12 mb-3">
                      <label className="form-label">Interventions / Modalities</label>
                      <div className="row">
                        {['CBT', 'DBT', 'EMDR', 'Psychodynamic', 'Solution-Focused', 'Mindfulness', 'Motivational Interviewing', 'Family Therapy'].map(item => (
                          <div className="col-md-3" key={item}>
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={formData.interventions.includes(item)}
                                onChange={() => handleCheckboxChange('interventions', item)}
                                disabled={isLocked}
                              />
                              <label className="form-check-label">{item}</label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Frequency of Sessions</label>
                      <select
                        className="form-select"
                        value={formData.frequency}
                        onChange={(e) => handleInputChange('frequency', e.target.value)}
                        disabled={isLocked}
                      >
                        <option value="">Select...</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Bi-weekly">Bi-weekly (Every 2 weeks)</option>
                        <option value="Monthly">Monthly</option>
                        <option value="As needed">As needed</option>
                      </select>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Estimated Duration of Treatment</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.estimatedDuration}
                        onChange={(e) => handleInputChange('estimatedDuration', e.target.value)}
                        placeholder="e.g., 12 weeks, 6 months"
                        disabled={isLocked}
                      />
                    </div>
                  </div>
                </div>

                {/* ========== SECTION 9: CLINICAL IMPRESSIONS ========== */}
                <div className="border-bottom pb-4 mb-4">
                  <h5 className="mb-3 text-primary">
                    <i className="ti ti-writing me-2" />
                    Clinical Impressions
                  </h5>
                  <div className="row">
                    <div className="col-md-12 mb-3">
                      <label className="form-label">Clinical Impression / Formulation *</label>
                      <textarea
                        className="form-control"
                        rows={5}
                        value={formData.clinicalImpression}
                        onChange={(e) => handleInputChange('clinicalImpression', e.target.value)}
                        placeholder="Summarize your clinical understanding of the client's presentation, including contributing factors, strengths, and treatment approach rationale..."
                        disabled={isLocked}
                      />
                    </div>
                    <div className="col-md-12 mb-3">
                      <label className="form-label">Prognosis</label>
                      <select
                        className="form-select"
                        value={formData.prognosis}
                        onChange={(e) => handleInputChange('prognosis', e.target.value)}
                        disabled={isLocked}
                      >
                        <option value="">Select...</option>
                        <option value="Excellent">Excellent</option>
                        <option value="Good">Good</option>
                        <option value="Fair">Fair</option>
                        <option value="Guarded">Guarded</option>
                        <option value="Poor">Poor</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* ========== SECTION 10: ADDITIONAL NOTES ========== */}
                <div className="pb-4 mb-4">
                  <h5 className="mb-3 text-primary">
                    <i className="ti ti-notes me-2" />
                    Additional Notes
                  </h5>
                  <div className="row">
                    <div className="col-md-12">
                      <textarea
                        className="form-control"
                        rows={4}
                        value={formData.additionalNotes}
                        onChange={(e) => handleInputChange('additionalNotes', e.target.value)}
                        placeholder="Any additional observations, recommendations, or information..."
                        disabled={isLocked}
                      />
                    </div>
                  </div>
                </div>

                {/* ========== SIGNATURE SECTION ========== */}
                {timestamps.signedAt && (
                  <div className="card border-success">
                    <div className="card-body">
                      <h6 className="text-success mb-3">
                        <i className="ti ti-check-circle me-2" />
                        Electronic Signature
                      </h6>
                      <div className="row">
                        <div className="col-md-6">
                          <p className="mb-1">
                            <strong>Signed by:</strong> {user?.firstName} {user?.lastName}, {getCredentials()}
                          </p>
                          <p className="mb-1">
                            <strong>Date & Time:</strong> {formatDateTime(timestamps.signedAt)}
                          </p>
                        </div>
                        <div className="col-md-6">
                          <p className="mb-1">
                            <strong>IP Address:</strong> {ipAddress}
                          </p>
                          <p className="mb-0 text-muted">
                            <small>This note is electronically signed and locked. No further edits are permitted.</small>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="d-flex justify-content-between align-items-center mt-4">
                  <Link to={all_routes.visits} className="btn btn-outline-secondary">
                    <i className="ti ti-arrow-left me-1" />
                    Back to Visits
                  </Link>
                  <div className="d-flex gap-2">
                    {!isLocked && (
                      <>
                        <button
                          type="button"
                          onClick={handleSaveDraft}
                          className="btn btn-outline-primary"
                          disabled={saving}
                        >
                          <i className="ti ti-device-floppy me-1" />
                          {saving ? 'Saving...' : 'Save Draft'}
                        </button>
                        <button
                          type="button"
                          onClick={handleSignAndLock}
                          className="btn btn-success"
                          disabled={saving}
                        >
                          <i className="ti ti-lock me-1" />
                          Sign & Lock
                        </button>
                      </>
                    )}
                  </div>
                </div>

              </form>
            </div>
          </div>

        </div>
        <CommonFooter />
      </div>
    </>
  );
};

export default InitialAssessment;