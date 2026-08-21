-- Seed Giải mừng Quốc khánh 2/9 — 22/08/2026
-- Sinh bởi scripts/seed-giai-02-09.ts. Không sửa tay.
-- 40 VĐV · 20 cặp · 4 bảng · 40 trận · 7 trận KO

BEGIN;

DELETE FROM doubles_ko;
DELETE FROM doubles_matches;
DELETE FROM doubles_groups;
DELETE FROM doubles_pairs;
DELETE FROM doubles_players;

-- doubles_players
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD01', 'Nghiệp', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD02', 'Mạnh', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD03', 'Cường (lớn)', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD04', 'Hảo', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD05', 'H''Lim', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD06', 'Phương', null, 'F', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD07', 'Dũng', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD08', 'Phượng', null, 'F', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD09', 'Thái Sơn', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD10', 'Viết Tài', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD11', 'Mỹ', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD12', 'Hạnh', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD13', 'Quân', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD14', 'Minh', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD15', 'Bảo Vinh', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD16', 'Nghĩa', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD17', 'Hồng Nam', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD18', 'Bạch', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD19', 'Giang', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD20', 'Bá Sơn', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD21', 'Cường (nhỏ)', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD22', 'Quang Vinh', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD23', 'Thi', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD24', 'Dũng (AP)', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD25', 'Sang', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD26', 'Tiến', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD27', 'Hoàng', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD28', 'Hưởng', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD29', 'Dân', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD30', 'Trọng', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD31', 'Hoài Nam', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD32', 'Tuyền', null, 'F', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD33', 'Chung', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD34', 'Tuấn Anh', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD35', 'Hoà', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD36', 'Quý', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD37', 'Sĩ', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD38', 'Hùng', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD39', 'Sinh', null, 'M', null);
INSERT INTO doubles_players (id, name, phone, gender, club) VALUES ('VD40', 'Phúc', null, 'M', null);

-- doubles_pairs
INSERT INTO doubles_pairs (id, p1, p2) VALUES ('A1', 'VD01', 'VD02');
INSERT INTO doubles_pairs (id, p1, p2) VALUES ('A2', 'VD03', 'VD04');
INSERT INTO doubles_pairs (id, p1, p2) VALUES ('A3', 'VD05', 'VD06');
INSERT INTO doubles_pairs (id, p1, p2) VALUES ('A4', 'VD07', 'VD08');
INSERT INTO doubles_pairs (id, p1, p2) VALUES ('A5', 'VD09', 'VD10');
INSERT INTO doubles_pairs (id, p1, p2) VALUES ('B1', 'VD11', 'VD12');
INSERT INTO doubles_pairs (id, p1, p2) VALUES ('B2', 'VD13', 'VD14');
INSERT INTO doubles_pairs (id, p1, p2) VALUES ('B3', 'VD15', 'VD16');
INSERT INTO doubles_pairs (id, p1, p2) VALUES ('B4', 'VD17', 'VD18');
INSERT INTO doubles_pairs (id, p1, p2) VALUES ('B5', 'VD19', 'VD20');
INSERT INTO doubles_pairs (id, p1, p2) VALUES ('C1', 'VD21', 'VD22');
INSERT INTO doubles_pairs (id, p1, p2) VALUES ('C2', 'VD23', 'VD24');
INSERT INTO doubles_pairs (id, p1, p2) VALUES ('C3', 'VD25', 'VD26');
INSERT INTO doubles_pairs (id, p1, p2) VALUES ('C4', 'VD27', 'VD28');
INSERT INTO doubles_pairs (id, p1, p2) VALUES ('C5', 'VD29', 'VD30');
INSERT INTO doubles_pairs (id, p1, p2) VALUES ('D1', 'VD31', 'VD32');
INSERT INTO doubles_pairs (id, p1, p2) VALUES ('D2', 'VD33', 'VD34');
INSERT INTO doubles_pairs (id, p1, p2) VALUES ('D3', 'VD35', 'VD36');
INSERT INTO doubles_pairs (id, p1, p2) VALUES ('D4', 'VD37', 'VD38');
INSERT INTO doubles_pairs (id, p1, p2) VALUES ('D5', 'VD39', 'VD40');

-- doubles_groups
INSERT INTO doubles_groups (id, name, entries) VALUES ('gA', 'Bảng A', array['A1','A2','A3','A4','A5']::text[]);
INSERT INTO doubles_groups (id, name, entries) VALUES ('gB', 'Bảng B', array['B1','B2','B3','B4','B5']::text[]);
INSERT INTO doubles_groups (id, name, entries) VALUES ('gC', 'Bảng C', array['C1','C2','C3','C4','C5']::text[]);
INSERT INTO doubles_groups (id, name, entries) VALUES ('gD', 'Bảng D', array['D1','D2','D3','D4','D5']::text[]);

