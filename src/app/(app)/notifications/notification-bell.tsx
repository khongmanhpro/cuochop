"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type HeaderNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  actionUrl: string | null;
  createdAt: string;
};

export function NotificationBell({
  initialNotifications,
  initialUnreadCount,
}: {
  initialNotifications: HeaderNotification[];
  initialUnreadCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isPending, startTransition] = useTransition();

  function markAsRead(id?: string) {
    startTransition(async () => {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : {}),
      });

      if (id) {
        setNotifications((current) =>
          current.map((notification) =>
            notification.id === id ? { ...notification, read: true } : notification,
          ),
        );
        setUnreadCount((current) => Math.max(0, current - 1));
      } else {
        setNotifications((current) =>
          current.map((notification) => ({ ...notification, read: true })),
        );
        setUnreadCount(0);
      }
    });
  }

  function openNotification(notification: HeaderNotification) {
    if (!notification.read) {
      markAsRead(notification.id);
    }

    if (notification.actionUrl) {
      router.push(notification.actionUrl);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-slate hover:border-ink hover:text-ink"
        onClick={() => setOpen((current) => !current)}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-on-dark">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-hairline bg-canvas shadow-lg">
          <div className="flex items-center justify-between border-b border-hairline-soft px-4 py-3">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            <button
              type="button"
              disabled={isPending || unreadCount === 0}
              className="text-xs font-semibold text-ink disabled:text-steel"
              onClick={() => markAsRead()}
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={`block w-full border-b border-hairline-soft px-4 py-3 text-left hover:bg-surface ${
                    notification.read ? "bg-canvas" : "bg-brand-blue-200/40"
                  }`}
                  onClick={() => openNotification(notification)}
                >
                  <span className="block text-sm font-semibold text-ink">
                    {notification.title}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate">
                    {notification.body}
                  </span>
                  <span className="mt-1 block text-[11px] text-steel">
                    {formatDate(notification.createdAt)}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-4 py-6 text-center text-sm text-slate">
                No notifications yet.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
