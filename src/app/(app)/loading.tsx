export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-48 rounded-md bg-gray-200" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-24 rounded-xl bg-gray-200/80" />
        <div className="h-24 rounded-xl bg-gray-200/80" />
        <div className="h-24 rounded-xl bg-gray-200/80" />
      </div>
      <div className="h-64 rounded-xl bg-gray-200/80" />
    </div>
  );
}
