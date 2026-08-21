import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Bell, Check, CheckCheck, Trash2, Loader2, Info, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  actionLabel?: string;
  actionUrl?: string;
  createdAt: string;
}

const typeIcons: Record<string, React.ElementType> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
};

const typeColors: Record<string, string> = {
  success: "text-emerald-500",
  warning: "text-amber-500",
  error: "text-red-500",
  info: "text-blue-500",
};

async function fetchNotifications(): Promise<{ notifications: Notification[]; unreadCount: number }> {
  const res = await fetch("/api/notifications?limit=50", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch notifications");
  return res.json();
}

export default function Notifications() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["/notifications"], queryFn: fetchNotifications });

  const markRead = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH", credentials: "include" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await fetch("/api/notifications/read-all", { method: "PATCH", credentials: "include" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/notifications"] }),
  });

  const deleteNotif = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/notifications/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/notifications"] }),
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bell className="h-6 w-6 text-indigo-500" />
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 text-sm font-semibold bg-red-500 text-white rounded-full px-2.5 py-0.5">
                {unreadCount} unread
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Stay updated on invoices, payments, and system alerts
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <CheckCheck className="h-4 w-4 mr-1.5" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Notification list */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <Bell className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">No notifications yet</h3>
          <p className="text-sm text-gray-500 mt-1">You'll see alerts for invoices, payments, and system events here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const Icon = typeIcons[notif.type] ?? Info;
            const color = typeColors[notif.type] ?? "text-gray-500";

            return (
              <div
                key={notif.id}
                className={cn(
                  "flex items-start gap-3 p-4 rounded-xl border transition-all",
                  notif.isRead
                    ? "bg-white dark:bg-gray-950 border-gray-100 dark:border-gray-800"
                    : "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900"
                )}
              >
                <div className={cn("mt-0.5 flex-shrink-0", color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={cn("text-sm font-semibold", notif.isRead ? "text-gray-700 dark:text-gray-300" : "text-gray-900 dark:text-white")}>
                      {notif.title}
                    </h4>
                    {!notif.isRead && (
                      <span className="h-2 w-2 rounded-full bg-indigo-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{notif.message}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                    </span>
                    {notif.actionLabel && notif.actionUrl && (
                      <a href={notif.actionUrl} className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                        {notif.actionLabel} →
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!notif.isRead && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-gray-400 hover:text-indigo-600"
                      onClick={() => markRead.mutate(notif.id)}
                      title="Mark as read"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-gray-400 hover:text-red-500"
                    onClick={() => deleteNotif.mutate(notif.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
