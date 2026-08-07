import type { ResourceCategory } from "@/constants/supporting-resources";

const RAW_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "";

function getBaseUrl(): string {
  if (!RAW_DOMAIN) return "";
  if (RAW_DOMAIN.startsWith("http://") || RAW_DOMAIN.startsWith("https://")) {
    return RAW_DOMAIN.replace(/\/$/, "");
  }
  return `https://${RAW_DOMAIN}`.replace(/\/$/, "");
}

export const API_BASE_URL = getBaseUrl();

/**
 * Shared secret for the API's write endpoints. Set per build profile in
 * `eas.json`; when unset the server treats auth as not enforced, so local dev
 * and existing deployments keep working unchanged.
 */
const API_TOKEN = process.env.EXPO_PUBLIC_API_TOKEN?.trim() ?? "";

export function apiAuthHeaders(): Record<string, string> {
  return API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {};
}

export interface InvestigatorSummary {
  slug: string;
  name: string;
  photoUrl: string | null;
  detailUrl: string;
}

export interface InvestigatorDetail extends InvestigatorSummary {
  title: string | null;
  bio: string[];
  heroImageUrl: string | null;
}

interface ListResponse {
  investigators: InvestigatorSummary[];
}

interface DetailResponse {
  investigator: InvestigatorDetail;
}

export async function fetchInvestigators(): Promise<InvestigatorSummary[]> {
  const res = await fetch(`${API_BASE_URL}/api/investigators`);
  if (!res.ok) {
    throw new Error(`Failed to load investigators (${res.status})`);
  }
  const json = (await res.json()) as ListResponse;
  return json.investigators;
}

export async function fetchInvestigatorDetail(
  slug: string,
): Promise<InvestigatorDetail> {
  const res = await fetch(
    `${API_BASE_URL}/api/investigators/${encodeURIComponent(slug)}`,
  );
  if (!res.ok) {
    throw new Error(`Failed to load investigator (${res.status})`);
  }
  const json = (await res.json()) as DetailResponse;
  return json.investigator;
}

export type EventActionLinkKind =
  | "rsvp"
  | "meet"
  | "zoom"
  | "livestream"
  | "other";

export interface EventActionLink {
  url: string;
  kind: EventActionLinkKind;
}

export interface CalendarEvent {
  id: string;
  uid: string;
  title: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string | null;
  allDay: boolean;
  htmlLink: string | null;
  /** Hosted AddEvent RSVP / landing page URL; mirrors first RSVP in actionLinks when present. */
  addEventUrl: string | null;
  /** Classified http(s) links from description + location (RSVP first when present). */
  actionLinks?: EventActionLink[];
}

interface EventsResponse {
  events: CalendarEvent[];
  stale?: boolean;
  fetchedAt?: number;
}

interface EventDetailResponse {
  event: CalendarEvent;
  stale?: boolean;
  fetchedAt?: number;
}

/** Events plus whether the server served them from cache after a failed refresh. */
export interface EventsResult {
  events: CalendarEvent[];
  /** True when the calendar feed was unreachable and cached events were served. */
  stale: boolean;
  /** Epoch ms the data was fetched from the calendar, when known. */
  fetchedAt: number | null;
}

/** Bump when the calendar API payload shape changes (busts in-memory TanStack caches / Fast Refresh). */
export const CALENDAR_EVENTS_QUERY_VERSION = 3 as const;

export const calendarEventsListQueryKey = [
  "events",
  CALENDAR_EVENTS_QUERY_VERSION,
] as const;

export function calendarEventDetailQueryKey(eventId: string) {
  return ["event", CALENDAR_EVENTS_QUERY_VERSION, eventId] as const;
}

const calendarApiFetchInit: RequestInit = {
  cache: "no-store",
  headers: {
    "Cache-Control": "no-cache, no-store",
    Pragma: "no-cache",
  },
};

