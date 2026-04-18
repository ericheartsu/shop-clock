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

// Fields we need for Phase 0: visual id, name, quantities, line items +
// (optionally) any imprint/decoration metadata Printavo exposes.
const DETAIL_FIELDS = `
  id
  visualId
  nickname
  lineItemGroups {
    nodes {
      position
      lineItems {
        nodes {
          id
          description
          itemNumber
          color
          price
          sizes { size count }
        }
      }
    }
  }
`;

function buildSearchQuery(visualId: string): string {
  const safe = visualId.replace(/"/g, '');
  return `{
    orders(first: 1, query: "${safe}") {
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
  id: string;
  description: string;
  itemNumber: string;
  color: string;
  price: number;
  sizes: PrintavoSize[];
}

export interface PrintavoLineItemGroup {
  position: number;
  lineItems: { nodes: PrintavoLineItem[] };
}

export interface PrintavoOrder {
  id: string;
  visualId: string;
  nickname: string | null;
  lineItemGroups: { nodes: PrintavoLineItemGroup[] };
}

export interface PrintavoLookupResult {
  ok: boolean;
  order?: PrintavoOrder;
  totalQuantity?: number;
  jobName?: string;
  error?: string;
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

    const node = json?.data?.orders?.nodes?.[0] as PrintavoOrder | undefined;
    if (!node) {
      return { ok: false, error: 'Invoice not found' };
    }

    return {
      ok: true,
      order: node,
      totalQuantity: totalQuantity(node),
      jobName: node.nickname ?? undefined,
    };
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error('[printavo] lookup failed:', msg);
    return { ok: false, error: msg };
  }
}
