CREATE TABLE IF NOT EXISTS card_flags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  fee_percentage NUMERIC NOT NULL DEFAULT 0,
  special BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE card_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Card flags are viewable by everyone" ON card_flags
  FOR SELECT USING (true);

CREATE POLICY "Card flags are insertable by admins" ON card_flags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Card flags are updatable by admins" ON card_flags
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Card flags are deletable by admins" ON card_flags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insert initial data
INSERT INTO card_flags (id, name, color, icon, special) VALUES
  ('visa', 'Visa', '#1a1f71', '💳', false),
  ('mastercard', 'Mastercard', '#eb001b', '💳', false),
  ('elo', 'Elo', '#00a1e4', '💳', false),
  ('hipercard', 'Hipercard', '#b3131b', '💳', false),
  ('banese', 'Banese Card', '#00a859', '🏦', true)
ON CONFLICT (id) DO NOTHING;
