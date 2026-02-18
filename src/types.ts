import type { TextStyle, ViewStyle } from "react-native";
import type {
  EasingFunction,
  EasingFunctionFactory,
} from "react-native-reanimated";

export type EasingProp = EasingFunction | EasingFunctionFactory;

export interface MorphTextProps {
  children: string;
  style?: TextStyle;
  containerStyle?: ViewStyle;
  duration?: number;
  ease?: EasingProp;
  scale?: boolean;
  onAnimationStart?: () => void;
  onAnimationComplete?: () => void;
}

export interface CharLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}
