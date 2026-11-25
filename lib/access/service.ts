import { PaidAccessRequiredError } from "@/lib/access/entitlement-policy";

type AccessType = "authenticated" | "paid";
type SessionCookie = {
  name: string;
  value: string;
};

type AccessDecision =
  | { type: "unauthenticated"; accessType: AccessType }
  | { type: "authenticated" }
  | { type: "paid" }
  | { type: "forbidden" };

export function createAccessService(dependencies: {
  getSession(cookie: SessionCookie): Promise<{ user: { id: string } } | null>;
  requirePaidAccess(userId: string): Promise<void>;
}) {
  async function checkAccess(input: {
    cookie: SessionCookie;
    access: AccessType;
  }): Promise<AccessDecision> {
    const session = await dependencies.getSession(input.cookie);
    if (!session) {
      return { type: "unauthenticated", accessType: input.access };
    }

    if (input.access === "authenticated") {
      return { type: "authenticated" };
    }

    try {
      await dependencies.requirePaidAccess(session.user.id);
    } catch (error) {
      if (error instanceof PaidAccessRequiredError) {
        return { type: "forbidden" };
      }
      throw error;
    }

    return { type: "paid" };
  }

  return { checkAccess };
}
