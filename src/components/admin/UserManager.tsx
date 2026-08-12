"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteUser, setUserActive, upsertUser } from "@/actions/users";
import { formatDate } from "@/lib/dateRange";
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  PERMISSION_DESCRIPTIONS,
  PERMISSION_PRESETS,
  PERMISSIONS,
  ROLES,
  type Permission,
} from "@/lib/permissions";
import { Modal } from "@/components/ui/Modal";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import type { UserRow } from "@/types/users";

interface FormState {
  id?: string;
  name: string;
  username: string;
  password: string;
  role: string;
  permissions: Permission[];
}

const BLANK: FormState = {
  name: "",
  username: "",
  password: "",
  role: "STAFF",
  permissions: ["POS_ACCESS"],
};

export function UserManager({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isPending, startTransition] = useTransition();

  const notify = (kind: ToastMessage["kind"], text: string) =>
    setToast({ id: Date.now(), kind, text });

  const openForm = (user?: UserRow) => {
    setError(null);
    setForm(
      user
        ? {
            id: user.id,
            name: user.name,
            username: user.username,
            password: "",
            role: user.role,
            permissions: user.permissions,
          }
        : BLANK
    );
  };

  const toggle = (permission: Permission) => {
    setForm((current) =>
      current
        ? {
            ...current,
            permissions: current.permissions.includes(permission)
              ? current.permissions.filter((p) => p !== permission)
              : [...current.permissions, permission],
            // Hand-editing the list means it is no longer a named role.
            role: current.role === "ADMIN" ? "ADMIN" : "CUSTOM",
          }
        : current
    );
  };

  const save = () => {
    if (!form) return;
    setError(null);

    startTransition(async () => {
      const result = await upsertUser(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      notify("success", form.id ? "Account updated." : "Account created.");
      setForm(null);
      router.refresh();
    });
  };

  const toggleActive = (user: UserRow) => {
    startTransition(async () => {
      const result = await setUserActive(user.id, !user.isActive);
      if (!result.ok) {
        notify("error", result.error);
        return;
      }
      notify("success", user.isActive ? "Account deactivated." : "Account restored.");
      router.refresh();
    });
  };

  const remove = (user: UserRow) => {
    startTransition(async () => {
      const result = await deleteUser(user.id);
      notify(result.ok ? "success" : "error", result.ok ? "Account deleted." : result.error);
      if (result.ok) router.refresh();
    });
  };

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500">
            {users.length} account{users.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => openForm()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          + Add New User
        </button>
      </header>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Username</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 text-right font-medium">Permissions</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                  No accounts yet.
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const isSelf = user.id === currentUserId;
                const count =
                  user.role === "ADMIN" ? PERMISSIONS.length : user.permissions.length;

                return (
                  <tr key={user.id} className={user.isActive ? "" : "bg-gray-50/60"}>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{user.name}</span>
                      {isSelf && (
                        <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                          you
                        </span>
                      )}
                      <span className="block text-[11px] text-gray-400">
                        Added {formatDate(new Date(user.createdAt))}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {user.username}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          user.role === "ADMIN"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {user.role === "ADMIN" ? "All" : `${count} of ${PERMISSIONS.length}`}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          user.isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2 text-xs font-medium">
                        <button
                          type="button"
                          onClick={() => openForm(user)}
                          className="text-gray-600 transition hover:text-gray-900"
                        >
                          Edit
                        </button>
                        {!isSelf && (
                          <>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => toggleActive(user)}
                              className="text-gray-500 transition hover:text-gray-900 disabled:opacity-50"
                            >
                              {user.isActive ? "Deactivate" : "Restore"}
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => remove(user)}
                              className="text-gray-400 transition hover:text-red-600 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? `Edit ${form.name || "account"}` : "Add new user"}
        subtitle="Permissions decide which pages and actions this account can reach."
        widthClass="max-w-3xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setForm(null)}
              disabled={isPending}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-900 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:bg-gray-300"
            >
              {isPending ? "Saving…" : "Save account"}
            </button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Name">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Username">
                <input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  autoCapitalize="none"
                  spellCheck={false}
                  className={`${inputClass} font-mono`}
                />
              </Field>
              <Field
                label="Password"
                hint={form.id ? "Leave blank to keep the current one" : "At least 8 characters"}
              >
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="new-password"
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Role" hint="ADMIN always has every permission.">
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className={`${inputClass} sm:w-48`}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </Field>

            {/* Presets */}
            <div>
              <span className="mb-1.5 block text-[11px] font-medium text-gray-600">
                Quick presets
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PERMISSION_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        permissions: [...preset.permissions],
                        role: form.role === "ADMIN" ? "ADMIN" : "CUSTOM",
                      })
                    }
                    className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:border-gray-900 hover:text-gray-900"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Permission grid */}
            <div
              className={`space-y-3 ${form.role === "ADMIN" ? "pointer-events-none opacity-50" : ""}`}
            >
              {form.role === "ADMIN" && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Administrators hold every permission — this list is ignored for them.
                </p>
              )}

              {PERMISSION_GROUPS.map((group) => (
                <fieldset key={group.title}>
                  <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {group.title}
                  </legend>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {group.permissions.map((permission) => (
                      <label
                        key={permission}
                        className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 px-2.5 py-2 transition hover:border-gray-400"
                      >
                        <input
                          type="checkbox"
                          checked={form.permissions.includes(permission)}
                          onChange={() => toggle(permission)}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300"
                        />
                        <span className="min-w-0">
                          <span className="block text-xs font-medium text-gray-900">
                            {PERMISSION_LABELS[permission]}
                          </span>
                          <span className="block text-[11px] leading-snug text-gray-500">
                            {PERMISSION_DESCRIPTIONS[permission]}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none transition focus:border-gray-900";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-gray-600">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-[11px] text-gray-400">{hint}</span>}
    </label>
  );
}
