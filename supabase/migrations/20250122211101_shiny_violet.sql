/*
  # Add review violations tracking

  1. New Tables
    - `review_violations`
      - `id` (uuid, primary key)
      - `review_id` (text, required)
      - `product_id` (uuid, references products)
      - `violations` (jsonb array)
      - `scanned_at` (timestamptz)
      - `overridden` (boolean)
      - `overridden_by` (text)
      - `overridden_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `review_violations` table
    - Add policies for authenticated users
*/

-- Create review_violations table
CREATE TABLE review_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  violations JSONB[] NOT NULL DEFAULT '{}',
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  overridden BOOLEAN NOT NULL DEFAULT false,
  overridden_by TEXT,
  overridden_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_review_violations_product_id ON review_violations(product_id);
CREATE INDEX idx_review_violations_review_id ON review_violations(review_id);
CREATE INDEX idx_review_violations_scanned_at ON review_violations(scanned_at);

-- Enable RLS
ALTER TABLE review_violations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "review_violations_select_policy"
  ON review_violations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "review_violations_insert_policy"
  ON review_violations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "review_violations_update_policy"
  ON review_violations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);