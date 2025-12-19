---
sidebar_position: 3
title: Loan Application
---

# Loan Application Example

A complex financial workflow demonstrating advanced saga patterns with 30+ states.

## Overview

This example implements a full loan application process:

1. Application submission
2. Identity verification
3. Credit check
4. Income verification
5. Document collection
6. Underwriting decision
7. Loan funding
8. Completion or rejection

## State Machine

export const loanNodes = [
  { id: 'app', type: 'stateNode', position: { x: 300, y: 0 }, data: { label: 'Application', status: 'initial' } },
  { id: 'submitted', type: 'stateNode', position: { x: 300, y: 70 }, data: { label: 'submitted', status: 'active' } },
  // Parallel verification
  { id: 'identity', type: 'serviceNode', position: { x: 100, y: 150 }, data: { label: 'identity_check', type: 'service' } },
  { id: 'credit', type: 'serviceNode', position: { x: 300, y: 150 }, data: { label: 'credit_check', type: 'service' } },
  { id: 'income', type: 'serviceNode', position: { x: 500, y: 150 }, data: { label: 'income_check', type: 'service' } },
  { id: 'id_done', type: 'stateNode', position: { x: 100, y: 230 }, data: { label: 'identity_done', status: 'success' } },
  { id: 'credit_done', type: 'stateNode', position: { x: 300, y: 230 }, data: { label: 'credit_done', status: 'success' } },
  { id: 'income_done', type: 'stateNode', position: { x: 500, y: 230 }, data: { label: 'income_done', status: 'success' } },
  // Post-verification
  { id: 'verified', type: 'stateNode', position: { x: 300, y: 310 }, data: { label: 'verified', status: 'success' } },
  { id: 'mortgage_check', type: 'decisionNode', position: { x: 300, y: 390 }, data: { label: 'Mortgage?', condition: 'loanType' } },
  // Document path
  { id: 'docs_req', type: 'stateNode', position: { x: 100, y: 470 }, data: { label: 'docs_required', status: 'warning' } },
  { id: 'docs_up', type: 'stateNode', position: { x: 100, y: 550 }, data: { label: 'docs_uploaded', status: 'active' } },
  // Underwriting path
  { id: 'underwriting', type: 'serviceNode', position: { x: 300, y: 550 }, data: { label: 'underwriting', type: 'service' } },
  // Decision
  { id: 'approved', type: 'stateNode', position: { x: 200, y: 650 }, data: { label: 'approved', status: 'success' } },
  { id: 'rejected', type: 'stateNode', position: { x: 420, y: 650 }, data: { label: 'rejected', status: 'error' } },
  // Funding
  { id: 'funding', type: 'serviceNode', position: { x: 200, y: 730 }, data: { label: 'funding', type: 'service' } },
  { id: 'completed', type: 'stateNode', position: { x: 200, y: 810 }, data: { label: 'completed', status: 'success' } },
];

export const loanEdges = [
  { id: 'l1', source: 'app', target: 'submitted', animated: true },
  { id: 'l2', source: 'submitted', target: 'identity' },
  { id: 'l3', source: 'submitted', target: 'credit' },
  { id: 'l4', source: 'submitted', target: 'income' },
  { id: 'l5', source: 'identity', target: 'id_done' },
  { id: 'l6', source: 'credit', target: 'credit_done' },
  { id: 'l7', source: 'income', target: 'income_done' },
  { id: 'l8', source: 'id_done', target: 'verified' },
  { id: 'l9', source: 'credit_done', target: 'verified' },
  { id: 'l10', source: 'income_done', target: 'verified' },
  { id: 'l11', source: 'verified', target: 'mortgage_check' },
  { id: 'l12', source: 'mortgage_check', target: 'docs_req', label: 'yes' },
  { id: 'l13', source: 'mortgage_check', target: 'underwriting', label: 'no' },
  { id: 'l14', source: 'docs_req', target: 'docs_up' },
  { id: 'l15', source: 'docs_up', target: 'underwriting' },
  { id: 'l16', source: 'underwriting', target: 'approved', label: 'Approved', data: { type: 'success' } },
  { id: 'l17', source: 'underwriting', target: 'rejected', label: 'Rejected', data: { type: 'error' } },
  { id: 'l18', source: 'approved', target: 'funding' },
  { id: 'l19', source: 'funding', target: 'completed', data: { type: 'success' } },
];

