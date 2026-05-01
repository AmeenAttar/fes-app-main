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

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string | null;
  allDay: boolean;
  htmlLink: string | null;
}

interface EventsResponse {
  events: CalendarEvent[];
}

export async function fetchEvents(): Promise<CalendarEvent[]> {
  const res = await fetch(`${API_BASE_URL}/api/events`);
  if (!res.ok) {
    throw new Error(`Failed to load events (${res.status})`);
  }
  const json = (await res.json()) as EventsResponse;
  return json.events;
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

export async function fetchNewsPage(page: number): Promise<NewsPage> {
  const res = await fetch(
    `${API_BASE_URL}/api/news?page=${page}&perPage=${NEWS_PAGE_SIZE}`,
  );
  if (!res.ok) {
    throw new Error(`Failed to load news (${res.status})`);
  }
  return (await res.json()) as NewsPage;
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
