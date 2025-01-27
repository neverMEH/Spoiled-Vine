-- Drop existing constraint if it exists
ALTER TABLE review_violations
DROP CONSTRAINT IF EXISTS review_violations_type_check;

-- Set default value for violation_type
ALTER TABLE review_violations
ALTER COLUMN violation_type SET DEFAULT 'Content Violation';

-- Update all existing records to use Content Violation
UPDATE review_violations
SET violation_type = 'Content Violation'
WHERE violation_type IS NULL OR violation_type != 'Content Violation';

-- Add constraint to ensure violation_type is always Content Violation
ALTER TABLE review_violations
ADD CONSTRAINT review_violations_type_check
CHECK (violation_type = 'Content Violation');

-- Create or replace function to ensure violation_type is always set correctly
CREATE OR REPLACE FUNCTION enforce_content_violation_type()
RETURNS TRIGGER AS $$
BEGIN
  NEW.violation_type := 'Content Violation';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce Content Violation type
DROP TRIGGER IF EXISTS enforce_content_violation_type_trigger ON review_violations;
CREATE TRIGGER enforce_content_violation_type_trigger
  BEFORE INSERT OR UPDATE ON review_violations
  FOR EACH ROW
  EXECUTE FUNCTION enforce_content_violation_type();