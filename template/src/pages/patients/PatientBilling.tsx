import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import CommonFooter from '../../components/common-footer/commonFooter';
import AutoBreadcrumb from '../../components/breadcrumb/AutoBreadcrumb';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

// Built-in payers list
const BUILT_IN_PAYERS = [
  { id: 'BCBS', name: 'Blue Cross Blue Shield', payerId: '00060' },
  { id: 'AETNA', name: 'Aetna', payerId: '60054' },
  { id: 'CIGNA', name: 'Cigna', payerId: '62308' },
  { id: 'UNITED', name: 'UnitedHealthcare', payerId: '87726' },
  { id: 'HUMANA', name: 'Humana', payerId: '61101' },
  { id: 'MEDICARE', name: 'Medicare', payerId: 'CMS' },
  { id: 'MEDICAID', name: 'Medicaid', payerId: 'SKMD0' },
  { id: 'TRICARE', name: 'Tricare', payerId: '99726' },
];

const PatientBilling = () => {
  const { id } = useParams();
  const [patient, setPatient] = useState<any>(null);
  const [billing, setBilling] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'card',
    reference: '',
    note: ''
  });

  // Claims state
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [feeSchedule, setFeeSchedule] = useState<any[]>([]);
  const [progressNotes, setProgressNotes] = useState<any[]>([]);
  const [claimForm, setClaimForm] = useState({
    payerId: '',
    payerName: '',
    memberId: '',
    groupNumber: '',
    cptCode: '',
    chargeAmount: '',
    diagnosisCodes: [''],
    placeOfService: '11',
    modifiers: ['', '', '', '']
  });

  // Helper function to get locationId from localStorage
  const getLocationId = () => localStorage.getItem("locationId") || "";

  useEffect(() => {
    if (id) {
      fetchPatient();
      fetchBilling();
      fetchProgressNotes();
      fetchFeeSchedule();
    }
  }, [id]);

  const fetchPatient = async () => {
    try {
      const locationId = getLocationId();
      const response = await axios.get(`${API_URL}/api/patients/${id}`, {
        params: { locationId }
      });
      if (response.data.success) {
        setPatient(response.data.patient);
      }
    } catch (error) {
      console.error('Error fetching patient:', error);
    }
  };

  const fetchBilling = async () => {
    try {
      setLoading(true);
      const locationId = getLocationId();
      const response = await axios.get(`${API_URL}/api/patients/${id}/billing`, {
        params: { locationId }
      });
      if (response.data.success) {
        setBilling(response.data.billing);
      }
    } catch (error) {
      console.error('Error fetching billing:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgressNotes = async () => {
    try {
      const locationId = getLocationId();
      const response = await axios.get(`${API_URL}/api/patients/${id}/progress-notes`, {
        params: { locationId }
      });
      if (response.data.success) {
        // Filter notes that haven't been billed yet
        const unbilledNotes = response.data.notes.filter(
          (note: any) => !note.claimSubmitted && note.status === 'signed'
        );
        setProgressNotes(unbilledNotes);
      }
    } catch (error) {
      console.error('Error fetching progress notes:', error);
    }
  };

  const fetchFeeSchedule = async () => {
    try {
      const locationId = getLocationId();
      const response = await axios.get(`${API_URL}/api/fee-schedule`, {
        params: { locationId }
      });
      if (response.data.success) {
        setFeeSchedule(response.data.feeSchedule || []);
      }
    } catch (error) {
      console.error('Error fetching fee schedule:', error);
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setSavingPayment(true);
    try {
      const locationId = getLocationId();
      await axios.post(`${API_URL}/api/patients/${id}/payments`, paymentForm, {
        params: { locationId }
      });
      alert('Payment recorded successfully!');
      setShowPaymentModal(false);
      setPaymentForm({ amount: '', method: 'card', reference: '', note: '' });
      fetchBilling();
    } catch (error: any) {
      alert(`Error recording payment: ${error.message}`);
    } finally {
      setSavingPayment(false);
    }
  };

  const openClaimModal = (note: any) => {
    setSelectedNote(note);
    
    // Pre-fill with patient insurance info if available
    const insurance = patient?.customFields?.find((cf: any) => 
      cf.key === 'insurance_info' || cf.key === 'primary_insurance'
    );
    
    // Find default CPT code based on session type
    const defaultCpt = feeSchedule.find(fee => 
      fee.description?.toLowerCase().includes(note.sessionType?.toLowerCase())
    );

    setClaimForm({
      payerId: insurance?.payerId || '',
      payerName: insurance?.payerName || '',
      memberId: insurance?.memberId || patient?.customFields?.find((cf: any) => cf.key === 'member_id')?.value || '',
      groupNumber: insurance?.groupNumber || '',
      cptCode: defaultCpt?.cptCode || '90837',
      chargeAmount: defaultCpt?.rate?.toString() || '150.00',
      diagnosisCodes: note.diagnosis?.map((d: any) => d.code) || [''],
      placeOfService: '11',
      modifiers: ['', '', '', '']
    });
    
    setShowClaimModal(true);
  };

  const handleCptChange = (cptCode: string) => {
    const fee = feeSchedule.find(f => f.cptCode === cptCode);
    setClaimForm(prev => ({
      ...prev,
      cptCode,
      chargeAmount: fee?.rate?.toString() || prev.chargeAmount
    }));
  };

  const handlePayerChange = (payerId: string) => {
    const payer = BUILT_IN_PAYERS.find(p => p.id === payerId);
    setClaimForm(prev => ({
      ...prev,
      payerId: payer?.payerId || payerId,
      payerName: payer?.name || ''
    }));
  };

  const addDiagnosisCode = () => {
    setClaimForm(prev => ({
      ...prev,
      diagnosisCodes: [...prev.diagnosisCodes, '']
    }));
  };

  const updateDiagnosisCode = (index: number, value: string) => {
    const updated = [...claimForm.diagnosisCodes];
    updated[index] = value;
    setClaimForm(prev => ({ ...prev, diagnosisCodes: updated }));
  };

  const removeDiagnosisCode = (index: number) => {
    if (claimForm.diagnosisCodes.length > 1) {
      const updated = claimForm.diagnosisCodes.filter((_, i) => i !== index);
      setClaimForm(prev => ({ ...prev, diagnosisCodes: updated }));
    }
  };

  const handleSubmitClaim = async () => {
    if (!claimForm.payerId || !claimForm.memberId || !claimForm.cptCode) {
      alert('Please fill in all required fields (Payer, Member ID, CPT Code)');
      return;
    }

    if (!claimForm.diagnosisCodes[0]) {
      alert('At least one diagnosis code is required');
      return;
    }

    setSubmittingClaim(true);
    try {
      const locationId = getLocationId();
      const claimData = {
        patientId: id,
        noteId: selectedNote?.id,
        sessionDate: selectedNote?.sessionDate,
        ...claimForm,
        diagnosisCodes: claimForm.diagnosisCodes.filter(code => code.trim() !== ''),
        modifiers: claimForm.modifiers.filter(mod => mod.trim() !== ''),
        chargeAmount: parseFloat(claimForm.chargeAmount)
      };

      const response = await axios.post(`${API_URL}/api/claims/submit`, claimData, {
        params: { locationId }
      });

      if (response.data.success) {
        alert('Claim submitted successfully!');
        setShowClaimModal(false);
        setSelectedNote(null);
        fetchBilling();
        fetchProgressNotes();
      } else {
        alert(`Error: ${response.data.message || 'Failed to submit claim'}`);
      }
    } catch (error: any) {
      alert(`Error submitting claim: ${error.response?.data?.message || error.message}`);
    } finally {
      setSubmittingClaim(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="badge bg-success">Paid</span>;
      case 'denied':
        return <span className="badge bg-danger">Denied</span>;
      case 'submitted':
        return <span className="badge bg-info">Submitted</span>;
      case 'pending':
        return <span className="badge bg-warning text-dark">Pending</span>;
      case 'accepted':
        return <span className="badge bg-primary">Accepted</span>;
      default:
        return <span className="badge bg-secondary">{status}</span>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status" />
            <p className="mt-2">Loading billing information...</p>
          </div>
        </div>
      </div>
    );
  }

  const summary = billing?.summary || {
    totalBilled: 0,
    totalInsurancePaid: 0,
    totalAdjustments: 0,
    totalPatientResponsibility: 0,
    totalPatientPaid: 0,
    patientBalance: 0
  };

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <AutoBreadcrumb title="Patient Billing" />

          {/* Patient Header */}
          {patient && (
            <div className="card mb-3 bg-light">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h5 className="mb-1">{patient.firstName} {patient.lastName}</h5>
                    <p className="text-muted mb-0">Patient ID: {patient.id}</p>
                  </div>
                  <div>
                    <Link to={`/patients/${id}`} className="btn btn-outline-primary me-2">
                      <i className="ti ti-arrow-left me-1" />Back to Patient
                    </Link>
                    <Link to={`/patients/${id}/progress-notes`} className="btn btn-outline-secondary">
                      <i className="ti ti-notes me-1" />Progress Notes
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Account Summary */}
          <div className="row mb-4">
            <div className="col-md-2">
              <div className="card bg-primary text-white">
                <div className="card-body text-center py-3">
                  <h6 className="mb-1">Total Billed</h6>
                  <h4 className="mb-0">{formatCurrency(summary.totalBilled)}</h4>
                </div>
              </div>
            </div>
            <div className="col-md-2">
              <div className="card bg-success text-white">
                <div className="card-body text-center py-3">
                  <h6 className="mb-1">Insurance Paid</h6>
                  <h4 className="mb-0">{formatCurrency(summary.totalInsurancePaid)}</h4>
                </div>
              </div>
            </div>
            <div className="col-md-2">
              <div className="card bg-secondary text-white">
                <div className="card-body text-center py-3">
                  <h6 className="mb-1">Adjustments</h6>
                  <h4 className="mb-0">{formatCurrency(summary.totalAdjustments)}</h4>
                </div>
              </div>
            </div>
            <div className="col-md-2">
              <div className="card bg-warning text-dark">
                <div className="card-body text-center py-3">
                  <h6 className="mb-1">Patient Owes</h6>
                  <h4 className="mb-0">{formatCurrency(summary.totalPatientResponsibility)}</h4>
                </div>
              </div>
            </div>
            <div className="col-md-2">
              <div className="card bg-info text-white">
                <div className="card-body text-center py-3">
                  <h6 className="mb-1">Patient Paid</h6>
                  <h4 className="mb-0">{formatCurrency(summary.totalPatientPaid)}</h4>
                </div>
              </div>
            </div>
            <div className="col-md-2">
              <div className={`card ${summary.patientBalance > 0 ? 'bg-danger' : 'bg-success'} text-white`}>
                <div className="card-body text-center py-3">
                  <h6 className="mb-1">Balance Due</h6>
                  <h4 className="mb-0">{formatCurrency(summary.patientBalance)}</h4>
                </div>
              </div>
            </div>
          </div>

          {/* Unbilled Sessions */}
          {progressNotes.length > 0 && (
            <div className="card mb-4 border-warning">
              <div className="card-header bg-warning bg-opacity-10">
                <h5 className="card-title mb-0 text-warning">
                  <i className="ti ti-alert-triangle me-2" />
                  Unbilled Sessions ({progressNotes.length})
                </h5>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead className="table-light">
                      <tr>
                        <th>Date</th>
                        <th>Session Type</th>
                        <th>Duration</th>
                        <th>Provider</th>
                        <th className="text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progressNotes.map((note: any) => (
                        <tr key={note.id}>
                          <td>{formatDate(note.sessionDate)}</td>
                          <td>{note.sessionType || 'Individual Therapy'}</td>
                          <td>{note.sessionDuration || 53} min</td>
                          <td>{note.providerName || 'Provider'}</td>
                          <td className="text-end">
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => openClaimModal(note)}
                            >
                              <i className="ti ti-send me-1" />Submit Claim
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Claims */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">
                <i className="ti ti-file-invoice me-2" />
                Insurance Claims
              </h5>
            </div>
            <div className="card-body">
              {billing?.claims?.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead className="table-light">
                      <tr>
                        <th>Date</th>
                        <th>Service</th>
                        <th>Payer</th>
                        <th className="text-end">Billed</th>
                        <th className="text-end">Ins Paid</th>
                        <th className="text-end">Adjustment</th>
                        <th className="text-end">Patient Owes</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billing.claims.map((claim: any) => (
                        <tr key={claim.id}>
                          <td>{formatDate(claim.sessionDate)}</td>
                          <td>
                            <span className="badge bg-primary">{claim.cptCode}</span>
                          </td>
                          <td>{claim.payerName}</td>
                          <td className="text-end">{formatCurrency(claim.chargeAmount)}</td>
                          <td className="text-end text-success">
                            {claim.paymentInfo ? formatCurrency(claim.paymentInfo.paymentAmount) : '-'}
                          </td>
                          <td className="text-end text-muted">
                            {claim.paymentInfo ? formatCurrency(claim.paymentInfo.contractualAdjustment) : '-'}
                          </td>
                          <td className="text-end text-warning">
                            {claim.paymentInfo ? formatCurrency(claim.paymentInfo.patientResponsibility) : '-'}
                          </td>
                          <td>{getStatusBadge(claim.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4 text-muted">
                  <i className="ti ti-file-off fs-48 d-block mb-2" />
                  <p>No claims found</p>
                  <Link to={`/patients/${id}/progress-notes`} className="btn btn-primary btn-sm">
                    Go to Progress Notes to Submit Claims
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Patient Payments */}
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="card-title mb-0">
                <i className="ti ti-cash me-2" />
                Patient Payments
              </h5>
              <button className="btn btn-sm btn-success" onClick={() => setShowPaymentModal(true)}>
                <i className="ti ti-plus me-1" />Record Payment
              </button>
            </div>
            <div className="card-body">
              {billing?.payments?.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead className="table-light">
                      <tr>
                        <th>Date</th>
                        <th className="text-end">Amount</th>
                        <th>Method</th>
                        <th>Reference</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billing.payments.map((payment: any) => (
                        <tr key={payment.id}>
                          <td>{formatDate(payment.date)}</td>
                          <td className="text-end text-success fw-bold">{formatCurrency(payment.amount)}</td>
                          <td>
                            <span className="badge bg-secondary">
                              {payment.method === 'card' && <i className="ti ti-credit-card me-1" />}
                              {payment.method === 'cash' && <i className="ti ti-cash me-1" />}
                              {payment.method === 'check' && <i className="ti ti-file-check me-1" />}
                              {payment.method}
                            </span>
                          </td>
                          <td>{payment.reference || '-'}</td>
                          <td>{payment.note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4 text-muted">
                  <i className="ti ti-receipt-off fs-48 d-block mb-2" />
                  <p>No payments recorded</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="ti ti-cash me-2" />Record Patient Payment
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowPaymentModal(false)} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Amount *</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="0.00"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label">Payment Method</label>
                  <select
                    className="form-select"
                    value={paymentForm.method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                  >
                    <option value="card">Credit/Debit Card</option>
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                    <option value="ach">ACH/Bank Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Reference # (optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Check number, transaction ID, etc."
                    value={paymentForm.reference}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Note (optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Copay, previous balance, etc."
                    value={paymentForm.note}
                    onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleRecordPayment}
                  disabled={savingPayment}
                >
                  {savingPayment ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="ti ti-check me-1" />
                      Record Payment
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submit Claim Modal */}
      {showClaimModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="ti ti-send me-2" />Submit Insurance Claim
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowClaimModal(false)} />
              </div>
              <div className="modal-body">
                {selectedNote && (
                  <div className="alert alert-info mb-3">
                    <strong>Session:</strong> {formatDate(selectedNote.sessionDate)} - {selectedNote.sessionType || 'Individual Therapy'}
                  </div>
                )}

                <div className="row">
                  {/* Insurance Info */}
                  <div className="col-md-6">
                    <h6 className="border-bottom pb-2 mb-3">Insurance Information</h6>
                    
                    <div className="mb-3">
                      <label className="form-label">Insurance Payer *</label>
                      <select
                        className="form-select"
                        value={claimForm.payerId}
                        onChange={(e) => handlePayerChange(e.target.value)}
                      >
                        <option value="">Select Payer...</option>
                        {BUILT_IN_PAYERS.map(payer => (
                          <option key={payer.id} value={payer.id}>{payer.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Member ID *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter member ID"
                        value={claimForm.memberId}
                        onChange={(e) => setClaimForm({ ...claimForm, memberId: e.target.value })}
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Group Number</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter group number (optional)"
                        value={claimForm.groupNumber}
                        onChange={(e) => setClaimForm({ ...claimForm, groupNumber: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Service Info */}
                  <div className="col-md-6">
                    <h6 className="border-bottom pb-2 mb-3">Service Information</h6>
                    
                    <div className="mb-3">
                      <label className="form-label">CPT Code *</label>
                      <select
                        className="form-select"
                        value={claimForm.cptCode}
                        onChange={(e) => handleCptChange(e.target.value)}
                      >
                        <option value="">Select CPT Code...</option>
                        {feeSchedule.length > 0 ? (
                          feeSchedule.map(fee => (
                            <option key={fee.cptCode} value={fee.cptCode}>
                              {fee.cptCode} - {fee.description} (${fee.rate})
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="90791">90791 - Psychiatric Diagnostic Evaluation ($200)</option>
                            <option value="90832">90832 - Psychotherapy 16-37 min ($75)</option>
                            <option value="90834">90834 - Psychotherapy 38-52 min ($120)</option>
                            <option value="90837">90837 - Psychotherapy 53+ min ($150)</option>
                            <option value="90846">90846 - Family Therapy w/o Patient ($150)</option>
                            <option value="90847">90847 - Family Therapy w/ Patient ($150)</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Charge Amount *</label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="0.00"
                          value={claimForm.chargeAmount}
                          onChange={(e) => setClaimForm({ ...claimForm, chargeAmount: e.target.value })}
                          step="0.01"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Place of Service</label>
                      <select
                        className="form-select"
                        value={claimForm.placeOfService}
                        onChange={(e) => setClaimForm({ ...claimForm, placeOfService: e.target.value })}
                      >
                        <option value="11">11 - Office</option>
                        <option value="02">02 - Telehealth</option>
                        <option value="10">10 - Telehealth (Patient Home)</option>
                        <option value="12">12 - Home</option>
                        <option value="53">53 - Community Mental Health Center</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Diagnosis Codes */}
                <h6 className="border-bottom pb-2 mb-3 mt-3">Diagnosis Codes (ICD-10)</h6>
                {claimForm.diagnosisCodes.map((code, index) => (
                  <div key={index} className="row mb-2">
                    <div className="col">
                      <div className="input-group">
                        <span className="input-group-text">{index + 1}</span>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g., F32.1"
                          value={code}
                          onChange={(e) => updateDiagnosisCode(index, e.target.value)}
                        />
                        {claimForm.diagnosisCodes.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-outline-danger"
                            onClick={() => removeDiagnosisCode(index)}
                          >
                            <i className="ti ti-trash" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {claimForm.diagnosisCodes.length < 4 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={addDiagnosisCode}
                  >
                    <i className="ti ti-plus me-1" />Add Diagnosis
                  </button>
                )}

                {/* Modifiers */}
                <h6 className="border-bottom pb-2 mb-3 mt-4">Modifiers (Optional)</h6>
                <div className="row">
                  {claimForm.modifiers.map((mod, index) => (
                    <div key={index} className="col-md-3 mb-2">
                      <input
                        type="text"
                        className="form-control"
                        placeholder={`Mod ${index + 1}`}
                        value={mod}
                        onChange={(e) => {
                          const updated = [...claimForm.modifiers];
                          updated[index] = e.target.value.toUpperCase();
                          setClaimForm({ ...claimForm, modifiers: updated });
                        }}
                        maxLength={2}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowClaimModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSubmitClaim}
                  disabled={submittingClaim}
                >
                  {submittingClaim ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <i className="ti ti-send me-1" />
                      Submit Claim
                    </>
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

export default PatientBilling;