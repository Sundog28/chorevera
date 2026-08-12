import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, CheckCheck, ClipboardCheck, RefreshCw, Trash2, UserPlus, X } from "lucide-react";
import {
  clearReadNotifications, deleteNotification, getNotifications,
  markAllNotificationsRead, markNotificationRead,
} from "../../api/notifications";
import type { NotificationItem } from "../../types/notification";
import "./NotificationCenter.css";

function formatRelativeTime(value: string): string {
  const createdAt = new Date(value);
  const seconds = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function NotificationIcon({ type }: { type: string }) {
  if (type.includes("invitation")) return <UserPlus size={18} />;
  if (type.includes("completed")) return <ClipboardCheck size={18} />;
  return <BellRing size={18} />;
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const centerRef = useRef<HTMLDivElement | null>(null);

  const loadNotifications = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const response = await getNotifications({ limit: 50 });
      setNotifications(response.items);
      setUnreadCount(response.unread_count);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load notifications.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications(true);
    const intervalId = window.setInterval(() => void loadNotifications(), 30_000);
    const visibility = () => { if (document.visibilityState === "visible") void loadNotifications(); };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [loadNotifications]);

  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (centerRef.current && !centerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setIsOpen(false); };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", click);
      document.removeEventListener("keydown", key);
    };
  }, []);

  async function handleRead(notification: NotificationItem) {
    if (notification.is_read) return;
    try {
      const updated = await markNotificationRead(notification.id);
      setNotifications((current) => current.map((item) => item.id === updated.id ? updated : item));
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to mark notification as read.");
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((current) => current.map((item) => ({
        ...item, is_read: true, read_at: item.read_at ?? new Date().toISOString(),
      })));
      setUnreadCount(0);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to mark all notifications as read.");
    }
  }

  async function handleDelete(notificationId: number) {
    const notification = notifications.find((item) => item.id === notificationId);
    try {
      await deleteNotification(notificationId);
      setNotifications((current) => current.filter((item) => item.id !== notificationId));
      if (notification && !notification.is_read) setUnreadCount((current) => Math.max(0, current - 1));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete notification.");
    }
  }

  async function handleClearRead() {
    try {
      await clearReadNotifications();
      setNotifications((current) => current.filter((item) => !item.is_read));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to clear read notifications.");
    }
  }

  return (
    <div className="notification-center" ref={centerRef}>
      <button
        aria-expanded={isOpen}
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Open notifications"}
        className={`notification-center-trigger ${unreadCount > 0 ? "has-unread" : ""}`}
        onClick={() => { const next = !isOpen; setIsOpen(next); if (next) void loadNotifications(true); }}
        type="button"
      >
        {unreadCount > 0 ? <BellRing size={20} /> : <Bell size={20} />}
        {unreadCount > 0 && <span className="notification-center-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-center-popover" role="dialog" aria-label="Notification center">
          <div className="notification-center-header">
            <div><span className="notification-center-eyebrow">Updates</span><h3>Notification center</h3></div>
            <button aria-label="Close notifications" className="notification-center-icon-button" onClick={() => setIsOpen(false)} type="button"><X size={18} /></button>
          </div>

          <div className="notification-center-toolbar">
            <span>{unreadCount === 0 ? "All caught up" : `${unreadCount} unread`}</span>
            <div>
              <button disabled={unreadCount === 0} onClick={() => void handleMarkAllRead()} type="button"><CheckCheck size={15} />Mark all read</button>
              <button onClick={() => void handleClearRead()} type="button"><Trash2 size={15} />Clear read</button>
            </div>
          </div>

          {errorMessage && <div className="notification-center-error">{errorMessage}<button onClick={() => void loadNotifications(true)} type="button">Retry</button></div>}

          <div className="notification-center-list">
            {isLoading ? (
              <div className="notification-center-empty"><RefreshCw className="notification-center-spin" size={22} /><span>Loading notifications…</span></div>
            ) : notifications.length === 0 ? (
              <div className="notification-center-empty"><Bell size={24} /><strong>No notifications yet</strong><span>Assignments, household invitations, and chore activity will appear here.</span></div>
            ) : notifications.map((notification) => (
              <article
                className={`notification-center-item ${notification.is_read ? "" : "unread"}`}
                key={notification.id}
                onClick={() => void handleRead(notification)}
              >
                <div className="notification-center-item-icon"><NotificationIcon type={notification.notification_type} /></div>
                <div className="notification-center-item-copy">
                  <div className="notification-center-item-heading"><strong>{notification.title}</strong><span>{formatRelativeTime(notification.created_at)}</span></div>
                  <p>{notification.message}</p>
                </div>
                <button aria-label="Delete notification" className="notification-center-delete" onClick={(event) => { event.stopPropagation(); void handleDelete(notification.id); }} type="button"><Trash2 size={15} /></button>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
