import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createAccessService,
  type AccessSubscription,
} from "@/lib/access/entitlement-service";
import { PaidAccessRequiredError } from "@/lib/access/entitlement-policy";

const now = new Date("2026-01-02T00:00:00.000Z");
const freshAt = new Date(now.getTime() - 60_000);
const staleAt = new Date(now.getTime() - 25 * 60 * 60 * 1000);

function subscription(
  overrides: Partial<AccessSubscription> = {},
): AccessSubscription {
  return {
    id: "sub_123",
    status: "active",
    cancelAtPeriodEnd: false,
    lastSyncedAt: freshAt,
    lastEventCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("access service", () => {
  it("refreshes stale eligible subscriptions and evaluates refreshed access", async () => {
    const initial = subscription({ lastSyncedAt: staleAt });
    const refreshed = subscription({ status: "canceled" });
    const loadCalls: string[] = [];
    const syncCalls: Array<{
      subscriptionId: string;
      expectedLastEventCreatedAt: Date;
    }> = [];
    const service = createAccessService({
      async loadSubscriptions(userId) {
        loadCalls.push(userId);
        return loadCalls.length === 1 ? [initial] : [refreshed];
      },
      subscriptionService: {
        async retrieveAndSyncSubscription(subscriptionId, options) {
          syncCalls.push({ subscriptionId, ...options });
        },
      },
      getNow: () => now,
    });

    await assert.rejects(
      service.requirePaidAccess("user_123"),
      PaidAccessRequiredError,
    );

    assert.deepEqual(loadCalls, ["user_123", "user_123"]);
    assert.deepEqual(syncCalls, [
      {
        subscriptionId: "sub_123",
        expectedLastEventCreatedAt: initial.lastEventCreatedAt,
      },
    ]);
  });

  it("does not refresh fresh or ineligible subscriptions", async () => {
    let loadCalls = 0;
    let syncCalls = 0;
    const service = createAccessService({
      async loadSubscriptions() {
        loadCalls += 1;
        return [
          subscription(),
          subscription({
            id: "sub_canceled",
            status: "canceled",
            lastSyncedAt: staleAt,
          }),
        ];
      },
      subscriptionService: {
        async retrieveAndSyncSubscription() {
          syncCalls += 1;
        },
      },
      getNow: () => now,
    });

    await service.requirePaidAccess("user_123");

    assert.equal(loadCalls, 1);
    assert.equal(syncCalls, 0);
  });

  it("refreshes each stale eligible subscription before granting access", async () => {
    const staleSubscriptions = [
      subscription({ id: "sub_123", lastSyncedAt: staleAt }),
      subscription({
        id: "sub_456",
        status: "trialing",
        lastSyncedAt: staleAt,
      }),
    ];
    const syncCalls: string[] = [];
    let loadCalls = 0;
    const service = createAccessService({
      async loadSubscriptions() {
        loadCalls += 1;
        return staleSubscriptions;
      },
      subscriptionService: {
        async retrieveAndSyncSubscription(subscriptionId) {
          syncCalls.push(subscriptionId);
        },
      },
      getNow: () => now,
    });

    await service.requirePaidAccess("user_123");

    assert.deepEqual(syncCalls, ["sub_123", "sub_456"]);
    assert.equal(loadCalls, 2);
  });

  it("propagates refresh failures rather than granting from stale data", async () => {
    const refreshError = new Error("Stripe unavailable");
    const service = createAccessService({
      loadSubscriptions: async () => [
        subscription({ lastSyncedAt: staleAt }),
      ],
      subscriptionService: {
        async retrieveAndSyncSubscription() {
          throw refreshError;
        },
      },
      getNow: () => now,
    });

    await assert.rejects(service.requirePaidAccess("user_123"), refreshError);
  });
});
