import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { fetchWeather, type WeatherResponse } from "@/lib/api";
import {
  FES_CENTER_WEATHER_COORDS,
  openSystemWeatherAt,
} from "@/lib/open-system-weather";

/** Menu-drawer only: frosted card on brand blue — not tied to app light/dark theme. */
const FES_TEAL = "#00b2a9";
const CARD_BG = "rgba(255,255,255,0.08)";
const TEXT = "#FFFFFF";
const TEXT_MUTED = "rgba(255,255,255,0.55)";
const TEXT_MUTED70 = "rgba(255,255,255,0.70)";
const BORDER = "rgba(255,255,255,0.15)";
const CELL_BG = "rgba(255,255,255,0.06)";
const CELL_BORDER = "rgba(255,255,255,0.14)";
const SKEL = "rgba(255,255,255,0.15)";

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
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

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
    return <WeatherError />;
  }

  return <WeatherCard data={data} />;
}

function WeatherError() {
  const onPress = () => {
    if (Platform.OS !== "web") {
      void Haptics.selectionAsync().catch(() => undefined);
    }
    void openSystemWeatherAt(
      FES_CENTER_WEATHER_COORDS.latitude,
      FES_CENTER_WEATHER_COORDS.longitude,
    ).catch(() => undefined);
  };
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open weather for Cleveland FES Center"
      accessibilityHint="Opens your device weather or maps at the FES Center location"
      style={({ pressed }) => [
        styles.card,
        styles.errorCard,
        { backgroundColor: CARD_BG, opacity: pressed ? 0.88 : 1 },
      ]}
    >
      <Feather name="cloud-off" size={18} color={TEXT_MUTED} />
      <Text style={[styles.errorText, { color: TEXT_MUTED }]}>
        Weather unavailable
      </Text>
    </Pressable>
  );
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

  const onPress = () => {
    if (Platform.OS !== "web") {
      void Haptics.selectionAsync().catch(() => undefined);
    }
    void openSystemWeatherAt(data.location.latitude, data.location.longitude).catch(
      () => undefined,
    );
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open weather for ${data.location.name}`}
      accessibilityHint="Opens your device weather or maps at this location"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: CARD_BG, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.locationText, { color: TEXT }]}>
          {data.location.name}
        </Text>
        {observedClock ? (
          <Text style={[styles.observedText, { color: TEXT_MUTED }]}>
            Updated {observedClock}
          </Text>
        ) : null}
      </View>

      <View style={styles.heroRow}>
        <View style={styles.heroLeft}>
          <Feather
            name={data.current.iconName as never}
            size={48}
            color={FES_TEAL}
          />
          <Text style={[styles.tempText, { color: TEXT }]}>
            {data.current.tempF}°
          </Text>
        </View>
        <View style={[styles.heroRight, { borderLeftColor: BORDER }]}>
          <Text style={[styles.conditionText, { color: TEXT }]}>
            {data.current.condition}
          </Text>
          <Text style={[styles.hiloText, { color: TEXT_MUTED70 }]}>
            Today · H {data.today.highF}° · L {data.today.lowF}°
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: BORDER }]} />

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
          <View style={[styles.divider, { backgroundColor: BORDER }]} />
          <Text style={[styles.upcomingSectionTitle, { color: TEXT_MUTED }]}>
            Next two days
          </Text>
          <View style={styles.upcomingRow}>
            {data.upcoming.map((day, idx) => (
              <React.Fragment key={day.date}>
                {idx > 0 ? (
                  <View
                    style={[styles.upcomingVRule, { backgroundColor: BORDER }]}
                  />
                ) : null}
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
    </Pressable>
  );
}

interface MetricProps {
  label: string;
  value: string;
}

function Metric({ label, value }: MetricProps) {
  return (
    <View style={styles.metricCell}>
      <Text style={[styles.metricLabel, { color: TEXT_MUTED }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: TEXT }]}>{value}</Text>
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
    <View
      style={[
        styles.upcomingCell,
        { backgroundColor: CELL_BG, borderColor: CELL_BORDER },
      ]}
    >
      <Text style={[styles.upcomingLabel, { color: TEXT }]}>{label}</Text>
      {subLabel ? (
        <Text style={[styles.upcomingSubLabel, { color: TEXT_MUTED }]}>
          {subLabel}
        </Text>
      ) : null}
      <View style={styles.upcomingValueRow}>
        <Feather name={iconName as never} size={20} color={FES_TEAL} />
        <Text style={[styles.upcomingTemp, { color: TEXT }]}>
          {highF}° / {lowF}°
        </Text>
      </View>
    </View>
  );
}

function WeatherSkeleton() {
  const line = [styles.skelLine, { backgroundColor: SKEL }];
  return (
    <View style={[styles.card, styles.skeletonCard, { backgroundColor: CARD_BG }]}>
      <View style={[...line, { width: "40%", height: 12 }]} />
      <View style={styles.heroRow}>
        <View style={styles.heroLeft}>
          <View style={[styles.skelIcon, { backgroundColor: SKEL }]} />
          <View style={[...line, { width: 68, height: 40 }]} />
        </View>
        <View style={[styles.heroRight, { borderLeftColor: BORDER }]}>
          <View style={[...line, { width: "100%", height: 13 }]} />
          <View
            style={[...line, { width: "85%", height: 11, marginTop: 6 }]}
          />
        </View>
      </View>
      <View style={[styles.divider, { backgroundColor: BORDER }]} />
      <View style={styles.metricsGrid}>
        <View style={[...line, { width: "45%", height: 13 }]} />
        <View style={[...line, { width: "45%", height: 13 }]} />
        <View style={[...line, { width: "45%", height: 13, marginTop: 6 }]} />
        <View style={[...line, { width: "45%", height: 13, marginTop: 6 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
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
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  observedText: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    lineHeight: 13,
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
    paddingLeft: 10,
    marginLeft: 2,
  },
  tempText: {
    fontFamily: "Inter_700Bold",
    fontSize: 38,
    lineHeight: 42,
  },
  conditionText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    lineHeight: 17,
    textAlign: "right",
    width: "100%",
  },
  hiloText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    lineHeight: 15,
    textAlign: "right",
    width: "100%",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
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
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  metricValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  upcomingSectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: -3,
  },
  upcomingRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  upcomingVRule: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginHorizontal: 3,
    minHeight: 66,
  },
  upcomingCell: {
    flex: 1,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 3,
  },
  upcomingLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  upcomingSubLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
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
  },
  skelLine: {
    borderRadius: 4,
  },
  skelIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
});
