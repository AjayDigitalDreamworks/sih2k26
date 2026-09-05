import { env } from '../config/env';

/**
 * Fire-and-forget: tell the ML service to run an IMMEDIATE route-risk
 * recalculation because alert / field-report state in the DB just changed.
 *
 * The ML endpoint schedules a background pass with a forced corridor-context
 * refresh, so the new disruption inputs are reflected in the AI Risk page
 * within seconds instead of waiting for the 30-minute pipeline cycle.
 *
 * Never blocks or fails the caller — failures are logged and the periodic
 * 30-minute cycle remains the fallback.
 */
export function notifyRiskRecalculation(reason: string): void {
  const url = `${env.mlServiceUrl.replace(/\/$/, '')}/pipeline/risk/recalculate`;
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
    signal: AbortSignal.timeout(5000),
  })
    .then((res) => {
      if (!res.ok) console.warn(`[ML-TRIGGER] Risk recalc returned ${res.status} (${reason})`);
    })
    .catch((err) => {
      console.warn(`[ML-TRIGGER] Risk recalc request failed (${reason}): ${err?.message || err}`);
    });
}
