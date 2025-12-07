import { Link, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';
import CommonFooter from '../../components/common-footer/commonFooter';
import AutoBreadcrumb from '../../components/breadcrumb/AutoBreadcrumb';
import config from '../../config';

const API_URL = config.apiUrl;
const LOCATION_ID = config.ghlLocationId;

interface Appointment {
  id: string;
  dateOfService: string;
  cptCode: string;
  billedAmount: number;
  clientOwes: number;
  insurancePaid: number;
  writeOff: number;
  ghlInvoiceId?: string; // Added this line
}

interface Payer {
  id: string;
  name: string;
}

const AddInsurancePayment = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  
  // Form state
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedPayer, setSelectedPayer] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNumber, setPaymentNumber] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [unallocated, setUnallocated] = useState(0);
  
  // Data state
  const [payers, setPayers] = useState<Payer[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    fetchPayers();
    if (clientId) {
      fetchAppointments(clientId);
    }
  }, [clientId]);

  useEffect(() => {
    // Calculate unallocated amount
    const total = parseFloat(totalAmount) || 0;
    const allocated = appointments.reduce((sum, apt) => sum + (apt.insurancePaid || 0), 0);
    setUnallocated(total - allocated);
  }, [totalAmount, appointments]);

  const fetchPayers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/payers`, {
        params: { locationId: LOCATION_ID }
      });
      
      if (response.data.success) {
        setPayers(response.data.payers || []);
      }
    } catch (error) {
      console.error('Error fetching payers:', error);
    }
  };

  const fetchAppointments = async (patientId: string) => {
    try {
      // First, fetch GHL invoices for this patient
      const invoiceResponse = await axios.get(`${API_URL}/api/ghl/invoices/${patientId}`, {
        params: { locationId: LOCATION_ID }
      });
      
      if (invoiceResponse.data.success && invoiceResponse.data.invoices.length > 0) {
        // Transform GHL invoices into payment allocation format
        const invoices = invoiceResponse.data.invoices.map((invoice: any) => {
          const totalBilled = invoice.total || 0;
          const totalPaid = invoice.amountPaid || 0;
          const remainingBalance = totalBilled - totalPaid;

          return {
            id: invoice._id || invoice.id,
            dateOfService: invoice.createdAt,
            invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id?.substring(0, 8)}`,
            cptCode: invoice.name || 'Service',
            billedAmount: totalBilled / 100, // Convert from cents
            clientOwes: remainingBalance / 100,
            insurancePaid: 0,
            writeOff: 0,
            status: invoice.status,
            ghlInvoiceId: invoice._id || invoice.id
          };
        });

        // Filter to only unpaid or partially paid invoices
        const billableInvoices = invoices.filter((inv: any) => 
          inv.status !== 'paid' && inv.clientOwes > 0
        );
        
        setAppointments(billableInvoices);
        console.log(`✅ Loaded ${billableInvoices.length} billable invoices from GHL`);
        return;
      }

      // Fallback: If no invoices, fetch appointments
      const response = await axios.get(`${API_URL}/api/appointments`, {
        params: { 
          locationId: LOCATION_ID,
          contactId: patientId
        }
      });
      
      if (response.data.success) {
        const appts = response.data.appointments.map((apt: any) => ({
          id: apt.id,
          dateOfService: apt.startTime || apt.date,
          appointmentType: apt.title || 'Therapy Session',
          cptCode: apt.appointmentType || '90834',
          billedAmount: 150.00, // Default session fee
          clientOwes: 150.00,
          insurancePaid: 0,
          writeOff: 0,
          status: apt.appointmentStatus || 'completed'
        }));
        
        setAppointments(appts.filter((apt: any) => apt.status === 'confirmed' || apt.status === 'showed'));
      }
    } catch (error) {
      console.error('Error fetching invoices/appointments:', error);
      setAppointments([]);
    }
  };

  const handleAppointmentChange = (index: number, field: 'insurancePaid' | 'writeOff', value: string) => {
    const numValue = parseFloat(value) || 0;
    const updatedAppointments = [...appointments];
    
    // Validate that insurance paid doesn't exceed billed amount
    if (field === 'insurancePaid') {
      if (numValue > updatedAppointments[index].billedAmount) {
        setErrors({
          ...errors,
          [`appointment-${index}`]: 'Insurance paid cannot exceed billed amount'
        });
        return;
      } else {
        const newErrors = { ...errors };
        delete newErrors[`appointment-${index}`];
        setErrors(newErrors);
      }
    }
    
    updatedAppointments[index][field] = numValue;
    setAppointments(updatedAppointments);
  };

  const validateForm = () => {
    const newErrors: any = {};
    
    if (!paymentDate) newErrors.paymentDate = 'Payment date is required';
    if (!selectedPayer) newErrors.payer = 'Payer is required';
    if (!paymentMethod) newErrors.paymentMethod = 'Payment method is required';
    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      newErrors.totalAmount = 'Valid amount is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSavePayment = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // 1. Save payment locally
      const localPaymentResponse = await axios.post(`${API_URL}/api/payments`, {
        locationId: LOCATION_ID,
        clientId: clientId,
        paymentDate,
        payerId: selectedPayer,
        paymentMethod,
        paymentNumber,
        totalAmount: parseFloat(totalAmount),
        appointments: appointments.filter(apt => apt.insurancePaid > 0 || apt.writeOff > 0)
      });

      if (!localPaymentResponse.data.success) {
        throw new Error('Failed to save payment locally');
      }

      // 2. Record payments directly to each invoice in GHL
      for (const apt of appointments) {
        if (apt.insurancePaid > 0 && apt.ghlInvoiceId) {
          try {
            // Use GHL's "Record Manual Payment" endpoint
            await axios.post(
              `${API_URL}/api/ghl/invoices/${apt.ghlInvoiceId}/payment`,
              {
                amount: apt.insurancePaid * 100, // Convert to cents
                notes: `Insurance payment from ${payers.find(p => p.id === selectedPayer)?.name || 'payer'} - Check #${paymentNumber || 'N/A'} - Date: ${paymentDate}`
              }
            );
            
            console.log(`✅ Payment recorded for invoice ${apt.ghlInvoiceId}`);
          } catch (invoiceError: any) {
            console.error(`❌ Error recording payment for invoice ${apt.ghlInvoiceId}:`, invoiceError);
            // Continue with other invoices even if one fails
          }
        }
      }

      alert('✅ Payment saved successfully and synced to GHL!');
      navigate(clientId ? `/patients/${clientId}` : '/insurance');
    } catch (error: any) {
      console.error('❌ Error saving payment:', error);
      alert(`Failed to save payment: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <AutoBreadcrumb title="Add Insurance Payment" />

          {/* Payment Details Card */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">Payment Details</h5>
            </div>
            <div className="card-body">
              <div className="row g-3">
                {/* Payment Date */}
                <div className="col-md-6 col-lg-4">
                  <label className="form-label">
                    Payment Date <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    className={`form-control ${errors.paymentDate ? 'is-invalid' : ''}`}
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                  {errors.paymentDate && (
                    <div className="invalid-feedback">{errors.paymentDate}</div>
                  )}
                </div>

                {/* Payer */}
                <div className="col-md-6 col-lg-4">
                  <label className="form-label">
                    Payer <span className="text-danger">*</span>
                  </label>
                  <select
                    className={`form-select ${errors.payer ? 'is-invalid' : ''}`}
                    value={selectedPayer}
                    onChange={(e) => setSelectedPayer(e.target.value)}
                  >
                    <option value="">Select Payer...</option>
                    {payers.map((payer) => (
                      <option key={payer.id} value={payer.id}>
                        {payer.name}
                      </option>
                    ))}
                  </select>
                  {errors.payer && (
                    <div className="invalid-feedback">{errors.payer}</div>
                  )}
                </div>

                {/* Payment Method */}
                <div className="col-md-6 col-lg-4">
                  <label className="form-label">
                    Payment Method <span className="text-danger">*</span>
                  </label>
                  <select
                    className={`form-select ${errors.paymentMethod ? 'is-invalid' : ''}`}
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="">Select Method...</option>
                    <option value="check">Check</option>
                    <option value="eft">EFT</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.paymentMethod && (
                    <div className="invalid-feedback">{errors.paymentMethod}</div>
                  )}
                </div>

                {/* Payment Number */}
                <div className="col-md-6 col-lg-4">
                  <label className="form-label">Payment Number</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Check or transaction number"
                    value={paymentNumber}
                    onChange={(e) => setPaymentNumber(e.target.value)}
                  />
                </div>

                {/* Total Amount */}
                <div className="col-md-6 col-lg-4">
                  <label className="form-label">
                    Amount <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className={`form-control ${errors.totalAmount ? 'is-invalid' : ''}`}
                    placeholder="0.00"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                  />
                  {errors.totalAmount && (
                    <div className="invalid-feedback">{errors.totalAmount}</div>
                  )}
                </div>

                {/* Unallocated */}
                <div className="col-md-6 col-lg-4">
                  <label className="form-label">Unallocated</label>
                  <input
                    type="text"
                    className={`form-control ${unallocated < 0 ? 'is-invalid' : ''}`}
                    value={formatCurrency(unallocated)}
                    readOnly
                    style={{ 
                      backgroundColor: '#f8f9fa',
                      fontWeight: unallocated !== 0 ? 'bold' : 'normal',
                      color: unallocated < 0 ? '#dc3545' : unallocated > 0 ? '#ffc107' : '#198754'
                    }}
                  />
                  {unallocated < 0 && (
                    <div className="invalid-feedback d-block">
                      Cannot allocate more than payment amount
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Appointment Association */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">Allocate to Appointments</h5>
            </div>
            <div className="card-body">
              {appointments.length === 0 ? (
                <div className="text-center py-5">
                  <i className="ti ti-calendar-off fs-48 text-muted mb-3 d-block" />
                  <p className="text-muted">No appointments found for this client</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Date of Service</th>
                        <th>CPT Code</th>
                        <th className="text-end">Billed Amount</th>
                        <th className="text-end">Client Owes</th>
                        <th className="text-end">Insurance Paid</th>
                        <th className="text-end">Write-Off</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.map((apt, index) => (
                        <tr key={apt.id}>
                          <td>{formatDate(apt.dateOfService)}</td>
                          <td>
                            <span className="badge badge-soft-primary">{apt.cptCode}</span>
                          </td>
                          <td className="text-end">{formatCurrency(apt.billedAmount)}</td>
                          <td className="text-end">{formatCurrency(apt.clientOwes)}</td>
                          <td className="text-end">
                            <input
                              type="number"
                              step="0.01"
                              className={`form-control form-control-sm text-end ${
                                errors[`appointment-${index}`] ? 'is-invalid' : ''
                              }`}
                              style={{ width: '120px', display: 'inline-block' }}
                              value={apt.insurancePaid || ''}
                              onChange={(e) => handleAppointmentChange(index, 'insurancePaid', e.target.value)}
                            />
                            {errors[`appointment-${index}`] && (
                              <div className="invalid-feedback d-block text-end">
                                {errors[`appointment-${index}`]}
                              </div>
                            )}
                          </td>
                          <td className="text-end">
                            <input
                              type="number"
                              step="0.01"
                              className="form-control form-control-sm text-end"
                              style={{ width: '120px', display: 'inline-block' }}
                              value={apt.writeOff || ''}
                              onChange={(e) => handleAppointmentChange(index, 'writeOff', e.target.value)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="d-flex justify-content-end gap-2 mb-4">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSavePayment}
              disabled={loading || unallocated < 0}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Saving...
                </>
              ) : (
                <>
                  <i className="ti ti-device-floppy me-1" />
                  Save Payment
                </>
              )}
            </button>
          </div>
        </div>
        <CommonFooter />
      </div>
    </>
  );
};

export default AddInsurancePayment;