import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "./contentSecurityPolicy";

const SUPABASE_URL = "https://example-project.supabase.co";

function directive(name: string): string[] {
  const entry = buildContentSecurityPolicy(SUPABASE_URL).split("; ").find(d => d.startsWith(`${name} `));
  return entry ? entry.split(" ").slice(1) : [];
}

describe("buildContentSecurityPolicy", () => {
  it("allows scripts from this site only", () => {
    expect(directive("script-src")).toEqual(["'self'"]);
  });

  it("denies anything not listed", () => {
    expect(directive("default-src")).toEqual(["'none'"]);
    expect(directive("object-src")).toEqual(["'none'"]);
    expect(directive("base-uri")).toEqual(["'none'"]);
  });

  it("limits where data can be sent", () => {
    expect(directive("connect-src")).toEqual([SUPABASE_URL]);
    expect(directive("form-action")).toEqual(["'self'"]);
  });

  it("reduces the Supabase URL to its origin", () => {
    expect(buildContentSecurityPolicy(`${SUPABASE_URL}/rest/v1`)).toContain(`connect-src ${SUPABASE_URL};`);
  });

  it("loads nothing from third parties except Supabase", () => {
    const hosts = buildContentSecurityPolicy(SUPABASE_URL).match(/https:\/\/[^\s;]+/g);
    expect(hosts).toEqual([SUPABASE_URL]);
  });

  it("never allows wildcards or unsafe script sources", () => {
    const policy = buildContentSecurityPolicy(SUPABASE_URL);
    expect(policy).not.toContain("*");
    expect(policy).not.toContain("unsafe-eval");
    expect(directive("script-src")).not.toContain("'unsafe-inline'");
  });

  it.each([undefined, "", "http://example-project.supabase.co"])("fails the build for %s", url => {
    expect(() => buildContentSecurityPolicy(url)).toThrow(/https URL/);
  });
});
