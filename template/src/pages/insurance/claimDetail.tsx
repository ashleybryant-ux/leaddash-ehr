import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import './claimDetail.css';

const API_URL = config.apiUrl;
const LOCATION_ID = config.ghlLocationId;

const ClaimDetail = () => {
  const { claimId } = useParams<{ claimId: string }>();
  const [claim, setClaim] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchClaim();
  }, [claimId]);

  const fetchClaim = async () => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : {};

      const response = await axios.get(
        `${API_URL}/api/claims/${claimId}`,
        {
          headers: {
            'x-location-id': user.locationId || LOCATION_ID
          }
        }
      );

      setClaim(response.data.claim);
    } catch (error) {
      console.error('Error fetching claim:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : {};

      await axios.put(
        `${API_URL}/api/claims/${claimId}`,
        claim,
        {
          headers: {
            'x-location-id': user.locationId || LOCATION_ID
          }
        }
      );

      alert('Claim saved successfully!');
      setEditMode(false);
      fetchClaim();
    } catch (error) {
      console.error('Error saving claim:', error);
      alert('Failed to save claim');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setClaim({ ...claim, [field]: value });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${month} ${day} ${year}`;
  };

  const formatCurrency = (amount: number) => {
    return amount?.toFixed(2) || '0.00';
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

  if (!claim) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="text-center py-5">
            <h3>Claim not found</h3>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-flex justify-content-between align-items-center mb-4 no-print">
          <div>
            <h4>CMS-1500 Claim Form</h4>
            <p className="text-muted mb-0">Claim #{claim.claimNumber}</p>
          </div>
          <div>
            <button className="btn btn-secondary me-2" onClick={() => window.history.back()}>
              ← Back
            </button>
            {!editMode ? (
              <>
                <button className="btn btn-warning me-2" onClick={() => setEditMode(true)}>
                  ✏️ Edit
                </button>
                <button className="btn btn-primary" onClick={() => window.print()}>
                  🖨️ Print
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-secondary me-2" onClick={() => { setEditMode(false); fetchClaim(); }}>
                  Cancel
                </button>
                <button className="btn btn-success" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : '💾 Save'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className={`cms-1500-form ${editMode ? 'edit-mode' : ''}`}>
          {/* Red carrier bar */}
          <div className="cms-carrier-bar">CARRIER</div>
          
          {/* Do not staple area with barcode */}
          <div className="cms-staple-area">
            <div className="barcode">
              <div className="bar"></div>
              <div className="bar"></div>
              <div className="bar"></div>
              <div className="bar"></div>
              <div className="bar"></div>
            </div>
            <div className="staple-text">PLEASE DO NOT STAPLE IN THIS AREA</div>
          </div>

          {/* Approved text top right */}
          <div className="approved-text">APPROVED OMB-0938-0008</div>

          <div className="form-container">
            {/* Header */}
            <div className="form-header">
              <div className="header-left">
                <div className="pica-box">PICA</div>
              </div>
              <div className="header-center">
                <div className="header-title">HEALTH INSURANCE CLAIM FORM</div>
              </div>
              <div className="header-right">
                <div className="pica-box">PICA</div>
                <div className="pica-box">PICA</div>
              </div>
            </div>

            {/* Top instruction */}
            <div className="read-instruction">
              READ BACK OF FORM BEFORE COMPLETING & SIGNING THIS FORM.
            </div>

            {/* Boxes 1-11 */}
            <div className="top-section">
              {/* Row 1: Box 1 and 1a */}
              <div className="form-row">
                <div className="form-box box-1">
                  <label>1. MEDICARE MEDICAID TRICARE CHAMPVA GROUP HEALTH PLAN FECA OTHER 1a. INSURED'S I.D. NUMBER (FOR PROGRAM IN ITEM 1)</label>
                  <div className="checkbox-row">
                    <label><input type="checkbox" checked={claim.insuranceType === 'medicare'} disabled={!editMode} /> Medicare #</label>
                    <label><input type="checkbox" checked={claim.insuranceType === 'medicaid'} disabled={!editMode} /> Medicaid #</label>
                    <label><input type="checkbox" checked={claim.insuranceType === 'tricare'} disabled={!editMode} /> Sponsor's SSN</label>
                    <label><input type="checkbox" checked={claim.insuranceType === 'champva'} disabled={!editMode} /> VA File #</label>
                    <label><input type="checkbox" checked={claim.insuranceType === 'group'} disabled={!editMode} /> SSN or ID</label>
                    <label><input type="checkbox" checked={claim.insuranceType === 'feca'} disabled={!editMode} /> SSN</label>
                    <label><input type="checkbox" checked={claim.insuranceType === 'other'} disabled={!editMode} /> ID</label>
                  </div>
                </div>
                <div className="form-box box-1a">
                  <input type="text" value={claim.insuranceMemberId || ''} onChange={(e) => handleChange('insuranceMemberId', e.target.value)} readOnly={!editMode} />
                </div>
              </div>

              {/* Row 2: Boxes 2, 3, 4 */}
              <div className="form-row">
                <div className="form-box box-2">
                  <label>2. PATIENT'S NAME (Last Name, First Name, Middle Initial)</label>
                  <input type="text" value={`${claim.patientLastName || ''}, ${claim.patientFirstName || ''} ${claim.patientMiddleInitial || ''}`} readOnly={!editMode} />
                </div>
                <div className="form-box box-3">
                  <label>3. PATIENT'S BIRTH DATE</label>
                  <input type="text" value={formatDate(claim.patientDOB)} readOnly={!editMode} style={{width: '80px'}} />
                  <label style={{marginLeft: '10px'}}>SEX</label>
                  <div className="checkbox-row" style={{display: 'inline-flex', marginLeft: '5px'}}>
                    <label><input type="checkbox" checked={claim.patientGender === 'M'} disabled={!editMode} /> M</label>
                    <label><input type="checkbox" checked={claim.patientGender === 'F'} disabled={!editMode} /> F</label>
                  </div>
                </div>
                <div className="form-box box-4">
                  <label>4. INSURED'S NAME (Last Name, First Name, Middle Initial)</label>
                  <input type="text" value={`${claim.insuredLastName || ''}, ${claim.insuredFirstName || ''}`} readOnly={!editMode} />
                </div>
              </div>

              {/* Row 3: Boxes 5, 6, 7 */}
              <div className="form-row">
                <div className="form-box box-5">
                  <label>5. PATIENT'S ADDRESS (No., Street)</label>
                  <input type="text" value={claim.patientAddress1 || ''} readOnly={!editMode} />
                  <label>CITY</label>
                  <input type="text" value={claim.patientCity || ''} readOnly={!editMode} />
                  <div style={{display: 'flex', gap: '10px'}}>
                    <div>
                      <label>STATE</label>
                      <input type="text" value={claim.patientState || ''} readOnly={!editMode} style={{width: '60px'}} />
                    </div>
                    <div>
                      <label>ZIP CODE</label>
                      <input type="text" value={claim.patientZip || ''} readOnly={!editMode} style={{width: '100px'}} />
                    </div>
                  </div>
                  <label>TELEPHONE (Include Area Code)</label>
                  <input type="text" value={claim.patientPhone || ''} readOnly={!editMode} />
                </div>
                <div className="form-box box-6">
                  <label>6. PATIENT RELATIONSHIP TO INSURED</label>
                  <div className="checkbox-row">
                    <label><input type="checkbox" checked={claim.relationshipToInsured === 'self'} disabled={!editMode} /> Self</label>
                    <label><input type="checkbox" checked={claim.relationshipToInsured === 'spouse'} disabled={!editMode} /> Spouse</label>
                    <label><input type="checkbox" checked={claim.relationshipToInsured === 'child'} disabled={!editMode} /> Child</label>
                    <label><input type="checkbox" checked={claim.relationshipToInsured === 'other'} disabled={!editMode} /> Other</label>
                  </div>
                </div>
                <div className="form-box box-7">
                  <label>7. INSURED'S ADDRESS (No., Street)</label>
                  <input type="text" value={claim.insuredAddress1 || ''} readOnly={!editMode} />
                  <label>CITY</label>
                  <input type="text" value={claim.insuredCity || ''} readOnly={!editMode} />
                  <div style={{display: 'flex', gap: '10px'}}>
                    <div>
                      <label>STATE</label>
                      <input type="text" value={claim.insuredState || ''} readOnly={!editMode} style={{width: '60px'}} />
                    </div>
                    <div>
                      <label>ZIP CODE</label>
                      <input type="text" value={claim.insuredZip || ''} readOnly={!editMode} style={{width: '100px'}} />
                    </div>
                  </div>
                  <label>TELEPHONE (INCLUDE AREA CODE)</label>
                  <input type="text" value={claim.insuredPhone || ''} readOnly={!editMode} />
                </div>
              </div>

              {/* Row 4: Boxes 8, 9, 10, 11 */}
              <div className="form-row">
                <div className="form-box box-8">
                  <label>8. PATIENT STATUS</label>
                  <div className="checkbox-row">
                    <label><input type="checkbox" disabled={!editMode} /> Single</label>
                    <label><input type="checkbox" disabled={!editMode} /> Married</label>
                    <label><input type="checkbox" disabled={!editMode} /> Other</label>
                  </div>
                  <div className="checkbox-row">
                    <label><input type="checkbox" disabled={!editMode} /> Employed</label>
                    <label><input type="checkbox" disabled={!editMode} /> Full-Time Student</label>
                    <label><input type="checkbox" disabled={!editMode} /> Part-Time Student</label>
                  </div>
                </div>
                <div className="form-box box-9">
                  <label>9. OTHER INSURED'S NAME (Last Name, First Name, Middle Initial)</label>
                  <input type="text" value={claim.otherInsuredName || ''} readOnly={!editMode} />
                  <label>a. OTHER INSURED'S POLICY OR GROUP NUMBER</label>
                  <input type="text" readOnly={!editMode} />
                  <label>b. OTHER INSURED'S DATE OF BIRTH SEX</label>
                  <input type="text" readOnly={!editMode} style={{width: '80px'}} />
                  <div className="checkbox-row" style={{display: 'inline-flex', marginLeft: '5px'}}>
                    <label><input type="checkbox" disabled={!editMode} /> M</label>
                    <label><input type="checkbox" disabled={!editMode} /> F</label>
                  </div>
                  <label>c. EMPLOYER'S NAME OR SCHOOL NAME</label>
                  <input type="text" readOnly={!editMode} />
                  <label>d. INSURANCE PLAN NAME OR PROGRAM NAME</label>
                  <input type="text" readOnly={!editMode} />
                </div>
                <div className="form-box box-10">
                  <label>10. IS PATIENT'S CONDITION RELATED TO:</label>
                  <label style={{fontSize: '10px'}}>a. EMPLOYMENT? (CURRENT OR PREVIOUS)</label>
                  <div className="checkbox-row">
                    <label><input type="checkbox" checked={claim.relatedToEmployment === 'yes'} disabled={!editMode} /> YES</label>
                    <label><input type="checkbox" checked={claim.relatedToEmployment === 'no'} disabled={!editMode} /> NO</label>
                  </div>
                  <label style={{fontSize: '10px'}}>b. AUTO ACCIDENT? PLACE (State)</label>
                  <div className="checkbox-row">
                    <label><input type="checkbox" disabled={!editMode} /> YES</label>
                    <label><input type="checkbox" disabled={!editMode} /> NO</label>
                    <input type="text" readOnly={!editMode} style={{width: '40px', marginLeft: '5px'}} />
                  </div>
                  <label style={{fontSize: '10px'}}>c. OTHER ACCIDENT?</label>
                  <div className="checkbox-row">
                    <label><input type="checkbox" disabled={!editMode} /> YES</label>
                    <label><input type="checkbox" disabled={!editMode} /> NO</label>
                  </div>
                  <label style={{fontSize: '10px'}}>10d. RESERVED FOR LOCAL USE</label>
                </div>
                <div className="form-box box-11">
                  <label>11. INSURED'S POLICY GROUP OR FECA NUMBER</label>
                  <input type="text" value={claim.insurancePolicyNumber || ''} readOnly={!editMode} />
                  <label>a. INSURED'S DATE OF BIRTH SEX</label>
                  <input type="text" value={formatDate(claim.insuredDOB)} readOnly={!editMode} style={{width: '80px'}} />
                  <div className="checkbox-row" style={{display: 'inline-flex', marginLeft: '5px'}}>
                    <label><input type="checkbox" disabled={!editMode} /> M</label>
                    <label><input type="checkbox" disabled={!editMode} /> F</label>
                  </div>
                  <label>b. EMPLOYER'S NAME OR SCHOOL NAME</label>
                  <input type="text" readOnly={!editMode} />
                  <label>c. INSURANCE PLAN NAME OR PROGRAM NAME</label>
                  <input type="text" readOnly={!editMode} />
                  <label>d. IS THERE ANOTHER HEALTH BENEFIT PLAN?</label>
                  <div className="checkbox-row">
                    <label><input type="checkbox" disabled={!editMode} /> YES</label>
                    <label><input type="checkbox" disabled={!editMode} /> NO</label>
                    <span style={{fontSize: '9px', marginLeft: '5px'}}>If yes, return to and complete item 9 a-d.</span>
                  </div>
                </div>
              </div>

              {/* Boxes 12-13 */}
              <div className="form-row">
                <div className="form-box box-12">
                  <label>12. PATIENT'S OR AUTHORIZED PERSON'S SIGNATURE I authorize the release of any medical or other information necessary to process this claim. I also request payment of government benefits either to myself or to the party who accepts assignment below.</label>
                  <div className="signature-line">SIGNED___________________________</div>
                  <label>DATE_______________</label>
                </div>
                <div className="form-box box-13">
                  <label>13. INSURED'S OR AUTHORIZED PERSON'S SIGNATURE I authorize payment of medical benefits to the undersigned physician or supplier for services described below.</label>
                  <div className="signature-line">SIGNED___________________________</div>
                </div>
              </div>
            </div>

            {/* Boxes 14-23 */}
            <div className="middle-section">
              <div className="form-row">
                <div className="form-box box-14">
                  <label>14. DATE OF CURRENT: ILLNESS (First symptom) OR INJURY (Accident) OR PREGNANCY(LMP)</label>
                  <input type="text" readOnly={!editMode} />
                </div>
                <div className="form-box box-15">
                  <label>15. IF PATIENT HAS HAD SAME OR SIMILAR ILLNESS. GIVE FIRST DATE</label>
                  <input type="text" readOnly={!editMode} />
                </div>
                <div className="form-box box-16">
                  <label>16. DATES PATIENT UNABLE TO WORK IN CURRENT OCCUPATION</label>
                  <label style={{fontSize: '10px'}}>FROM</label>
                  <input type="text" readOnly={!editMode} style={{width: '80px'}} />
                  <label style={{fontSize: '10px', marginLeft: '10px'}}>TO</label>
                  <input type="text" readOnly={!editMode} style={{width: '80px', marginLeft: '5px'}} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-box box-17">
                  <label>17. NAME OF REFERRING PHYSICIAN OR OTHER SOURCE</label>
                  <input type="text" readOnly={!editMode} />
                </div>
                <div className="form-box box-17a">
                  <label>17a. I.D. NUMBER OF REFERRING PHYSICIAN</label>
                  <input type="text" readOnly={!editMode} />
                </div>
                <div className="form-box box-18">
                  <label>18. HOSPITALIZATION DATES RELATED TO CURRENT SERVICES</label>
                  <label style={{fontSize: '10px'}}>FROM</label>
                  <input type="text" readOnly={!editMode} style={{width: '80px'}} />
                  <label style={{fontSize: '10px', marginLeft: '10px'}}>TO</label>
                  <input type="text" readOnly={!editMode} style={{width: '80px', marginLeft: '5px'}} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-box box-19">
                  <label>19. RESERVED FOR LOCAL USE</label>
                  <input type="text" readOnly={!editMode} />
                </div>
                <div className="form-box box-20">
                  <label>20. OUTSIDE LAB?</label>
                  <div className="checkbox-row">
                    <label><input type="checkbox" disabled={!editMode} /> YES</label>
                    <label><input type="checkbox" disabled={!editMode} /> NO</label>
                  </div>
                  <label>$ CHARGES</label>
                  <input type="text" readOnly={!editMode} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-box box-21">
                  <label>21. DIAGNOSIS OR NATURE OF ILLNESS OR INJURY (RELATE ITEMS 1,2,3 OR 4 TO ITEM 24E BY LINE)</label>
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px'}}>
                    <div>
                      <strong>1.</strong> <input type="text" value={(claim.diagnosisCodes || '').split(',')[0] || ''} readOnly={!editMode} style={{width: '90%', marginLeft: '5px'}} />
                    </div>
                    <div>
                      <strong>3.</strong> <input type="text" value={(claim.diagnosisCodes || '').split(',')[2] || ''} readOnly={!editMode} style={{width: '90%', marginLeft: '5px'}} />
                    </div>
                    <div>
                      <strong>2.</strong> <input type="text" value={(claim.diagnosisCodes || '').split(',')[1] || ''} readOnly={!editMode} style={{width: '90%', marginLeft: '5px'}} />
                    </div>
                    <div>
                      <strong>4.</strong> <input type="text" value={(claim.diagnosisCodes || '').split(',')[3] || ''} readOnly={!editMode} style={{width: '90%', marginLeft: '5px'}} />
                    </div>
                  </div>
                </div>
                <div className="form-box box-22">
                  <label>22. MEDICAID RESUBMISSION CODE</label>
                  <input type="text" readOnly={!editMode} />
                  <label>ORIGINAL REF. NO.</label>
                  <input type="text" readOnly={!editMode} />
                </div>
                <div className="form-box box-23">
                  <label>23. PRIOR AUTHORIZATION NUMBER</label>
                  <input type="text" readOnly={!editMode} />
                </div>
              </div>
            </div>

            {/* Box 24: Service Lines */}
            <div className="service-section">
              <div className="service-header">
                <div className="col-a">24. A<br/>DATE(S) OF SERVICE<br/>From<br/>MM DD YY</div>
                <div className="col-a">To<br/>MM DD YY</div>
                <div className="col-b">B<br/>Place of Service</div>
                <div className="col-c">C<br/>EMG</div>
                <div className="col-d">D<br/>PROCEDURES, SERVICES, OR SUPPLIES<br/>CPT/HCPCS</div>
                <div className="col-d">MODIFIER</div>
                <div className="col-e">E<br/>DIAGNOSIS CODE</div>
                <div className="col-f">F<br/>$ CHARGES</div>
                <div className="col-g">G<br/>DAYS OR UNITS</div>
                <div className="col-h">H<br/>EPSDT Family Plan</div>
                <div className="col-i">I<br/>ID QUAL</div>
                <div className="col-j">J<br/>RENDERING PROVIDER ID. #</div>
              </div>

              {/* Service lines */}
              {[...Array(6)].map((_, idx) => {
                const item = claim.lineItems?.[idx];
                return (
                  <div key={idx} className="service-row">
                    <div className="col-a">{item ? formatDate(item.serviceDate || claim.serviceDate) : ''}</div>
                    <div className="col-a">{item ? formatDate(item.serviceDateTo || claim.serviceDate) : ''}</div>
                    <div className="col-b">{item?.placeOfService || ''}</div>
                    <div className="col-c"></div>
                    <div className="col-d">{item?.procedureCode || ''}</div>
                    <div className="col-d"></div>
                    <div className="col-e">{item ? 'A' : ''}</div>
                    <div className="col-f">{item ? formatCurrency(item.chargeAmount) : ''}</div>
                    <div className="col-g">{item?.units || ''}</div>
                    <div className="col-h"></div>
                    <div className="col-i"></div>
                    <div className="col-j">{item ? claim.renderingProviderNPI : ''}</div>
                  </div>
                );
              })}
            </div>

            {/* Boxes 25-33 */}
            <div className="bottom-section">
              <div className="form-row">
                <div className="form-box box-25">
                  <label>25. FEDERAL TAX I.D. NUMBER</label>
                  <input type="text" value={claim.billingProviderTaxId || ''} readOnly={!editMode} />
                  <div className="checkbox-row">
                    <label><input type="checkbox" disabled={!editMode} /> SSN</label>
                    <label><input type="checkbox" checked disabled={!editMode} /> EIN</label>
                  </div>
                </div>
                <div className="form-box box-26">
                  <label>26. PATIENT'S ACCOUNT NO.</label>
                  <input type="text" value={claim.patientAccountNumber || claim.ghlContactId} readOnly={!editMode} />
                </div>
                <div className="form-box box-27">
                  <label>27. ACCEPT ASSIGNMENT?<br/>(For govt. claims, see back)</label>
                  <div className="checkbox-row">
                    <label><input type="checkbox" checked disabled={!editMode} /> YES</label>
                    <label><input type="checkbox" disabled={!editMode} /> NO</label>
                  </div>
                </div>
                <div className="form-box box-28">
                  <label>28. TOTAL CHARGE</label>
                  <div className="total-value">$ {formatCurrency(claim.totalAmount)}</div>
                </div>
                <div className="form-box box-29">
                  <label>29. AMOUNT PAID</label>
                  <div className="total-value">$ {formatCurrency(claim.paidAmount)}</div>
                </div>
                <div className="form-box box-30">
                  <label>30. BALANCE DUE</label>
                  <div className="total-value">$ {formatCurrency(claim.totalAmount - claim.paidAmount)}</div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-box box-31">
                  <label>31. SIGNATURE OF PHYSICIAN OR SUPPLIER INCLUDING DEGREES OR CREDENTIALS<br/>(I certify that the statements on the reverse apply to this bill and are made a part thereof.)</label>
                  <div className="signature-line">SIGNED___________________________</div>
                  <label>DATE_______________</label>
                </div>
                <div className="form-box box-32">
                  <label>32. NAME AND ADDRESS OF FACILITY WHERE SERVICES WERE RENDERED (If other than home or office)</label>
                  <input type="text" value={claim.facilityName || ''} readOnly={!editMode} />
                  <input type="text" value={claim.facilityAddress1 || ''} readOnly={!editMode} />
                  <input type="text" value={`${claim.facilityCity || ''}, ${claim.facilityState || ''} ${claim.facilityZip || ''}`} readOnly={!editMode} />
                  <label>NPI: {claim.facilityNPI || ''}</label>
                </div>
                <div className="form-box box-33">
                  <label>33. PHYSICIAN'S, SUPPLIER'S BILLING NAME, ADDRESS, ZIP CODE & PHONE #</label>
                  <input type="text" value={claim.billingProviderName || ''} readOnly={!editMode} />
                  <input type="text" value={claim.billingProviderAddress1 || ''} readOnly={!editMode} />
                  <input type="text" value={`${claim.billingProviderCity || ''}, ${claim.billingProviderState || ''} ${claim.billingProviderZip || ''}`} readOnly={!editMode} />
                  <label>PIN#___________ GRP#___________</label>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="form-footer">
              <div>(APPROVED BY AMA COUNCIL ON MEDICAL SERVICE 8/88)</div>
              <div>PLEASE PRINT OR TYPE</div>
              <div>FORM HCFA-1500 (12-90), FORM RRB-1500, FORM OWCP-1500</div>
            </div>

            {/* Status Badge */}
            <div className="claim-status-badge no-print">
              <span className={`badge badge-lg badge-${claim.status}`}>
                STATUS: {claim.status?.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaimDetail;