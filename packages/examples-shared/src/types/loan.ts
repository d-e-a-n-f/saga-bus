import type { SagaState } from "@saga-bus/core";

// Loan Application Status - many states!
export type LoanApplicationStatus =
  // Initial
  | "submitted"
  // Identity verification
  | "identity_verification_pending"
  | "identity_verified"
  | "identity_verification_failed"
  // Credit check
  | "credit_check_pending"
  | "credit_check_completed"
  | "credit_check_failed"
  // Employment verification
  | "employment_verification_pending"
  | "employment_verified"
  | "employment_verification_failed"
  // Document collection
  | "documents_requested"
  | "documents_received"
  | "documents_verified"
  | "documents_verification_failed"
  // Appraisal (mortgage only)
  | "appraisal_pending"
  | "appraisal_completed"
  | "appraisal_failed"
  // Underwriting
  | "underwriting_pending"
  | "underwriting_approved"
  | "underwriting_denied"
  | "underwriting_review"
  // Final approval
  | "final_approval_pending"
  | "approved"
  // Offer
  | "offer_sent"
  | "offer_accepted"
  | "offer_declined"
  | "offer_expired"
  // Disbursement
  | "disbursement_pending"
  | "disbursement_completed"
  | "disbursement_failed"
  // Terminal
  | "completed"
  | "cancelled"
  | "denied";

// Credit history details
export interface CreditHistory {
  readonly oldestAccountYears: number;
  readonly recentInquiries: number;
  readonly missedPayments30Days: number;
  readonly missedPayments60Days: number;
  readonly missedPayments90Days: number;
}

// Document tracking
export interface DocumentRecord {
  readonly documentType: string;
  readonly documentId: string;
  readonly uploadedAt: string;
  readonly status: "pending" | "verified" | "rejected";
  readonly notes?: string;
}

// The full saga state
export interface LoanApplicationSagaState extends SagaState {
  readonly applicationId: string;
  readonly applicantId: string;
  readonly loanType: "personal" | "mortgage" | "auto" | "business";
  readonly requestedAmount: number;
  readonly termMonths: number;
  readonly status: LoanApplicationStatus;

  // Applicant info
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

  // Property info (mortgage only)
  readonly propertyInfo?: {
    readonly address: string;
    readonly estimatedValue: number;
    readonly propertyType: "single_family" | "condo" | "multi_family" | "commercial";
  };

  // Identity verification results
  readonly identityVerification?: {
    readonly verificationId: string;
    readonly verificationScore: number;
    readonly matchedFields: string[];
    readonly verifiedAt: string;
  };

  // Credit check results
  readonly creditCheck?: {
    readonly creditReportId: string;
    readonly creditScore: number;
    readonly debtToIncomeRatio: number;
    readonly openAccounts: number;
    readonly negativeMarks: number;
    readonly creditHistory: CreditHistory;
    readonly checkedAt: string;
  };

  // Employment verification results
  readonly employmentVerification?: {
    readonly verificationId: string;
    readonly confirmedIncome: number;
    readonly employmentStartDate: string;
    readonly employmentType: "full_time" | "part_time" | "contractor";
    readonly verifiedAt: string;
  };

  // Documents
  readonly documents: DocumentRecord[];
  readonly requiredDocuments: string[];

  // Appraisal results (mortgage only)
  readonly appraisal?: {
    readonly appraisalId: string;
    readonly appraisedValue: number;
    readonly appraisalDate: string;
    readonly appraiserName: string;
    readonly loanToValueRatio: number;
  };

  // Underwriting results
  readonly underwriting?: {
    readonly underwriterId: string;
    readonly decision: "approved" | "denied" | "review";
    readonly approvedAmount?: number;
    readonly interestRate?: number;
    readonly conditions: string[];
    readonly riskScore?: number;
    readonly denialReason?: string;
    readonly decidedAt: string;
  };

  // Loan details (after approval)
  readonly loan?: {
    readonly loanId: string;
    readonly approvedAmount: number;
    readonly interestRate: number;
    readonly monthlyPayment: number;
    readonly firstPaymentDate: string;
    readonly offerExpiresAt?: string;
    readonly acceptedAt?: string;
    readonly eSignatureId?: string;
  };

  // Disbursement details
  readonly disbursement?: {
    readonly disbursementId: string;
    readonly amount: number;
    readonly method: "ach" | "wire" | "check";
    readonly disbursedAt: string;
    readonly confirmationNumber: string;
  };

  // Status tracking
  readonly statusHistory: Array<{
    readonly status: LoanApplicationStatus;
    readonly timestamp: string;
    readonly reason?: string;
  }>;

  // Cancellation/denial info
  readonly cancellation?: {
    readonly reason: string;
    readonly cancelledBy: "applicant" | "system" | "underwriter";
    readonly cancelledAt: string;
  };

  // Timestamps
  readonly submittedAt: string;
  readonly lastUpdatedAt: string;
  readonly completedAt?: string;
}
