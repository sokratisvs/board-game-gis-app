-- Seed explore_events with frontend mock data (MOCK_EXPLORE) so GET /api/explore returns it.
-- Positions near Athens center; long image URIs from the mock.

INSERT INTO explore_events (title, subtitle, position, image_uri, reward_label, is_active, type)
SELECT 'Mana Well', '+10 Mana', ST_SetSRID(ST_MakePoint(23.726, 37.982), 4326),
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCP5hq5SLsivoFUFDc4U2SOM-WZ-NZtTr7KyU0-TNA0BKBXXshPpthATCKiilzvA0GnBfx5xbxpyW2NUMpr9jP5WqLMzTgsTaVxzbIRU8iTFyrdMzxMWr3YaQKKea4Ro3RPqSX8z3EXCvhdrHqeSV07gnOj6iftbcBk3B9fY0HzgI4GZwEjg-9lg1o_W97u3uXpiiOOT4i5AX2KYHQf7UrzMHRdolXQ4_wbnHOvTCESSwqOj_V0y1X_1fdAFfdsuYYphBMoYIHkgpw',
  '+10 Mana', true, 'mana_well'
WHERE NOT EXISTS (SELECT 1 FROM explore_events WHERE title = 'Mana Well' LIMIT 1);

INSERT INTO explore_events (title, subtitle, position, image_uri, reward_label, is_active, type)
SELECT 'Swift Move', 'Move 3 Tiles', ST_SetSRID(ST_MakePoint(23.729, 37.985), 4326),
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB5bzr0pgpOQFYJzjRPEE3wui16_SxYk0Rh5RT_QMrg9l_lJZQIe7BSj-A59SmLdIfYe6sP8w3RlG8R9Ch2iDxALoVimmlYG98dpmfYnKAj2Vv6B2w11qOpiXUE2dPh8NADxEdOg7GM90cfPMTDbGlaYLDZVvR0Gl898cV_qvdkoRY7w8dldbP_rSZTdfIFCiE19BxLnzZon7b4Yzig6oNciw1fF4z1pzWpz0DTvMlOX-OtOiBkjPL8q-czz1FRKnk9UQYXfe_v0NU',
  'Move 3 Tiles', true, 'challenge'
WHERE NOT EXISTS (SELECT 1 FROM explore_events WHERE title = 'Swift Move' LIMIT 1);

INSERT INTO explore_events (title, subtitle, position, image_uri, reward_label, is_active, type)
SELECT 'Plant Trap', 'Stun Enemy', ST_SetSRID(ST_MakePoint(23.728, 37.981), 4326),
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBIXXMHPg_DLQQP9EGbd31AYAYVxuZoSL5Nnf5E2t3gb3KDPTv4SunpuoNLu2TJH_NQ0vP8poJfoEPWhD2zM2yiVyq_wGejmfZ4g8aakm1am6alop_mvw29TZmHofwFlJN5fMRqgd-flDXAzNevRaCg82rBYwE5lKkeGqpscgKUzottFSa4NwCYJVLsW0Vmzt6HejqTIrJWtPltSx42MMimRGJId6vV3mZl3QkqRU_9RnBJRoc4eFs9dr-cwW1hR5T-gQuNyi1Zko0',
  'Stun Enemy', true, 'challenge'
WHERE NOT EXISTS (SELECT 1 FROM explore_events WHERE title = 'Plant Trap' LIMIT 1);

INSERT INTO explore_events (title, subtitle, position, image_uri, reward_label, is_active, type)
SELECT 'Peak Shield', '+5 Armor', ST_SetSRID(ST_MakePoint(23.725, 37.986), 4326),
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCIOMhiKN_QwoFhneIwCKvZvJikThUGnbcgyT8LZIF93gAhvEUprQj8RQtvhS71kGWvOxMRl1sMqyf18SlczwRUqrSrLuyIKprNSUOURBfghEH8_lFGDyQHl9cXVSsSCascM2DW3KfGv5PDyVt1LLavsahurzM9qhPS20MsW7zntM-gfZbsjWo6qINhOuqUsQgpfm6nzmHrY6zEc7AzioZORFpEPA1OeegouMd1yz7ouDjlBnjbQIo_WM5RFPfHtNGDGKE6HDJb5nI',
  '+5 Armor', true, 'other'
WHERE NOT EXISTS (SELECT 1 FROM explore_events WHERE title = 'Peak Shield' LIMIT 1);
