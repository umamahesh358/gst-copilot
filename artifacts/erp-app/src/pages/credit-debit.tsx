import { useState } from "react";
import { useListTransactions, useCreateTransaction, getListTransactionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Plus, Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const noteSchema = z.object({
  type: z.enum(["income", "expense"]),
  category: z.string().min(1, "Category required"),
  description: z.string().min(1, "Description required"),
  amount: z.coerce.number().min(0.01, "Amount must be > 0"),
  date: z.string().min(1, "Date required"),
});
type NoteForm = z.infer<typeof noteSchema>;

export default function CreditDebit() {
  const [open, setOpen] = useState(false);
  const [noteType, setNoteType] = useState<"income" | "expense">("income");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createTxnMutation = useCreateTransaction();

  const { data, isLoading } = useListTransactions({ limit: 200 });

  const credits = data?.transactions?.filter((t) => t.type === "income") || [];
  const debits = data?.transactions?.filter((t) => t.type === "expense") || [];
  const totalCredit = credits.reduce((s, t) => s + t.amount, 0);
  const totalDebit = debits.reduce((s, t) => s + t.amount, 0);

  const form = useForm<NoteForm>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      type: noteType,
      category: "",
      description: "",
      amount: 0,
      date: new Date().toISOString().split("T")[0],
    },
  });

  const openDialog = (type: "income" | "expense") => {
    setNoteType(type);
    form.reset({ type, category: "", description: "", amount: 0, date: new Date().toISOString().split("T")[0] });
    setOpen(true);
  };

  const onSubmit = (values: NoteForm) => {
    createTxnMutation.mutate(
      { data: { ...values } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
          toast({ title: `${noteType === "income" ? "Credit" : "Debit"} note recorded` });
          setOpen(false);
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Error", description: err.message });
        },
      }
    );
  };

  const TxnTable = ({ items }: { items: typeof credits }) => (
    items.length === 0 ? (
      <div className="text-center py-10 text-gray-400">
        <CreditCard className="mx-auto h-10 w-10 mb-3 opacity-20" />
        <p className="text-sm">No entries yet</p>
      </div>
    ) : (
      <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 dark:bg-gray-900/50">
              <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500">Date</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500">Description</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500">Category</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500 text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((t) => (
              <TableRow key={t.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/50">
                <TableCell className="text-sm text-gray-500">{formatDate(t.date)}</TableCell>
                <TableCell className="text-sm font-medium text-gray-900 dark:text-white">{t.description}</TableCell>
                <TableCell><Badge variant="secondary" className="text-xs">{t.category}</Badge></TableCell>
                <TableCell className={`text-right font-semibold text-sm ${t.type === "income" ? "text-emerald-600" : "text-red-500"}`}>
                  {formatCurrency(t.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Credit & Debit</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage credit and debit notes</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => openDialog("income")} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
            <ArrowUpRight className="mr-2 h-4 w-4" /> Credit Note
          </Button>
          <Button onClick={() => openDialog("expense")} className="bg-red-500 hover:bg-red-600 text-white rounded-xl">
            <ArrowDownRight className="mr-2 h-4 w-4" /> Debit Note
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl p-5 bg-emerald-600 text-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold tracking-widest uppercase text-emerald-100">Total Credits</p>
            <ArrowUpRight className="h-5 w-5 text-emerald-100" />
          </div>
          <p className="text-2xl font-bold">{formatCurrency(totalCredit)}</p>
          <p className="text-xs text-emerald-100 mt-1">{credits.length} credit entries</p>
        </div>
        <div className="rounded-2xl p-5 bg-red-500 text-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold tracking-widest uppercase text-red-100">Total Debits</p>
            <ArrowDownRight className="h-5 w-5 text-red-100" />
          </div>
          <p className="text-2xl font-bold">{formatCurrency(totalDebit)}</p>
          <p className="text-xs text-red-100 mt-1">{debits.length} debit entries</p>
        </div>
      </div>

      <Card className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <Tabs defaultValue="credits">
              <TabsList className="rounded-xl mb-4">
                <TabsTrigger value="credits" className="rounded-lg">Credits ({credits.length})</TabsTrigger>
                <TabsTrigger value="debits" className="rounded-lg">Debits ({debits.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="credits">
                <TxnTable items={credits} />
              </TabsContent>
              <TabsContent value="debits">
                <TxnTable items={debits} />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{noteType === "income" ? "Add Credit Note" : "Add Debit Note"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {(noteType === "income"
                        ? ["Invoice", "Sale", "Refund", "Discount Received", "Other"]
                        : ["Purchase", "Refund Given", "Discount Issued", "Write-off", "Other"]
                      ).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Input placeholder="Enter description" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (₹)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0.01" placeholder="0.00" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  type="submit"
                  className={noteType === "income" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-red-500 hover:bg-red-600 text-white"}
                  disabled={createTxnMutation.isPending}
                >
                  {createTxnMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
