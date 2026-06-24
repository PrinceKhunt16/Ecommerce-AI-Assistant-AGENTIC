"use client";

import { useEffect, useState } from "react";
import { Package, Search } from "lucide-react";
import { toast } from "sonner";

import { ApiError, getProduct, getProducts } from "@/lib/api";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

export function ProductsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Derive the category list once from the full catalog.
  useEffect(() => {
    getProducts()
      .then((all) => {
        const cats = Array.from(
          new Set(all.map((p) => p.category).filter(Boolean)),
        ).sort();
        setCategories(cats);
      })
      .catch(() => {
        /* category filter just stays empty */
      });
  }, []);

  // Fetch (debounced) whenever the search query or category changes.
  useEffect(() => {
    let active = true;
    const handle = setTimeout(() => {
      setLoading(true);
      getProducts({
        query: query.trim() || undefined,
        category: category === ALL ? undefined : category,
      })
        .then((res) => {
          if (active) setProducts(res);
        })
        .catch((e) => {
          if (active) {
            setProducts([]);
            toast.error(
              e instanceof ApiError ? e.message : "Could not load products.",
            );
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [query, category]);

  async function openDetail(product: Product) {
    setSelected(product); // optimistic: show what we have from the list
    setDetailLoading(true);
    try {
      const full = await getProduct(product.id);
      setSelected(full);
    } catch {
      // keep the list version
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Products"
        description="Browse the catalog. Search by keyword or filter by category."
      />

      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-6 py-2.5">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="h-8 pl-8"
          />
        </div>
        <Select value={category} onValueChange={(v) => setCategory(v ?? ALL)}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {loading ? (
              <ProductGridSkeleton />
            ) : products.length === 0 ? (
              <p className="pt-16 text-center text-sm text-muted-foreground">
                No products match your search.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {products.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    active={selected?.id === p.id}
                    onClick={() => openDetail(p)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-0">
              {selected ? (
                <ProductDetail product={selected} loading={detailLoading} />
              ) : (
                <div className="flex flex-col items-center gap-2 border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
                  <Package className="size-6" />
                  Select a product to see its details.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductCard({
  product,
  active,
  onClick,
}: {
  product: Product;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col overflow-hidden border bg-card text-left transition-colors hover:border-foreground/30",
        active ? "border-foreground/40" : "border-border",
      )}
    >
      <ProductImage product={product} className="aspect-4/3 w-full" />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium">{product.name}</span>
          <span className="shrink-0 text-sm font-semibold">
            {formatPrice(product.price)}
          </span>
        </div>
        <Badge className="w-fit uppercase border-2">
          {product.category}
        </Badge>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {product.description}
        </p>
      </div>
    </button>
  );
}

function ProductDetail({
  product,
  loading,
}: {
  product: Product;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border border-border bg-card p-4">
      <ProductImage product={product} className="aspect-4/3 w-full" />
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold">{product.name}</h2>
        <span className="shrink-0 text-base font-semibold">
          {formatPrice(product.price)}
        </span>
      </div>
      <Badge className="w-fit uppercase border-2">
        {product.category}
      </Badge>
      <p className="text-sm whitespace-pre-wrap text-muted-foreground">
        {product.description}
      </p>
      <div className="text-[11px] text-muted-foreground">
        {loading ? "Refreshing…" : `ID ${product.id}`}
      </div>
    </div>
  );
}

function ProductImage({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  if (!product.image_url) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          className,
        )}
      >
        <Package className="size-8" />
      </div>
    );
  }
  return (
    // Plain <img>: catalog images come from arbitrary remote hosts, which would
    // otherwise require next/image remotePatterns config.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={product.image_url}
      alt={product.name}
      className={cn("object-cover", className)}
      loading="lazy"
    />
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 border border-border bg-card p-3">
          <Skeleton className="aspect-4/3 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}
