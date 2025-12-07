import { Link } from "react-router-dom";
import CommonFooter from "../../components/common-footer/commonFooter";
import { all_routes } from "../../routes/all_routes";
import { useState, useEffect } from "react";
import axios from 'axios';
import config from '../../config';

const API_URL = config.apiUrl;
const LOCATION_ID = config.ghlLocationId;

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

const AddInvoice = () => {
  // ============================================
  // STATE MANAGEMENT
  // ============================================
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [invoiceData, setInvoiceData] = useState({
    patientId: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    notes: '',
    subtotal: 0,
    tax: 0,
    discount: 0,
    total: 0
  });

  const [items, setItems] = useState<InvoiceItem[]>([
    { id: '1', description: '', quantity: 1, rate: 0, amount: 0 }
  ]);

  // ============================================
  // FETCH PATIENTS FROM LEADDASH
  // ============================================
  
  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      console.log('📋 Fetching patients from LeadDash...');
      
      const response = await axios.get(`${API_URL}/api/patients`, {
        params: {
          locationId: LOCATION_ID,
          limit: 100
        }
      });

      if (response.data.success) {
        setPatients(response.data.patients);
        console.log(`✅ Loaded ${response.data.patients.length} patients`);
      }
    } catch (error) {
      console.error('❌ Error fetching patients:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // ITEM MANAGEMENT
  // ============================================
  
  const addItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    const updatedItems = items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // Recalculate amount
        updated.amount = updated.quantity * updated.rate;
        return updated;
      }
      return item;
    });
    setItems(updatedItems);
    calculateTotals(updatedItems);
  };

  // ============================================
  // CALCULATIONS
  // ============================================
  
  const calculateTotals = (currentItems: InvoiceItem[]) => {
    const subtotal = currentItems.reduce((sum, item) => sum + item.amount, 0);
    const tax = subtotal * 0.1; // 10% tax
    const total = subtotal + tax - invoiceData.discount;
    
    setInvoiceData(prev => ({
      ...prev,
      subtotal,
      tax,
      total
    }));
  };

  // ============================================
  // SAVE INVOICE TO LEADDASH
  // ============================================
  
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!invoiceData.patientId) {
      alert('Please select a patient');
      return;
    }

    if (items.length === 0 || items[0].description === '') {
      alert('Please add at least one item');
      return;
    }

    setSaving(true);
    try {
      console.log('💾 Creating invoice in LeadDash...');

      const selectedPatient = patients.find(p => p.id === invoiceData.patientId);

      const response = await axios.post(
        `${API_URL}/api/invoices`,
        {
          contactId: invoiceData.patientId,
          title: `Invoice for ${selectedPatient?.firstName} ${selectedPatient?.lastName}`,
          items: items.map(item => ({
            name: item.description,
            quantity: item.quantity,
            price: item.rate
          })),
          dueDate: invoiceData.dueDate || new Date().toISOString(),
          notes: invoiceData.notes,
          currency: 'USD',
          status: 'draft'
        },
        {
          params: { locationId: LOCATION_ID }
        }
      );

      if (response.data.success) {
        console.log('✅ Invoice created');
        alert('Invoice created successfully!');
        
        // Reset form
        setInvoiceData({
          patientId: '',
          invoiceDate: new Date().toISOString().split('T')[0],
          dueDate: '',
          notes: '',
          subtotal: 0,
          tax: 0,
          discount: 0,
          total: 0
        });
        setItems([{ id: '1', description: '', quantity: 1, rate: 0, amount: 0 }]);
      }
    } catch (error) {
      console.error('❌ Error creating invoice:', error);
      alert('Failed to create invoice in LeadDash');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-flex align-items-center justify-content-between gap-2 mb-4 flex-wrap">
            <div className="breadcrumb-arrow">
              <h4 className="mb-1">Add Invoice</h4>
              <div className="text-end">
                <ol className="breadcrumb m-0 py-0">
                  <li className="breadcrumb-item">
                    <Link to={all_routes.dashboard}>Home</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to={all_routes.invoice}>Invoice</Link>
                  </li>
                  <li className="breadcrumb-item active">Add Invoice</li>
                </ol>
              </div>
            </div>
            <Link to={all_routes.invoice} className="fw-medium d-flex align-items-center">
              <i className="ti ti-arrow-left me-1" />
              Back to Invoice
            </Link>
          </div>

          {/* LEADDASH STATUS */}
          <div className="alert alert-info mb-3">
            <i className="ti ti-plug-connected me-2" />
            Connected to LeadDash - Invoice will be saved to your account
          </div>

          <form onSubmit={handleSaveInvoice}>
            <div className="card">
              <div className="card-body">
                <div className="row">
                  {/* Patient Selection */}
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Select Patient</label>
                      <select
                        className="form-control"
                        value={invoiceData.patientId}
                        onChange={(e) => setInvoiceData({...invoiceData, patientId: e.target.value})}
                        required
                      >
                        <option value="">Choose Patient...</option>
                        {patients.map(patient => (
                          <option key={patient.id} value={patient.id}>
                            {patient.firstName} {patient.lastName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Invoice Date */}
                  <div className="col-md-3">
                    <div className="mb-3">
                      <label className="form-label">Invoice Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={invoiceData.invoiceDate}
                        onChange={(e) => setInvoiceData({...invoiceData, invoiceDate: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  {/* Due Date */}
                  <div className="col-md-3">
                    <div className="mb-3">
                      <label className="form-label">Due Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={invoiceData.dueDate}
                        onChange={(e) => setInvoiceData({...invoiceData, dueDate: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="mb-3">
                  <h5 className="mb-3">Invoice Items</h5>
                  <div className="table-responsive">
                    <table className="table table-bordered">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th style={{width: '120px'}}>Quantity</th>
                          <th style={{width: '120px'}}>Rate</th>
                          <th style={{width: '120px'}}>Amount</th>
                          <th style={{width: '60px'}}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <input
                                type="text"
                                className="form-control"
                                value={item.description}
                                onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                placeholder="Item description"
                                required
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-control"
                                value={item.quantity}
                                onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                min="1"
                                required
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-control"
                                value={item.rate}
                                onChange={(e) => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                                min="0"
                                step="0.01"
                                required
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control"
                                value={`$${item.amount.toFixed(2)}`}
                                disabled
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                onClick={() => removeItem(item.id)}
                                disabled={items.length === 1}
                              >
                                <i className="ti ti-trash" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={addItem}
                  >
                    <i className="ti ti-plus me-1" />
                    Add Item
                  </button>
                </div>

                {/* Totals */}
                <div className="row justify-content-end">
                  <div className="col-md-4">
                    <table className="table table-borderless">
                      <tbody>
                        <tr>
                          <td className="text-end"><strong>Subtotal:</strong></td>
                          <td className="text-end">${invoiceData.subtotal.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td className="text-end"><strong>Tax (10%):</strong></td>
                          <td className="text-end">${invoiceData.tax.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td className="text-end"><strong>Discount:</strong></td>
                          <td className="text-end">
                            <input
                              type="number"
                              className="form-control form-control-sm text-end"
                              value={invoiceData.discount}
                              onChange={(e) => {
                                const discount = parseFloat(e.target.value) || 0;
                                setInvoiceData({...invoiceData, discount});
                                calculateTotals(items);
                              }}
                              min="0"
                              step="0.01"
                            />
                          </td>
                        </tr>
                        <tr className="border-top">
                          <td className="text-end"><strong>Total:</strong></td>
                          <td className="text-end"><strong>${invoiceData.total.toFixed(2)}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Notes */}
                <div className="row">
                  <div className="col-12">
                    <div className="mb-3">
                      <label className="form-label">Notes</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={invoiceData.notes}
                        onChange={(e) => setInvoiceData({...invoiceData, notes: e.target.value})}
                        placeholder="Additional notes..."
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="d-flex justify-content-end gap-2">
                  <Link to={all_routes.invoice} className="btn btn-outline-light">
                    Cancel
                  </Link>
                  <button type="submit" className="btn btn-primary" disabled={saving || loading}>
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" />
                        Saving to LeadDash...
                      </>
                    ) : (
                      'Save Invoice'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
        <CommonFooter />
      </div>
    </>
  );
};

export default AddInvoice;