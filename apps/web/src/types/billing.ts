export type BillingPlan =
  | "free"
  | "pro"
  | "family";

export type PaidBillingPlan =
  | "pro"
  | "family";

export type BillingStatus = {
  plan_name: BillingPlan;
  subscription_status: string;
  is_paid: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export type CheckoutSessionResponse = {
  checkout_url: string;
};

export type BillingPortalResponse = {
  portal_url: string;
};