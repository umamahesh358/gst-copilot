import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, FileText, Users, Package, Truck, Loader2, X } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface SearchResults {
  invoices: Array<{ id: number; invoiceNumber: string; customerName: string; status: string; totalAmount: string }>;
  customers: Array<{ id: number; name: string; email: string; phone: string }>;
  products: Array<{ id: number; name: string; sku: string; category: string; stockQty: number }>;
  vendors: Array<{ id: number; name: string; email: string; contactPerson: string }>;
}

const EMPTY: SearchResults = { invoices: [], customers: [], products: [], vendors: [] };

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  const debouncedQuery = useDebounce(query, 300);

  // Build flat list of all results for keyboard nav
  const flat: Array<{ type: string; id: number; label: string; sub: string; path: string }> = [
    ...results.invoices.map(i => ({
      type: "invoice", id: i.id,
      label: i.invoiceNumber,
      sub: `${i.customerName} · ₹${Number(i.totalAmount).toLocaleString("en-IN")}`,
      path: `/invoices/${i.id}`,
    })),
    ...results.customers.map(c => ({
      type: "customer", id: c.id,
      label: c.name,
      sub: c.email || c.phone || "",
      path: `/customers`,
    })),
    ...results.products.map(p => ({
      type: "product", id: p.id,
      label: p.name,
      sub: [p.sku, p.category].filter(Boolean).join(" · "),
      path: `/inventory`,
    })),
    ...results.vendors.map(v => ({
      type: "vendor", id: v.id,
      label: v.name,
      sub: v.contactPerson || v.email || "",
      path: `/vendors`,
    })),
  ];

  const totalResults = flat.length;
  const hasResults = totalResults > 0;

  // Fetch results when query changes
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults(EMPTY);
      setOpen(false);
      return;
    }
    setLoading(true);
    setOpen(true);
    customFetch<SearchResults>(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(data => { setResults(data); setFocusIdx(-1); })
      .catch(() => setResults(EMPTY))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  // Click outside to close
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = useCallback((path: string) => {
    navigate(path);
    setQuery("");
    setOpen(false);
    setResults(EMPTY);
    inputRef.current?.blur();
  }, [navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx(i => Math.min(i + 1, totalResults - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx(i => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && focusIdx >= 0 && flat[focusIdx]) {
      e.preventDefault();
      handleSelect(flat[focusIdx].path);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    }
  };

  const iconMap: Record<string, React.ElementType> = {
    invoice: FileText,
    customer: Users,
    product: Package,
    vendor: Truck,
  };

  const sectionLabel: Record<string, string> = {
    invoice: "Invoices",
    customer: "Customers",
    product: "Products",
    vendor: "Vendors",
  };

  // Group flat list into sections for rendering
  type Section = { type: string; items: typeof flat };
  const sections: Section[] = [];
  for (const item of flat) {
    const last = sections[sections.length - 1];
    if (!last || last.type !== item.type) sections.push({ type: item.type, items: [item] });
    else last.items.push(item);
  }

  let globalIdx = -1;

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Search anywhere..."
          className="w-full h-9 bg-muted/50 pl-9 pr-8 text-sm rounded-md border-none ring-1 ring-transparent focus:ring-1 focus:ring-primary outline-none transition-all"
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (debouncedQuery.length >= 2) setOpen(true); }}
          onKeyDown={handleKeyDown}
        />
        {/* Clear button */}
        {query && (
          <button
            className="absolute right-2 top-2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => { setQuery(""); setOpen(false); setResults(EMPTY); }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-10 left-0 w-full min-w-[320px] bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </div>
          )}

          {/* No results */}
          {!loading && !hasResults && debouncedQuery.length >= 2 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No results for <span className="font-medium text-foreground">"{debouncedQuery}"</span>
            </div>
          )}

          {/* Results */}
          {!loading && hasResults && (
            <div className="max-h-[400px] overflow-y-auto py-2">
              {sections.map(section => {
                const Icon = iconMap[section.type];
                return (
                  <div key={section.type}>
                    {/* Section header */}
                    <div className="px-3 pt-3 pb-1 flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {sectionLabel[section.type]}
                      </span>
                    </div>
                    {section.items.map(item => {
                      globalIdx++;
                      const idx = globalIdx;
                      const isFocused = focusIdx === idx;
                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          className={cn(
                            "w-full text-left px-4 py-2 flex items-start gap-3 hover:bg-muted/60 transition-colors",
                            isFocused && "bg-muted/60"
                          )}
                          onMouseEnter={() => setFocusIdx(idx)}
                          onClick={() => handleSelect(item.path)}
                        >
                          <Icon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{item.label}</p>
                            {item.sub && (
                              <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              <div className="px-4 py-2 border-t border-border mt-1">
                <p className="text-xs text-muted-foreground">
                  ↑↓ Navigate · Enter Select · Esc Close
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
