--liquibase formatted sql

--changeset system:002-agorapass-bridge splitStatements:true endDelimiter:;
-- Bridge between Triskel (commercial) and AgoraPass (civic) events
ALTER TABLE events ADD COLUMN IF NOT EXISTS agorapass_event_id UUID;
CREATE INDEX IF NOT EXISTS idx_events_agorapass ON events(agorapass_event_id) WHERE agorapass_event_id IS NOT NULL;
COMMENT ON COLUMN events.agorapass_event_id IS 'Bridge to civic event in AgoraPass. One-to-one or one-to-zero relationship.';
--rollback DROP INDEX IF EXISTS idx_events_agorapass; ALTER TABLE events DROP COLUMN IF EXISTS agorapass_event_id;
