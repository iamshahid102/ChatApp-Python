export const API_CACHE_NAME = "chatapp-api-v1";

export async function clearApiCache(): Promise<void> {
  if (typeof caches === "undefined") {
    return;
  }
  try {
    await caches.delete(API_CACHE_NAME);
  } catch {
    // Cache storage may be unavailable (private mode); nothing to clear.
  }
}
