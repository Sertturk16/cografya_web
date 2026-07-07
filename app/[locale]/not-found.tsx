import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

// Localized 404 boundary. A real 404 status (not a soft-200) is returned for
// unknown slugs via notFound() (CONVENTIONS §6 #6).
export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <div className="container page">
      <h1>{t("heading")}</h1>
      <p className="lede">{t("body")}</p>
      <p className="section">
        <Link className="btn btn-primary" href="/">
          {t("backHome")}
        </Link>
      </p>
    </div>
  );
}
