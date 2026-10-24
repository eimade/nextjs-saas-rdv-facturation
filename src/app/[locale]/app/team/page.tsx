import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InviteForm } from "@/components/team-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { requirePageContext } from "@/server/page-context";
import { can } from "@/server/tenancy/permissions";
import { invitationUrl, listTeam } from "@/server/tenancy/tenancy-service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("team") };
}

export default async function TeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ctx = await requirePageContext(locale);
  const t = await getTranslations("team");
  const tRoles = await getTranslations("roles");
  const { members, invitations } = await listTeam(ctx);
  const manage = can(ctx.role, "team:manage");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      {manage && (
        <Card>
          <CardHeader>
            <CardTitle>{t("inviteTitle")}</CardTitle>
            <CardDescription>{t("inviteHelp")}</CardDescription>
          </CardHeader>
          <CardContent>
            <InviteForm />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t("membersTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t("name")}</TableHead>
                <TableHead scope="col">{t("email")}</TableHead>
                <TableHead scope="col">{t("role")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.user.name}</TableCell>
                  <TableCell dir="ltr" className="text-start">
                    {m.user.email}
                  </TableCell>
                  <TableCell>{tRoles(m.role)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {manage && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("pendingTitle")}</CardTitle>
            <CardDescription>{t("pendingHelp")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {invitations.map((inv) => (
                <li key={inv.id} className="rounded-md border p-3 text-sm">
                  <p className="font-medium">
                    {inv.email} · {tRoles(inv.role)}
                  </p>
                  <p className="text-muted-foreground">
                    {t("expires", { date: formatDate(inv.expiresAt, ctx.timezone, locale) })}
                  </p>
                  <label className="mt-2 block text-xs font-medium" htmlFor={`link-${inv.id}`}>
                    {t("link")}
                  </label>
                  <input
                    id={`link-${inv.id}`}
                    readOnly
                    dir="ltr"
                    value={invitationUrl(inv.token, locale)}
                    className="mt-1 w-full rounded-md border bg-muted px-2 py-1 font-mono text-xs"
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
