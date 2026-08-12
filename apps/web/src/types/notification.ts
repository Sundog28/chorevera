export type NotificationItem = {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  related_chore_id: number | null;
  related_household_id: number | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
};

export type NotificationListResponse = {
  items: NotificationItem[];
  unread_count: number;
};

export type NotificationActionResponse = {
  updated_count: number;
};

export type NotificationDeleteResponse = {
  deleted_count: number;
};
