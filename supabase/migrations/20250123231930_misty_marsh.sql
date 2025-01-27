/*
  # Update review violations schema
  
  1. Changes
    - Add indexes for efficient querying
    - Add violation type constraints
    - Add helper functions
  
  2. Security
    - Maintain existing RLS policies
*/

-- Add composite index for review_id
CREATE INDEX IF NOT EXISTS idx_review_violations_review_product
ON review_violations(review_id);

-- Add index for violation type
CREATE INDEX IF NOT EXISTS idx_review_violations_type
ON review_violations(violation_type);

-- Update violation type enum
DO $$ 
BEGIN
  -- First, update any NULL or invalid values to a default
  UPDATE review_violations 
  SET violation_type = 'Policy Violation'
  WHERE violation_type IS NULL 
     OR violation_type NOT IN (
      'Pricing/Availability Keywords',
      'Price Manipulation',
      'Spam Content',
      'Promotional Content',
      'Fake Review',
      'Inauthentic Review',
      'Policy Violation',
      'Terms of Service Violation'
    );

  -- Then add the constraint
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
  WHEN duplicate_object THEN NULL;
END $$;

-- Update severity values
DO $$ 
BEGIN
  -- First, update any NULL or invalid values
  UPDATE review_violations 
  SET severity = 'Medium'
  WHERE severity IS NULL 
     OR severity NOT IN ('High', 'Medium', 'Low');

  -- Then add the constraint
  ALTER TABLE review_violations
  ADD CONSTRAINT review_violations_severity_check
  CHECK (severity IN ('High', 'Medium', 'Low'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Update user_benefit values
DO $$ 
BEGIN
  -- First, update any NULL or invalid values
  UPDATE review_violations 
  SET user_benefit = 'Low'
  WHERE user_benefit IS NULL 
     OR user_benefit NOT IN ('High', 'Medium', 'Low');

  -- Then add the constraint
  ALTER TABLE review_violations
  ADD CONSTRAINT review_violations_user_benefit_check
  CHECK (user_benefit IN ('High', 'Medium', 'Low'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Update action values
DO $$ 
BEGIN
  -- First, update any NULL or invalid values
  UPDATE review_violations 
  SET action = 'Keep'
  WHERE action IS NULL 
     OR action NOT IN ('Remove', 'Edit', 'Keep');

  -- Then add the constraint
  ALTER TABLE review_violations
  ADD CONSTRAINT review_violations_action_check
  CHECK (action IN ('Remove', 'Edit', 'Keep'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
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