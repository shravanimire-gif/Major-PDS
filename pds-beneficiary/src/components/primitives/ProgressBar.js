import React from "react";
import { View, StyleSheet } from "react-native";
import { colors, radius, spacing } from "../../theme";

// Determinate progress bar. `value`/`max` derive the fill percentage;
// `color` tints the fill (defaults to primary) so it can double as an
// entitlement-usage bar per grain type.
export default function ProgressBar({ value, max, color = colors.primary, label, style }) {
    const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;

    return (
        <View
            style={[styles.track, style]}
            accessibilityRole="progressbar"
            accessibilityLabel={label || "Progress"}
            accessibilityValue={{ min: 0, max: 100, now: pct }}
        >
            <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    track: {
        height: spacing.xs,
        borderRadius: radius.pill,
        backgroundColor: colors.border,
        overflow: "hidden",
    },
    fill: {
        height: "100%",
        borderRadius: radius.pill,
    },
});
