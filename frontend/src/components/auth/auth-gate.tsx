"use client";

import { useState } from "react";
import { Bot, Loader2, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Mode = "login" | "register";

export function AuthGate() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Email and password are required.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        await login({ email: email.trim(), password });
      } else {
        await register({
          email: email.trim(),
          name: name.trim() || undefined,
          password,
        });
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Could not reach the server. Is the backend running?",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center bg-primary text-primary-foreground">
            <Bot className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Support Assistant</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to chat, track orders, and browse the catalog.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Use your email and password."
                : "Register with an email and password to get started."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="mb-4 w-full">
                <TabsTrigger value="login">Sign in</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <form onSubmit={submit} className="flex flex-col gap-4">
                <TabsContent value="register" className="m-0 p-0">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="name">Name (optional)</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Shopper"
                      autoComplete="name"
                    />
                  </div>
                </TabsContent>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                  />
                </div>

                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : mode === "login" ? (
                    <LogIn className="size-4" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                  {mode === "login" ? "Sign in" : "Create account"}
                </Button>
              </form>
            </Tabs>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Demo account: <span>demo@example.com</span> /{" "}
          <span>demo1234</span>
        </p>
      </div>
    </div>
  );
}
