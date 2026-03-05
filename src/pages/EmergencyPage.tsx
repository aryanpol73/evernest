import { Droplets, Phone, FileText, Download, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFamilyMembers, useDocuments } from "@/hooks/useFamily";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function EmergencyPage() {
  const { data: members, isLoading: membersLoading } = useFamilyMembers();
  const { data: docs, isLoading: docsLoading } = useDocuments();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isLoading = membersLoading || docsLoading;

  const criticalDocs = docs?.filter(d => d.category === "Medical" || d.category === "Insurance") || [];
  const contacts = members?.filter(m => m.phone) || [];

  const handleDownload = async (filePath: string, name: string) => {
    const { data, error } = await supabase.storage.from("family-documents").download(filePath);
    if (error) { toast({ title: "Download failed", description: error.message, variant: "destructive" }); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Emergency Access" subtitle="Critical family information at your fingertips." />

      <div className="rounded-lg border-2 border-destructive/30 bg-destructive/5 p-4 mb-6 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
        <p className="text-sm font-medium">This page is designed for quick access during emergencies. Keep it updated.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-lg" />)}</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Blood Groups */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Droplets className="h-5 w-5 text-destructive" />
              <h2 className="font-semibold text-lg">Blood Groups</h2>
            </div>
            {!members?.length ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">No members added yet.</p>
                <Button variant="outline" size="sm" onClick={() => navigate("/members")}>Add Members</Button>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <span className="text-sm font-medium">{m.name}</span>
                    <span className={`text-sm font-semibold ${m.blood_group ? "" : "text-destructive"}`}>
                      {m.blood_group || "Not recorded"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Emergency Contacts */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Phone className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">Emergency Contacts</h2>
            </div>
            {!contacts.length ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">No phone numbers saved.</p>
                <Button variant="outline" size="sm" onClick={() => navigate("/members")}>Add Phone Numbers</Button>
              </div>
            ) : (
              <div className="space-y-2">
                {contacts.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{m.name}</p>
                      {m.relation && <p className="text-xs text-muted-foreground">{m.relation}</p>}
                    </div>
                    <a href={`tel:${m.phone}`} className="text-sm font-medium text-primary hover:underline">{m.phone}</a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Critical Documents */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-accent" />
              <h2 className="font-semibold text-lg">Critical Documents</h2>
            </div>
            {!criticalDocs.length ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">No Medical or Insurance documents.</p>
                <Button variant="outline" size="sm" onClick={() => navigate("/documents")}>Upload Documents</Button>
              </div>
            ) : (
              <div className="space-y-2">
                {criticalDocs.map(d => (
                  <div key={d.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.category}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleDownload(d.file_path, d.name)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
