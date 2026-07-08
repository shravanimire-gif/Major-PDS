import React from "react";
import { TouchableOpacity, Text, View, ActivityIndicator, StyleSheet } from "react-native";
import { colors, radius, spacing, typography } from "../../theme";
import Icon from "./Icon";

export default function Button({
    title,
    onPress,
    loading = false,
    disabled = false,
    variant = "primary", // "primary" | "dangerOutline"
    icon,
    style,
    accessibilityLabel,
}) {
    const isDisabled = disabled || loading;
    const isDangerOutline = variant === "dangerOutline";

    return (
        <TouchableOpacity
            style={[
                styles.base,
                isDangerOutline ? styles.dangerOutline : styles.primary,
                isDisabled && styles.disabled,
                style,
            ]}
            onPress={onPress}
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel || title}
            accessibilityState={{ disabled: isDisabled, busy: loading }}
        >
            {loading ? (
                <ActivityIndicator color={isDangerOutline ? colors.danger : colors.onPrimary} />
            ) : (
                <View style={styles.content}>
                    {icon && (
                        <Icon
                            name={icon}
                            size={typography.size.md}
                            color={isDangerOutline ? colors.danger : colors.onPrimary}
                            style={styles.icon}
                        />
                    )}
                    <Text style={[styles.text, isDangerOutline && styles.dangerText]}>{title}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    base: {
        borderRadius: radius.sm,
        padding: spacing.base,
        alignItems: "center",
        justifyContent: "center",
    },
    primary: {
        backgroundColor: colors.primary,
    },
    dangerOutline: {
        backgroundColor: "transparent",
        borderWidth: 1.5,
        borderColor: colors.danger,
    },
    disabled: { opacity: 0.6 },
    content: { flexDirection: "row", alignItems: "center" },
    icon: { marginRight: spacing.xs },
    text: {
        color: colors.onPrimary,
        fontSize: typography.size.base,
        fontWeight: typography.weight.semibold,
    },
    dangerText: { color: colors.danger },
});
