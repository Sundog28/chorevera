export type FeaturePlan =
  | "free"
  | "pro"
  | "family";

export type FeatureAccess = {
  plan_name: FeaturePlan;
  max_chores: number | null;
  unlimited_chores: boolean;
  advanced_reminders: boolean;
  analytics: boolean;
  household_sharing: boolean;
  ai_planning: boolean;
};