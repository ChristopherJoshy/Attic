const REALTIME_URL = "http://localhost:3004/broadcast";

export async function broadcast(groupId: string, event: string, data: unknown) {
  try {
    await fetch(REALTIME_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room: `group:${groupId}`,
        event,
        data,
      }),
    });
  } catch {
    // realtime service may be down; non-fatal
  }
}
