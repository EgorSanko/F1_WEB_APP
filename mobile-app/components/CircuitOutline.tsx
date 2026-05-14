import Svg, { Polyline } from 'react-native-svg';
import { View } from 'react-native';

import { CIRCUIT_POLYLINES } from '@/lib/circuit-polylines';

/**
 * Очертание трассы по `circuit_id` из F1 API. Координаты нормализованы в
 * единичный квадрат [0..100] из bacinger/f1-circuits, рисуем красной обводкой.
 */
export function CircuitOutline({
  circuitId,
  width,
  height,
  color = '#E10600',
  strokeWidth = 2.4,
  opacity = 1,
  glow = false,
}: {
  circuitId?: string;
  width: number;
  height: number;
  color?: string;
  strokeWidth?: number;
  opacity?: number;
  glow?: boolean;
}) {
  const points = circuitId ? CIRCUIT_POLYLINES[circuitId] : undefined;
  if (!points) {
    return <View style={{ width, height }} />;
  }

  return (
    <View
      style={{
        width,
        height,
        opacity,
        // На Android shadow-color/-opacity не работают на View — оставлен как
        // визуальный bonus только для iOS.
        ...(glow
          ? {
              shadowColor: color,
              shadowOpacity: 0.6,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 0 },
            }
          : {}),
      }}>
      <Svg width={width} height={height} viewBox="-3 -3 106 106">
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
