import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useParams } from "wouter";
import { useUpdateProduct, useGetProduct, getGetProductQueryKey, getListProductsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  price: z.coerce.number().min(0, "Price must be >= 0"),
  costPrice: z.coerce.number().min(0, "Cost price must be >= 0").optional(),
  gstRate: z.coerce.number(),
  stockQty: z.coerce.number().min(0, "Stock qty must be >= 0"),
  lowStockThreshold: z.coerce.number().min(0, "Threshold must be >= 0"),
  category: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

export default function EditProduct() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: product, isLoading } = useGetProduct(Number(id), {
    query: { enabled: !!id, queryKey: getGetProductQueryKey(Number(id)) }
  });
  
  const updateProductMutation = useUpdateProduct();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      unit: "pcs",
      price: 0,
      costPrice: 0,
      gstRate: 18,
      stockQty: 0,
      lowStockThreshold: 5,
      category: "",
    },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        sku: product.sku || "",
        unit: product.unit || "pcs",
        price: product.price,
        costPrice: product.costPrice || 0,
        gstRate: product.gstRate,
        stockQty: product.stockQty,
        lowStockThreshold: product.lowStockThreshold,
        category: product.category || "",
      });
    }
  }, [product, form]);

  const onSubmit = (data: ProductFormValues) => {
    updateProductMutation.mutate(
      { id: Number(id), data: data as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProductQueryKey(Number(id)) });
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          toast({ title: "Product updated successfully" });
          setLocation("/inventory");
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Error", description: err.message });
        }
      }
    );
  };

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/inventory">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Edit Product</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-3xl">
          {/* Form fields same as new-product */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="md:col-span-2"><FormLabel>Product Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="sku" render={({ field }) => (
                <FormItem><FormLabel>SKU</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem><FormLabel>Category</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing & Taxes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem><FormLabel>Selling Price</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="costPrice" render={({ field }) => (
                <FormItem><FormLabel>Cost Price</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="gstRate" render={({ field }) => (
                <FormItem><FormLabel>GST Rate</FormLabel><Select onValueChange={(val) => field.onChange(Number(val))} value={field.value.toString()}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="0">0%</SelectItem><SelectItem value="5">5%</SelectItem><SelectItem value="12">12%</SelectItem><SelectItem value="18">18%</SelectItem><SelectItem value="28">28%</SelectItem></SelectContent></Select><FormMessage /></FormItem>
              )}/>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventory Tracking</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <FormField control={form.control} name="stockQty" render={({ field }) => (
                <FormItem><FormLabel>Current Stock</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="unit" render={({ field }) => (
                <FormItem><FormLabel>Unit</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="pcs">Pieces</SelectItem><SelectItem value="kg">Kilograms</SelectItem><SelectItem value="g">Grams</SelectItem><SelectItem value="l">Liters</SelectItem><SelectItem value="box">Boxes</SelectItem></SelectContent></Select><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="lowStockThreshold" render={({ field }) => (
                <FormItem><FormLabel>Low Stock Alert At</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
            </CardContent>
          </Card>

          <Button type="submit" size="lg" disabled={updateProductMutation.isPending}>
            {updateProductMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </form>
      </Form>
    </div>
  );
}
