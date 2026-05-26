"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="app-container min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10 mb-6">
          <AlertTriangle className="w-10 h-10 text-destructive" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          Terjadi Kesalahan
        </h1>

        <p className="text-muted-foreground text-sm max-w-xs mb-8">
          Maaf, terjadi kesalahan saat memuat halaman. Silakan coba lagi atau
          kembali ke halaman utama.
        </p>

        {error?.digest && (
          <p className="text-xs text-muted-foreground/60 mb-6">
            Kode referensi: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          <Button
            onClick={reset}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Coba Lagi
          </Button>

          <Button variant="outline" asChild className="flex-1">
            <Link href="/">Ke Beranda</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
