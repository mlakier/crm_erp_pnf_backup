-- Fix: actually rename estimates to quotes (the previous migration was marked applied but didn't complete)
ALTER TABLE "estimates" RENAME TO "quotes";
