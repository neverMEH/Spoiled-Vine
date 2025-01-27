-- Add ASIN column to reviews table
ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS asin TEXT;

-- Create function to get ASIN from product
CREATE OR REPLACE FUNCTION get_product_asin(p_product_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT asin
    FROM products
    WHERE id = p_product_id
  );
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to automatically set ASIN
CREATE OR REPLACE FUNCTION set_review_asin()
RETURNS TRIGGER AS $$
BEGIN
  -- Set ASIN based on product_id
  NEW.asin := get_product_asin(NEW.product_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER set_review_asin_trigger
  BEFORE INSERT OR UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION set_review_asin();

-- Update existing reviews with ASIN
UPDATE reviews r
SET asin = p.asin
FROM products p
WHERE r.product_id = p.id
AND r.asin IS NULL;

-- Create index for ASIN
CREATE INDEX IF NOT EXISTS idx_reviews_asin ON reviews(asin);