<FlowDiagram
  nodes={loanNodes}
  edges={loanEdges}
  height={900}
  miniMap={true}
/>

## Implementation

### State Definition

```typescript
// types/loan-state.ts
interface LoanApplicationState {
  applicationId: string;
  applicantId: string;
  loanType: 'personal' | 'mortgage' | 'auto';
  amount: number;
  term: number;
  status: LoanStatus;

  // Verification results
  identityVerification?: VerificationResult;
  creditCheck?: CreditCheckResult;
  incomeVerification?: IncomeVerificationResult;

  // Documents
  requiredDocuments: string[];
  uploadedDocuments: Document[];

  // Decision
  decision?: UnderwritingDecision;
  approvedAmount?: number;
  interestRate?: number;

  // Funding
  fundingDetails?: FundingDetails;

  // Timing
  submittedAt: string;
  verifiedAt?: string;
  decidedAt?: string;
  fundedAt?: string;
  completedAt?: string;

  // Failure tracking
  failureReason?: string;
  retryCount: number;
}

type LoanStatus =
  | 'submitted'
  | 'identity_pending'
  | 'identity_verified'
  | 'identity_failed'
  | 'credit_pending'
  | 'credit_checked'
  | 'credit_failed'
  | 'income_pending'
  | 'income_verified'
  | 'income_failed'
  | 'verified'
  | 'docs_required'
  | 'docs_pending'
  | 'docs_uploaded'
  | 'underwriting'
  | 'approved'
  | 'rejected'
  | 'funding'
  | 'funded'
  | 'completed'
  | 'cancelled';
```

### Saga Definition

