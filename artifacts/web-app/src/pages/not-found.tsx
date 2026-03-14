import { Link } from "wouter";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-destructive/10 border border-destructive/20 text-destructive shadow-[0_0_30px_-5px_hsl(var(--destructive)/0.3)]">
            <ShieldAlert className="w-12 h-12" />
          </div>
        </div>
        <h1 className="text-4xl font-bold font-display tracking-tight text-foreground">
          404 Not Found
        </h1>
        <p className="text-muted-foreground">
          The requested path does not exist in this sector. Verify your coordinates and try again.
        </p>
        <div className="pt-4">
          <Link href="/" className="inline-block">
            <Button variant="cyber" size="lg">
              Return to Core
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
