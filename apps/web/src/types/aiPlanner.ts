export type AIPlanActionType =
  | "create"
  | "reassign";

export type AIPlanPriority =
  | "low"
  | "medium"
  | "high";

export type AIPlanProvider =
  | "openai"
  | "fallback";

export type AIPlanAction = {
  action: AIPlanActionType;
  existing_chore_id: number | null;
  title: string;
  assigned_user_id: number;
  reminder_time: string | null;
  priority: AIPlanPriority;
  rationale: string;
};

export type AIPlannerWorkload = {
  user_id: number;
  name: string;
  current_incomplete: number;
  projected_incomplete: number;
  recent_completed: number;
};

export type AIPlannerResponse = {
  household_id: number;
  provider: AIPlanProvider;
  model: string | null;
  fallback_reason: string | null;
  summary: string;
  fairness_notes: string;
  assumptions: string[];
  confidence: number;
  actions: AIPlanAction[];
  workloads: AIPlannerWorkload[];
  generated_at: string;
};

export type AIPlannerApplyResponse = {
  household_id: number;
  applied_action_count: number;
  created_count: number;
  reassigned_count: number;
  message: string;
};
