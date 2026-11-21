import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTrustedOrigins } from "@/lib/auth/trusted-origins";

describe("Better Auth trusted origins", () => {
  it("trusts all Outbound Endurance subdomains from preview auth hosts", () => {
    assert.deepEqual(
      getTrustedOrigins(new URL("https://auth-preview.outboundendurance.com")),
      [
        "https://auth-preview.outboundendurance.com",
        "https://*.outboundendurance.com",
        "https://outboundendurance.com",
      ],
    );
  });

  it("trusts all Outbound Endurance subdomains from production auth hosts", () => {
    assert.deepEqual(
      getTrustedOrigins(new URL("https://auth.outboundendurance.com")),
      [
        "https://auth.outboundendurance.com",
        "https://*.outboundendurance.com",
        "https://outboundendurance.com",
      ],
    );
  });

  it("does not extend trust to unrelated hosts", () => {
    assert.deepEqual(
      getTrustedOrigins(new URL("https://auth.example.com")),
      ["https://auth.example.com"],
    );
  });

  it("allows localhost ports during local development", () => {
    assert.deepEqual(getTrustedOrigins(new URL("http://localhost:3000")), [
      "http://localhost:3000",
      "http://localhost:*",
    ]);
  });
});
