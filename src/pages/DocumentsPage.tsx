import { FileText, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

const categories = ["All", "Identity", "Medical", "Insurance", "Property", "Education", "Financial"];

export default function DocumentsPage() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Document Vault"
        subtitle="Your family's important documents, organized and secure."
        actions={<Button className="gap-2"><Plus className="h-4 w-4" /> Upload Document</Button>}
      />

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {categories.map((cat, i) => (
          <button
            key={cat}
            className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <EmptyState
        icon={FileText}
        title="No documents uploaded"
        description="Upload your first document to start building your secure vault."
        ctaLabel="Upload Document"
        onCta={() => {}}
      />
    </div>
  );
}
