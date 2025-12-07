import { Link, useNavigate } from "react-router-dom";
import { all_routes } from "../../routes/all_routes";
import { useState } from "react";
import axios from 'axios';
import config from '../../config';

const API_URL = config.apiUrl;
const LOCATION_ID = config.ghlLocationId;

const AddPatient = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  const [formData, setFormData] = useState({
    // Basic Info
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    preferredPronouns: '',
    maritalStatus: '',
    address1: '',
    city: '',
    state: '',
    postalCode: '',
    occupation: '',
    employer: '',
    
    // Emergency Contact
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
    
    // Insurance - Primary
    insurancePrimaryCarrier: '',
    insurancePrimaryMemberId: '',
    insurancePrimaryGroupNumber: '',
    insurancePolicyHolderName: '',
    insurancePrimaryPhone: '',
    insurancePolicyHolderDob: '',
    insuranceRelationshipToPatient: '',
    insuranceCopayAmount: '',
    insuranceDeductibleRemaining: '',
    insuranceOutOfPocketMax: '',
    
    // Insurance - Secondary
    insuranceSecondaryCarrier: '',
    insuranceEligibility: '',
    insuranceEligibilityCheckedDate: '',
    insuranceNotes: '',
    
    // Clinical
    primaryDiagnosisCode: '',
    primaryDiagnosisDescription: '',
    secondaryDiagnosisCode: '',
    secondaryDiagnosisDescription: '',
    currentMedications: '',
    allergies: '',
    referringProviderName: '',
    referringProviderNpi: '',
    previousMentalHealthTreatment: '',
    
    // Intake
    intakeDate: '',
    intakeCompletedBy: '',
    chiefComplaint: '',
    presentingProblem: '',
    symptomOnset: '',
    phq9Score: '',
    gad7: '',
    
    // Billing
    paymentMethod: '',
    selfPayRate: '',
    outstandingBalance: '',
    lastPaymentDate: '',
    paymentPlanActive: '',
    billingNotes: ''
  });

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName || !formData.phone) {
      alert('Please fill in required fields: First Name, Last Name, and Phone');
      return;
    }

    setLoading(true);

    try {
      console.log('📝 Creating patient...');

      const customFields = [
        { key: 'preferred_pronouns', field_value: formData.preferredPronouns },
        { key: 'marital_status', field_value: formData.maritalStatus },
        { key: 'emergency_contact_name', field_value: formData.emergencyContactName },
        { key: 'emergency_contact_phone', field_value: formData.emergencyContactPhone },
        { key: 'emergency_contact_relation', field_value: formData.emergencyContactRelation },
        { key: 'occupation', field_value: formData.occupation },
        { key: 'employer', field_value: formData.employer },
        { key: 'gender', field_value: formData.gender },
        
        // Insurance
        { key: 'insurance_primary_carrier', field_value: formData.insurancePrimaryCarrier },
        { key: 'insurance_primary_member_id', field_value: formData.insurancePrimaryMemberId },
        { key: 'insurance_primary_group_number', field_value: formData.insurancePrimaryGroupNumber },
        { key: 'insurance_policy_holder_name', field_value: formData.insurancePolicyHolderName },
        { key: 'insurance_primary_phone', field_value: formData.insurancePrimaryPhone },
        { key: 'insurance_policy_holder_date_of_birth', field_value: formData.insurancePolicyHolderDob },
        { key: 'insurance_relationship_to_patient', field_value: formData.insuranceRelationshipToPatient },
        { key: 'insurance_copay_amount', field_value: formData.insuranceCopayAmount },
        { key: 'insurance_deductible_remaining', field_value: formData.insuranceDeductibleRemaining },
        { key: 'insurance_out_of_pocket_max', field_value: formData.insuranceOutOfPocketMax },
        { key: 'insurance_secondary_carrier', field_value: formData.insuranceSecondaryCarrier },
        { key: 'insurance_eligibility', field_value: formData.insuranceEligibility },
        { key: 'insurance_eligibility_checked_date', field_value: formData.insuranceEligibilityCheckedDate },
        { key: 'insurance_notes', field_value: formData.insuranceNotes },
        
        // Clinical
        { key: 'primary_diagnosis_code', field_value: formData.primaryDiagnosisCode },
        { key: 'primary_diagnosis_description', field_value: formData.primaryDiagnosisDescription },
        { key: 'secondary_diagnosis_code', field_value: formData.secondaryDiagnosisCode },
        { key: 'secondary_diagnosis_description', field_value: formData.secondaryDiagnosisDescription },
        { key: 'current_medications', field_value: formData.currentMedications },
        { key: 'allergies', field_value: formData.allergies },
        { key: 'referring_provider_name', field_value: formData.referringProviderName },
        { key: 'referring_provider_npi', field_value: formData.referringProviderNpi },
        { key: 'previous_mental_health_treatment', field_value: formData.previousMentalHealthTreatment },
        
        // Intake
        { key: 'intake_date', field_value: formData.intakeDate },
        { key: 'intake_completed_by', field_value: formData.intakeCompletedBy },
        { key: 'chief_complaint', field_value: formData.chiefComplaint },
        { key: 'presenting_problem', field_value: formData.presentingProblem },
        { key: 'symptom_onset', field_value: formData.symptomOnset },
        { key: 'phq9_score', field_value: formData.phq9Score },
        { key: 'gad7', field_value: formData.gad7 },
        
        // Billing
        { key: 'payment_method', field_value: formData.paymentMethod },
        { key: 'self_pay_rate', field_value: formData.selfPayRate },
        { key: 'outstanding_balance', field_value: formData.outstandingBalance },
        { key: 'last_payment_date', field_value: formData.lastPaymentDate },
        { key: 'payment_plan_active', field_value: formData.paymentPlanActive },
        { key: 'billing_notes', field_value: formData.billingNotes }
      ].filter(f => f.field_value);

      await axios.post(`${API_URL}/api/patients`, {
        locationId: LOCATION_ID,
        patientData: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          dateOfBirth: formData.dateOfBirth,
          address1: formData.address1,
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
          country: 'US',
          tags: ['Patient'],
          customFields
        }
      });

      alert('Patient created successfully!');
      navigate(all_routes.patients);
    } catch (err: any) {
      console.error('❌ Error:', err);
      alert(err.response?.data?.error || 'Failed to create patient');
    } finally {
      setLoading(false);
    }
  };

  const steps = ['Basic Info', 'Insurance', 'Clinical', 'Intake & Billing'];

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-flex justify-content-between mb-4">
          <h4>Add New Patient</h4>
          <Link to={all_routes.patients} className="btn btn-outline-primary">
            <i className="ti ti-arrow-left me-1" />Back
          </Link>
        </div>

        {/* Step Indicator */}
        <div className="card mb-3">
          <div className="card-body">
            <div className="d-flex justify-content-between">
              {steps.map((step, idx) => (
                <div key={idx} className={`text-center flex-fill ${currentStep === idx ? 'text-primary fw-bold' : ''}`}>
                  <div className={`badge ${currentStep === idx ? 'badge-primary' : 'badge-secondary'} mb-2`}>{idx + 1}</div>
                  <div className="small">{step}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* STEP 1: BASIC INFO */}
          {currentStep === 0 && (
            <div className="card mb-3">
              <div className="card-header"><h5>Basic Information</h5></div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label>First Name *</label>
                    <input type="text" className="form-control" name="firstName" value={formData.firstName} onChange={handleChange} required />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Last Name *</label>
                    <input type="text" className="form-control" name="lastName" value={formData.lastName} onChange={handleChange} required />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Email</label>
                    <input type="email" className="form-control" name="email" value={formData.email} onChange={handleChange} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Phone *</label>
                    <input type="tel" className="form-control" name="phone" value={formData.phone} onChange={handleChange} required />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Date of Birth</label>
                    <input type="date" className="form-control" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Gender</label>
                    <select className="form-select" name="gender" value={formData.gender} onChange={handleChange}>
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Non-binary">Non-binary</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Preferred Pronouns</label>
                    <input type="text" className="form-control" name="preferredPronouns" value={formData.preferredPronouns} onChange={handleChange} placeholder="e.g., She/Her, He/Him, They/Them" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Marital Status</label>
                    <select className="form-select" name="maritalStatus" value={formData.maritalStatus} onChange={handleChange}>
                      <option value="">Select</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Divorced">Divorced</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Separated">Separated</option>
                    </select>
                  </div>
                  <div className="col-12 mb-3">
                    <label>Address</label>
                    <input type="text" className="form-control" name="address1" value={formData.address1} onChange={handleChange} />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label>City</label>
                    <input type="text" className="form-control" name="city" value={formData.city} onChange={handleChange} />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label>State</label>
                    <input type="text" className="form-control" name="state" value={formData.state} onChange={handleChange} />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label>Zip Code</label>
                    <input type="text" className="form-control" name="postalCode" value={formData.postalCode} onChange={handleChange} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Occupation</label>
                    <input type="text" className="form-control" name="occupation" value={formData.occupation} onChange={handleChange} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Employer</label>
                    <input type="text" className="form-control" name="employer" value={formData.employer} onChange={handleChange} />
                  </div>
                  
                  <div className="col-12"><h6 className="mt-3">Emergency Contact</h6></div>
                  <div className="col-md-4 mb-3">
                    <label>Contact Name</label>
                    <input type="text" className="form-control" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleChange} />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label>Contact Phone</label>
                    <input type="tel" className="form-control" name="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handleChange} />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label>Relationship</label>
                    <input type="text" className="form-control" name="emergencyContactRelation" value={formData.emergencyContactRelation} onChange={handleChange} placeholder="Spouse, Parent, Sibling" />
                  </div>
                </div>
                <div className="text-end mt-3">
                  <button type="button" className="btn btn-primary" onClick={() => setCurrentStep(1)}>Next</button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: INSURANCE */}
          {currentStep === 1 && (
            <div className="card mb-3">
              <div className="card-header"><h5>Insurance Information</h5></div>
              <div className="card-body">
                <div className="row">
                  <div className="col-12"><h6>Primary Insurance</h6></div>
                  <div className="col-md-6 mb-3">
                    <label>Insurance Carrier</label>
                    <input type="text" className="form-control" name="insurancePrimaryCarrier" value={formData.insurancePrimaryCarrier} onChange={handleChange} placeholder="Blue Cross Blue Shield" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Member ID</label>
                    <input type="text" className="form-control" name="insurancePrimaryMemberId" value={formData.insurancePrimaryMemberId} onChange={handleChange} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Group Number</label>
                    <input type="text" className="form-control" name="insurancePrimaryGroupNumber" value={formData.insurancePrimaryGroupNumber} onChange={handleChange} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Insurance Phone</label>
                    <input type="tel" className="form-control" name="insurancePrimaryPhone" value={formData.insurancePrimaryPhone} onChange={handleChange} />
                  </div>
                  
                  <div className="col-12"><h6 className="mt-3">Policy Holder Information</h6></div>
                  <div className="col-md-6 mb-3">
                    <label>Policy Holder Name</label>
                    <input type="text" className="form-control" name="insurancePolicyHolderName" value={formData.insurancePolicyHolderName} onChange={handleChange} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Policy Holder DOB</label>
                    <input type="date" className="form-control" name="insurancePolicyHolderDob" value={formData.insurancePolicyHolderDob} onChange={handleChange} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Relationship to Patient</label>
                    <select className="form-select" name="insuranceRelationshipToPatient" value={formData.insuranceRelationshipToPatient} onChange={handleChange}>
                      <option value="">Select</option>
                      <option value="Self">Self</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Parent">Parent</option>
                      <option value="Child">Child</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  
                  <div className="col-12"><h6 className="mt-3">Coverage Details</h6></div>
                  <div className="col-md-4 mb-3">
                    <label>Copay Amount</label>
                    <input type="text" className="form-control" name="insuranceCopayAmount" value={formData.insuranceCopayAmount} onChange={handleChange} placeholder="$20" />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label>Deductible Remaining</label>
                    <input type="text" className="form-control" name="insuranceDeductibleRemaining" value={formData.insuranceDeductibleRemaining} onChange={handleChange} placeholder="$500" />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label>Out of Pocket Max</label>
                    <input type="text" className="form-control" name="insuranceOutOfPocketMax" value={formData.insuranceOutOfPocketMax} onChange={handleChange} placeholder="$5000" />
                  </div>
                  
                  <div className="col-12"><h6 className="mt-3">Verification & Secondary</h6></div>
                  <div className="col-md-6 mb-3">
                    <label>Insurance Eligibility</label>
                    <select className="form-select" name="insuranceEligibility" value={formData.insuranceEligibility} onChange={handleChange}>
                      <option value="">Select</option>
                      <option value="Verified">Verified</option>
                      <option value="Pending">Pending</option>
                      <option value="Not Verified">Not Verified</option>
                      <option value="Denied">Denied</option>
                    </select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Eligibility Checked Date</label>
                    <input type="date" className="form-control" name="insuranceEligibilityCheckedDate" value={formData.insuranceEligibilityCheckedDate} onChange={handleChange} />
                  </div>
                  <div className="col-md-12 mb-3">
                    <label>Secondary Insurance Carrier</label>
                    <input type="text" className="form-control" name="insuranceSecondaryCarrier" value={formData.insuranceSecondaryCarrier} onChange={handleChange} />
                  </div>
                  <div className="col-12 mb-3">
                    <label>Insurance Notes</label>
                    <textarea className="form-control" name="insuranceNotes" value={formData.insuranceNotes} onChange={handleChange} rows={3} />
                  </div>
                </div>
                <div className="d-flex justify-content-between mt-3">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setCurrentStep(0)}>Back</button>
                  <button type="button" className="btn btn-primary" onClick={() => setCurrentStep(2)}>Next</button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CLINICAL */}
          {currentStep === 2 && (
            <div className="card mb-3">
              <div className="card-header"><h5>Clinical Information</h5></div>
              <div className="card-body">
                <div className="row">
                  <div className="col-12"><h6>Diagnosis</h6></div>
                  <div className="col-md-6 mb-3">
                    <label>Primary Diagnosis Code (ICD-10)</label>
                    <input type="text" className="form-control" name="primaryDiagnosisCode" value={formData.primaryDiagnosisCode} onChange={handleChange} placeholder="F41.1" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Primary Diagnosis Description</label>
                    <input type="text" className="form-control" name="primaryDiagnosisDescription" value={formData.primaryDiagnosisDescription} onChange={handleChange} placeholder="Generalized Anxiety Disorder" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Secondary Diagnosis Code</label>
                    <input type="text" className="form-control" name="secondaryDiagnosisCode" value={formData.secondaryDiagnosisCode} onChange={handleChange} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Secondary Diagnosis Description</label>
                    <input type="text" className="form-control" name="secondaryDiagnosisDescription" value={formData.secondaryDiagnosisDescription} onChange={handleChange} />
                  </div>
                  
                  <div className="col-12"><h6 className="mt-3">Medications & Allergies</h6></div>
                  <div className="col-12 mb-3">
                    <label>Current Medications</label>
                    <textarea className="form-control" name="currentMedications" value={formData.currentMedications} onChange={handleChange} rows={3} placeholder="List current medications, dosages, and frequency" />
                  </div>
                  <div className="col-12 mb-3">
                    <label>Allergies</label>
                    <textarea className="form-control" name="allergies" value={formData.allergies} onChange={handleChange} rows={2} placeholder="List known allergies" />
                  </div>
                  <div className="col-12 mb-3">
                    <label>Previous Mental Health Treatment</label>
                    <textarea className="form-control" name="previousMentalHealthTreatment" value={formData.previousMentalHealthTreatment} onChange={handleChange} rows={3} placeholder="Describe previous therapy, hospitalizations, etc." />
                  </div>
                  
                  <div className="col-12"><h6 className="mt-3">Referring Provider</h6></div>
                  <div className="col-md-6 mb-3">
                    <label>Referring Provider Name</label>
                    <input type="text" className="form-control" name="referringProviderName" value={formData.referringProviderName} onChange={handleChange} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Referring Provider NPI</label>
                    <input type="text" className="form-control" name="referringProviderNpi" value={formData.referringProviderNpi} onChange={handleChange} />
                  </div>
                </div>
                <div className="d-flex justify-content-between mt-3">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setCurrentStep(1)}>Back</button>
                  <button type="button" className="btn btn-primary" onClick={() => setCurrentStep(3)}>Next</button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: INTAKE & BILLING */}
          {currentStep === 3 && (
            <div className="card mb-3">
              <div className="card-header"><h5>Intake & Billing</h5></div>
              <div className="card-body">
                <div className="row">
                  <div className="col-12"><h6>Intake Information</h6></div>
                  <div className="col-md-6 mb-3">
                    <label>Intake Date</label>
                    <input type="date" className="form-control" name="intakeDate" value={formData.intakeDate} onChange={handleChange} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Intake Completed By</label>
                    <input type="text" className="form-control" name="intakeCompletedBy" value={formData.intakeCompletedBy} onChange={handleChange} />
                  </div>
                  <div className="col-12 mb-3">
                    <label>Chief Complaint</label>
                    <textarea className="form-control" name="chiefComplaint" value={formData.chiefComplaint} onChange={handleChange} rows={3} placeholder="Primary reason for seeking treatment" />
                  </div>
                  <div className="col-12 mb-3">
                    <label>Presenting Problem</label>
                    <textarea className="form-control" name="presentingProblem" value={formData.presentingProblem} onChange={handleChange} rows={3} placeholder="Detailed description of current issues" />
                  </div>
                  <div className="col-12 mb-3">
                    <label>Symptom Onset</label>
                    <textarea className="form-control" name="symptomOnset" value={formData.symptomOnset} onChange={handleChange} rows={2} placeholder="When did symptoms begin?" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>PHQ-9 Score (Depression)</label>
                    <input type="number" className="form-control" name="phq9Score" value={formData.phq9Score} onChange={handleChange} min="0" max="27" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>GAD-7 Score (Anxiety)</label>
                    <input type="number" className="form-control" name="gad7" value={formData.gad7} onChange={handleChange} min="0" max="21" />
                  </div>
                  
                  <div className="col-12"><h6 className="mt-3">Billing Information</h6></div>
                  <div className="col-md-6 mb-3">
                    <label>Payment Method</label>
                    <select className="form-select" name="paymentMethod" value={formData.paymentMethod} onChange={handleChange}>
                      <option value="">Select</option>
                      <option value="Insurance">Insurance</option>
                      <option value="Self-Pay">Self-Pay</option>
                      <option value="Sliding Scale">Sliding Scale</option>
                      <option value="EAP">EAP</option>
                    </select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Self Pay Rate</label>
                    <input type="text" className="form-control" name="selfPayRate" value={formData.selfPayRate} onChange={handleChange} placeholder="$150/session" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Outstanding Balance</label>
                    <input type="text" className="form-control" name="outstandingBalance" value={formData.outstandingBalance} onChange={handleChange} placeholder="$0.00" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Payment Plan Active</label>
                    <select className="form-select" name="paymentPlanActive" value={formData.paymentPlanActive} onChange={handleChange}>
                      <option value="">Select</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div className="col-12 mb-3">
                    <label>Billing Notes</label>
                    <textarea className="form-control" name="billingNotes" value={formData.billingNotes} onChange={handleChange} rows={3} />
                  </div>
                </div>
                <div className="d-flex justify-content-between mt-3">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setCurrentStep(2)}>Back</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? (<><span className="spinner-border spinner-border-sm me-2" />Creating...</>) : 'Create Patient'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default AddPatient;