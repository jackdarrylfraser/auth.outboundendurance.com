import { getServerSession } from "@/lib/auth/session";
import { stripeManageService } from "@/lib/billing/stripe/manage";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST() {
  const session = await getServerSession();
  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders },
    );
  }

  const subscription = await stripeManageService.resumeSubscription(
    session.user.id,
  );
  if (!subscription) {
    return Response.json(
      { error: "No resumable Stripe subscription was found." },
      { status: 404, headers: noStoreHeaders },
    );
  }

  const currentPeriodEnd = Math.max(
    ...subscription.items.data.map((item) => item.current_period_end),
  );
  return Response.json(
    {
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: new Date(currentPeriodEnd * 1000).toISOString(),
    },
    { headers: noStoreHeaders },
  );
}
