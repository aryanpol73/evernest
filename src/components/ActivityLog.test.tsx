import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityLog } from "./ActivityLog";
import { useAuditEvents } from "@/hooks/useAuditEvents";

vi.mock("@/hooks/useAuditEvents", () => ({ useAuditEvents: vi.fn() }));

const result = (value: object) => value as ReturnType<typeof useAuditEvents>;

describe("ActivityLog", () => {
  it("shows events with readable labels", () => {
    vi.mocked(useAuditEvents).mockReturnValue(result({
      data: [
        { id: 2, action: "document_viewed", target_name: "Passport", created_at: "2026-11-04T10:00:00Z" },
        { id: 1, action: "pin_failed", target_name: null, created_at: "2026-11-03T10:00:00Z" },
      ],
    }));
    render(<ActivityLog />);
    expect(screen.getByText("Viewed")).toBeInTheDocument();
    expect(screen.getByText("· Passport")).toBeInTheDocument();
    expect(screen.getByText("Wrong PIN entered")).toBeInTheDocument();
  });

  it("shows an action it doesn't recognise rather than hiding it", () => {
    vi.mocked(useAuditEvents).mockReturnValue(result({
      data: [{ id: 1, action: "new_action", target_name: null, created_at: "2026-11-04T10:00:00Z" }],
    }));
    render(<ActivityLog />);
    expect(screen.getByText("new_action")).toBeInTheDocument();
  });

  it("explains an empty log and a failed load", () => {
    vi.mocked(useAuditEvents).mockReturnValue(result({ data: [] }));
    const { unmount } = render(<ActivityLog />);
    expect(screen.getByText("Nothing yet.")).toBeInTheDocument();
    unmount();

    vi.mocked(useAuditEvents).mockReturnValue(result({ isError: true }));
    render(<ActivityLog />);
    expect(screen.getByText(/couldn't load your activity/)).toBeInTheDocument();
  });
});
