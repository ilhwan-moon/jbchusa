-- Add translation columns for member meta options
ALTER TABLE member_types ADD COLUMN name_en TEXT;
ALTER TABLE member_types ADD COLUMN name_es TEXT;
UPDATE member_types SET name_en = COALESCE(name_en, name), name_es = COALESCE(name_es, name);

ALTER TABLE employment_types ADD COLUMN name_en TEXT;
ALTER TABLE employment_types ADD COLUMN name_es TEXT;
UPDATE employment_types SET name_en = COALESCE(name_en, name), name_es = COALESCE(name_es, name);

ALTER TABLE member_statuses ADD COLUMN name_en TEXT;
ALTER TABLE member_statuses ADD COLUMN name_es TEXT;
UPDATE member_statuses SET name_en = COALESCE(name_en, name), name_es = COALESCE(name_es, name);
