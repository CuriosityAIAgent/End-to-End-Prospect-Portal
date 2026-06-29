import { ReactNode } from "react";
import { Link, useLocation } from "wouter";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const isJourney = location === "/" || location.startsWith("/assessment") || location.startsWith("/prospect/");
  const isProspecting = location.startsWith("/prospecting");

  const navLink = (active: boolean) =>
    `text-sm transition-colors pb-1 border-b-2 ${
      active
        ? "text-foreground border-primary"
        : "text-muted-foreground border-transparent hover:text-foreground"
    }`;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md print:hidden">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex flex-col leading-none">
            <span className="font-serif text-xl tracking-tight text-foreground">Source of Wealth</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground mt-1">
              Private Banking Workspace
            </span>
          </Link>
          <nav className="flex items-center gap-8">
            <Link href="/" className={navLink(isJourney)}>Journey</Link>
            <Link href="/prospecting" className={navLink(isProspecting)}>Pipeline</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-6 py-12 overflow-x-clip">
        {children}
      </main>
    </div>
  );
}
