# Flash Peak Community — Pure Node.js + Supabase (Vercel-ready)

Versi ini **tidak memakai Express maupun Socket.IO** — backend murni Node.js
Serverless Function, dan datanya disimpan di **Supabase (Postgres)** supaya
bisa diakses semua pengguna secara real, bukan cuma per-browser.

## Kenapa bukan IndexedDB sebagai database utama?

IndexedDB hidup **di dalam browser masing-masing orang** — server tidak bisa
membacanya, dan browser orang lain juga tidak bisa membaca IndexedDB
punya orang lain. Kalau dipakai sebagai satu-satunya penyimpanan, setiap
device hanya akan melihat data pendaftarannya sendiri — notifikasi "ada
Lord baru join" ke semua orang jadi tidak mungkin jalan.

Karena itu, di versi ini:
- **Supabase (Postgres)** = sumber data utama, dibagikan ke semua pengguna, persisten.
- **IndexedDB** (`public/idb.js`) = cache lokal saja, supaya saat reload halaman roster langsung tampil dari cache sebelum polling pertama ke server selesai.

## Setup Supabase (wajib sebelum jalan)

1. Buat project baru di [supabase.com](https://supabase.com) (gratis).
2. Buka **SQL Editor** di dashboard project → jalankan isi file `supabase/schema.sql` (bikin tabel `members`).
3. Buka **Settings → API** di dashboard, catat dua nilai ini:
   - **Project URL** → contoh `https://xxxxxxxxxxxx.supabase.co`
   - **service_role key** (bukan `anon` key — yang ini rahasia, jangan dipakai di sisi client)
4. Copy `.env.example` jadi `.env`, isi dua nilai di atas:
   ```
   SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

## Cara jalankan lokal

```bash
npm install
npm run dev
```
Buka `http://localhost:3000`. Server lokal (`server.local.js`) otomatis
membaca file `.env` kamu dan meniru routing Vercel (`/api/*.js` sebagai
function, `/public` sebagai static) — tanpa dependency `dotenv` atau
`express` sama sekali.

Kalau `.env` belum diisi, API akan merespons pesan error yang jelas
("Supabase belum dikonfigurasi...") — bukan crash diam-diam.

## Cara deploy ke Vercel

1. Push folder ini ke GitHub/GitLab/Bitbucket.
2. Import project di [vercel.com](https://vercel.com).
3. Di **Project Settings → Environment Variables**, tambahkan `SUPABASE_URL`
   dan `SUPABASE_SERVICE_ROLE_KEY` dengan nilai yang sama seperti di `.env`.
4. Deploy. `vercel.json` sudah mengatur `/api/*` sebagai Serverless Function
   dan `/public` sebagai static asset.

## Struktur Proyek

```
flash-peak-register/
├── api/
│   ├── _supabase.js     # Shared Supabase client (service_role, server-only)
│   ├── members.js       # GET semua anggota dari tabel `members`
│   └── register.js      # POST pendaftaran anggota baru ke tabel `members`
├── supabase/
│   └── schema.sql        # Jalankan sekali di Supabase SQL Editor
├── public/
│   ├── index.html         # Redirect ke landing.html
│   ├── landing.html        # Landing page komunitas
│   ├── landing.css / landing.js
│   ├── pendaftaran.html    # Form pendaftaran + notifikasi + roster
│   ├── style.css            # Tema visual bersama
│   ├── app.js                 # Logic client: polling 1s, IndexedDB cache, canvas ID card
│   ├── idb.js                  # Helper IndexedDB (cache lokal, bukan database utama)
│   └── avatars/*.svg
├── server.local.js       # Dev server lokal (Node http murni + .env loader manual)
├── vercel.json
├── .env.example
└── package.json           # 1 dependency: @supabase/supabase-js. Tanpa express/socket.io.
```

## Bagaimana real-time-nya bekerja tanpa WebSocket

1. Setiap client (browser) menjalankan `setInterval` tiap **1 detik**
   memanggil `GET /api/members`, yang membaca langsung dari Supabase.
2. Client membandingkan `memberId` yang baru datang dengan yang sudah pernah
   dilihat sebelumnya.
3. `memberId` baru → didorong ke antrean notifikasi (`join-toast` di atas,
   bergantian tiap 2 detik) + roster di-render ulang.
4. Semua anggota yang diterima juga disimpan ke IndexedDB, supaya reload
   halaman langsung menampilkan roster dari cache sebelum polling pertama
   selesai — Supabase tetap yang menentukan data mana yang benar.

Karena datanya sekarang di Supabase (bukan `globalThis` per-instance),
semua pengguna — dari device dan lokasi manapun — melihat roster dan
notifikasi yang **sama dan konsisten**, walau mekanismenya polling bukan
push WebSocket.

## Validasi yang berjalan dua lapis

- **Di server (`api/register.js`)**: cek nama/usia/gameId/username/alasan/posisi,
  dan cek duplikat game ID/username lewat query Supabase sebelum insert.
- **Di database (Postgres constraint)**: `unique` di `game_id` dan `username`,
  `check` di kolom `posisi` (hanya boleh ST/CM/WF/CB) — jadi walau ada race
  condition dua orang daftar bersamaan dengan data sama, database yang
  jadi penjaga terakhir.
