/**
 * seed-giai-02-09.ts — Sinh SQL seed cho Giải mừng Quốc khánh 2/9 (22/08/2026).
 *
 * Nguồn dữ liệu: danh sách VĐV, danh sách cặp và 4 tờ lịch vòng bảng do BTC chốt
 * ngày 21/08/2026. Thứ tự trận lấy đúng theo tờ lịch — KHÔNG sinh lại bằng
 * generatePairings() (vòng lặp lồng cho thứ tự khác).
 *
 * Nhãn nhánh KO dựng bằng buildDoublesBracket() để trùng khít với thứ mà
 * POST /api/doubles/ko/seed tạo ra, tránh lệch giữa seed tay và seed qua admin.
 *
 * Sinh file:  npx tsx scripts/seed-giai-02-09.ts
 * Ghi vào DB: npx tsx scripts/seed-giai-02-09.ts --apply
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildDoublesBracket } from "../src/lib/knockout/seed";

// ── Dữ liệu BTC ──

/** VĐV theo thứ tự VD01…VD40. */
const PLAYERS = [
  "Nghiệp", "Mạnh", "Cường (lớn)", "Hảo", "H'Lim", "Phương", "Dũng", "Phượng", "Thái Sơn", "Viết Tài",
  "Mỹ", "Hạnh", "Quân", "Minh", "Bảo Vinh", "Nghĩa", "Hồng Nam", "Bạch", "Giang", "Bá Sơn",
  "Cường (nhỏ)", "Quang Vinh", "Thi", "Dũng (AP)", "Sang", "Tiến", "Hoàng", "Hưởng", "Dân", "Trọng",
  "Hoài Nam", "Tuyền", "Chung", "Tuấn Anh", "Hoà", "Quý", "Sĩ", "Hùng", "Sinh", "Phúc",
];

/**
 * VĐV nữ, theo mã VD — BTC chốt ngày 21/08: chỉ Phương (VD06), Phượng (VD08),
 * Tuyền (VD32). Dùng mã thay vì tên vì bảng A có cả Phương lẫn Phượng.
 */
const FEMALE_IDS = new Set(["VD06", "VD08", "VD32"]);

const GROUP_LETTERS = ["A", "B", "C", "D"] as const;

/** Bảng nào chạy bàn nào — tờ lịch 21/08. */
const TABLE_OF: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 };

/**
 * Thứ tự 10 trận của một bảng 5 cặp, chép từ tờ lịch BTC (1-indexed).
 * Đã đối chiếu: cả 4 bảng dùng chung thứ tự này, không cặp nào đá 2 trận liền.
 */
const MATCH_ORDER: Array<[number, number]> = [
  [1, 2], [3, 4], [1, 5], [2, 3], [4, 5],
  [1, 3], [2, 4], [3, 5], [1, 4], [2, 5],
];

const GROUP_BEST_OF = 3;

// ── Helpers ──

