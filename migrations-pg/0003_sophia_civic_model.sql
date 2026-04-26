-- Migration 0003: Sophia Metapolis Civic Model
-- Replaces citizens table with persons + citizenships separation
-- Adds stamps, person_interests, updates FK references

BEGIN;

-- 1. Create persons table (replaces citizens)
CREATE TABLE IF NOT EXISTS persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handle TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    display_name TEXT,
    country TEXT,
    declaration TEXT,
    status TEXT DEFAULT 'registered' CHECK (status IN ('registered', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS persons_handle_idx ON persons(handle);
CREATE INDEX IF NOT EXISTS persons_email_idx ON persons(email);

-- 2. Create citizenships table (new civic status layer)
CREATE TABLE IF NOT EXISTS citizenships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived', 'departed', 'expelled')),
    granted_at TIMESTAMP WITH TIME ZONE,
    granted_by_decision_id UUID,
    last_activity_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE,
    departed_at TIMESTAMP WITH TIME ZONE,
    expelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS citizenships_person_idx ON citizenships(person_id);
CREATE INDEX IF NOT EXISTS citizenships_status_idx ON citizenships(status);

-- 3. Create stamps table
CREATE TABLE IF NOT EXISTS stamps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    event_context TEXT,
    stamp_type TEXT DEFAULT 'achievement' CHECK (stamp_type IN ('attendance', 'speaker', 'organization', 'sponsor', 'achievement')),
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stamps_person_idx ON stamps(person_id);
CREATE INDEX IF NOT EXISTS stamps_type_idx ON stamps(stamp_type);

-- 4. Rename citizen_postulations -> citizenship_postulations
ALTER TABLE IF EXISTS citizen_postulations RENAME TO citizenship_postulations;
ALTER TABLE IF EXISTS citizenship_postulations RENAME COLUMN citizen_id TO person_id;

-- 5. Rename citizen_interests -> person_interests
ALTER TABLE IF EXISTS citizen_interests RENAME TO person_interests;
ALTER TABLE IF EXISTS person_interests RENAME COLUMN citizen_id TO person_id;

-- 6. Update community_admins foreign key
ALTER TABLE IF EXISTS community_admins RENAME COLUMN citizen_id TO person_id;

-- 7. Update community_participations foreign key
ALTER TABLE IF EXISTS community_participations RENAME COLUMN citizen_id TO person_id;

-- 8. Update community_memberships foreign key
ALTER TABLE IF EXISTS community_memberships RENAME COLUMN citizen_id TO person_id;

-- 9. Update company_representatives foreign key
ALTER TABLE IF EXISTS company_representatives RENAME COLUMN citizen_id TO person_id;

-- 10. Update company_offer_responses foreign key
ALTER TABLE IF EXISTS company_offer_responses RENAME COLUMN citizen_id TO person_id;

-- 11. Drop old citizens table (data migrated to persons)
DROP TABLE IF EXISTS citizens CASCADE;

COMMIT;
