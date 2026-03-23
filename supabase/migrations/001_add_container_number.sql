-- Migration: Add container_number to fastlane_registrations
ALTER TABLE fastlane_registrations
  ADD COLUMN IF NOT EXISTS container_number TEXT NOT NULL DEFAULT '';
