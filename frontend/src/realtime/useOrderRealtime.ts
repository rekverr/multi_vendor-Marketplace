import { useEffect, useEffectEvent, useRef, useState } from "react";
import { io } from "socket.io-client";
import { apiUrl } from "../api/client";
import { useAuth } from "../features/auth/AuthContext";
import type { RealtimeConnection, RealtimeEnvelope } from "./realtime.types";

export function useOrderRealtime(
  orderId: string,
  sellerOrderIds: string[],
  onResync: () => Promise<void>,
): RealtimeConnection {
  const auth = useAuth();
  const [connection, setConnection] =
    useState<RealtimeConnection>("connecting");
  const seenEvents = useRef(new Set<string>());
  const connectedBefore = useRef(false);
  const resync = useEffectEvent(onResync);
  const sellerOrderKey = sellerOrderIds.join(",");

  useEffect(() => {
    const socket = io(apiUrl("/realtime"), {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      auth: (callback) => callback({ token: auth.getAccessToken() }),
    });

    const subscribe = (): void => {
      socket.emit("subscribe:order", { orderId });
      sellerOrderKey
        .split(",")
        .filter(Boolean)
        .forEach((sellerOrderId) =>
          socket.emit("subscribe:seller-order", { sellerOrderId }),
        );
    };
    const handleUpdate = (event: unknown): void => {
      if (!isEnvelope(event) || seenEvents.current.has(event.eventId)) return;
      seenEvents.current.add(event.eventId);
      if (seenEvents.current.size > 100)
        seenEvents.current.delete(
          seenEvents.current.values().next().value ?? "",
        );
      void resync().catch(() => seenEvents.current.delete(event.eventId));
    };

    socket.on("connect", () => {
      setConnection("connected");
      subscribe();
      if (connectedBefore.current) void resync().catch(() => undefined);
      connectedBefore.current = true;
    });
    socket.on("disconnect", (reason) => {
      setConnection("disconnected");
      if (reason === "io server disconnect") {
        void resync()
          .catch(() => undefined)
          .finally(() => socket.connect());
      }
    });
    socket.on("connect_error", () => setConnection("disconnected"));
    socket.on("order.status.updated", handleUpdate);
    socket.on("seller-order.status.updated", handleUpdate);

    return () => {
      socket.disconnect();
    };
  }, [auth, orderId, sellerOrderKey]);

  return connection;
}

function isEnvelope(value: unknown): value is RealtimeEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "eventId") === "string"
  );
}
