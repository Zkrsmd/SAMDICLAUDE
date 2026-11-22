-- what customers buy together, for "Complete the look" on product pages (src/lib/store/copurchase.ts).
-- One row per pair of products seen in the same order (a, b, how many orders), both directions,
-- plus one row (a, a, n) per product: how many orders contained it. Counts only, no customer data.
CREATE TABLE copurchase (
  a TEXT NOT NULL,
  b TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (a, b)
);
