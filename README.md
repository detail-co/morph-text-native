# morph-text-native

Smooth, character-level text morphing for React Native. Powered by [Reanimated](https://docs.swmansion.com/react-native-reanimated/) and inspired by [torph](https://torph.lochie.me/).

When the text changes, each character animates independently, persisting characters slide to new positions, exiting characters fade out, and entering characters fade in.

<p align="center">
  <img src="./preview.gif" alt="morph-text-native preview" width="500" />
</p>

[Live demo](https://detail-co.github.io/morph-text-native)

## Requirements

- **React** >= 18
- **React Native** >= 0.70
- **react-native-reanimated** >= 3 ([installation guide](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started/))

## Install

```bash
npm install morph-text-native
```

## Usage

```tsx
import { MorphText } from 'morph-text-native';

function StatusLabel({ text }) {
  return (
    <MorphText
      style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}
      duration={400}
    >
      {text}
    </MorphText>
  );
}
```

Pass any string as `children`. When it changes, characters morph smoothly between the old and new text.

### Toast example

A single toast component that morphs its message instead of stacking multiple toasts:

```tsx
import { MorphText } from 'morph-text-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';

function Toast({ message, type }) {
  return (
    <Animated.View
      entering={SlideInDown.duration(300)}
      exiting={SlideOutDown.duration(200)}
      style={styles.toast}
    >
      <Icon type={type} />
      <MorphText
        style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}
        duration={300}
      >
        {message}
      </MorphText>
    </Animated.View>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `string` | required | Text to display and morph between |
| `style` | `TextStyle` | — | Style applied to each character's `<Text>` |
| `containerStyle` | `ViewStyle` | — | Style applied to the outer wrapping `<View>` |
| `duration` | `number` | `400` | Animation duration in ms |
| `ease` | `EasingFunction` | `Easing.bezier(0.19, 1, 0.22, 1)` | Reanimated easing function |
| `scale` | `boolean` | `true` | Whether entering/exiting characters scale |
| `onAnimationStart` | `() => void` | — | Called when the morph animation begins |
| `onAnimationComplete` | `() => void` | — | Called when the morph animation finishes |

## License

MIT
