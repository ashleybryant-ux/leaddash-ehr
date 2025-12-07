import AutoBreadcrumb from "../../../components/breadcrumb/AutoBreadcrumb";
import CommonFooter from "../../../components/common-footer/commonFooter";

const TermsAndConditions = () => {
  return (
    <>
      {/* ========================
			Start Page Content
		========================= */}
      <div className="page-wrapper">
        {/* Start Content */}
        <div className="content">
          {/* Page Header */}
          <AutoBreadcrumb title="Terms & Conditions" />
          {/* End Page Header */}
          <div className="card mb-0">
            <div className="card-body">
              {/* Business Entity Information */}
              <div className="mb-4">
                <strong>LeadDash Marketing LLC</strong><br/>
                Oklahoma County, Oklahoma<br/>
                <br/>
                <strong>Effective Date:</strong> [Date]<br/>
                <strong>Last Updated:</strong> [Date]
              </div>

              <p>
                Welcome to the LeadDash platform. LeadDash Marketing LLC provides an 
                integrated platform combining marketing automation, contact management, 
                and electronic health records (LeadDash EMR) in a single HIPAA-compliant 
                system designed to help healthcare providers efficiently manage patient 
                information, streamline workflows, and ensure secure access to medical records.
              </p>

              <h6 className="mb-3">Acceptance of Terms</h6>
              <p className="mb-3">
                By accessing or using LeadDash EMR or any LeadDash services (collectively, 
                the "Platform"), you agree to be bound by these Terms &amp; Conditions. 
                If you do not agree, please do not use the Platform.
              </p>

              <h6 className="mb-3">Eligibility</h6>
              <p className="mb-3">
                The Platform is intended for use by licensed healthcare
                professionals, authorized staff, and healthcare institutions. You affirm that
                you have the authority to enter into this agreement on behalf of
                your organization and that you are authorized to access protected health 
                information (PHI) in accordance with applicable laws.
              </p>

              <h6 className="mb-3">User Responsibilities</h6>
              <ul className="mb-3 ps-3">
                <li className="mb-2">
                  Maintain the confidentiality of login credentials and access codes.
                </li>
                <li className="mb-2">
                  Ensure all information entered into the Platform is accurate and
                  up to date.
                </li>
                <li className="mb-2">
                  Use the Platform solely for lawful and authorized medical
                  purposes in compliance with HIPAA and other applicable healthcare regulations.
                </li>
                <li className="mb-2">
                  Access only the patient records you are authorized to view.
                </li>
                <li>
                  Immediately report any unauthorized use of your account or security breach.
                </li>
              </ul>

              <h6 className="mb-3">Data Privacy &amp; Security</h6>
              <ul className="mb-3 ps-3">
                <li className="mb-2">
                  LeadDash Marketing LLC complies with HIPAA, HITECH, and other applicable 
                  healthcare data protection laws (including GDPR where applicable).
                </li>
                <li className="mb-2">
                  All patient data and protected health information (PHI) is encrypted 
                  in transit (using TLS/SSL) and at rest.
                </li>
                <li className="mb-2">
                  We maintain a Business Associate Agreement (BAA) with all customers 
                  handling protected health information. A signed BAA is required prior 
                  to accessing the Platform.
                </li>
                <li className="mb-2">
                  All access to patient records is logged and auditable for HIPAA compliance.
                </li>
                <li>
                  You are responsible for complying with your local, state, and federal
                  privacy laws when accessing or entering patient information.
                </li>
              </ul>

              <h6 className="mb-3">Subscription &amp; Billing</h6>
              <ul className="mb-3 ps-3">
                <li className="mb-2">
                  Base subscription includes LeadDash platform access and LeadDash EMR 
                  for one healthcare location with one user.
                </li>
                <li className="mb-2">
                  Additional users (clinicians, staff with EMR access) are billed per 
                  user per month as specified in your service agreement.
                </li>
                <li className="mb-2">
                  User counts are calculated based on unique users who access the 
                  LeadDash EMR system during each billing period.
                </li>
                <li className="mb-2">
                  Billing is processed automatically through the LeadDash platform on 
                  a monthly recurring basis.
                </li>
                <li className="mb-2">
                  Subscription fees are non-refundable except as required by law.
                </li>
                <li>
                  30-day written notice is required for subscription cancellation. 
                  You remain responsible for fees through the end of your notice period.
                </li>
              </ul>

              <h6 className="mb-3">Access &amp; Usage Rights</h6>
              <ul className="mb-3 ps-3">
                <li className="mb-2">
                  You are granted a non-transferable, non-exclusive right to use the
                  Platform during your active subscription period.
                </li>
                <li className="mb-2">
                  Each user account is for a single individual and may not be shared.
                </li>
                <li>
                  You may not modify, reverse engineer, copy, or redistribute any part of
                  the Platform without prior written consent from LeadDash Marketing LLC.
                </li>
              </ul>

              <h6 className="mb-3">Data Ownership &amp; Portability</h6>
              <ul className="mb-3 ps-3">
                <li className="mb-2">
                  All patient records and clinical data entered into the Platform remain the
                  property of the healthcare provider or institution ("Customer Data").
                </li>
                <li className="mb-2">
                  LeadDash Marketing LLC does not claim ownership over Customer Data but may 
                  access it to provide support, maintenance, or when legally required.
                </li>
                <li className="mb-2">
                  Upon termination, you may request export of your Customer Data in a 
                  standard format within 30 days.
                </li>
                <li>
                  Customer Data may be permanently deleted 90 days after subscription 
                  termination unless otherwise required by law.
                </li>
              </ul>

              <h6 className="mb-3">System Availability &amp; Support</h6>
              <ul className="mb-3 ps-3">
                <li className="mb-2">
                  While we strive for 99.9% uptime, we do not guarantee uninterrupted
                  access to the Platform.
                </li>
                <li className="mb-2">
                  Scheduled maintenance will be announced in advance when possible.
                </li>
                <li>
                  Unforeseen technical issues or force majeure events may temporarily 
                  affect Platform availability.
                </li>
              </ul>

              <h6 className="mb-3">Limitations of Liability</h6>
              <ul className="mb-3 ps-3">
                <li className="mb-2">
                  LeadDash Marketing LLC provides tools for documentation and record-keeping. 
                  We are not liable for medical decisions made based on data in the Platform.
                </li>
                <li className="mb-2">
                  Clinical judgment and patient care decisions remain solely the 
                  responsibility of licensed healthcare providers.
                </li>
                <li className="mb-2">
                  Our total liability for any claim arising from Platform use shall not 
                  exceed the total amount paid by the customer for Platform access in the 
                  past 12 months.
                </li>
                <li>
                  We are not liable for data loss due to user error, unauthorized access 
                  resulting from compromised credentials, or third-party service interruptions.
                </li>
              </ul>

              <h6 className="mb-3">Indemnification</h6>
              <p className="mb-3">
                You agree to indemnify and hold harmless LeadDash Marketing LLC from any claims, 
                damages, or expenses arising from your use of the Platform, violation of 
                these Terms, or violation of applicable healthcare laws and regulations.
              </p>

              <h6 className="mb-3">Termination</h6>
              <ul className="mb-3 ps-3">
                <li className="mb-2">
                  LeadDash Marketing LLC reserves the right to suspend or terminate access if 
                  these Terms are violated, if payment is not received, or if we 
                  reasonably believe the Platform is being misused.
                </li>
                <li className="mb-2">
                  You may terminate your subscription by providing 30 days written notice 
                  and ceasing all use of the Platform.
                </li>
                <li>
                  Upon termination, your access will be revoked and you must cease using 
                  the Platform immediately.
                </li>
              </ul>

              <h6 className="mb-3">Modifications to Terms</h6>
              <p className="mb-3">
                LeadDash Marketing LLC may revise these Terms at any time. We will notify you of 
                material changes via email or Platform notification. Continued use of the 
                Platform after changes are posted constitutes acceptance of the revised Terms.
              </p>

              <h6 className="mb-3">Governing Law</h6>
              <p className="mb-3">
                These Terms shall be governed by and construed in accordance with the laws 
                of the State of Oklahoma, without regard to its conflict of law provisions. Any 
                disputes shall be resolved in the state or federal courts located in Oklahoma County, Oklahoma.
              </p>

              <h6 className="mb-3">Contact Information</h6>
              <p className="mb-0">
                For questions about these Terms &amp; Conditions, please contact:<br/>
                <strong>LeadDash Marketing LLC</strong><br/>
                <strong>Email:</strong> support@leaddash.io<br/>
                <strong>Website:</strong> www.leaddash.io
              </p>
            </div>
            {/* end card body */}
          </div>
          {/* end card */}
        </div>
        {/* End Content */}
        {/* Start Footer */}
        <CommonFooter />
        {/* End Footer */}
      </div>
      {/* ========================
			End Page Content
		========================= */}
    </>
  )
}

export default TermsAndConditions;