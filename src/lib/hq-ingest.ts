const HQ_API_URL = process.env.HQ_API_URL;
const HQ_INGEST_SECRET = process.env.HQ_INGEST_SECRET;
const HQ_TENANT_ID = process.env.HQ_TENANT_ID;

interface IngestPayload {
  hqUserId: number | null;
  orderNumber: string | null;
  press: string;
  phase: string;
  clockIn: string;
  clockOut: string;
  pausedDurationSec: number;
  sessionQuantity: number | null;
  scrapCount: number | null;
  notes: string | null;
}

/**
 * Fire-and-forget: sends a completed time entry to HQ.
 * Silently skips if env vars are not configured or operator has no hqUserId.
 * Never throws — shop-clock's stop flow must never block on HQ availability.
 */
export function postToHq(payload: IngestPayload): void {
  if (!HQ_API_URL || !HQ_INGEST_SECRET || !HQ_TENANT_ID) return;
  if (!payload.hqUserId) return; // operator not yet synced to HQ
  if (!payload.orderNumber) return; // job has no hqOrderHint set

  const tenantId = Number(HQ_TENANT_ID);

  fetch(`${HQ_API_URL}/api/ingest/shop-clock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-shop-clock-secret": HQ_INGEST_SECRET,
    },
    body: JSON.stringify({ tenantId, ...payload }),
  }).catch((err) => {
    console.warn("[hq-ingest] POST failed (non-blocking):", err?.message ?? err);
  });
}