```typescript
// sagas/loan-saga.ts
import { defineSaga } from '@saga-bus/core';

export const loanSaga = defineSaga({
  name: 'LoanApplicationSaga',
  initialState: (): LoanApplicationState => ({
    applicationId: '',
    applicantId: '',
    loanType: 'personal',
    amount: 0,
    term: 0,
    status: 'submitted',
    requiredDocuments: [],
    uploadedDocuments: [],
    retryCount: 0,
    submittedAt: new Date().toISOString(),
  }),
  correlationId: (message) => message.applicationId,
  handlers: {
    // Application submission
    LoanApplicationSubmitted: async (ctx) => {
      const { applicationId, applicantId, loanType, amount, term } = ctx.message;

      ctx.setState({
        ...ctx.state,
        applicationId,
        applicantId,
        loanType,
        amount,
        term,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
      });

      // Start parallel verification
      ctx.publish({
        type: 'VerifyIdentity',
        applicationId,
        applicantId,
      });

      ctx.publish({
        type: 'CheckCredit',
        applicationId,
        applicantId,
      });

      ctx.publish({
        type: 'VerifyIncome',
        applicationId,
        applicantId,
      });

      // Set timeout for verifications
      ctx.scheduleTimeout({
        type: 'VerificationTimeout',
        applicationId,
        delay: 24 * 60 * 60 * 1000, // 24 hours
      });
    },

    // Identity verification
    IdentityVerified: async (ctx) => {
      ctx.setState({
        ...ctx.state,
        identityVerification: {
          verified: true,
          verifiedAt: new Date().toISOString(),
          score: ctx.message.score,
        },
      });

      await checkAllVerificationsComplete(ctx);
    },

    IdentityVerificationFailed: async (ctx) => {
      if (ctx.state.retryCount < 3) {
        ctx.setState({
          ...ctx.state,
          retryCount: ctx.state.retryCount + 1,
        });

        ctx.publish({
          type: 'VerifyIdentity',
          applicationId: ctx.state.applicationId,
          applicantId: ctx.state.applicantId,
        });
      } else {
        ctx.setState({
          ...ctx.state,
          status: 'identity_failed',
          failureReason: ctx.message.reason,
        });

        await rejectApplication(ctx, 'Identity verification failed');
      }
    },

    // Credit check
    CreditCheckCompleted: async (ctx) => {
      const { score, reportId, issues } = ctx.message;

      ctx.setState({
        ...ctx.state,
        creditCheck: {
          score,
          reportId,
          issues,
          checkedAt: new Date().toISOString(),
        },
      });

      // Check credit score threshold
      if (score < 580) {
        await rejectApplication(ctx, 'Credit score below minimum threshold');
        return;
      }

      await checkAllVerificationsComplete(ctx);
    },

    // Income verification
    IncomeVerified: async (ctx) => {
      const { annualIncome, employmentStatus, employer } = ctx.message;

      ctx.setState({
        ...ctx.state,
        incomeVerification: {
          annualIncome,
          employmentStatus,
          employer,
          verifiedAt: new Date().toISOString(),
        },
      });

      await checkAllVerificationsComplete(ctx);
    },

    // Document handling (for mortgages)
    DocumentsRequested: async (ctx) => {
      ctx.setState({
        ...ctx.state,
        status: 'docs_required',
        requiredDocuments: ctx.message.documents,
      });

      ctx.publish({
        type: 'NotifyDocumentsRequired',
        applicationId: ctx.state.applicationId,
        applicantId: ctx.state.applicantId,
        documents: ctx.message.documents,
      });

      // Set document upload timeout
      ctx.scheduleTimeout({
        type: 'DocumentUploadTimeout',
        applicationId: ctx.state.applicationId,
        delay: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
    },

    DocumentUploaded: async (ctx) => {
      const uploadedDocs = [
        ...ctx.state.uploadedDocuments,
        ctx.message.document,
      ];

      ctx.setState({
        ...ctx.state,
        uploadedDocuments: uploadedDocs,
      });

      // Check if all required documents uploaded
      const allUploaded = ctx.state.requiredDocuments.every(
        (doc) => uploadedDocs.some((u) => u.type === doc)
      );

      if (allUploaded) {
        ctx.setState({
          ...ctx.state,
          status: 'docs_uploaded',
        });

        // Proceed to underwriting
        ctx.publish({
          type: 'StartUnderwriting',
          applicationId: ctx.state.applicationId,
        });
      }
    },

    // Underwriting
    UnderwritingDecision: async (ctx) => {
      const { approved, approvedAmount, interestRate, conditions, reason } = ctx.message;

      ctx.setState({
        ...ctx.state,
        decision: {
          approved,
          approvedAmount,
          interestRate,
          conditions,
          reason,
          decidedAt: new Date().toISOString(),
        },
        decidedAt: new Date().toISOString(),
      });

      if (approved) {
        ctx.setState({
          ...ctx.state,
          status: 'approved',
          approvedAmount,
          interestRate,
        });

        ctx.publish({
          type: 'LoanApproved',
          applicationId: ctx.state.applicationId,
          applicantId: ctx.state.applicantId,
          amount: approvedAmount,
          interestRate,
          conditions,
        });

        // Wait for acceptance
        ctx.scheduleTimeout({
          type: 'AcceptanceTimeout',
          applicationId: ctx.state.applicationId,
          delay: 14 * 24 * 60 * 60 * 1000, // 14 days
        });
      } else {
        await rejectApplication(ctx, reason);
      }
    },

    // Loan acceptance and funding
    LoanAccepted: async (ctx) => {
      ctx.setState({
        ...ctx.state,
        status: 'funding',
      });

      ctx.publish({
        type: 'InitiateFunding',
        applicationId: ctx.state.applicationId,
        applicantId: ctx.state.applicantId,
        amount: ctx.state.approvedAmount!,
      });
    },

    FundingCompleted: async (ctx) => {
      ctx.setState({
        ...ctx.state,
        status: 'completed',
        fundingDetails: {
          fundedAmount: ctx.message.amount,
          fundedAt: new Date().toISOString(),
          accountNumber: ctx.message.accountNumber,
          transactionId: ctx.message.transactionId,
        },
        fundedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });

      ctx.publish({
        type: 'LoanFunded',
        applicationId: ctx.state.applicationId,
        applicantId: ctx.state.applicantId,
        amount: ctx.message.amount,
        transactionId: ctx.message.transactionId,
      });

      ctx.complete();
    },

    // Timeout handlers
    VerificationTimeout: async (ctx) => {
      if (ctx.state.status !== 'submitted') return;

      await rejectApplication(ctx, 'Verification timeout - incomplete verifications');
    },

    DocumentUploadTimeout: async (ctx) => {
      if (ctx.state.status !== 'docs_required') return;

      await rejectApplication(ctx, 'Document upload timeout');
    },

    AcceptanceTimeout: async (ctx) => {
      if (ctx.state.status !== 'approved') return;

      ctx.setState({
        ...ctx.state,
        status: 'cancelled',
        failureReason: 'Loan offer expired',
      });

      ctx.complete();
    },

    // Cancellation
    ApplicationCancelled: async (ctx) => {
      ctx.setState({
        ...ctx.state,
        status: 'cancelled',
        failureReason: ctx.message.reason || 'Cancelled by applicant',
      });

      ctx.complete();
    },
  },
});

// Helper functions
async function checkAllVerificationsComplete(ctx) {
  const { identityVerification, creditCheck, incomeVerification } = ctx.state;

  if (identityVerification?.verified &&
      creditCheck &&
      incomeVerification) {

    ctx.setState({
      ...ctx.state,
      status: 'verified',
      verifiedAt: new Date().toISOString(),
    });

    // Check if documents required (mortgage)
    if (ctx.state.loanType === 'mortgage') {
      ctx.publish({
        type: 'DocumentsRequested',
        applicationId: ctx.state.applicationId,
        documents: [
          'tax_returns_2y',
          'bank_statements_3m',
          'pay_stubs',
          'property_appraisal',
        ],
      });
    } else {
      // Go directly to underwriting
      ctx.publish({
        type: 'StartUnderwriting',
        applicationId: ctx.state.applicationId,
      });
    }
  }
}

async function rejectApplication(ctx, reason: string) {
  ctx.setState({
    ...ctx.state,
    status: 'rejected',
    failureReason: reason,
    decidedAt: new Date().toISOString(),
  });

  ctx.publish({
    type: 'LoanRejected',
    applicationId: ctx.state.applicationId,
    applicantId: ctx.state.applicantId,
    reason,
  });

  ctx.complete();
}
```

