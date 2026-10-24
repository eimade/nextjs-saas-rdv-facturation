import { LogOut } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { logoutAction } from "@/actions/auth";
import { AppNav, type NavKey } from "@/components/app-nav";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { getTenantContext } from "@/server/session";
import { can } from "@/server/tenancy/permissions";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await getTenantContext();
  if (!ctx) return redirect({ href: "/login", locale });
  const t = await getTranslations("nav");
  const tRoles = await getTranslations("roles");

  const items: { key: NavKey; href: string }[] = [
    { key: "dashboard", href: "/app" },
    { key: "agenda", href: "/app/agenda" },
    { key: "availability", href: "/app/availability" },
  ];
  if (can(ctx.role, "billing:manage")) items.push({ key: "invoices", href: "/app/invoices" });
  items.push({ key: "services", href: "/app/services" });
  items.push({ key: "team", href: "/app/team" });

  return (
    <>
      <SiteHeader>
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {ctx.userName} · {tRoles(ctx.role)}
        </span>
        <form action={logoutAction.bind(null, locale)}>
          <Button type="submit" variant="ghost" size="sm">
            <LogOut aria-hidden />
            {t("logout")}
          </Button>
        </form>
      </SiteHeader>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row">
        <aside className="md:w-56 md:shrink-0">
          <p className="mb-3 px-3 text-sm font-semibold">{ctx.tenantName}</p>
          <AppNav items={items} />
        </aside>
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </>
  );
}
