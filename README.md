# Website Gudang (Static Pro)

Fitur:
- Dark mode (auto mengikuti system + toggle)
- Search judul + tag (ketik `#tag` untuk filter cepat)
- Icon per kategori
- Admin edit link tanpa backend (LocalStorage)
  - Add/Edit/Delete
  - Export JSON
  - Import JSON
  - Reset ke default

## Edit daftar default
Ubah `DEFAULT_SHEETS` di `app.js` lalu deploy ulang.

## Deploy ke Vercel
Ini static site. Upload folder / push ke GitHub lalu import project di Vercel.

Catatan: kalau admin edit link, perubahan tersimpan di browser perangkat tersebut.
Untuk dibagikan ke tim: Export JSON → commit ke repo / kirim file → Import di perangkat lain.

## Admin PIN
- PIN default ada di `app.js` (konstanta `ADMIN_PIN`).
- Setelah benar, Admin terbuka selama `UNLOCK_MINUTES` menit.
- Opsi "Ingat perangkat" menyimpan akses selama `REMEMBER_DAYS` hari.
