/*
  # Update review violations schema
  
  1. Changes
    - Add violation type constraints
    - Add indexes for efficient querying
    - Add helper functions for violation lookups
  
  2. Security
    - Maintain existing RLS policies
*/

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

-- Create function to get violations by review
CREATE OR REPLACE FUNCTION get_violations_by_review(p_review_id TEXT)
RETURNS TABLE (
  violation_type TEXT,
  severity TEXT,
  user_benefit TEXT,
  action TEXT,
  details TEXT,
  scanned_at TIMESTAMPTZ,
  overridden BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rv.violation_type,
    rv.severity,
    rv.user_benefit,
    rv.action,
    rv.details,
    rv.scanned_at,
    rv.overridden
  FROM review_violations rv
  WHERE rv.review_id = p_review_id
  ORDER BY rv.scanned_at DESC;
END;
$$ LANGUAGE plpgsql;