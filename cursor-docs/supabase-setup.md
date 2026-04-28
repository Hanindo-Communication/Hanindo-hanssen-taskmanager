# Supabase Setup – Task Manager

Panduan singkat: apa yang harus kamu lakukan di **Supabase Dashboard**, Auth, dan penyambungan ke app / Vercel.

---

## Checklist: apa yang harus kamu lakukan di Supabase

Ikuti urutan ini untuk **satu project Supabase** yang dipakai app ini (localhost + Vercel).

| # | Di Supabase | Keterangan |
|---|-------------|------------|
| 1 | **Project Settings → API** | Copy **Project URL** dan **anon public** key → isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` di `.env.local` dan di **Vercel → Environment Variables**. Tanpa ini, app tidak bisa baca/tulis DB. |
| 2 | **SQL Editor** | Jalankan migration SQL dari folder `supabase/migrations/` — urutan wajib ada di bagian **[Urutan migration SQL](#urutan-migration-sql)** di bawah. |
| 3 | **(Opsional) Auth users** | Kalau pakai login email: copy **service_role** key ke `.env.local` saja (jangan commit), lalu jalankan `node --env-file=.env.local scripts/create-auth-users.mjs` dari komputer lokal. |
| 4 | **Vercel** | Pastikan env sama dengan langkah 1; **Redeploy** setelah mengubah env. |

### Verifikasi cepat (SQL Editor)

```sql
-- Harus ada baris setelah kamu menyimpan BM/BA dari Settings (admin)
select id, jsonb_typeof(payload), updated_at from public.workspace_bm_ba_settings;

