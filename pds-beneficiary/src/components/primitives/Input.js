import React from "react";
import { View, TextInput, Text, StyleSheet } from "react-native";
import { colors, radius, spacing, typography } from "../../theme";

export default function Input({ style, error, containerStyle, accessibilityLabel, placeholder, ...props }) {
    return (
        <View style={containerStyle}>
            <TextInput
                style={[styles.input, error && styles.inputError, style]}
                placeholderTextColor={colors.textMuted}
                placeholder={placeholder}
                accessibilityLabel={accessibilityLabel || placeholder}
                accessibilityState={{ disabled: props.editable === false }}
                {...props}
            />
            {!!error && (
                <Text style={styles.errorText} accessibilityRole="alert">
                    {error}
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    input: {
        borderWidth: 1.5,
        borderColor: colors.border,
        borderRadius: radius.sm,
        padding: spacing.base, // was 14 -> rounds to 16
        fontSize: typography.size.base,
        marginBottom: spacing.base,
        backgroundColor: colors.surfaceAlt,
    },
    inputError: { borderColor: colors.danger, marginBottom: spacing.xs },
    errorText: {
        color: colors.danger,
        fontSize: typography.size.xs,
        marginBottom: spacing.base,
        marginTop: -spacing.xs,
    },
});
