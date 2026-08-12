export type Plan =
  | "free"
  | "pro"
  | "family";


export type NotificationState =
  | NotificationPermission
  | "unsupported";


export type ChoreScope =
  | "all"
  | "mine"
  | "personal"
  | "household";


export type Chore = {
  id: number;
  title: string;
  reminderTime: string;
  completed: boolean;

  ownerId: number;
  householdId: number | null;
  assignedUserId: number | null;

  createdAt: string;
  updatedAt: string;

  lastNotificationDate?: string;
};


export type ChoreCreateInput = {
  title: string;
  reminderTime: string;

  householdId?: number | null;
  assignedUserId?: number | null;
};


export type ChoreUpdateInput = {
  title?: string;
  reminderTime?: string | null;
  completed?: boolean;
  assignedUserId?: number | null;
};


export type ChoreQuery = {
  scope?: ChoreScope;
  householdId?: number | null;
  assignedUserId?: number | null;
};


export type ChoreApiResponse = {
  id: number;
  title: string;
  reminder_time: string | null;
  completed: boolean;

  owner_id: number;
  household_id: number | null;
  assigned_user_id: number | null;

  created_at: string;
  updated_at: string;
};


export type DayHistory = {
  date: string;
  completedCount: number;
  totalCount: number;
  allCompleted: boolean;
};


export type CompletionHistory = Record<
  string,
  DayHistory
>;