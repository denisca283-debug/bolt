/*
# user_professions integrity constraints

1. Purpose
   Prevent duplicate (user_id, profession_id) pairs and enforce
   at most one is_primary=true per user.

2. Changes
   - Normalize existing duplicates: if a user has multiple rows with
     is_primary=true, keep the earliest one and set the rest to false.
   - Remove duplicate (user_id, profession_id) rows, keeping the earliest by created_at.
   - Add UNIQUE index on (user_id, profession_id).
   - Add partial UNIQUE index on (user_id) WHERE is_primary = true.

3. Security
   No RLS or policy changes.

4. Notes
   Both indexes are created IF NOT EXISTS so re-running is safe.
*/

-- Step 1: Normalize — set is_primary=false for all but the earliest primary per user
UPDATE user_professions
SET is_primary = false
WHERE is_primary = true
  AND id NOT IN (
    SELECT DISTINCT up.id
    FROM user_professions up
    INNER JOIN LATERAL (
      SELECT id
      FROM user_professions up2
      WHERE up2.user_id = up.user_id AND up2.is_primary = true
      ORDER BY up2.created_at ASC
      LIMIT 1
    ) keep ON true
  );

-- Step 2: Deduplicate (user_id, profession_id) pairs — keep earliest by created_at
DELETE FROM user_professions
WHERE id NOT IN (
  SELECT DISTINCT up.id
  FROM user_professions up
  INNER JOIN LATERAL (
    SELECT id
    FROM user_professions up2
    WHERE up2.user_id = up.user_id AND up2.profession_id = up.profession_id
    ORDER BY up2.created_at ASC
    LIMIT 1
  ) keep ON true
);

-- Step 3: Unique constraint on (user_id, profession_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_professions_user_profession
  ON user_professions (user_id, profession_id);

-- Step 4: At most one primary profession per user
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_professions_one_primary
  ON user_professions (user_id)
  WHERE is_primary = true;
