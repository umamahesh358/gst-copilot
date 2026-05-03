import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Clock, AlertCircle, ClipboardList } from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("bizos_token") ?? "";
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...opts, headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

type Approval = {
  id: number; entityType: string; entityId: string; action: string; title: string;
  description?: string; priority: string; status: string; comments?: string;
  reviewedAt?: string; createdAt: string;
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  normal: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};
const STATUS_ICON: Record<string, React.ElementType> = {
  pending: Clock, approved: CheckCircle2, rejected: XCircle,
};
const STATUS_COLOR: Record<string, string> = {
  pending: "text-amber-600", approved: "text-emerald-600", rejected: "text-red-500",
};

export default function Approvals() {
  const [filter, setFilter] = useState("pending");
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["approvals", filter],
    queryFn: () => apiFetch(`/approvals${filter !== "all" ? `?status=${filter}` : ""}`),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, comments }: { id: number; comments: string }) =>
      apiFetch(`/approvals/${id}/approve`, { method: "POST", body: JSON.stringify({ comments }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["approvals"] }); setReviewId(null); setComment(""); toast({ title: "Approved successfully" }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });
  const rejectMutation = useMutation({
    mutationFn: ({ id, comments }: { id: number; comments: string }) =>
      apiFetch(`/approvals/${id}/reject`, { method: "POST", body: JSON.stringify({ comments }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["approvals"] }); setReviewId(null); setComment(""); toast({ title: "Rejected" }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const items: Approval[] = data?.approvals ?? [];
  const pendingCount = items.filter(a => a.status === "pending").length;

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Approvals Queue</h1>
            {pendingCount > 0 && <Badge className="bg-amber-500 text-white text-xs">{pendingCount} pending</Badge>}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Review and approve pending actions that require authorization</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5">
        {["pending", "approved", "rejected", "all"].map(s => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"}
            className={cn("text-xs h-7 capitalize", filter === s ? "bg-indigo-600 text-white" : "")}
            onClick={() => setFilter(s)}>
            {s}
          </Button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : items.length === 0 ? (
          <Card className="border border-gray-100 dark:border-gray-800">
            <CardContent className="py-16 text-center">
              <ClipboardList className="h-10 w-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                {filter === "pending" ? "No pending approvals. You're all caught up!" : `No ${filter} approvals.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          items.map(item => {
            const StatusIcon = STATUS_ICON[item.status] ?? AlertCircle;
            return (
              <Card key={item.id} className={cn("border transition-shadow hover:shadow-sm", item.status === "pending" ? "border-amber-200 dark:border-amber-900/50" : "border-gray-100 dark:border-gray-800")}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <StatusIcon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", STATUS_COLOR[item.status] ?? "text-gray-400")} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white">{item.title}</p>
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize", PRIORITY_COLORS[item.priority] ?? PRIORITY_COLORS.normal)}>
                            {item.priority}
                          </span>
                          <Badge variant="outline" className="text-[10px] capitalize">{item.entityType}</Badge>
                        </div>
                        {item.description && <p className="text-xs text-gray-500 mt-1">{item.description}</p>}
                        {item.comments && (
                          <p className="text-xs text-gray-500 mt-1 italic">Note: {item.comments}</p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1.5">
                          {item.status === "pending" ? `Requested ${new Date(item.createdAt).toLocaleDateString("en-IN")}` : `Reviewed ${item.reviewedAt ? new Date(item.reviewedAt).toLocaleDateString("en-IN") : ""}`}
                        </p>
                      </div>
                    </div>
                    {item.status === "pending" && (
                      <div className="flex gap-2 flex-shrink-0">
                        {reviewId === item.id ? (
                          <div className="flex flex-col gap-2 w-56">
                            <textarea value={comment} onChange={e => setComment(e.target.value)}
                              placeholder="Add comment (optional)…" rows={2}
                              className="text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 resize-none w-full" />
                            <div className="flex gap-1.5">
                              <Button size="sm" className="flex-1 h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => approveMutation.mutate({ id: item.id, comments: comment })}
                                disabled={approveMutation.isPending}>
                                Approve
                              </Button>
                              <Button size="sm" className="flex-1 h-7 text-xs bg-red-600 hover:bg-red-700 text-white"
                                onClick={() => rejectMutation.mutate({ id: item.id, comments: comment })}
                                disabled={rejectMutation.isPending}>
                                Reject
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setReviewId(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReviewId(item.id)}>
                            Review
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
