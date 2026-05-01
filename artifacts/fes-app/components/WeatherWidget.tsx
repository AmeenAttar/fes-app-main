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
        <Feather
          name={data.current.iconName as never}
          size={56}
          color={FES_TEAL}
          style={styles.heroIcon}
        />
        <View style={styles.heroText}>
          <Text style={styles.tempText}>{data.current.tempF}°</Text>
          <Text style={styles.conditionText}>{data.current.condition}</Text>
          <Text style={styles.hiloText}>
            H {data.today.highF}°  ·  L {data.today.lowF}°
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
          <View style={styles.upcomingRow}>
            {data.upcoming.map((day, idx) => (
              <UpcomingCell
                key={day.date}
                label={idx === 0 ? "TOMORROW" : day.weekday}
                iconName={day.iconName}
                highF={day.highF}
                lowF={day.lowF}
              />
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
  iconName: string;
  highF: number;
  lowF: number;
}

function UpcomingCell({ label, iconName, highF, lowF }: UpcomingCellProps) {
  return (
    <View style={styles.upcomingCell}>
      <Text style={styles.upcomingLabel}>{label}</Text>
      <View style={styles.upcomingValueRow}>
        <Feather name={iconName as never} size={18} color={WHITE} />
        <Text style={styles.upcomingTemp}>
          {highF}°/{lowF}°
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
        <View style={styles.skelIcon} />
        <View style={styles.heroText}>
          <View style={[styles.skelLine, { width: 80, height: 36 }]} />
          <View style={[styles.skelLine, { width: 120, height: 14, marginTop: 6 }]} />
          <View style={[styles.skelLine, { width: 100, height: 12, marginTop: 6 }]} />
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.metricsGrid}>
        <View style={[styles.skelLine, { width: "45%", height: 14 }]} />
        <View style={[styles.skelLine, { width: "45%", height: 14 }]} />
        <View style={[styles.skelLine, { width: "45%", height: 14, marginTop: 8 }]} />
        <View style={[styles.skelLine, { width: "45%", height: 14, marginTop: 8 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
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
    gap: 10,
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
    fontSize: 11,
    color: WHITE_55,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroIcon: {
    width: 56,
    textAlign: "center",
  },
  heroText: {
    flex: 1,
  },
  tempText: {
    fontFamily: "Inter_700Bold",
    fontSize: 44,
    lineHeight: 48,
    color: WHITE,
  },
  conditionText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: WHITE,
    marginTop: 2,
  },
  hiloText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: WHITE_70,
    marginTop: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: WHITE_15,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8,
    columnGap: 12,
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
    fontSize: 13,
    color: WHITE,
  },
  upcomingRow: {
    flexDirection: "row",
    gap: 12,
  },
  upcomingCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  upcomingLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: WHITE_70,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  upcomingValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: WHITE_15,
  },
});
