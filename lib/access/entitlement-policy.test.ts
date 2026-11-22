import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createPaidAccessGuard,
  hasManageableSubscription,
  hasPaidEntitlement,
  isSubscriptionStale,
  PaidAccessRequiredError,
} from "@/lib/access/entitlement-policy";

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

  it("offers subscription management for ongoing subscriptions", () => {
    const now = new Date("2026-01-02T00:00:00.000Z");

    for (const status of [
      "active",
      "trialing",
      "unpaid",
      "past_due",
      "paused",
    ]) {
      assert.equal(
        hasManageableSubscription(
          [
            {
              status,
              currentPeriodEnd: new Date("2026-01-01T00:00:00.000Z"),
            },
          ],
          now,
        ),
        true,
        `${status} must offer subscription management`,
      );
    }
  });

  it("offers management for canceled subscriptions only through the paid period", () => {
    const now = new Date("2026-01-02T00:00:00.000Z");

    assert.equal(
      hasManageableSubscription(
        [
          {
            status: "canceled",
            currentPeriodEnd: new Date("2026-01-03T00:00:00.000Z"),
          },
        ],
        now,
      ),
      true,
    );
    assert.equal(
      hasManageableSubscription(
        [{ status: "canceled", currentPeriodEnd: now }],
        now,
      ),
      false,
    );
  });

  it("offers checkout for users without an ongoing or paid-through subscription", () => {
    const now = new Date("2026-01-02T00:00:00.000Z");

    assert.equal(hasManageableSubscription([], now), false);
    for (const status of ["incomplete", "incomplete_expired"]) {
      assert.equal(
        hasManageableSubscription(
          [
            {
              status,
              currentPeriodEnd: new Date("2026-01-03T00:00:00.000Z"),
            },
          ],
          now,
        ),
        false,
        `${status} must not offer subscription management`,
      );
    }
    assert.equal(
      hasManageableSubscription(
        [
          {
            status: "canceled",
            currentPeriodEnd: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
        now,
      ),
      false,
    );
  });

  it("keeps access through the paid period for a scheduled cancellation", () => {
    assert.equal(
      hasPaidEntitlement([{ status: "active", cancelAtPeriodEnd: true }]),
      true,
    );
    assert.equal(
      hasPaidEntitlement([{ status: "trialing", cancelAtPeriodEnd: false }]),
      true,
    );
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
