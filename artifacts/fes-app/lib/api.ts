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
