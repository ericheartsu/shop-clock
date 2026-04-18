/**
 * Printavo GraphQL v2 client — isolated so we can swap it out
 * when HQ Print's order-lookup API takes over.
 *
 * Auth: two headers `email` and `token` (NOT Authorization).
 * Reference: C:\Dev\hq-print\scripts\enrich-printavo-garments.ts
 */

const API_URL = process.env.PRINTAVO_API_URL ?? 'https://www.printavo.com/api/v2';
const API_EMAIL = process.env.PRINTAVO_API_EMAIL ?? '';
const API_TOKEN = process.env.PRINTAVO_API_TOKEN ?? '';

// MINIMAL fields — only what Shop Clock actually consumes. Printavo has
// a 25k GraphQL complexity limit; bloated queries with first:100 exploded
// to 913k. Dropped: id's, position, mockups (not displayed), lineItem
// metadata (description/itemNumber/color/price), size names. Imprints
// capped at 5 per group (no job in practice has more).
// Imprints don't have a dedicated `location` field — `details` holds
// freeform description ("Front", "Back", "Neck Tag") and we treat it
// as the location for Shop Clock purposes.
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
      lineItems { nodes { sizes { count } } }
    }
  }
`;

// Fetch up to 100 matches — Printavo search is fuzzy and ranks PO-number
// matches (and other substring hits) higher than exact visualId matches.
// We cast a wide net, then strict-filter by visualId server-side.
function buildSearchQuery(visualId: string): string {
  const safe = visualId.replace(/"/g, '');
  return `{
    orders(first: 100, query: "${safe}") {
      nodes {
        ... on Quote { ${DETAIL_FIELDS} }
        ... on Invoice { ${DETAIL_FIELDS} }
      }
    }
  }`;
}

export interface PrintavoSize {
  size: string;
  count: number | null;
}

export interface PrintavoLineItem {
  sizes: PrintavoSize[];
}

export interface PrintavoImprint {
  details: string | null;
  typeOfWork: { name: string } | null;
}

export interface PrintavoLineItemGroup {
  imprints?: { nodes: PrintavoImprint[] };
  lineItems: { nodes: PrintavoLineItem[] };
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

/**
 * Flatten imprints across all lineItemGroups into a deduped decoration
 * list. `details` is freeform in Printavo; we use it verbatim as location
 * ("Front", "Back", "Neck Tag", etc.) and fall back to a positional
 * label if the user left it blank.
 */
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

function totalQuantity(order: PrintavoOrder): number {
  let total = 0;
  for (const g of order.lineItemGroups?.nodes ?? []) {
    for (const item of g.lineItems?.nodes ?? []) {
      for (const sz of item.sizes ?? []) {
        if (typeof sz.count === 'number') total += sz.count;
      }
    }
  }
  return total;
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
      // Don't let the shop floor wait forever
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const msg = `Printavo HTTP ${res.status}`;
      console.error('[printavo]', msg);
      return { ok: false, error: msg };
    }

    const json: any = await res.json();
    if (json.errors) {
      const msg = `Printavo GraphQL: ${JSON.stringify(json.errors).slice(0, 200)}`;
      console.error('[printavo]', msg);
      return { ok: false, error: msg };
    }

    const nodes = (json?.data?.orders?.nodes ?? []) as PrintavoOrder[];
    // Strict exact match — Printavo search is fuzzy (matches invoice # as
    // substring of PO numbers etc.). Without this check we'd return the
    // wrong job. Mirrors the pattern in hq-print's enrich-printavo-garments.ts.
    const node = nodes.find((n) => n?.visualId === invoice);
    if (!node) {
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
