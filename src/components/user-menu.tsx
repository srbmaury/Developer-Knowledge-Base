"use client";

import { LogOut, User } from "lucide-react";
import { signOutAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";

type UserMenuProps = {
  email: string | null;
};

export function UserMenu({ email }: UserMenuProps) {
  const displayEmail = email ?? "Signed in";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full justify-start gap-2" variant="ghost">
          <User className="h-4 w-4 shrink-0" />
          <span className="truncate text-left text-sm">{displayEmail}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogTitle>Account</DialogTitle>
        <DialogDescription>Signed in as {displayEmail}</DialogDescription>
        <p className="text-sm text-muted-foreground">
          Your categories, questions, and approaches are private to this account.
        </p>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" className="w-full gap-2">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