/** Prefer the server's human-readable message (e.g. calendar rate-limited) over a bare status. */
async function calendarErrorMessage(
  res: globalThis.Response,
  fallback: string,
): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown; error?: unknown };
    const msg =
      (typeof body.message === "string" && body.message) ||
      (typeof body.error === "string" && body.error);
    if (msg) return msg;
  } catch {
    /* non-JSON error body */
  }
  return fallback;
}

export async function fetchEvents(): Promise<EventsResult> {
  const res = await fetch(
    `${API_BASE_URL}/api/events`,
    calendarApiFetchInit,
  );
  if (!res.ok) {
    throw new Error(
      await calendarErrorMessage(res, `Failed to load events (${res.status})`),
    );
  }
  const json = (await res.json()) as EventsResponse;
  return {
    events: json.events,
    stale: json.stale === true,
    fetchedAt: typeof json.fetchedAt === "number" ? json.fetchedAt : null,
  };
}

export async function fetchEventById(eventId: string): Promise<CalendarEvent> {
  const res = await fetch(
    `${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}`,
    calendarApiFetchInit,
  );
  if (res.status === 404) {
    throw new Error("Event not found");
  }
  if (!res.ok) {
    throw new Error(
      await calendarErrorMessage(res, `Failed to load event (${res.status})`),
    );
  }
  const json = (await res.json()) as EventDetailResponse;
  return json.event;
}

export interface NewsItem {
  id: number;
  title: string;
  excerpt: string;
  link: string;
  date: string;
  featuredImageUrl: string | null;
  categories: string[];
}

export interface NewsPage {
  items: NewsItem[];
  page: number;
  totalPages: number;
  total: number;
}

export const NEWS_PAGE_SIZE = 10;

/** Invalidate TanStack cache when `/api/news` contract or paging behavior changes. */
export const NEWS_FEED_QUERY_VERSION = 2 as const;

export const newsInfiniteQueryKey = [
  "news",
  "list",
  NEWS_FEED_QUERY_VERSION,
] as const;

export interface NewsArticle {
  id: number;
  title: string;
  excerpt: string;
  contentHtml: string;
  date: string;
  canonicalLink: string;
  featuredImageUrl: string | null;
  categories: string[];
}

export function newsArticleDetailQueryKey(postId: string | number) {
  return ["news", "article", NEWS_FEED_QUERY_VERSION, String(postId)] as const;
}

const newsApiFetchInit: RequestInit = {
  cache: "no-store",
  headers: {
    "Cache-Control": "no-cache, no-store",
    Pragma: "no-cache",
  },
};

