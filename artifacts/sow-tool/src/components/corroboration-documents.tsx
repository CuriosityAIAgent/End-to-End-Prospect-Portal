import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShieldCheck, ExternalLink, Search, Loader2, Check, X, FileCheck2, AlertCircle, RefreshCw, Building2,
} from "lucide-react";

// ── Corroboration documents ─────────────────────────────────────────────────
// The documents that back the Source of Wealth statement. For a regulated
// individual the tool fetches a structured extract from the FCA register (free
// official API — no browser/scrape) and attaches it; everything else is a
// suggestion list for the banker to collect/upload. When the FCA API key is not
// configured, it falls back to a pre-filled deep link the banker can open + print.

interface FcaControlledFunction {
  code: string;
  name: string;
  firm: string;
  effectiveDate: string;
  endDate: string;
  current: boolean;
}
interface FcaExtract {
  irn: string;
  name: string;
  status: string;
  controlledFunctions: FcaControlledFunction[];
  registerUrl: string;
  asOf: string;
}
interface FcaCandidate { irn: string; name: string; status: string }

type DocState = "to_collect" | "requested" | "provided" | "na";

// Company-website proof that the person works where the wealth story says they
// do — the banker finds them on the firm's Team / About / People page and
// attaches a screenshot of that profile to the file. (A future automated
// capture — Playwright visiting the site and screenshotting the profile — can
// populate `profileUrl` + an attached image behind a `configured` gate, the
// same way the FCA extract is fetched automatically when keys are present.)
interface EmployerProof {
  company?: string;
  profileUrl?: string;
  state?: DocState;
}

export interface CorroborationData {
  regulated?: boolean;
  fca?: FcaExtract | null;
  employer?: EmployerProof;
  docs?: Record<string, DocState>;
}

const SUGGESTED_DOCS: { id: string; label: string }[] = [
  { id: "bankStatement", label: "Bank statement evidencing the funds / accumulated wealth" },
  { id: "saleCompletion", label: "Sale or completion statement (business or asset disposal)" },
  { id: "employment", label: "Employment contract / payslip / bonus or carry statement" },
  { id: "taxReturn", label: "Tax return or assessment" },
  { id: "inheritance", label: "Probate, will or deed of gift (inheritance / gift)" },
];

const DOC_STATES: { value: DocState; label: string }[] = [
  { value: "to_collect", label: "To collect" },
  { value: "requested", label: "Requested" },
  { value: "provided", label: "Provided" },
  { value: "na", label: "Not applicable" },
];

const fcaSearchPageUrl = (name: string) =>
  `https://register.fca.org.uk/s/search?q=${encodeURIComponent(name)}&type=Individuals`;

