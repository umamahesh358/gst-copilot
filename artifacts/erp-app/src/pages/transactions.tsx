import { useState } from "react";
import { useListTransactions, useCreateTransaction, getListTransactionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowLeftRight, Loader2, Plus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const txnSchema = z.object({
  type: z.enum(["income", "expense"]),
  category: z.string().min(1, "Category required"),
  description: z.string().min(1, "Description required"),
  amount: z.coerce.number().min(0.01, "Amount must be > 0"),
  date: z.string().min(1, "Date required"),
});
type TxnForm = z.infer<typeof txnSchema>;

const CATEGORIES = {
  income: ["Invoice", "Sale", "Interest", "Refund", "Other Income"],
  expense: ["Purchase", "Salary", "Rent", "Utilities", "Travel", "Marketing", "Tax", "Other Expense"],
};

export default function Transactions() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createTxnMutation = useCreateTransaction();

  const { data, isLoading } = useListTransactions({ limit: 50 });

  const form = useForm<TxnForm>({
    resolver: zodResolver(txnSchema),
    defaultValues: {
      type: "income",
      category: "",
      description: "",
      amount: 0,
      date: new Date().toISOString().split("T")[0],
    },
  });

  const txnType = form.watch("type");

  const onSubmit = (values: TxnForm) => {
    createTxnMutation.mutate(
      { data: { ...values, amount: values.amount } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
          toast({ title: "Transaction recorded" });
          form.reset({ type: "income", category: "", description: "", amount: 0, date: new Date().toISOString().split("T")[0] });
          setOpen(false);
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Error", description: err.message });
        },
      }
    );
  };

  const filtered = data?.transactions?.filter(
    (t) =>
      !search ||
      t.description?.toLowerCase().includes(search.toLowerCase()) ||
      t.category?.toLowerCase().includes(search.toLowerCase())
  );

  const totalIncome = data?.transactions?.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0) || 0;
  const totalExpense = data?.transactions?.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Transactions</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Track all income and expense transactions</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
              <Plus className="mr-2 h-4 w-4" /> Add Transaction
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Record Transaction</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(CATEGORIES[txnType] || []).map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Input placeholder="Brief description" {...field} /></FormControl>
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
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={createTxnMutation.isPending}>
                    {createTxnMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl p-5 bg-emerald-600 text-white shadow-sm">
          <p className="text-xs font-semibold tracking-widest uppercase text-emerald-100 mb-2">Total Income</p>
          <p className="text-2xl font-bold">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="rounded-2xl p-5 bg-red-500 text-white shadow-sm">
          <p className="text-xs font-semibold tracking-widest uppercase text-red-100 mb-2">Total Expenses</p>
          <p className="text-2xl font-bold">{formatCurrency(totalExpense)}</p>
        </div>
        <div className={`rounded-2xl p-5 ${totalIncome - totalExpense >= 0 ? "bg-indigo-600" : "bg-orange-500"} text-white shadow-sm`}>
          <p className="text-xs font-semibold tracking-widest uppercase text-white/70 mb-2">Net Balance</p>
          <p className="text-2xl font-bold">{formatCurrency(Math.abs(totalIncome - totalExpense))}</p>
          <p className="text-xs text-white/70 mt-1">{totalIncome - totalExpense >= 0 ? "Profit" : "Loss"}</p>
        </div>
      </div>

      <Card className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
        <CardHeader className="pb-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search transactions..."
              className="pl-9 rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : !filtered || filtered.length === 0 ? (
            <div className="text-center py-16">
              <ArrowLeftRight className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">No transactions yet</h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">Record your first income or expense</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                    <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500">Date</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500">Description</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500">Category</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500">Type</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((txn) => (
                    <TableRow key={txn.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/50">
                      <TableCell className="text-sm text-gray-500">{formatDate(txn.date)}</TableCell>
                      <TableCell className="text-sm font-medium text-gray-900 dark:text-white">{txn.description}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{txn.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1.5 text-xs font-semibold w-fit px-2 py-1 rounded-full ${
                          txn.type === "income"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                        }`}>
                          {txn.type === "income" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {txn.type === "income" ? "Income" : "Expense"}
                        </div>
                      </TableCell>
                      <TableCell className={`text-right font-semibold text-sm ${
                        txn.type === "income" ? "text-emerald-600" : "text-red-500"
                      }`}>
                        {txn.type === "income" ? "+" : "-"}{formatCurrency(txn.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