export async function fetchNewsPage(page: number): Promise<NewsPage> {
  const qs = new URLSearchParams({
    page: String(page),
    perPage: String(NEWS_PAGE_SIZE),
  });
  const res = await fetch(
    `${API_BASE_URL}/api/news?${qs.toString()}`,
    newsApiFetchInit,
  );
  if (!res.ok) {
    let detail = `Failed to load news (${res.status})`;
    try {
      const body = (await res.json()) as {
        message?: unknown;
        error?: unknown;
      };
      const msg =
        (typeof body.message === "string" && body.message) ||
        (typeof body.error === "string" && body.error);
      if (msg) detail = msg;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return (await res.json()) as NewsPage;
}

interface NewsArticleDetailResponse {
  article: NewsArticle;
}

export async function fetchNewsArticle(postId: string | number): Promise<NewsArticle> {
  const res = await fetch(
    `${API_BASE_URL}/api/news/${encodeURIComponent(String(postId))}`,
    newsApiFetchInit,
  );
  if (res.status === 404) {
    throw new Error("Article not found");
  }
  if (!res.ok) {
    let detail = `Failed to load article (${res.status})`;
    try {
      const body = (await res.json()) as {
        message?: unknown;
        error?: unknown;
      };
      const msg =
        (typeof body.message === "string" && body.message) ||
        (typeof body.error === "string" && body.error);
      if (msg) detail = msg;
    } catch {
      /* non-JSON */
    }
    throw new Error(detail);
  }
  const json = (await res.json()) as NewsArticleDetailResponse;
  return json.article;
}

export interface WeatherUpcomingDay {
  date: string;
  weekday: string;
  highF: number;
  lowF: number;
  condition: string;
  iconName: string;
}

export interface WeatherResponse {
  location: { name: string; latitude: number; longitude: number };
  current: {
    tempF: number;
    feelsLikeF: number;
    humidity: number;
    windMph: number;
    windDirection: number;
    isDay: boolean;
    condition: string;
    iconName: string;
    observedAt: string;
  };
  today: { highF: number; lowF: number; sunrise: string; sunset: string };
  upcoming: WeatherUpcomingDay[];
}

export async function fetchWeather(): Promise<WeatherResponse> {
  const res = await fetch(`${API_BASE_URL}/api/weather`);
  if (!res.ok) {
    throw new Error(`Failed to load weather (${res.status})`);
  }
  return (await res.json()) as WeatherResponse;
}

/** Bump when `/api/supporting-resources` payload shape changes. */
export const SUPPORTING_RESOURCES_QUERY_VERSION = 2 as const;

export const supportingResourcesQueryKey = [
  "supporting-resources",
  SUPPORTING_RESOURCES_QUERY_VERSION,
] as const;

const sheetsFetchInit: RequestInit = {
  cache: "no-store",
  headers: {
    "Cache-Control": "no-cache, no-store",
    Pragma: "no-cache",
  },
};

export async function fetchSupportingResources(): Promise<ResourceCategory[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/supporting-resources`,
    sheetsFetchInit,
  );
  if (!res.ok) {
    let detail = `Failed to load supporting resources (${res.status})`;
    try {
      const body = (await res.json()) as { message?: unknown };
      if (typeof body.message === "string" && body.message) detail = body.message;
    } catch {
      /* non-JSON */
    }
    throw new Error(detail);
  }
  const json = (await res.json()) as { categories?: ResourceCategory[] };
  return Array.isArray(json.categories) ? json.categories : [];
}

/** Bump when `/api/equipment` payload shape changes. */
export const EQUIPMENT_QUERY_VERSION = 1 as const;

export const equipmentListQueryKey = [
  "equipment",
  "list",
  EQUIPMENT_QUERY_VERSION,
] as const;

export function equipmentDetailQueryKey(slug: string) {
  return ["equipment", "detail", EQUIPMENT_QUERY_VERSION, slug] as const;
}

export interface EquipmentParameter {
  label: string;
  value: string;
}

export interface EquipmentSummary {
  slug: string;
  name: string;
  imageUrl: string | null;
}

export interface EquipmentDetail extends EquipmentSummary {
  detailUrl: string;
  /** Whatever fields the source page has — not a fixed schema. */
  parameters: EquipmentParameter[];
}

async function equipmentErrorMessage(
  res: globalThis.Response,
  fallback: string,
): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown };
    if (typeof body.message === "string" && body.message) return body.message;
  } catch {
    /* non-JSON error body */
  }
  return fallback;
}

export async function fetchEquipmentList(): Promise<EquipmentSummary[]> {
  const res = await fetch(`${API_BASE_URL}/api/equipment`, sheetsFetchInit);
  if (!res.ok) {
    throw new Error(
      await equipmentErrorMessage(res, `Failed to load equipment (${res.status})`),
    );
  }
  const json = (await res.json()) as { items?: EquipmentSummary[] };
  return Array.isArray(json.items) ? json.items : [];
}

export async function fetchEquipmentDetail(
  slug: string,
): Promise<EquipmentDetail> {
  const res = await fetch(
    `${API_BASE_URL}/api/equipment/${encodeURIComponent(slug)}`,
    sheetsFetchInit,
  );
  if (res.status === 404) {
    throw new Error("Equipment not found");
  }
  if (!res.ok) {
    throw new Error(
      await equipmentErrorMessage(res, `Failed to load equipment (${res.status})`),
    );
  }
  const json = (await res.json()) as { equipment: EquipmentDetail };
  return json.equipment;
}
