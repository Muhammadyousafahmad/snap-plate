import { Feather } from '@expo/vector-icons';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { hapticLight } from '@/services/haptics';
import { motion } from '@/theme/tokens';

/** Width of the revealed action well. Matches the standard iOS swipe action. */
const ACTION_WIDTH = 88;
/** How far the finger must pass before the row latches open. */
const LATCH_RATIO = 0.45;
const LATCH_POINT = -ACTION_WIDTH * LATCH_RATIO;
/** Maximum right-drag rubber-band travel. */
const RIGHT_RESISTANCE = 0.18;

type SwipeableRowProps = {
  /** Row content. Layout is owned by this component, not the caller. */
  children: ReactNode;
  /** Fired when the row is tapped while closed (e.g. open the meal detail). */
  onPress?: () => void;
  /** Fired by the revealed Delete action and by the accessibility rotor action. */
  onDelete: () => void;
  /** Screen-reader label for the delete action, e.g. "Delete Grilled chicken". */
  deleteLabel: string;
  /** False for the first row, which owns no top divider. */
  divider?: boolean;
};

/**
 * A row that can be swiped left to reveal a destructive action.
 *
 * Per Apple's own list behaviour, a full swipe does not delete on its own — it
 * reveals the action and the user confirms it, which is also how the rest of the
 * app deletes scans (see `history.tsx`). The haptic fires when the row *latches*
 * open, so the threshold is felt rather than guessed.
 *
 * The gesture is a plain Pan with `activeOffsetX`, which is what keeps vertical
 * scrolling of the parent list untouched, and the drag is rubber-banded on the
 * right so the row cannot be dragged off into empty space.
 */
export function SwipeableRow({
  children,
  onPress,
  onDelete,
  deleteLabel,
  divider = true,
}: SwipeableRowProps) {
  const offset = useSharedValue(0);
  const base = useSharedValue(0);
  const latched = useSharedValue(false);
  const [isOpen, setIsOpen] = useState(false);

  const close = useCallback(() => {
    offset.value = withSpring(0, motion.spring.reveal);
    setIsOpen(false);
  }, [offset]);

  // Re-sync the React mirror whenever the gesture settles on the UI thread.
  const settle = useCallback((open: boolean) => setIsOpen(open), []);

  const announceLatch = useCallback(() => hapticLight(), []);

  const pan = Gesture.Pan()
    // A 12pt horizontal bias means a vertical scroll never grabs the row.
    .activeOffsetX([-12, 12])
    .failOffsetY([-16, 16])
    .onBegin(() => {
      base.value = offset.value;
      latched.value = offset.value <= LATCH_POINT;
    })
    .onUpdate((event) => {
      const next = base.value + event.translationX;
      offset.value = next > 0 ? next * RIGHT_RESISTANCE : Math.max(next, -ACTION_WIDTH);
      const isPast = offset.value <= LATCH_POINT;
      if (isPast !== latched.value) {
        latched.value = isPast;
        if (isPast) runOnJS(announceLatch)();
      }
    })
    .onEnd(() => {
      const target = offset.value <= LATCH_POINT ? -ACTION_WIDTH : 0;
      offset.value = withSpring(target, motion.spring.reveal);
      runOnJS(settle)(target !== 0);
    });

  const rowStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      offset.value,
      [-ACTION_WIDTH, 0],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ translateX: offset.value }],
      // Shrinking the row slightly as it opens makes the action feel layered.
      opacity: interpolate(progress, [0, 1], [0.94, 1], Extrapolation.CLAMP),
    };
  });

  return (
    <View className={`relative overflow-hidden bg-surface ${divider ? 'border-t border-line' : ''}`}>
      {/* Action well — sits behind the row and is uncovered as the row slides. */}
      <View className="absolute inset-y-0 right-0 justify-center">
        <Pressable
          // Retract first so the row is already closed behind the confirmation.
          onPress={() => {
            close();
            onDelete();
          }}
          accessibilityRole="button"
          accessibilityLabel={deleteLabel}
          className="h-full items-center justify-center bg-rose-500 active:bg-rose-600"
          style={{ width: ACTION_WIDTH }}>
          <Feather name="trash-2" size={17} color="#FFFFFF" />
          <Text className="mt-1 text-[10px] font-bold text-white">Delete</Text>
        </Pressable>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle} className="bg-surface">
          <Pressable
            onPress={isOpen ? close : onPress}
            disabled={!isOpen && !onPress}
            accessibilityRole={isOpen || onPress ? 'button' : undefined}
            // VoiceOver/TalkBack users cannot perform a horizontal swipe inside a
            // list reliably, so the destructive action is also exposed through the
            // accessibility rotor.
            accessibilityActions={[{ name: 'delete', label: 'Delete meal' }]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'delete') onDelete();
            }}
            className={`flex-row items-center gap-3 p-3.5 ${
              isOpen || onPress ? 'active:bg-surface-raised' : ''
            }`}>
            {children}
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
