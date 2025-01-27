-- Add product_id column if it doesn't exist
ALTER TABLE review_violations
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE CASCADE;

-- Add composite index for review_id and product_id
CREATE INDEX IF NOT EXISTS idx_review_violations_review_product
ON review_violations(review_id, product_id);

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
  DROP CONSTRAINT IF EXISTS review_violations_type_check;
  
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
  DROP CONSTRAINT IF EXISTS review_violations_severity_check;
  
  ALTER TABLE review_violations
  ADD CONSTRAINT review_violations_severity_check
  CHECK (severity IN ('High', 'Medium', 'Low'));
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
  DROP CONSTRAINT IF EXISTS review_violations_user_benefit_check;
  
  ALTER TABLE review_violations
  ADD CONSTRAINT review_violations_user_benefit_check
  CHECK (user_benefit IN ('High', 'Medium', 'Low'));
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
  DROP CONSTRAINT IF EXISTS review_violations_action_check;
  
  ALTER TABLE review_violations
  ADD CONSTRAINT review_violations_action_check
  CHECK (action IN ('Remove', 'Edit', 'Keep'));
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