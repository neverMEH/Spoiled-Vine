/*
  # Update review violations table structure
  
  1. Changes
    - Add unique constraint to reviews.review_id
    - Add foreign key constraint to reviews table
    - Add indexes for better query performance
    - Update violation type constraints
  
  2. Security
    - Maintain existing RLS policies
*/

-- First ensure reviews table has unique review_ids
ALTER TABLE reviews
ADD CONSTRAINT reviews_review_id_key UNIQUE (review_id);

-- Add foreign key constraint
ALTER TABLE review_violations
ADD CONSTRAINT review_violations_review_id_fkey
FOREIGN KEY (review_id)
REFERENCES reviews(review_id)
ON DELETE CASCADE;

-- Add composite index for review_id and product_id
CREATE INDEX IF NOT EXISTS idx_review_violations_review_product
ON review_violations(review_id, product_id);

-- Add index for violation type
CREATE INDEX IF NOT EXISTS idx_review_violations_type
ON review_violations(violation_type);

-- Update violation type enum
DO $$ 
BEGIN
  ALTER TABLE review_violations
  ADD CONSTRAINT review_violations_type_check
  CHECK (violation_type IN (
    'Pricing/Availability Keywords',
    'Price Manipulation',
    'Spam Content',
    'Promotional Content',
    'Fake Review',
    'Inauthentic Review',
    'Policy Violation',
    'Terms of Service Violation'
  ));
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;