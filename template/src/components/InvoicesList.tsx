import { useState, useEffect } from 'react';
import axios from 'axios';
import config from '../config';

const API_URL = config.apiUrl;
const LOCATION_ID = config.ghlLocationId;

interface InvoicesListProps {
  patientId: string;
}

const InvoicesList = ({ patientId }: InvoicesListProps) => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoices();
  }, [patientId]);

  const fetchInvoices = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/ghl/invoices/${patientId}`, {
        params: { locationId: LOCATION_ID }
      });

      if (response.data.success) {
        setInvoices(response.data.invoices || []);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return <div className="text-center py-3"><div className="spinner-border spinner-border-sm" /></div>;
  }

  if (invoices.length === 0) {
    return <p className="text-muted text-center mb-0">No invoices found</p>;
  }

  return (
    <div className="table-responsive">
      <table className="table table-hover mb-0">
        <thead className="table-light">
          <tr>
            <th>Invoice #</th>
            <th>Date</th>
            <th className="text-end">Amount</th>
            <th className="text-end">Paid</th>
            <th className="text-end">Balance</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => {
            const total = invoice.total || 0;
            const paid = invoice.totalPaid || 0;
            const balance = total - paid;

            return (
              <tr key={invoice._id || invoice.id}>
                <td>
                  <strong>{invoice.invoiceNumber || `INV-${invoice.id?.substring(0, 8)}`}</strong>
                </td>
                <td>{formatDate(invoice.createdAt)}</td>
                <td className="text-end">{formatCurrency(total)}</td>
                <td className="text-end">{formatCurrency(paid)}</td>
                <td className="text-end">
                  <strong className={balance > 0 ? 'text-danger' : 'text-success'}>
                    {formatCurrency(balance)}
                  </strong>
                </td>
                <td>
                  <span className={`badge ${
                    invoice.status === 'paid' ? 'badge-success' :
                    invoice.status === 'partially_paid' ? 'badge-warning' :
                    invoice.status === 'draft' ? 'badge-secondary' :
                    'badge-info'
                  }`}>
                    {invoice.status?.replace('_', ' ') || 'pending'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default InvoicesList;