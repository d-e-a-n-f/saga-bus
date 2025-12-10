import { NextResponse } from "next/server";
import { getSagaBus, getStore } from "../../../lib/saga-bus";
import type { LoanApplicationSubmitted } from "@saga-bus/examples-shared";
import { randomUUID } from "crypto";

export async function GET() {
  const store = getStore();

  // Get all loan applications from store using PostgreSQL query
  const allStates = await store.findByName("LoanApplicationSaga", {
    limit: 100,
  });

  const applications = allStates.map((state) => ({
    applicationId: state.applicationId,
    status: state.status,
    loanType: state.loanType,
    requestedAmount: state.requestedAmount,
    applicantName: `${state.applicantInfo.firstName} ${state.applicantInfo.lastName}`,
    creditScore: state.creditCheck?.creditScore,
    approvedAmount: state.loan?.approvedAmount,
    interestRate: state.loan?.interestRate,
    statusHistory: state.statusHistory,
  }));

  return NextResponse.json({ applications });
}

export async function POST(request: Request) {
  const body = await request.json();
  const sagaBus = await getSagaBus();

  const applicationId = `APP-${randomUUID().slice(0, 8).toUpperCase()}`;

  const message: LoanApplicationSubmitted = {
    type: "LoanApplicationSubmitted",
    applicationId,
    applicantId: `APPL-${randomUUID().slice(0, 8)}`,
    loanType: body.loanType,
    requestedAmount: body.requestedAmount,
    termMonths: body.termMonths,
    applicantInfo: {
      firstName: body.applicantInfo.firstName,
      lastName: body.applicantInfo.lastName,
      email: body.applicantInfo.email,
      phone: body.applicantInfo.phone,
      ssn: body.applicantInfo.ssn,
      dateOfBirth: body.applicantInfo.dateOfBirth,
      annualIncome: body.applicantInfo.annualIncome,
      employmentStatus: body.applicantInfo.employmentStatus,
      employerName: body.applicantInfo.employerName,
    },
    propertyInfo:
      body.loanType === "mortgage"
        ? {
            address: body.propertyInfo.address,
            estimatedValue: body.propertyInfo.estimatedValue,
            propertyType: body.propertyInfo.propertyType,
          }
        : undefined,
  };

  await sagaBus.publish(message);

  return NextResponse.json({
    success: true,
    applicationId,
    message: "Application submitted successfully",
  });
}
