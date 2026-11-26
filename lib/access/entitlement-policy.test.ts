import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasManageableSubscription,
  hasPaidEntitlement,
} from "@/lib/access/entitlement-policy";

describe("paid entitlement policy", () => {
  it("offers subscription management for ongoing subscriptions", () => {
    for (const status of [
      "active",
      "trialing",
      "unpaid",
      "past_due",
      "paused",
    ]) {
      assert.equal(
        hasManageableSubscription(
          [{ status }],
        ),
        true,
        `${status} must offer subscription management`,
      );
    }
  });

  it("does not offer management for canceled subscriptions", () => {
    assert.equal(
      hasManageableSubscription([{ status: "canceled" }]),
      false,
    );
  });

  it("offers checkout for users without an ongoing or paid-through subscription", () => {
    assert.equal(hasManageableSubscription([]), false);
    for (const status of ["incomplete", "incomplete_expired"]) {
      assert.equal(
        hasManageableSubscription([{ status }]),
        false,
        `${status} must not offer subscription management`,
      );
    }
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
