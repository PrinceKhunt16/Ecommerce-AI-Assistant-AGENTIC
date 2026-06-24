"use client";

import { useEffect, useState } from "react";
import { Copy, Package, Truck } from "lucide-react";
import { toast } from "sonner";

import { ApiError, getOrder, getOrders } from "@/lib/api";
import type { Order } from "@/lib/types";
import { formatDateTime, shortId } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { OrderStatusPill } from "@/components/orders/order-status";

function productLabel(order: Order): string {
  return order.product?.name ?? order.product_name ?? `Product ${shortId(order.product_id)}`;
}

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let active = true;
    getOrders()
      .then((res) => {
        if (!active) return;
        setOrders(res);
        setSelected(res[0] ?? null);
      })
      .catch((e) => {
        if (active)
          toast.error(
            e instanceof ApiError ? e.message : "Could not load your orders.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function openDetail(order: Order) {
    setSelected(order);
    setDetailLoading(true);
    try {
      const full = await getOrder(order.id);
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
        title="Orders"
        description="Your orders, their status, and tracking numbers."
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            {loading ? (
              <OrdersSkeleton />
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center gap-2 pt-16 text-center text-sm text-muted-foreground">
                <Package className="size-6" />
                You don&apos;t have any orders yet.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {orders.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => openDetail(o)}
                    className={cn(
                      "flex flex-col gap-1.5 border bg-card p-3 text-left transition-colors hover:border-foreground/30",
                      selected?.id === o.id
                        ? "border-foreground/40"
                        : "border-border",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {productLabel(o)}
                      </span>
                      <OrderStatusPill status={o.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>#{shortId(o.id, 8)}</span>
                      {o.tracking_number && (
                        <span className="inline-flex items-center gap-1">
                          <Truck className="size-3" />
                          {o.tracking_number}
                        </span>
                      )}
                      {o.created_at && <span>{formatDateTime(o.created_at)}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-0">
              {selected ? (
                <OrderDetail order={selected} loading={detailLoading} />
              ) : (
                <div className="flex flex-col items-center gap-2 border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
                  <Package className="size-6" />
                  Select an order to see its details.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderDetail({ order, loading }: { order: Order; loading: boolean }) {
  const copy = (value: string, label: string) => {
    navigator.clipboard?.writeText(value);
    toast.success(`${label} copied`);
  };

  return (
    <div className="flex flex-col gap-3 border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold">{productLabel(order)}</h2>
        <OrderStatusPill status={order.status} />
      </div>

      <Separator />

      <Row label="Order">
        <button
          onClick={() => copy(order.id, "Order ID")}
          className="inline-flex items-center gap-1 hover:text-foreground"
          title={order.id}
        >
          {shortId(order.id, 12)}
          <Copy className="size-3" />
        </button>
      </Row>
      <Row label="Tracking">
        {order.tracking_number ? (
          <span className="inline-flex items-center gap-1">
            <Truck className="size-3.5" />
            {order.tracking_number}
          </span>
        ) : (
          <span className="text-muted-foreground">Not assigned yet</span>
        )}
      </Row>
      {order.product?.description && (
        <Row label="Product">
          <span className="text-muted-foreground">
            {order.product.description}
          </span>
        </Row>
      )}
      {order.created_at && (
        <Row label="Placed">{formatDateTime(order.created_at)}</Row>
      )}
      {order.updated_at && (
        <Row label="Updated">{formatDateTime(order.updated_at)}</Row>
      )}

      {loading && (
        <div className="text-[11px] text-muted-foreground">Refreshing…</div>
      )}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[5rem_1fr] items-baseline gap-2 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 border border-border bg-card p-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
