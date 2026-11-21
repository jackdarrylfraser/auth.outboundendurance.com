"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth/client";

type SignInFormProps = {
  returnUrl: string | null;
};

export function SignInForm({ returnUrl }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"email" | "otp" | "complete">("email");
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function sendCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError("");
    setMessage("");
    setIsPending(true);

    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim(),
        type: "sign-in",
      });

      if (result.error) {
        setError(result.error.message || "We couldn't send your code.");
        return;
      }

      setStage("otp");
      setMessage("Check your email for a six-digit sign-in code.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We couldn't send your code. Please try again.",
      );
    } finally {
      setIsPending(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsPending(true);

    try {
      const result = await authClient.signIn.emailOtp({
        email: email.trim(),
        otp,
      });

      if (result.error) {
        setError(result.error.message || "That code could not be verified.");
        return;
      }

      if (returnUrl) {
        const accountUrl = new URL("/account", window.location.origin);
        accountUrl.searchParams.set("returnTo", returnUrl);
        window.location.assign(accountUrl.href);
        return;
      }

      setStage("complete");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We couldn't verify your code. Please try again.",
      );
    } finally {
      setIsPending(false);
    }
  }

  const inputClassName =
    "mt-2 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-950 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:bg-zinc-100";
  const buttonClassName =
    "flex w-full items-center justify-center rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      {stage === "complete" ? (
        <div className="py-4 text-center" role="status">
          <h2 className="text-lg font-semibold text-zinc-950">
            You&apos;re signed in
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Your email has been verified and your session is ready.
          </p>
        </div>
      ) : stage === "email" ? (
        <form onSubmit={sendCode}>
          <label
            className="block text-sm font-medium text-zinc-800"
            htmlFor="email"
          >
            Email address
          </label>
          <input
            autoComplete="email"
            className={inputClassName}
            disabled={isPending}
            id="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          <button className={`${buttonClassName} mt-5`} disabled={isPending}>
            {isPending ? "Sending code..." : "Continue with email"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode}>
          <p className="text-sm leading-6 text-zinc-600">
            Enter the code sent to{" "}
            <span className="font-medium text-zinc-900">{email}</span>.
          </p>
          <label
            className="mt-5 block text-sm font-medium text-zinc-800"
            htmlFor="otp"
          >
            Six-digit code
          </label>
          <input
            autoComplete="one-time-code"
            className={`${inputClassName} text-center tracking-[0.35em]`}
            disabled={isPending}
            id="otp"
            inputMode="numeric"
            maxLength={6}
            name="otp"
            onChange={(event) =>
              setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            pattern="[0-9]{6}"
            required
            type="text"
            value={otp}
          />
          <button
            className={`${buttonClassName} mt-5`}
            disabled={isPending || otp.length !== 6}
          >
            {isPending ? "Verifying..." : "Verify and sign in"}
          </button>
          <div className="mt-4 flex items-center justify-between gap-4 text-sm">
            <button
              className="font-medium text-blue-700 underline-offset-4 hover:underline disabled:opacity-60"
              disabled={isPending}
              onClick={() => {
                setOtp("");
                setStage("email");
                setError("");
                setMessage("");
              }}
              type="button"
            >
              Change email
            </button>
            <button
              className="font-medium text-blue-700 underline-offset-4 hover:underline disabled:opacity-60"
              disabled={isPending}
              onClick={() => void sendCode()}
              type="button"
            >
              Resend code
            </button>
          </div>
        </form>
      )}

      {message && (
        <p className="mt-4 text-sm text-green-800" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
