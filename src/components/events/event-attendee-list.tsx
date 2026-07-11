import { Link } from "@/i18n/navigation";
import { Star, CircleCheck, MapPin } from "lucide-react";

export type AttendeeItem = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  city: string | null;
};

function AttendeeRow({ user }: { user: AttendeeItem }) {
  return (
    <li>
      <Link
        href={`/verkoper/${user.id}`}
        className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-muted"
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {(user.displayName ?? "?").charAt(0).toUpperCase()}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">{user.displayName ?? "Onbekend"}</span>
          {user.city && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {user.city}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

/** Volledige RSVP-lijsten voor de Bezoekers-tab: eerst wie er komt, daarna
 *  wie geïnteresseerd is. Lijsten zijn server-side gecapt; de totalen tonen
 *  het echte aantal. */
export function EventAttendeeList({
  going,
  interested,
  goingTotal,
  interestedTotal,
}: {
  going: AttendeeItem[];
  interested: AttendeeItem[];
  goingTotal: number;
  interestedTotal: number;
}) {
  if (goingTotal === 0 && interestedTotal === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nog niemand heeft zich aangemeld — gebruik de knoppen bovenaan om de eerste te zijn.
      </p>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <CircleCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Aanwezig ({goingTotal})
        </h3>
        {going.length > 0 ? (
          <ul className="space-y-0.5">
            {going.map((u) => <AttendeeRow key={u.id} user={u} />)}
            {goingTotal > going.length && (
              <li className="px-2 py-1 text-xs text-muted-foreground">+ nog {goingTotal - going.length} anderen</li>
            )}
          </ul>
        ) : (
          <p className="px-2 text-sm text-muted-foreground">Nog niemand aangemeld als aanwezig.</p>
        )}
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Star className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Geïnteresseerd ({interestedTotal})
        </h3>
        {interested.length > 0 ? (
          <ul className="space-y-0.5">
            {interested.map((u) => <AttendeeRow key={u.id} user={u} />)}
            {interestedTotal > interested.length && (
              <li className="px-2 py-1 text-xs text-muted-foreground">+ nog {interestedTotal - interested.length} anderen</li>
            )}
          </ul>
        ) : (
          <p className="px-2 text-sm text-muted-foreground">Nog geen geïnteresseerden.</p>
        )}
      </section>
    </div>
  );
}
