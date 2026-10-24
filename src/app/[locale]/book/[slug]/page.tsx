import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { BookingWizard } from "@/components/booking-wizard";
import { findPublicTenant, getBookingCatalog } from "@/server/booking/booking-service";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await findPublicTenant(slug);
  const t = await getTranslations("booking");
  return { title: tenant ? t("metaTitle", { cabinet: tenant.name }) : t("notFound") };
}

export default async function BookingPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const tenant = await findPublicTenant(slug);
  if (!tenant) notFound();
  const catalog = await getBookingCatalog(tenant.id);
  const t = await getTranslations("booking");
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm font-medium text-primary">{t("eyebrow")}</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{tenant.name}</h1>
        {tenant.address && (
          <p className="mt-2 flex items-center gap-2 text-muted-foreground">
            <MapPin aria-hidden className="size-4" />
            <bdi>{tenant.address}</bdi>
          </p>
        )}
        <div className="mt-8">
          <BookingWizard
            slug={tenant.slug}
            timezone={tenant.timezone}
            currency={tenant.currency}
            services={catalog.services}
            practitioners={catalog.practitioners}
          />
        </div>
      </main>
    </>
  );
}