// A web search pre-aimed at the person's profile on their employer's own site
// (team / about / people / leadership pages), where a screenshot proves the
// employment that underpins the wealth story.
const employerProfileSearchUrl = (name: string, company: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(
    `"${name}"${company ? ` "${company}"` : ""} (team OR about OR people OR leadership OR "our team")`,
  )}`;

export function CorroborationDocuments({
  clientName,
  value,
  onChange,
}: {
  clientName: string;
  value: CorroborationData | undefined;
  onChange: (value: CorroborationData) => void;
}) {
  const data = value ?? {};
  // Mirror of the latest value so async callbacks (the FCA attach) merge onto
  // the CURRENT data — never a stale render snapshot that would clobber newer
  // edits (e.g. document states changed while a lookup was in flight).
  const dataRef = useRef(data);
  dataRef.current = data;
  const update = (partial: Partial<CorroborationData>) => onChange({ ...dataRef.current, ...partial });

  const [query, setQuery] = useState(clientName);
  const [results, setResults] = useState<FcaCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ["fca-status"],
    queryFn: () => customFetch<{ configured: boolean }>("/api/fca/status"),
    staleTime: 5 * 60_000,
  });
  const configured = status.data?.configured === true;

  // Monotonic tokens so a slow in-flight search/attach can't apply after the
  // banker has moved on (new search, different individual, or section unticked).
  // A response is honoured only if its token still matches the current one.
  const searchSeq = useRef(0);
  const attachSeq = useRef(0);
  const search = useMutation({
    mutationFn: ({ q }: { q: string; seq: number }) =>
      customFetch<{ configured: boolean; results: FcaCandidate[]; fallbackUrl: string }>(
        `/api/fca/individuals/search?q=${encodeURIComponent(q)}`,
      ),
    // Drop the prior candidate list immediately so a failed/slow re-search can't
    // leave stale results from a different name attachable on screen.
    onMutate: () => { setError(null); setResults(null); },
    onSuccess: (res, vars) => {
      if (vars.seq !== searchSeq.current) return;
      // Keys removed since the cached status check — re-probe status so the UI
      // switches to the manual path (and can recover later without a reload).
      if (!res.configured) { setResults(null); status.refetch(); return; }
      setResults(res.results);
    },
    onError: (_e, vars) => { if (vars.seq === searchSeq.current) setError("The FCA register search failed. Please try again."); },
  });
  // Starting a new search also invalidates any pending attach from the old list.
  const runSearch = (q: string) => {
    attachSeq.current++;
    search.mutate({ q, seq: ++searchSeq.current });
  };

  const attach = useMutation({
    mutationFn: ({ irn }: { irn: string; seq: number }) =>
      customFetch<{ configured: boolean; extract: FcaExtract }>(
        `/api/fca/individuals/${encodeURIComponent(irn)}`,
      ),
    onMutate: () => setError(null),
    onSuccess: (res, vars) => {
      // Ignore if this is no longer the current attach, or the banker unticked
      // "FCA-regulated" while it was in flight.
      if (vars.seq !== attachSeq.current || !dataRef.current.regulated) { setResults(null); return; }
      update({ fca: res.extract });
      setResults(null);
    },
    onError: (_e, vars) => {
      if (vars.seq === attachSeq.current) setError("That FCA record could not be retrieved. Please try again.");
    },
  });
  const runAttach = (irn: string) => attach.mutate({ irn, seq: ++attachSeq.current });

  const docState = (id: string): DocState => (data.docs?.[id] as DocState) ?? "to_collect";
  const setDocState = (id: string, s: DocState) => update({ docs: { ...(data.docs ?? {}), [id]: s } });

  const employer = data.employer ?? {};
  const setEmployer = (partial: Partial<EmployerProof>) =>
    update({ employer: { ...employer, ...partial } });

  return (
    <div className="space-y-6 border-t border-border pt-8">
      <div className="flex items-start gap-3">
        <FileCheck2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div className="space-y-1">
          <h3 className="font-serif text-lg">Corroboration documents</h3>
          <p className="text-sm text-muted-foreground">
            The evidence that backs this Source of Wealth statement — to be supplied to your
            onboarding officer. For a regulated individual the FCA register extract is attached
            automatically; collect or upload the rest.
          </p>
        </div>
      </div>

      {/* FCA register check */}
      <div className="border border-border bg-secondary/20 p-4 space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox
            checked={!!data.regulated}
            onCheckedChange={(c) => {
              // Turning it off clears any attached extract — the banker has said
              // the client is not regulated, so no FCA record should linger.
              if (c) update({ regulated: true });
              else {
                // Invalidate any in-flight search/attach so a late response
                // can't repopulate or re-attach after the banker turned it off.
                searchSeq.current++; attachSeq.current++;
                update({ regulated: false, fca: null }); setResults(null);
              }
            }}
            className="mt-0.5 rounded-sm border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          />
          <span className="text-sm font-medium">
            FCA-regulated individual
            <span className="block text-xs font-normal text-muted-foreground">
              Tick to attach the FCA Financial Services Register extract as corroboration.
            </span>
          </span>
        </label>

        {data.regulated && (
          <div className="pl-7 space-y-3">
            {data.fca ? (
              <FcaExtractCard extract={data.fca} onRemove={() => update({ fca: null })} />
            ) : (
              <>
              {/* Outstanding-item note for the printed handoff (the controls below
                  are screen-only). */}
              <p className="hidden print:block text-sm text-muted-foreground">
                FCA Financial Services Register extract — outstanding; attach a register printout to the file.
              </p>
              <div className="space-y-3 print:hidden">
                {status.isLoading ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Checking FCA lookup…
                  </p>
                ) : status.isError ? (
                  <div className="space-y-2 text-sm">
                    <p className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="w-4 h-4" /> Couldn't check whether FCA lookup is available.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button size="sm" variant="outline" onClick={() => status.refetch()} className="h-8 rounded-md">
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
                      </Button>
                      <a
                        href={fcaSearchPageUrl(query || clientName)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-primary underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> or check the register manually
                      </a>
                    </div>
                  </div>
                ) : configured ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Name to search on the FCA register"
                        className="h-9 max-w-xs rounded-md border-border bg-card"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && query.trim()) runSearch(query.trim());
                        }}
                      />
                      <Button
                        onClick={() => query.trim() && runSearch(query.trim())}
                        disabled={search.isPending || !query.trim()}
                        className="h-9 rounded-md bg-primary text-primary-foreground"
                      >
                        {search.isPending ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching…</>
                        ) : (
                          <><Search className="w-4 h-4 mr-2" /> Search register</>
                        )}
                      </Button>
                    </div>

                    {results && results.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No individuals matched. Try a different spelling, or{" "}
                        <a className="underline" href={fcaSearchPageUrl(query)} target="_blank" rel="noopener noreferrer">
                          search the register directly
                        </a>.
                      </p>
                    )}
                    {results && results.length > 0 && (
                      <ul className="space-y-2">
                        {results.map((r) => (
                          <li
                            key={r.irn}
                            className="flex items-center justify-between gap-3 border border-border bg-card px-3 py-2 rounded-md"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{r.name}</p>
                              <p className="text-xs text-muted-foreground">
                                IRN {r.irn}{r.status ? ` · ${r.status}` : ""}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={attach.isPending}
                              onClick={() => runAttach(r.irn)}
                              className="h-8 rounded-md shrink-0"
                            >
                              {attach.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Attach"}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p>
                      Automatic lookup isn't configured. Open the FCA register, find the individual,
                      and attach a printout to the file:
                    </p>
                    <a
                      href={fcaSearchPageUrl(query || clientName)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary underline"
                    >
                      <ExternalLink className="w-4 h-4" /> Search the FCA register for {query || clientName}
                    </a>
                  </div>
                )}

                {error && (
                  <div className="space-y-1">
                    <p className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="w-4 h-4" /> {error}
                    </p>
                    <a
                      href={fcaSearchPageUrl(query || clientName)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Open the FCA register to check manually
                    </a>
                  </div>
                )}
              </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Company / employer corroboration — proof the person works where the
          wealth story says. Manual today (find them on the firm's site, attach a
          screenshot); the automated capture can populate this later. */}
      <div className="border border-border bg-secondary/20 p-4 space-y-4">
        <div className="flex items-start gap-3">
          <Building2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Company / employer proof</h3>
            <p className="text-xs text-muted-foreground">
              Find {clientName || "the client"} on their employer's own site — the Team, About or
              People page — and attach a screenshot of that profile. It corroborates the employment
              the wealth story rests on.
            </p>
          </div>
        </div>

        <div className="pl-8 space-y-3 print:hidden">
          <div className="flex flex-wrap gap-2">
            <Input
              value={employer.company ?? ""}
              onChange={(e) => setEmployer({ company: e.target.value })}
              placeholder="Employer / company name"
              className="h-9 max-w-xs rounded-md border-border bg-card"
            />
            <a
              href={employerProfileSearchUrl(clientName, employer.company ?? "")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card text-sm hover:bg-secondary"
            >
              <Search className="w-4 h-4" /> Find on the company site
            </a>
          </div>
          <Input
            value={employer.profileUrl ?? ""}
            onChange={(e) => setEmployer({ profileUrl: e.target.value })}
            placeholder="Profile URL where they were found (paste here)"
            className="h-9 rounded-md border-border bg-card"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Screenshot of profile attached to file:</span>
            <Select
              value={employer.state ?? "to_collect"}
              onValueChange={(v) => setEmployer({ state: v as DocState })}
            >
              <SelectTrigger className="w-[170px] h-8 rounded-md border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-md">
                {DOC_STATES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Print handoff line */}
        <div className="hidden print:block pl-8 text-sm">
          {employer.company ? (
            <p>
              <strong>Employer:</strong> {employer.company}
              {employer.profileUrl ? ` — ${employer.profileUrl}` : ""}
              {` (${DOC_STATES.find((s) => s.value === (employer.state ?? "to_collect"))?.label})`}
            </p>
          ) : (
            <p className="text-muted-foreground">
              Company employment proof — outstanding; attach a screenshot of the profile from the
              employer's site to the file.
            </p>
          )}
        </div>
      </div>

      {/* Suggested supporting documents */}
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Supporting documents to collect
          </p>
          <p className="text-sm text-muted-foreground">
            Suggested documents that would corroborate this client's wealth story. Use them as a
            prompt for what to ask the client for — collect what fits, mark the rest not applicable.
          </p>
        </div>
        <div className="grid gap-2">
          {SUGGESTED_DOCS.map((d) => (
            <div
              key={d.id}
              className="flex flex-col md:flex-row md:items-center justify-between gap-3 border border-border bg-card px-3 py-2.5 rounded-md"
            >
              <span className="text-sm flex-1">{d.label}</span>
              <Select value={docState(d.id)} onValueChange={(v) => setDocState(d.id, v as DocState)}>
                <SelectTrigger className="w-[170px] h-8 rounded-md border-border print:hidden">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-md">
                  {DOC_STATES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="hidden print:inline text-sm text-muted-foreground">
                {DOC_STATES.find((s) => s.value === docState(d.id))?.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FcaExtractCard({ extract, onRemove }: { extract: FcaExtract; onRemove: () => void }) {
  const current = extract.controlledFunctions.filter((c) => c.current);
  const previous = extract.controlledFunctions.filter((c) => !c.current);
  return (
    <div className="border border-emerald-500/30 bg-emerald-500/[0.04] rounded-md">
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-emerald-500/20">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">FCA Financial Services Register extract</p>
            <p className="text-xs text-muted-foreground">
              Retrieved {new Date(extract.asOf).toLocaleString()}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive print:hidden"
          aria-label="Remove FCA extract"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-4 py-3 space-y-3 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <span className="text-muted-foreground">Name</span><span className="font-medium">{extract.name}</span>
          <span className="text-muted-foreground">IRN</span><span className="font-medium tabular-nums">{extract.irn}</span>
          <span className="text-muted-foreground">Status</span>
          <span className="font-medium inline-flex items-center gap-1.5">
            {extract.status || "—"}
            {/^(active|approved|authorised|authorized)$/i.test(extract.status.trim()) && (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            )}
          </span>
        </div>

        {current.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current controlled functions</p>
            <ul className="space-y-1">
              {current.map((c, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium">{c.name}</span>
                  {c.firm ? ` — ${c.firm}` : ""}
                  {c.effectiveDate ? <span className="text-muted-foreground"> (from {c.effectiveDate})</span> : null}
                </li>
              ))}
            </ul>
          </div>
        )}
        {previous.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Previous controlled functions</p>
            <ul className="space-y-1">
              {previous.slice(0, 8).map((c, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  {c.name}{c.firm ? ` — ${c.firm}` : ""}
                  {c.endDate ? <span className="text-muted-foreground/70"> (to {c.endDate})</span> : null}
                </li>
              ))}
              {previous.length > 8 && (
                <li className="text-xs text-muted-foreground/70">+{previous.length - 8} earlier appointment{previous.length - 8 === 1 ? "" : "s"}</li>
              )}
            </ul>
          </div>
        )}

        <a
          href={extract.registerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary underline"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Verify on the live FCA register
        </a>
      </div>
      <div className="px-4 py-2 border-t border-emerald-500/20 print:hidden">
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="w-3 h-3" /> Replace with a different individual
        </button>
      </div>
    </div>
  );
}
