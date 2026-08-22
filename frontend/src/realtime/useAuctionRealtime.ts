import { useEffect, useEffectEvent, useRef, useState } from "react";
import { io } from "socket.io-client";
import { apiUrl } from "../api/client";
import { useAuth } from "../features/auth/AuthContext";
import type { RealtimeConnection, RealtimeEnvelope } from "./realtime.types";

export function useAuctionRealtime(
  auctionId: string,
  onResync: () => Promise<void>,
): RealtimeConnection {
  const auth = useAuth();
  const [connection, setConnection] =
    useState<RealtimeConnection>("connecting");
  const seen = useRef(new Set<string>());
  const connectedBefore = useRef(false);
  const resync = useEffectEvent(onResync);
  useEffect(() => {
    const socket = io(apiUrl("/realtime"), {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      auth: (callback) => callback({ token: auth.getAccessToken() }),
    });
    const handleBid = (event: unknown): void => {
      if (
        !isEnvelope(event) ||
        event.entityId !== auctionId ||
        seen.current.has(event.eventId)
      )
        return;
      seen.current.add(event.eventId);
      if (seen.current.size > 100)
        seen.current.delete(seen.current.values().next().value ?? "");
      void resync().catch(() => seen.current.delete(event.eventId));
    };
    socket.on("connect", () => {
      setConnection("connected");
      socket.emit("subscribe:auction", { auctionId });
      if (connectedBefore.current) void resync().catch(() => undefined);
      connectedBefore.current = true;
    });
    socket.on("disconnect", () => setConnection("disconnected"));
    socket.on("connect_error", () => setConnection("disconnected"));
    socket.on("auction.bid.accepted", handleBid);
    return () => {
      socket.disconnect();
    };
  }, [auctionId, auth]);
  return connection;
}
function isEnvelope(value: unknown): value is RealtimeEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "eventId") === "string" &&
    typeof Reflect.get(value, "entityId") === "string"
  );
}
