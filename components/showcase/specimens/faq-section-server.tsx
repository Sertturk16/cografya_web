import type { Locale } from "@/i18n/routing";
import { FaqSection } from "@/components/patterns/faq-section";
import { Specimen } from "../specimen";

/**
 * The REAL `FaqSection`, and — like `breadcrumbs-server.tsx` next door — deliberately its own
 * file rather than another entry in `duzen.tsx`.
 *
 * `duzen.tsx` is a Client Component. `FaqSection` imports `lib/seo/json-ld` (`server-only`), so
 * rendering it from there breaks `pnpm build` for the whole route —
 * `'server-only' cannot be imported from a Client Component module` — and the check is per FILE,
 * not per export (`components/patterns/rsc-boundary.test.ts` has the full account). `components/
 * showcase/specimens/index.tsx` carries no `"use client"`, so it can render the genuine article.
 *
 * ## What the two specimens below demonstrate
 *
 * The two MECHANISMS, and the two ways a block ends up with no structured data — which look
 * identical on screen and are different decisions:
 *
 *   - `structuredData="noindex"` is a block that ASKED for `FAQPage` markup and was refused,
 *     because `isIndexable(locale, "noindex")` is `false` in every locale (`lib/seo/indexing.ts`).
 *     `"noindex"` is this route's own surface — `/design-system` declares it end to end, which
 *     `registry.test.ts` asserts on both route files — so this specimen states the truth about
 *     the page it is standing on rather than leaking a `FAQPage` schema for a made-up FAQ out of
 *     an internal tool.
 *   - `structuredData={false}` is a block that never asked. It is the DEFAULT, because one of the
 *     six blocks this component replaces legitimately publishes no schema.
 *
 * Both render no `<script type="application/ld+json">`, and the difference is visible only in the
 * page source — which is exactly the point being made: the gate is computed from the surface, so
 * a page cannot forget it, and an internal tool cannot leak through it.
 */
const ITEMS = [
  {
    question: "Coğrafi bölge ile idari bölge arasındaki fark nedir?",
    answer:
      "Coğrafi bölge; iklim, yer şekilleri ve bitki örtüsü gibi doğal ölçütlere göre tanımlanır ve yönetsel bir karşılığı yoktur. İdari bölünme ise il ve ilçe sınırlarıyla belirlenir.",
  },
  {
    question: "Bir soru kapalıyken cevabı sayfada kalır mı?",
    answer:
      "Kalır. Akordeon mekanizması Base UI üzerine kuruludur ve kapalı panel DOM'dan silinmez; bu yüzden yapılandırılmış veri ile sayfadaki metin her zaman aynı kaynaktan gelir.",
  },
] as const;

export function FaqSectionServerSpecimen({ locale }: { locale: Locale }) {
  return (
    <>
      <Specimen
        name="FaqSection"
        description={`Altı elle yazılmış SSS bloğunun yerini alan tek bileşen: çapa (\`id\`), \`scroll-mt-28\`, \`tabIndex={-1}\`, erişilebilir ad ve her soruya bir <h3> — hepsi tek yerde. Varsayılan \`list\` mekanizması. Buradaki blok \`structuredData="noindex"\` ile kapılanır: bu sayfanın yüzeyi uçtan uca \`noindex\` olduğundan JSON-LD ÜRETİLMEZ, yani bir iç araç yayına yapılandırılmış veri sızdıramaz.`}
      >
        <FaqSection
          id="ornek-sss-liste"
          heading="Sıkça Sorulan Sorular"
          items={ITEMS}
          locale={locale}
          structuredData="noindex"
        />
      </Specimen>

      <Specimen
        name="FaqSection — accordion"
        description={`Aynı bileşen, \`mechanism="accordion"\`. Sorular \`Accordion.Header\` sayesinde yine <h3> taşır ve kapalı cevap sunucu HTML'inde kalır. \`structuredData\` verilmemiştir (varsayılan \`false\`): şema hiç istenmemiştir — yukarıdaki blokta ise istenmiş ve yüzey kapısı tarafından reddedilmiştir. İkisi ekranda aynı görünür, sayfa kaynağında aynı sebepten değildir.`}
      >
        <FaqSection
          id="ornek-sss-akordeon"
          heading="Sıkça Sorulan Sorular"
          items={ITEMS}
          locale={locale}
          mechanism="accordion"
        />
      </Specimen>
    </>
  );
}
