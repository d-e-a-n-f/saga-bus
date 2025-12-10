"use client";

import { useState, useEffect, useCallback } from "react";
import type { LoanApplicationStatus } from "@saga-bus/examples-shared";

interface ApplicantInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  ssn: string;
  dateOfBirth: string;
  annualIncome: number;
  employmentStatus: "employed" | "self_employed" | "unemployed" | "retired";
  employerName: string;
}

interface PropertyInfo {
  address: string;
  estimatedValue: number;
  propertyType: "single_family" | "condo" | "multi_family" | "commercial";
}

interface ApplicationFormData {
  loanType: "personal" | "mortgage" | "auto" | "business";
  requestedAmount: number;
  termMonths: number;
  applicantInfo: ApplicantInfo;
  propertyInfo: PropertyInfo;
}

interface Application {
  applicationId: string;
  status: LoanApplicationStatus;
  loanType: string;
  requestedAmount: number;
  applicantName: string;
  creditScore?: number;
  approvedAmount?: number;
  interestRate?: number;
  statusHistory: Array<{
    status: string;
    timestamp: string;
    reason?: string;
  }>;
}

// Status configuration with colors and descriptions
const STATUS_CONFIG: Record<
  LoanApplicationStatus,
  { label: string; color: string; bgColor: string; description: string; phase: number }
> = {
  submitted: { label: "Submitted", color: "#2563eb", bgColor: "#dbeafe", description: "Application received", phase: 1 },
  identity_verification_pending: { label: "Verifying Identity", color: "#7c3aed", bgColor: "#ede9fe", description: "Checking applicant identity", phase: 1 },
  identity_verified: { label: "Identity Verified", color: "#059669", bgColor: "#d1fae5", description: "Identity confirmed", phase: 1 },
  identity_verification_failed: { label: "Identity Failed", color: "#dc2626", bgColor: "#fee2e2", description: "Could not verify identity", phase: 1 },
  credit_check_pending: { label: "Checking Credit", color: "#7c3aed", bgColor: "#ede9fe", description: "Running credit check", phase: 2 },
  credit_check_completed: { label: "Credit Checked", color: "#059669", bgColor: "#d1fae5", description: "Credit report received", phase: 2 },
  credit_check_failed: { label: "Credit Failed", color: "#dc2626", bgColor: "#fee2e2", description: "Credit check failed", phase: 2 },
  employment_verification_pending: { label: "Verifying Employment", color: "#7c3aed", bgColor: "#ede9fe", description: "Confirming employment", phase: 3 },
  employment_verified: { label: "Employment Verified", color: "#059669", bgColor: "#d1fae5", description: "Employment confirmed", phase: 3 },
  employment_verification_failed: { label: "Employment Failed", color: "#dc2626", bgColor: "#fee2e2", description: "Could not verify employment", phase: 3 },
  documents_requested: { label: "Documents Needed", color: "#d97706", bgColor: "#fef3c7", description: "Waiting for documents", phase: 4 },
  documents_received: { label: "Documents Received", color: "#2563eb", bgColor: "#dbeafe", description: "Reviewing documents", phase: 4 },
  documents_verified: { label: "Documents Verified", color: "#059669", bgColor: "#d1fae5", description: "All documents approved", phase: 4 },
  documents_verification_failed: { label: "Documents Rejected", color: "#dc2626", bgColor: "#fee2e2", description: "Some documents rejected", phase: 4 },
  appraisal_pending: { label: "Appraisal Pending", color: "#7c3aed", bgColor: "#ede9fe", description: "Property being appraised", phase: 5 },
  appraisal_completed: { label: "Appraisal Done", color: "#059669", bgColor: "#d1fae5", description: "Property value confirmed", phase: 5 },
  appraisal_failed: { label: "Appraisal Failed", color: "#dc2626", bgColor: "#fee2e2", description: "Property appraisal failed", phase: 5 },
  underwriting_pending: { label: "Underwriting", color: "#7c3aed", bgColor: "#ede9fe", description: "Under review by underwriter", phase: 6 },
  underwriting_approved: { label: "Underwriting Approved", color: "#059669", bgColor: "#d1fae5", description: "Approved by underwriter", phase: 6 },
  underwriting_denied: { label: "Underwriting Denied", color: "#dc2626", bgColor: "#fee2e2", description: "Denied by underwriter", phase: 6 },
  underwriting_review: { label: "Manual Review", color: "#d97706", bgColor: "#fef3c7", description: "Requires manual review", phase: 6 },
  final_approval_pending: { label: "Final Approval", color: "#7c3aed", bgColor: "#ede9fe", description: "Awaiting final approval", phase: 7 },
  approved: { label: "Approved!", color: "#059669", bgColor: "#d1fae5", description: "Loan approved", phase: 7 },
  offer_sent: { label: "Offer Sent", color: "#2563eb", bgColor: "#dbeafe", description: "Loan offer sent to applicant", phase: 8 },
  offer_accepted: { label: "Offer Accepted", color: "#059669", bgColor: "#d1fae5", description: "Applicant accepted offer", phase: 8 },
  offer_declined: { label: "Offer Declined", color: "#dc2626", bgColor: "#fee2e2", description: "Applicant declined offer", phase: 8 },
  offer_expired: { label: "Offer Expired", color: "#6b7280", bgColor: "#f3f4f6", description: "Offer expired", phase: 8 },
  disbursement_pending: { label: "Disbursing Funds", color: "#7c3aed", bgColor: "#ede9fe", description: "Processing disbursement", phase: 9 },
  disbursement_completed: { label: "Funds Sent", color: "#059669", bgColor: "#d1fae5", description: "Funds disbursed", phase: 9 },
  disbursement_failed: { label: "Disbursement Failed", color: "#dc2626", bgColor: "#fee2e2", description: "Disbursement failed", phase: 9 },
  completed: { label: "Complete", color: "#059669", bgColor: "#d1fae5", description: "Loan funded!", phase: 10 },
  cancelled: { label: "Cancelled", color: "#6b7280", bgColor: "#f3f4f6", description: "Application cancelled", phase: 0 },
  denied: { label: "Denied", color: "#dc2626", bgColor: "#fee2e2", description: "Application denied", phase: 0 },
};

