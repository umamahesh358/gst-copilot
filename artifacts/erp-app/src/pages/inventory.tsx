import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Loader2, Package, Edit2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Link } from "wouter";
import { useDebounce } from "@/hooks/use-debounce";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useListProducts({
    search: debouncedSearch,
    lowStock: lowStockOnly || undefined
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
        <Link href="/inventory/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products or SKU..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="low-stock" checked={lowStockOnly} onCheckedChange={setLowStockOnly} />
              <Label htmlFor="low-stock" className="text-sm font-medium">Low Stock Only</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : data?.products.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No products found</h3>
              <p className="text-muted-foreground mt-1 mb-4">
                {search || lowStockOnly ? 'Try adjusting your filters' : 'Add your first product to get started'}
              </p>
              {!search && !lowStockOnly && (
                <Link href="/inventory/new">
                  <Button variant="outline">Add Product</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{product.name}</span>
                          {product.isLowStock && (
                            <span className="text-[10px] text-destructive uppercase tracking-wider font-bold mt-1">Low Stock</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{product.sku || '-'}</TableCell>
                      <TableCell>{product.category || '-'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(product.price)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={product.isLowStock ? "destructive" : "secondary"}>
                          {product.stockQty} {product.unit || 'pcs'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link href={`/inventory/${product.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </Link>
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
