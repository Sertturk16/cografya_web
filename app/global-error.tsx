"use client";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Last-resort boundary for errors thrown by the ROOT layout itself
 * (`app/[locale]/layout.tsx`). It replaces the whole document, so it must render
 * its own `<html>`/`<body>`. At this point neither the next-intl request context
 * nor `globals.css` is guaranteed to be present, so this stays intentionally
 * hardcoded, English-minimal, and self-styled with the Terra token hexes inline.
 */
export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fbf8f3",
          color: "#2b2622",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          padding: "24px",
        }}
      >
        <main style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.75rem", margin: "0 0 0.5rem", color: "#2b2622" }}>
            Something went wrong
          </h1>
          <p
            style={{ fontSize: "1.05rem", lineHeight: 1.6, color: "#57504a", margin: "0 0 1.5rem" }}
          >
            An unexpected error occurred. Please try again.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: "#b0522e",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              padding: "11px 20px",
              fontSize: "1rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
