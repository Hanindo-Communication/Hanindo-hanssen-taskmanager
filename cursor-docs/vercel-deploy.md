# Deploy ke Vercel – hanya update fitur, jangan ubah data

## Prinsip

- **Programs & projects** yang sudah diisi user di Vercel (production) disimpan di **Supabase**, bukan di kode atau env Vercel.
- Setiap deploy dari Git (push ke `main`) hanya **memperbarui kode/fitur**. Data di Supabase (boards, overview_member_projects, dll.) **tidak di-overwrite**.
- Jangan jalankan seed/script yang truncate atau replace data production. Tidak ada seed script di `package.json` yang dijalankan saat build/deploy.

## Yang aman dilakukan

- Push ke `main` → Vercel auto-deploy → hanya kode baru yang dipakai; data programs/projects tetap di Supabase.
- Jalankan migrasi schema di Supabase (lewat Dashboard atau MCP) untuk perubahan struktur DB; migrasi yang ada **memetakan** data lama (mis. task_status) tanpa menghapus boards/projects.

## Yang jangan dilakukan

- Jangan tambah build step atau post-deploy script yang: seed database, truncate table, atau overwrite `overview_member_projects` / `boards` dengan data default.
- Saat menambah fitur, pastikan simpan/load dari Supabase; jangan hardcode daftar programs/projects di kode.
