-- 0005_add_updated_at.sql
-- Add updated_at to match tables for "recent results" sorting

ALTER TABLE doubles_matches ADD COLUMN updated_at timestamptz DEFAULT now();
ALTER TABLE team_matches ADD COLUMN updated_at timestamptz DEFAULT now();
ALTER TABLE doubles_ko ADD COLUMN updated_at timestamptz DEFAULT now();
ALTER TABLE team_ko ADD COLUMN updated_at timestamptz DEFAULT now();
