import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Briefcase, LayoutDashboard, Compass } from "lucide-react";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const isDashboard = location === "/" || location.startsWith("/assessment");
  const isProspecting = location.startsWith("/prospecting") || location.startsWith("/prospect/");

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md print:hidden">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <Briefcase className="w-6 h-6" />
            <span className="font-serif text-xl font-medium tracking-tight">Source of Wealth Workspace</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/" className={`text-sm font-medium transition-colors hover:text-primary ${isDashboard ? 'text-primary' : 'text-muted-foreground'}`}>
              <span className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </span>
            </Link>
            <Link href="/prospecting" className={`text-sm font-medium transition-colors hover:text-primary ${isProspecting ? 'text-primary' : 'text-muted-foreground'}`}>
              <span className="flex items-center gap-2">
                <Compass className="w-4 h-4" />
                Prospecting
              </span>
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
