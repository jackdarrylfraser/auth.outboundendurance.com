import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Outbound Endurance",
  description: "Secure access and subscription management for Outbound Endurance.",
};

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <section className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
          Outbound Endurance
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">
          Welcome to Outbound Endurance
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Sign in to your account or set up paid access to your membership.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            className="flex items-center justify-center rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            href="/login"
          >
            Sign in
          </Link>
          {process.env.VERCEL_GIT_COMMIT_REF === "preview" ? (
            <Link
              className="flex items-center justify-center rounded-lg border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              href="/account"
            >
              Set up paid access
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
