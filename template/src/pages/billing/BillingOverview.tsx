import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auditBillingView } from "../../services/auditService";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

// DEV MODE - set to true to bypass authentication checks
const DEV_MODE = false;

interface Invoice {
  _id?: string;
  id?: string;
  invoiceNumber?: string;
  number?: string;
  total?: number;
  amountPaid?: number;
  amountDue?: number;
  status?: string;
  createdAt?: string;
  issueDate?: string;
  updatedAt?: string;
  paidAt?: string;
  contactDetails?: {
    id?: string;
    name?: string;
    email?: string;
  };
  contactId?: string;
  contactName?: string;
}

// Admin types that can access Billing
const ADMIN_TYPES = ["account-admin", "agency-admin", "agency-owner"];

const BillingOverview: React.FC = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("outstanding");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [locationName, setLocationName] = useState<string>("");
  
  // Track if audit has been logged
  const auditLogged = useRef(false);

  // Check if user is admin based on their type
  useEffect(() => {
    const checkAdminStatus = async () => {
      // DEV MODE: Bypass authentication
      if (DEV_MODE) {
        console.log("🔓 DEV MODE: Auth bypassed in BillingOverview");
        setIsAdmin(true);
        setCheckingAuth(false);
        return;
      }

      try {
        const userId = localStorage.getItem("userId");
        const locationId = localStorage.getItem("locationId");
        const userType = localStorage.getItem("userType")?.toLowerCase() || "";

        if (!userId || !locationId) {
          navigate("/login");
          return;
        }

        const hasAdminAccess = ADMIN_TYPES.some(
          (adminType) =>
            userType === adminType ||
            userType.includes(adminType.replace("-", ""))
        );

        const response = await fetch(`${API_URL}/api/auth/check-role`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, locationId }),
        });

        const data = await response.json();

        if (data.success) {
          const backendType = (data.type || "").toLowerCase();
          const backendHasAdminAccess = ADMIN_TYPES.some(
            (adminType) =>
              backendType === adminType ||
              backendType.includes(adminType.replace("-", ""))
          );

          if (hasAdminAccess || backendHasAdminAccess || data.isAdmin) {
            setIsAdmin(true);

            try {
              const locResponse = await fetch(
                `${API_URL}/api/location/${locationId}`
              );
              const locData = await locResponse.json();
              if (locData.success) {
                setLocationName(locData.location.name);
              }
            } catch (err) {
              console.error("Error fetching location:", err);
            }
          } else {
            setIsAdmin(false);
            navigate("/dashboard", {
              state: {
                message:
                  "Access denied. Only administrators can view the Billing page.",
              },
            });
          }
        } else {
          setIsAdmin(false);
          navigate("/dashboard");
        }
      } catch (err) {
        console.error("Error checking admin status:", err);
        setIsAdmin(false);
        navigate("/dashboard");
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAdminStatus();
  }, [navigate]);

  // Fetch invoices only if admin
  useEffect(() => {
    if (isAdmin !== true) return;

    const fetchInvoices = async () => {
      try {
        setLoading(true);
        const locationId = localStorage.getItem("locationId") || "puLPmzfdCvfQRANPM2WA";

        const response = await fetch(
          `${API_URL}/api/ghl/invoices?locationId=${locationId}`,
          {
            headers: {
              "x-location-id": locationId,
              "x-user-id": localStorage.getItem("userId") || "",
            },
          }
        );

        const data = await response.json();

        if (data.success) {
          console.log("📊 Invoice data from GHL:", data.invoices);
          setInvoices(data.invoices || []);
          
          // Log audit event for viewing billing overview (only once)
          if (!auditLogged.current) {
            auditBillingView();
            auditLogged.current = true;
          }
        } else {
          setError(data.error || "Failed to load invoices");
        }
      } catch (err) {
        console.error("Error fetching invoices:", err);
        setError("Failed to connect to server");
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, [isAdmin]);

  // Loading state
  if (checkingAuth || isAdmin === null) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2">Checking permissions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  // Date calculations
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const getInvoiceDate = (invoice: Invoice): Date => {
    const dateStr =
      invoice.paidAt || invoice.updatedAt || invoice.createdAt || invoice.issueDate;
    return dateStr ? new Date(dateStr) : new Date(0);
  };

  // Helper to get amount - GHL stores in DOLLARS, not cents
  const getAmount = (invoice: Invoice, field: 'total' | 'amountPaid' | 'amountDue'): number => {
    const value = invoice[field] || 0;
    return value;
  };

  const getBalance = (invoice: Invoice): number => {
    if (invoice.amountDue !== undefined) {
      return invoice.amountDue;
    }
    return (invoice.total || 0) - (invoice.amountPaid || 0);
  };

  // Income calculations - amounts already in dollars
  const paidInvoices = invoices.filter((inv) => inv.status === "paid");

  const thisMonthIncome = paidInvoices
    .filter((inv) => getInvoiceDate(inv) >= thisMonthStart)
    .reduce((sum, inv) => sum + getAmount(inv, 'amountPaid') || getAmount(inv, 'total'), 0);

  const lastMonthIncome = paidInvoices
    .filter((inv) => {
      const date = getInvoiceDate(inv);
      return date >= lastMonthStart && date <= lastMonthEnd;
    })
    .reduce((sum, inv) => sum + getAmount(inv, 'amountPaid') || getAmount(inv, 'total'), 0);

  const yearToDateIncome = paidInvoices
    .filter((inv) => getInvoiceDate(inv) >= yearStart)
    .reduce((sum, inv) => sum + getAmount(inv, 'amountPaid') || getAmount(inv, 'total'), 0);

  const totalOutstanding = invoices
    .filter((inv) => inv.status !== "paid")
    .reduce((sum, inv) => sum + getBalance(inv), 0);

  const paidCount = paidInvoices.length;
  const outstandingCount = invoices.filter((inv) => inv.status !== "paid").length;

  const filteredInvoices = invoices.filter((inv) => {
    if (activeTab === "outstanding") return inv.status !== "paid";
    if (activeTab === "paid") return inv.status === "paid";
    return true;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const thisMonthName = monthNames[now.getMonth()];
  const lastMonthName = monthNames[now.getMonth() === 0 ? 11 : now.getMonth() - 1];

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Page Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h4 className="mb-1">Billing Overview</h4>
            <p className="text-muted mb-0">
              {locationName
                ? `Patient invoices for ${locationName}`
                : "Patient invoices and payments"}
            </p>
          </div>
          <span className="badge bg-primary px-3 py-2">
            <i className="ti ti-shield-check me-1"></i> Admin View
          </span>
        </div>

        {/* Info Alert */}
        <div className="alert alert-info mb-4">
          <i className="ti ti-info-circle me-2"></i>
          <strong>Billing</strong> shows patient invoices and copay payments. For
          insurance claims and ERA payments, visit the{" "}
          <Link to="/insurance">Insurance</Link> page.
        </div>

        {/* Income Summary Cards */}
        <div className="row mb-4">
          <div className="col-xl-3 col-sm-6">
            <div className="card">
              <div className="card-body">
                <p className="text-muted mb-1">{thisMonthName} Income</p>
                <h4 className="text-success mb-0">{formatCurrency(thisMonthIncome)}</h4>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-sm-6">
            <div className="card">
              <div className="card-body">
                <p className="text-muted mb-1">{lastMonthName} Income</p>
                <h4 className="text-info mb-0">{formatCurrency(lastMonthIncome)}</h4>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-sm-6">
            <div className="card">
              <div className="card-body">
                <p className="text-muted mb-1">{now.getFullYear()} YTD</p>
                <h4 className="text-primary mb-0">{formatCurrency(yearToDateIncome)}</h4>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-sm-6">
            <div className="card">
              <div className="card-body">
                <p className="text-muted mb-1">Outstanding</p>
                <h4 className="text-danger mb-0">{formatCurrency(totalOutstanding)}</h4>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="row mb-4">
          <div className="col-md-4">
            <div className="card bg-light">
              <div className="card-body py-3 d-flex justify-content-between align-items-center">
                <span className="text-muted">Total Invoices</span>
                <span className="fs-5 fw-bold">{invoices.length}</span>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card bg-light">
              <div className="card-body py-3 d-flex justify-content-between align-items-center">
                <span className="text-muted">Paid</span>
                <span className="fs-5 fw-bold text-success">{paidCount}</span>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card bg-light">
              <div className="card-body py-3 d-flex justify-content-between align-items-center">
                <span className="text-muted">Outstanding</span>
                <span className="fs-5 fw-bold text-danger">{outstandingCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Invoices Table Card */}
        <div className="card">
          <div className="card-header p-0 border-bottom">
            <ul className="nav nav-tabs nav-tabs-solid nav-justified">
              <li className="nav-item">
                <a
                  className={`nav-link ${activeTab === "outstanding" ? "active" : ""}`}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab("outstanding");
                  }}
                >
                  Outstanding
                  {outstandingCount > 0 && (
                    <span className="badge bg-danger ms-2">{outstandingCount}</span>
                  )}
                </a>
              </li>
              <li className="nav-item">
                <a
                  className={`nav-link ${activeTab === "all" ? "active" : ""}`}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab("all");
                  }}
                >
                  All Invoices
                </a>
              </li>
              <li className="nav-item">
                <a
                  className={`nav-link ${activeTab === "paid" ? "active" : ""}`}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab("paid");
                  }}
                >
                  Paid
                </a>
              </li>
            </ul>
          </div>
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-2 text-muted">Loading invoices...</p>
              </div>
            ) : error ? (
              <div className="text-center py-5">
                <i className="ti ti-alert-circle fs-48 text-danger mb-3 d-block"></i>
                <p className="text-danger">{error}</p>
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </button>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-5">
                <i className="ti ti-file-invoice fs-48 text-muted mb-3 d-block"></i>
                <p className="text-muted">
                  {activeTab === "outstanding"
                    ? "No outstanding invoices - great job!"
                    : activeTab === "paid"
                    ? "No paid invoices yet"
                    : "No invoices found for this location"}
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Patient</th>
                      <th>Date</th>
                      <th className="text-end">Amount</th>
                      <th className="text-end">Paid</th>
                      <th className="text-end">Balance</th>
                      <th className="text-center">Status</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((invoice) => {
                      const invoiceId = invoice._id || invoice.id;
                      const total = getAmount(invoice, 'total');
                      const paid = getAmount(invoice, 'amountPaid');
                      const balance = getBalance(invoice);
                      const patientId =
                        invoice.contactDetails?.id || invoice.contactId;
                      const patientName =
                        invoice.contactDetails?.name ||
                        invoice.contactName ||
                        "Unknown";
                      const date = invoice.createdAt || invoice.issueDate;

                      return (
                        <tr key={invoiceId}>
                          <td>
                            {patientId ? (
                              <Link
                                to={`/patients/${patientId}`}
                                className="text-primary fw-medium"
                              >
                                {patientName}
                              </Link>
                            ) : (
                              <span className="text-muted">{patientName}</span>
                            )}
                          </td>
                          <td className="text-muted">{formatDate(date)}</td>
                          <td className="text-end">{formatCurrency(total)}</td>
                          <td className="text-end text-success">
                            {formatCurrency(paid)}
                          </td>
                          <td className="text-end">
                            <span
                              className={balance > 0 ? "text-danger fw-bold" : ""}
                            >
                              {formatCurrency(balance)}
                            </span>
                          </td>
                          <td className="text-center">
                            <span
                              className={`badge ${
                                invoice.status === "paid"
                                  ? "bg-success"
                                  : invoice.status === "partially_paid"
                                  ? "bg-warning"
                                  : invoice.status === "draft"
                                  ? "bg-secondary"
                                  : "bg-danger"
                              }`}
                            >
                              {invoice.status === "paid"
                                ? "Paid"
                                : invoice.status === "partially_paid"
                                ? "Partial"
                                : invoice.status === "draft"
                                ? "Draft"
                                : "Outstanding"}
                            </span>
                          </td>
                          <td className="text-center">
                            {patientId && (
                              <Link
                                to={`/patients/${patientId}/invoices/${invoiceId}`}
                                className="btn btn-sm btn-outline-primary me-1"
                                title="View"
                              >
                                <i className="ti ti-eye"></i>
                              </Link>
                            )}
                            {invoice.status !== "paid" && (
                              <button
                                className="btn btn-sm btn-success"
                                title="Record payment"
                              >
                                <i className="ti ti-currency-dollar"></i>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {filteredInvoices.length > 0 && (
            <div className="card-footer bg-white text-muted">
              <small>
                Showing {filteredInvoices.length} of {invoices.length} invoices
                {locationName && (
                  <span className="float-end">Location: {locationName}</span>
                )}
              </small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillingOverview;