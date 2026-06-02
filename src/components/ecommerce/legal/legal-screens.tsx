'use client'

import { PageHeader } from '@/components/ecommerce/shared'

interface LegalPageProps {
  onBack: () => void
}

export function PrivacyPolicyScreen({ onBack }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Kebijakan Privasi" onBack={onBack} />

      <div className="px-4 py-6 max-w-2xl mx-auto prose prose-sm dark:prose-invert">
        <p className="text-xs text-muted-foreground">Terakhir diperbarui: Maret 2025</p>

        <h2>1. Pendahuluan</h2>
        <p>
          MartUp (&quot;kami&quot;, &quot;milik kami&quot;, atau &quot;platform&quot;) menghargai privasi Anda. 
          Kebijakan Privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, menyimpan, dan 
          melindungi informasi pribadi Anda saat menggunakan aplikasi MartUp.
        </p>
        <p>
          Dengan menggunakan MartUp, Anda menyetujui pengumpulan dan penggunaan informasi sesuai 
          dengan kebijakan ini. Kebijakan ini disusun sesuai dengan Undang-Undang Perlindungan Data 
          Pribadi (UU PDP) Republik Indonesia.
        </p>

        <h2>2. Informasi yang Kami Kumpulkan</h2>
        <h3>2.1 Informasi yang Anda Berikan</h3>
        <ul>
          <li><strong>Data Akun:</strong> Nama lengkap, alamat email, nomor telepon, kata sandi (terenkripsi)</li>
          <li><strong>Data Profil:</strong> Foto profil, alamat pengiriman</li>
          <li><strong>Data Penjual:</strong> Nama toko, deskripsi toko, informasi rekening bank, alamat toko</li>
          <li><strong>Data Transaksi:</strong> Riwayat pembelian, pembayaran, pengiriman, dan penarikan dana</li>
          <li><strong>Data Ulasan:</strong> Rating, komentar, dan foto ulasan produk</li>
        </ul>

        <h3>2.2 Informasi yang Dikumpulkan Secara Otomatis</h3>
        <ul>
          <li><strong>Data Perangkat:</strong> Jenis perangkat, sistem operasi, versi aplikasi</li>
          <li><strong>Data Penggunaan:</strong> Halaman yang dikunjungi, fitur yang digunakan, waktu akses</li>
          <li><strong>Data Lokasi:</strong> Lokasi umum (kota/provinsi) untuk estimasi pengiriman</li>
          <li><strong>Cookie & Token:</strong> Token sesi autentikasi, preferensi pengguna</li>
        </ul>

        <h2>3. Penggunaan Informasi</h2>
        <p>Kami menggunakan informasi Anda untuk:</p>
        <ul>
          <li>Menyediakan, memelihara, dan meningkatkan layanan MartUp</li>
          <li>Memproses transaksi dan pembayaran</li>
          <li>Mengirimkan notifikasi terkait pesanan, pembayaran, dan pengiriman</li>
          <li>Mencegah penipuan dan aktivitas ilegal</li>
          <li>Meningkatkan pengalaman pengguna dan mengembangkan fitur baru</li>
          <li>Memenuhi kewajiban hukum dan peraturan yang berlaku</li>
        </ul>

        <h2>4. Penyimpanan dan Keamanan Data</h2>
        <p>
          Data Anda disimpan di server yang aman dengan enkripsi SSL/TLS. Kami menerapkan langkah-langkah 
          keamanan teknis dan organisatoris yang sesuai untuk melindungi data pribadi Anda dari akses 
          tidak sah, pengungkapan, perubahan, atau penghancuran.
        </p>
        <ul>
          <li>Kata sandi disimpan dalam bentuk hash menggunakan bcrypt</li>
          <li>Token autentikasi menggunakan HMAC-SHA256</li>
          <li>Semua komunikasi dienkripsi menggunakan HTTPS</li>
          <li>Data keuangan dilindungi dengan transaksi database atomik</li>
        </ul>

        <h2>5. Berbagi Informasi</h2>
        <p>Kami TIDAK menjual data pribadi Anda. Kami hanya berbagi informasi dengan:</p>
        <ul>
          <li><strong>Penjual:</strong> Informasi pengiriman dan pesanan yang diperlukan</li>
          <li><strong>Mitra Pembayaran:</strong> Untuk memproses transaksi (Midtrans, dll.)</li>
          <li><strong>Mitra Pengiriman:</strong> Untuk mengirimkan pesanan (JNE, J&amp;T, SiCepat, dll.)</li>
          <li><strong>Otoritas Hukum:</strong> Jika diwajibkan oleh hukum</li>
        </ul>

        <h2>6. Hak Anda</h2>
        <p>Sesuai UU PDP Indonesia, Anda memiliki hak untuk:</p>
        <ul>
          <li>Mengakses data pribadi yang kami simpan tentang Anda</li>
          <li>Meminta perbaikan data yang tidak akurat</li>
          <li>Meminta penghapusan data pribadi Anda</li>
          <li>Menarik persetujuan penggunaan data</li>
          <li>Mengajukan keberatan atas pemrosesan data</li>
        </ul>

        <h2>7. Penyimpanan Data</h2>
        <p>
          Kami menyimpan data pribadi Anda selama akun Anda aktif atau sesuai kebutuhan untuk 
          menyediakan layanan. Data transaksi disimpan selama minimal 5 tahun sesuai ketentuan 
          perpajakan Indonesia. Anda dapat meminta penghapusan akun melalui pengaturan profil.
        </p>

        <h2>8. Kontak</h2>
        <p>
          Untuk pertanyaan tentang kebijakan privasi ini, hubungi kami di:
        </p>
        <ul>
          <li>Email: privacy@martup.id</li>
          <li>Alamat: Jakarta, Indonesia</li>
        </ul>
      </div>
    </div>
  )
}

