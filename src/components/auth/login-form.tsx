"use client";

import { useActionState, useState } from "react";
import { signInAction, signUpAction, type AuthActionState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const initialState: AuthActionState = { ok: true };

export function LoginForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [signInState, signInFormAction, signInPending] = useActionState(signInAction, initialState);
  const [signUpState, signUpFormAction, signUpPending] = useActionState(signUpAction, initialState);

  const state = mode === "sign-in" ? signInState : signUpState;
  const pending = signInPending || signUpPending;

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-foreground text-background">
          <span className="text-lg font-bold">DK</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Developer Knowledge Base</h1>
        <p className="text-sm text-muted-foreground">Sign in to access your personal notes and interview prep.</p>
      </div>

      <div className="flex rounded-lg border bg-muted/40 p-1">
        <button
          type="button"
          className={cn(
            "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
            mode === "sign-in" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setMode("sign-in")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
            mode === "sign-up" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setMode("sign-up")}
        >
          Create account
        </button>
      </div>

      <form
        key={mode}
        action={mode === "sign-in" ? signInFormAction : signUpFormAction}
        className="space-y-4 rounded-xl border bg-card p-6 shadow-sm"
      >
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            required
            minLength={mode === "sign-up" ? 8 : 1}
            placeholder={mode === "sign-up" ? "At least 8 characters" : "Your password"}
          />
        </div>

        {state.message ? <p className="text-sm text-destructive">{state.message}</p> : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>
      </form>

      {mode === "sign-up" ? (
        <p className="text-center text-xs text-muted-foreground">
          If email confirmation is enabled in Supabase, check your inbox before signing in.
        </p>
      ) : null}
    </div>
  );
}
