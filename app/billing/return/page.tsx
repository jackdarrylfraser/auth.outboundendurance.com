import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { BillingReturnStatus } from "./billing-return-status";

export const metadata: Metadata = {
  title: "Billing status | Outbound Endurance",
  description: "Check the status of your subscription checkout.",
};

export default async function BillingReturnPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/?returnTo=%2Fbilling%2Freturn");
  }

  return (
    <main className="flex flex-1 justify-center px-6 py-16">
      <section
        aria-labelledby="billing-return-heading"
        className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
          Outbound Endurance
        </p>
        <h1
          className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950"
          id="billing-return-heading"
        >
          Checking your subscription
        </h1>
        <BillingReturnStatus />
      </section>
    </main>
  );
}
