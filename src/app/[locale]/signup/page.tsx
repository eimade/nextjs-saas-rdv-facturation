import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/site-header";
import { SignupForm } from "@/components/auth-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signupTitle") };
}

export default async function SignupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-md px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle as="h1">{t("signupTitle")}</CardTitle>
            <CardDescription>{t("signupSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <SignupForm />
            <p className="mt-6 text-sm">
              {t("hasAccount")}{" "}
              <Link href="/login" className="font-medium text-primary underline">
                {t("loginLink")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
