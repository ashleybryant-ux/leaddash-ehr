// auditService.ts
// Frontend utility for tracking audit events
// Place this in your src/services/ folder

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Allowed action types
export type AuditAction = 
  | 'VIEW' 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'SIGN' 
  | 'LOGIN' 
  | 'LOGIN_FAILED'
  | 'LOGOUT' 
  | 'DOWNLOAD' 
  | 'UPLOAD' 
  | 'SUBMIT'
  | 'LIST'
  | 'FILTER'
  | 'ACCESS_DENIED';

// Allowed resource types
export type ResourceType = 
  | 'patient' 
  | 'progress_note' 
  | 'file' 
  | 'claim' 
  | 'appointment' 
  | 'auth' 
  | 'user' 
  | 'payment' 
  | 'invoice'
  | 'billing'
  | 'calendar'
  | 'insurance';

export interface AuditLogParams {
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  patientId?: string;
  patientName?: string;
  description: string;
  metadata?: Record<string, any>;
}

/**
 * Log an audit event (fire and forget)
 * This sends an audit log to the backend
 */
export const logAudit = (params: AuditLogParams): void => {
  // Fire and forget - don't await
  trackAuditEvent(params).catch(() => {
    // Silently ignore errors - audit should not break the app
  });
};

/**
 * Track an audit event (async version)
 * This sends an audit log to the backend
 */
export const trackAuditEvent = async (params: AuditLogParams): Promise<void> => {
  try {
    const locationId = localStorage.getItem('locationId');
    const userId = localStorage.getItem('userId');
    const userName = localStorage.getItem('userName');
    const userEmail = localStorage.getItem('userEmail');

    if (!locationId) {
      console.warn('No locationId found, skipping audit log');
      return;
    }

    await axios.post(`${API_URL}/api/audit-logs`, {
      ...params,
      locationId,
      userId,
      userName,
      userEmail
    }, {
      headers: {
        'x-location-id': locationId,
        'x-user-id': userId || '',
        'x-user-name': userName || '',
        'x-user-email': userEmail || ''
      }
    });
  } catch (error) {
    // Don't throw - audit logging should not break the app
    console.error('Failed to track audit event:', error);
  }
};

/**
 * Track when a user views a patient record
 */
export const trackPatientView = (patientId: string, patientName: string): void => {
  logAudit({
    action: 'VIEW',
    resourceType: 'patient',
    resourceId: patientId,
    patientId,
    patientName,
    description: `Viewed patient record: ${patientName}`
  });
};

/**
 * Track when a user views a progress note
 */
export const trackNoteView = (noteId: string, patientId: string, patientName: string): void => {
  logAudit({
    action: 'VIEW',
    resourceType: 'progress_note',
    resourceId: noteId,
    patientId,
    patientName,
    description: `Viewed progress note for ${patientName}`
  });
};

/**
 * Track when a user creates a progress note
 */
export const trackNoteCreate = (noteId: string, patientId: string, patientName: string, noteType?: string): void => {
  logAudit({
    action: 'CREATE',
    resourceType: 'progress_note',
    resourceId: noteId,
    patientId,
    patientName,
    description: `Created ${noteType || 'progress'} note for ${patientName}`,
    metadata: { noteType }
  });
};

/**
 * Track when a user updates a progress note
 */
export const trackNoteUpdate = (noteId: string, patientId: string, patientName: string): void => {
  logAudit({
    action: 'UPDATE',
    resourceType: 'progress_note',
    resourceId: noteId,
    patientId,
    patientName,
    description: `Updated progress note for ${patientName}`
  });
};

/**
 * Track when a user signs a progress note
 */
export const trackNoteSign = (noteId: string, patientId: string, patientName: string, signerName: string): void => {
  logAudit({
    action: 'SIGN',
    resourceType: 'progress_note',
    resourceId: noteId,
    patientId,
    patientName,
    description: `Signed progress note for ${patientName}`,
    metadata: { signedBy: signerName }
  });
};

/**
 * Track when a user deletes a progress note
 */
export const trackNoteDelete = (noteId: string, patientId: string, patientName: string): void => {
  logAudit({
    action: 'DELETE',
    resourceType: 'progress_note',
    resourceId: noteId,
    patientId,
    patientName,
    description: `Deleted progress note for ${patientName}`
  });
};

