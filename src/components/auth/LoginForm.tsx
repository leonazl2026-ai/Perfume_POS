"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/actions/auth";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await login(username, password);

      if (!result.ok) {
        setError(result.error);
        setPassword("");
        return;
      }

      // Only allow same-site paths — never an attacker-supplied absolute URL.
      const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/admin";
      router.replace(destination);
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <label className="mb-3 block">
        <span className="mb-1 block text-[11px] font-medium text-gray-600">Username</span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          disabled={isPending}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-900 disabled:bg-gray-50"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-gray-600">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          disabled={isPending}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-900 disabled:bg-gray-50"
        />
      </label>

      <button
        type="submit"
        disabled={isPending || username.length === 0 || password.length === 0}
        className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