const esc = (s: string) => s.replace(/'/g, "''");
const str = (v: string | null) => (v == null ? "null" : `'${esc(v)}'`);
const num = (v: number | null) => (v == null ? "null" : String(v));
const textArr = (a: string[]) => `array[${a.map((v) => `'${esc(v)}'`).join(",")}]::text[]`;

const playerId = (i: number) => `VD${String(i + 1).padStart(2, "0")}`;
const pairId = (letter: string, n: number) => `${letter}${n}`;
const groupId = (letter: string) => `g${letter}`;
const matchId = (n: number) => `dm${String(n).padStart(2, "0")}`;

// ── Dựng câu lệnh ──

function buildStatements(): { sql: string[]; counts: Record<string, number> } {
  const sql: string[] = [];
  const counts: Record<string, number> = {};

  // Xoá theo thứ tự khoá ngoại. team_* giữ nguyên — giải 2/9 không có nội dung Đồng đội.
  sql.push(
    "DELETE FROM doubles_ko;",
    "DELETE FROM doubles_matches;",
    "DELETE FROM doubles_groups;",
    "DELETE FROM doubles_pairs;",
    "DELETE FROM doubles_players;",
    "",
  );

  // 40 VĐV. phone/club để null — danh sách BTC không có, không tự bịa.
  sql.push("-- doubles_players");
  PLAYERS.forEach((name, i) => {
    const id = playerId(i);
    const gender = FEMALE_IDS.has(id) ? "F" : "M";
    sql.push(
      `INSERT INTO doubles_players (id, name, phone, gender, club) VALUES (${str(id)}, ${str(name)}, null, ${str(gender)}, null);`,
    );
  });
  counts.players = PLAYERS.length;
  counts.nu = FEMALE_IDS.size;
  sql.push("");

  // 20 cặp: VĐV thứ 2k-1 và 2k ghép thành cặp thứ k.
  sql.push("-- doubles_pairs");
  let pairCount = 0;
  GROUP_LETTERS.forEach((letter, gi) => {
    for (let n = 1; n <= 5; n += 1) {
      const base = gi * 10 + (n - 1) * 2;
      sql.push(
        `INSERT INTO doubles_pairs (id, p1, p2) VALUES (${str(pairId(letter, n))}, ${str(playerId(base))}, ${str(playerId(base + 1))});`,
      );
      pairCount += 1;
    }
  });
  counts.pairs = pairCount;
  sql.push("");

  // 4 bảng
  sql.push("-- doubles_groups");
  GROUP_LETTERS.forEach((letter) => {
    const entries = [1, 2, 3, 4, 5].map((n) => pairId(letter, n));
    sql.push(
      `INSERT INTO doubles_groups (id, name, entries) VALUES (${str(groupId(letter))}, ${str(`Bảng ${letter}`)}, ${textArr(entries)});`,
    );
  });
  counts.groups = GROUP_LETTERS.length;
  sql.push("");

  // 40 trận. Mã cấp tuần tự theo thứ tự tờ lịch để .order("id") ra đúng thứ tự đó.
  sql.push("-- doubles_matches");
  let mno = 0;
  GROUP_LETTERS.forEach((letter) => {
    MATCH_ORDER.forEach(([x, y]) => {
      mno += 1;
      sql.push(
        `INSERT INTO doubles_matches (id, group_id, pair_a, pair_b, "table", best_of, sets, status, winner, sets_a, sets_b) ` +
          `VALUES (${str(matchId(mno))}, ${str(groupId(letter))}, ${str(pairId(letter, x))}, ${str(pairId(letter, y))}, ` +
          `${num(TABLE_OF[letter])}, ${GROUP_BEST_OF}, '[]'::jsonb, 'scheduled', null, 0, 0);`,
      );
    });
  });
  counts.matches = mno;
  sql.push("");

  // Nhánh KO: chưa có suất đi tiếp nên seeds rỗng, entry_a/entry_b để null.
  //
  // next_match_id là khoá ngoại tự tham chiếu, nên phải chèn trận đích trước trận nguồn:
  // chung kết → bán kết → tứ kết. buildDoublesBracket() trả về theo thứ tự ngược lại.
  sql.push("-- doubles_ko (chèn ngược: f → sf → qf, do next_match_id tự tham chiếu)");
  const ROUND_INSERT_ORDER: Record<string, number> = { f: 0, sf: 1, qf: 2 };
  const bracket = [...buildDoublesBracket([], GROUP_LETTERS.map((l) => `Bảng ${l}`))].sort(
    (x, y) => ROUND_INSERT_ORDER[x.round] - ROUND_INSERT_ORDER[y.round],
  );
  for (const m of bracket) {
    sql.push(
      `INSERT INTO doubles_ko (id, round, best_of, label_a, label_b, entry_a, entry_b, sets, status, winner, sets_a, sets_b, next_match_id, next_slot) ` +
        `VALUES (${str(m.id)}, ${str(m.round)}, ${m.best_of}, ${str(m.label_a)}, ${str(m.label_b)}, ` +
        `${str(m.entry_a)}, ${str(m.entry_b)}, '[]'::jsonb, 'scheduled', null, 0, 0, ${str(m.next_match_id)}, ${str(m.next_slot)});`,
    );
  }
  counts.ko = bracket.length;

  return { sql, counts };
}

// ── Chạy ──

async function main() {
  const { sql, counts } = buildStatements();
  const body = sql.join("\n");
  const file =
    "-- Seed Giải mừng Quốc khánh 2/9 — 22/08/2026\n" +
    "-- Sinh bởi scripts/seed-giai-02-09.ts. Không sửa tay.\n" +
    `-- ${counts.players} VĐV · ${counts.pairs} cặp · ${counts.groups} bảng · ${counts.matches} trận · ${counts.ko} trận KO\n\n` +
    `BEGIN;\n\n${body}\n\nCOMMIT;\n`;

  const out = resolve(process.cwd(), "supabase", "seed-giai-02-09.sql");
  writeFileSync(out, file, "utf-8");
  console.log(`✓ Đã sinh ${out}`);
  console.table(counts);

  if (!process.argv.includes("--apply")) {
    console.log("\nChưa ghi vào DB. Thêm --apply để chạy thật.");
    return;
  }

  // tsx không tự nạp .env.local; nạp ở đây để chạy được bằng `npx tsx ...`.
  if (!process.env.DATABASE_URL) {
    process.loadEnvFile(resolve(process.cwd(), ".env.local"));
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("Thiếu DATABASE_URL — kiểm tra .env.local");
  }

  // `pg` là devDependency không kèm type. Khai báo tối thiểu đúng phần dùng tới,
  // thay vì thêm @types/pg chỉ để chạy một script seed.
  type PgClient = {
    connect(): Promise<void>;
    query(sql: string): Promise<unknown>;
    end(): Promise<void>;
  };
  type PgModule = {
    default: {
      Client: new (cfg: {
        connectionString?: string;
        ssl?: { rejectUnauthorized: boolean };
      }) => PgClient;
    };
  };

  // @ts-expect-error — 'pg' không kèm file khai báo type; hình dạng dùng tới đã mô tả ở PgModule
  const mod = (await import("pg")) as PgModule;
  const pg = mod.default;
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query("BEGIN");
    for (const stmt of sql) {
      const s = stmt.trim();
      if (!s || s.startsWith("--")) continue;
      await client.query(s);
    }
    await client.query("COMMIT");
    console.log("\n✓ Đã ghi vào Supabase.");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("\n✗ Lỗi — đã rollback, DB không đổi.");
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
