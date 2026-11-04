import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LandingPage from "./LandingPage";

function pageText(): string {
  const { container } = render(<MemoryRouter><LandingPage /></MemoryRouter>);
  return container.textContent ?? "";
}

describe("LandingPage claims", () => {
  beforeAll(() => {
    vi.stubGlobal("IntersectionObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
  });

  // Each of these was on the page without being true. Before bringing one back, make
  // it true: see ADR-002 and ADR-013.
  it.each([
    ["operator can't read files", /cannot read your files|zero access|unreadable to anyone/i],
    ["compliance nobody has assessed", /GDPR|HIPAA|SOC ?2|compliant/i],
    ["comparisons with banks", /bank-(level|grade)|trusted by banks/i],
    ["alerts that are never sent", /automated expiry alerts|never miss/i],
    ["a trial that doesn't exist", /Pro Trial/i],
    ["popularity with no customers", /most popular|trusted by families/i],
    ["absolute privacy", /privacy is absolute/i],
  ])("does not claim %s", (_name, pattern) => {
    expect(pageText()).not.toMatch(pattern);
  });

  it("states what the encryption does, and what it doesn't", () => {
    const text = pageText();
    expect(text).toMatch(/AES-256 at rest and TLS in transit/);
    expect(text).toMatch(/not end-to-end encrypted/);
  });

  it("doesn't offer Pro for sale yet", () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Coming Soon" })).toBeDisabled();
  });
});
