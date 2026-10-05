/**
 * What `GET /api/health` answers.
 *
 * `status` is always `"ok"`: if this code runs, the web server is up, and that is what the deploy
 * and Docker's HEALTHCHECK need to know. The API is probed and reported beside it, so an API
 * outage is visible without failing a web deploy that did not cause it.
 */
export interface HealthReport {
  readonly status: "ok";
  readonly api: "ok" | "down";
}

export async function buildHealthReport(probeApi: () => Promise<unknown>): Promise<HealthReport> {
  try {
    await probeApi();
    return { status: "ok", api: "ok" };
  } catch {
    return { status: "ok", api: "down" };
  }
}
