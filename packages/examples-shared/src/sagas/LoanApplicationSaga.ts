import { createSagaMachine, type SagaDefinition } from "@saga-bus/core";
import type { LoanApplicationSagaState } from "../types/loan.js";
import type {
  LoanMessage,
  LoanApplicationSubmitted,
} from "../messages/loan.js";

/**
 * Loan Application Saga - Orchestrates a complex loan approval workflow.
 *
 * This saga demonstrates a real-world multi-step process with:
 * - 30+ possible states
 * - Parallel verification steps
 * - Conditional flows (mortgage vs personal loans)
 * - Timeout handling
 * - Compensation on failures
 *
 * Flow:
 * 1. Application Submitted
 * 2. Identity Verification (parallel with credit check for speed)
 * 3. Credit Check
 * 4. Employment Verification
 * 5. Document Collection & Verification
 * 6. Property Appraisal (mortgage only)
 * 7. Underwriting Review
 * 8. Final Approval
 * 9. Loan Offer Sent
 * 10. Offer Accepted/Declined
 * 11. Disbursement
 * 12. Complete
 */
export const LoanApplicationSaga: SagaDefinition<
  LoanApplicationSagaState,
  LoanMessage
> = createSagaMachine<LoanApplicationSagaState, LoanMessage>()
  .name("LoanApplicationSaga")

  // Correlation: all messages correlate by applicationId
  .correlate("LoanApplicationSubmitted", (msg) => msg.applicationId, {
    canStart: true,
  })
  .correlate("*", (msg) => msg.applicationId)

  // Initial state from LoanApplicationSubmitted
  .initial<LoanApplicationSubmitted>((msg, ctx) => ({
    metadata: {
      sagaId: ctx.sagaId,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      isCompleted: false,
    },
    applicationId: msg.applicationId,
    applicantId: msg.applicantId,
    loanType: msg.loanType,
    requestedAmount: msg.requestedAmount,
    termMonths: msg.termMonths,
    status: "submitted",
    applicantInfo: msg.applicantInfo,
    propertyInfo: msg.propertyInfo,
    documents: [],
    requiredDocuments: [],
    statusHistory: [
      {
        status: "submitted",
        timestamp: new Date().toISOString(),
      },
    ],
    submittedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  }))

  // ==========================================
  // Step 1: Application Submitted - Start Identity Verification
  // ==========================================
  .on("LoanApplicationSubmitted")
  .when((s) => s.status === "submitted")
  .handle(async (msg, state, ctx) => {
    // Request identity verification
    await ctx.publish({
      type: "IdentityVerificationRequested",
      applicationId: msg.applicationId,
      applicantId: msg.applicantId,
      ssn: msg.applicantInfo.ssn,
      dateOfBirth: msg.applicantInfo.dateOfBirth,
      firstName: msg.applicantInfo.firstName,
      lastName: msg.applicantInfo.lastName,
    });

    // Set a timeout for the entire application process (7 days)
    ctx.setTimeout(7 * 24 * 60 * 60 * 1000);

    return {
      newState: {
        ...state,
        status: "identity_verification_pending" as const,
        statusHistory: [
          ...state.statusHistory,
          {
            status: "identity_verification_pending" as const,
            timestamp: new Date().toISOString(),
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
      },
    };
  })

  // ==========================================
  // Step 2: Identity Verification
  // ==========================================
  .on("IdentityVerified")
  .when((s) => s.status === "identity_verification_pending")
  .handle(async (msg, state, ctx) => {
    // Identity verified - now request credit check
    await ctx.publish({
      type: "CreditCheckRequested",
      applicationId: msg.applicationId,
      applicantId: state.applicantId,
      ssn: state.applicantInfo.ssn,
    });

    return {
      newState: {
        ...state,
        status: "credit_check_pending" as const,
        identityVerification: {
          verificationId: msg.verificationId,
          verificationScore: msg.verificationScore,
          matchedFields: [...msg.matchedFields],
          verifiedAt: new Date().toISOString(),
        },
        statusHistory: [
          ...state.statusHistory,
          {
            status: "identity_verified" as const,
            timestamp: new Date().toISOString(),
          },
          {
            status: "credit_check_pending" as const,
            timestamp: new Date().toISOString(),
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
      },
    };
  })

  .on("IdentityVerificationFailed")
  .when((s) => s.status === "identity_verification_pending")
  .handle(async (msg, state, ctx) => {
    await ctx.publish({
      type: "ApplicationCancelled",
      applicationId: msg.applicationId,
      reason: `Identity verification failed: ${msg.reason}`,
      cancelledBy: "system",
    });

    ctx.complete();

    return {
      newState: {
        ...state,
        status: "cancelled" as const,
        cancellation: {
          reason: `Identity verification failed: ${msg.reason}`,
          cancelledBy: "system",
          cancelledAt: new Date().toISOString(),
        },
        statusHistory: [
          ...state.statusHistory,
          {
            status: "identity_verification_failed" as const,
            timestamp: new Date().toISOString(),
            reason: msg.reason,
          },
          {
            status: "cancelled" as const,
            timestamp: new Date().toISOString(),
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
      },
      isCompleted: true,
    };
  })

  // ==========================================
  // Step 3: Credit Check
  // ==========================================
  .on("CreditCheckCompleted")
  .when((s) => s.status === "credit_check_pending")
  .handle(async (msg, state, ctx) => {
    // Check if credit score meets minimum requirements
    if (msg.creditScore < 580) {
      await ctx.publish({
        type: "UnderwritingDenied",
        applicationId: msg.applicationId,
        underwriterId: "auto-decline",
        reason: `Credit score ${msg.creditScore} below minimum requirement of 580`,
      });

      ctx.complete();

      return {
        newState: {
          ...state,
          status: "denied" as const,
          creditCheck: {
            creditReportId: msg.creditReportId,
            creditScore: msg.creditScore,
            debtToIncomeRatio: msg.debtToIncomeRatio,
            openAccounts: msg.openAccounts,
            negativeMarks: msg.negativeMarks,
            creditHistory: { ...msg.creditHistory },
            checkedAt: new Date().toISOString(),
          },
          statusHistory: [
            ...state.statusHistory,
            {
              status: "credit_check_completed" as const,
              timestamp: new Date().toISOString(),
            },
            {
              status: "denied" as const,
              timestamp: new Date().toISOString(),
              reason: "Credit score below minimum",
            },
          ],
          lastUpdatedAt: new Date().toISOString(),
        },
        isCompleted: true,
      };
    }

    // Credit OK - proceed to employment verification
    if (
      state.applicantInfo.employmentStatus === "employed" &&
      state.applicantInfo.employerName
    ) {
      await ctx.publish({
        type: "EmploymentVerificationRequested",
        applicationId: msg.applicationId,
        applicantId: state.applicantId,
        employerName: state.applicantInfo.employerName,
        annualIncome: state.applicantInfo.annualIncome,
      });

      return {
        newState: {
          ...state,
          status: "employment_verification_pending" as const,
          creditCheck: {
            creditReportId: msg.creditReportId,
            creditScore: msg.creditScore,
            debtToIncomeRatio: msg.debtToIncomeRatio,
            openAccounts: msg.openAccounts,
            negativeMarks: msg.negativeMarks,
            creditHistory: { ...msg.creditHistory },
            checkedAt: new Date().toISOString(),
          },
          statusHistory: [
            ...state.statusHistory,
            {
              status: "credit_check_completed" as const,
              timestamp: new Date().toISOString(),
            },
            {
              status: "employment_verification_pending" as const,
              timestamp: new Date().toISOString(),
            },
          ],
          lastUpdatedAt: new Date().toISOString(),
        },
      };
    }

    // Self-employed or retired - skip employment verification, request documents
    const requiredDocs = getRequiredDocuments(state.loanType, state.applicantInfo.employmentStatus);
    await ctx.publish({
      type: "DocumentsRequested",
      applicationId: msg.applicationId,
      requiredDocuments: requiredDocs,
    });

    return {
      newState: {
        ...state,
        status: "documents_requested" as const,
        creditCheck: {
          creditReportId: msg.creditReportId,
          creditScore: msg.creditScore,
          debtToIncomeRatio: msg.debtToIncomeRatio,
          openAccounts: msg.openAccounts,
          negativeMarks: msg.negativeMarks,
          creditHistory: { ...msg.creditHistory },
          checkedAt: new Date().toISOString(),
        },
        requiredDocuments: requiredDocs,
        statusHistory: [
          ...state.statusHistory,
          {
            status: "credit_check_completed" as const,
            timestamp: new Date().toISOString(),
          },
          {
            status: "documents_requested" as const,
            timestamp: new Date().toISOString(),
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
      },
    };
  })

  .on("CreditCheckFailed")
  .when((s) => s.status === "credit_check_pending")
  .handle(async (msg, state, ctx) => {
    await ctx.publish({
      type: "ApplicationCancelled",
      applicationId: msg.applicationId,
      reason: `Credit check failed: ${msg.reason}`,
      cancelledBy: "system",
    });

    ctx.complete();

    return {
      newState: {
        ...state,
        status: "cancelled" as const,
        cancellation: {
          reason: `Credit check failed: ${msg.reason}`,
          cancelledBy: "system",
          cancelledAt: new Date().toISOString(),
        },
        statusHistory: [
          ...state.statusHistory,
          {
            status: "credit_check_failed" as const,
            timestamp: new Date().toISOString(),
            reason: msg.reason,
          },
          {
            status: "cancelled" as const,
            timestamp: new Date().toISOString(),
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
      },
      isCompleted: true,
    };
  })

  // ==========================================
  // Step 4: Employment Verification
  // ==========================================
  .on("EmploymentVerified")
  .when((s) => s.status === "employment_verification_pending")
  .handle(async (msg, state, ctx) => {
    // Employment verified - request documents
    const requiredDocs = getRequiredDocuments(state.loanType, state.applicantInfo.employmentStatus);
    await ctx.publish({
      type: "DocumentsRequested",
      applicationId: msg.applicationId,
      requiredDocuments: requiredDocs,
    });

    return {
      newState: {
        ...state,
        status: "documents_requested" as const,
        employmentVerification: {
          verificationId: msg.verificationId,
          confirmedIncome: msg.confirmedIncome,
          employmentStartDate: msg.employmentStartDate,
          employmentType: msg.employmentType,
          verifiedAt: new Date().toISOString(),
        },
        requiredDocuments: requiredDocs,
        statusHistory: [
          ...state.statusHistory,
          {
            status: "employment_verified" as const,
            timestamp: new Date().toISOString(),
          },
          {
            status: "documents_requested" as const,
            timestamp: new Date().toISOString(),
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
      },
    };
  })

  .on("EmploymentVerificationFailed")
  .when((s) => s.status === "employment_verification_pending")
  .handle(async (msg, state, ctx) => {
    // Employment verification failed - still continue but flag for manual review
    const requiredDocs = [
      ...getRequiredDocuments(state.loanType, state.applicantInfo.employmentStatus),
      "pay_stubs_3_months",
      "employment_letter",
    ];

    await ctx.publish({
      type: "DocumentsRequested",
      applicationId: msg.applicationId,
      requiredDocuments: requiredDocs,
    });

    return {
      newState: {
        ...state,
        status: "documents_requested" as const,
        requiredDocuments: requiredDocs,
        statusHistory: [
          ...state.statusHistory,
          {
            status: "employment_verification_failed" as const,
            timestamp: new Date().toISOString(),
            reason: msg.reason,
          },
          {
            status: "documents_requested" as const,
            timestamp: new Date().toISOString(),
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
      },
    };
  })

  // ==========================================
  // Step 5: Document Collection
  // ==========================================
  .on("DocumentsReceived")
  .when((s) => s.status === "documents_requested")
  .handle(async (msg, state) => {
    // Mark documents as received, waiting for verification
    const newDocuments = msg.documents.map((doc) => ({
      documentType: doc.documentType,
      documentId: doc.documentId,
      uploadedAt: doc.uploadedAt,
      status: "pending" as const,
    }));

    return {
      newState: {
        ...state,
        status: "documents_received" as const,
        documents: [...state.documents, ...newDocuments],
        statusHistory: [
          ...state.statusHistory,
          {
            status: "documents_received" as const,
            timestamp: new Date().toISOString(),
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
      },
    };
  })

  .on("DocumentsVerified")
  .when((s) => s.status === "documents_received")
  .handle(async (msg, state, ctx) => {
    // Update document statuses
    const updatedDocuments = state.documents.map((doc) => {
      const result = msg.verificationResults.find(
        (r) => r.documentType === doc.documentType
      );
      if (result) {
        return {
          ...doc,
          status: result.status,
          notes: result.notes,
        };
      }
      return doc;
    });

    // Check if any documents were rejected
    const rejectedDocs = msg.verificationResults.filter(
      (r) => r.status === "rejected"
    );
    if (rejectedDocs.length > 0) {
      await ctx.publish({
        type: "DocumentVerificationFailed",
        applicationId: msg.applicationId,
        reason: "Some documents were rejected",
        failedDocuments: rejectedDocs.map((d) => d.documentType),
      });

      return {
        newState: {
          ...state,
          status: "documents_verification_failed" as const,
          documents: updatedDocuments,
          statusHistory: [
            ...state.statusHistory,
            {
              status: "documents_verification_failed" as const,
              timestamp: new Date().toISOString(),
              reason: `Rejected: ${rejectedDocs.map((d) => d.documentType).join(", ")}`,
            },
          ],
          lastUpdatedAt: new Date().toISOString(),
        },
      };
    }

    // All documents verified - check if mortgage needs appraisal
    if (state.loanType === "mortgage" && state.propertyInfo) {
      await ctx.publish({
        type: "AppraisalRequested",
        applicationId: msg.applicationId,
        propertyAddress: state.propertyInfo.address,
        estimatedValue: state.propertyInfo.estimatedValue,
      });

      return {
        newState: {
          ...state,
          status: "appraisal_pending" as const,
          documents: updatedDocuments,
          statusHistory: [
            ...state.statusHistory,
            {
              status: "documents_verified" as const,
              timestamp: new Date().toISOString(),
            },
            {
              status: "appraisal_pending" as const,
              timestamp: new Date().toISOString(),
            },
          ],
          lastUpdatedAt: new Date().toISOString(),
        },
      };
    }

    // Not mortgage - proceed to underwriting
    await ctx.publish({
      type: "UnderwritingRequested",
      applicationId: msg.applicationId,
      creditScore: state.creditCheck?.creditScore ?? 0,
      debtToIncomeRatio: state.creditCheck?.debtToIncomeRatio ?? 0,
      requestedAmount: state.requestedAmount,
    });

    return {
      newState: {
        ...state,
        status: "underwriting_pending" as const,
        documents: updatedDocuments,
        statusHistory: [
          ...state.statusHistory,
          {
            status: "documents_verified" as const,
            timestamp: new Date().toISOString(),
          },
          {
            status: "underwriting_pending" as const,
            timestamp: new Date().toISOString(),
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
      },
    };
  })

  .on("DocumentVerificationFailed")
  .when((s) => s.status === "documents_received" || s.status === "documents_verification_failed")
  .handle(async (msg, state, ctx) => {
    // Request re-upload of failed documents
    await ctx.publish({
      type: "DocumentsRequested",
      applicationId: msg.applicationId,
      requiredDocuments: msg.failedDocuments,
    });

    return {
      newState: {
        ...state,
        status: "documents_requested" as const,
        requiredDocuments: msg.failedDocuments,
        statusHistory: [
          ...state.statusHistory,
          {
            status: "documents_requested" as const,
            timestamp: new Date().toISOString(),
            reason: `Re-upload required: ${msg.failedDocuments.join(", ")}`,
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
      },
    };
  })

  // ==========================================
  // Step 6: Property Appraisal (Mortgage Only)
  // ==========================================
  .on("AppraisalCompleted")
  .when((s) => s.status === "appraisal_pending")
  .handle(async (msg, state, ctx) => {
    // Appraisal complete - proceed to underwriting
    await ctx.publish({
      type: "UnderwritingRequested",
      applicationId: msg.applicationId,
      creditScore: state.creditCheck?.creditScore ?? 0,
      debtToIncomeRatio: state.creditCheck?.debtToIncomeRatio ?? 0,
      requestedAmount: state.requestedAmount,
      loanToValueRatio: msg.loanToValueRatio,
    });

    return {
      newState: {
        ...state,
        status: "underwriting_pending" as const,
        appraisal: {
          appraisalId: msg.appraisalId,
          appraisedValue: msg.appraisedValue,
          appraisalDate: msg.appraisalDate,
          appraiserName: msg.appraiserName,
          loanToValueRatio: msg.loanToValueRatio,
        },
        statusHistory: [
          ...state.statusHistory,
          {
            status: "appraisal_completed" as const,
            timestamp: new Date().toISOString(),
          },
          {
            status: "underwriting_pending" as const,
            timestamp: new Date().toISOString(),
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
      },
    };
  })

  .on("AppraisalFailed")
  .when((s) => s.status === "appraisal_pending")
  .handle(async (msg, state, ctx) => {
    await ctx.publish({
      type: "ApplicationCancelled",
      applicationId: msg.applicationId,
      reason: `Appraisal failed: ${msg.reason}`,
      cancelledBy: "system",
    });

    ctx.complete();

    return {
      newState: {
        ...state,
        status: "cancelled" as const,
        cancellation: {
          reason: `Appraisal failed: ${msg.reason}`,
          cancelledBy: "system",
          cancelledAt: new Date().toISOString(),
        },
        statusHistory: [
          ...state.statusHistory,
          {
            status: "appraisal_failed" as const,
            timestamp: new Date().toISOString(),
            reason: msg.reason,
          },
          {
            status: "cancelled" as const,
            timestamp: new Date().toISOString(),
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
      },
      isCompleted: true,
    };
  })

  // ==========================================
  // Step 7: Underwriting
  // ==========================================
  .on("UnderwritingApproved")
  .when((s) => s.status === "underwriting_pending" || s.status === "underwriting_review")
  .handle(async (msg, state, ctx) => {
    // Underwriting approved - send loan offer
    const monthlyPayment = calculateMonthlyPayment(
      msg.approvedAmount,
      msg.interestRate,
      state.termMonths
    );
    const firstPaymentDate = calculateFirstPaymentDate();

    await ctx.publish({
      type: "LoanApproved",
      applicationId: msg.applicationId,
      loanId: `LOAN-${msg.applicationId}`,
      approvedAmount: msg.approvedAmount,
      interestRate: msg.interestRate,
      monthlyPayment,
      firstPaymentDate,
    });

    return {
      newState: {
        ...state,
        status: "approved" as const,
        underwriting: {
          underwriterId: msg.underwriterId,
          decision: "approved",
          approvedAmount: msg.approvedAmount,
          interestRate: msg.interestRate,
          conditions: [...msg.conditions],
          riskScore: msg.riskScore,
          decidedAt: new Date().toISOString(),
        },
        loan: {
          loanId: `LOAN-${msg.applicationId}`,
          approvedAmount: msg.approvedAmount,
          interestRate: msg.interestRate,
          monthlyPayment,
          firstPaymentDate,
        },
        statusHistory: [
          ...state.statusHistory,
          {
            status: "underwriting_approved" as const,
            timestamp: new Date().toISOString(),
          },
          {
            status: "approved" as const,
            timestamp: new Date().toISOString(),
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
      },
    };
  })

  .on("UnderwritingDenied")
  .when((s) => s.status === "underwriting_pending" || s.status === "underwriting_review")
  .handle(async (msg, state, ctx) => {
    ctx.complete();

    return {
      newState: {
        ...state,
        status: "denied" as const,
        underwriting: {
          underwriterId: msg.underwriterId,
          decision: "denied",
          conditions: [],
          denialReason: msg.reason,
          decidedAt: new Date().toISOString(),
        },
        statusHistory: [
          ...state.statusHistory,
          {
            status: "underwriting_denied" as const,
            timestamp: new Date().toISOString(),
            reason: msg.reason,
          },
          {
            status: "denied" as const,
            timestamp: new Date().toISOString(),
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
      },
      isCompleted: true,
    };
  })

  .on("UnderwritingPendingReview")
  .when((s) => s.status === "underwriting_pending")
  .handle(async (msg, state) => {
    return {
      newState: {
        ...state,
        status: "underwriting_review" as const,
        statusHistory: [
          ...state.statusHistory,
          {
            status: "underwriting_review" as const,
            timestamp: new Date().toISOString(),
            reason: msg.reason,
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
      },
    };
  })

  // ==========================================
  // Step 8: Loan Offer
  // ==========================================
  .on("LoanApproved")
  .when((s) => s.status === "approved")
  .handle(async (msg, state, ctx) => {
    // Send the loan offer to the applicant
    const offerExpiresAt = new Date(
      Date.now() + 14 * 24 * 60 * 60 * 1000
    ).toISOString(); // 14 days

    await ctx.publish({
      type: "LoanOfferSent",
      applicationId: msg.applicationId,
      loanId: msg.loanId,
      offerExpiresAt,
    });

    return {
      newState: {
        ...state,
        status: "offer_sent" as const,
        loan: {
          ...state.loan!,
          offerExpiresAt,
        },
        statusHistory: [
          ...state.statusHistory,
          {
            status: "offer_sent" as const,
            timestamp: new Date().toISOString(),
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
      },
    };
  })

  .on("LoanOfferAccepted")
  .when((s) => s.status === "offer_sent")
  .handle(async (msg, state, ctx) => {
    // Offer accepted - request disbursement
    await ctx.publish({
      type: "DisbursementRequested",
      applicationId: msg.applicationId,
      loanId: msg.loanId,
      amount: state.loan!.approvedAmount,
      disbursementMethod: "ach",
    });

    return {
      newState: {
        ...state,
        status: "disbursement_pending" as const,
        loan: {
          ...state.loan!,
          acceptedAt: msg.acceptedAt,
          eSignatureId: msg.eSignatureId,
        },
        statusHistory: [
          ...state.statusHistory,
          {
            status: "offer_accepted" as const,
            timestamp: new Date().toISOString(),
          },
          {
            status: "disbursement_pending" as const,
            timestamp: new Date().toISOString(),
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
      },
    };
  })

  .on("LoanOfferDeclined")
  .when((s) => s.status === "offer_sent")
  .handle(async (msg, state, ctx) => {
    ctx.complete();

    return {
      newState: {
        ...state,
        status: "offer_declined" as const,
        cancellation: {
          reason: msg.reason ?? "Applicant declined offer",
          cancelledBy: "applicant",
          cancelledAt: new Date().toISOString(),
        },
        statusHistory: [
          ...state.statusHistory,
          {
            status: "offer_declined" as const,
            timestamp: new Date().toISOString(),
            reason: msg.reason,
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
      },
      isCompleted: true,
    };
  })

  .on("LoanOfferExpired")
  .when((s) => s.status === "offer_sent")
  .handle(async (_msg, state, ctx) => {
    ctx.complete();

    return {
      newState: {
        ...state,
        status: "offer_expired" as const,
        cancellation: {
          reason: "Loan offer expired",
          cancelledBy: "system",
          cancelledAt: new Date().toISOString(),
        },
        statusHistory: [
          ...state.statusHistory,
          {
            status: "offer_expired" as const,
            timestamp: new Date().toISOString(),
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
      },
      isCompleted: true,
    };
  })

  // ==========================================
  // Step 9: Disbursement
  // ==========================================
  .on("DisbursementCompleted")
  .when((s) => s.status === "disbursement_pending")
  .handle(async (msg, state, ctx) => {
    await ctx.publish({
      type: "ApplicationCompleted",
      applicationId: msg.applicationId,
      loanId: msg.loanId,
      completedAt: new Date().toISOString(),
    });

    ctx.complete();

    return {
      newState: {
        ...state,
        status: "completed" as const,
        disbursement: {
          disbursementId: msg.disbursementId,
          amount: msg.amount,
          method: "ach",
          disbursedAt: msg.disbursedAt,
          confirmationNumber: msg.confirmationNumber,
        },
        completedAt: new Date().toISOString(),
        statusHistory: [
          ...state.statusHistory,
          {
            status: "disbursement_completed" as const,
            timestamp: new Date().toISOString(),
          },
          {
            status: "completed" as const,
            timestamp: new Date().toISOString(),
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
      },
      isCompleted: true,
    };
  })

  .on("DisbursementFailed")
  .when((s) => s.status === "disbursement_pending")
  .handle(async (msg, state) => {
    // Retry disbursement - stay in pending state
    return {
      newState: {
        ...state,
        statusHistory: [
          ...state.statusHistory,
          {
            status: "disbursement_failed" as const,
            timestamp: new Date().toISOString(),
            reason: msg.reason,
          },
          {
            status: "disbursement_pending" as const,
            timestamp: new Date().toISOString(),
            reason: "Retrying disbursement",
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
      },
    };
  })

  // ==========================================
  // Manual Cancellation (any non-terminal state)
  // ==========================================
  .on("ApplicationCancelled")
  .when(
    (s) =>
      s.status !== "completed" &&
      s.status !== "cancelled" &&
      s.status !== "denied" &&
      s.status !== "offer_declined" &&
      s.status !== "offer_expired"
  )
  .handle(async (msg, state, ctx) => {
    ctx.complete();

    return {
      newState: {
        ...state,
        status: "cancelled" as const,
        cancellation: {
          reason: msg.reason,
          cancelledBy: msg.cancelledBy,
          cancelledAt: new Date().toISOString(),
        },
        statusHistory: [
          ...state.statusHistory,
          {
            status: "cancelled" as const,
            timestamp: new Date().toISOString(),
            reason: msg.reason,
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
      },
      isCompleted: true,
    };
  })

  .build();

// Helper functions
function getRequiredDocuments(
  loanType: string,
  employmentStatus: string
): string[] {
  const baseDocs = ["government_id", "proof_of_address"];

  const incomeDocs =
    employmentStatus === "self_employed"
      ? ["tax_returns_2_years", "bank_statements_6_months", "profit_loss_statement"]
      : employmentStatus === "employed"
        ? ["w2_forms", "pay_stubs_2_months"]
        : ["social_security_statement", "pension_statement"];

  const loanTypeDocs =
    loanType === "mortgage"
      ? ["purchase_agreement", "homeowners_insurance"]
      : loanType === "auto"
        ? ["vehicle_info", "purchase_agreement"]
        : loanType === "business"
          ? ["business_license", "business_tax_returns", "business_bank_statements"]
          : [];

  return [...baseDocs, ...incomeDocs, ...loanTypeDocs];
}

function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  const monthlyRate = annualRate / 100 / 12;
  const payment =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);
  return Math.round(payment * 100) / 100;
}

function calculateFirstPaymentDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 2);
  date.setDate(1);
  return date.toISOString().split("T")[0] as string;
}