-- doubles_matches
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm01', 'gA', 'A1', 'A2', 1, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm02', 'gA', 'A3', 'A4', 1, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm03', 'gA', 'A1', 'A5', 1, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm04', 'gA', 'A2', 'A3', 1, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm05', 'gA', 'A4', 'A5', 1, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm06', 'gA', 'A1', 'A3', 1, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm07', 'gA', 'A2', 'A4', 1, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm08', 'gA', 'A3', 'A5', 1, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm09', 'gA', 'A1', 'A4', 1, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm10', 'gA', 'A2', 'A5', 1, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm11', 'gB', 'B1', 'B2', 2, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm12', 'gB', 'B3', 'B4', 2, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm13', 'gB', 'B1', 'B5', 2, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm14', 'gB', 'B2', 'B3', 2, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm15', 'gB', 'B4', 'B5', 2, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm16', 'gB', 'B1', 'B3', 2, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm17', 'gB', 'B2', 'B4', 2, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm18', 'gB', 'B3', 'B5', 2, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm19', 'gB', 'B1', 'B4', 2, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm20', 'gB', 'B2', 'B5', 2, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm21', 'gC', 'C1', 'C2', 3, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm22', 'gC', 'C3', 'C4', 3, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm23', 'gC', 'C1', 'C5', 3, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm24', 'gC', 'C2', 'C3', 3, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm25', 'gC', 'C4', 'C5', 3, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm26', 'gC', 'C1', 'C3', 3, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm27', 'gC', 'C2', 'C4', 3, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm28', 'gC', 'C3', 'C5', 3, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm29', 'gC', 'C1', 'C4', 3, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm30', 'gC', 'C2', 'C5', 3, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm31', 'gD', 'D1', 'D2', 4, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm32', 'gD', 'D3', 'D4', 4, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm33', 'gD', 'D1', 'D5', 4, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm34', 'gD', 'D2', 'D3', 4, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm35', 'gD', 'D4', 'D5', 4, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm36', 'gD', 'D1', 'D3', 4, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm37', 'gD', 'D2', 'D4', 4, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm38', 'gD', 'D3', 'D5', 4, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm39', 'gD', 'D1', 'D4', 4, 3, '[]'::jsonb, 'scheduled', null, 0, 0);
INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) VALUES ('dm40', 'gD', 'D2', 'D5', 4, 3, '[]'::jsonb, 'scheduled', null, 0, 0);

-- doubles_ko (chèn ngược: f → sf → qf, do next_match_id tự tham chiếu)
INSERT INTO doubles_ko (id, round, best_of, label_a, label_b, entry_a, entry_b, sets, status, winner, sets_a, sets_b, next_match_id, next_slot) VALUES ('dko-f', 'f', 5, 'Thắng BK 1', 'Thắng BK 2', null, null, '[]'::jsonb, 'scheduled', null, 0, 0, null, null);
INSERT INTO doubles_ko (id, round, best_of, label_a, label_b, entry_a, entry_b, sets, status, winner, sets_a, sets_b, next_match_id, next_slot) VALUES ('dko-sf1', 'sf', 5, 'Thắng TK 1', 'Thắng TK 3', null, null, '[]'::jsonb, 'scheduled', null, 0, 0, 'dko-f', 'a');
INSERT INTO doubles_ko (id, round, best_of, label_a, label_b, entry_a, entry_b, sets, status, winner, sets_a, sets_b, next_match_id, next_slot) VALUES ('dko-sf2', 'sf', 5, 'Thắng TK 2', 'Thắng TK 4', null, null, '[]'::jsonb, 'scheduled', null, 0, 0, 'dko-f', 'b');
INSERT INTO doubles_ko (id, round, best_of, label_a, label_b, entry_a, entry_b, sets, status, winner, sets_a, sets_b, next_match_id, next_slot) VALUES ('dko-qf1', 'qf', 5, 'Nhất A', 'Nhì C', null, null, '[]'::jsonb, 'scheduled', null, 0, 0, 'dko-sf1', 'a');
INSERT INTO doubles_ko (id, round, best_of, label_a, label_b, entry_a, entry_b, sets, status, winner, sets_a, sets_b, next_match_id, next_slot) VALUES ('dko-qf2', 'qf', 5, 'Nhất C', 'Nhì A', null, null, '[]'::jsonb, 'scheduled', null, 0, 0, 'dko-sf2', 'a');
INSERT INTO doubles_ko (id, round, best_of, label_a, label_b, entry_a, entry_b, sets, status, winner, sets_a, sets_b, next_match_id, next_slot) VALUES ('dko-qf3', 'qf', 5, 'Nhất B', 'Nhì D', null, null, '[]'::jsonb, 'scheduled', null, 0, 0, 'dko-sf1', 'b');
INSERT INTO doubles_ko (id, round, best_of, label_a, label_b, entry_a, entry_b, sets, status, winner, sets_a, sets_b, next_match_id, next_slot) VALUES ('dko-qf4', 'qf', 5, 'Nhất D', 'Nhì B', null, null, '[]'::jsonb, 'scheduled', null, 0, 0, 'dko-sf2', 'b');

COMMIT;
