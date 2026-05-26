import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="app-container min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 mb-6">
          <SearchX className="w-10 h-10 text-emerald-600" />
        </div>

        <h1 className="text-6xl font-extrabold text-foreground mb-2">404</h1>

        <h2 className="text-xl font-semibold text-foreground mb-2">
          Halaman Tidak Ditemukan
        </h2>

        <p className="text-muted-foreground text-sm max-w-xs mb-8">
          Maaf, halaman yang Anda cari tidak ditemukan atau telah dipindahkan.
          Silakan kembali ke halaman utama.
        </p>

        <Button
          asChild
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Link href="/">Kembali ke Beranda</Link>
        </Button>
      </div>
    </div>
  );
}
