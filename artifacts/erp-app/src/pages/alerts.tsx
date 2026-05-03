import { useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, useDeleteNotification, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, CheckCheck, Loader2, Trash2, Info, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

const TYPE_CONFIG = {
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-100 dark:border-blue-900" },
  success: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-100 dark:border-emerald-900" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-100 dark:border-amber-900" },
  error: { icon: XCircle, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-100 dark:border-red-900" },
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Alerts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useListNotifications({ limit: 50 });
  const readMutation = useMarkNotificationRead();
  const readAllMutation = useMarkAllNotificationsRead();
  const deleteMutation = useDeleteNotification();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });

  const handleReadAll = () => {
    readAllMutation.mutate(undefined, {
      onSuccess: () => { invalidate(); toast({ title: "All notifications marked as read" }); },
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => invalidate(),
    });
  };

  const handleMarkRead = (id: number) => {
    readMutation.mutate({ id }, {
      onSuccess: () => invalidate(),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Alerts & Notifications</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {data?.unreadCount ? `${data.unreadCount} unread notification${data.unreadCount > 1 ? "s" : ""}` : "All caught up"}
          </p>
        </div>
        {(data?.unreadCount || 0) > 0 && (
          <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={handleReadAll} disabled={readAllMutation.isPending}>
            {readAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
            Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : !data?.notifications || data.notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <BellOff className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">No notifications</h3>
          <p className="text-sm text-gray-500">You're all caught up! Alerts will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.notifications.map((notif) => {
            const config = TYPE_CONFIG[notif.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.info;
            const Icon = config.icon;
            return (
              <Card
                key={notif.id}
                className={cn(
                  "rounded-2xl border transition-all",
                  !notif.isRead ? cn(config.bg, config.border) : "border-gray-100 dark:border-gray-800",
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                      !notif.isRead ? "bg-white/60 dark:bg-gray-900/40" : "bg-gray-100 dark:bg-gray-800"
                    )}>
                      <Icon className={cn("h-4 w-4", !notif.isRead ? config.color : "text-gray-400")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={cn("text-sm font-semibold", !notif.isRead ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400")}>
                            {notif.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{notif.message}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!notif.isRead && (
                            <Badge className="text-[10px] bg-indigo-600 text-white border-0 px-1.5 py-0">New</Badge>
                          )}
                          <span className="text-xs text-gray-400">{timeAgo(notif.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {notif.actionUrl && notif.actionLabel && (
                          <Link href={notif.actionUrl}>
                            <Button size="sm" variant="outline" className="h-6 text-xs rounded-lg px-2 py-0">
                              {notif.actionLabel}
                            </Button>
                          </Link>
                        )}
                        {!notif.isRead && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs rounded-lg px-2 py-0 text-gray-500"
                            onClick={() => handleMarkRead(notif.id)}
                            disabled={readMutation.isPending}
                          >
                            Mark read
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 rounded-lg text-gray-400 hover:text-red-500 ml-auto"
                          onClick={() => handleDelete(notif.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