export function TermsOfServiceScreen({ onBack }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Syarat & Ketentuan" onBack={onBack} />

      <div className="px-4 py-6 max-w-2xl mx-auto prose prose-sm dark:prose-invert">
        <p className="text-xs text-muted-foreground">Terakhir diperbarui: Maret 2025</p>

        <h2>1. Ketentuan Umum</h2>
        <p>
          Dengan mengunduh, mengakses, atau menggunakan aplikasi MartUp, Anda menyetujui untuk 
          terikat oleh Syarat & Ketentuan ini. Jika Anda tidak menyetujui, harap tidak menggunakan 
          layanan kami.
        </p>

        <h2>2. Akun Pengguna</h2>
        <ul>
          <li>Anda harus berusia minimal 17 tahun untuk membuat akun</li>
          <li>Anda bertanggung jawab menjaga kerahasiaan kredensial akun Anda</li>
          <li>Anda tidak boleh membuat akun menggunakan informasi palsu</li>
          <li>Anda harus segera melaporkan penggunaan akun yang tidak sah</li>
          <li>Satu pengguna hanya boleh memiliki satu akun aktif</li>
        </ul>

        <h2>3. Akun Penjual</h2>
        <ul>
          <li>Penjual wajib memberikan informasi toko dan rekening bank yang benar</li>
          <li>Penjual bertanggung jawab atas kualitas dan keaslian produk yang dijual</li>
          <li>Penjual wajib mengirimkan pesanan dalam waktu yang ditentukan</li>
          <li>MartUp berhak mengenakan biaya komisi atas setiap transaksi berhasil</li>
          <li>Penarikan dana memerlukan persetujuan admin (1x24 jam kerja)</li>
        </ul>

        <h2>4. Transaksi & Pembayaran</h2>
        <ul>
          <li>Semua transaksi menggunakan Rupiah Indonesia (IDR)</li>
          <li>Pembayaran diproses melalui mitra pembayaran resmi (Midtrans)</li>
          <li>Deposit saldo memerlukan verifikasi pembayaran sebelum dikreditkan</li>
          <li>MartUp tidak bertanggung jawab atas keterlambatan dari pihak pembayaran</li>
          <li>Harga produk dapat berubah tanpa pemberitahuan sebelumnya</li>
        </ul>

        <h2>5. Pengiriman</h2>
        <ul>
          <li>Waktu pengiriman tergantung pada layanan kurir yang dipilih</li>
          <li>Penjual harus mengirimkan pesanan dalam waktu 1x24 jam setelah pembayaran dikonfirmasi</li>
          <li>Risiko kerusakan selama pengiriman menjadi tanggung jawab penjual</li>
          <li>Pembeli wajib memeriksa paket saat diterima</li>
        </ul>

        <h2>6. Pembatalan & Pengembalian Dana</h2>
        <ul>
          <li>Pembatalan pesanan dapat dilakukan sebelum penjual mengirimkan barang</li>
          <li>Pengembalian dana diproses dalam 3-7 hari kerja</li>
          <li>Barang yang sudah diterima dapat dikembalikan sesuai Kebijakan Pengembalian</li>
          <li>MartUp berhak membatalkan transaksi yang dicurigai sebagai penipuan</li>
        </ul>

        <h2>7. Larangan</h2>
        <p>Anda dilarang untuk:</p>
        <ul>
          <li>Menjual produk ilegal, berbahaya, atau melanggar hukum</li>
          <li>Melakukan penipuan, manipulasi harga, atau transaksi fiktif</li>
          <li>Menggunakan robot, scraper, atau alat otomatis lainnya</li>
          <li>Mengirimkan konten yang melanggar hak kekayaan intelektual</li>
          <li>Mengganggu atau merusak infrastruktur platform</li>
        </ul>

        <h2>8. Batasan Tanggung Jawab</h2>
        <p>
          MartUp berfungsi sebagai perantara antara pembeli dan penjual. Kami tidak bertanggung 
          jawab atas kualitas produk, keterlambatan pengiriman, atau sengketa antara pembeli dan 
          penjual. Namun, kami akan membantu mediasi jika terjadi perselisihan.
        </p>

        <h2>9. Perubahan Ketentuan</h2>
        <p>
          Kami berhak mengubah Syarat & Ketentuan ini kapan saja. Perubahan akan diberitahukan 
          melalui aplikasi. Penggunaan berkelanjutan setelah perubahan berarti Anda menyetujui 
          ketentuan yang diperbarui.
        </p>

        <h2>10. Hukum yang Berlaku</h2>
        <p>
          Syarat & Ketentuan ini diatur oleh dan ditafsirkan sesuai dengan hukum Republik Indonesia. 
          Setiap perselisihan akan diselesaikan melalui musyawarah, dan jika gagal, melalui 
          Badan Arbitrase Nasional Indonesia (BANI).
        </p>

        <h2>11. Kontak</h2>
        <ul>
          <li>Email: legal@martup.id</li>
          <li>Alamat: Jakarta, Indonesia</li>
        </ul>
      </div>
    </div>
  )
}

