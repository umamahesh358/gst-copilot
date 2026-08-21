import { useState } from "react";
import { useListCustomers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Loader2, Plus } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { useDebounce } from "@/hooks/use-debounce";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateCustomer, getListCustomersQueryKey } from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { validateGstinField } from "@/lib/gstin";

const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  gstNumber: z.string().optional().refine(
    (val) => !validateGstinField(val),
    (val) => ({ message: validateGstinField(val) || "" })
  ),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});
type CustomerForm = z.infer<typeof customerSchema>;

export default function Customers() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createCustomerMutation = useCreateCustomer();

  const { data, isLoading } = useListCustomers({
    search: debouncedSearch || undefined,
    limit: 50,
  });

  const form = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: "", email: "", phone: "", gstNumber: "", address: "", city: "", state: "" },
  });

  const onSubmit = (values: CustomerForm) => {
    createCustomerMutation.mutate(
      {
        data: {
          name: values.name,
          email: values.email || undefined,
          phone: values.phone || undefined,
          gstNumber: values.gstNumber || undefined,
          address: values.address || undefined,
          city: values.city || undefined,
          state: values.state || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
          toast({ title: "Customer added successfully" });
          form.reset();
          setOpen(false);
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Error", description: err.message });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Customers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage your customer database</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
              <Plus className="mr-2 h-4 w-4" /> Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl><Input placeholder="Customer / Business name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" placeholder="email@example.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input placeholder="+91 98765 43210" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="gstNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>GSTIN</FormLabel>
                    <FormControl><Input placeholder="22AAAAA0000A1Z5" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl><Input placeholder="Mumbai" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="state" render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl><Input placeholder="Maharashtra" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={createCustomerMutation.isPending}>
                    {createCustomerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Customer
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
        <CardHeader className="pb-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search customers..."
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
          ) : !data?.customers || data.customers.length === 0 ? (
            <div className="text-center py-16">
              <Users className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">No customers yet</h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">Add your first customer to get started</p>
              <Button onClick={() => setOpen(true)} variant="outline" className="rounded-xl">
                <Plus className="mr-2 h-4 w-4" /> Add Customer
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                    <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500">Name</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500">Contact</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500">GSTIN</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500">Location</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500 text-right">Total Spent</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500 text-right">Invoices</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.customers.map((customer) => (
                    <TableRow key={customer.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 text-xs font-bold flex-shrink-0">
                            {customer.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-sm text-gray-900 dark:text-white">{customer.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        <div>{customer.email || "—"}</div>
                        <div className="text-xs">{customer.phone || ""}</div>
                      </TableCell>
                      <TableCell>
                        {customer.gstNumber ? (
                          <Badge variant="outline" className="font-mono text-xs border-gray-200 dark:border-gray-700">
                            {customer.gstNumber}
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {[customer.city, customer.state].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm text-gray-900 dark:text-white">
                        {formatCurrency((customer as any).totalSpent || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="text-xs">
                          {(customer as any).totalInvoices || 0}
                        </Badge>
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
