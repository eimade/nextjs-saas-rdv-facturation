import { CalendarCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme";

export async function SiteHeader({ children }: { children?: React.ReactNode }) {
  const t = await getTranslations("common");
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="inline-flex items-center gap-2 rounded-md text-lg font-bold text-primary">
          <CalendarCheck aria-hidden className="size-6" />
          <span>Uimad Agenda</span>
          <span className="sr-only"> – {t("home")}</span>
        </Link>
        <div className="flex items-center gap-2">
          {children}
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