### Underwriting Service

```typescript
// services/underwriting.ts
export const underwritingHandler = createHandler({
  messageType: 'StartUnderwriting',
  handler: async (ctx) => {
    const { applicationId } = ctx.message;

    // Get application state
    const state = await store.getByCorrelationId('LoanApplicationSaga', applicationId);

    // Calculate debt-to-income ratio
    const monthlyPayment = calculateMonthlyPayment(
      state.amount,
      estimateInterestRate(state.creditCheck!.score),
      state.term
    );

    const monthlyIncome = state.incomeVerification!.annualIncome / 12;
    const dti = monthlyPayment / monthlyIncome;

    // Decision rules
    const creditScore = state.creditCheck!.score;
    let approved = false;
    let approvedAmount = state.amount;
    let interestRate = estimateInterestRate(creditScore);
    let reason = '';

    if (dti > 0.43) {
      reason = 'Debt-to-income ratio too high';
    } else if (creditScore < 620) {
      reason = 'Credit score below threshold';
    } else {
      approved = true;

      // Adjust terms based on credit
      if (creditScore < 680) {
        interestRate += 2; // Higher rate for lower credit
        approvedAmount = Math.min(approvedAmount, 25000); // Lower limit
      }
    }

    ctx.publish({
      type: 'UnderwritingDecision',
      applicationId,
      approved,
      approvedAmount,
      interestRate,
      conditions: approved ? ['Proof of insurance required'] : [],
      reason,
    });
  },
});

function calculateMonthlyPayment(principal: number, rate: number, termMonths: number) {
  const monthlyRate = rate / 100 / 12;
  return principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
         (Math.pow(1 + monthlyRate, termMonths) - 1);
}

function estimateInterestRate(creditScore: number): number {
  if (creditScore >= 760) return 6.5;
  if (creditScore >= 700) return 7.5;
  if (creditScore >= 680) return 8.5;
  if (creditScore >= 620) return 10.5;
  return 14.0;
}
```

