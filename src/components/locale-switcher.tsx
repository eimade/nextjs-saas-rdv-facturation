"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = { fr: "FR", en: "EN", ar: "ع" };
const NAMES: Record<string, string> = { fr: "Français", en: "English", ar: "العربية" };

export function LocaleSwitcher() {
  const t = useTranslations("common");
  const current = useLocale();
  const pathname = usePathname();
  return (
    <nav aria-label={t("language")}>
      <ul className="flex items-center gap-1">
        {routing.locales.map((locale) => (
          <li key={locale}>
            <Link
              href={pathname}
              locale={locale}
              lang={locale}
              hrefLang={locale}
              aria-current={locale === current ? "true" : undefined}
              className={cn(
                "inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-medium hover:bg-accent",
                locale === current && "bg-secondary text-secondary-foreground",
              )}
            >
              <span>{LABELS[locale]}</span>
              <span className="sr-only"> {NAMES[locale]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
