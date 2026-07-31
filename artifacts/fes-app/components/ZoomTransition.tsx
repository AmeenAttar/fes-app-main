import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  type StyleProp,
  View,
  type ViewStyle,
} from "react-native";

/** Rect in window coordinates (from `measureInWindow`). */
export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Shared timings so every zoom-open in the app feels like one system. */
export const ZOOM_OPEN_MS = 300;
export const ZOOM_CLOSE_MS = 220;
/** Ease-out — fast departure, gentle settle, like a macOS window unfolding. */
export const ZOOM_OPEN_EASING = Easing.bezier(0.2, 0, 0, 1);
export const ZOOM_CLOSE_EASING = Easing.bezier(0.4, 0, 1, 1);
/**
 * Matches the 12–14pt radius of the header buttons. At full-screen size this is
 * smaller than the device's own display corner radius, so it stays invisible.
 */
export const ZOOM_RADIUS = 16;

/**
 * A stashed anchor is only meant for the screen opening right now. If that
 * navigation never lands, this window keeps it from animating something later.
 */
const ANCHOR_TTL_MS = 800;

/**
 * Maps `frame` (a view's natural layout rect) onto `anchor` at progress 0, and
 * back to its own position at 1 — so the view appears to unfold from the anchor.
 *
 * Scaling is about the view's centre, so the translate (listed first) moves that
 * centre onto the anchor's centre before the scale shrinks it to size.
 */
export function zoomTransform(
  progress: Animated.Value,
  anchor: AnchorRect,
  frame: AnchorRect,
) {
  const io = { inputRange: [0, 1] };
  return [
    {
      translateX: progress.interpolate({
        ...io,
        outputRange: [
          anchor.x + anchor.width / 2 - (frame.x + frame.width / 2),
          0,
        ],
      }),
    },
    {
      translateY: progress.interpolate({
        ...io,
        outputRange: [
          anchor.y + anchor.height / 2 - (frame.y + frame.height / 2),
          0,
        ],
      }),
    },
    {
      scaleX: progress.interpolate({
        ...io,
        outputRange: [frame.width > 0 ? anchor.width / frame.width : 0, 1],
      }),
    },
    {
      scaleY: progress.interpolate({
        ...io,
        outputRange: [frame.height > 0 ? anchor.height / frame.height : 0, 1],
      }),
    },
  ];
}

/** Measures a native view and returns its window rect (null if not laid out). */
export function measureAnchor(
  ref: React.RefObject<View | null>,
): Promise<AnchorRect | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node) return resolve(null);
    node.measureInWindow((x, y, width, height) => {
      if (
        [x, y, width, height].some(
          (n) => typeof n !== "number" || Number.isNaN(n),
        ) ||
        width <= 0 ||
        height <= 0
      ) {
        return resolve(null);
      }
      resolve({ x, y, width, height });
    });
  });
}

interface ZoomTransitionValue {
  /**
   * Navigates immediately, leaving `anchor` for the destination's
   * {@link ZoomInView} to unfold from. Navigating first is deliberate: the
   * destination mounts and renders *during* the animation rather than after it,
   * so its content is on screen the whole time instead of arriving late.
   */
  zoomFrom: (anchor: AnchorRect | null, navigate: () => void) => void;
  /** Takes the pending anchor, if one was stashed recently. One-shot. */
  consumePendingAnchor: () => AnchorRect | null;
}

const ZoomTransitionContext = createContext<ZoomTransitionValue | null>(null);

const NO_ZOOM: ZoomTransitionValue = {
  zoomFrom: (_anchor, navigate) => navigate(),
  consumePendingAnchor: () => null,
};

export function useZoomTransition(): ZoomTransitionValue {
  // Falling back keeps the app usable if a caller renders outside the provider.
  return useContext(ZoomTransitionContext) ?? NO_ZOOM;
}

export function ZoomTransitionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pending = useRef<{ anchor: AnchorRect; at: number } | null>(null);

  const zoomFrom = useCallback<ZoomTransitionValue["zoomFrom"]>(
    (anchor, navigate) => {
      pending.current = anchor ? { anchor, at: Date.now() } : null;
      navigate();
    },
    [],
  );

  const consumePendingAnchor = useCallback(() => {
    const held = pending.current;
    pending.current = null;
    if (!held || Date.now() - held.at > ANCHOR_TTL_MS) return null;
    return held.anchor;
  }, []);

  const value = useMemo(
    () => ({ zoomFrom, consumePendingAnchor }),
    [zoomFrom, consumePendingAnchor],
  );

  return (
    <ZoomTransitionContext.Provider value={value}>
      {children}
    </ZoomTransitionContext.Provider>
  );
}

export interface ZoomInHandle {
  /**
   * Collapses back into the origin anchor, then runs `after` (typically the
   * actual navigation). Runs `after` straight away when there is nothing to
   * collapse into, so callers can use this unconditionally.
   */
  collapse: (after?: () => void) => void;
}

/**
 * Wraps a screen so it unfolds from whichever control opened it. Renders
 * normally (no animation) when the screen was reached some other way — e.g.
 * from the nav drawer or a deep link.
 *
 * Pair the ref's {@link ZoomInHandle.collapse} with the screen's back action to
 * reverse the animation on the way out.
 */
export const ZoomInView = forwardRef<
  ZoomInHandle,
  { children: React.ReactNode; style?: StyleProp<ViewStyle> }
>(function ZoomInView({ children, style }, ref) {
  const { consumePendingAnchor } = useZoomTransition();
  // Consumed once, at mount, so re-renders never restart the animation.
  const [anchor] = useState(consumePendingAnchor);
  const progress = useRef(new Animated.Value(anchor ? 0 : 1)).current;
  const [frame, setFrame] = useState<AnchorRect | null>(null);
  const selfRef = useRef<View>(null);
  const started = useRef(false);

  const onLayout = useCallback(() => {
    if (!anchor || started.current) return;
    started.current = true;
    // Measured while the transform is still identity, so this is the natural rect.
    measureAnchor(selfRef).then((rect) => {
      if (!rect) {
        progress.setValue(1);
        return;
      }
      setFrame(rect);
      Animated.timing(progress, {
        toValue: 1,
        duration: ZOOM_OPEN_MS,
        easing: ZOOM_OPEN_EASING,
        useNativeDriver: true,
      }).start();
    });
  }, [anchor, progress]);

  useImperativeHandle(
    ref,
    () => ({
      collapse: (after) => {
        // Nothing to collapse into (opened without an anchor, or never measured).
        if (!anchor || !frame) {
          after?.();
          return;
        }
        Animated.timing(progress, {
          toValue: 0,
          duration: ZOOM_CLOSE_MS,
          easing: ZOOM_CLOSE_EASING,
          useNativeDriver: true,
        }).start(() => after?.());
      },
    }),
    [anchor, frame, progress],
  );

  const animating = Boolean(anchor);
  const ready = !animating || frame !== null;

  return (
    <Animated.View
      ref={selfRef}
      onLayout={onLayout}
      collapsable={false}
      style={[
        { flex: 1 },
        animating
          ? {
              borderRadius: ZOOM_RADIUS,
              overflow: "hidden",
              // Hidden only for the one frame before we know our own rect; after
              // that it is near-opaque so the content reads immediately.
              opacity: ready
                ? progress.interpolate({
                    inputRange: [0, 0.18, 1],
                    outputRange: [0.3, 1, 1],
                  })
                : 0,
              transform: frame ? zoomTransform(progress, anchor!, frame) : [],
            }
          : null,
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
});
