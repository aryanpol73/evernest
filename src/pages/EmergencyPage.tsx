import { Siren, Droplets, Phone, FileText, Stethoscope } from "lucide-react";

export default function EmergencyPage() {
  return (
    <div className="min-h-full animate-fade-in">
      {/* Banner */}
      <div className="rounded-lg bg-foreground text-background p-4 mb-6 flex items-center gap-3">
        <Siren className="h-6 w-6 text-destructive shrink-0" />
        <div>
          <h1 className="text-lg font-bold">Emergency Mode — Critical Family Information</h1>
          <p className="text-sm opacity-80">Quick access to vital family data when every second counts.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Blood Groups */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Droplets className="h-5 w-5 text-destructive" />
            <h2 className="font-semibold text-lg">Blood Groups</h2>
          </div>
          <p className="text-sm text-muted-foreground text-center py-6">Add family members to see blood group information here.</p>
        </div>

        {/* Emergency Contacts */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Phone className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-lg">Emergency Contacts</h2>
          </div>
          <p className="text-sm text-muted-foreground text-center py-6">Add family members with phone numbers to populate this section.</p>
        </div>

        {/* Critical Documents */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-accent" />
            <h2 className="font-semibold text-lg">Critical Documents</h2>
          </div>
          <p className="text-sm text-muted-foreground text-center py-6">Insurance and medical documents will appear here.</p>
        </div>

        {/* Medical Notes */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Stethoscope className="h-5 w-5 text-success" />
            <h2 className="font-semibold text-lg">Medical Notes</h2>
          </div>
          <p className="text-sm text-muted-foreground text-center py-6">Medical notes from member profiles will be shown here.</p>
        </div>
      </div>
    </div>
  );
}
