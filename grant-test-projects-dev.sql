-- DEV ONLY. Grants the automation suite's test projects (utils/micrositeProjects.ts)
-- to the Automation Test Org so the webhook-driven microsite / site-visit suites
-- can create pages instead of answering "permission denied".
-- Run from the dev host:
--   eval "$(docker exec backend printenv | grep -E '^DB_(HOST|PORT|NAME|USER|PASSWORD)=' | sed 's/^/export /')"
--   PGPASSWORD="$DB_PASSWORD" PGSSLMODE=require psql -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -U "$DB_USER" -f grant-test-projects-dev.sql
SET statement_timeout = '15s';

INSERT INTO project_organizations (project_id, organization_id)
SELECT p.id, 'dbbd53d6-6024-4519-80c8-e438c8e208d1'
FROM projects p
WHERE p.name IN (
  'Abhee Tranquila','Amberstone Codename Lake One','Amberstone Codename Sleek','Amberstone Ventara',
  'Hosachiguru Samruddhi','Hosachiguru Madhuvana','Hosachiguru Maamara','Hosachiguru Unnati - Farm Villa Plots',
  'Hosachiguru Eco Habitat','Hosachiguru Dharani','Hosachiguru Abhivrudhi','Hosachiguru Aamrut',
  'KNS Sampada','KNS Samooha Phase 1','KNS Samooha Phase 2','KNS Samooha Phase 3',
  'KNS Ananta Phase 1','KNS Ananta Phase 2','KNS Ananta Phase 3','KNS Laurel Phase 1','KNS Laurel Phase 2',
  'KNS Aura','KNS Fresco','KNS Unnati Phase 5','KNS Athena phase 1','KNS Athena phase 2','KNS Amora',
  'KNS Sumedha','KNS Calisto Phase 1','KNS Calisto Phase 2','KNS Billore','KNS Anagha Phase 2','KNS Candrill Phase 2',
  'Pride Crosswinds Villas','Pride Euphora',
  'Sumadhura Solace Phase 1','Sumadhura Solace Phase 2','Sumadhura Palais Royale','Sumadhura Olympus',
  'Sumadhura Gardens By Brook','Sumadhura Folium - Phase 4','Sumadhura Edition','Sumadhura Sarang',
  'Sumadhura Pramoda','Sumadhura Panorama','Sumadhura Epitome','Sumadhura Capitol Residences',
  'Farm Showcase','Farm Land Expo','Nyati Evania','Copy of Elegant Atmos','Abhee Aaria'
)
  AND NOT EXISTS (
    SELECT 1 FROM project_organizations po
    WHERE po.project_id = p.id AND po.organization_id = 'dbbd53d6-6024-4519-80c8-e438c8e208d1'
  );

-- Verify: expect ~50 rows (projects missing from dev are simply skipped).
SELECT count(*) AS granted_now
FROM project_organizations
WHERE organization_id = 'dbbd53d6-6024-4519-80c8-e438c8e208d1';
