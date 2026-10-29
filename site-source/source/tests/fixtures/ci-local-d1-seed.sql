-- Fictional records for native local-D1 export/restore integration test ONLY.
-- No actual officials, contributors, identifiers, or live D1 records.
INSERT INTO entities (id, entity_type, canonical_name, normalized_name)
VALUES
 ('person:synthetic:1','politician','Synthetic Member Alpha','synthetic member alpha'),
 ('person:synthetic:2','politician','Synthetic Member Beta','synthetic member beta');
INSERT INTO sources (id,source_system,record_type,publisher,title,url)
VALUES ('source:synthetic:1','synthetic','test','Synthetic Test Publisher',
        'Local D1 export fixture','https://example.org');
INSERT INTO relationships (id,from_entity_id,to_entity_id,relationship_type,source_id)
VALUES ('relationship:synthetic:1','person:synthetic:1','person:synthetic:2',
        'test_relation','source:synthetic:1');
