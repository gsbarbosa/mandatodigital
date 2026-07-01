import { afterEach, describe, expect, it } from "vitest";

import { isPlatformAdminEmail, parsePlatformAdminEmails } from "@/lib/platform-admin";

const ORIGINAL = process.env.PLATFORM_ADMIN_EMAILS;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.PLATFORM_ADMIN_EMAILS;
  } else {
    process.env.PLATFORM_ADMIN_EMAILS = ORIGINAL;
  }
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
});

describe("platform-admin", () => {
  it("parseia lista de e-mails admin", () => {
    process.env.PLATFORM_ADMIN_EMAILS = " A@x.com , b@y.com ";
    expect(parsePlatformAdminEmails()).toEqual(["a@x.com", "b@y.com"]);
  });

  it("respeita allowlist em producao", () => {
    process.env.NODE_ENV = "production";
    process.env.PLATFORM_ADMIN_EMAILS = "admin@mandato.com";

    expect(isPlatformAdminEmail("admin@mandato.com")).toBe(true);
    expect(isPlatformAdminEmail("outro@mandato.com")).toBe(false);
  });

  it("permite qualquer usuario logado em dev sem allowlist", () => {
    process.env.NODE_ENV = "development";
    delete process.env.PLATFORM_ADMIN_EMAILS;

    expect(isPlatformAdminEmail("qualquer@dev.com")).toBe(true);
  });
});
