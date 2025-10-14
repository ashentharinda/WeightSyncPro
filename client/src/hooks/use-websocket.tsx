import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const handlers = useRef<Map<string, (data: any) => void>>(new Map());

  useEffect(() => {
    const socket = io({
      // default connects to same origin; adjust if server is on different host
      transports: ["websocket"]
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      console.log("Socket.IO connected");
    });

    socket.on("disconnect", () => {
      setConnected(false);
      console.log("Socket.IO disconnected");
    });

    // Generic event router: for each registered event name, attach listener
    const attachAll = () => {
      handlers.current.forEach((_handler, eventName) => {
        socket.on(eventName, (payload: any) => {
          const fn = handlers.current.get(eventName);
          if (fn) fn(payload?.data ?? payload);
        });
      });
    };

    attachAll();

    return () => {
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, []);

  const subscribe = (eventName: string, handler: (data: any) => void) => {
    handlers.current.set(eventName, handler);
    if (socketRef.current) {
      socketRef.current.on(eventName, (payload: any) => {
        const data = payload?.data ?? payload;
        handler(data);
      });
    }
    return () => {
      handlers.current.delete(eventName);
      socketRef.current?.off(eventName, handler as any);
    };
  };

  const send = (eventName: string, data: any) => {
    socketRef.current?.emit(eventName, data);
  };

  return {
    connected,
    subscribe,
    send
  };
}
