import { getServerSession } from "@/lib/auth/session";
import { stripeManageService } from "@/lib/billing/stripe/manage";
import { PaymentSetupVerificationError } from "@/lib/billing/stripe/manage-service";

const noStoreHeaders = { "Cache-Control": "no-store" };
const setupIntentIdPattern = /^seti_[a-zA-Z0-9]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }
    return Response.json(
      { error: "Invalid request body." },
      { status: 400, headers: noStoreHeaders },
    );
  }

  if (
    !isRecord(body) ||
    typeof body.setupIntentId !== "string" ||
    !setupIntentIdPattern.test(body.setupIntentId)
  ) {
    return Response.json(
      { error: "A valid payment setup reference is required." },
      { status: 400, headers: noStoreHeaders },
    );
  }

  let confirmed: boolean;
  try {
    confirmed = await stripeManageService.confirmPaymentMethodSetup({
      userId: session.user.id,
      setupIntentId: body.setupIntentId,
    });
  } catch (error) {
    if (!(error instanceof PaymentSetupVerificationError)) {
      throw error;
    }
    return Response.json(
      { error: error.message },
      { status: 400, headers: noStoreHeaders },
    );
  }
  if (!confirmed) {
    return Response.json(
      { error: "No Stripe customer is associated with this account." },
      { status: 404, headers: noStoreHeaders },
    );
  }

  return Response.json({ success: true }, { headers: noStoreHeaders });
}
