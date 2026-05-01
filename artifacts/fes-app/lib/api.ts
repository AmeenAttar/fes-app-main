const RAW_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "";

function getBaseUrl(): string {
  if (!RAW_DOMAIN) return "";
  if (RAW_DOMAIN.startsWith("http://") || RAW_DOMAIN.startsWith("https://")) {
    return RAW_DOMAIN.replace(/\/$/, "");
  }
  return `https://${RAW_DOMAIN}`.replace(/\/$/, "");
}

export const API_BASE_URL = getBaseUrl();

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
}

interface EventDetailResponse {
  event: CalendarEvent;
}

/** Bump when the calendar API payload shape changes (busts in-memory TanStack caches / Fast Refresh). */
export const CALENDAR_EVENTS_QUERY_VERSION = 2 as const;

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

export async function fetchEvents(): Promise<CalendarEvent[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/events`,
    calendarApiFetchInit,
  );
  if (!res.ok) {
    throw new Error(`Failed to load events (${res.status})`);
  }
  const json = (await res.json()) as EventsResponse;
  return json.events;
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
    throw new Error(`Failed to load event (${res.status})`);
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
