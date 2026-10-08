-- Existing rules matched one literal phrase. Quote special characters so the
-- comma-separated matcher retains their meaning until the user edits them.
UPDATE "Rule"
SET "matchText" = '"' || replace("matchText", '"', '""') || '"'
WHERE strpos("matchText", ',') > 0
   OR strpos("matchText", '"') > 0
   OR strpos("matchText", chr(10)) > 0
   OR strpos("matchText", chr(13)) > 0;
