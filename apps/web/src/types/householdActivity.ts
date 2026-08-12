export type HouseholdActivityAction =
  | "chore_created"
  | "chore_updated"
  | "chore_completed"
  | "chore_reopened"
  | "chore_deleted"
  | "household_created"
  | "household_renamed"
  | "member_left"
  | "invitation_sent"
  | "invitation_declined"
  | "invitation_cancelled"
  | "member_joined";


export interface HouseholdActivity {
  id: number;
  household_id: number;
  actor_user_id: number | null;
  actor_name: string | null;
  target_user_id: number | null;
  target_user_name: string | null;
  chore_id: number | null;
  action_type: HouseholdActivityAction;
  message: string;
  created_at: string;
}