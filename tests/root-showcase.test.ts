import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("root showcase", () => {
  it("ships a portfolio landing page for the deployment base URL", async () => {
    const html = await readFile(
      new URL("../index.html", import.meta.url),
      "utf8"
    );

    expect(html).toContain("ProofChain API");
    expect(html).toContain("Interactive API showcase");
    expect(html).toContain('id="request-form"');
    expect(html).toContain("/api/events");
    expect(html).toContain("/api/verify");
    expect(html).toContain("Copy cURL");
  });
});
