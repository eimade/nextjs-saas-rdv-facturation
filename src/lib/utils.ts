import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function intlLocale(locale: string): string {
  return locale === "ar" ? "ar-MA" : locale === "en" ? "en-GB" : "fr-FR";
}

export function formatMoney(cents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency }).format(cents / 100);
}

export function formatTime(date: Date, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone, hour: "2-digit", minute: "2-digit" }).format(date);
}

export function formatDate(date: Date, timeZone: string, locale: string, withWeekday = false): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withWeekday ? { weekday: "long" } : {}),
  }).format(date);
}
