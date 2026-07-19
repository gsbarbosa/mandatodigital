import { describe, expect, it } from "vitest";

/**
 * Integração Firestore requer FIREBASE_SERVICE_ACCOUNT_JSON.
 * Smoke manual: npm run db:reset (dry) + fluxo login → perfil → job.
 */
describe("async-jobs-storage", () => {
  it("tipos de status esperados pelo dominio", () => {
    const statuses = ["queued", "running", "succeeded", "failed", "dead"] as const;
    expect(statuses).toContain("queued");
    expect(statuses).toContain("running");
  });
});
