import { useEffect, useRef, useState } from "react";

/**
 * Manage the doctor dashboard WebSocket event stream.
 * @param {object|null} user Authenticated Firebase user.
 * @returns {object} Connection state and latest dashboard events.
 */
export function useWebSocket(user) {
  const [events, setEvents] = useState([]);
  const [connectionState, setConnectionState] = useState("idle");
  const socketRef = useRef(null);
  const retryRef = useRef(0);

  useEffect(() => {
    let closedByEffect = false;
    async function connect() {
      if (!user) {
        setConnectionState("idle");
        return;
      }
      const token = await user.getIdToken();
      if (closedByEffect) return;

      const socket = new WebSocket(`${import.meta.env.VITE_WS_URL}/ws/dashboard?token=${token}`);
      socketRef.current = socket;
      socket.onopen = () => setConnectionState("connected");
      /* Event shape: { event: string, payload: object, occurred_at: string } */
      socket.onmessage = (message) => {
        try {
          const parsed = JSON.parse(message.data);
          setEvents((current) => [parsed, ...current].slice(0, 60));
        } catch {
          // Ignore non-JSON frames so a keepalive or proxy message does not break the dashboard.
        }
      };
      socket.onclose = () => {
        setConnectionState("disconnected");
        if (!closedByEffect) {
          retryRef.current += 1;
          setTimeout(connect, Math.min(2000 * retryRef.current, 8000));
        }
      };
      socket.onerror = () => setConnectionState("error");
    }
    connect();
    return () => {
      closedByEffect = true;
      socketRef.current?.close();
    };
  }, [user]);

  return { events, latestEvent: events[0] || null, connectionState };
}
