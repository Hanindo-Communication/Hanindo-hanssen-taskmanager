# Auto-save dan sinkronisasi ke Supabase – panduan untuk Agent

Panduan ini menjelaskan aturan yang harus diikuti agar semua perubahan user (termasuk delete) tersimpan dan tersinkron ke Supabase. Gunakan saat menambah atau mengubah fitur yang menyangkut data yang bisa diedit user.

---

## Prinsip umum

1. **Semua data yang user edit** (board, groups, tasks, project names, list of projects, dll.) harus **auto-save** (commit on blur atau debounced) dan **sync ke Supabase**.
2. **Hindari hanya localStorage** untuk data yang harus persist antar device/session. Gunakan **Supabase sebagai source of truth**; localStorage hanya untuk cache/offline jika perlu.
3. **Setiap aksi delete** (task, group, board, project/member di list) harus memicu save/delete ke Supabase agar setelah re-open dashboard item yang di-delete tidak muncul lagi.

---

## Di board (halaman board)

- Setiap perubahan state board harus memicu save (lewat debounce + save on leave).
- Field yang bisa diedit (board name, description, group title, task name, notes, member name) harus **commit ke state on blur** (bukan hanya on explicit Confirm), agar tidak hilang saat user refresh tanpa klik Confirm.
- Setelah **delete task** atau **delete group**, panggil **saveBoardAsync(board)** dengan board yang sudah di-update agar delete langsung ke-Supabase (jangan andalkan debounce saja).

---

## Di sidebar (app shell)

- Setiap perubahan board (favorites, rename, dll.) harus memanggil **saveBoardAsync** (atau API save) agar Supabase ikut terupdate.
- **Delete board** harus memanggil **deleteBoardAsync(boardId)** (bukan hanya `setBoards` filter) agar board benar-benar dihapus di Supabase.

---

## List of Projects (Overview)

- Data "Members & projects" di-load dari Supabase (`fetchOverviewMemberProjects`) dan di-save ke Supabase (`saveOverviewMemberProjects`) dengan debounce. Setiap perubahan (tambah/edit/hapus project atau member) ikut tersimpan ke Supabase lewat effect yang sudah ada.

---

## Di mana save project/board dipanggil (untuk developer)

| UI / aksi | File | Fungsi yang memicu save |
|-----------|------|-------------------------|
| **Board:** Add member (tombol "Add member" di header atau di Team roster) | `components/board/board-client.tsx` | `handleAddMember()` → `saveBoardAsync(nextBoard)` |
| **Board:** Edit nama member / inisial (cell Member di tabel Team roster) | `components/board/board-client.tsx` | `handleMemberChange()` → `saveBoardAsync(nextBoard)` |
| **Board:** Ubah warna member (color picker di tabel) | `components/board/board-client.tsx` | `handleMemberColorChange()` → `saveBoardAsync(nextBoard)` |
| **Board:** Remove member (tombol Remove di tabel) | `components/board/board-client.tsx` | `handleRemoveMember()` → `saveBoardAsync(nextBoard)` |
| **Board:** Semua perubahan lain (nama board, group, task, dll.) | `components/board/board-client.tsx` | Effect debounce 400ms + save on `visibilitychange` / `beforeunload` → `saveBoardAsync(board)` |
| **Sidebar:** Rename/delete board, favorites | `components/dashboard/app-shell.tsx` | `saveBoardAsync` / `deleteBoardAsync` |
| **Overview:** List of projects, add/edit/hapus member & project | `components/overview/ListOfProjectsSegment.tsx` | `saveOverviewMemberProjects()` (debounce) |

Data board (termasuk `board.members`) disimpan lewat **`saveBoardAsync`** di `lib/utils/board-storage.ts` (Supabase).

---

## Ringkas

- **Ubah atau delete** di mana pun (board, sidebar, overview) → state update → **auto-save / delete call** → Supabase.
- Saat refresh/re-open dashboard, load dari Supabase sehingga data yang sudah di-delete tidak muncul lagi dan semua perubahan tetap tersimpan.
