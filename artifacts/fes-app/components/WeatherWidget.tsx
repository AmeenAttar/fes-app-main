import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { fetchWeather, type WeatherResponse } from "@/lib/api";

const FES_TEAL = "#00b2a9";
const WHITE = "#FFFFFF";
const WHITE_70 = "rgba(255,255,255,0.70)";
const WHITE_55 = "rgba(255,255,255,0.55)";
const WHITE_15 = "rgba(255,255,255,0.15)";
const CARD_BG = "rgba(255,255,255,0.08)";

const CARDINALS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

function degreesToCardinal(deg: number): string {
  const idx = Math.round(((deg % 360) + 360) / 22.5) % 16;
  return CARDINALS[idx] ?? "";
}

function formatClock(iso: string): string {
  if (!iso) return "";
  // Open-Meteo returns ISO without timezone (interpreted as local server tz);
  // for display we just want H:MM AM/PM.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Calendar date-only string YYYY-MM-DD → short label e.g. "May 3". */
function shortCalendarDate(dateOnly: string): string {
  const d = new Date(`${dateOnly}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function WeatherWidget() {
  const { data, isLoading, isError } = useQuery<WeatherResponse, Error>({
    queryKey: ["weather"],
    queryFn: fetchWeather,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return <WeatherSkeleton />;
  }

  if (isError || !data) {
    return (
      <View style={[styles.card, styles.errorCard]}>
        <Feather name="cloud-off" size={18} color={WHITE_55} />
        <Text style={styles.errorText}>Weather unavailable</Text>
      </View>
    );
  }

  return <WeatherCard data={data} />;
}

interface WeatherCardProps {
  data: WeatherResponse;
}

function WeatherCard({ data }: WeatherCardProps) {
  const cardinal = useMemo(
    () => degreesToCardinal(data.current.windDirection),
    [data.current.windDirection],
  );
  const observedClock = useMemo(
    () => formatClock(data.current.observedAt),
    [data.current.observedAt],
  );
  const sunsetClock = useMemo(
    () => formatClock(data.today.sunset),
    [data.today.sunset],
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.locationText}>{data.location.name}</Text>
        {observedClock ? (
          <Text style={styles.observedText}>Updated {observedClock}</Text>
        ) : null}
      </View>

      <View style={styles.heroRow}>
        <View style={styles.heroLeft}>
          <Feather
            name={data.current.iconName as never}
            size={48}
            color={FES_TEAL}
          />
          <Text style={styles.tempText}>{data.current.tempF}°</Text>
        </View>
        <View style={styles.heroRight}>
          <Text style={styles.conditionText}>{data.current.condition}</Text>
          <Text style={styles.hiloText}>
            Today · H {data.today.highF}° · L {data.today.lowF}°
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.metricsGrid}>
        <Metric label="Feels Like" value={`${data.current.feelsLikeF}°`} />
        <Metric
          label="Wind"
          value={`${data.current.windMph} mph${cardinal ? ` ${cardinal}` : ""}`}
        />
        <Metric label="Humidity" value={`${data.current.humidity}%`} />
        <Metric label="Sunset" value={sunsetClock || "—"} />
      </View>

      {data.upcoming.length > 0 ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.upcomingSectionTitle}>Next two days</Text>
          <View style={styles.upcomingRow}>
            {data.upcoming.map((day, idx) => (
              <React.Fragment key={day.date}>
                {idx > 0 ? <View style={styles.upcomingVRule} /> : null}
                <UpcomingCell
                  label={idx === 0 ? "Tomorrow" : day.weekday}
                  subLabel={shortCalendarDate(day.date)}
                  iconName={day.iconName}
                  highF={day.highF}
                  lowF={day.lowF}
                />
              </React.Fragment>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

interface MetricProps {
  label: string;
  value: string;
}

function Metric({ label, value }: MetricProps) {
  return (
    <View style={styles.metricCell}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

interface UpcomingCellProps {
  label: string;
  subLabel: string;
  iconName: string;
  highF: number;
  lowF: number;
}

function UpcomingCell({
  label,
  subLabel,
  iconName,
  highF,
  lowF,
}: UpcomingCellProps) {
  return (
    <View style={styles.upcomingCell}>
      <Text style={styles.upcomingLabel}>{label}</Text>
      {subLabel ? (
        <Text style={styles.upcomingSubLabel}>{subLabel}</Text>
      ) : null}
      <View style={styles.upcomingValueRow}>
        <Feather name={iconName as never} size={20} color={FES_TEAL} />
        <Text style={styles.upcomingTemp}>
          {highF}° / {lowF}°
        </Text>
      </View>
    </View>
  );
}

function WeatherSkeleton() {
  return (
    <View style={[styles.card, styles.skeletonCard]}>
      <View style={[styles.skelLine, { width: "40%", height: 12 }]} />
      <View style={styles.heroRow}>
        <View style={styles.heroLeft}>
          <View style={styles.skelIcon} />
          <View style={[styles.skelLine, { width: 68, height: 40 }]} />
        </View>
        <View style={styles.heroRight}>
          <View style={[styles.skelLine, { width: "100%", height: 13 }]} />
          <View style={[styles.skelLine, { width: "85%", height: 11, marginTop: 6 }]} />
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.metricsGrid}>
        <View style={[styles.skelLine, { width: "45%", height: 13 }]} />
        <View style={[styles.skelLine, { width: "45%", height: 13 }]} />
        <View style={[styles.skelLine, { width: "45%", height: 13, marginTop: 6 }]} />
        <View style={[styles.skelLine, { width: "45%", height: 13, marginTop: 6 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 18,
  },
  errorText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: WHITE_55,
  },
  skeletonCard: {
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  locationText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: WHITE,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  observedText: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    lineHeight: 13,
    color: WHITE_55,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 10,
  },
  heroLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  heroRight: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: 2,
    gap: 4,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: WHITE_15,
    paddingLeft: 10,
    marginLeft: 2,
  },
  tempText: {
    fontFamily: "Inter_700Bold",
    fontSize: 38,
    lineHeight: 42,
    color: WHITE,
  },
  conditionText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    lineHeight: 17,
    color: WHITE,
    textAlign: "right",
    width: "100%",
  },
  hiloText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    lineHeight: 15,
    color: WHITE_70,
    textAlign: "right",
    width: "100%",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: WHITE_15,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 6,
    columnGap: 10,
  },
  metricCell: {
    width: "47%",
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  metricLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: WHITE_55,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  metricValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: WHITE,
  },
  upcomingSectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: WHITE_55,
    marginBottom: -3,
  },
  upcomingRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  upcomingVRule: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: WHITE_15,
    marginHorizontal: 3,
    minHeight: 66,
  },
  upcomingCell: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 3,
  },
  upcomingLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: WHITE,
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  upcomingSubLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: WHITE_55,
    marginTop: -1,
    marginBottom: 1,
  },
  upcomingValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 1,
  },
  upcomingTemp: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: WHITE,
  },
  skelLine: {
    backgroundColor: WHITE_15,
    borderRadius: 4,
  },
  skelIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: WHITE_15,
  },
});
