-- Add rating_data column to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS rating_data JSONB DEFAULT jsonb_build_object(
  'rating', 0,
  'reviewCount', 0,
  'starsBreakdown', jsonb_build_object(
    '5star', 0,
    '4star', 0,
    '3star', 0,
    '2star', 0,
    '1star', 0
  ),
  'lastUpdated', null
);