/**
 * Track when a user downloads a file
 */
export const trackFileDownload = (fileId: string, fileName: string, patientId: string, patientName: string): void => {
  logAudit({
    action: 'DOWNLOAD',
    resourceType: 'file',
    resourceId: fileId,
    patientId,
    patientName,
    description: `Downloaded file: ${fileName}`,
    metadata: { fileName }
  });
};

/**
 * Track when a user uploads a file
 */
export const trackFileUpload = (fileId: string, fileName: string, patientId: string, patientName: string): void => {
  logAudit({
    action: 'UPLOAD',
    resourceType: 'file',
    resourceId: fileId,
    patientId,
    patientName,
    description: `Uploaded file: ${fileName}`,
    metadata: { fileName }
  });
};

/**
 * Track when a user deletes a file
 */
export const trackFileDelete = (fileId: string, fileName: string, patientId: string, patientName: string): void => {
  logAudit({
    action: 'DELETE',
    resourceType: 'file',
    resourceId: fileId,
    patientId,
    patientName,
    description: `Deleted file: ${fileName}`,
    metadata: { fileName }
  });
};

/**
 * Track when a user submits an insurance claim
 */
export const trackClaimSubmit = (claimId: string, patientId: string, patientName: string, amount: number, payerName?: string): void => {
  logAudit({
    action: 'SUBMIT',
    resourceType: 'claim',
    resourceId: claimId,
    patientId,
    patientName,
    description: `Submitted insurance claim for ${patientName} - $${amount}${payerName ? ` to ${payerName}` : ''}`,
    metadata: { amount, payerName }
  });
};

/**
 * Track when a user updates patient information
 */
export const trackPatientUpdate = (patientId: string, patientName: string, fieldsChanged: string[]): void => {
  logAudit({
    action: 'UPDATE',
    resourceType: 'patient',
    resourceId: patientId,
    patientId,
    patientName,
    description: `Updated patient info for ${patientName}: ${fieldsChanged.join(', ')}`,
    metadata: { fieldsChanged }
  });
};

/**
 * Track user login
 */
export const trackLogin = (userId: string, userName: string, userEmail: string): void => {
  logAudit({
    action: 'LOGIN',
    resourceType: 'auth',
    resourceId: userId,
    description: `User logged in: ${userName}`,
    metadata: { userId, userEmail }
  });
};

/**
 * Track user logout
 */
export const trackLogout = (userId: string, userName: string): void => {
  logAudit({
    action: 'LOGOUT',
    resourceType: 'auth',
    resourceId: userId,
    description: `User logged out: ${userName}`
  });
};

/**
 * Track when a user downloads a note PDF
 */
export const trackNotePDFDownload = (noteId: string, patientId: string, patientName: string): void => {
  logAudit({
    action: 'DOWNLOAD',
    resourceType: 'progress_note',
    resourceId: noteId,
    patientId,
    patientName,
    description: `Downloaded PDF of progress note for ${patientName}`
  });
};

/**
 * Track when a user views the billing overview
 */
export const trackBillingView = (): void => {
  logAudit({
    action: 'VIEW',
    resourceType: 'billing',
    description: 'Viewed billing overview'
  });
};

/**
 * Track when a user views an invoice
 */
export const trackInvoiceView = (invoiceId: string, patientId: string, patientName: string, invoiceNumber?: string): void => {
  logAudit({
    action: 'VIEW',
    resourceType: 'invoice',
    resourceId: invoiceId,
    patientId,
    patientName,
    description: `Viewed invoice ${invoiceNumber || invoiceId} for ${patientName}`,
    metadata: { invoiceNumber }
  });
};

/**
 * Track when a user creates an invoice
 */
export const trackInvoiceCreate = (invoiceId: string, patientId: string, patientName: string, amount: number): void => {
  logAudit({
    action: 'CREATE',
    resourceType: 'invoice',
    resourceId: invoiceId,
    patientId,
    patientName,
    description: `Created invoice for ${patientName} - $${amount}`,
    metadata: { amount }
  });
};