-- Role per member (setelah migration 007 / §5)
select email, role from public.workspace_members limit 10;
```

Kalau query pertama error *relation does not exist*, jalankan **`006_workspace_bm_ba_settings.sql`**. Kalau kedua error, jalankan **`007_workspace_members.sql`** (atau SQL di **[§ 5](#5-tabel-workspace_members-role-per-email)**).

---

## Urutan migration SQL

Buka **Supabase → SQL Editor → New query**. Untuk tiap file: buka di repo → salin **seluruh isi** → **Run**. Kalau ada error "already exists", biasanya migration itu sudah pernah dijalankan — lanjut ke berikutnya kecuali ada pesan lain yang mengharuskan perbaikan.

| Urutan | File di repo | Untuk apa |
|--------|----------------|-----------|
| 1 | `001_initial_schema.sql` | Tabel task/board (`boards`, `board_members`, `task_groups`, `tasks`), enum status/priority, fungsi **`set_updated_at()`**, RLS dasar. |
| 2 | `002_board_history_logs.sql` | Kolom **`history_logs`** di `boards`. |
| 3 | `003_allow_text_ids.sql` | **Hanya jika** board/task pakai **ID string** (mis. `product-launch`). Kalau pakai UUID default dari DB, bisa **lewati**. |
| 4 | `004_overview_member_projects.sql` | Tabel **`overview_member_projects`** (Overview / list projects). Perlu **`set_updated_at`** dari langkah 1. |
| 5 | `005_task_status_three_values.sql` | Mengubah enum status task ke 3 nilai (`pending`, `followUp`, `done`). **Jalankan hanya jika** `tasks` masih pakai enum **lama** dari `001` (5 nilai). Kalau schema task sudah lain / sudah migrate, diskusi dulu atau skip (bisa error). |
| 6 | `006_workspace_bm_ba_settings.sql` | Tabel **`workspace_bm_ba_settings`** + trigger + RLS (BM/BA di Settings). Bisa dijalankan sendiri di project yang belum punya `001` — file ini mendefinisikan **`set_updated_at`** jika belum ada. |
| 7 | `007_workspace_members.sql` | Tabel **`workspace_members`** (role admin/member/viewer per email). |

**Ringkas:** project baru untuk app ini → jalankan **001 → 007** sesuai kebutuhan (lewati **003** / **005** kalau tidak relevan). Hanya fitur Settings (BM/BA + role) → minimal **`006`** + **`007`**.

---

## Langkah pertama (sekali saja): API keys & jalankan app

1. Buka https://supabase.com/dashboard → pilih project.
2. **Project Settings → API**: salin URL dan **anon public** → `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
3. Untuk script create user: tambahkan **`SUPABASE_SERVICE_ROLE_KEY`** (service_role — rahasia, jangan commit).
4. Jalankan migration sesuai [Urutan migration SQL](#urutan-migration-sql).
5. (Opsional) Buat user login:
   ```powershell
   node --env-file=.env.local scripts/create-auth-users.mjs
   ```
   Password default script: **test123**.
6. `npm run dev` → login di `/login`.

---

## 0. Login dengan email / password (Auth)

Detail sama seperti di atas: env `NEXT_PUBLIC_SUPABASE_*`, script dengan `SUPABASE_SERVICE_ROLE_KEY`.

Membuat user manual via Dashboard (**Authentication → Users**) juga bisa.

---

## 1. Isi migration `001_initial_schema.sql`

Sudah dirangkum di [Urutan migration SQL](#urutan-migration-sql). Hasilnya antara lain tabel:

| Tabel | Keterangan |
|-------|------------|
| `boards` | Project/board |
| `board_members` | Anggota per board |
| `task_groups` | Group tugas |
| `tasks` | Task per group |

---

## 2. Environment variables

Lihat checklist bagian atas. `.env.local` jangan di-commit.

---

## 3. Integrasi app (board/task)

App sudah memakai Supabase client (`lib/supabase/`). Mapping board/task mengikuti tabel di migration `001` (+ `002`, `003`, `005` sesuai kasus).

---

## 4. Row Level Security (RLS)

Migration pakai policy longgar **`using (true)`** untuk kemudahan development. Untuk production, sesuaikan dengan `auth.uid()` dan kebutuhan tim.

---

## 4b. Deploy di Vercel

1. **Settings → Environment Variables:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — sama persis dengan project Supabase yang dipakai.
2. **Redeploy** setelah mengubah env.
3. Migration **`003`** hanya jika board ID string — lihat tabel urutan.
4. Auto-save board/overview mengikuti implementasi di app (debounce, dll.).

---

## 5. Tabel workspace_members (role per email)

Untuk **Settings → Role per member** (admin/member/viewer per email): di **SQL Editor** jalankan file **`supabase/migrations/007_workspace_members.sql`** (isi sama dengan blok di bawah).

```sql
create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null default '',
  role text not null default 'member' check (role in ('admin', 'member', 'viewer'))
);

alter table public.workspace_members enable row level security;

drop policy if exists "Allow all for anon" on public.workspace_members;
create policy "Allow all for anon" on public.workspace_members
  for all using (true) with check (true);
```

App membaca/menulis lewat `lib/utils/workspace-members.ts`; fallback localStorage jika tabel/query gagal.

---

## 6. Tabel workspace_bm_ba_settings (Settings → BM/BA)

1. Jalankan **`supabase/migrations/006_workspace_bm_ba_settings.sql`** di **SQL Editor** (sekali per project).
2. Satu baris singleton **`id = 'default'`**, kolom **`payload`** JSON (struktur `MemberBmBaState`).
3. Sinkron: debounce ~750 ms setelah edit + simpan langsung saat tombol **Save** di header.
4. Fallback **localStorage** jika Supabase tidak dikonfigurasi atau error.

Pastikan env Vercel sudah berisi URL + anon key project yang sama.

---

## Troubleshooting singkat

| Gejala | Yang dicek |
|--------|------------|
| BM/BA tidak tersimpan ke cloud | Env Vercel / `.env.local`; tabel **`workspace_bm_ba_settings`** ada; cek browser **Console** untuk error Supabase. |
| Error `set_updated_at` tidak ada | Jalankan **`006_workspace_bm_ba_settings.sql`** (sudah menyertakan `create or replace function set_updated_at`). |
| Error enum / kolom tidak cocok | Migration **`005`** hanya untuk schema task dari **`001`** yang belum diubah; jangan jalankan dua kali. |
| Role member tidak sinkron | Jalankan **`007_workspace_members.sql`** (lihat **§ 5**). |
