import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Toutes les routes sauf API, fichiers statiques et internes Next.js
  matcher: "/((?!api|_next|_vercel|.*\..*).*)",
};
