import { Suspense } from "react";
import SuccessPage from "./SuccessPageClient";

export default function SuccessRoutePage() {
  return (
    <Suspense
      fallback={
        <main className="archive-shell flex min-h-screen items-center justify-center px-5">
          <p className="text-sm uppercase tracking-[0.22em] text-[#9baabd]">Confirming your payment...</p>
        </main>
      }
    >
      <SuccessPage />
    </Suspense>
  );
}
