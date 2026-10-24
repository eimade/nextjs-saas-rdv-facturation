import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/site-header";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">{t("notFoundTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("notFoundText")}</p>
        <Link href="/" className="mt-6 inline-block font-medium text-primary underline">
          {t("backHome")}
        </Link>
      </main>
    </>
  );
}
