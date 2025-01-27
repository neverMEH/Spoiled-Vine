-- Create function to update product review stats
CREATE OR REPLACE FUNCTION update_product_review_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_rating_data jsonb;
  v_review_summary jsonb;
BEGIN
  -- Calculate new rating data
  SELECT 
    jsonb_build_object(
      'rating', COALESCE(AVG(rating)::numeric(10,2), 0),
      'reviewCount', COUNT(*),
      'starsBreakdown', jsonb_build_object(
        '5star', (COUNT(*) FILTER (WHERE rating = 5))::float / NULLIF(COUNT(*), 0)::float,
        '4star', (COUNT(*) FILTER (WHERE rating = 4))::float / NULLIF(COUNT(*), 0)::float,
        '3star', (COUNT(*) FILTER (WHERE rating = 3))::float / NULLIF(COUNT(*), 0)::float,
        '2star', (COUNT(*) FILTER (WHERE rating = 2))::float / NULLIF(COUNT(*), 0)::float,
        '1star', (COUNT(*) FILTER (WHERE rating = 1))::float / NULLIF(COUNT(*), 0)::float
      ),
      'lastUpdated', CURRENT_TIMESTAMP
    ),
    jsonb_build_object(
      'verifiedPurchases', COUNT(*) FILTER (WHERE verified_purchase = true),
      'lastUpdated', CURRENT_TIMESTAMP
    )
  INTO v_rating_data, v_review_summary
  FROM reviews
  WHERE product_id = COALESCE(NEW.product_id, OLD.product_id);

  -- Update product stats
  UPDATE products
  SET 
    rating_data = v_rating_data,
    review_summary = v_review_summary,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for review stats updates
DROP TRIGGER IF EXISTS update_product_review_stats_trigger ON reviews;
CREATE TRIGGER update_product_review_stats_trigger
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_product_review_stats();

-- Create function to migrate reviews from products table
CREATE OR REPLACE FUNCTION migrate_reviews_from_products()
RETURNS void AS $$
BEGIN
  INSERT INTO reviews (
    product_id,
    review_id,
    title,
    content,
    rating,
    author,
    author_id,
    author_profile,
    verified_purchase,
    helpful_votes,
    total_votes,
    review_date,
    variant,
    variant_attributes,
    country,
    images
  )
  SELECT 
    p.id as product_id,
    r->>'review_id' as review_id,
    r->>'title' as title,
    r->>'content' as content,
    (r->>'rating')::integer as rating,
    r->>'author' as author,
    r->>'author_id' as author_id,
    r->>'author_profile' as author_profile,
    (r->>'verified_purchase')::boolean as verified_purchase,
    COALESCE((r->>'helpful_votes')::integer, 0) as helpful_votes,
    COALESCE((r->>'total_votes')::integer, 0) as total_votes,
    (r->>'review_date')::timestamptz as review_date,
    r->>'variant' as variant,
    CASE 
      WHEN r->>'variant_attributes' IS NOT NULL 
      THEN (r->>'variant_attributes')::jsonb 
      ELSE NULL 
    END as variant_attributes,
    r->>'country' as country,
    CASE 
      WHEN r->>'images' IS NOT NULL 
      THEN string_to_array(trim(both '[]' from r->>'images'), ',')
      ELSE NULL 
    END as images
  FROM products p,
  jsonb_array_elements(p.reviews) r
  WHERE p.reviews IS NOT NULL 
  AND jsonb_array_length(p.reviews) > 0
  ON CONFLICT (review_id) DO UPDATE SET
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    rating = EXCLUDED.rating,
    author = EXCLUDED.author,
    author_id = EXCLUDED.author_id,
    author_profile = EXCLUDED.author_profile,
    verified_purchase = EXCLUDED.verified_purchase,
    helpful_votes = EXCLUDED.helpful_votes,
    total_votes = EXCLUDED.total_votes,
    review_date = EXCLUDED.review_date,
    variant = EXCLUDED.variant,
    variant_attributes = EXCLUDED.variant_attributes,
    country = EXCLUDED.country,
    images = EXCLUDED.images,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;