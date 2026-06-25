import { Users, ExternalLink, Building2, Snowflake } from "lucide-react";

// ── Referral pointers ────────────────────────────────────────────────────────
// Per Rupert's systematic approach, before going cold the banker should look for
// a warm route. We keep this BROAD on purpose — no bank-network integration, just
// pointers and click-to-open searches that aim the banker in a direction. The
// channel order matters: client referral → JPM internal → cold anchored to a
// shared affiliation.

export interface ReferralPointersProps {
  prospectName: string;
  segment?: string;
  /** Warm referral routes the briefing already surfaced, if any. */
  referralRoutes?: string[];
}

function linkedinPeople(q: string): string {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;
}
function google(q: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

function SearchLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded border border-border bg-background hover:bg-secondary transition-colors"
    >
      {children}
      <ExternalLink className="w-3 h-3 opacity-60" />
    </a>
  );
}

export function ReferralPointers({ prospectName, segment, referralRoutes }: ReferralPointersProps) {
  const name = prospectName.trim();
  const routes = (referralRoutes ?? []).filter((r) => r.trim().length > 0);

  const channels = [
    {
      icon: <Users className="w-4 h-4 text-primary" />,
      title: "1 · Client referral (highest yield)",
      body: `Who in your book overlaps with ${name || "the prospect"}? Same fund, co-investment, board, school or charity. A client who knows them is the warmest possible route.`,
    },
    {
      icon: <Building2 className="w-4 h-4 text-primary" />,
      title: "2 · JPMorgan internal",
      body: "Which JPM coverage banker (CIB, markets, or asset management) holds the relationship with their firm or counterparties? Ask for a warm introduction to the private-bank side.",
    },
    {
      icon: <Snowflake className="w-4 h-4 text-primary" />,
      title: "3 · Cold — anchored to a shared affiliation",
      body: "No warm route? Anchor the cold approach to something specific (a fund, a deal, an alma mater, a board, a club) so there's a credible reason to reach out.",
    },
  ];

  return (
    <section className="border border-border bg-card p-6 print:border-0 print:p-0">
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-4 h-4 text-primary" />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Referral pointers</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Look for a warm route before going cold. Work the channels in order.
      </p>

      <div className="space-y-3 mb-5">
        {channels.map((c) => (
          <div key={c.title} className="flex gap-3">
            <div className="mt-0.5 shrink-0">{c.icon}</div>
            <div>
              <div className="text-sm font-medium text-foreground">{c.title}</div>
              <p className="text-sm text-muted-foreground">{c.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Click-to-open searches — the banker runs these to hunt for overlaps. */}
      {name && (
        <div className="border-t border-border pt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
            Hunt for shared connections
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <SearchLink href={linkedinPeople(name)}>{name} on LinkedIn</SearchLink>
            {segment?.trim() && (
              <SearchLink href={linkedinPeople(segment)}>{segment} contacts on LinkedIn</SearchLink>
            )}
            <SearchLink href={google(`"${name}" (board OR trustee OR foundation OR charity OR alumni)`)}>
              Boards · charities · alumni
            </SearchLink>
            <SearchLink href={google(`"${name}" co-investor OR partner OR fund`)}>
              Co-investors · partners
            </SearchLink>
          </div>
        </div>
      )}

      {/* Anything the brief already surfaced as a warm route. */}
      {routes.length > 0 && (
        <div className="border-t border-border pt-4 mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
            Starting ideas from the brief
          </div>
          <ul className="list-disc pl-5 space-y-1 text-sm text-foreground">
            {routes.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
