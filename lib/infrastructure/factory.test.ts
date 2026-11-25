import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInfrastructure } from "@/lib/infrastructure/factory";

describe("infrastructure factory", () => {
  it("composes injected dependencies without creating external clients", () => {
    const calls: string[] = [];
    const dependencies = {
      env: { BASE_URL: "https://example.com" },
      db: { name: "fake database" },
      stripe: { name: "fake Stripe" },
      resend: { name: "fake Resend" },
      logger: { name: "fake logger" },
      vercel: { name: "fake Vercel" },
    };

    const infrastructure = createInfrastructure({
      env: dependencies.env,
      createDb: () => {
        calls.push("db");
        return dependencies.db;
      },
      createStripe: () => {
        calls.push("stripe");
        return dependencies.stripe;
      },
      createResend: () => {
        calls.push("resend");
        return dependencies.resend;
      },
      createLogger: () => {
        calls.push("logger");
        return dependencies.logger;
      },
      createVercel: () => {
        calls.push("vercel");
        return dependencies.vercel;
      },
    });

    assert.deepEqual(infrastructure, dependencies);
    assert.deepEqual(calls, ["db", "stripe", "resend", "logger", "vercel"]);
  });
});
