import { useListProducts, useDeleteProduct, getListProductsQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Loader2, Package, Edit2, Trash2, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Link } from "wouter";
import { useDebounce } from "@/hooks/use-debounce";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Inventory() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useListProducts({
    search: debouncedSearch,
    limit: 200,
  });
  const deleteMutation = useDeleteProduct();

  const products = data?.products || [];

  const totalItems = products.length;
  const lowStockCount = products.filter((p) => p.isLowStock).length;
  const totalStockValue = products.reduce((s, p) => s + Number(p.costPrice || 0) * Number(p.stockQty || 0), 0);
  const potentialRevenue = products.reduce((s, p) => s + Number(p.price || 0) * Number(p.stockQty || 0), 0);

  const lowStockNames = products.filter((p) => p.isLowStock).map((p) => p.name).join(", ");

  const handleDelete = (id: number) => {
    if (!confirm("Delete this product?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        toast({ title: "Product deleted" });
      },
    });
  };

  const margin = (p: any) => {
    const buy = Number(p.costPrice || 0);
    const sell = Number(p.price || 0);
    if (!buy || buy === 0) return "—";
    const pct = ((sell - buy) / buy) * 100;
    return pct.toFixed(1) + "%";
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="h-6 w-6 text-indigo-600" /> Inventory
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage products, stock levels, HSN codes &amp; GST rates</p>
        </div>
        <Link href="/inventory/new">
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-1.5">
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        </Link>
      </div>

      {/* Low stock alert */}
      {lowStockCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 text-sm">
          <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
          <span className="text-orange-800 dark:text-orange-200">
            <span className="font-semibold">{lowStockCount} item{lowStockCount > 1 ? "s" : ""}</span> below minimum stock level
            {lowStockNames && <span className="text-orange-600 dark:text-orange-400">: {lowStockNames}</span>}
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "TOTAL ITEMS", value: totalItems.toString(), color: "text-gray-900 dark:text-white" },
          { label: "LOW STOCK", value: lowStockCount.toString(), color: lowStockCount > 0 ? "text-orange-600" : "text-gray-900 dark:text-white" },
          { label: "TOTAL STOCK VALUE", value: formatCurrency(totalStockValue), color: "text-gray-900 dark:text-white" },
          { label: "POTENTIAL REVENUE", value: formatCurrency(potentialRevenue), color: "text-gray-900 dark:text-white" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
            <p className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-2">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by name, SKU, HSN..."
          className="pl-9 rounded-xl border-gray-200 dark:border-gray-700"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20">
          <Package className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">No products found</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            {search ? "Try adjusting your search" : "Add your first product to get started"}
          </p>
          {!search && (
            <Link href="/inventory/new">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">Add Item</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-950 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800">
                {["Name", "SKU", "HSN Code", "Stock", "Buy Price", "Sell Price", "GST %", "Margin", ""].map((h) => (
                  <TableHead key={h} className={`font-semibold text-xs uppercase tracking-wide text-gray-500 py-3 ${h === "Buy Price" || h === "Sell Price" || h === "Margin" ? "text-right" : ""}`}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-900/40 border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                  <TableCell className="font-medium text-sm text-gray-900 dark:text-white py-3">{product.name}</TableCell>
                  <TableCell className="text-xs font-mono text-gray-500">{product.sku || "–"}</TableCell>
                  <TableCell className="text-xs font-mono text-gray-500">{(product as any).hsnCode || "–"}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      product.isLowStock
                        ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}>
                      {product.stockQty} {product.unit || "pcs"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm text-gray-700 dark:text-gray-300">{formatCurrency(product.costPrice || 0)}</TableCell>
                  <TableCell className="text-right text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(product.price)}</TableCell>
                  <TableCell className="text-sm text-gray-500">{product.gstRate}%</TableCell>
                  <TableCell className="text-right text-sm font-medium text-emerald-600 dark:text-emerald-400">{margin(product)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/inventory/${product.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-indigo-600">
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => handleDelete(product.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
