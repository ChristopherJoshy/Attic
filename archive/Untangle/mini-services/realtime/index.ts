import { createServer, IncomingMessage, ServerResponse } from "http";
import { Server, Socket } from "socket.io";

const ioServer = createServer();
const io = new Server(ioServer, {
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.on("connection", (socket: Socket) => {
  socket.on("group:join", (groupId: string) => {
    if (typeof groupId === "string") socket.join(`group:${groupId}`);
  });
  socket.on("group:leave", (groupId: string) => {
    if (typeof groupId === "string") socket.leave(`group:${groupId}`);
  });
  socket.on("typing", (data: { groupId: string; username: string }) => {
    if (data?.groupId) socket.to(`group:${data.groupId}`).emit("typing", data);
  });
});

const controlServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ ok: true, rooms: io.sockets.adapter.rooms.size })
    );
    return;
  }
  if (req.method === "POST" && req.url === "/broadcast") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { room, event, data } = JSON.parse(body);
        if (room && event) {
          io.to(room).emit(event, data);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } else {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "missing room or event" }));
        }
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "invalid json" }));
      }
    });
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

const IO_PORT = 3003;
const CONTROL_PORT = 3004;

ioServer.listen(IO_PORT, () => {
  console.log(`[untangle-realtime] socket.io on :${IO_PORT}`);
});
controlServer.listen(CONTROL_PORT, () => {
  console.log(`[untangle-realtime] control http on :${CONTROL_PORT}`);
});

process.on("SIGTERM", () => {
  ioServer.close();
  controlServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  ioServer.close();
  controlServer.close(() => process.exit(0));
});
