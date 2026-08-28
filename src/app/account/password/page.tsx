"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useHome } from "../home-context";

export default function ChangePasswordPage() {
  const router = useRouter();
  const home = useHome();
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not change your password");
        return;
      }
      toast.success("Password updated successfully");
      setDone(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("Something went wrong, please try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Change password"
        description="Keep your account secure with a strong, unique password."
      />

      <Card className="p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold/10 text-gold-dark dark:text-gold-light ring-1 ring-gold/25">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Account security</p>
            <p className="text-xs text-zinc-500">
              Enter your current password to confirm it&apos;s you.
            </p>
          </div>
        </div>

        {done ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 className="mb-3 h-12 w-12 text-emerald-400" />
            <p className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Password changed
            </p>
            <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              Your new password is active. Use it next time you sign in.
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => setDone(false)}>
                Change again
              </Button>
              <Button onClick={() => router.push(home)}>Back to workspace</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div>
              <Label htmlFor="current-password">Current password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={show ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Your current password"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={show ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={show ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your new password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-800 dark:hover:text-zinc-200"
                    title={show ? "Hide passwords" : "Show passwords"}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-100 dark:bg-white/[0.03] p-3 text-xs text-zinc-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold-dark dark:text-gold-light" />
              <span>
                After you change your password, you&apos;ll use the new one to sign in.
                The rest of your account stays unchanged.
              </span>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push(home)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                Update password
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
