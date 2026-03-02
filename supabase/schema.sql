-- ============================================================
-- Fastlane Management System — Database Schema
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE user_role AS ENUM ('admin', 'agent', 'supervisor');
CREATE TYPE booking_status AS ENUM ('FILLING-IN', 'BOOKED', 'CLOSED');

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'agent',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE port_terminals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE truck_companies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  contact_email TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 24 hourly slots per terminal per day
-- capacity defaults to 2 per slot
-- optimistic locking via last_updated_at
CREATE TABLE terminal_capacity (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id     UUID NOT NULL REFERENCES port_terminals(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  hour_slot       SMALLINT NOT NULL CHECK (hour_slot >= 0 AND hour_slot <= 23),
  capacity        SMALLINT NOT NULL DEFAULT 2,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_api  BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (terminal_id, date, hour_slot)
);

CREATE TABLE bookings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number   TEXT NOT NULL UNIQUE,
  terminal_id      UUID NOT NULL REFERENCES port_terminals(id),
  truck_company_id UUID NOT NULL REFERENCES truck_companies(id),
  num_trucks       SMALLINT NOT NULL DEFAULT 1,
  fastlane_token   TEXT UNIQUE,
  token_cancelled  BOOLEAN NOT NULL DEFAULT FALSE,
  status           booking_status NOT NULL DEFAULT 'FILLING-IN',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  booked_at        TIMESTAMPTZ,
  closed_at        TIMESTAMPTZ
);

CREATE TABLE fastlane_registrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  hour_slot     SMALLINT NOT NULL CHECK (hour_slot >= 0 AND hour_slot <= 23),
  terminal_id   UUID NOT NULL REFERENCES port_terminals(id),
  license_plate TEXT NOT NULL,
  is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_terminal_capacity_lookup ON terminal_capacity (terminal_id, date);
CREATE INDEX idx_bookings_status ON bookings (status);
CREATE INDEX idx_bookings_terminal ON bookings (terminal_id);
CREATE INDEX idx_bookings_token ON bookings (fastlane_token) WHERE fastlane_token IS NOT NULL;
CREATE INDEX idx_registrations_booking ON fastlane_registrations (booking_id);
CREATE INDEX idx_registrations_terminal_slot ON fastlane_registrations (terminal_id, hour_slot);

-- ============================================================
-- Views
-- ============================================================

-- Active truck count per booking (not deleted)
CREATE OR REPLACE VIEW booking_fill_stats AS
SELECT
  b.id AS booking_id,
  b.booking_number,
  b.num_trucks,
  COUNT(fr.id) FILTER (WHERE fr.is_deleted = FALSE) AS active_count,
  b.status
FROM bookings b
LEFT JOIN fastlane_registrations fr ON fr.booking_id = b.id
GROUP BY b.id, b.booking_number, b.num_trucks, b.status;

-- Remaining capacity per terminal/date/slot (capacity minus active registrations)
CREATE OR REPLACE VIEW slot_remaining_capacity AS
SELECT
  tc.terminal_id,
  tc.date,
  tc.hour_slot,
  tc.capacity,
  tc.last_updated_at,
  COALESCE(COUNT(fr.id) FILTER (WHERE fr.is_deleted = FALSE), 0) AS used_count,
  tc.capacity - COALESCE(COUNT(fr.id) FILTER (WHERE fr.is_deleted = FALSE), 0) AS remaining_capacity
FROM terminal_capacity tc
LEFT JOIN fastlane_registrations fr
  ON fr.terminal_id = tc.terminal_id
  AND fr.hour_slot = tc.hour_slot
  AND EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.id = fr.booking_id
      AND b.terminal_id = tc.terminal_id
      AND DATE(b.created_at) = tc.date
  )
GROUP BY tc.terminal_id, tc.date, tc.hour_slot, tc.capacity, tc.last_updated_at;

-- ============================================================
-- Functions
-- ============================================================

-- Auto-update last_updated_at on terminal_capacity changes
CREATE OR REPLACE FUNCTION update_terminal_capacity_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER terminal_capacity_updated
  BEFORE UPDATE ON terminal_capacity
  FOR EACH ROW
  EXECUTE FUNCTION update_terminal_capacity_timestamp();

-- Auto-close bookings 3 days after booked_at (call from /api/cron/close-bookings)
-- pg_cron example: SELECT cron.schedule('0 0 * * *', $$
--   UPDATE bookings SET status = 'CLOSED', closed_at = NOW()
--   WHERE status = 'BOOKED' AND booked_at < NOW() - INTERVAL '3 days';
-- $$);
