"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { History, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ApiError, getConversation, getConversations } from "@/lib/api";
import type { ConversationRead, ConversationSummary, MessageRead } from "@/lib/types";
import { formatDateTime, shortId } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

const ROLE_STYLES: Record<string, string> = {
  user: "border-border bg-muted text-foreground",
  assistant: "border-border bg-card text-foreground",
  tool: "border-amber-300 bg-amber-50 text-amber-800",
  system: "border-dashed border-border bg-muted/40 text-muted-foreground",
};

function convTitle(c: ConversationSummary): string {
  return c.title?.trim() || `Conversation ${shortId(c.id, 8)}`;
}

export function ConversationsPage() {
  const params = useSearchParams();
  const [list, setList] = useState<ConversationSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationRead | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const appliedQueryId = useRef(false);

  // Load the user's conversation list.
  useEffect(() => {
    let active = true;
    getConversations()
      .then((res) => {
        if (active) setList(res);
      })
      .catch((e) => {
        if (active)
          toast.error(
            e instanceof ApiError
              ? e.message
              : "Could not load your conversations.",
          );
      })
      .finally(() => {
        if (active) setListLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Preselect from ?id= (arriving from the chat page), else the most recent.
  useEffect(() => {
    if (appliedQueryId.current || listLoading) return;
    const queryId = params.get("id");
    const target = queryId ?? list[0]?.id ?? null;
    if (target) {
      appliedQueryId.current = true;
      select(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listLoading, params]);

  async function select(id: string) {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const conv = await getConversation(id);
      setConversation(conv);
    } catch (e) {
      setConversation(null);
      toast.error(
        e instanceof ApiError ? e.message : "Could not load that conversation.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Conversations"
        description="Revisit your past chats with the support assistant."
      />

      <div className="flex min-h-0 flex-1">
        {/* List */}
        <div className="w-72 shrink-0 overflow-y-auto border-r border-border">
          {listLoading ? (
            <div className="flex flex-col gap-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No conversations yet. Start one from the Chat page.
            </p>
          ) : (
            <div className="flex flex-col">
              {list.map((c) => (
                <button
                  key={c.id}
                  onClick={() => select(c.id)}
                  className={cn(
                    "flex flex-col gap-0.5 border-b border-border px-3 py-2.5 text-left transition-colors hover:bg-card/60",
                    selectedId === c.id && "bg-card",
                  )}
                >
                  <span className="truncate text-sm font-medium">
                    {convTitle(c)}
                  </span>
                  {c.created_at && (
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateTime(c.created_at)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="min-w-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-3xl">
            {detailLoading ? (
              <div className="flex items-center gap-2 pt-16 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading…
              </div>
            ) : conversation ? (
              <ConversationView conversation={conversation} />
            ) : (
              <div className="flex flex-col items-center gap-2 pt-16 text-center text-sm text-muted-foreground">
                <History className="size-6" />
                Select a conversation to view its messages.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConversationView({ conversation }: { conversation: ConversationRead }) {
  const messages = conversation.messages ?? [];
  return (
    <div className="flex flex-col gap-5">
      <div className="border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">{convTitle(conversation)}</h2>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>{conversation.id}</span>
          {conversation.created_at && (
            <span>Created {formatDateTime(conversation.created_at)}</span>
          )}
          <span>{messages.length} messages</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages.</p>
        ) : (
          messages.map((m) => <MessageItem key={m.id} message={m} />)
        )}
      </div>
    </div>
  );
}

function MessageItem({ message }: { message: MessageRead }) {
  const style = ROLE_STYLES[message.role] ?? ROLE_STYLES.system;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium uppercase tracking-wide">{message.role}</span>
        {message.timestamp && <span>{formatDateTime(message.timestamp)}</span>}
      </div>
      <div className={cn("border px-3.5 py-2.5 text-sm whitespace-pre-wrap", style)}>
        {message.content}
      </div>
    </div>
  );
}
