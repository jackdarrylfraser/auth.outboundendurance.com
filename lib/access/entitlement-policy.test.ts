import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasManageableSubscription,
  hasPaidEntitlement,
} from "@/lib/access/entitlement-policy";

describe("paid entitlement policy", () => {
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

  it("grants access for active and trialing subscriptions", () => {
    assert.equal(hasPaidEntitlement([{ status: "active" }]), true);
    assert.equal(hasPaidEntitlement([{ status: "trialing" }]), true);
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
        hasPaidEntitlement([{ status }]),
        false,
        `${status} must not grant access`,
      );
    }
  });
});
