import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { SiteHeader } from "@/components/site-header";
import { LoginForm } from "@/components/auth-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTenantContext } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("loginTitle") };
}

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (await getTenantContext()) redirect({ href: "/app", locale });
  const t = await getTranslations("auth");
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-md px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle as="h1">{t("loginTitle")}</CardTitle>
            <CardDescription>{t("loginSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
            <p className="mt-6 text-sm">
              {t("noAccount")}{" "}
              <Link href="/signup" className="font-medium text-primary underline">
                {t("signupLink")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
