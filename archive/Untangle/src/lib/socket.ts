"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url =
      typeof window !== "undefined" && process.env.NEXT_PUBLIC_REALTIME_URL
        ? process.env.NEXT_PUBLIC_REALTIME_URL
        : typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost:3003";

    socket = io(url, {
      transports: ["websocket", "polling"],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 10000,
    });
  }
  return socket;
}

export function joinGroupRoom(groupId: string) {
  const s = getSocket();
  s.emit("group:join", groupId);
}

export function leaveGroupRoom(groupId: string) {
  const s = getSocket();
  s.emit("group:leave", groupId);
}
