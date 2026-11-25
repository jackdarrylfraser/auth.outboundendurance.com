import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
// Bun provides this test-only module at runtime; it is not part of the app's TypeScript types.
// @ts-expect-error bun:test is available to Bun's test runner.
import { mock } from "bun:test";
import { PaidAccessRequiredError } from "@/lib/access/entitlement-policy";

type Session = { user: { id: string } } | null;
type Cookie = { name: string; value: string };

let session: Session = { user: { id: "user_123" } };
let sessionError: Error | undefined;
let paidAccessError: Error | undefined;
const sessionCalls: Cookie[] = [];
const paidAccessCalls: string[] = [];
const loggedErrors: unknown[] = [];

async function getSessionFromCookie(cookie: Cookie): Promise<Session> {
  sessionCalls.push(cookie);
  if (sessionError) {
    throw sessionError;
  }
  return session;
}

async function requirePaidAccess(userId: string): Promise<void> {
  paidAccessCalls.push(userId);
  if (paidAccessError) {
    throw paidAccessError;
  }
}

mock.module("@/lib/auth/session", () => ({ getSessionFromCookie }));
mock.module("@/lib/access/entitlement", () => ({ requirePaidAccess }));
mock.module("next/navigation", () => ({
  unstable_rethrow: () => undefined,
}));
mock.module("@/lib/logger", () => ({
  getLogger: () => ({
    error: (...args: unknown[]) => loggedErrors.push(args),
  }),
}));

const { POST } = await import("./route");

function request(body: string): Request {
  return new Request("https://auth.example.com/api/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

const cookie = {
  name: "better-auth.session_token",
  value: "session-token",
};

describe("POST /api/access", () => {
  beforeEach(() => {
    session = { user: { id: "user_123" } };
    sessionError = undefined;
    paidAccessError = undefined;
    sessionCalls.length = 0;
    paidAccessCalls.length = 0;
    loggedErrors.length = 0;
  });

  it("rejects malformed requests before session lookup", async () => {
    const response = await POST(request("{"));

    assert.equal(response.status, 400);
    assert.equal(sessionCalls.length, 0);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  });

  it("checks authentication without requesting paid access", async () => {
    const response = await POST(
      request(JSON.stringify({ cookie, access: "authenticated" })),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      accessType: "authenticated",
      hasAccess: true,
    });
    assert.deepEqual(sessionCalls, [cookie]);
    assert.deepEqual(paidAccessCalls, []);
  });

  it("returns forbidden when the user has no paid entitlement", async () => {
    paidAccessError = new PaidAccessRequiredError();
    const response = await POST(request(JSON.stringify({ cookie })));

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      accessType: "paid",
      hasAccess: false,
    });
    assert.deepEqual(paidAccessCalls, ["user_123"]);
  });

  it("logs verification failures and returns unavailable", async () => {
    sessionError = new Error("Session service unavailable");
    const response = await POST(request(JSON.stringify({ cookie })));

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "Unable to verify access.",
    });
    assert.equal(loggedErrors.length, 1);
  });
});
