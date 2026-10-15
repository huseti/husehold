import axios from 'axios';
import { useEffect, useRef } from 'react';

// Stale-while-revalidate for GET requests, so switching pages is instant:
// a GET that was answered before resolves right away with the last answer,
// while the same request runs again in the background. When that brings
// different data, an 'api:revalidated' event goes out and pages that use
// useRevalidate() reload -- which then hits the now-fresh cache.
//
// Any successful write (POST/PUT/PATCH/DELETE) empties the cache, so a page
// that reloads after its own change always gets fresh data from the server.
// In-memory only: a full page reload starts empty.

const FRESH_MS = 2000; // younger entries aren't revalidated again (no request storms)

const cache = new Map(); // key -> { data, status, headers, fetchedAt }
const inFlight = new Map(); // key -> Promise (background revalidations)
// Bumped on every clear: an answer to a request sent before a write must not
// put pre-write data back into the cache.
let generation = 0;

const keyFor = (config) => `${config.url}?${JSON.stringify(config.params || {})}`;
const isCacheable = (config) => (config.method || 'get').toLowerCase() === 'get' && !config.url?.startsWith('/auth/');

export function clearApiCache() {
  cache.clear();
  generation += 1;
}

let notifyScheduled = false;
function notifyRevalidated() {
  // Several requests of one page usually come back together -- one event for all.
  if (notifyScheduled) return;
  notifyScheduled = true;
  setTimeout(() => {
    notifyScheduled = false;
    window.dispatchEvent(new Event('api:revalidated'));
  }, 50);
}

function store(key, response) {
  const previous = cache.get(key);
  cache.set(key, { data: response.data, status: response.status, headers: response.headers, fetchedAt: Date.now() });
  return previous && JSON.stringify(previous.data) !== JSON.stringify(response.data);
}

// Installs the cache on an axios instance. `client` is used for background
// requests so they pass through its interceptors (auth header, token refresh).
export function installApiCache(client) {
  const network = axios.getAdapter(client.defaults.adapter);

  client.defaults.adapter = async (config) => {
    if (!isCacheable(config)) {
      const response = await network(config);
      if (response.status >= 200 && response.status < 300) clearApiCache();
      return response;
    }

    const key = keyFor(config);
    const hit = cache.get(key);

    if (hit && !config.skipCache) {
      if (Date.now() - hit.fetchedAt > FRESH_MS && !inFlight.has(key)) {
        const revalidation = client.request({ method: 'get', url: config.url, params: config.params, skipCache: true })
          .catch(() => {}) // offline or similar: keep showing what we have
          .finally(() => inFlight.delete(key));
        inFlight.set(key, revalidation);
      }
      return { data: hit.data, status: hit.status, statusText: 'OK (cached)', headers: hit.headers, config, request: null };
    }

    const sentInGeneration = generation;
    const response = await network(config);
    if (sentInGeneration !== generation) return response;
    if (response.status >= 200 && response.status < 300 && store(key, response) && config.skipCache) {
      notifyRevalidated();
    }
    return response;
  };
}

// Calls `reload` whenever background revalidation brought new data. The
// latest `reload` is always used, so it may close over current state.
export function useRevalidate(reload) {
  const ref = useRef(reload);
  ref.current = reload;
  useEffect(() => {
    const handler = () => ref.current();
    window.addEventListener('api:revalidated', handler);
    return () => window.removeEventListener('api:revalidated', handler);
  }, []);
}