/**
 * Track when a user updates an invoice
 */
export const trackInvoiceUpdate = (invoiceId: string, patientId: string, patientName: string, invoiceNumber?: string): void => {
  logAudit({
    action: 'UPDATE',
    resourceType: 'invoice',
    resourceId: invoiceId,
    patientId,
    patientName,
    description: `Updated invoice ${invoiceNumber || invoiceId} for ${patientName}`,
    metadata: { invoiceNumber }
  });
};

/**
 * Track when a user deletes an invoice
 */
export const trackInvoiceDelete = (invoiceId: string, patientId: string, patientName: string): void => {
  logAudit({
    action: 'DELETE',
    resourceType: 'invoice',
    resourceId: invoiceId,
    patientId,
    patientName,
    description: `Deleted invoice for ${patientName}`
  });
};

/**
 * Track when a user downloads an invoice PDF
 */
export const trackInvoiceDownload = (invoiceId: string, patientId: string, patientName: string, invoiceNumber?: string): void => {
  logAudit({
    action: 'DOWNLOAD',
    resourceType: 'invoice',
    resourceId: invoiceId,
    patientId,
    patientName,
    description: `Downloaded invoice ${invoiceNumber || invoiceId} for ${patientName}`,
    metadata: { invoiceNumber }
  });
};

/**
 * Track when a user sends an invoice to patient
 */
export const trackInvoiceSend = (invoiceId: string, patientId: string, patientName: string, patientEmail: string): void => {
  logAudit({
    action: 'SUBMIT',
    resourceType: 'invoice',
    resourceId: invoiceId,
    patientId,
    patientName,
    description: `Sent invoice to ${patientName} at ${patientEmail}`,
    metadata: { patientEmail }
  });
};

// ============================================
// ALIASES - For backwards compatibility with 
// components using audit* naming convention
// ============================================

export const auditPatientView = trackPatientView;
export const auditPatientUpdate = trackPatientUpdate;
export const auditNoteView = trackNoteView;
export const auditNoteCreate = trackNoteCreate;
export const auditNoteUpdate = trackNoteUpdate;
export const auditNoteSign = trackNoteSign;
export const auditNoteDelete = trackNoteDelete;
export const auditFileDownload = trackFileDownload;
export const auditFileUpload = trackFileUpload;
export const auditFileDelete = trackFileDelete;
export const auditClaimSubmit = trackClaimSubmit;
export const auditLogin = trackLogin;
export const auditLogout = trackLogout;
export const auditNotePDFDownload = trackNotePDFDownload;
export const auditBillingView = trackBillingView;
export const auditInvoiceView = trackInvoiceView;
export const auditInvoiceCreate = trackInvoiceCreate;
export const auditInvoiceUpdate = trackInvoiceUpdate;
export const auditInvoiceDelete = trackInvoiceDelete;
export const auditInvoiceDownload = trackInvoiceDownload;
export const auditInvoiceSend = trackInvoiceSend;

export default {
  logAudit,
  trackAuditEvent,
  trackPatientView,
  trackNoteView,
  trackNoteCreate,
  trackNoteUpdate,
  trackNoteSign,
  trackNoteDelete,
  trackFileDownload,
  trackFileUpload,
  trackFileDelete,
  trackClaimSubmit,
  trackPatientUpdate,
  trackLogin,
  trackLogout,
  trackNotePDFDownload,
  trackBillingView,
  trackInvoiceView,
  trackInvoiceCreate,
  trackInvoiceUpdate,
  trackInvoiceDelete,
  trackInvoiceDownload,
  trackInvoiceSend,
  // Aliases
  auditPatientView,
  auditPatientUpdate,
  auditNoteView,
  auditNoteCreate,
  auditNoteUpdate,
  auditNoteSign,
  auditNoteDelete,
  auditFileDownload,
  auditFileUpload,
  auditFileDelete,
  auditClaimSubmit,
  auditLogin,
  auditLogout,
  auditNotePDFDownload,
  auditBillingView,
  auditInvoiceView,
  auditInvoiceCreate,
  auditInvoiceUpdate,
  auditInvoiceDelete,
  auditInvoiceDownload,
  auditInvoiceSend
};