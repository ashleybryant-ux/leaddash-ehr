import { Link, useParams, useNavigate } from "react-router-dom";
import { all_routes } from "../../routes/all_routes";
import { useState, useEffect, useRef } from "react";
import axios from 'axios';
import { auditInvoiceView, auditInvoiceDownload, auditInvoiceSend } from '../../services/auditService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const LOCATION_ID = localStorage.getItem('locationId') || 'puLPmzfdCvfQRANPM2WA';

const InvoiceDetails = () => {
  const { invoiceId, patientId } = useParams();
  const navigate = useNavigate();
  
  const [invoice, setInvoice] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [creatingClaim, setCreatingClaim] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  
  // Track if audit has been logged
  const auditLogged = useRef(false);

  useEffect(() => {
    fetchInvoiceDetails();
  }, [invoiceId, patientId]);

  const fetchInvoiceDetails = async () => {
  setLoading(true);
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const locationId = user.locationId || LOCATION_ID;

    // Fetch invoice
    console.log('📄 Fetching invoice:', invoiceId, 'for patient:', patientId);
    
    const invoiceResponse = await axios.get(`${API_URL}/api/invoices/${patientId}`, {
      headers: { 'x-location-id': locationId }
    });

    console.log('📄 Invoice response:', invoiceResponse.data);

    if (invoiceResponse.data.success) {
      const foundInvoice = invoiceResponse.data.invoices.find(
        (inv: any) => (inv._id || inv.id) === invoiceId
      );
      
      if (!foundInvoice) {
        console.error('❌ Invoice not found in response');
        setLoading(false);
        return; // Don't show alert, just let the UI show "Invoice Not Found"
      }
      
      setInvoice(foundInvoice);
      console.log('✅ Invoice loaded:', foundInvoice);
    } else {
      console.error('❌ Invoice fetch failed:', invoiceResponse.data);
      setLoading(false);
      return;
    }

    // Fetch patient details
    console.log('👤 Fetching patient:', patientId);
    
    const patientResponse = await axios.get(`${API_URL}/api/patients/${patientId}`, {
      params: { locationId }
    });

    console.log('👤 Patient response:', patientResponse.data);

    let patientData = null;
    if (patientResponse.data.success && patientResponse.data.patient) {
      patientData = patientResponse.data.patient;
      setPatient(patientData);
      console.log('✅ Patient loaded:', patientData);
      
      // Log audit event for viewing invoice (only once)
      if (!auditLogged.current && invoiceId && patientId) {
        const foundInvoice = invoiceResponse.data.invoices.find(
          (inv: any) => (inv._id || inv.id) === invoiceId
        );
        const patientName = `${patientData.firstName || ''} ${patientData.lastName || ''}`.trim() || 'Unknown';
        const invoiceNumber = foundInvoice?.invoiceNumber || foundInvoice?.number || invoiceId;
        auditInvoiceView(invoiceId, patientId, patientName, invoiceNumber);
        auditLogged.current = true;
      }
    } else {
      console.warn('⚠️ Patient fetch failed, continuing anyway');
      
      // Still log audit even without patient name
      if (!auditLogged.current && invoiceId && patientId) {
        const foundInvoice = invoiceResponse.data.invoices.find(
          (inv: any) => (inv._id || inv.id) === invoiceId
        );
        const invoiceNumber = foundInvoice?.invoiceNumber || foundInvoice?.number || invoiceId;
        auditInvoiceView(invoiceId, patientId, 'Unknown', invoiceNumber);
        auditLogged.current = true;
      }
    }

    // Fetch completed appointments
    console.log('📅 Fetching appointments for patient:', patientId);
    
    const appointmentsResponse = await axios.get(`${API_URL}/api/appointments`, {
      params: { locationId, contactId: patientId }
    });

    console.log('📅 Appointments response:', appointmentsResponse.data);

    if (appointmentsResponse.data.success && appointmentsResponse.data.appointments) {
      const completedAppts = (appointmentsResponse.data.appointments || [])
        .filter((apt: any) => 
          apt.appointmentStatus === 'showed' || 
          apt.appointmentStatus === 'completed'
        )
        .sort((a: any, b: any) => 
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );
      
      setAppointments(completedAppts);
      console.log(`✅ Loaded ${completedAppts.length} completed appointments`);

      // Auto-select closest appointment
      const foundInvoice = invoiceResponse.data.invoices.find(
        (inv: any) => (inv._id || inv.id) === invoiceId
      );
      
      if (foundInvoice && completedAppts.length > 0) {
        const matched = findAppointmentForInvoice(foundInvoice, completedAppts);
        if (matched) {
          setSelectedAppointmentId(matched.id);
          console.log('✅ Auto-selected appointment:', matched.id);
        }
      }
    } else {
      console.warn('⚠️ No appointments found, continuing anyway');
    }

  } catch (error: any) {
    console.error('❌ Error fetching invoice details:', error);
    
    // Only show alert if it's a real error (not just missing data)
    if (error.response?.status === 404) {
      console.log('Invoice or patient not found (404)');
    } else if (error.response?.status === 500) {
      alert('Server error loading invoice. Please try again.');
    } else if (error.message.includes('Network Error')) {
      alert('Network error. Please check your connection and try again.');
    } else {
      // Don't show alert for other errors, just log them
      console.error('Failed to load invoice details:', error.message);
    }
  } finally {
    setLoading(false);
  }
};

  const findAppointmentForInvoice = (inv: any, apts: any[]) => {
    if (apts.length === 0) return null;

    const invoiceDate = new Date(inv.createdAt || inv.issueDate);
    
    const relevantAppointments = apts.filter((apt: any) => {
      const aptDate = new Date(apt.startTime);
      const daysDiff = (invoiceDate.getTime() - aptDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff >= 0 && daysDiff <= 14;
    });

    if (relevantAppointments.length > 0) {
      return relevantAppointments.sort((a: any, b: any) => {
        const aDiff = Math.abs(invoiceDate.getTime() - new Date(a.startTime).getTime());
        const bDiff = Math.abs(invoiceDate.getTime() - new Date(b.startTime).getTime());
        return aDiff - bDiff;
      })[0];
    }

    return apts[0] || null;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    // Log audit event for downloading invoice
    if (invoice && patient && patientId) {
      const patientName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Unknown';
      const invoiceNumber = invoice.invoiceNumber || invoice.number || invoice._id || invoice.id;
      auditInvoiceDownload(invoice._id || invoice.id, patientId, patientName, invoiceNumber);
    }
    window.print();
  };

  const handleSendToPatient = async () => {
    if (!patient?.email) {
      alert('Patient email address not found. Please update patient information.');
      return;
    }

    if (!confirm(`Send this invoice to ${patient.email}?`)) {
      return;
    }

    setSendingEmail(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const locationId = user.locationId || LOCATION_ID;
      
      const response = await axios.post(
        `${API_URL}/api/invoices/send-email`,
        {
          invoiceId: invoice._id || invoice.id,
          patientId: patientId,
          patientEmail: patient.email,
          invoiceData: invoice
        },
        {
          headers: {
            'x-location-id': locationId
          }
        }
      );

      if (response.data.success) {
        // Log audit event for sending invoice
        const patientName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Unknown';
        auditInvoiceSend(invoice._id || invoice.id, patientId || '', patientName, patient.email);
        
        alert(`✅ Invoice sent successfully to ${patient.email}`);
      } else {
        alert('❌ Failed to send invoice: ' + response.data.error);
      }
    } catch (error: any) {
      console.error('❌ Error sending invoice:', error);
      const subject = `Invoice ${invoice.invoiceNumber || invoice.number || invoice.id?.substring(0, 8)}`;
      const body = `Please find your invoice attached.\n\nInvoice Total: ${formatCurrency(invoice.total || 0)}\nBalance Due: ${formatCurrency((invoice.total || 0) - (invoice.amountPaid || 0))}`;
      window.location.href = `mailto:${patient.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } finally {
      setSendingEmail(false);
    }
  };

  const handleEditInvoice = () => {
  navigate(`/patients/${patientId}/invoices/${invoiceId}/edit`);
};

  const handleCreateClaim = async () => {
    const selectedAppointment = appointments.find(apt => apt.id === selectedAppointmentId);
    
    if (!selectedAppointment) {
      alert('Please select a Date of Service (appointment) for this claim');
      return;
    }

    setCreatingClaim(true);
    try {
      console.log('📋 Creating claim from invoice:', invoice._id || invoice.id);
      console.log('📅 Using service date from appointment:', selectedAppointment.startTime);
      
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const locationId = user.locationId || LOCATION_ID;
      
      const response = await axios.post(
        `${API_URL}/api/claims/from-invoice/${invoice._id || invoice.id}`,
        {
          contactId: patientId,
          invoiceData: invoice,
          appointmentId: selectedAppointment.id,
          appointmentDate: selectedAppointment.startTime,
          serviceDate: selectedAppointment.startTime
        },
        {
          headers: {
            'x-location-id': locationId
          }
        }
      );

      if (response.data.success) {
        alert(`✅ Claim created successfully!\n\nClaim #: ${response.data.claim.claimNumber}\nService Date: ${formatDate(selectedAppointment.startTime)}`);
        navigate(`/insurance/claims/${response.data.claim.id}`);
      } else {
        alert('❌ Failed to create claim: ' + response.data.error);
      }
    } catch (error: any) {
      console.error('❌ Error creating claim:', error);
      alert('❌ Error creating claim: ' + (error.response?.data?.error || error.message));
    } finally {
      setCreatingClaim(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const formatFullDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
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

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2">Loading invoice details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="text-center py-5">
            <i className="ti ti-file-off fs-48 text-muted mb-3 d-block" />
            <h5>Invoice Not Found</h5>
            <p className="text-muted">This invoice doesn't exist or has been deleted</p>
            <Link to={`/patients/${patientId}`} className="btn btn-primary mt-2">
              Back to Patient
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const total = invoice.total || 0;
  const paid = invoice.amountPaid || 0;
  const balance = total - paid;
  const isPaid = balance === 0;
  const selectedAppointment = appointments.find(apt => apt.id === selectedAppointmentId);

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header - Hidden when printing */}
          <div className="no-print">
            <div className="d-flex align-items-center justify-content-between mb-4">
              <div>
                <h4 className="mb-1">Invoice Details</h4>
                <nav aria-label="breadcrumb">
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to={all_routes.dashboard}>Home</Link>
                    </li>
                    <li className="breadcrumb-item">
                      <Link to={`/patients/${patientId}`}>
                        {patient ? `${patient.firstName} ${patient.lastName}` : 'Patient'}
                      </Link>
                    </li>
                    <li className="breadcrumb-item active">Invoice #{invoice.invoiceNumber || invoice.number || invoice.id?.substring(0, 8)}</li>
                  </ol>
                </nav>
              </div>
              <div className="d-flex gap-2">
                <button 
                  className="btn btn-outline-secondary"
                  onClick={handlePrint}
                >
                  <i className="ti ti-printer me-1" />
                  Print
                </button>
                <button 
                  className="btn btn-outline-secondary"
                  onClick={handleDownloadPDF}
                >
                  <i className="ti ti-download me-1" />
                  Download PDF
                </button>
                <button 
                  className="btn btn-outline-primary"
                  onClick={handleSendToPatient}
                  disabled={sendingEmail}
                >
                  {sendingEmail ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <i className="ti ti-send me-1" />
                      Send to Patient
                    </>
                  )}
                </button>
                <Link to={`/patients/${patientId}`} className="btn btn-outline-primary">
                  <i className="ti ti-arrow-left me-1" />
                  Back to Patient
                </Link>
              </div>
            </div>
          </div>

          <div className="row">
            {/* Main Invoice - This is what prints */}
            <div className="col-lg-8 print-full-width">
              <div className="card">
                <div className="card-body p-5" id="printable-invoice">
                  {/* Invoice Header */}
                  <div className="row mb-5">
                    <div className="col-md-6">
                      <h2 className="mb-1">Invoice</h2>
                      <p className="text-muted fs-18 mb-0">
                        #{invoice.invoiceNumber || invoice.number || invoice.id?.substring(0, 8)}
                      </p>
                    </div>
                    <div className="col-md-6 text-md-end">
                      {isPaid && (
                        <div className="mb-3">
                          <span className="badge badge-success fs-20 px-4 py-2">✓ PAID</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bill To & Invoice Info */}
                  <div className="row mb-4">
                    <div className="col-md-6">
                      <h6 className="text-uppercase text-muted mb-2" style={{ fontSize: '11px', letterSpacing: '1px' }}>
                        Bill To
                      </h6>
                      {patient && (
                        <div>
                          <strong className="d-block mb-1">
                            {patient.firstName} {patient.lastName}
                          </strong>
                          {patient.address1 && (
                            <div className="text-muted small">
                              {patient.address1}<br />
                              {patient.city && `${patient.city}, `}
                              {patient.state} {patient.postalCode}
                            </div>
                          )}
                          {patient.email && (
                            <div className="text-muted small mt-1">
                              {patient.email}
                            </div>
                          )}
                          {patient.phone && (
                            <div className="text-muted small">
                              {patient.phone}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <table className="table table-sm table-borderless mb-0">
                        <tbody>
                          <tr>
                            <td className="text-end pe-3" style={{ width: '50%' }}><strong>Invoice Date:</strong></td>
                            <td>{formatDate(invoice.createdAt || invoice.issueDate)}</td>
                          </tr>
                          <tr>
                            <td className="text-end pe-3"><strong>Due Date:</strong></td>
                            <td>{invoice.dueDate ? formatDate(invoice.dueDate) : 'Upon Receipt'}</td>
                          </tr>
                          <tr>
                            <td className="text-end pe-3"><strong>Status:</strong></td>
                            <td>
                              <span className={`badge ${
                                invoice.status === 'paid' ? 'badge-success' :
                                invoice.status === 'partially_paid' ? 'badge-warning' :
                                'badge-info'
                              }`}>
                                {invoice.status?.replace('_', ' ').toUpperCase() || 'PENDING'}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <hr className="my-4" />

                  {/* Line Items WITH Date of Service Column */}
                  <h6 className="mb-3 text-uppercase text-muted" style={{ fontSize: '11px', letterSpacing: '1px' }}>
                    Services
                  </h6>
                  <div className="table-responsive">
                    <table className="table">
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: '120px' }}>Date of Service</th>
                          <th>Description</th>
                          <th className="text-center" style={{ width: '80px' }}>Qty</th>
                          <th className="text-end" style={{ width: '120px' }}>Rate</th>
                          <th className="text-end" style={{ width: '120px' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(invoice.items || invoice.lineItems || invoice.invoiceItems || []).map((item: any, index: number) => {
                          const itemName = item.name || item.title || item.description || item.itemName || item.product || 'Service';
                          const itemDesc = item.description || item.details || item.notes || '';
                          const itemQty = item.quantity || item.qty || item.amount || 1;
                          const itemPrice = item.price || item.unitPrice || item.rate || item.cost || 0;
                          
                          return (
                            <tr key={index}>
                              <td className="dos-cell">
                                {selectedAppointment ? (
                                  <strong className="text-primary">
                                    <i className="ti ti-calendar-check me-1" />
                                    {formatDate(selectedAppointment.startTime)}
                                  </strong>
                                ) : (
                                  <span className="text-muted">
                                    <i className="ti ti-calendar-off me-1" />
                                    Not set
                                  </span>
                                )}
                              </td>
                              <td>
                                <div>
                                  <strong className="d-block">{itemName}</strong>
                                  {itemDesc && itemDesc !== itemName && (
                                    <small className="text-muted">{itemDesc}</small>
                                  )}
                                </div>
                              </td>
                              <td className="text-center">{itemQty}</td>
                              <td className="text-end">{formatCurrency(itemPrice)}</td>
                              <td className="text-end"><strong>{formatCurrency(itemQty * itemPrice)}</strong></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="row justify-content-end mt-4">
                    <div className="col-md-5">
                      <table className="table table-sm table-borderless">
                        <tbody>
                          <tr>
                            <td className="text-end">Subtotal:</td>
                            <td className="text-end"><strong>{formatCurrency(invoice.subTotal || invoice.total || 0)}</strong></td>
                          </tr>
                          {invoice.tax > 0 && (
                            <tr>
                              <td className="text-end">Tax:</td>
                              <td className="text-end">{formatCurrency(invoice.tax || 0)}</td>
                            </tr>
                          )}
                          {invoice.discount > 0 && (
                            <tr>
                              <td className="text-end text-success">Discount:</td>
                              <td className="text-end text-success">-{formatCurrency(invoice.discount || 0)}</td>
                            </tr>
                          )}
                          <tr className="border-top">
                            <td className="text-end"><strong>Total:</strong></td>
                            <td className="text-end"><h5 className="mb-0">{formatCurrency(invoice.total || 0)}</h5></td>
                          </tr>
                          {invoice.amountPaid > 0 && (
                            <>
                              <tr className="text-success">
                                <td className="text-end">Amount Paid:</td>
                                <td className="text-end"><strong>{formatCurrency(invoice.amountPaid || 0)}</strong></td>
                              </tr>
                              <tr className="border-top">
                                <td className="text-end"><strong>Balance Due:</strong></td>
                                <td className="text-end">
                                  <h5 className={`mb-0 ${balance > 0 ? 'text-danger' : 'text-success'}`}>
                                    {formatCurrency(balance)}
                                  </h5>
                                </td>
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Notes */}
                  {invoice.notes && (
                    <div className="mt-4 p-3 bg-light rounded">
                      <h6 className="mb-2 text-uppercase text-muted" style={{ fontSize: '11px', letterSpacing: '1px' }}>
                        Notes
                      </h6>
                      <p className="mb-0 small">{invoice.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar - Hidden when printing */}
            <div className="col-lg-4 no-print">
              {/* Date of Service Card */}
              <div className="card mb-3">
                <div className="card-header bg-primary-subtle">
                  <h5 className="card-title mb-0">
                    <i className="ti ti-calendar-event me-2" />
                    Date of Service
                  </h5>
                </div>
                <div className="card-body">
                  <p className="text-muted small mb-3">
                    Select the appointment date to use as the Date of Service for insurance claims
                  </p>
                  
                  {appointments.length > 0 ? (
                    <>
                      <select
                        className="form-select mb-3"
                        value={selectedAppointmentId}
                        onChange={(e) => setSelectedAppointmentId(e.target.value)}
                      >
                        <option value="">Select appointment...</option>
                        {appointments.map((apt: any) => (
                          <option key={apt.id} value={apt.id}>
                            {formatFullDate(apt.startTime)} at {formatTime(apt.startTime)}
                          </option>
                        ))}
                      </select>

                      {selectedAppointmentId && (
                        <div className="alert alert-success">
                          <i className="ti ti-check me-2" />
                          Service date selected: {formatDate(appointments.find(a => a.id === selectedAppointmentId)?.startTime)}
                        </div>
                      )}

                      <button
                        className="btn btn-success w-100"
                        onClick={handleCreateClaim}
                        disabled={!selectedAppointmentId || creatingClaim}
                      >
                        {creatingClaim ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" />
                            Creating Claim...
                          </>
                        ) : (
                          <>
                            <i className="ti ti-file-invoice me-1" />
                            Create Insurance Claim
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <div className="alert alert-warning">
                      <i className="ti ti-alert-triangle me-2" />
                      No completed appointments found for this patient
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="card">
                <div className="card-header">
                  <h5 className="card-title mb-0">Quick Actions</h5>
                </div>
                <div className="card-body">
                  <button 
                    className="btn btn-outline-primary w-100 mb-2"
                    onClick={handleEditInvoice}
                  >
                    <i className="ti ti-edit me-1" />
                    Edit Invoice
                  </button>
                  <button 
                    className="btn btn-outline-secondary w-100 mb-2"
                    onClick={handleSendToPatient}
                    disabled={sendingEmail}
                  >
                    <i className="ti ti-send me-1" />
                    Send to Patient
                  </button>
                  <Link 
                    to={`/insurance/add-payment/${patientId}`}
                    className="btn btn-outline-success w-100 mb-2"
                  >
                    <i className="ti ti-credit-card me-1" />
                    Record Payment
                  </Link>
                  <hr />
                  <Link to={`/patients/${patientId}`} className="btn btn-outline-secondary w-100">
                    <i className="ti ti-arrow-left me-1" />
                    Back to Patient
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          /* Hide everything except the invoice */
          body * {
            visibility: hidden;
          }
          
          #printable-invoice,
          #printable-invoice * {
            visibility: visible;
          }
          
          #printable-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          
          .no-print {
            display: none !important;
          }
          
          .page-wrapper {
            margin: 0;
            padding: 0;
          }
          
          .card {
            box-shadow: none !important;
            border: none !important;
          }
          
          .print-full-width {
            width: 100% !important;
            max-width: 100% !important;
            flex: 0 0 100% !important;
          }
          
          /* Highlight Date of Service column when printing */
          .dos-cell {
            background-color: #fff3cd !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            font-weight: 600 !important;
          }
        }
        
        /* Screen styles for Date of Service highlight */
        .dos-cell {
          background-color: #fff3cd;
          font-weight: 600;
          vertical-align: middle;
        }
      `}</style>
    </>
  );
};

export default InvoiceDetails;