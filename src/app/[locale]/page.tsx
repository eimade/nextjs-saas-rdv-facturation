import { CalendarDays, FileText, Gauge, Globe2 } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const features = [
    { icon: CalendarDays, title: t("f1Title"), text: t("f1Text") },
    { icon: FileText, title: t("f2Title"), text: t("f2Text") },
    { icon: Gauge, title: t("f3Title"), text: t("f3Text") },
    { icon: Globe2, title: t("f4Title"), text: t("f4Text") },
  ];
  return (
    <>
      <SiteHeader>
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">{t("login")}</Link>
        </Button>
      </SiteHeader>
      <main id="main" className="mx-auto max-w-6xl px-4 py-12">
        <section aria-labelledby="hero" className="max-w-3xl">
          <h1 id="hero" className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">{t("subtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/signup">{t("ctaSignup")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/book/cabinet-demo">{t("ctaDemo")}</Link>
            </Button>
          </div>
        </section>
        <section aria-labelledby="features" className="mt-14">
          <h2 id="features" className="sr-only">
            {t("featuresTitle")}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <Card className="h-full">
                  <CardHeader>
                    <Icon aria-hidden className="size-6 text-primary" />
                    <CardTitle className="text-base">{title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{text}</CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
        <aside aria-labelledby="demo" className="mt-14 rounded-lg border bg-muted p-5 text-sm">
          <h2 id="demo" className="font-semibold">
            {t("demoTitle")}
          </h2>
          <p className="mt-2">{t("demoText")}</p>
          <ul className="mt-2 list-disc ps-5">
            <li>
              <code>claire@demo.kalendo.test</code> – {t("roleOwner")}
            </li>
            <li>
              <code>youssef@demo.kalendo.test</code> – {t("rolePractitioner")}
            </li>
            <li>
              <code>sophie@demo.kalendo.test</code> – {t("roleSecretary")}
            </li>
          </ul>
          <p className="mt-2">
            {t("demoPassword")} <code>Demo1234!</code>
          </p>
        </aside>
      </main>
    </>
  );
}
