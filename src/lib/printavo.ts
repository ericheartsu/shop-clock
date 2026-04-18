/**
 * Printavo GraphQL v2 client — isolated so we can swap it out
 * when HQ Print's order-lookup API takes over.
 *
 * Auth: two headers `email` and `token` (NOT Authorization).
 * Reference: C:\Dev\hq-print\scripts\enrich-printavo-garments.ts
 *
 * Printavo constraints (discovered 2026-04-18):
 *   - `orders(first:)` hard-capped at 25
 *   - No `node(id:)` root query
 *   - ~25k GraphQL complexity budget
 *   - Search is fuzzy: "42417" matches PO numbers containing 42417,
 *     sometimes outranking the exact-visualId invoice
 *
 * Strategy: mirror hq-print/scripts/enrich-printavo-garments.ts —
 * single first:1 search with strict visualId equality check. If the
 * top match isn't the exact invoice, treat as not-found and let the
 * caller fall through to manual decoration entry. This is how hq-print
 * enriched 30,582 invoices (1,984 no-match outliers accepted).
 */

const API_URL = process.env.PRINTAVO_API_URL ?? 'https://www.printavo.com/api/v2';
const API_EMAIL = process.env.PRINTAVO_API_EMAIL ?? '';
const API_TOKEN = process.env.PRINTAVO_API_TOKEN ?? '';

// Minimum fields to keep complexity safe across first:25 orders.
// lineItems/sizes are dropped — Printavo's search is too fuzzy for
// first:1 (saw "42422" → visualId "19644" top match), so we need
// wide retrieval. totalQuantity is not available from Printavo in
// Phase 0; the UI tolerates null.
const DETAIL_FIELDS = `
  visualId
  nickname
  lineItemGroups {
    nodes {
      imprints(first: 5) {
        nodes {
          details
          typeOfWork { name }
        }
      }
    }
  }
`;

export interface PrintavoImprint {
  details: string | null;
  typeOfWork: { name: string } | null;
}

export interface PrintavoLineItemGroup {
  imprints?: { nodes: PrintavoImprint[] };
}

export interface PrintavoOrder {
  visualId: string;
  nickname: string | null;
  lineItemGroups: { nodes: PrintavoLineItemGroup[] };
}

/** Flattened imprint record for the Shop Clock DB. */
export interface ExtractedDecoration {
  location: string; // from imprint.details, fallback "Imprint N"
  method: string | null; // from imprint.typeOfWork.name
}

export interface PrintavoLookupResult {
  ok: boolean;
  order?: PrintavoOrder;
  totalQuantity?: number;
  jobName?: string;
  decorations?: ExtractedDecoration[];
  error?: string;
}

function buildSearchQuery(invoice: string): string {
  const safe = invoice.replace(/"/g, '');
  return `{
    orders(first: 25, query: "${safe}") {
      nodes {
        ... on Quote { ${DETAIL_FIELDS} }
        ... on Invoice { ${DETAIL_FIELDS} }
      }
    }
  }`;
}

function extractDecorations(order: PrintavoOrder): ExtractedDecoration[] {
  const out: ExtractedDecoration[] = [];
  const seen = new Set<string>();
  let n = 1;
  for (const g of order.lineItemGroups?.nodes ?? []) {
    for (const imp of g.imprints?.nodes ?? []) {
      const rawLocation = (imp.details ?? '').trim();
      const location = rawLocation || `Imprint ${n}`;
      const method = imp.typeOfWork?.name?.trim() || null;

      // dedupe on (location + method) to avoid creating duplicates if the
      // same design appears in multiple line item groups.
      const key = `${location.toLowerCase()}|${(method ?? '').toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({ location, method });
      n++;
    }
  }
  return out;
}

// Phase 0: Printavo totalQuantity dropped from the query to stay under
// complexity. Always returns 0 — UI can show blank / "—" for qty.
function totalQuantity(_order: PrintavoOrder): number {
  return 0;
}

/**
 * Look up a Printavo invoice by its visual ID. NEVER throws — always
 * returns an object with `ok: false` on failure so the caller can
 * continue to create a manual-entry job.
 */
export async function lookupPrintavoInvoice(
  invoice: string,
): Promise<PrintavoLookupResult> {
  if (!API_EMAIL || !API_TOKEN) {
    const msg = 'Printavo creds missing (PRINTAVO_API_EMAIL / PRINTAVO_API_TOKEN)';
    console.warn('[printavo]', msg);
    return { ok: false, error: msg };
  }

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        email: API_EMAIL,
        token: API_TOKEN,
      },
      body: JSON.stringify({ query: buildSearchQuery(invoice) }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const msg = `Printavo HTTP ${res.status}`;
      console.error('[printavo]', msg);
      return { ok: false, error: msg };
    }

    const json: any = await res.json();
    if (json.errors) {
      const msg = `Printavo GraphQL: ${JSON.stringify(json.errors).slice(0, 300)}`;
      console.error('[printavo]', msg);
      return { ok: false, error: msg };
    }

    const nodes = (json?.data?.orders?.nodes ?? []) as PrintavoOrder[];
    // Strict filter across the 25 fuzzy matches — the exact visualId may
    // not be top-ranked (saw "42422" → "19644" top match).
    const node = nodes.find((n) => String(n?.visualId ?? '') === invoice);
    if (!node) {
      const returned = nodes.map((n) => n?.visualId).filter(Boolean).slice(0, 25);
      console.warn(
        `[printavo] no visualId match for "${invoice}". Returned ${nodes.length}: ${JSON.stringify(returned)}`,
      );
      return { ok: false, error: 'Invoice not found' };
    }

    return {
      ok: true,
      order: node,
      totalQuantity: totalQuantity(node),
      jobName: node.nickname ?? undefined,
      decorations: extractDecorations(node),
    };
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error('[printavo] lookup failed:', msg);
    return { ok: false, error: msg };
  }
}
