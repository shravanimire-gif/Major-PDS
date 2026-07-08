import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../../theme";
import Icon from "./Icon";

// Generic icon + message pattern for empty lists (replaces plain
// "No X yet" text with something that reads as designed rather than
// unfinished).
export default function EmptyState({ icon, message, style }) {
    return (
        <View style={[styles.container, style]} accessibilityRole="text" accessibilityLabel={message}>
            <Icon name={icon} size={typography.size.xxl} color={colors.textMuted} />
            <Text style={styles.message}>{message}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { alignItems: "center", paddingVertical: spacing.lg },
    message: {
        marginTop: spacing.sm,
        fontSize: typography.size.sm,
        color: colors.textMuted,
        textAlign: "center",
    },
});
