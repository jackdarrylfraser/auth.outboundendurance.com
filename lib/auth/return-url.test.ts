import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAllowedReturnUrl } from "@/lib/auth/return-url";

describe("getAllowedReturnUrl", () => {
  const productionAuthUrl = "https://auth.outboundendurance.com";

  it("resolves relative destinations against the auth origin", () => {
    assert.equal(
      getAllowedReturnUrl("/account?tab=billing", productionAuthUrl),
      "https://auth.outboundendurance.com/account?tab=billing",
    );
  });

  it("allows the production apex and all HTTPS subdomains", () => {
    assert.equal(
      getAllowedReturnUrl("https://member.outboundendurance.com/dashboard", productionAuthUrl),
      "https://member.outboundendurance.com/dashboard",
    );
    assert.equal(
      getAllowedReturnUrl("https://staging.outboundendurance.com", productionAuthUrl),
      "https://staging.outboundendurance.com/",
    );
    assert.equal(
      getAllowedReturnUrl("https://outboundendurance.com/", productionAuthUrl),
      "https://outboundendurance.com/",
    );
  });

  it("rejects untrusted origins and unsafe URL schemes", () => {
    assert.equal(
      getAllowedReturnUrl("https://attacker.example", productionAuthUrl),
      null,
    );
    assert.equal(
      getAllowedReturnUrl("//attacker.example/path", productionAuthUrl),
      null,
    );
    assert.equal(
      getAllowedReturnUrl(
        "https://outboundendurance.com.attacker.example",
        productionAuthUrl,
      ),
      null,
    );
    assert.equal(
      getAllowedReturnUrl("http://staging.outboundendurance.com", productionAuthUrl),
      null,
    );
    assert.equal(
      getAllowedReturnUrl("javascript:alert(1)", productionAuthUrl),
      null,
    );
  });

  it("rejects credentials and unrelated local development origins", () => {
    assert.equal(
      getAllowedReturnUrl(
        "https://user:password@auth.outboundendurance.com",
        productionAuthUrl,
      ),
      null,
    );
    assert.equal(
      getAllowedReturnUrl("http://localhost:3001", "http://localhost:3000"),
      "http://localhost:3001/",
    );
    assert.equal(
      getAllowedReturnUrl("http://attacker.example:3001", "http://localhost:3000"),
      null,
    );
    assert.equal(
      getAllowedReturnUrl("/dashboard", "http://localhost:3000"),
      "http://localhost:3000/dashboard",
    );
  });

  it("allows localhost return URLs on any development port", () => {
    assert.equal(
      getAllowedReturnUrl(
        "http://localhost:3001/dashboard",
        "http://localhost:3000",
      ),
      "http://localhost:3001/dashboard",
    );
  });

  it("keeps the user on the sign-in page when no destination is supplied", () => {
    assert.equal(getAllowedReturnUrl(undefined, productionAuthUrl), null);
    assert.equal(getAllowedReturnUrl("", productionAuthUrl), null);
  });
});
