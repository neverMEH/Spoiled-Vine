-- Create function to get product stats
CREATE OR REPLACE FUNCTION get_product_stats(p_product_id UUID)
RETURNS TABLE (
  rating_data JSONB,
  review_summary JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.rating_data,
    p.review_summary
  FROM products p
  WHERE p.id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_products_rating_data 
ON products USING gin(rating_data);

CREATE INDEX IF NOT EXISTS idx_products_review_summary 
ON products USING gin(review_summary);