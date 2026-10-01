import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl font-bold text-accent">404</p>
      <h1 className="text-xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="max-w-sm text-sm text-muted">It may have been removed, or you may not have access to it.</p>
      <Link href="/dashboard" className="btn btn-primary mt-2">Back to dashboard</Link>
    </main>
  );
}
