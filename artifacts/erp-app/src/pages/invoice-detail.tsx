import { useGetInvoice, useUpdateInvoiceStatus, getGetInvoiceQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { ArrowLeft, Loader2, Download, CheckCircle, Clock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function InvoiceDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: invoice, isLoading } = useGetInvoice(Number(id), {
    query: { enabled: !!id, queryKey: getGetInvoiceQueryKey(Number(id)) }
  });
  
  const updateStatusMutation = useUpdateInvoiceStatus();

  const handleMarkAsPaid = () => {
    updateStatusMutation.mutate(
      { id: Number(id), data: { status: "paid" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetInvoiceQueryKey(Number(id)) });
          toast({ title: "Invoice marked as paid" });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Failed to update status" });
        }
      }
    );
  };

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!invoice) return <div>Invoice not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/invoices">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Invoice {invoice.invoiceNumber}</h1>
          <Badge 
            variant="outline" 
            className={
              invoice.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500' :
              invoice.status === 'unpaid' ? 'bg-amber-500/10 text-amber-500' :
              invoice.status === 'overdue' ? 'bg-destructive/10 text-destructive' : ''
            }
          >
            {invoice.status.toUpperCase()}
          </Badge>
        </div>
        <div className="flex gap-2">
          {invoice.status !== 'paid' && (
            <Button onClick={handleMarkAsPaid} disabled={updateStatusMutation.isPending}>
              {updateStatusMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Mark as Paid
            </Button>
          )}
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" /> PDF
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-medium">{invoice.customerName}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Issue Date</span>
              <span>{formatDate(invoice.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due Date</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                {invoice.dueDate ? formatDate(invoice.dueDate) : '-'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">GST %</TableHead>
                <TableHead className="text-right">GST Amt</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                  <TableCell className="text-right">{item.gstRate}%</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.gstAmount)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-end mt-6">
            <div className="w-64 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total GST</span>
                <span>{formatCurrency(invoice.gstAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-3 border-t">
                <span>Total Amount</span>
                <span>{formatCurrency(invoice.totalAmount)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
