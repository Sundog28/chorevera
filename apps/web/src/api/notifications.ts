import { apiRequest } from "./client";

import type {
  NotificationActionResponse,
  NotificationDeleteResponse,
  NotificationItem,
  NotificationListResponse,
} from "../types/notification";

export async function getNotifications(options?: { limit?: number; unreadOnly?: boolean }): Promise<NotificationListResponse> {
  const query = new URLSearchParams({
    limit: String(options?.limit ?? 50),
    unread_only: String(options?.unreadOnly ?? false),
  });
  return apiRequest<NotificationListResponse>(`/api/v1/notifications?${query.toString()}`);
}

export async function markNotificationRead(notificationId: number): Promise<NotificationItem> {
  return apiRequest<NotificationItem>(`/api/v1/notifications/${notificationId}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead(): Promise<NotificationActionResponse> {
  return apiRequest<NotificationActionResponse>("/api/v1/notifications/read-all", { method: "PATCH" });
}

export async function deleteNotification(notificationId: number): Promise<NotificationDeleteResponse> {
  return apiRequest<NotificationDeleteResponse>(`/api/v1/notifications/${notificationId}`, { method: "DELETE" });
}

export async function clearReadNotifications(): Promise<NotificationDeleteResponse> {
  return apiRequest<NotificationDeleteResponse>("/api/v1/notifications/clear-read", { method: "DELETE" });
}
