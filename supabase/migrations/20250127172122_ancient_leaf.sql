-- Add violation_count column to product_history table
ALTER TABLE product_history
ADD COLUMN IF NOT EXISTS violation_count INTEGER DEFAULT 0;

-- Create index for violation_count
CREATE INDEX IF NOT EXISTS idx_product_history_violation_count 
ON product_history(violation_count);

-- Create function to count violations
CREATE OR REPLACE FUNCTION count_product_violations(p_product_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM review_violations
    WHERE product_id = p_product_id
    AND NOT overridden
  );
END;
$$ LANGUAGE plpgsql;

-- Update record_product_history function to include violation count
CREATE OR REPLACE FUNCTION record_product_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only record history if relevant fields have changed
  IF (
    NEW.price IS DISTINCT FROM OLD.price OR
    (NEW.rating_data->>'rating')::numeric IS DISTINCT FROM (OLD.rating_data->>'rating')::numeric OR
    (NEW.rating_data->>'reviewCount')::integer IS DISTINCT FROM (OLD.rating_data->>'reviewCount')::integer
  ) THEN
    INSERT INTO product_history (
      product_id,
      price,
      rating,
      review_count,
      violation_count,
      captured_at
    ) VALUES (
      NEW.id,
      NEW.price,
      (NEW.rating_data->>'rating')::numeric,
      (NEW.rating_data->>'reviewCount')::integer,
      count_product_violations(NEW.id),
      NEW.updated_at
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;