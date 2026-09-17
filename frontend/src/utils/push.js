// pushManager.subscribe() needs the VAPID public key as a Uint8Array, but the
// backend hands it over as the same base64url string browsers use elsewhere
// (see household.settings.VAPID_PUBLIC_KEY) -- this converts between the two.
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export const isPushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
