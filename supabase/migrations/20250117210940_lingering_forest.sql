/*
  # Fix Product History Tracking

  1. Changes
    - Add trigger to properly track product history
    - Add function to handle history recording
    - Add indexes for better query performance

  2. Improvements
    - Better handling of NULL values
    - More precise change detection
    - Proper type casting
*/

-- Create or replace the function to record product history
CREATE OR REPLACE FUNCTION record_product_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only record history if relevant fields have changed
  IF (
    NEW.price IS DISTINCT FROM OLD.price OR
    (NEW.rating_data->>'rating')::numeric IS DISTINCT FROM (OLD.rating_data->>'rating')::numeric OR
    (NEW.rating_data->>'reviewCount')::integer IS DISTINCT FROM (OLD.rating_data->>'reviewCount')::integer OR
    NEW.best_sellers_rank IS DISTINCT FROM OLD.best_sellers_rank
  ) THEN
    INSERT INTO product_history (
      product_id,
      price,
      rating,
      review_count,
      best_sellers_rank,
      captured_at
    ) VALUES (
      NEW.id,
      NEW.price,
      (NEW.rating_data->>'rating')::numeric,
      (NEW.rating_data->>'reviewCount')::integer,
      NEW.best_sellers_rank,
      NEW.updated_at
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS record_product_history_trigger ON products;

-- Create new trigger
CREATE TRIGGER record_product_history_trigger
  AFTER UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION record_product_history();

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_product_history_product_id_captured_at 
ON product_history(product_id, captured_at);

CREATE INDEX IF NOT EXISTS idx_product_history_captured_at 
ON product_history(captured_at);

-- Backfill history for existing products if needed
INSERT INTO product_history (
  product_id,
  price,
  rating,
  review_count,
  best_sellers_rank,
  captured_at
)
SELECT 
  id as product_id,
  price,
  (rating_data->>'rating')::numeric as rating,
  (rating_data->>'reviewCount')::integer as review_count,
  best_sellers_rank,
  updated_at as captured_at
FROM products
WHERE 
  price IS NOT NULL 
  OR (rating_data->>'rating')::numeric IS NOT NULL
  OR (rating_data->>'reviewCount')::integer IS NOT NULL
  OR best_sellers_rank IS NOT NULL
ON CONFLICT DO NOTHING;