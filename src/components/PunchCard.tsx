"use client";

import { useEffect, useState, useTransition } from "react";
import { LiveHours } from "@/components/LiveHours";
import { punchAgainAction, punchInAction, punchOutAction, reportLocationAction, type FormState } from "@/app/actions";
import { distanceMeters, TRACK_RADIUS_M } from "@/lib/geo";

const RADIUS_M = TRACK_RADIUS_M;
const ANCHOR_KEY = "punch-anchor";
type Anchor = { lat: number; lng: number };

const getPosition = () =>
  new Promise<GeolocationPosition>((resolve, reject) =>
    !("geolocation" in navigator) ? reject(new Error("no geolocation")) : navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 }));

const readAnchor = (): Anchor | null => {
  try { return JSON.parse(localStorage.getItem(ANCHOR_KEY) ?? "null"); } catch { return null; }
};

type Props = {
  /** Pre-formatted on the server so it matches the company timezone. */
  punchInLabel: string | null;
  punchOutLabel: string | null;
  workedLabel: string | null;
  /** Open punch-in timestamp; when set, "Worked" ticks live. */
  liveStartIso?: string | null;
  /** Admin turned location tracking on for this employee. */
  track?: boolean;
};

export function PunchCard({ punchInLabel, punchOutLabel, workedLabel, liveStartIso, track = false }: Props) {
  const [now, setNow] = useState<Date | null>(null);
  const [result, setResult] = useState<FormState>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  const [away, setAway] = useState(false);
  const [meters, setMeters] = useState<number | null>(null);
  const working = Boolean(punchInLabel && !punchOutLabel);
  const watching = working && track;

  // While punched in, watch the phone's location: outside RADIUS_M of the punch-in spot = "not connected".
  useEffect(() => {
    if (!watching || !("geolocation" in navigator)) {
      try { if (!working) localStorage.removeItem(ANCHOR_KEY); } catch {}
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        let anchor = readAnchor();
        if (!anchor) {
          anchor = here; // punched in elsewhere (e.g. by admin): use the first fix as the base
          try { localStorage.setItem(ANCHOR_KEY, JSON.stringify(anchor)); } catch {}
        }
        const d = distanceMeters(anchor.lat, anchor.lng, here.lat, here.lng);
        void reportLocationAction(here.lat, here.lng, anchor.lat, anchor.lng, pos.coords.accuracy);
        setMeters(Math.round(d));
        setAway((was) => {
          const out = d > RADIUS_M;
          if (out && !was && "Notification" in window && Notification.permission === "granted") {
            new Notification("Not connected", { body: `You are ${Math.round(d)} m away from your punch-in location.` });
          }
          return out;
        });
      },
      () => setMeters(null),
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [watching, working]);

  // Location is best effort: if it's blocked or unavailable, punching in still works and
  // the base spot is taken from the first location fix that arrives later.
  const punchIn = async (fn: () => Promise<FormState>) => {
    if (!track) return fn();
    try {
      localStorage.removeItem(ANCHOR_KEY);
      const pos = await getPosition();
      localStorage.setItem(ANCHOR_KEY, JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
    } catch {}
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
    return fn();
  };

  const run = (fn: () => Promise<FormState>) => startTransition(async () => setResult(await fn()));

  const state = !punchInLabel ? "idle" : !punchOutLabel ? "working" : "done";

  return (
    <div className="card flex flex-col items-center gap-4 text-center">
      <p className="text-sm text-muted">
        {now ? now.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" }) : " "}
      </p>
      <p className="font-mono text-5xl font-semibold tabular-nums">
        {now ? now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: true }) : "--:--:--"}
      </p>

      <div className="grid w-full max-w-sm grid-cols-3 gap-2 text-sm">
        <Stat label="Punch in" value={punchInLabel ?? "—"} />
        <Stat label="Punch out" value={punchOutLabel ?? "—"} />
        <Stat label="Worked" value={liveStartIso ? <LiveHours startIso={liveStartIso} /> : workedLabel ?? "—"} />
      </div>

      {state === "idle" && (
        <button className="btn btn-primary w-full max-w-sm py-3 text-base" disabled={pending} onClick={() => run(() => punchIn(punchInAction))}>
          {pending ? "Punching in..." : "Punch In"}
        </button>
      )}
      {state === "working" && track && (
        <p className={`w-full max-w-sm rounded-lg px-4 py-2 text-sm font-medium ${away ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {away ? `Not connected — ${meters} m from punch-in location (limit ${RADIUS_M} m)` : meters === null ? "Checking location..." : `Working — within ${RADIUS_M} m (${meters} m)`}
        </p>
      )}
      {state === "working" && (
        <button className="btn btn-danger w-full max-w-sm py-3 text-base" disabled={pending} onClick={() => run(punchOutAction)}>
          {pending ? "Punching out..." : "Punch Out"}
        </button>
      )}
      {state === "done" && (
        <>
          <p className="rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700">Done for today. See you tomorrow!</p>
          <button className="btn w-full max-w-sm py-3 text-base" disabled={pending} onClick={() => run(() => punchIn(punchAgainAction))}>
            {pending ? "Punching in..." : "Punch In Again"}
          </button>
        </>
      )}

      {result.error && <p className="text-sm text-red-600">{result.error}</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-gray-50 px-2 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
