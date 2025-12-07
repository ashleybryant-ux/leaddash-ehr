import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from 'axios';
import config from '../../config';

const API_URL = config.apiUrl;
const LOCATION_ID = config.ghlLocationId;

const ClaimsList = () => {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchClaims();
  }, []);

  const fetchClaims = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await axios.get(`${API_URL}/api/claims`, {
        headers: {
          'x-location-id': user.locationId || LOCATION_ID
        }
      });

      if (response.data.success) {
        setClaims(response.data.claims || []);
      }
    } catch (error) {
      console.error('Error fetching claims:', error);
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
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusBadgeClass = (status: string) => {
    const statusMap: any = {
      'draft': 'badge-secondary',
      'scrubbed': 'badge-warning',
      'submitted': 'badge-info',
      'received': 'badge-primary',
      'accepted': 'badge-success',
      'rejected': 'badge-danger',
      'denied': 'badge-danger',
      'paid': 'badge-success'
    };
    return statusMap[status] || 'badge-secondary';
  };

  const filteredClaims = filterStatus === 'all' 
    ? claims 
    : claims.filter(claim => claim.status === filterStatus);

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2">Loading claims...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Page Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h4 className="mb-1">Insurance Claims</h4>
            <p className="text-muted mb-0">Manage and track insurance claims</p>
          </div>
          <div className="d-flex gap-2">
            <select 
              className="form-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="scrubbed">Scrubbed</option>
              <option value="submitted">Submitted</option>
              <option value="received">Received</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="denied">Denied</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="row mb-4">
          <div className="col-md-3">
            <div className="card">
              <div className="card-body">
                <h6 className="text-muted mb-2">Total Claims</h6>
                <h3 className="mb-0">{claims.length}</h3>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card">
              <div className="card-body">
                <h6 className="text-muted mb-2">Submitted</h6>
                <h3 className="mb-0 text-info">
                  {claims.filter(c => c.status === 'submitted' || c.status === 'received').length}
                </h3>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card">
              <div className="card-body">
                <h6 className="text-muted mb-2">Accepted</h6>
                <h3 className="mb-0 text-success">
                  {claims.filter(c => c.status === 'accepted' || c.status === 'paid').length}
                </h3>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card">
              <div className="card-body">
                <h6 className="text-muted mb-2">Rejected/Denied</h6>
                <h3 className="mb-0 text-danger">
                  {claims.filter(c => c.status === 'rejected' || c.status === 'denied').length}
                </h3>
              </div>
            </div>
          </div>
        </div>

        {/* Claims Table */}
        <div className="card">
          <div className="card-body">
            {filteredClaims.length === 0 ? (
              <div className="text-center py-5">
                <i className="ti ti-file-invoice fs-48 text-muted mb-3 d-block" />
                <h5>No Claims Found</h5>
                <p className="text-muted">Create claims from patient invoices</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead className="table-light">
                    <tr>
                      <th>Claim #</th>
                      <th>Service Date</th>
                      <th className="text-end">Amount</th>
                      <th className="text-end">Paid</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClaims.map((claim) => (
                      <tr key={claim.id}>
                        <td>
                          <strong>{claim.claimNumber}</strong>
                          {claim.clearinghouseReferenceNumber && (
                            <><br /><small className="text-muted">Ref: {claim.clearinghouseReferenceNumber}</small></>
                          )}
                        </td>
                        <td>{formatDate(claim.serviceDate)}</td>
                        <td className="text-end">{formatCurrency(claim.totalAmount)}</td>
                        <td className="text-end">{formatCurrency(claim.paidAmount)}</td>
                        <td>
                          <span className={`badge ${getStatusBadgeClass(claim.status)}`}>
                            {claim.status}
                          </span>
                        </td>
                        <td>{formatDate(claim.createdAt)}</td>
                        <td>
                          <Link 
                            to={`/insurance/claims/${claim.id}`}
                            className="btn btn-sm btn-outline-primary"
                          >
                            <i className="ti ti-eye me-1" />
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaimsList;