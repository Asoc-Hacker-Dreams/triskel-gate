-- Migration: 0002_sophia_event_bridge
-- Description: Bridge between Triskel (commercial) and AgoraPass (civic) events
-- Created: 2026-04-26
-- Reference: Decisiones Arquitectónicas Fundacionales v1.0 - Bloque 3

-- Add AgoraPass event reference to Triskel events
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS agorapass_event_id UUID;

-- Index for the bridge
CREATE INDEX IF NOT EXISTS idx_events_agorapass ON events(agorapass_event_id) WHERE agorapass_event_id IS NOT NULL;

COMMENT ON COLUMN events.agorapass_event_id IS 'Bridge to civic event in AgoraPass. One-to-one or one-to-zero relationship (Bloque 3).';
