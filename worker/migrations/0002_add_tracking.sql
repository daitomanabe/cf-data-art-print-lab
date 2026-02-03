-- Add tracking_json column for shipment tracking information
-- Stores: { trackingCode, trackingUrl, carrier }

ALTER TABLE orders ADD COLUMN tracking_json TEXT;
