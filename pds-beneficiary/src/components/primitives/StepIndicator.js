import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../../theme";

// A simple N-step "dot — line — dot" progress indicator for short linear
// flows (e.g. Login's mobile-number -> OTP steps). `step` is 1-indexed.
export default function StepIndicator({ steps, step, style }) {
    return (
        <View
            style={[styles.row, style]}
            accessibilityRole="progressbar"
            accessibilityLabel={`Step ${step} of ${steps.length}: ${steps[step - 1]}`}
            accessibilityValue={{ min: 1, max: steps.length, now: step }}
        >
            {steps.map((label, i) => {
                const index = i + 1;
                const isDone = index < step;
                const isActive = index === step;
                return (
                    <React.Fragment key={label}>
                        {i > 0 && <View style={[styles.line, (isDone || isActive) && styles.lineActive]} />}
                        <View style={styles.stepGroup}>
                            <View style={[styles.dot, (isDone || isActive) && styles.dotActive]}>
                                <Text style={[styles.dotText, (isDone || isActive) && styles.dotTextActive]}>
                                    {index}
                                </Text>
                            </View>
                            <Text style={[styles.label, isActive && styles.labelActive]}>{label}</Text>
                        </View>
                    </React.Fragment>
                );
            })}
        </View>
    );
}

const DOT_SIZE = typography.size.lg; // 22

const styles = StyleSheet.create({
    row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center" },
    stepGroup: { alignItems: "center" },
    dot: {
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: DOT_SIZE / 2,
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1.5,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },
    dotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    dotText: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.textMuted },
    dotTextActive: { color: colors.onPrimary },
    label: {
        marginTop: spacing.xs,
        fontSize: typography.size.xs,
        color: colors.textMuted,
    },
    labelActive: { color: colors.textPrimary, fontWeight: typography.weight.semibold },
    line: {
        width: spacing.xxl,
        height: 1.5,
        backgroundColor: colors.border,
        marginTop: DOT_SIZE / 2,
        marginHorizontal: spacing.xs,
    },
    lineActive: { backgroundColor: colors.primary },
});
