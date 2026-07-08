import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing, typography, elevation } from "../../theme";
import Icon from "./Icon";

export default function Card({
    title,
    icon,
    padding = spacing.base,
    elevation: elevationLevel = "low",
    style,
    children,
}) {
    return (
        <View style={[styles.card, { padding }, elevation[elevationLevel], style]}>
            {title && (
                <View style={styles.titleRow}>
                    {icon && <Icon name={icon} size={typography.size.base} color={colors.textPrimary} style={styles.titleIcon} />}
                    <Text style={styles.title} accessibilityRole="header">{title}</Text>
                </View>
            )}
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.md,
    },
    titleIcon: { marginRight: spacing.xs },
    title: {
        // was 15 -> rounds to the `base` step (16)
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: colors.textPrimary,
    },
});
