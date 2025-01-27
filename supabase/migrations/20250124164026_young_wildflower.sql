/*
  # Review Table Migration

  1. Changes
    - Add required columns to reviews table
    - Add indexes for better query performance
    - Add unique constraint for review_id
    - Add foreign key constraints
    - Add RLS policies

  2. Security
    - Enable RLS on reviews table
    - Add policies for authenticated users
*/

-- First ensure reviews table has all required columns
ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS review_id TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 5),
ADD COLUMN IF NOT EXISTS author TEXT,
ADD COLUMN IF NOT EXISTS author_id TEXT,
ADD COLUMN IF NOT EXISTS author_profile TEXT,
ADD COLUMN IF NOT EXISTS verified_purchase BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS helpful_votes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_votes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS review_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS variant TEXT,
ADD COLUMN IF NOT EXISTS variant_attributes JSONB,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS images TEXT[],
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Add unique constraint for review_id
ALTER TABLE reviews
DROP CONSTRAINT IF EXISTS reviews_review_id_key;
ALTER TABLE reviews
ADD CONSTRAINT reviews_review_id_key UNIQUE (review_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_review_date ON reviews(review_date);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_verified_purchase ON reviews(verified_purchase);
CREATE INDEX IF NOT EXISTS idx_reviews_helpful_votes ON reviews(helpful_votes);
CREATE INDEX IF NOT EXISTS idx_reviews_author_id ON reviews(author_id);
CREATE INDEX IF NOT EXISTS idx_reviews_country ON reviews(country);

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "reviews_select_policy" ON reviews;
DROP POLICY IF EXISTS "reviews_insert_policy" ON reviews;
DROP POLICY IF EXISTS "reviews_update_policy" ON reviews;

-- Create new RLS policies
CREATE POLICY "reviews_select_policy"
  ON reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "reviews_insert_policy"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "reviews_update_policy"
  ON reviews FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS set_reviews_updated_at ON reviews;
CREATE TRIGGER set_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_reviews_updated_at();