const PHASES = [
  { name: "Submit", statuses: ["submitted"] },
  { name: "Identity", statuses: ["identity_verification_pending", "identity_verified"] },
  { name: "Credit", statuses: ["credit_check_pending", "credit_check_completed"] },
  { name: "Employment", statuses: ["employment_verification_pending", "employment_verified"] },
  { name: "Documents", statuses: ["documents_requested", "documents_received", "documents_verified"] },
  { name: "Appraisal", statuses: ["appraisal_pending", "appraisal_completed"] },
  { name: "Underwriting", statuses: ["underwriting_pending", "underwriting_approved", "underwriting_review"] },
  { name: "Approval", statuses: ["final_approval_pending", "approved"] },
  { name: "Offer", statuses: ["offer_sent", "offer_accepted"] },
  { name: "Disbursement", statuses: ["disbursement_pending", "disbursement_completed"] },
  { name: "Complete", statuses: ["completed"] },
];

const defaultFormData: ApplicationFormData = {
  loanType: "personal",
  requestedAmount: 25000,
  termMonths: 60,
  applicantInfo: {
    firstName: "John",
    lastName: "Smith",
    email: "john.smith@example.com",
    phone: "555-123-4567",
    ssn: "123-45-6789",
    dateOfBirth: "1985-06-15",
    annualIncome: 85000,
    employmentStatus: "employed",
    employerName: "Acme Corporation",
  },
  propertyInfo: {
    address: "123 Main St, Springfield, IL 62701",
    estimatedValue: 350000,
    propertyType: "single_family",
  },
};

