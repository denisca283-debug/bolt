export type Profile = {
  id: string;
  full_name: string | null;
  public_slug: string | null;
  city: string | null;
  country: string | null;
  date_of_birth: string | null;
  gender: string | null;
  avatar_url: string | null;
  about: string | null;
  availability_status: 'available' | 'busy' | 'limited';
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type Department = {
  id: string;
  name: string;
  sort_order: number;
};

export type Profession = {
  id: string;
  department_id: string;
  name: string;
  sort_order: number;
};

export type UserProfession = {
  id: string;
  user_id: string;
  profession_id: string;
  is_primary: boolean;
  experience_years: number | null;
  description: string | null;
  created_at: string;
  profession?: Profession;
  department?: Department;
};

export type Skill = {
  id: string;
  name: string;
};

export type UserSkill = {
  id: string;
  user_id: string;
  skill_id: string;
  skill?: Skill;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  organization_type: string;
  description: string | null;
  logo_url: string | null;
  city: string | null;
  website: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type VerificationRecord = {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  verification_type: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
};

export type Permission = {
  id: string;
  name: string;
  description: string | null;
};

export type UserPermission = {
  id: string;
  user_id: string;
  permission_id: string;
  permission?: Permission;
};

export type AuthUser = {
  id: string;
  email: string;
};
