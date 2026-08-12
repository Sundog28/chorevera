import { apiRequest } from "./client";

import type {
  BillingPortalResponse,
  BillingStatus,
  CheckoutSessionResponse,
  PaidBillingPlan,
} from "../types/billing";


export async function getBillingStatus():
Promise<BillingStatus> {
  return apiRequest<BillingStatus>(
    "/api/v1/billing/status",
  );
}


export async function createCheckoutSession(
  plan: PaidBillingPlan,
): Promise<CheckoutSessionResponse> {
  return apiRequest<CheckoutSessionResponse>(
    "/api/v1/billing/checkout",
    {
      method: "POST",
      body: JSON.stringify({
        plan,
      }),
    },
  );
}


export async function createBillingPortal():
Promise<BillingPortalResponse> {
  return apiRequest<BillingPortalResponse>(
    "/api/v1/billing/portal",
    {
      method: "POST",
    },
  );
}