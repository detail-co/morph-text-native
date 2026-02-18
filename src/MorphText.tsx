import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, type LayoutChangeEvent, type TextStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import type { MorphTextProps, CharLayout, EasingProp } from "./types";

const DEFAULT_DURATION = 400;
const DEFAULT_EASE = Easing.bezier(0.19, 1, 0.22, 1);

const containerBaseStyle = {
  position: "relative" as const,
  flexDirection: "row" as const,
  overflow: "hidden" as const,
};
const rowStyle = { flexDirection: "row" as const };

function segment(text: string): string[] {
  return Array.from(text).map((ch) => (ch === " " ? "\u00A0" : ch));
}

interface Entry {
  char: string;
  key: string;
  status: "persisting" | "entering" | "exiting";
  prevLayout?: CharLayout;
  anchorPrevLayout?: CharLayout;
  anchorKey?: string;
}
function computeLCS(a: string[], b: string[]): [number, number][] {
  const m = a.length,
    n = b.length;
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) dp[i] = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + (a[i - 1] === "\u00A0" ? 2 : 1);
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  const result: [number, number][] = [];
  let i = m,
    j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return result.reverse();
}

function diffEntries(
  oldEntries: Entry[],
  newChars: string[],
  prevLayouts: Map<string, CharLayout>,
  nextKey: () => string
): { visible: Entry[]; exiting: Entry[] } {
  const activeOld = oldEntries.filter((e) => e.status !== "exiting");

  const oldChars = activeOld.map((e) => e.char);
  const matches = computeLCS(oldChars, newChars);

  const matchedOld = new Set(matches.map((m) => m[0]));
  const matchedNew = new Set(matches.map((m) => m[1]));
  const newToOld = new Map(matches.map((m) => [m[1], m[0]]));

  const exiting: Entry[] = [];
  for (let i = 0; i < activeOld.length; i++) {
    if (matchedOld.has(i)) continue;
    let anchorKey: string | undefined;
    let anchorPrevLayout: CharLayout | undefined;
    for (let j = i + 1; j < activeOld.length; j++) {
      if (matchedOld.has(j)) {
        anchorKey = activeOld[j].key;
        anchorPrevLayout = prevLayouts.get(activeOld[j].key);
        break;
      }
    }
    if (!anchorKey) {
      for (let j = i - 1; j >= 0; j--) {
        if (matchedOld.has(j)) {
          anchorKey = activeOld[j].key;
          anchorPrevLayout = prevLayouts.get(activeOld[j].key);
          break;
        }
      }
    }
    exiting.push({
      ...activeOld[i],
      status: "exiting",
      prevLayout: prevLayouts.get(activeOld[i].key),
      anchorKey,
      anchorPrevLayout,
    });
  }

  const visible: Entry[] = [];
  for (let ni = 0; ni < newChars.length; ni++) {
    if (matchedNew.has(ni)) {
      const oi = newToOld.get(ni)!;
      visible.push({
        ...activeOld[oi],
        char: newChars[ni],
        status: "persisting",
        prevLayout: prevLayouts.get(activeOld[oi].key),
      });
    } else {
      let anchorPrevLayout: CharLayout | undefined;
      for (let j = ni - 1; j >= 0; j--) {
        if (matchedNew.has(j)) {
          const oi = newToOld.get(j)!;
          anchorPrevLayout = prevLayouts.get(activeOld[oi].key);
          break;
        }
      }
      if (!anchorPrevLayout) {
        for (let j = ni + 1; j < newChars.length; j++) {
          if (matchedNew.has(j)) {
            const oi = newToOld.get(j)!;
            anchorPrevLayout = prevLayouts.get(activeOld[oi].key);
            break;
          }
        }
      }
      visible.push({
        char: newChars[ni],
        key: nextKey(),
        status: "entering",
        anchorPrevLayout,
      });
    }
  }

  return { visible, exiting };
}

