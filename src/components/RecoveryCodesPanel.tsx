import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function RecoveryCodesPanel({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const { toast } = useToast();
  const text = codes.join("\n");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Codes copied" });
    } catch {
      toast({ title: "Couldn't copy", description: "Select the codes and copy them yourself.", variant: "destructive" });
    }
  };

  const handleDownload = () => {
    const url = URL.createObjectURL(new Blob([`EverNest recovery codes\n\n${text}\n`], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "evernest-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-md border bg-muted/50 p-4 space-y-3">
      <p className="text-sm font-medium">Save your recovery codes now</p>
      <p className="text-sm text-muted-foreground">
        If you lose your device, one of these gets you back in, together with your password. Each works once, and you won't see them again. Keep them somewhere safe, away from your password.
      </p>
      <ul aria-label="Recovery codes" className="grid gap-1 font-mono text-xs sm:grid-cols-2">
        {codes.map(code => <li key={code}>{code}</li>)}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleCopy}><Copy className="h-4 w-4" /> Copy</Button>
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleDownload}><Download className="h-4 w-4" /> Download</Button>
        <Button type="button" size="sm" onClick={onDone}>I've Saved Them</Button>
      </div>
    </div>
  );
}
