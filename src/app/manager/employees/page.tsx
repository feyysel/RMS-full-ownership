"use client";

import * as React from "react";
import { Plus, Trash2, ChefHat, UtensilsCrossed, KeyRound, Users, Banknote } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Skeleton, Avatar } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useFetch } from "@/lib/use-fetch";
import { useRealtime } from "@/components/realtime/use-realtime";
import { useDebouncedCallback } from "@/lib/use-debounced";

type Employee = {
  id: string;
  name: string;
  phone: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

export default function ManagerEmployees() {
  const { data, loading, refresh } = useFetch<{ users: Employee[] }>("/api/users");
  const [isOwner, setIsOwner] = React.useState(false);
  const [restaurantId, setRestaurantId] = React.useState<string | null>(null);
  const refreshDebounced = useDebouncedCallback(refresh, 500);

  useRealtime(restaurantId ? [{ scope: "restaurant", id: restaurantId }] : [], () => refreshDebounced());

  React.useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        setIsOwner(d.user?.role === "OWNER");
        setRestaurantId(d.user?.restaurantId ?? null);
      })
      .catch(() => {});
  }, []);

  const [modal, setModal] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState("WAITER");
  const [passwordModal, setPasswordModal] = React.useState<Employee | null>(null);
  const [newPassword, setNewPassword] = React.useState("");
  const [deleting, setDeleting] = React.useState<Employee | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, password, role }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      toast.success("Employee added");
      setModal(false);
      setName("");
      setPhone("");
      setPassword("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: Employee) {
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(u.isActive ? "Deactivated" : "Activated");
      refresh();
    } catch {
      toast.error("Failed to update");
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordModal || newPassword.length < 6) return;
    try {
      const res = await fetch(`/api/users/${passwordModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Password updated");
      setPasswordModal(null);
      setNewPassword("");
    } catch {
      toast.error("Failed to update password");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      const res = await fetch(`/api/users/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Employee removed");
      setDeleting(null);
      refresh();
    } catch {
      toast.error("Failed to delete");
    }
  }

  const managers = data?.users.filter((u) => u.role === "MANAGER") ?? [];
  const waiters = data?.users.filter((u) => u.role === "WAITER") ?? [];
  const cashiers = data?.users.filter((u) => u.role === "CASHIER") ?? [];
  const kitchen = data?.users.filter((u) => u.role === "KITCHEN") ?? [];

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Build your waitstaff and kitchen crew."
        action={
          <Button onClick={() => setModal(true)}>
            <Plus className="h-4 w-4" /> Add employee
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {isOwner && (
          <StaffGroup
            title="Managers"
            icon={<Users className="h-4 w-4 text-gold-dark dark:text-gold-light" />}
            loading={loading}
            users={managers}
            tone="gold"
            onToggle={toggleActive}
            onResetPassword={setPasswordModal}
            onDelete={setDeleting}
          />
        )}
        <StaffGroup
          title="Waiters"
          icon={<UtensilsCrossed className="h-4 w-4 text-gold-dark dark:text-gold-light" />}
          loading={loading}
          users={waiters}
          tone="emerald"
          onToggle={toggleActive}
          onResetPassword={setPasswordModal}
          onDelete={setDeleting}
        />
        <StaffGroup
          title="Cashiers"
          icon={<Banknote className="h-4 w-4 text-gold-dark dark:text-gold-light" />}
          loading={loading}
          users={cashiers}
          tone="gold"
          onToggle={toggleActive}
          onResetPassword={setPasswordModal}
          onDelete={setDeleting}
        />
        <StaffGroup
          title="Kitchen"
          icon={<ChefHat className="h-4 w-4 text-violet-700 dark:text-violet-300" />}
          loading={loading}
          users={kitchen}
          tone="violet"
          onToggle={toggleActive}
          onResetPassword={setPasswordModal}
          onDelete={setDeleting}
        />
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Add employee"
        description="Create staff accounts — waiters, kitchen, or managers (owner only)."
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="e-name">Full name</Label>
              <Input id="e-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Lee" />
            </div>
            <div>
              <Label htmlFor="e-phone">Phone number</Label>
              <Input id="e-phone" type="tel" inputMode="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0982101908" />
            </div>
          </div>
          <div>
            <Label htmlFor="e-password">Temporary password</Label>
            <Input id="e-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min. 6 characters" />
          </div>
          <div>
            <Label htmlFor="e-role">Role</Label>
            <Select id="e-role" value={role} onChange={(e) => setRole(e.target.value)}>
              {isOwner && <option value="MANAGER">Manager</option>}
              <option value="WAITER">Waiter</option>
              <option value="CASHIER">Cashier</option>
              <option value="KITCHEN">Kitchen</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Adding…" : "Add employee"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={passwordModal !== null}
        onClose={() => setPasswordModal(null)}
        title={`Reset password · ${passwordModal?.name ?? ""}`}
      >
        <form onSubmit={savePassword} className="space-y-4">
          <div>
            <Label htmlFor="ep">New password</Label>
            <Input id="ep" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="min. 6 characters" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setPasswordModal(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={newPassword.length < 6}>
              Update
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Remove employee?"
        description={`This permanently deletes "${deleting?.name}".`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete}>
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function StaffGroup({
  title,
  icon,
  loading,
  users,
  tone,
  onToggle,
  onResetPassword,
  onDelete,
}: {
  title: string;
  icon: React.ReactNode;
  loading: boolean;
  users: Employee[];
  tone: "emerald" | "violet" | "gold";
  onToggle: (u: Employee) => void;
  onResetPassword: (u: Employee) => void;
  onDelete: (u: Employee) => void;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h3 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
        <Badge tone={tone} className="ml-auto">
          {users.length}
        </Badge>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-100 px-3.5 py-3 dark:border-white/[0.05] dark:bg-white/[0.02]"
            >
              <Avatar name={u.name} className="h-9 w-9 text-xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{u.name}</p>
                <p className="truncate text-xs text-zinc-500">{u.phone}</p>
              </div>
              {!u.isActive && <Badge tone="rose">Inactive</Badge>}
              <button
                onClick={() => onResetPassword(u)}
                className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-gold-dark dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-gold-light"
                title="Reset password"
              >
                <KeyRound className="h-4 w-4" />
              </button>
              <Switch checked={u.isActive} onCheckedChange={() => onToggle(u)} />
              <button
                onClick={() => onDelete(u)}
                className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-rose-700 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-rose-300"
                title="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {users.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-500">No {title.toLowerCase()} yet</p>
          )}
        </div>
      )}
    </Card>
  );
}
