import type { BaseMessage } from "@saga-bus/core";

// ==========================================
// Loan Application Saga Messages
// A complex multi-step loan approval workflow
// ==========================================

// --- Application Submission ---

export interface LoanApplicationSubmitted extends BaseMessage {
  readonly type: "LoanApplicationSubmitted";
  readonly applicationId: string;
  readonly applicantId: string;
  readonly loanType: "personal" | "mortgage" | "auto" | "business";
  readonly requestedAmount: number;
  readonly termMonths: number;
  readonly applicantInfo: {
    readonly firstName: string;
    readonly lastName: string;
    readonly email: string;
    readonly phone: string;
    readonly ssn: string;
    readonly dateOfBirth: string;
    readonly annualIncome: number;
    readonly employmentStatus: "employed" | "self_employed" | "unemployed" | "retired";
    readonly employerName?: string;
  };
  readonly propertyInfo?: {
    readonly address: string;
    readonly estimatedValue: number;
    readonly propertyType: "single_family" | "condo" | "multi_family" | "commercial";
  };
}

// --- Identity Verification ---

export interface IdentityVerificationRequested extends BaseMessage {
  readonly type: "IdentityVerificationRequested";
  readonly applicationId: string;
  readonly applicantId: string;
  readonly ssn: string;
  readonly dateOfBirth: string;
  readonly firstName: string;
  readonly lastName: string;
}

export interface IdentityVerified extends BaseMessage {
  readonly type: "IdentityVerified";
  readonly applicationId: string;
  readonly verificationId: string;
  readonly verificationScore: number;
  readonly matchedFields: string[];
}

export interface IdentityVerificationFailed extends BaseMessage {
  readonly type: "IdentityVerificationFailed";
  readonly applicationId: string;
  readonly reason: string;
  readonly failedChecks: string[];
}

// --- Credit Check ---

export interface CreditCheckRequested extends BaseMessage {
  readonly type: "CreditCheckRequested";
  readonly applicationId: string;
  readonly applicantId: string;
  readonly ssn: string;
}

export interface CreditCheckCompleted extends BaseMessage {
  readonly type: "CreditCheckCompleted";
  readonly applicationId: string;
  readonly creditScore: number;
  readonly creditReportId: string;
  readonly debtToIncomeRatio: number;
  readonly openAccounts: number;
  readonly negativeMarks: number;
  readonly creditHistory: {
    readonly oldestAccountYears: number;
    readonly recentInquiries: number;
    readonly missedPayments30Days: number;
    readonly missedPayments60Days: number;
    readonly missedPayments90Days: number;
  };
}

export interface CreditCheckFailed extends BaseMessage {
  readonly type: "CreditCheckFailed";
  readonly applicationId: string;
  readonly reason: string;
}

// --- Employment Verification ---

export interface EmploymentVerificationRequested extends BaseMessage {
  readonly type: "EmploymentVerificationRequested";
  readonly applicationId: string;
  readonly applicantId: string;
  readonly employerName: string;
  readonly annualIncome: number;
}

export interface EmploymentVerified extends BaseMessage {
  readonly type: "EmploymentVerified";
  readonly applicationId: string;
  readonly verificationId: string;
  readonly confirmedIncome: number;
  readonly employmentStartDate: string;
  readonly employmentType: "full_time" | "part_time" | "contractor";
}

export interface EmploymentVerificationFailed extends BaseMessage {
  readonly type: "EmploymentVerificationFailed";
  readonly applicationId: string;
  readonly reason: string;
}

// --- Document Collection ---

export interface DocumentsRequested extends BaseMessage {
  readonly type: "DocumentsRequested";
  readonly applicationId: string;
  readonly requiredDocuments: string[];
}

export interface DocumentsReceived extends BaseMessage {
  readonly type: "DocumentsReceived";
  readonly applicationId: string;
  readonly documents: Array<{
    readonly documentType: string;
    readonly documentId: string;
    readonly uploadedAt: string;
  }>;
}

export interface DocumentsVerified extends BaseMessage {
  readonly type: "DocumentsVerified";
  readonly applicationId: string;
  readonly verificationResults: Array<{
    readonly documentType: string;
    readonly status: "verified" | "rejected";
    readonly notes?: string;
  }>;
}

export interface DocumentVerificationFailed extends BaseMessage {
  readonly type: "DocumentVerificationFailed";
  readonly applicationId: string;
  readonly reason: string;
  readonly failedDocuments: string[];
}

// --- Property Appraisal (for mortgage) ---

export interface AppraisalRequested extends BaseMessage {
  readonly type: "AppraisalRequested";
  readonly applicationId: string;
  readonly propertyAddress: string;
  readonly estimatedValue: number;
}

export interface AppraisalCompleted extends BaseMessage {
  readonly type: "AppraisalCompleted";
  readonly applicationId: string;
  readonly appraisalId: string;
  readonly appraisedValue: number;
  readonly appraisalDate: string;
  readonly appraiserName: string;
  readonly loanToValueRatio: number;
}

export interface AppraisalFailed extends BaseMessage {
  readonly type: "AppraisalFailed";
  readonly applicationId: string;
  readonly reason: string;
}

