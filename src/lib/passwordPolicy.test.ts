import { describe, expect, it } from "vitest";
import { validateNewPassword } from "./passwordPolicy";

describe("validateNewPassword", () => {
  it("accepts a reasonable password", () => {
    expect(validateNewPassword("river-stone-42", "asha@example.com")).toBeNull();
  });

  it("accepts letters and digits from any script", () => {
    expect(validateNewPassword("परिवार घर ४२ सुरक्षित")).toBeNull();
  });

  it.each([
    ["short1", /at least 10/],
    ["onlylettershere", /letters and numbers/],
    ["12345678901234", /letters and numbers/],
    ["Password123", /too common/],
    ["a1".repeat(40), /too long/],
  ])("rejects %s", (password, message) => {
    expect(validateNewPassword(password)).toMatch(message);
  });

  it("rejects a password containing the email name", () => {
    expect(validateNewPassword("Asha.Sharma2026", "asha.sharma@example.com")).toMatch(/email name/);
  });

  it("does not apply the email check to very short names", () => {
    expect(validateNewPassword("river-ab-stone-42", "ab@example.com")).toBeNull();
  });
});
