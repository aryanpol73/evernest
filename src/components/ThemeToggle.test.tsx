import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeToggle } from "./ThemeToggle";

const setTheme = vi.fn();
const useTheme = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: (...args: unknown[]) => useTheme(...args),
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    setTheme.mockClear();
  });

  it("switches dark mode to light on click", () => {
    useTheme.mockReturnValue({ resolvedTheme: "dark", setTheme });
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: /switch to light mode/i }));
    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("switches light mode to dark on click", () => {
    useTheme.mockReturnValue({ resolvedTheme: "light", setTheme });
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: /switch to dark mode/i }));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });
});
