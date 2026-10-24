import type { Metadata } from "next";
import { Download, FileDown } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createInvoiceAction, setInvoiceStatusAction } from "@/actions/billing";
import { ActionButton } from "@/components/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { listBillableAppointments, listInvoices } from "@/server/billing/billing-service";
import { requirePageContext } from "@/server/page-context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("invoices") };
}

export default async function InvoicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const ctx = await requirePageContext(locale, "billing:manage");
  const sp = await searchParams;
  const status = sp.status === "PAID" || sp.status === "UNPAID" ? sp.status : undefined;
  const t = await getTranslations("invoices");
  const [invoices, billable] = await Promise.all([listInvoices(ctx, status), listBillableAppointments(ctx)]);
  const money = (c: number) => formatMoney(c, ctx.currency, locale);
  const date = (d: Date) => formatDate(d, ctx.timezone, locale);
  const filters = [
    { key: undefined, label: t("all") },
    { key: "UNPAID", label: t("unpaid") },
    { key: "PAID", label: t("paid") },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <a
          href={`/api/invoices/export${status ? `?status=${status}` : ""}`}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
          download
        >
          <Download aria-hidden className="size-4" />
          {t("exportCsv")}
        </a>
      </div>

      {billable.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("toInvoice")}</CardTitle>
            <CardDescription>{t("toInvoiceHelp")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {billable.map((a) => {
                const label = `${date(a.startsAt)} ${a.client.name}`;
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      {date(a.startsAt)} · {a.client.name} · {a.service.name} · {money(a.service.priceCents)}
                    </span>
                    <ActionButton
                      action={createInvoiceAction}
                      fields={{ appointmentId: a.id }}
                      variant="default"
                      aria-label={t("createFor", { label })}
                    >
                      {t("create")}
                    </ActionButton>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>{t("listTitle")}</CardTitle>
          <nav aria-label={t("filterLabel")}>
            <ul className="inline-flex rounded-md border">
              {filters.map((f) => (
                <li key={f.label}>
                  <Link
                    href={f.key ? `/app/invoices?status=${f.key}` : "/app/invoices"}
                    aria-current={status === f.key ? "page" : undefined}
                    className={cn(
                      "block px-3 py-2 text-sm font-medium",
                      status === f.key ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                    )}
                  >
                    {f.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-muted-foreground">{t("empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t("number")}</TableHead>
                  <TableHead scope="col">{t("issuedAt")}</TableHead>
                  <TableHead scope="col">{t("client")}</TableHead>
                  <TableHead scope="col">{t("service")}</TableHead>
                  <TableHead scope="col" className="text-end">
                    {t("amount")}
                  </TableHead>
                  <TableHead scope="col">{t("status")}</TableHead>
                  <TableHead scope="col">
                    <span className="sr-only">{t("actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono font-medium" dir="ltr">
                      {inv.number}
                    </TableCell>
                    <TableCell>{date(inv.issuedAt)}</TableCell>
                    <TableCell>{inv.appointment.client.name}</TableCell>
                    <TableCell>{inv.appointment.service.name}</TableCell>
                    <TableCell className="text-end tabular-nums">{money(inv.amountCents)}</TableCell>
                    <TableCell>
                      <Badge variant={inv.status === "PAID" ? "success" : "warning"}>
                        {inv.status === "PAID" ? t("paidOn", { date: inv.paidAt ? date(inv.paidAt) : "" }) : t("unpaidBadge")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`/api/invoices/${inv.id}/pdf`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary underline"
                          aria-label={t("pdfFor", { number: inv.number })}
                        >
                          <FileDown aria-hidden className="size-4" />
                          PDF
                        </a>
                        <ActionButton
                          action={setInvoiceStatusAction}
                          fields={{ invoiceId: inv.id, status: inv.status === "PAID" ? "UNPAID" : "PAID" }}
                          aria-label={
                            inv.status === "PAID"
                              ? t("markUnpaidFor", { number: inv.number })
                              : t("markPaidFor", { number: inv.number })
                          }
                        >
                          {inv.status === "PAID" ? t("markUnpaid") : t("markPaid")}
                        </ActionButton>
                      </div>
                    </TableCell>
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
