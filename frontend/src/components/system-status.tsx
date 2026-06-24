"use client";

import { useEffect, useState } from "react";
import { getReady } from "@/lib/api";
import { cn } from "@/lib/utils";

type State = "loading" | "ready" | "degraded" | "down";

const META: Record<State, { label: string; dot: string }> = {
  loading: { label: "Checking…", dot: "bg-muted-foreground/40" },
  ready: { label: "All systems 🔥", dot: "bg-emerald-500" },
  degraded: { label: "Degraded", dot: "bg-amber-500" },
  down: { label: "Backend offline", dot: "bg-destructive" },
};

export function SystemStatus() {
  const [state, setState] = useState<State>("loading");
  const [checks, setChecks] = useState<{ database?: boolean; redis?: boolean }>(
    {},
  );

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const res = await getReady();
        if (!active) return;
        setState(res.status === "ready" ? "ready" : "degraded");
        setChecks({
          database: Boolean(res.checks?.database),
          redis: Boolean(res.checks?.redis),
        });
      } catch {
        if (!active) return;
        setState("down");
        setChecks({});
      }
    };
    
    check();

    return () => {
      active = false;
    };
  }, []);

  const meta = META[state];

  return (
    <div className="border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className={cn("size-2 shrink-0", meta.dot)} />
        <span className="text-xs font-medium">{meta.label}</span>
      </div>
      {(state === "ready" || state === "degraded") && (
        <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground">
          <span>db {checks.database ? "ok" : "down"}</span>
          <span>redis {checks.redis ? "ok" : "down"}</span>
        </div>
      )}
    </div>
  );
}
