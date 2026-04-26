-- Migration 0004: Remove duplicate civic tables
-- These tables (persons, citizenships, stamps) are duplicates from the Sophia Metapolis
-- data model. The authoritative source is AgoraPass (agorapass database).
-- TriskellGate is exclusively for commercial ticketing.
-- This migration removes the redundant tables from triskell_gate.

BEGIN;

-- Verify tables are empty before DROP (safety check)
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM persons) > 0 THEN
    RAISE EXCEPTION 'persons table is not empty! Aborting DROP.';
  END IF;
  IF (SELECT COUNT(*) FROM citizenships) > 0 THEN
    RAISE EXCEPTION 'citizenships table is not empty! Aborting DROP.';
  END IF;
  IF (SELECT COUNT(*) FROM stamps) > 0 THEN
    RAISE EXCEPTION 'stamps table is not empty! Aborting DROP.';
  END IF;
END $$;

-- Drop tables in correct order (respecting FK constraints)
DROP TABLE IF EXISTS stamps;
DROP TABLE IF EXISTS citizenships;
DROP TABLE IF EXISTS persons;

COMMIT;
