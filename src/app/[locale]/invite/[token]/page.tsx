import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/site-header";
import { AcceptInviteForm } from "@/components/auth-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { findInvitation } from "@/server/tenancy/tenancy-service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("inviteTitle") };
}

export default async function InvitePage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  const tRoles = await getTranslations("roles");
  const invitation = token.length <= 100 ? await findInvitation(token) : null;
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-md px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle as="h1">{t("inviteTitle")}</CardTitle>
            {invitation && (
              <CardDescription>
                {t("inviteSubtitle", { cabinet: invitation.tenantName, role: tRoles(invitation.role) })}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {invitation ? (
              <AcceptInviteForm token={token} email={invitation.email} />
            ) : (
              <p role="alert">
                {t("inviteInvalid")}{" "}
                <Link href="/login" className="text-primary underline">
                  {t("loginLink")}
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