export default function LoanApplicationPage() {
  const [formData, setFormData] = useState<ApplicationFormData>(defaultFormData);
  const [submitting, setSubmitting] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [simulating, setSimulating] = useState<string | null>(null);
  const [autoAdvance, setAutoAdvance] = useState(false);

  // Fetch application status periodically
  const fetchApplications = useCallback(async () => {
    try {
      const response = await fetch("/api/applications");
      if (response.ok) {
        const data = await response.json();
        setApplications(data.applications);
      }
    } catch (error) {
      console.error("Failed to fetch applications:", error);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(fetchApplications, 2000);
    fetchApplications();
    return () => clearInterval(interval);
  }, [fetchApplications]);

  // Auto-advance simulation
  useEffect(() => {
    if (!autoAdvance || applications.length === 0) return;

    const advanceInterval = setInterval(async () => {
      for (const app of applications) {
        const action = getNextAction(app.status);
        if (action && !isTerminalStatus(app.status)) {
          await simulateAction(app.applicationId, action.action);
          break; // One at a time
        }
      }
    }, 1500);

    return () => clearInterval(advanceInterval);
  }, [autoAdvance, applications]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedApp(data.applicationId);
        fetchApplications();
      }
    } catch (error) {
      console.error("Failed to submit:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const simulateAction = async (applicationId: string, action: string) => {
    setSimulating(`${applicationId}-${action}`);
    try {
      await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, action }),
      });
      // Small delay to let the saga process
      await new Promise((resolve) => setTimeout(resolve, 300));
      fetchApplications();
    } catch (error) {
      console.error("Simulation failed:", error);
    } finally {
      setSimulating(null);
    }
  };

  const getNextAction = (
    status: LoanApplicationStatus
  ): { action: string; label: string; failAction?: string; failLabel?: string } | null => {
    switch (status) {
      case "identity_verification_pending":
        return { action: "identity_verified", label: "Verify Identity", failAction: "identity_failed", failLabel: "Fail Identity" };
      case "credit_check_pending":
        return { action: "credit_completed", label: "Complete Credit Check", failAction: "credit_failed", failLabel: "Fail Credit" };
      case "employment_verification_pending":
        return { action: "employment_verified", label: "Verify Employment", failAction: "employment_failed", failLabel: "Fail Employment" };
      case "documents_requested":
        return { action: "documents_received", label: "Upload Documents" };
      case "documents_received":
        return { action: "documents_verified", label: "Verify Documents", failAction: "documents_failed", failLabel: "Reject Documents" };
      case "appraisal_pending":
        return { action: "appraisal_completed", label: "Complete Appraisal", failAction: "appraisal_failed", failLabel: "Fail Appraisal" };
      case "underwriting_pending":
        return { action: "underwriting_approved", label: "Approve Underwriting", failAction: "underwriting_denied", failLabel: "Deny" };
      case "underwriting_review":
        return { action: "underwriting_approved", label: "Approve After Review", failAction: "underwriting_denied", failLabel: "Deny After Review" };
      case "offer_sent":
        return { action: "offer_accepted", label: "Accept Offer", failAction: "offer_declined", failLabel: "Decline Offer" };
      case "disbursement_pending":
        return { action: "disbursement_completed", label: "Complete Disbursement", failAction: "disbursement_failed", failLabel: "Fail Disbursement" };
      default:
        return null;
    }
  };

  const isTerminalStatus = (status: LoanApplicationStatus): boolean => {
    return ["completed", "cancelled", "denied", "offer_declined", "offer_expired"].includes(status);
  };

  const selectedApplication = applications.find((a) => a.applicationId === selectedApp);

  return (
    <div style={{ display: "flex", gap: "20px" }}>
      {/* Left Panel - Application Form */}
      <div style={{ width: "400px", flexShrink: 0 }}>
        <div style={{ background: "white", borderRadius: "8px", padding: "20px", marginBottom: "20px" }}>
          <h2 style={{ margin: "0 0 20px" }}>New Application</h2>
          <form onSubmit={handleSubmit}>
            {/* Loan Type */}
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: 600, fontSize: "14px" }}>
                Loan Type
              </label>
              <select
                value={formData.loanType}
                onChange={(e) =>
                  setFormData({ ...formData, loanType: e.target.value as ApplicationFormData["loanType"] })
                }
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #d1d5db" }}
              >
                <option value="personal">Personal Loan</option>
                <option value="mortgage">Mortgage</option>
                <option value="auto">Auto Loan</option>
                <option value="business">Business Loan</option>
              </select>
            </div>

            {/* Amount and Term */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: 600, fontSize: "14px" }}>
                  Amount ($)
                </label>
                <input
                  type="number"
                  value={formData.requestedAmount}
                  onChange={(e) => setFormData({ ...formData, requestedAmount: parseInt(e.target.value) || 0 })}
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #d1d5db", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: 600, fontSize: "14px" }}>
                  Term (months)
                </label>
                <input
                  type="number"
                  value={formData.termMonths}
                  onChange={(e) => setFormData({ ...formData, termMonths: parseInt(e.target.value) || 0 })}
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #d1d5db", boxSizing: "border-box" }}
                />
              </div>
            </div>

            {/* Applicant Name */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: 600, fontSize: "14px" }}>
                  First Name
                </label>
                <input
                  type="text"
                  value={formData.applicantInfo.firstName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      applicantInfo: { ...formData.applicantInfo, firstName: e.target.value },
                    })
                  }
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #d1d5db", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: 600, fontSize: "14px" }}>
                  Last Name
                </label>
                <input
                  type="text"
                  value={formData.applicantInfo.lastName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      applicantInfo: { ...formData.applicantInfo, lastName: e.target.value },
                    })
                  }
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #d1d5db", boxSizing: "border-box" }}
                />
              </div>
            </div>

            {/* Annual Income */}
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: 600, fontSize: "14px" }}>
                Annual Income ($)
              </label>
              <input
                type="number"
                value={formData.applicantInfo.annualIncome}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    applicantInfo: { ...formData.applicantInfo, annualIncome: parseInt(e.target.value) || 0 },
                  })
                }
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #d1d5db", boxSizing: "border-box" }}
              />
            </div>

            {/* Employment Status */}
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: 600, fontSize: "14px" }}>
                Employment Status
              </label>
              <select
                value={formData.applicantInfo.employmentStatus}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    applicantInfo: {
                      ...formData.applicantInfo,
                      employmentStatus: e.target.value as ApplicantInfo["employmentStatus"],
                    },
                  })
                }
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #d1d5db" }}
              >
                <option value="employed">Employed</option>
                <option value="self_employed">Self-Employed</option>
                <option value="retired">Retired</option>
                <option value="unemployed">Unemployed</option>
              </select>
            </div>

            {/* Property Info for Mortgage */}
            {formData.loanType === "mortgage" && (
              <div style={{ padding: "15px", background: "#f8fafc", borderRadius: "6px", marginBottom: "15px" }}>
                <h4 style={{ margin: "0 0 10px", fontSize: "14px" }}>Property Information</h4>
                <div style={{ marginBottom: "10px" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "13px" }}>Address</label>
                  <input
                    type="text"
                    value={formData.propertyInfo.address}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        propertyInfo: { ...formData.propertyInfo, address: e.target.value },
                      })
                    }
                    style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #d1d5db", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", marginBottom: "5px", fontSize: "13px" }}>Est. Value ($)</label>
                    <input
                      type="number"
                      value={formData.propertyInfo.estimatedValue}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          propertyInfo: { ...formData.propertyInfo, estimatedValue: parseInt(e.target.value) || 0 },
                        })
                      }
                      style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #d1d5db", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", marginBottom: "5px", fontSize: "13px" }}>Type</label>
                    <select
                      value={formData.propertyInfo.propertyType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          propertyInfo: {
                            ...formData.propertyInfo,
                            propertyType: e.target.value as PropertyInfo["propertyType"],
                          },
                        })
                      }
                      style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #d1d5db" }}
                    >
                      <option value="single_family">Single Family</option>
                      <option value="condo">Condo</option>
                      <option value="multi_family">Multi Family</option>
                      <option value="commercial">Commercial</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%",
                padding: "12px",
                background: submitting ? "#9ca3af" : "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "16px",
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Submitting..." : "Submit Application"}
            </button>
          </form>
        </div>

        {/* Auto Advance Toggle */}
        <div style={{ background: "white", borderRadius: "8px", padding: "15px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={(e) => setAutoAdvance(e.target.checked)}
              style={{ width: "18px", height: "18px" }}
            />
            <span style={{ fontWeight: 500 }}>Auto-Advance Simulation</span>
          </label>
          <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#6b7280" }}>
            Automatically progress applications through each step
          </p>
        </div>
      </div>

      {/* Middle Panel - Application List */}
      <div style={{ width: "350px", flexShrink: 0 }}>
        <div style={{ background: "white", borderRadius: "8px", padding: "20px" }}>
          <h2 style={{ margin: "0 0 15px" }}>Applications ({applications.length})</h2>
          {applications.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#6b7280" }}>
              No applications yet. Submit one to get started.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {applications.map((app) => {
                const config = STATUS_CONFIG[app.status] || STATUS_CONFIG.submitted;
                const isSelected = selectedApp === app.applicationId;

                return (
                  <div
                    key={app.applicationId}
                    onClick={() => setSelectedApp(app.applicationId)}
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      border: isSelected ? "2px solid #2563eb" : "1px solid #e5e7eb",
                      cursor: "pointer",
                      background: isSelected ? "#eff6ff" : "white",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontWeight: 600 }}>{app.applicantName}</span>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: config.color,
                          background: config.bgColor,
                        }}
                      >
                        {config.label}
                      </span>
                    </div>
                    <div style={{ fontSize: "13px", color: "#6b7280" }}>
                      {app.loanType.charAt(0).toUpperCase() + app.loanType.slice(1)} - $
                      {app.requestedAmount.toLocaleString()}
                    </div>
                    <code style={{ fontSize: "10px", color: "#9ca3af" }}>{app.applicationId}</code>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Application Details */}
      <div style={{ flex: 1 }}>
        {selectedApplication ? (
          <div style={{ background: "white", borderRadius: "8px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h2 style={{ margin: "0 0 5px" }}>{selectedApplication.applicantName}</h2>
                <p style={{ margin: 0, color: "#6b7280" }}>
                  {selectedApplication.loanType.charAt(0).toUpperCase() + selectedApplication.loanType.slice(1)} Loan -
                  ${selectedApplication.requestedAmount.toLocaleString()}
                </p>
              </div>
              <div
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: STATUS_CONFIG[selectedApplication.status]?.color || "#2563eb",
                  background: STATUS_CONFIG[selectedApplication.status]?.bgColor || "#dbeafe",
                }}
              >
                {STATUS_CONFIG[selectedApplication.status]?.label || selectedApplication.status}
              </div>
            </div>

            {/* Phase Progress Bar */}
            <div style={{ marginBottom: "25px" }}>
              <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
                {PHASES.map((phase, i) => {
                  const currentPhase = STATUS_CONFIG[selectedApplication.status]?.phase || 0;
                  const isActive = i + 1 <= currentPhase;
                  const isCurrent = i + 1 === currentPhase;
                  const isFailed = currentPhase === 0;

                  return (
                    <div
                      key={phase.name}
                      style={{
                        flex: 1,
                        height: "8px",
                        borderRadius: "4px",
                        background: isFailed ? "#fee2e2" : isActive ? "#2563eb" : "#e5e7eb",
                        position: "relative",
                      }}
                    >
                      {isCurrent && !isFailed && (
                        <div
                          style={{
                            position: "absolute",
                            top: "-20px",
                            left: "50%",
                            transform: "translateX(-50%)",
                            fontSize: "10px",
                            fontWeight: 600,
                            color: "#2563eb",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {phase.name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#9ca3af" }}>
                {PHASES.map((phase) => (
                  <span key={phase.name} style={{ flex: 1, textAlign: "center" }}>
                    {phase.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Key Metrics */}
            {(selectedApplication.creditScore || selectedApplication.approvedAmount) && (
              <div style={{ display: "flex", gap: "15px", marginBottom: "25px" }}>
                {selectedApplication.creditScore && (
                  <div style={{ flex: 1, padding: "15px", background: "#f8fafc", borderRadius: "8px" }}>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Credit Score</div>
                    <div style={{ fontSize: "24px", fontWeight: 700, color: selectedApplication.creditScore >= 700 ? "#059669" : selectedApplication.creditScore >= 650 ? "#d97706" : "#dc2626" }}>
                      {selectedApplication.creditScore}
                    </div>
                  </div>
                )}
                {selectedApplication.approvedAmount && (
                  <div style={{ flex: 1, padding: "15px", background: "#f8fafc", borderRadius: "8px" }}>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Approved Amount</div>
                    <div style={{ fontSize: "24px", fontWeight: 700, color: "#059669" }}>
                      ${selectedApplication.approvedAmount.toLocaleString()}
                    </div>
                  </div>
                )}
                {selectedApplication.interestRate && (
                  <div style={{ flex: 1, padding: "15px", background: "#f8fafc", borderRadius: "8px" }}>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Interest Rate</div>
                    <div style={{ fontSize: "24px", fontWeight: 700, color: "#2563eb" }}>
                      {selectedApplication.interestRate.toFixed(2)}%
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Simulation Controls */}
            {!isTerminalStatus(selectedApplication.status) && (
              <div style={{ marginBottom: "25px" }}>
                <h3 style={{ margin: "0 0 10px", fontSize: "14px", color: "#6b7280" }}>Simulate Next Step</h3>
                {(() => {
                  const action = getNextAction(selectedApplication.status);
                  if (!action) return <div style={{ color: "#9ca3af" }}>Waiting for saga to process...</div>;

                  const isSimulatingThis = simulating?.startsWith(selectedApplication.applicationId);

                  return (
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        onClick={() => simulateAction(selectedApplication.applicationId, action.action)}
                        disabled={!!isSimulatingThis}
                        style={{
                          padding: "10px 20px",
                          background: isSimulatingThis ? "#9ca3af" : "#059669",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "14px",
                          fontWeight: 500,
                          cursor: isSimulatingThis ? "not-allowed" : "pointer",
                        }}
                      >
                        {isSimulatingThis ? "Processing..." : action.label}
                      </button>
                      {action.failAction && (
                        <button
                          onClick={() => simulateAction(selectedApplication.applicationId, action.failAction!)}
                          disabled={!!isSimulatingThis}
                          style={{
                            padding: "10px 20px",
                            background: isSimulatingThis ? "#9ca3af" : "#dc2626",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "14px",
                            fontWeight: 500,
                            cursor: isSimulatingThis ? "not-allowed" : "pointer",
                          }}
                        >
                          {action.failLabel}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Status History */}
            <div>
              <h3 style={{ margin: "0 0 15px", fontSize: "14px", color: "#6b7280" }}>Status History</h3>
              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                {selectedApplication.statusHistory.map((entry, i) => {
                  const config = STATUS_CONFIG[entry.status as LoanApplicationStatus];

                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "12px",
                        paddingBottom: "12px",
                        marginBottom: "12px",
                        borderBottom: i < selectedApplication.statusHistory.length - 1 ? "1px solid #e5e7eb" : "none",
                      }}
                    >
                      <div
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          background: config?.color || "#6b7280",
                          marginTop: "5px",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: "14px" }}>{config?.label || entry.status}</div>
                        {entry.reason && (
                          <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "2px" }}>{entry.reason}</div>
                        )}
                        <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>
                          {new Date(entry.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: "white",
              borderRadius: "8px",
              padding: "60px",
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            <h3 style={{ margin: "0 0 10px" }}>Select an Application</h3>
            <p style={{ margin: 0 }}>Click on an application to view its details and simulate workflow steps</p>
          </div>
        )}
      </div>
    </div>
  );
}
