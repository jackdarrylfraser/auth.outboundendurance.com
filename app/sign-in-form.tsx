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
        const subscribeUrl = new URL("/subscribe", window.location.origin);
        subscribeUrl.searchParams.set("returnTo", returnUrl);
        window.location.assign(subscribeUrl.href);
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
    "mt-2 block w-full rounded-lg border border-border bg-surface px-3 py-3 text-base text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-background";
  const buttonClassName =
    "flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      {stage === "complete" ? (
        <div className="py-4 text-center" role="status">
          <h2 className="text-lg font-semibold text-foreground">
            You&apos;re signed in
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Your email has been verified and your session is ready.
          </p>
        </div>
      ) : stage === "email" ? (
        <form onSubmit={sendCode}>
          <label
            className="block text-sm font-medium text-foreground"
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
          <p className="text-sm leading-6 text-muted-foreground">
            Enter the code sent to{" "}
            <span className="font-medium text-foreground">{email}</span>.
          </p>
          <label
            className="mt-5 block text-sm font-medium text-foreground"
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
              className="font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
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
              className="font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
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
        <p className="mt-4 text-sm text-success-foreground" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 text-sm text-danger-foreground" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
