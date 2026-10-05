/**
 * In-container liveness probe: exits 0 when the web server answers `/api/health`, 1 otherwise,
 * and prints the JSON body on success. Run by the Dockerfile's HEALTHCHECK and by `deploy.yml`
 * (`docker compose exec -T web node healthcheck.mjs`); copied to the image root next to
 * `server.js`.
 *
 * Plain Node with no imports: the runner image has only the standalone output. The timeout is
 * above `apiGet`'s 15 s so a hanging API still gets a `"api":"down"` answer instead of a
 * probe failure that would read as "web is down".
 */
const port = process.env.PORT ?? "3000";

try {
  const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    console.error(`health: HTTP ${res.status}`);
    process.exit(1);
  }
  process.stdout.write(`${await res.text()}\n`);
} catch (error) {
  console.error(`health: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
