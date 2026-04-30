import AsyncStorage from "@react-native-async-storage/async-storage";

export type RsvpStatus = "going" | "interested" | "not-going" | null;

const KEY = "fes-rsvp-v1";

type Store = Record<string, RsvpStatus>;

let memCache: Store | null = null;

async function read(): Promise<Store> {
  if (memCache) return memCache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    memCache = raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    memCache = {};
  }
  return memCache;
}

async function write(store: Store) {
  memCache = store;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* noop */
  }
}

export async function loadAllRsvps(): Promise<Store> {
  return await read();
}

export async function setRsvp(eventId: string, status: RsvpStatus) {
  const store = await read();
  if (status === null) {
    delete store[eventId];
  } else {
    store[eventId] = status;
  }
  await write(store);
}
