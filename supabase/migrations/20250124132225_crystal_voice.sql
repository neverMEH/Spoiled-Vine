-- Drop existing function first
DROP FUNCTION IF EXISTS get_violations_by_review(text);

-- Drop existing constraints
ALTER TABLE review_violations
DROP CONSTRAINT IF EXISTS review_violations_type_check;

-- Add violation_category column
ALTER TABLE review_violations
ADD COLUMN IF NOT EXISTS violation_category TEXT;

-- Update violation_type to always be 'Content Violation'
UPDATE review_violations
SET violation_type = 'Content Violation';

-- Add new constraint for violation_type
ALTER TABLE review_violations
ADD CONSTRAINT review_violations_type_check
CHECK (violation_type = 'Content Violation');

-- Create index on violation_category
CREATE INDEX IF NOT EXISTS idx_review_violations_category
ON review_violations(violation_category);

-- Create new function with updated signature
CREATE OR REPLACE FUNCTION get_violations_by_review(p_review_id TEXT)
RETURNS TABLE (
  violation_type TEXT,
  violation_category TEXT,
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
    rv.violation_category,
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