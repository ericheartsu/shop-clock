/**
 * Printavo GraphQL v2 client — isolated so we can swap it out
 * when HQ Print's order-lookup API takes over.
 *
 * Auth: two headers `email` and `token` (NOT Authorization).
 * Reference: C:\Dev\hq-print\scripts\enrich-printavo-garments.ts
 *
 * Printavo caps GraphQL queries at 25k complexity. Fuzzy search on a
 * 5-digit invoice routinely returns 100+ substring matches (PO numbers,
 * customer refs). Two-query strategy:
 *   1. Minimal search (id + visualId only) for first:100 -> find match.
 *   2. Relay `node(id: ...)` single-fetch for full detail.
 * Each query stays well under the 25k limit.
 */

const API_URL = process.env.PRINTAVO_API_URL ?? 'https://www.printavo.com/api/v2';
const API_EMAIL = process.env.PRINTAVO_API_EMAIL ?? '';
const API_TOKEN = process.env.PRINTAVO_API_TOKEN ?? '';

// Fields fetched on the single matched order. Imprint `details` is freeform
// and treated as the decoration location ("Front", "Back", "Neck Tag").
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

/** Low-level Printavo fetch. Returns raw parsed JSON or throws. */
async function printavoFetch(query: string): Promise<any> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      email: API_EMAIL,
      token: API_TOKEN,
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL: ${JSON.stringify(json.errors).slice(0, 300)}`);
  }
  return json.data;
}

/** Query 1: minimal fields, wide search, low complexity. */
async function findMatchingOrderId(
  invoice: string,
): Promise<string | null> {
  const safe = invoice.replace(/"/g, '');
  const query = `{
    orders(first: 100, query: "${safe}") {
      nodes {
        ... on Quote { id visualId }
        ... on Invoice { id visualId }
      }
    }
  }`;
  const data = await printavoFetch(query);
  const nodes = (data?.orders?.nodes ?? []) as Array<{
    id: string;
    visualId: string;
  }>;
  const match = nodes.find((n) => n?.visualId === invoice);
  return match?.id ?? null;
}

/** Query 2: single order by Relay node id, full detail. */
async function fetchOrderById(id: string): Promise<PrintavoOrder | null> {
  const safe = id.replace(/"/g, '');
  const query = `{
    node(id: "${safe}") {
      ... on Quote { ${DETAIL_FIELDS} }
      ... on Invoice { ${DETAIL_FIELDS} }
    }
  }`;
  const data = await printavoFetch(query);
  return (data?.node ?? null) as PrintavoOrder | null;
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
    const orderId = await findMatchingOrderId(invoice);
    if (!orderId) {
      return { ok: false, error: 'Invoice not found' };
    }

    const order = await fetchOrderById(orderId);
    if (!order || order.visualId !== invoice) {
      return { ok: false, error: 'Invoice detail mismatch' };
    }

    return {
      ok: true,
      order,
      totalQuantity: totalQuantity(order),
      jobName: order.nickname ?? undefined,
      decorations: extractDecorations(order),
    };
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error('[printavo] lookup failed:', msg);
    return { ok: false, error: msg };
  }
}
