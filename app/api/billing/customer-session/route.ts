import { getServerSession } from "@/lib/session";
import { getOrCreateStripeCustomer, stripe } from "@/lib/stripe";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST() {
  const session = await getServerSession();

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders },
    );
  }

  const customerId = await getOrCreateStripeCustomer({
    id: session.user.id,
    email: session.user.email,
  });
  const customerSession = await stripe.customerSessions.create({
    customer: customerId,
    components: { pricing_table: { enabled: true } },
  });

  return Response.json(
    { clientSecret: customerSession.client_secret },
    { headers: noStoreHeaders },
  );
}
