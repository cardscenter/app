export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between">
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 w-24 rounded-lg bg-muted/50" />
          ))}
        </div>
        <div className="h-8 w-48 rounded-lg bg-muted/50" />
      </div>

      {[1, 2, 3].map((section) => (
        <div key={section} className="space-y-4">
          <div className="h-6 w-40 rounded bg-muted/50" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-muted/30" />
            ))}
          </div>
          <div className="h-56 rounded-xl bg-muted/20" />
        </div>
      ))}
    </div>
  );
}
