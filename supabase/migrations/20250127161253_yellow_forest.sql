-- Drop existing severity constraint
ALTER TABLE review_violations
DROP CONSTRAINT IF EXISTS review_violations_severity_check;

-- Add updated severity constraint
ALTER TABLE review_violations
ADD CONSTRAINT review_violations_severity_check
CHECK (severity IN ('Critical', 'High', 'Medium', 'Low'));

-- Update any existing 'Critical' severities to 'High' if needed
UPDATE review_violations
SET severity = 'High'
WHERE severity = 'Critical';