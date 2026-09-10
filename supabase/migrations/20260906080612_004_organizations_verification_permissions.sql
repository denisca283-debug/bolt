/*
# Create organizations, organization_members, verification_records, permissions, user_permissions

1. New Tables
- `organizations` — production companies, studios, agencies, schools, etc.
- `organization_members` — membership with roles (owner/admin/member)
- `verification_records` — structured multi-dimensional trust verification
- `permissions` — extensible permission catalog
- `user_permissions` — grants permissions to users

2. Security
- organizations: public read; owner/admin can update; owner can insert
- organization_members: public read; only org owner/admin can insert/delete
- verification_records: users can READ own + INSERT pending requests; NO self-approval
- permissions: public read; user_permissions: public read; NO client-side grant

3. Critical Trust Rules
- Users CANNOT grant themselves permissions
- Users CANNOT approve their own verification
- Users CANNOT set trusted_organizer or moderator status
*/

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  organization_type text NOT NULL,
  description text,
  logo_url text,
  city text,
  website text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  verification_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text
);

CREATE TABLE IF NOT EXISTS user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- organizations policies
DROP POLICY IF EXISTS "organizations_public_read" ON organizations;
CREATE POLICY "organizations_public_read"
  ON organizations FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "organizations_owner_insert" ON organizations;
CREATE POLICY "organizations_owner_insert"
  ON organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "organizations_owner_admin_update" ON organizations;
CREATE POLICY "organizations_owner_admin_update"
  ON organizations FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organizations.id
        AND om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organizations.id
        AND om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

-- organization_members policies
DROP POLICY IF EXISTS "org_members_public_read" ON organization_members;
CREATE POLICY "org_members_public_read"
  ON organization_members FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "org_members_admin_insert" ON organization_members;
CREATE POLICY "org_members_admin_insert"
  ON organization_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organizations o
      LEFT JOIN organization_members om ON om.organization_id = o.id AND om.user_id = auth.uid()
      WHERE o.id = organization_members.organization_id
        AND (o.created_by = auth.uid() OR om.role IN ('owner', 'admin'))
    )
  );

DROP POLICY IF EXISTS "org_members_admin_delete" ON organization_members;
CREATE POLICY "org_members_admin_delete"
  ON organization_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM organizations o
      LEFT JOIN organization_members om ON om.organization_id = o.id AND om.user_id = auth.uid()
      WHERE o.id = organization_members.organization_id
        AND (o.created_by = auth.uid() OR om.role IN ('owner', 'admin'))
    )
  );

-- verification_records policies
DROP POLICY IF EXISTS "verification_owner_read" ON verification_records;
CREATE POLICY "verification_owner_read"
  ON verification_records FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "verification_owner_insert" ON verification_records;
CREATE POLICY "verification_owner_insert"
  ON verification_records FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL);

-- NO UPDATE policy on verification_records: users cannot approve/reject themselves.

-- permissions policies
DROP POLICY IF EXISTS "permissions_public_read" ON permissions;
CREATE POLICY "permissions_public_read"
  ON permissions FOR SELECT TO anon, authenticated USING (true);

-- user_permissions policies
DROP POLICY IF EXISTS "user_permissions_public_read" ON user_permissions;
CREATE POLICY "user_permissions_public_read"
  ON user_permissions FOR SELECT TO anon, authenticated USING (true);

-- NO INSERT/UPDATE/DELETE on user_permissions: only service role can grant.

-- Seed permissions catalog
INSERT INTO permissions (name, description) VALUES
  ('create_project', 'Создание проектов'),
  ('publish_job', 'Публикация вакансий и ролей'),
  ('invite_to_project', 'Приглашение в проект'),
  ('manage_project', 'Управление проектом'),
  ('review_applications', 'Просмотр и рассмотрение заявок'),
  ('create_group_chat', 'Создание групповых чатов'),
  ('create_project_chat', 'Создание чатов проекта'),
  ('create_professional_discussion', 'Создание профессиональных обсуждений'),
  ('target_profession', 'Таргетинг на конкретную профессию'),
  ('target_department', 'Таргетинг на департамент'),
  ('target_multiple_departments', 'Таргетинг на несколько департаментов'),
  ('target_entire_community', 'Таргетинг на всё сообщество'),
  ('publish_marketplace_listing', 'Публикация объявлений в Кинобарахолке'),
  ('moderate_discussion', 'Модерация обсуждений')
ON CONFLICT DO NOTHING;

-- Auto-update updated_at for organizations
DROP TRIGGER IF EXISTS organizations_updated_at ON organizations;
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
