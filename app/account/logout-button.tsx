"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  async function logOut() {
    setIsPending(true);
    setError("");

    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError(result.error.message || "We couldn't log you out.");
        setIsPending(false);
        return;
      }

      router.replace("/login");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We couldn't log you out. Please try again.",
      );
      setIsPending(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        className="text-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
        disabled={isPending}
        onClick={logOut}
        type="button"
      >
        {isPending ? "Logging out..." : "Log out"}
      </button>
      {error ? (
        <p className="mt-2 text-sm text-danger-foreground" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
