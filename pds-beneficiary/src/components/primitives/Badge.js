import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing, typography } from "../../theme";

// Generic pill badge, parameterized so it can render category badges
// (APL/BPL/AAY) or any other colored status pill without duplicating the
// shape/typography per call site.
export default function Badge({ label, color = colors.primary, style, accessibilityLabel }) {
    return (
        <View
            style={[styles.badge, { backgroundColor: color }, style]}
            accessibilityRole="text"
            accessibilityLabel={accessibilityLabel || label}
        >
            <Text style={styles.text}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm, // was 6 -> rounds to 8
        borderRadius: radius.pill,
    },
    text: {
        color: colors.onPrimary,
        fontWeight: typography.weight.bold,
        fontSize: typography.size.sm, // was 13 -> rounds to 14
    },
});
