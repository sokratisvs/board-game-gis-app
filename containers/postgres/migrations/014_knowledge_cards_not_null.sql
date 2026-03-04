-- Knowledge cards: title and description required (approved content).
UPDATE knowledge_cards SET title = '' WHERE title IS NULL;
UPDATE knowledge_cards SET description = '' WHERE description IS NULL;
ALTER TABLE knowledge_cards ALTER COLUMN title SET NOT NULL;
ALTER TABLE knowledge_cards ALTER COLUMN description SET NOT NULL;

COMMENT ON TABLE knowledge_cards IS 'Approved knowledge content per checkpoint; title and description required';
