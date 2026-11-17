import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createPaidAccessGuard,
  hasPaidEntitlement,
  isSubscriptionStale,
  PaidAccessRequiredError,
  type SubscriptionEntitlement,
} from "./entitlement-policy";

describe("paid entitlement policy", () => {
  it("uses a 24-hour freshness window for subscription snapshots", () => {
    const now = new Date("2026-01-02T00:00:00.000Z");

    assert.equal(
      isSubscriptionStale(new Date(now.getTime() - 24 * 60 * 60 * 1000), now),
      true,
    );
    assert.equal(
      isSubscriptionStale(
        new Date(now.getTime() - 24 * 60 * 60 * 1000 + 1),
        now,
      ),
      false,
    );
  });

  it("allows active and trialing subscriptions, including scheduled cancellations", () => {
    const subscriptions: SubscriptionEntitlement[] = [
      { status: "active", cancelAtPeriodEnd: true },
      { status: "trialing", cancelAtPeriodEnd: false },
    ];

    assert.equal(hasPaidEntitlement(subscriptions), true);
  });

  it("denies missing subscriptions and every status other than active or trialing", () => {
    assert.equal(hasPaidEntitlement([]), false);

    for (const status of [
      "canceled",
      "past_due",
      "unpaid",
      "incomplete",
      "incomplete_expired",
      "paused",
      "unknown",
    ]) {
      assert.equal(
        hasPaidEntitlement([{ status, cancelAtPeriodEnd: false }]),
        false,
        `${status} must not grant access`,
      );
    }
  });

  it("allows a user if any linked subscription is eligible", async () => {
    let loadedUserId = "";
    const requireAccess = createPaidAccessGuard(async (userId) => {
      loadedUserId = userId;
      return [
        { status: "past_due", cancelAtPeriodEnd: false },
        { status: "trialing", cancelAtPeriodEnd: true },
      ];
    });

    await requireAccess("user-1");

    assert.equal(loadedUserId, "user-1");
  });

  it("throws a specific denial for users without an eligible subscription", async () => {
    const requireAccess = createPaidAccessGuard(async () => [
      { status: "canceled", cancelAtPeriodEnd: false },
    ]);

    await assert.rejects(
      requireAccess("user-1"),
      PaidAccessRequiredError,
    );
  });

  it("propagates subscription lookup failures without granting access", async () => {
    const databaseError = new Error("Database unavailable");
    const requireAccess = createPaidAccessGuard(async () => {
      throw databaseError;
    });

    await assert.rejects(requireAccess("user-1"), databaseError);
  });
});
