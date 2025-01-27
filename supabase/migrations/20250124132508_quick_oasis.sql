-- Create function to get product ID from review ID
CREATE OR REPLACE FUNCTION get_product_id_from_review(p_review_id TEXT)
RETURNS UUID AS $$
DECLARE
  v_product_id UUID;
BEGIN
  -- Get product ID from reviews array in products table
  SELECT id INTO v_product_id
  FROM products
  WHERE reviews @> jsonb_build_array(jsonb_build_object('review_id', p_review_id));

  RETURN v_product_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to automatically set product_id
CREATE OR REPLACE FUNCTION set_review_violation_product_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Set product_id based on review_id
  NEW.product_id := get_product_id_from_review(NEW.review_id);
  
  -- If product_id is null, raise an error
  IF NEW.product_id IS NULL THEN
    RAISE EXCEPTION 'Could not find product for review_id %', NEW.review_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set product_id
DROP TRIGGER IF EXISTS set_review_violation_product_id_trigger ON review_violations;
CREATE TRIGGER set_review_violation_product_id_trigger
  BEFORE INSERT ON review_violations
  FOR EACH ROW
  EXECUTE FUNCTION set_review_violation_product_id();