"use client";

import { useCallback, useEffect, useState } from "react";
import { EMPTY_SESSION, type FoodSession } from "./food-types";

const KEY = "cc-session-v2";

function read(): FoodSession {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_SESSION;
    const s = JSON.parse(raw) as Partial<FoodSession>;
    return {
      ...EMPTY_SESSION,
      ...s,
      basket: Array.isArray(s.basket) ? s.basket : [],
      myOrders: Array.isArray(s.myOrders) ? s.myOrders : [],
      history: Array.isArray(s.history) ? s.history : [],
    };
  } catch {
    return EMPTY_SESSION;
  }
}

/**
 * Sessie van de bestelapp in localStorage (tafel, naam, mand, opmerking,
 * code, eigen bestellingen, geschiedenis). Hydratie-veilig: eerst de lege
 * sessie, na mount de opgeslagen; `ready` zegt of die geladen is.
 */
export function useFoodSession() {
  const [session, setSessionState] = useState<FoodSession>(EMPTY_SESSION);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSessionState(read());
    setReady(true);
  }, []);

  const setSession = useCallback((patch: Partial<FoodSession> | ((s: FoodSession) => Partial<FoodSession>)) => {
    setSessionState((prev) => {
      const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // geen opslag (privémodus): sessie leeft dan alleen in geheugen
      }
      return next;
    });
  }, []);

  return { session, setSession, ready };
}
