import { useState } from "react";
import { useListBackups, useCreateBackup, useRestoreBackup, useDeleteBackup, getListBackupsQueryKey, useGetSubscription } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, Download, RefreshCw, Trash2, Loader2, CloudOff, Clock, CheckCircle2, AlertCircle, UploadCloud, Shield } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_CONFIG = {
  completed: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30", label: "Completed" },
  running: { icon: RefreshCw, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30", label: "Running" },
  failed: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/30", label: "Failed" },
  pending: { icon: Clock, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30", label: "Pending" },
};

export default function Backup() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [createDialog, setCreateDialog] = useState(false);
  const [restoreDialog, setRestoreDialog] = useState<number | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<number | null>(null);
  const [label, setLabel] = useState("");

  const { data, isLoading } = useListBackups();
  const { data: subData } = useGetSubscription();
  const createMutation = useCreateBackup();
  const restoreMutation = useRestoreBackup();
  const deleteMutation = useDeleteBackup();

  const isPro = subData?.plan === "pro";
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListBackupsQueryKey() });

  const handleCreate = () => {
    createMutation.mutate(
      { data: { label: label.trim() || undefined, type: "manual" } },
      {
        onSuccess: () => {
          toast({ title: "Backup created", description: "Your data has been backed up to the cloud." });
          setCreateDialog(false);
          setLabel("");
          invalidate();
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Backup failed", description: err.message });
        },
      }
    );
  };

  const handleRestore = (id: number) => {
    restoreMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Restore complete", description: "Your data has been restored successfully." });
        setRestoreDialog(null);
        invalidate();
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Restore failed", description: err.message });
      },
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Backup deleted" });
        setDeleteDialog(null);
        invalidate();
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Error", description: err.message });
      },
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Cloud Backup & Restore</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Protect your business data with cloud backups</p>
        </div>
        <Button
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
          onClick={() => isPro ? setCreateDialog(true) : toast({ variant: "destructive", title: "Pro required", description: "Upgrade to Pro to create cloud backups." })}
        >
          <UploadCloud className="mr-2 h-4 w-4" />
          New Backup
        </Button>
      </div>

      {!isPro && (
        <Alert className="rounded-2xl border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
          <CloudOff className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm text-amber-700 dark:text-amber-300">
            Cloud backup requires a <strong>Pro subscription</strong>. Upgrade to protect your business data.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl p-5 bg-indigo-600 text-white shadow-sm">
          <p className="text-xs font-semibold tracking-widest uppercase text-indigo-100 mb-2">Total Backups</p>
          <p className="text-2xl font-bold">{data?.backups?.length || 0}</p>
        </div>
        <div className="rounded-2xl p-5 bg-emerald-600 text-white shadow-sm">
          <p className="text-xs font-semibold tracking-widest uppercase text-emerald-100 mb-2">Last Backup</p>
          <p className="text-sm font-semibold">
            {data?.backups?.[0]?.completedAt ? formatDate(data.backups[0].completedAt) : "Never"}
          </p>
        </div>
        <div className="rounded-2xl p-5 bg-teal-600 text-white shadow-sm">
          <p className="text-xs font-semibold tracking-widest uppercase text-teal-100 mb-2">Records Backed Up</p>
          <p className="text-2xl font-bold">
            {data?.backups?.filter(b => b.status === "completed").reduce((s, b) => s + (b.recordCount || 0), 0) || 0}
          </p>
        </div>
      </div>

      {/* Backup List */}
      <Card className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Database className="h-4 w-4 text-indigo-600" />
            Backup History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : !data?.backups || data.backups.length === 0 ? (
            <div className="text-center py-12">
              <Database className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">No backups yet</p>
              <p className="text-xs text-gray-500 mb-4">Create your first backup to protect your data</p>
              {isPro && (
                <Button size="sm" onClick={() => setCreateDialog(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                  Create Backup
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {data.backups.map((backup) => {
                const statusConf = STATUS_CONFIG[backup.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                const StatusIcon = statusConf.icon;
                return (
                  <div key={backup.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", statusConf.bg)}>
                        <StatusIcon className={cn("h-4 w-4", statusConf.color, backup.status === "running" ? "animate-spin" : "")} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{backup.label || `Backup #${backup.id}`}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-gray-400">{formatDate(backup.createdAt)}</span>
                          {backup.recordCount && <span className="text-xs text-gray-400">{backup.recordCount} records</span>}
                          {backup.sizeBytesEstimate && <span className="text-xs text-gray-400">{formatBytes(backup.sizeBytesEstimate)}</span>}
                          {backup.restoredAt && <span className="text-xs text-amber-500">Restored {formatDate(backup.restoredAt)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={cn("text-xs border-0", statusConf.bg, statusConf.color)}>{statusConf.label}</Badge>
                      {backup.status === "completed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs rounded-lg"
                          onClick={() => setRestoreDialog(backup.id)}
                        >
                          <RefreshCw className="mr-1 h-3 w-3" /> Restore
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 rounded-lg text-gray-400 hover:text-red-500"
                        onClick={() => setDeleteDialog(backup.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security notice */}
      <Card className="rounded-2xl border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Backup Security</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                All backups include: invoices, products, customers, and transactions. Backups are stored securely and expire after 90 days.
                Restore is a non-destructive operation — existing data is preserved.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Backup</DialogTitle>
            <DialogDescription>Backup all your business data to the cloud securely.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="backup-label" className="text-sm">Label (optional)</Label>
              <Input
                id="backup-label"
                className="mt-1 rounded-xl"
                placeholder={`Backup ${new Date().toLocaleDateString("en-IN")}`}
                value={label}
                onChange={e => setLabel(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateDialog(false)}>Cancel</Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Backing up...</> : "Create Backup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore dialog */}
      <Dialog open={!!restoreDialog} onOpenChange={() => setRestoreDialog(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Restore Backup?</DialogTitle>
            <DialogDescription>
              This will restore data from the selected backup. Your current data will be retained.
              This operation cannot be undone — make a fresh backup first if needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRestoreDialog(null)}>Cancel</Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => restoreDialog && handleRestore(restoreDialog)}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Restoring...</> : "Restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Backup?</DialogTitle>
            <DialogDescription>This backup will be permanently deleted and cannot be recovered.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteDialog && handleDelete(deleteDialog)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
