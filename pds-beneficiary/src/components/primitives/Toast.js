import React, { useEffect, useRef } from "react";
import { Animated, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius, typography, elevation } from "../../theme";
import Icon from "./Icon";

const VARIANT_ICON = { success: "success", error: "error", info: "info" };
const VARIANT_COLOR = { success: colors.success, error: colors.danger, info: colors.primary };

// Presentational only — ToastProvider owns the queue/timer and passes the
// current toast (or null) down. Animates in/out with the RN Animated API
// (reanimated is reserved for the QR screen transition per the Phase 2 brief).
export default function Toast({ toast, onHide }) {
    const translateY = useRef(new Animated.Value(-80)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(translateY, { toValue: toast ? 0 : -80, duration: toast ? 220 : 180, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: toast ? 1 : 0, duration: toast ? 220 : 180, useNativeDriver: true }),
        ]).start();
    }, [toast, translateY, opacity]);

    if (!toast) return null;

    const accent = VARIANT_COLOR[toast.variant] || colors.primary;

    return (
        <SafeAreaView pointerEvents="box-none" style={styles.wrapper}>
            <Animated.View
                style={[styles.toast, { transform: [{ translateY }], opacity }]}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
            >
                <Icon name={VARIANT_ICON[toast.variant] || "info"} size={typography.size.base} color={accent} />
                <Text style={styles.text}>{toast.message}</Text>
                <TouchableOpacity
                    onPress={onHide}
                    accessibilityLabel="Dismiss notification"
                    accessibilityRole="button"
                    hitSlop={{ top: spacing.sm, bottom: spacing.sm, left: spacing.sm, right: spacing.sm }}
                >
                    <Icon name="dismiss" size={typography.size.sm} color={colors.onInverseSurface} />
                </TouchableOpacity>
            </Animated.View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    wrapper: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center" },
    toast: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.inverseSurface,
        borderRadius: radius.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.base,
        marginTop: spacing.sm,
        maxWidth: "92%",
        ...elevation.high,
    },
    text: {
        color: colors.onInverseSurface,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.semibold,
        marginHorizontal: spacing.sm,
        flexShrink: 1,
    },
});
