"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  History,
  Loader2,
  LogOut,
  MessagesSquare,
  Package,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { AuthGate } from "@/components/auth/auth-gate";
import { SystemStatus } from "@/components/system-status";

const NAV = [
  { href: "/", label: "Chat", icon: MessagesSquare },
  { href: "/products", label: "Products", icon: ShoppingBag },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/conversations", label: "Conversations", icon: History },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="flex items-center gap-2 border-b border-border px-4 py-4">
          <div className="flex size-7 items-center justify-center bg-primary text-primary-foreground">
            <span className="text-sm font-bold">S</span>
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Support Assistant</div>
            <div className="text-[11px] text-muted-foreground">
              Ecommerce
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 border border-transparent px-3 py-2 text-sm transition-colors",
                  active
                    ? "border-border bg-card font-medium text-foreground"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-2 p-2">
          <SystemStatus />
          <div className="flex items-center justify-between gap-2 border border-border bg-card p-3">
            <div className="min-w-0">
              <div className="truncate text-xs font-medium" title={user.email}>
                {user.name || user.email}
              </div>
              {user.name && (
                <div
                  className="truncate text-[11px] text-muted-foreground"
                  title={user.email}
                >
                  {user.email}
                </div>
              )}
            </div>
            <button
              onClick={logout}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
