import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BottomNav } from "./BottomNav";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ signOut: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}));

// jsdom lacks the browser APIs the drawer animation relies on.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub as never;
Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => {};
Element.prototype.releasePointerCapture = () => {};

function renderNav(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav />
    </MemoryRouter>,
  );
}

describe("BottomNav", () => {
  it("shows the four primary tabs plus More", () => {
    renderNav("/dashboard");
    for (const label of ["Home", "Docs", "Members", "Reminders", "More"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("keeps every feature reachable from the More sheet, with Settings inside", async () => {
    renderNav("/dashboard");
    fireEvent.click(screen.getByText("More"));
    expect(await screen.findByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Family Tree")).toBeInTheDocument();
    expect(screen.getByText("Emergency")).toBeInTheDocument();
    expect(screen.getByText("Sign Out")).toBeInTheDocument();
  });

  it("highlights Members for member profile routes", () => {
    renderNav("/members/some-id");
    expect(screen.getByText("Members").closest("button")).toHaveAttribute("aria-current", "page");
  });
});
