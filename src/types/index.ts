export type Profile = {
  search_engine_indexable?: boolean;
  id: string;
  full_name: string | null;
  public_slug: string | null;
  city: string | null;
  country: string | null;
  gender: string | null;
  avatar_url: string | null;
  about: string | null;
  availability_status: 'available' | 'busy' | 'limited';
  created_at: string;
  updated_at: string;
};

// Chat rooms replace the old two-person `conversations` table: a room holds
// any number of members and can be tied to a department.
export type ChatRoomKind = 'direct' | 'group' | 'department';

export type ChatRoom = {
  id: string;
  kind: ChatRoomKind;
  title: string | null;
  department_id: string | null;
  created_by: string;
  last_message_text: string | null;
  last_message_at: string | null;
  created_at: string;
};

export type ChatMember = {
  id: string;
  room_id: string;
  user_id: string;
  role: string;
  last_read_at: string | null;
  joined_at: string;
};

export type ChatMessage = {
  id: string;
  room_id: string;
  sender_id: string;
  body: string;
  created_at: string;
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
  scope?: 'actor' | 'professional' | 'both';
  department_id?: string | null;
  category?: string;
  sort_order?: number;
  is_active?: boolean;
};

// Actor-specific extension of a profile. One row per user who marks
// themselves as an actor; absence of a row means "not an actor".
// Shared identity fields (full_name, city, bio, availability, photo_url)
// are mirrored from `profiles` on save so the actor listing can read this
// table alone — `profiles` stays the single place they are edited.
export type ActorCategory = 'Актёр' | 'Актриса' | 'Массовка' | 'Студент' | 'Модель';

// Normalised shape every people-grid card renders, whoever it came from —
// an `actors` row, a specialist's profile, or (still) the demo data.
export type PersonCardData = {
  id: string;
  slug: string | null;
  name: string;
  subtitle: string | null;
  city: string | null;
  photo: string | null;
  availability: string | null;
};

export type Actor = {
  id: string;
  user_id: string | null;
  full_name: string;
  age: number | null;
  gender: string | null;
  city: string | null;
  height: number | null;
  category: string | null;
  status: string | null;
  hair_color: string | null;
  eye_color: string | null;
  skills: string[];
  experience_years: number | null;
  photo_url: string | null;
  gallery: string[];
  bio: string | null;
  availability: string;
  featured_score: number | null;
  created_at: string;
  updated_at: string;
};

// ── Content published by users ────────────────────────────────────
// These mirror the tables from migrations 008/009. They replace the demo
// rows in src/data/mock.ts wherever a page reads live data.

export type MarketplaceListing = {
  id: string;
  user_id: string;
  organization_id?: string | null;
  title: string;
  mode: string;
  category: string | null;
  city: string | null;
  price: string | null;
  image_url: string | null;
  description: string | null;
  created_at: string;
};

export type WorkOpportunity = {
  id: string;
  organization_id?: string | null;
  user_id: string;
  title: string;
  type: string;
  audience: string;
  project_name: string | null;
  city: string | null;
  shoot_date: string | null;
  age_range: string | null;
  genre: string | null;
  /** Added by migration 011 — which profession the vacancy is actually for. */
  department_id?: string | null;
  profession_id?: string | null;
  pay: string | null;
  spots_total: number | null;
  spots_left: number | null;
  description: string | null;
  applicants_count: number;
  created_at: string;
};

export type ProjectRow = {
  organization_id?: string | null;
  id: string;
  user_id: string;
  title: string;
  logline: string | null;
  genre: string | null;
  stage: string | null;
  city: string | null;
  director: string | null;
  team_size: number | null;
  image_url: string | null;
  casting_roles: string[];
  created_at: string;
  updated_at: string;
};

export type PulseEntry = {
  id: string;
  user_id: string | null;
  kind: string;
  person: string;
  initials: string | null;
  photo_url: string | null;
  action: string;
  target: string | null;
  created_at: string;
};

/** Minimal author card shown next to a listing, job or project. */
export type AuthorLite = {
  id: string;
  name: string;
  slug: string | null;
  avatarUrl: string | null;
  city: string | null;
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
