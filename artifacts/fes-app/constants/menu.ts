import type { ComponentProps } from "react";
import type { Feather } from "@expo/vector-icons";

export type IconName = ComponentProps<typeof Feather>["name"];

export type MenuKind = "internal" | "external";

export interface MenuBlock {
  id: string;
  label: string;
  icon: IconName;
  kind: MenuKind;
  /** internal route (when kind === "internal") */
  route?: string;
  /** external URL (when kind === "external") */
  url?: string;
}

/**
 * Order is intentional — top to bottom, left to right in a 2-column grid.
 */
export const MENU_BLOCKS: MenuBlock[] = [
  {
    id: "news",
    label: "News",
    icon: "rss",
    kind: "external",
    url: "https://fescenter.org/blog/",
  },
  {
    id: "events",
    label: "Events",
    icon: "calendar",
    kind: "internal",
    route: "/events",
  },
  {
    id: "investigators",
    label: "Investigators",
    icon: "users",
    kind: "internal",
    route: "/investigators",
  },
  {
    id: "supporting-resources",
    label: "Supporting Resources",
    icon: "life-buoy",
    kind: "internal",
    route: "/supporting-resources",
  },
  {
    id: "equipment-inventory",
    label: "Equipment Inventory",
    icon: "package",
    kind: "internal",
    route: "/equipment-inventory",
  },
  {
    id: "tuesdays",
    label: "Sign Up for Tuesdays!",
    icon: "edit-3",
    kind: "internal",
    route: "/tuesdays",
  },
];
