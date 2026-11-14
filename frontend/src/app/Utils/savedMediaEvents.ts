export type SavedMediaEvent =
  | { action: "saved-media-added" | "saved-media-deleted"; ttid: string }
  | { action: "saved-media-deleted-all" };

export const SAVED_MEDIA_CHANNEL_NAME = "media-events";

export function publishSavedMediaEvent(event: SavedMediaEvent) {
  const channel = new BroadcastChannel(SAVED_MEDIA_CHANNEL_NAME);
  channel.postMessage(event);
  channel.close();
}
