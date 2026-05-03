"use client";

import { useEffect, useRef, useState } from "react";

export interface PolledMessage {
  id: string;
  body: string;
  imageUrl: string | null;
  senderName: string;
  senderId: string;
  createdAt: string;
  proposalId: string | null;
  bundleProposalId: string | null;
}

export interface PolledPickupState {
  bundleId: string;
  bundleStatus: string;
  paymentMode: string;
  deliveryMethod: string;
  scheduleStatus: string | null;
  proposedById: string | null;
  proposedFor: string | null;
  windowStart: string | null;
  windowEnd: string | null;
}

interface PollResponse {
  serverTime: string;
  messages: PolledMessage[];
  pickupState: PolledPickupState | null;
}

interface Options {
  conversationId: string;
  initialSince: string; // ISO timestamp van laatste bekende message
  enabled?: boolean;
  // Cadence (Fase 27.55):
  // - 5s default zolang er recent activity is
  // - 15s na 3 lege polls (adaptive backoff)
  // - 0 (paused) als tab niet zichtbaar
  fastIntervalMs?: number;
  slowIntervalMs?: number;
  emptyPollsBeforeBackoff?: number;
}

// Hook voor live-chat polling. Houdt rekening met:
// - document.hidden → pauzeer (Page Visibility API)
// - 3 lege polls op rij → backoff naar 15s, reset naar 5s bij nieuwe data
// - Doubt-tracking via lastSeen-timestamp zodat we alleen NIEUWE messages
//   krijgen (server-query is goedkoop indexed lookup, geen full thread)
export function useChatPolling({
  conversationId,
  initialSince,
  enabled = true,
  fastIntervalMs = 5000,
  slowIntervalMs = 15000,
  emptyPollsBeforeBackoff = 3,
}: Options) {
  const [newMessages, setNewMessages] = useState<PolledMessage[]>([]);
  const [pickupState, setPickupState] = useState<PolledPickupState | null>(null);
  const sinceRef = useRef(initialSince);
  const emptyCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(typeof document !== "undefined" ? !document.hidden : true);
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    function schedule() {
      if (intervalRef.current) clearTimeout(intervalRef.current);
      const delay = emptyCountRef.current >= emptyPollsBeforeBackoff
        ? slowIntervalMs
        : fastIntervalMs;
      intervalRef.current = setTimeout(tick, delay);
    }

    async function tick() {
      if (!visibleRef.current || fetchingRef.current) {
        schedule();
        return;
      }
      fetchingRef.current = true;
      try {
        const url = `/api/conversations/${conversationId}/messages?since=${encodeURIComponent(sinceRef.current)}`;
        const res = await fetch(url);
        if (!res.ok) {
          schedule();
          return;
        }
        const data: PollResponse = await res.json();
        if (data.messages.length > 0) {
          setNewMessages((prev) => [...prev, ...data.messages]);
          sinceRef.current = data.messages[data.messages.length - 1].createdAt;
          emptyCountRef.current = 0; // Reset backoff bij activiteit
        } else {
          emptyCountRef.current += 1;
        }
        // Pickup-state kan ook zonder nieuwe messages veranderen (accept/reject).
        // Diepe equality is overkill; we vervangen altijd.
        setPickupState(data.pickupState);
      } catch {
        // Netwerkfout — gewoon doorgaan, volgende tick probeert weer
      } finally {
        fetchingRef.current = false;
        schedule();
      }
    }

    function handleVisibilityChange() {
      visibleRef.current = !document.hidden;
      if (visibleRef.current) {
        // Bij terugkomen: meteen pollen i.p.v. wachten op volgende tick
        emptyCountRef.current = 0;
        if (intervalRef.current) clearTimeout(intervalRef.current);
        tick();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    schedule();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [conversationId, enabled, fastIntervalMs, slowIntervalMs, emptyPollsBeforeBackoff]);

  return { newMessages, pickupState };
}
