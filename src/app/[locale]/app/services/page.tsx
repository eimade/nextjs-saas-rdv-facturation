import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { toggleServiceAction } from "@/actions/team";
import { ActionButton } from "@/components/action-button";
import { ServiceForm } from "@/components/team-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/utils";
import { requirePageContext } from "@/server/page-context";
import { can } from "@/server/tenancy/permissions";
import { listServices } from "@/server/tenancy/tenancy-service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("services") };
}

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ctx = await requirePageContext(locale);
  const t = await getTranslations("services");
  const services = await listServices(ctx);
  const manage = can(ctx.role, "services:manage");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      {manage && (
        <Card>
          <CardHeader>
            <CardTitle>{t("addTitle")}</CardTitle>
            <CardDescription>{t("addHelp")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ServiceForm />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="pt-5">
          {services.length === 0 ? (
            <p className="text-muted-foreground">{t("empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t("name")}</TableHead>
                  <TableHead scope="col">{t("duration")}</TableHead>
                  <TableHead scope="col" className="text-end">
                    {t("price")}
                  </TableHead>
                  <TableHead scope="col">{t("state")}</TableHead>
                  {manage && (
                    <TableHead scope="col">
                      <span className="sr-only">{t("actions")}</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{t("minutes", { minutes: s.durationMin })}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatMoney(s.priceCents, ctx.currency, locale)}</TableCell>
                    <TableCell>
                      <Badge variant={s.active ? "success" : "outline"}>{s.active ? t("active") : t("inactive")}</Badge>
                    </TableCell>
                    {manage && (
                      <TableCell>
                        <ActionButton
                          action={toggleServiceAction}
                          fields={{ serviceId: s.id }}
                          variant="ghost"
                          aria-label={s.active ? t("deactivateFor", { name: s.name }) : t("activateFor", { name: s.name })}
                        >
                          {s.active ? t("deactivate") : t("activate")}
                        </ActionButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
