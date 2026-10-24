-- =====================================================================
-- Isolation multi-tenant par Row Level Security + contraintes métier
-- =====================================================================

-- 1) Rôle applicatif sans privilège (NOLOGIN) : l'application l'endosse via
--    SET LOCAL ROLE dans chaque transaction "tenant" (voir src/server/db.ts).
--    Il n'a pas BYPASSRLS : les politiques ci-dessous s'appliquent toujours.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'uimad_agenda_app') THEN
    CREATE ROLE uimad_agenda_app NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO uimad_agenda_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO uimad_agenda_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO uimad_agenda_app;

-- Le tenant courant est porté par la variable de session transactionnelle app.tenant_id.
CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '') $$;

-- 2) Activation RLS (FORCE : s'applique aussi au propriétaire de la table)
ALTER TABLE memberships      ENABLE ROW LEVEL SECURITY; ALTER TABLE memberships      FORCE ROW LEVEL SECURITY;
ALTER TABLE invitations      ENABLE ROW LEVEL SECURITY; ALTER TABLE invitations      FORCE ROW LEVEL SECURITY;
ALTER TABLE services         ENABLE ROW LEVEL SECURITY; ALTER TABLE services         FORCE ROW LEVEL SECURITY;
ALTER TABLE clients          ENABLE ROW LEVEL SECURITY; ALTER TABLE clients          FORCE ROW LEVEL SECURITY;
ALTER TABLE availability     ENABLE ROW LEVEL SECURITY; ALTER TABLE availability     FORCE ROW LEVEL SECURITY;
ALTER TABLE absences         ENABLE ROW LEVEL SECURITY; ALTER TABLE absences         FORCE ROW LEVEL SECURITY;
ALTER TABLE appointments     ENABLE ROW LEVEL SECURITY; ALTER TABLE appointments     FORCE ROW LEVEL SECURITY;
ALTER TABLE invoices         ENABLE ROW LEVEL SECURITY; ALTER TABLE invoices         FORCE ROW LEVEL SECURITY;
ALTER TABLE invoice_counters ENABLE ROW LEVEL SECURITY; ALTER TABLE invoice_counters FORCE ROW LEVEL SECURITY;

-- 3) Politiques : lecture ET écriture limitées au tenant courant
CREATE POLICY tenant_isolation ON memberships      USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());
CREATE POLICY tenant_isolation ON invitations      USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());
CREATE POLICY tenant_isolation ON services         USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());
CREATE POLICY tenant_isolation ON clients          USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());
CREATE POLICY tenant_isolation ON availability     USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());
CREATE POLICY tenant_isolation ON absences         USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());
CREATE POLICY tenant_isolation ON appointments     USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());
CREATE POLICY tenant_isolation ON invoices         USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());
CREATE POLICY tenant_isolation ON invoice_counters USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());

-- 4) Anti double réservation : deux RDV non annulés d'un même praticien ne peuvent pas se chevaucher.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (membership_id WITH =, tsrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (status <> 'CANCELLED');

ALTER TABLE appointments ADD CONSTRAINT appointments_valid_range CHECK (ends_at > starts_at);
ALTER TABLE availability ADD CONSTRAINT availability_valid_range
  CHECK (weekday BETWEEN 0 AND 6 AND start_minute >= 0 AND end_minute <= 1440 AND end_minute > start_minute);
ALTER TABLE absences ADD CONSTRAINT absences_valid_range CHECK (ends_at > starts_at);
