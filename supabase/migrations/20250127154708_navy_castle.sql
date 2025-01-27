-- Drop existing trigger and function
DROP TRIGGER IF EXISTS set_review_violation_product_id_trigger ON review_violations;
DROP FUNCTION IF EXISTS set_review_violation_product_id();
DROP FUNCTION IF EXISTS get_product_id_from_review();

-- Modify review_violations table
ALTER TABLE review_violations
ALTER COLUMN product_id DROP NOT NULL;

-- Create new function to get review details
CREATE OR REPLACE FUNCTION get_review_details(p_review_id TEXT)
RETURNS TABLE (
  review_id TEXT,
  product_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.review_id,
    r.product_id
  FROM reviews r
  WHERE r.review_id = p_review_id;
END;
$$ LANGUAGE plpgsql;

-- Create new trigger function
CREATE OR REPLACE FUNCTION set_review_violation_details()
RETURNS TRIGGER AS $$
DECLARE
  v_review_details RECORD;
BEGIN
  -- Get review details
  SELECT * INTO v_review_details
  FROM get_review_details(NEW.review_id);
  
  -- Set product_id if review is found
  IF v_review_details.product_id IS NOT NULL THEN
    NEW.product_id := v_review_details.product_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create new trigger
CREATE TRIGGER set_review_violation_details_trigger
  BEFORE INSERT ON review_violations
  FOR EACH ROW
  EXECUTE FUNCTION set_review_violation_details();