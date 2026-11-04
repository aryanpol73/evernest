import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuditEvents } from "@/hooks/useAuditEvents";

const ACTION_LABELS: Record<string, string> = {
  document_uploaded: "Uploaded",
  document_updated: "Edited",
  document_deleted: "Deleted",
  document_viewed: "Viewed",
  document_downloaded: "Downloaded",
  member_added: "Added member",
  member_updated: "Updated member",
  member_removed: "Removed member",
  pin_set: "App PIN set or changed",
  pin_removed: "App PIN removed",
  pin_failed: "Wrong PIN entered",
  pin_locked: "PIN locked after too many attempts",
  invite_created: "Invited",
  invite_revoked: "Revoked invite",
  access_granted: "Joined the family",
  access_changed: "Access changed",
  access_removed: "Left or was removed",
  mfa_recovery_codes_created: "New recovery codes created",
  mfa_recovery_used: "Recovery code used, two-step verification turned off",
  mfa_recovery_failed: "Wrong recovery code entered",
};

export function ActivityLog() {
  const { data: events, isLoading, isError } = useAuditEvents();

  return (
    <div className="max-w-2xl rounded-lg border bg-card p-6 shadow-sm space-y-4">
      <div>
        <h3 className="font-semibold">Recent Activity</h3>
        <p className="text-sm text-muted-foreground">The last 50 events in your family workspace. Entries can't be edited or removed.</p>
      </div>

      {isLoading && <Skeleton className="h-24" />}
      {isError && <p className="text-sm text-destructive">We couldn't load your activity.</p>}
      {events?.length === 0 && <p className="text-sm text-muted-foreground">Nothing yet.</p>}

      {!!events?.length && (
        <ul className="divide-y">
          {events.map(event => (
            <li key={event.id} className="flex items-baseline justify-between gap-4 py-2 text-sm">
              <span className="min-w-0 truncate">
                {ACTION_LABELS[event.action] ?? event.action}
                {event.target_name && <span className="text-muted-foreground"> · {event.target_name}</span>}
              </span>
              <time dateTime={event.created_at} className="shrink-0 text-xs text-muted-foreground">
                {format(new Date(event.created_at), "d MMM yyyy, h:mm a")}
              </time>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">Views and downloads are recorded when they happen in the EverNest app.</p>
    </div>
  );
}