// --- Underwriting ---

export interface UnderwritingRequested extends BaseMessage {
  readonly type: "UnderwritingRequested";
  readonly applicationId: string;
  readonly creditScore: number;
  readonly debtToIncomeRatio: number;
  readonly requestedAmount: number;
  readonly loanToValueRatio?: number;
}

export interface UnderwritingApproved extends BaseMessage {
  readonly type: "UnderwritingApproved";
  readonly applicationId: string;
  readonly underwriterId: string;
  readonly approvedAmount: number;
  readonly interestRate: number;
  readonly conditions: string[];
  readonly riskScore: number;
}

export interface UnderwritingDenied extends BaseMessage {
  readonly type: "UnderwritingDenied";
  readonly applicationId: string;
  readonly underwriterId: string;
  readonly reason: string;
  readonly appealDeadline?: string;
}

export interface UnderwritingPendingReview extends BaseMessage {
  readonly type: "UnderwritingPendingReview";
  readonly applicationId: string;
  readonly reason: string;
  readonly requiredActions: string[];
}

// --- Final Approval ---

export interface FinalApprovalRequested extends BaseMessage {
  readonly type: "FinalApprovalRequested";
  readonly applicationId: string;
  readonly approvedAmount: number;
  readonly interestRate: number;
}

export interface LoanApproved extends BaseMessage {
  readonly type: "LoanApproved";
  readonly applicationId: string;
  readonly loanId: string;
  readonly approvedAmount: number;
  readonly interestRate: number;
  readonly monthlyPayment: number;
  readonly firstPaymentDate: string;
}

// --- Loan Offer & Acceptance ---

export interface LoanOfferSent extends BaseMessage {
  readonly type: "LoanOfferSent";
  readonly applicationId: string;
  readonly loanId: string;
  readonly offerExpiresAt: string;
}

export interface LoanOfferAccepted extends BaseMessage {
  readonly type: "LoanOfferAccepted";
  readonly applicationId: string;
  readonly loanId: string;
  readonly acceptedAt: string;
  readonly eSignatureId: string;
}

export interface LoanOfferDeclined extends BaseMessage {
  readonly type: "LoanOfferDeclined";
  readonly applicationId: string;
  readonly loanId: string;
  readonly reason?: string;
}

export interface LoanOfferExpired extends BaseMessage {
  readonly type: "LoanOfferExpired";
  readonly applicationId: string;
  readonly loanId: string;
}

// --- Disbursement ---

export interface DisbursementRequested extends BaseMessage {
  readonly type: "DisbursementRequested";
  readonly applicationId: string;
  readonly loanId: string;
  readonly amount: number;
  readonly disbursementMethod: "ach" | "wire" | "check";
  readonly accountDetails?: {
    readonly routingNumber: string;
    readonly accountNumber: string;
  };
}

export interface DisbursementCompleted extends BaseMessage {
  readonly type: "DisbursementCompleted";
  readonly applicationId: string;
  readonly loanId: string;
  readonly disbursementId: string;
  readonly amount: number;
  readonly disbursedAt: string;
  readonly confirmationNumber: string;
}

export interface DisbursementFailed extends BaseMessage {
  readonly type: "DisbursementFailed";
  readonly applicationId: string;
  readonly loanId: string;
  readonly reason: string;
}

// --- Application Status Updates ---

export interface ApplicationStatusUpdated extends BaseMessage {
  readonly type: "ApplicationStatusUpdated";
  readonly applicationId: string;
  readonly previousStatus: string;
  readonly newStatus: string;
  readonly updatedAt: string;
  readonly updatedBy: string;
}

export interface ApplicationCancelled extends BaseMessage {
  readonly type: "ApplicationCancelled";
  readonly applicationId: string;
  readonly reason: string;
  readonly cancelledBy: "applicant" | "system" | "underwriter";
}

export interface ApplicationCompleted extends BaseMessage {
  readonly type: "ApplicationCompleted";
  readonly applicationId: string;
  readonly loanId: string;
  readonly completedAt: string;
}

// Union of all loan messages
export type LoanMessage =
  | LoanApplicationSubmitted
  | IdentityVerificationRequested
  | IdentityVerified
  | IdentityVerificationFailed
  | CreditCheckRequested
  | CreditCheckCompleted
  | CreditCheckFailed
  | EmploymentVerificationRequested
  | EmploymentVerified
  | EmploymentVerificationFailed
  | DocumentsRequested
  | DocumentsReceived
  | DocumentsVerified
  | DocumentVerificationFailed
  | AppraisalRequested
  | AppraisalCompleted
  | AppraisalFailed
  | UnderwritingRequested
  | UnderwritingApproved
  | UnderwritingDenied
  | UnderwritingPendingReview
  | FinalApprovalRequested
  | LoanApproved
  | LoanOfferSent
  | LoanOfferAccepted
  | LoanOfferDeclined
  | LoanOfferExpired
  | DisbursementRequested
  | DisbursementCompleted
  | DisbursementFailed
  | ApplicationStatusUpdated
  | ApplicationCancelled
  | ApplicationCompleted;
