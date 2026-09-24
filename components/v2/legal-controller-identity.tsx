import { Mail } from "lucide-react";
import { LEGAL_CONTROLLER, type LegalController } from "@/lib/legal/controller";

export interface LegalControllerIdentityLabels {
  readonly siteName: string;
  readonly legalName: string;
  readonly address: string;
  readonly phone: string;
  readonly email: string;
}

export interface LegalControllerIdentityProps {
  readonly labels: LegalControllerIdentityLabels;
  /** Injected in tests; pages always render {@link LEGAL_CONTROLLER}. */
  readonly controller?: LegalController;
}

/**
 * The data controller / content provider identity block (T-101, KVKK md. 10, 5651 md. 3).
 *
 * A `null` field is OMITTED, not rendered as "—" or "yakında": an empty künye row would state
 * that the site has no address, which is a claim, not a gap. Labels come in as props so the
 * block stays a plain server component that renders the same on `/gizlilik` and `/hakkimizda`.
 */
export function LegalControllerIdentity({
  labels,
  controller = LEGAL_CONTROLLER,
}: LegalControllerIdentityProps) {
  const rows: Array<{ key: string; label: string; value: string }> = [
    { key: "siteName", label: labels.siteName, value: controller.siteName },
    ...(controller.legalName
      ? [{ key: "legalName", label: labels.legalName, value: controller.legalName }]
      : []),
    ...(controller.address
      ? [{ key: "address", label: labels.address, value: controller.address }]
      : []),
    ...(controller.phone ? [{ key: "phone", label: labels.phone, value: controller.phone }] : []),
  ];

  return (
    <dl className="grid max-w-prose gap-3 rounded-2xl border border-border bg-card p-4 text-sm sm:p-5">
      {rows.map((row) => (
        <div key={row.key} className="grid gap-0.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
          <dt className="font-medium text-muted-foreground">{row.label}</dt>
          <dd className="break-words font-semibold text-foreground">{row.value}</dd>
        </div>
      ))}
      <div className="grid gap-0.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
        <dt className="font-medium text-muted-foreground">{labels.email}</dt>
        <dd className="min-w-0">
          <a
            href={`mailto:${controller.email}`}
            className="inline-flex max-w-full items-center gap-2 font-semibold text-primary hover:underline"
          >
            <Mail className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-all">{controller.email}</span>
          </a>
        </dd>
      </div>
    </dl>
  );
}