export function RefundPolicyScreen({ onBack }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Kebijakan Pengembalian" onBack={onBack} />

      <div className="px-4 py-6 max-w-2xl mx-auto prose prose-sm dark:prose-invert">
        <p className="text-xs text-muted-foreground">Terakhir diperbarui: Maret 2025</p>

        <h2>1. Ketentuan Umum</h2>
        <p>
          MartUp berkomitmen untuk memastikan kepuasan pembeli. Kebijakan ini menjelaskan ketentuan 
          pengembalian dana untuk transaksi yang dilakukan melalui platform kami, sesuai dengan 
          Peraturan Menteri Perdagangan tentang Transaksi Perdagangan Melalui Sistem Elektronik.
        </p>

        <h2>2. Hak Pengembalian</h2>
        <p>Pembeli dapat mengajukan pengembalian dana dalam kondisi berikut:</p>
        <ul>
          <li><strong>Barang tidak sesuai:</strong> Produk berbeda dari deskripsi/foto di listing</li>
          <li><strong>Barang rusak:</strong> Produk diterima dalam kondisi rusak atau cacat</li>
          <li><strong>Barang tidak diterima:</strong> Pesanan tidak diterima setelah batas waktu pengiriman</li>
          <li><strong>Produk palsu:</strong> Produk terbukti tidak asli (harus disertai bukti)</li>
          <li><strong>Pesanan dibatalkan:</strong> Pembatalan sebelum penjual mengirim barang</li>
        </ul>

        <h2>3. Batas Waktu Pengembalian</h2>
        <ul>
          <li><strong>Produk fisik:</strong> Maksimal 7 hari setelah barang diterima</li>
          <li><strong>Produk digital:</strong> Maksimal 24 jam setelah pembelian</li>
          <li><strong>Barang tidak diterima:</strong> Maksimal 14 hari setelah estimasi pengiriman</li>
        </ul>

        <h2>4. Proses Pengembalian Dana</h2>
        <ol>
          <li><strong>Ajukan Klaim:</strong> Buka detail pesanan → &quot;Ajukan Pengembalian&quot;</li>
          <li><strong>Isi Formulir:</strong> Pilih alasan, deskripsi masalah, dan unggah bukti foto</li>
          <li><strong>Verifikasi:</strong> Tim MartUp akan meninjau klaim dalam 1x24 jam</li>
          <li><strong>Negosiasi:</strong> Penjual diberi kesempatan merespons (maks. 2x24 jam)</li>
          <li><strong>Keputusan:</strong> MartUp memutuskan berdasarkan bukti dari kedua pihak</li>
          <li><strong>Refund:</strong> Dana dikembalikan ke saldo MartUp atau rekening asal</li>
        </ol>

        <h2>5. Metode Pengembalian Dana</h2>
        <ul>
          <li><strong>Saldo MartUp:</strong> Proses instan (disarankan)</li>
          <li><strong>Rekening asal:</strong> 3-7 hari kerja tergantung metode pembayaran awal</li>
          <li><strong>Midtrans refund:</strong> 5-14 hari kerja untuk kartu kredit</li>
        </ul>

        <h2>6. Kondisi yang Tidak Dapat Dikembalikan</h2>
        <ul>
          <li>Produk yang sudah digunakan atau rusak akibat kelalaian pembeli</li>
          <li>Produk dengan segel yang sudah dibuka (kecuali produk rusak/cacat)</li>
          <li>Produk digital yang sudah diakses/diunduh</li>
          <li>Produk custom-made sesuai spesifikasi pembeli</li>
          <li>Voucher dan promo yang sudah digunakan</li>
        </ul>

        <h2>7. Biaya Pengembalian</h2>
        <ul>
          <li><strong>Kesalahan penjual:</strong> Biaya pengiriman pengembalian ditanggung penjual</li>
          <li><strong>Kesalahan pembeli:</strong> Biaya pengiriman pengembalian ditanggung pembeli</li>
          <li><strong>Produk rusak/salah:</strong> Tidak ada potongan biaya</li>
        </ul>

        <h2>8. Perlindungan Penjual</h2>
        <p>
          MartUp juga melindungi penjual dari klaim yang tidak sah. Penjual dapat menolak klaim 
          pengembalian dengan menyertakan bukti yang valid. Keputusan akhir berada di tangan MartUp 
          sebagai mediator.
        </p>

        <h2>9. Eskalasi</h2>
        <p>
          Jika Anda tidak puas dengan keputusan pengembalian dana, Anda dapat mengajukan 
          banding dalam 3 hari kerja. MartUp akan meninjau ulang dengan tim senior.
        </p>

        <h2>10. Kontak</h2>
        <ul>
          <li>Email: refund@martup.id</li>
          <li>CS: Hubungi melalui fitur chat di aplikasi</li>
        </ul>
      </div>
    </div>
  )
}