const PersistingChar = React.memo(
  function PersistingChar({
    entry,
    duration,
    ease,
    textStyle,
    onLayout,
  }: {
    entry: Entry;
    duration: number;
    ease: EasingProp;
    textStyle?: TextStyle;
    onLayout: (e: LayoutChangeEvent) => void;
  }) {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const animatedForRef = useRef<CharLayout | undefined>(undefined);

    const handleLayout = useCallback(
      (e: LayoutChangeEvent) => {
        onLayout(e);
        if (!entry.prevLayout || animatedForRef.current === entry.prevLayout)
          return;
        animatedForRef.current = entry.prevLayout;

        const { x, y } = e.nativeEvent.layout;
        const dx = entry.prevLayout.x - x;
        const dy = entry.prevLayout.y - y;
        if (dx !== 0 || dy !== 0) {
          translateX.value = dx;
          translateY.value = dy;
          translateX.value = withTiming(0, { duration, easing: ease });
          translateY.value = withTiming(0, { duration, easing: ease });
        }
      },
      [entry.prevLayout, duration, ease, onLayout]
    );

    const animStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    }));

    return (
      <Animated.View onLayout={handleLayout} style={animStyle}>
        <Animated.Text style={textStyle}>{entry.char}</Animated.Text>
      </Animated.View>
    );
  },
  (prev, next) =>
    prev.entry.key === next.entry.key &&
    prev.entry.prevLayout === next.entry.prevLayout &&
    prev.duration === next.duration &&
    prev.ease === next.ease &&
    prev.textStyle === next.textStyle
);

const EnteringChar = React.memo(function EnteringChar({
  entry,
  duration,
  ease,
  scaleEnabled,
  textStyle,
  onLayout,
}: {
  entry: Entry;
  duration: number;
  ease: EasingProp;
  scaleEnabled: boolean;
  textStyle?: TextStyle;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scaleVal = useSharedValue(scaleEnabled ? 0.95 : 1);
  const didAnimate = useRef(false);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      onLayout(e);
      if (didAnimate.current) return;
      didAnimate.current = true;

      const { x, y } = e.nativeEvent.layout;
      const timingConfig = { duration, easing: ease };

      if (entry.anchorPrevLayout) {
        translateX.value = entry.anchorPrevLayout.x - x;
        translateY.value = entry.anchorPrevLayout.y - y;
      }

      translateX.value = withTiming(0, timingConfig);
      translateY.value = withTiming(0, timingConfig);
      if (scaleEnabled) {
        scaleVal.value = withTiming(1, timingConfig);
      }
      opacity.value = withDelay(
        duration * 0.25,
        withTiming(1, { duration: duration * 0.25, easing: Easing.linear })
      );
    },
    [entry.anchorPrevLayout, duration, ease, scaleEnabled, onLayout]
  );

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scaleVal.value },
    ],
  }));

  return (
    <Animated.View onLayout={handleLayout} style={animStyle}>
      <Animated.Text style={textStyle}>{entry.char}</Animated.Text>
    </Animated.View>
  );
});

const ExitingChar = React.memo(function ExitingChar({
  entry,
  duration,
  ease,
  scaleEnabled,
  textStyle,
  onExitComplete,
  layoutsRef,
}: {
  entry: Entry;
  duration: number;
  ease: EasingProp;
  scaleEnabled: boolean;
  textStyle?: TextStyle;
  onExitComplete: () => void;
  layoutsRef: React.RefObject<Map<string, CharLayout>>;
}) {
  const opacity = useSharedValue(1);
  const scaleVal = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    const timingConfig = { duration, easing: ease };

    const frameId = requestAnimationFrame(() => {
      if (entry.anchorKey && entry.anchorPrevLayout) {
        const anchorNewLayout = layoutsRef.current.get(entry.anchorKey);
        if (anchorNewLayout) {
          const dx = anchorNewLayout.x - entry.anchorPrevLayout.x;
          const dy = anchorNewLayout.y - entry.anchorPrevLayout.y;
          if (dx !== 0 || dy !== 0) {
            translateX.value = withTiming(dx, timingConfig);
            translateY.value = withTiming(dy, timingConfig);
          }
        }
      }

      if (scaleEnabled) {
        scaleVal.value = withTiming(0.95, timingConfig);
      }
      opacity.value = withTiming(
        0,
        { duration: duration * 0.25, easing: Easing.linear },
        (finished) => {
          if (finished) runOnJS(onExitComplete)();
        }
      );
    });

    return () => cancelAnimationFrame(frameId);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scaleVal.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: entry.prevLayout?.x ?? 0,
          top: entry.prevLayout?.y ?? 0,
        },
        animStyle,
      ]}
    >
      <Animated.Text style={textStyle}>{entry.char}</Animated.Text>
    </Animated.View>
  );
});

