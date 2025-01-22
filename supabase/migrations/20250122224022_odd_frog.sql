/*
  # Update review violations schema

  1. Changes
    - Add parsed_output column to store raw violation text
    - Add violation_type, severity, user_benefit, action columns
    - Add details column for explanation text
    - Add indexes for new columns
    
  2. Security
    - Maintain existing RLS policies
*/

-- Add new columns to review_violations table
ALTER TABLE review_violations
ADD COLUMN IF NOT EXISTS parsed_output TEXT,
ADD COLUMN IF NOT EXISTS violation_type TEXT,
ADD COLUMN IF NOT EXISTS severity TEXT CHECK (severity IN ('High', 'Medium', 'Low')),
ADD COLUMN IF NOT EXISTS user_benefit TEXT CHECK (user_benefit IN ('High', 'Medium', 'Low')),
ADD COLUMN IF NOT EXISTS action TEXT CHECK (action IN ('Remove', 'Edit', 'Keep')),
ADD COLUMN IF NOT EXISTS details TEXT;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_review_violations_violation_type 
ON review_violations(violation_type);

CREATE INDEX IF NOT EXISTS idx_review_violations_severity 
ON review_violations(severity);

CREATE INDEX IF NOT EXISTS idx_review_violations_action 
ON review_violations(action);

-- Create function to parse violation output
CREATE OR REPLACE FUNCTION parse_violation_output(output TEXT)
RETURNS TABLE (
  violation_type TEXT,
  severity TEXT,
  user_benefit TEXT,
  action TEXT,
  details TEXT
) AS $$
DECLARE
  parts TEXT[];
BEGIN
  -- Split the output into parts by newline
  parts := string_to_array(output, E'\n');
  
  -- Return parsed values
  RETURN QUERY SELECT
    -- Extract violation type (part 3)
    CASE WHEN array_length(parts, 1) >= 3 THEN trim(parts[3]) ELSE NULL END,
    -- Extract severity (part 4)
    CASE WHEN array_length(parts, 1) >= 4 THEN trim(parts[4]) ELSE NULL END,
    -- Extract user benefit (part 5)
    CASE WHEN array_length(parts, 1) >= 5 THEN trim(parts[5]) ELSE NULL END,
    -- Extract action (part 6)
    CASE WHEN array_length(parts, 1) >= 6 THEN trim(parts[6]) ELSE NULL END,
    -- Extract details (part 7)
    CASE WHEN array_length(parts, 1) >= 7 THEN trim(parts[7]) ELSE NULL END;
END;
$$ LANGUAGE plpgsql;