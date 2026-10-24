"use client";

import { CalendarDays, Clock, FileText, LayoutDashboard, Stethoscope, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ICONS = {
  dashboard: LayoutDashboard,
  agenda: CalendarDays,
  availability: Clock,
  invoices: FileText,
  services: Stethoscope,
  team: Users,
} as const;

export type NavKey = keyof typeof ICONS;

export function AppNav({ items }: { items: { key: NavKey; href: string }[] }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("label")}>
      <ul className="flex gap-1 overflow-x-auto md:flex-col">
        {items.map(({ key, href }) => {
          const Icon = ICONS[key];
          const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium hover:bg-accent",
                  active && "bg-secondary text-secondary-foreground",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
