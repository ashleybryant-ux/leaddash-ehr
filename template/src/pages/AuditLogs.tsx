import { useState, useEffect } from "react";
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  resourceType: string;
  resourceId: string;
  userId: string;
  userName: string;
  userEmail: string;
  patientId?: string;
  patientName?: string;
  locationId: string;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

interface AuditStats {
  last24Hours: number;
  last7Days: number;
  activeUsers: number;
  totalRecords: number;
  actionBreakdown: Record<string, number>;
  resourceBreakdown: Record<string, number>;
}

// Action type styling
const ACTION_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  VIEW: { bg: '#e0f2fe', text: '#0369a1', icon: 'ti-eye' },
  CREATE: { bg: '#dcfce7', text: '#16a34a', icon: 'ti-plus' },
  UPDATE: { bg: '#fef3c7', text: '#b45309', icon: 'ti-pencil' },
  DELETE: { bg: '#fee2e2', text: '#dc2626', icon: 'ti-trash' },
  SIGN: { bg: '#f3e8ff', text: '#7c3aed', icon: 'ti-signature' },
  LOGIN: { bg: '#d1fae5', text: '#059669', icon: 'ti-login' },
  LOGIN_FAILED: { bg: '#fee2e2', text: '#dc2626', icon: 'ti-login' },
  LOGOUT: { bg: '#f1f5f9', text: '#64748b', icon: 'ti-logout' },
  DOWNLOAD: { bg: '#dbeafe', text: '#2563eb', icon: 'ti-download' },
  UPLOAD: { bg: '#fce7f3', text: '#db2777', icon: 'ti-upload' },
  SUBMIT: { bg: '#ccfbf1', text: '#0d9488', icon: 'ti-send' },
};

// Resource type display names
const RESOURCE_NAMES: Record<string, string> = {
  patient: 'Patient',
  progress_note: 'Progress Note',
  chart_note: 'Chart Note',
  file: 'File',
  claim: 'Insurance Claim',
  appointment: 'Appointment',
  auth: 'Authentication',
  user: 'User',
  payment: 'Payment',
  invoice: 'Invoice',
};

const AuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'activity' | 'statistics'>('activity');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const pageSize = 50;

  // Check admin access
  const isAdmin = localStorage.getItem('isAdmin') === 'true' || 
                  localStorage.getItem('userType') === 'account-admin';

  useEffect(() => {
    if (isAdmin) {
      fetchLogs();
      fetchStats();
    }
  }, [currentPage, actionFilter, resourceFilter, startDate, endDate]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const locationId = localStorage.getItem('locationId') || '';
      
      const params: any = {
        page: currentPage,
        limit: pageSize,
      };
      
      if (actionFilter) params.action = actionFilter;
      if (resourceFilter) params.resourceType = resourceFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (searchQuery) params.search = searchQuery;

      const response = await axios.get(`${API_URL}/api/audit-logs`, {
        params,
        headers: { 'x-location-id': locationId }
      });

      if (response.data.success) {
        setLogs(response.data.logs || []);
        setTotalPages(response.data.totalPages || 1);
        setTotalRecords(response.data.total || 0);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const locationId = localStorage.getItem('locationId') || '';
      
      const response = await axios.get(`${API_URL}/api/audit-logs/stats`, {
        headers: { 'x-location-id': locationId }
      });

      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching audit stats:', error);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchLogs();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setActionFilter('');
    setResourceFilter('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
    setTimeout(fetchLogs, 0);
  };

  const exportToCSV = async () => {
    try {
      const locationId = localStorage.getItem('locationId') || '';
      
      const params: any = {};
      if (actionFilter) params.action = actionFilter;
      if (resourceFilter) params.resourceType = resourceFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await axios.get(`${API_URL}/api/audit-logs/export`, {
        params,
        headers: { 'x-location-id': locationId },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      alert('Failed to export audit logs');
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

  const getActionStyle = (action: string) => {
    return ACTION_STYLES[action] || { bg: '#f1f5f9', text: '#64748b', icon: 'ti-activity' };
  };

  const getResourceName = (resourceType: string) => {
    return RESOURCE_NAMES[resourceType] || resourceType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Access denied for non-admins
  if (!isAdmin) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
            <div className="text-center">
              <div className="rounded-circle bg-danger-subtle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '80px', height: '80px' }}>
                <i className="ti ti-lock fs-1 text-danger"></i>
              </div>
              <h5>Access Denied</h5>
              <p className="text-muted mb-0">You don't have permission to view the audit trail.</p>
              <p className="text-muted">This feature is only available to administrators.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="content">
        
        {/* Header */}
        <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
          <div className="row align-items-center">
            <div className="col-lg-6">
              <div className="d-flex align-items-center gap-3">
                <div 
                  className="rounded-circle d-flex align-items-center justify-content-center text-white"
                  style={{ width: '56px', height: '56px', backgroundColor: '#059669' }}
                >
                  <i className="ti ti-history fs-4"></i>
                </div>
                <div>
                  <h4 className="mb-1 fw-semibold">Audit Trail</h4>
                  <p className="text-muted mb-0 small">Track all system activity and user actions</p>
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="d-flex gap-2 justify-content-lg-end mt-3 mt-lg-0">
                <button 
                  className="btn btn-outline-primary rounded-pill"
                  onClick={fetchLogs}
                  disabled={loading}
                >
                  <i className="ti ti-refresh me-1"></i>Refresh
                </button>
                <button 
                  className="btn btn-primary rounded-pill"
                  onClick={exportToCSV}
                >
                  <i className="ti ti-download me-1"></i>Export CSV
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="row g-3 mb-4">
          <div className="col-md-3">
            <div className="bg-white rounded-4 shadow-sm p-4 text-center">
              <div className="text-muted small mb-1">Last 24 Hours</div>
              <div className="fs-3 fw-bold" style={{ color: '#059669' }}>{stats?.last24Hours || 0}</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="bg-white rounded-4 shadow-sm p-4 text-center">
              <div className="text-muted small mb-1">Last 7 Days</div>
              <div className="fs-3 fw-bold" style={{ color: '#0369a1' }}>{stats?.last7Days || 0}</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="bg-white rounded-4 shadow-sm p-4 text-center">
              <div className="text-muted small mb-1">Active Users</div>
              <div className="fs-3 fw-bold" style={{ color: '#7c3aed' }}>{stats?.activeUsers || 0}</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="bg-white rounded-4 shadow-sm p-4 text-center">
              <div className="text-muted small mb-1">Total Records</div>
              <div className="fs-3 fw-bold text-dark">{stats?.totalRecords || totalRecords}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-4 shadow-sm mb-4">
          <div className="border-bottom px-4">
            <ul className="nav nav-tabs border-0" style={{ marginBottom: '-1px' }}>
              <li className="nav-item">
                <button 
                  className={`nav-link border-0 px-4 py-3 ${activeTab === 'activity' ? 'active fw-semibold' : 'text-muted'}`}
                  onClick={() => setActiveTab('activity')}
                  style={activeTab === 'activity' ? { borderBottom: '3px solid #059669', color: '#059669' } : {}}
                >
                  <i className="ti ti-list me-2"></i>Activity Log
                </button>
              </li>
              <li className="nav-item">
                <button 
                  className={`nav-link border-0 px-4 py-3 ${activeTab === 'statistics' ? 'active fw-semibold' : 'text-muted'}`}
                  onClick={() => setActiveTab('statistics')}
                  style={activeTab === 'statistics' ? { borderBottom: '3px solid #059669', color: '#059669' } : {}}
                >
                  <i className="ti ti-chart-bar me-2"></i>Statistics
                </button>
              </li>
            </ul>
          </div>

          {/* Activity Log Tab */}
          {activeTab === 'activity' && (
            <div className="p-4">
              {/* Filters */}
              <div className="row g-3 mb-4">
                <div className="col-md-3">
                  <input
                    type="text"
                    className="form-control rounded-pill"
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <div className="col-md-2">
                  <select
                    className="form-select rounded-pill"
                    value={actionFilter}
                    onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1); }}
                  >
                    <option value="">All Actions</option>
                    <option value="VIEW">View</option>
                    <option value="CREATE">Create</option>
                    <option value="UPDATE">Update</option>
                    <option value="DELETE">Delete</option>
                    <option value="SIGN">Sign</option>
                    <option value="LOGIN">Login</option>
                    <option value="LOGOUT">Logout</option>
                    <option value="DOWNLOAD">Download</option>
                    <option value="UPLOAD">Upload</option>
                    <option value="SUBMIT">Submit</option>
                  </select>
                </div>
                <div className="col-md-2">
                  <select
                    className="form-select rounded-pill"
                    value={resourceFilter}
                    onChange={(e) => { setResourceFilter(e.target.value); setCurrentPage(1); }}
                  >
                    <option value="">All Resources</option>
                    <option value="patient">Patient</option>
                    <option value="progress_note">Progress Note</option>
                    <option value="file">File</option>
                    <option value="claim">Claim</option>
                    <option value="appointment">Appointment</option>
                    <option value="auth">Authentication</option>
                    <option value="payment">Payment</option>
                    <option value="invoice">Invoice</option>
                  </select>
                </div>
                <div className="col-md-2">
                  <input
                    type="date"
                    className="form-control rounded-pill"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                    placeholder="Start date"
                  />
                </div>
                <div className="col-md-2">
                  <input
                    type="date"
                    className="form-control rounded-pill"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                    placeholder="End date"
                  />
                </div>
                <div className="col-md-1">
                  <button 
                    className="btn btn-outline-secondary rounded-pill w-100"
                    onClick={clearFilters}
                    title="Clear filters"
                  >
                    <i className="ti ti-x"></i>
                  </button>
                </div>
              </div>

              {/* Results count */}
              <div className="d-flex justify-content-between align-items-center mb-3">
                <span className="text-muted small">{totalRecords} records found</span>
              </div>

              {/* Logs Table */}
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary mb-3" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="text-muted">Loading audit logs...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-5">
                  <div className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '64px', height: '64px' }}>
                    <i className="ti ti-file-search fs-3 text-muted"></i>
                  </div>
                  <p className="text-muted mb-0">No audit logs found</p>
                  <p className="text-muted small">Try adjusting your filters or check back later</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead style={{ backgroundColor: '#f8fafc' }}>
                      <tr>
                        <th className="border-0 py-3" style={{ width: '160px' }}>Timestamp</th>
                        <th className="border-0 py-3" style={{ width: '100px' }}>Action</th>
                        <th className="border-0 py-3" style={{ width: '120px' }}>Resource</th>
                        <th className="border-0 py-3">Description</th>
                        <th className="border-0 py-3" style={{ width: '150px' }}>User</th>
                        <th className="border-0 py-3" style={{ width: '120px' }}>Patient</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => {
                        const actionStyle = getActionStyle(log.action);
                        return (
                          <tr key={log.id} className="align-middle">
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <div className="fw-medium small">{formatDate(log.timestamp)}</div>
                              <div className="text-muted small">{formatTime(log.timestamp)}</div>
                            </td>
                            <td>
                              <span 
                                className="badge rounded-pill d-inline-flex align-items-center gap-1"
                                style={{ backgroundColor: actionStyle.bg, color: actionStyle.text }}
                              >
                                <i className={`ti ${actionStyle.icon}`}></i>
                                {log.action}
                              </span>
                            </td>
                            <td>
                              <span className="text-muted small">{getResourceName(log.resourceType)}</span>
                            </td>
                            <td>
                              <span className="small" style={{ maxWidth: '300px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {log.description}
                              </span>
                            </td>
                            <td>
                              <div className="small fw-medium">{log.userName || 'Unknown'}</div>
                              <div className="text-muted small" style={{ fontSize: '11px' }}>{log.userEmail || ''}</div>
                            </td>
                            <td>
                              {log.patientName ? (
                                <span className="small">{log.patientName}</span>
                              ) : (
                                <span className="text-muted small">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center mt-4 pt-3 border-top">
                  <span className="text-muted small">
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-outline-secondary btn-sm rounded-pill"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <i className="ti ti-chevron-left me-1"></i>Previous
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm rounded-pill"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next<i className="ti ti-chevron-right ms-1"></i>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Statistics Tab */}
          {activeTab === 'statistics' && (
            <div className="p-4">
              {stats ? (
                <div className="row g-4">
                  {/* Action Breakdown */}
                  <div className="col-md-6">
                    <div className="border rounded-4 p-4">
                      <h6 className="fw-semibold mb-4">
                        <i className="ti ti-activity me-2" style={{ color: '#059669' }}></i>
                        Actions by Type
                      </h6>
                      {Object.entries(stats.actionBreakdown || {}).length === 0 ? (
                        <p className="text-muted text-center py-3">No data available</p>
                      ) : (
                        <div className="d-flex flex-column gap-3">
                          {Object.entries(stats.actionBreakdown || {})
                            .sort((a, b) => b[1] - a[1])
                            .map(([action, count]) => {
                              const style = getActionStyle(action);
                              const percentage = Math.round((count / (stats.totalRecords || 1)) * 100);
                              return (
                                <div key={action}>
                                  <div className="d-flex justify-content-between align-items-center mb-1">
                                    <span className="d-flex align-items-center gap-2">
                                      <span 
                                        className="badge rounded-pill"
                                        style={{ backgroundColor: style.bg, color: style.text }}
                                      >
                                        <i className={`ti ${style.icon} me-1`}></i>
                                        {action}
                                      </span>
                                    </span>
                                    <span className="text-muted small">{count} ({percentage}%)</span>
                                  </div>
                                  <div className="progress" style={{ height: '8px' }}>
                                    <div 
                                      className="progress-bar" 
                                      style={{ width: `${percentage}%`, backgroundColor: style.text }}
                                    ></div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resource Breakdown */}
                  <div className="col-md-6">
                    <div className="border rounded-4 p-4">
                      <h6 className="fw-semibold mb-4">
                        <i className="ti ti-database me-2" style={{ color: '#059669' }}></i>
                        Actions by Resource
                      </h6>
                      {Object.entries(stats.resourceBreakdown || {}).length === 0 ? (
                        <p className="text-muted text-center py-3">No data available</p>
                      ) : (
                        <div className="d-flex flex-column gap-3">
                          {Object.entries(stats.resourceBreakdown || {})
                            .sort((a, b) => b[1] - a[1])
                            .map(([resource, count]) => {
                              const percentage = Math.round((count / (stats.totalRecords || 1)) * 100);
                              return (
                                <div key={resource}>
                                  <div className="d-flex justify-content-between align-items-center mb-1">
                                    <span className="fw-medium small">{getResourceName(resource)}</span>
                                    <span className="text-muted small">{count} ({percentage}%)</span>
                                  </div>
                                  <div className="progress" style={{ height: '8px' }}>
                                    <div 
                                      className="progress-bar" 
                                      style={{ width: `${percentage}%`, backgroundColor: '#059669' }}
                                    ></div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary mb-3" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="text-muted">Loading statistics...</p>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      <style>{`
        .rounded-4 { border-radius: 16px !important; }
        .bg-danger-subtle { background-color: #fee2e2 !important; }
        .btn-primary { background-color: #059669; border-color: #059669; }
        .btn-primary:hover { background-color: #047857; border-color: #047857; }
        .btn-outline-primary { color: #059669; border-color: #059669; }
        .btn-outline-primary:hover { background-color: #059669; color: white; }
        .nav-tabs .nav-link { border: none; }
        .nav-tabs .nav-link:hover { border: none; }
        .table > :not(caption) > * > * { padding: 12px 16px; }
      `}</style>
    </div>
  );
};

export default AuditLogs;