export function MorphText({
  children,
  style,
  containerStyle,
  duration = DEFAULT_DURATION,
  ease = DEFAULT_EASE,
  scale: scaleEnabled = true,
  onAnimationStart,
  onAnimationComplete,
}: MorphTextProps) {
  const text = typeof children === "string" ? children : "";
  const prevTextRef = useRef(text);
  const isFirstRender = useRef(true);

  const keySeqRef = useRef(0);
  const nextKey = useCallback(() => `mc_${keySeqRef.current++}`, []);

  const onStartRef = useRef(onAnimationStart);
  onStartRef.current = onAnimationStart;
  const onCompleteRef = useRef(onAnimationComplete);
  onCompleteRef.current = onAnimationComplete;

  const layoutsRef = useRef<Map<string, CharLayout>>(new Map());
  const layoutHandlersRef = useRef<
    Map<string, (e: LayoutChangeEvent) => void>
  >(new Map());
  const getOnLayout = useCallback((key: string) => {
    let handler = layoutHandlersRef.current.get(key);
    if (!handler) {
      handler = (e: LayoutChangeEvent) => {
        const { x, y, width, height } = e.nativeEvent.layout;
        layoutsRef.current.set(key, { x, y, width, height });
      };
      layoutHandlersRef.current.set(key, handler);
    }
    return handler;
  }, []);

  const entriesRef = useRef<Entry[]>([]);
  const [visibleEntries, setVisibleEntries] = useState<Entry[]>(() => {
    const chars = segment(text);
    const initial = chars.map((char) => ({
      char,
      key: nextKey(),
      status: "persisting" as const,
    }));
    entriesRef.current = initial;
    return initial;
  });

  const [exitingEntries, setExitingEntries] = useState<Entry[]>([]);
  const exitCountRef = useRef(0);
  const totalExitingRef = useRef(0);
  const exitingKeysRef = useRef<string[]>([]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (text === prevTextRef.current) return;

    const newChars = segment(text);
    const prevLayouts = new Map(layoutsRef.current);
    const { visible, exiting } = diffEntries(
      entriesRef.current,
      newChars,
      prevLayouts,
      nextKey
    );

    prevTextRef.current = text;
    exitCountRef.current = 0;
    totalExitingRef.current = exiting.length;
    exitingKeysRef.current = exiting.map((e) => e.key);

    entriesRef.current = visible;
    setVisibleEntries(visible);
    setExitingEntries(exiting);
    onStartRef.current?.();

    const timer = setTimeout(() => onCompleteRef.current?.(), duration);
    return () => clearTimeout(timer);
  }, [text, duration, nextKey]);

  const handleExitComplete = useCallback(() => {
    exitCountRef.current++;
    if (exitCountRef.current >= totalExitingRef.current) {
      for (const key of exitingKeysRef.current) {
        layoutsRef.current.delete(key);
        layoutHandlersRef.current.delete(key);
      }
      setExitingEntries([]);
    }
  }, []);

  return (
    <View style={[containerBaseStyle, containerStyle]}>
      <View style={rowStyle}>
        {visibleEntries.map((entry) => {
          if (entry.status === "entering") {
            return (
              <EnteringChar
                key={entry.key}
                entry={entry}
                duration={duration}
                ease={ease}
                scaleEnabled={scaleEnabled}
                textStyle={style}
                onLayout={getOnLayout(entry.key)}
              />
            );
          }
          return (
            <PersistingChar
              key={entry.key}
              entry={entry}
              duration={duration}
              ease={ease}
              textStyle={style}
              onLayout={getOnLayout(entry.key)}
            />
          );
        })}
      </View>
      {exitingEntries.map((entry) => (
        <ExitingChar
          key={entry.key}
          entry={entry}
          duration={duration}
          ease={ease}
          scaleEnabled={scaleEnabled}
          textStyle={style}
          onExitComplete={handleExitComplete}
          layoutsRef={layoutsRef}
        />
      ))}
    </View>
  );
}