## Testing

```typescript
describe('LoanApplicationSaga', () => {
  let harness: TestHarness;

  beforeEach(async () => {
    harness = new TestHarness();
    await harness.start({ sagas: [{ definition: loanSaga }] });
  });

  it('approves good credit application', async () => {
    // Submit application
    await harness.publish({
      type: 'LoanApplicationSubmitted',
      applicationId: 'loan-1',
      applicantId: 'user-1',
      loanType: 'personal',
      amount: 10000,
      term: 36,
    });

    // Complete verifications in parallel
    await harness.publish({
      type: 'IdentityVerified',
      applicationId: 'loan-1',
      score: 95,
    });

    await harness.publish({
      type: 'CreditCheckCompleted',
      applicationId: 'loan-1',
      score: 720,
      reportId: 'report-123',
      issues: [],
    });

    await harness.publish({
      type: 'IncomeVerified',
      applicationId: 'loan-1',
      annualIncome: 75000,
      employmentStatus: 'employed',
      employer: 'Tech Corp',
    });

    // Wait for underwriting
    await harness.waitForMessage('StartUnderwriting');

    // Simulate approval
    await harness.publish({
      type: 'UnderwritingDecision',
      applicationId: 'loan-1',
      approved: true,
      approvedAmount: 10000,
      interestRate: 7.5,
      conditions: [],
    });

    // Accept loan
    await harness.publish({
      type: 'LoanAccepted',
      applicationId: 'loan-1',
    });

    // Complete funding
    await harness.publish({
      type: 'FundingCompleted',
      applicationId: 'loan-1',
      amount: 10000,
      accountNumber: 'ACC-123',
      transactionId: 'TXN-456',
    });

    // Verify completed
    const state = await harness.getSagaState('LoanApplicationSaga', 'loan-1');
    expect(state.status).toBe('completed');
    expect(state.fundedAt).toBeDefined();
  });

  it('rejects low credit application', async () => {
    await harness.publish({
      type: 'LoanApplicationSubmitted',
      applicationId: 'loan-2',
      applicantId: 'user-2',
      loanType: 'personal',
      amount: 10000,
      term: 36,
    });

    // Low credit score
    await harness.publish({
      type: 'CreditCheckCompleted',
      applicationId: 'loan-2',
      score: 520, // Below 580 threshold
      reportId: 'report-456',
      issues: ['Multiple delinquencies'],
    });

    // Verify rejection
    const rejection = await harness.waitForMessage('LoanRejected');
    expect(rejection.reason).toContain('Credit score');

    const state = await harness.getSagaState('LoanApplicationSaga', 'loan-2');
    expect(state.status).toBe('rejected');
  });
});
```

## See Also

- [Order Saga](/docs/examples/order-saga) - Simpler example
- [Common Patterns](/docs/examples/patterns) - Pattern reference
- [Testing](/docs/testing/overview) - Testing guide
