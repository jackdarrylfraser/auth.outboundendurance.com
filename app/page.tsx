import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Outbound Endurance",
  description: "Secure access and subscription management for Outbound Endurance.",
};

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <section className="w-full max-w-2xl rounded-2xl border border-border bg-surface p-8 text-center shadow-sm sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Outbound Endurance
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
          Welcome to Outbound Endurance
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Set up paid access to your membership.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            className="flex items-center justify-center rounded-lg border border-border px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            href="/account"
          >
            Set up paid access
          </Link>
        </div>
      </section>
    </main>
  );
}
