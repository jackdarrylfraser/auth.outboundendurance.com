import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareEnvFiles } from "./vercel-env-upload";

describe("Vercel env uploader", () => {
  it("accepts exactly the populated fields from the example", () => {
    assert.deepEqual(
      compareEnvFiles(
        "DATABASE_URL=\nAPI_KEY=\n",
        'DATABASE_URL="libsql://db.example"\nAPI_KEY="secret=value"\n',
      ),
      { missing: [], extra: [], empty: [] },
    );
  });

  it("reports missing, extra, and empty values", () => {
    assert.deepEqual(
      compareEnvFiles(
        "DATABASE_URL=\nAPI_KEY=\n",
        "DATABASE_URL=\nOTHER_KEY=unexpected\n",
      ),
      {
        missing: ["API_KEY"],
        extra: ["OTHER_KEY"],
        empty: ["DATABASE_URL"],
      },
    );
  });
});
