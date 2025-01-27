/*
  # Add attributes column to products table

  1. Changes
    - Add attributes column to products table
    - Create index for better query performance
    - Migrate existing data if needed

  2. Notes
    - Uses JSONB type for flexible attribute storage
    - Adds GIN index for efficient querying
*/

-- Add attributes column if it doesn't exist
ALTER TABLE products
ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}'::jsonb;

-- Create GIN index for efficient querying of attributes
CREATE INDEX IF NOT EXISTS idx_products_attributes 
ON products USING GIN (attributes);

-- Update existing products to ensure attributes is not null
UPDATE products 
SET attributes = '{}'::jsonb 
WHERE attributes IS NULL;