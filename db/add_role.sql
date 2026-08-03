-- Add role column to users for admin checks
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';

-- Optional: create an admin user placeholder (adjust id/email to match real Supabase user)
-- INSERT INTO users (id, email, display_name, role) VALUES ('00000000-0000-0000-0000-000000000000','admin@example.com','Admin','admin') ON CONFLICT DO NOTHING;
