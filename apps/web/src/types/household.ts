export type HouseholdRole =
  | "owner"
  | "member";

export type InvitationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled";

export type HouseholdMember = {
  membership_id: number;
  user_id: number;
  name: string;
  email: string;
  role: HouseholdRole;
  joined_at: string;
};

export type Household = {
  id: number;
  name: string;
  owner_id: number;
  current_user_role: HouseholdRole;
  member_count: number;
  created_at: string;
  updated_at: string;
  members: HouseholdMember[];
};

export type HouseholdInvitation = {
  id: number;
  household_id: number;
  household_name: string;
  invited_by_user_id: number;
  invited_by_name: string;
  invited_user_id: number;
  invited_name: string;
  invited_email: string;
  status: InvitationStatus;
  created_at: string;
  responded_at: string | null;
};

export type HouseholdInvitationActionResponse = {
  invitation: HouseholdInvitation;
  joined_household: boolean;
};

export type HouseholdDeleteResponse = {
  deleted: boolean;
};

export type InvitationDeleteResponse = {
  cancelled: boolean;
};

export type HouseholdActivity = {
  id: number;
  household_id: number;
  actor_user_id: number | null;
  actor_name: string;
  target_user_id: number | null;
  target_user_name: string | null;
  chore_id: number | null;
  action_type: string;
  message: string;
  created_at: string;
};
