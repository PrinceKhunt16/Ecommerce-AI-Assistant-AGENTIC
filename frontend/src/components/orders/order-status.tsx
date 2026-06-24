import type { OrderStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "border-amber-300 bg-amber-50 text-amber-700 uppercase",
  processing: "border-blue-300 bg-blue-50 text-blue-700 uppercase",
  shipped: "border-violet-300 bg-violet-50 text-violet-700 uppercase",
  delivered: "border-emerald-300 bg-emerald-50 text-emerald-700 uppercase",
  cancelled: "border-rose-300 bg-rose-50 text-rose-700 uppercase",
};

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("capitalize", STATUS_STYLES[status] ?? "")}
    >
      {status}
    </Badge>
  );
}
