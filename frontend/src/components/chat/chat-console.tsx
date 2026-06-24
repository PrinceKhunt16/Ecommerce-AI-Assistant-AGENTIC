"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bot,
  ChevronDown,
  Copy,
  Plus,
  Send,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { ChatSocket } from "@/lib/chat-socket";
import { shortId } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Markdown } from "@/components/chat/markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface ToolStep {
  id: string;
  name: string;
  args?: unknown;
  result?: unknown;
  done: boolean;
}

interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  tools?: ToolStep[];
  toolsUsed?: string[];
  streaming?: boolean;
}

const SUGGESTIONS = [
  "Where are my orders and what's the tracking?",
  "How long do refunds take?",
  "Do you ship internationally?",
  "Show me wireless headphones.",
];

const rid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

function preview(value: unknown, max = 280): string {
  if (value == null) return "";
  const s = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function ChatConsole() {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // One socket is kept open across turns; opened lazily on the first send.
  const socketRef = useRef<ChatSocket | null>(null);
  const getSocket = () => (socketRef.current ??= new ChatSocket());
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => () => socketRef.current?.close(), []);

  const newConversation = () => {
    // Abort a turn in flight by dropping the socket; the next send reconnects.
    if (sending) socketRef.current?.close();
    setMessages([]);
    setConversationId(null);
    setSending(false);
  };

  // Update the in-flight assistant turn.
  const patchAssistant = (id: string, fn: (t: ChatTurn) => ChatTurn) =>
    setMessages((m) => m.map((msg) => (msg.id === id ? fn(msg) : msg)));

  async function handleSend(text?: string) {
    const value = (text ?? input).trim();
    if (!value || sending) return;

    setMessages((m) => [
      ...m,
      { id: rid(), role: "user", content: value },
    ]);
    setInput("");
    setSending(true);

    const assistantId = rid();
    setMessages((m) => [
      ...m,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        thinking: "",
        tools: [],
        streaming: true,
      },
    ]);

    try {
      await getSocket().send(
        { message: value, conversation_id: conversationId },
        {
          onThinking: (t) =>
            patchAssistant(assistantId, (msg) => ({
              ...msg,
              thinking: (msg.thinking ?? "") + t,
            })),
          onToolCall: (name, args) =>
            patchAssistant(assistantId, (msg) => ({
              ...msg,
              tools: [
                ...(msg.tools ?? []),
                { id: rid(), name, args, done: false },
              ],
            })),
          onToolResult: (name, data) =>
            patchAssistant(assistantId, (msg) => {
              const tools = [...(msg.tools ?? [])];
              // Attach to the latest pending call of the same name.
              for (let i = tools.length - 1; i >= 0; i--) {
                if (tools[i].name === name && !tools[i].done) {
                  tools[i] = { ...tools[i], result: data, done: true };
                  return { ...msg, tools };
                }
              }
              return {
                ...msg,
                tools: [...tools, { id: rid(), name, result: data, done: true }],
              };
            }),
          onToken: (t) =>
            patchAssistant(assistantId, (msg) => ({
              ...msg,
              content: msg.content + t,
            })),
          onDone: (convId) => {
            if (convId) setConversationId(convId);
            patchAssistant(assistantId, (msg) => ({
              ...msg,
              streaming: false,
            }));
          },
          onError: (message) => {
            toast.error(message || "Could not reach the agent.");
            // Drop an empty assistant bubble, otherwise stop its spinner.
            setMessages((m) =>
              m.flatMap((t) => {
                if (t.id !== assistantId) return [t];
                const hasContent = t.content || (t.tools && t.tools.length);
                return hasContent ? [{ ...t, streaming: false }] : [];
              }),
            );
          },
        },
      );
    } finally {
      setSending(false);
    }
  }

  const copyConv = () => {
    if (!conversationId) return;
    navigator.clipboard?.writeText(conversationId);
    toast.success("Conversation ID copied");
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Chat"
        description="Ask about products, your orders, shipping, and returns."
        actions={
          <>
            {conversationId && (
              <div className="flex items-center gap-1 border border-border bg-card px-2 py-1 text-xs text-muted-foreground">
                <span title={conversationId}>{shortId(conversationId, 8)}</span>
                <button
                  onClick={copyConv}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Copy conversation ID"
                >
                  <Copy className="size-3" />
                </button>
                <Link
                  href={`/conversations?id=${conversationId}`}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Open conversation history"
                >
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={newConversation}>
              <Plus className="size-3.5" />
              New
            </Button>
          </>
        }
      />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-4 pt-16 text-center">
            <div className="flex size-12 items-center justify-center border border-border bg-card">
              <Bot className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Start a conversation</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The assistant can search the catalog, look up your orders, and
                answer shipping &amp; returns questions.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {messages.map((msg) =>
              msg.role === "user" ? (
                <UserRow key={msg.id} content={msg.content} />
              ) : (
                <AssistantRow key={msg.id} turn={msg} />
              ),
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-card px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
              rows={2}
              className="min-h-11 flex-1 resize-none"
            />
            <Button
              onClick={() => handleSend()}
              disabled={sending || !input.trim()}
              size="lg"
              className="h-11"
            >
              <Send className="size-4" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserRow({ content }: { content: string }) {
  return (
    <div className="flex flex-row-reverse gap-3">
      <div className="flex size-7 shrink-0 items-center justify-center border border-border bg-muted text-foreground">
        <UserRound className="size-3.5" />
      </div>
      <div className="flex max-w-[80%] flex-col items-end gap-1.5">
        <div className="border border-border bg-muted px-3.5 py-2 text-sm whitespace-pre-wrap">
          {content}
        </div>
      </div>
    </div>
  );
}

function AssistantRow({ turn }: { turn: ChatTurn }) {
  const steps = turn.tools ?? [];
  const hasTrace = Boolean(turn.thinking?.trim()) || steps.length > 0;
  // Show the agent's work while it's running and before the answer arrives.
  const [open, setOpen] = useState(turn.streaming && !turn.content);

  return (
    <div className="flex gap-3">
      <div className="flex size-7 shrink-0 items-center justify-center border border-border bg-primary text-primary-foreground">
        <Bot className="size-3.5" />
      </div>
      <div className="flex max-w-[80%] flex-col gap-1.5">
        {hasTrace && (
          <div className="border border-border bg-muted/40">
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Sparkles className="size-3.5" />
              <span className="font-medium">Agent steps</span>
              {steps.length > 0 && (
                <span className="text-muted-foreground">
                  · {steps.length} tool{steps.length > 1 ? "s" : ""}
                </span>
              )}
              <ChevronDown
                className={cn(
                  "ml-auto size-3.5 transition-transform",
                  open && "rotate-180",
                )}
              />
            </button>
            {open && (
              <div className="flex flex-col gap-2 border-t border-border px-3 py-2">
                {turn.thinking?.trim() && (
                  <p className="text-xs whitespace-pre-wrap text-muted-foreground">
                    {turn.thinking}
                  </p>
                )}
                {steps.map((step) => (
                  <ToolStepView key={step.id} step={step} />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="border border-border bg-card px-3.5 py-2 text-sm">
          {turn.content ? (
            <Markdown>{turn.content}</Markdown>
          ) : (
            <span className="inline-block h-4 w-1.5 animate-pulse bg-foreground/60 align-middle" />
          )}
          {turn.streaming && turn.content && (
            <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-foreground/60 align-middle" />
          )}
        </div>

        {turn.toolsUsed && turn.toolsUsed.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {turn.toolsUsed.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolStepView({ step }: { step: ToolStep }) {
  return (
    <div className="border border-border bg-card">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs">
        <Wrench className="size-3 text-muted-foreground" />
        <span className="font-medium">{step.name}</span>
        {!step.done && (
          <span className="ml-auto text-muted-foreground">running…</span>
        )}
      </div>
      {step.args != null && preview(step.args) !== "" && (
        <pre className="overflow-x-auto border-t border-border px-2.5 py-1.5 font-sans text-[11px] text-muted-foreground whitespace-pre-wrap">
          {preview(step.args)}
        </pre>
      )}
      {step.done && step.result != null && (
        <pre className="overflow-x-auto border-t border-border px-2.5 py-1.5 font-sans text-[11px] text-muted-foreground whitespace-pre-wrap">
          {preview(step.result)}
        </pre>
      )}
    </div>
  );
}
