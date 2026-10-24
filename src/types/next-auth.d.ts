import type { DefaultSession } from "next-auth";
import type { Role } from "@/server/tenancy/permissions";

declare module "next-auth" {
  interface User {
    tenantId: string;
    membershipId: string;
    role: Role;
  }
  interface Session {
    user: {
      id: string;
      tenantId: string;
      membershipId: string;
      role: Role;
    } & DefaultSession["user"];
  }
}
