import { NextResponse } from "next/server";
import { getSagaBus } from "../../../lib/saga-bus";
import { randomUUID } from "crypto";
import type {
  IdentityVerified,
  IdentityVerificationFailed,
  CreditCheckCompleted,
  CreditCheckFailed,
  EmploymentVerified,
  EmploymentVerificationFailed,
  DocumentsReceived,
  DocumentsVerified,
  DocumentVerificationFailed,
  AppraisalCompleted,
  AppraisalFailed,
  UnderwritingApproved,
  UnderwritingDenied,
  LoanOfferAccepted,
  LoanOfferDeclined,
  DisbursementCompleted,
  DisbursementFailed,
  ApplicationCancelled,
} from "@saga-bus/examples-shared";

export async function POST(request: Request) {
  const body = await request.json();
  const { applicationId, action } = body;

  const sagaBus = await getSagaBus();

  switch (action) {
    case "identity_verified": {
      const msg: IdentityVerified = {
        type: "IdentityVerified",
        applicationId,
        verificationId: `VER-${randomUUID().slice(0, 8)}`,
        verificationScore: 95 + Math.floor(Math.random() * 5),
        matchedFields: ["ssn", "dob", "name", "address"],
      };
      await sagaBus.publish(msg);
      break;
    }

    case "identity_failed": {
      const msg: IdentityVerificationFailed = {
        type: "IdentityVerificationFailed",
        applicationId,
        reason: "Unable to verify identity - SSN mismatch",
        failedChecks: ["ssn_verification"],
      };
      await sagaBus.publish(msg);
      break;
    }

    case "credit_completed": {
      const creditScore = 650 + Math.floor(Math.random() * 150);
      const msg: CreditCheckCompleted = {
        type: "CreditCheckCompleted",
        applicationId,
        creditScore,
        creditReportId: `CR-${randomUUID().slice(0, 8)}`,
        debtToIncomeRatio: 0.25 + Math.random() * 0.2,
        openAccounts: 3 + Math.floor(Math.random() * 5),
        negativeMarks: Math.floor(Math.random() * 2),
        creditHistory: {
          oldestAccountYears: 5 + Math.floor(Math.random() * 10),
          recentInquiries: Math.floor(Math.random() * 3),
          missedPayments30Days: Math.floor(Math.random() * 2),
          missedPayments60Days: 0,
          missedPayments90Days: 0,
        },
      };
      await sagaBus.publish(msg);
      break;
    }

    case "credit_failed": {
      const msg: CreditCheckFailed = {
        type: "CreditCheckFailed",
        applicationId,
        reason: "Unable to pull credit report - frozen credit file",
      };
      await sagaBus.publish(msg);
      break;
    }

    case "employment_verified": {
      const msg: EmploymentVerified = {
        type: "EmploymentVerified",
        applicationId,
        verificationId: `EMP-${randomUUID().slice(0, 8)}`,
        confirmedIncome: 75000 + Math.floor(Math.random() * 50000),
        employmentStartDate: "2020-03-15",
        employmentType: "full_time",
      };
      await sagaBus.publish(msg);
      break;
    }

    case "employment_failed": {
      const msg: EmploymentVerificationFailed = {
        type: "EmploymentVerificationFailed",
        applicationId,
        reason: "Employer did not respond to verification request",
      };
      await sagaBus.publish(msg);
      break;
    }

    case "documents_received": {
      const msg: DocumentsReceived = {
        type: "DocumentsReceived",
        applicationId,
        documents: [
          {
            documentType: "government_id",
            documentId: `DOC-${randomUUID().slice(0, 8)}`,
            uploadedAt: new Date().toISOString(),
          },
          {
            documentType: "proof_of_address",
            documentId: `DOC-${randomUUID().slice(0, 8)}`,
            uploadedAt: new Date().toISOString(),
          },
          {
            documentType: "w2_forms",
            documentId: `DOC-${randomUUID().slice(0, 8)}`,
            uploadedAt: new Date().toISOString(),
          },
          {
            documentType: "pay_stubs_2_months",
            documentId: `DOC-${randomUUID().slice(0, 8)}`,
            uploadedAt: new Date().toISOString(),
          },
        ],
      };
      await sagaBus.publish(msg);
      break;
    }

    case "documents_verified": {
      const msg: DocumentsVerified = {
        type: "DocumentsVerified",
        applicationId,
        verificationResults: [
          { documentType: "government_id", status: "verified" },
          { documentType: "proof_of_address", status: "verified" },
          { documentType: "w2_forms", status: "verified" },
          { documentType: "pay_stubs_2_months", status: "verified" },
        ],
      };
      await sagaBus.publish(msg);
      break;
    }

    case "documents_failed": {
      const msg: DocumentVerificationFailed = {
        type: "DocumentVerificationFailed",
        applicationId,
        reason: "Document quality issues",
        failedDocuments: ["government_id"],
      };
      await sagaBus.publish(msg);
      break;
    }

    case "appraisal_completed": {
      const appraisedValue = 300000 + Math.floor(Math.random() * 200000);
      const msg: AppraisalCompleted = {
        type: "AppraisalCompleted",
        applicationId,
        appraisalId: `APR-${randomUUID().slice(0, 8)}`,
        appraisedValue,
        appraisalDate: new Date().toISOString().split("T")[0] as string,
        appraiserName: "John Appraiser, MAI",
        loanToValueRatio: 0.8,
      };
      await sagaBus.publish(msg);
      break;
    }

    case "appraisal_failed": {
      const msg: AppraisalFailed = {
        type: "AppraisalFailed",
        applicationId,
        reason: "Property value significantly below purchase price",
      };
      await sagaBus.publish(msg);
      break;
    }

    case "underwriting_approved": {
      const msg: UnderwritingApproved = {
        type: "UnderwritingApproved",
        applicationId,
        underwriterId: "UW-12345",
        approvedAmount: 25000 + Math.floor(Math.random() * 275000),
        interestRate: 5.5 + Math.random() * 3,
        conditions: ["Maintain employment until closing", "No new credit inquiries"],
        riskScore: 70 + Math.floor(Math.random() * 25),
      };
      await sagaBus.publish(msg);
      break;
    }

    case "underwriting_denied": {
      const msg: UnderwritingDenied = {
        type: "UnderwritingDenied",
        applicationId,
        underwriterId: "UW-12345",
        reason: "Debt-to-income ratio too high for requested loan amount",
      };
      await sagaBus.publish(msg);
      break;
    }

    case "offer_accepted": {
      const msg: LoanOfferAccepted = {
        type: "LoanOfferAccepted",
        applicationId,
        loanId: `LOAN-${applicationId}`,
        acceptedAt: new Date().toISOString(),
        eSignatureId: `ESIG-${randomUUID().slice(0, 8)}`,
      };
      await sagaBus.publish(msg);
      break;
    }

    case "offer_declined": {
      const msg: LoanOfferDeclined = {
        type: "LoanOfferDeclined",
        applicationId,
        loanId: `LOAN-${applicationId}`,
        reason: "Found better rate elsewhere",
      };
      await sagaBus.publish(msg);
      break;
    }

    case "disbursement_completed": {
      const msg: DisbursementCompleted = {
        type: "DisbursementCompleted",
        applicationId,
        loanId: `LOAN-${applicationId}`,
        disbursementId: `DISB-${randomUUID().slice(0, 8)}`,
        amount: 50000, // This would come from actual loan state
        disbursedAt: new Date().toISOString(),
        confirmationNumber: `CONF-${randomUUID().slice(0, 12).toUpperCase()}`,
      };
      await sagaBus.publish(msg);
      break;
    }

    case "disbursement_failed": {
      const msg: DisbursementFailed = {
        type: "DisbursementFailed",
        applicationId,
        loanId: `LOAN-${applicationId}`,
        reason: "Invalid bank account details",
      };
      await sagaBus.publish(msg);
      break;
    }

    case "cancel": {
      const msg: ApplicationCancelled = {
        type: "ApplicationCancelled",
        applicationId,
        reason: "Applicant requested cancellation",
        cancelledBy: "applicant",
      };
      await sagaBus.publish(msg);
      break;
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  return NextResponse.json({ success: true, action });
}
