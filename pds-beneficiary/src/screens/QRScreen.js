import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { colors, typography, spacing, radius, elevation } from "../theme";
import { Button, ScreenHeader, Icon, useToast } from "../components/primitives";

const QR_SIZE = 240; // react-native-qrcode-svg's `size` prop — a library-required pixel value, not a design token
const HAPTIC_WARNING_THRESHOLD = 10;
const TRANSITION_MS = 300;

export default function QRScreen({ navigation }) {
    const { logout } = useAuth();
    const toast = useToast();
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const timerRef = useRef(null);
    const expiresAtRef = useRef(null);
    const warningFiredRef = useRef(false);

    const fetchSession = useCallback(async () => {
        setLoading(true);
        clearInterval(timerRef.current);
        try {
            const res = await api.post("/api/beneficiary/qr-session");
            setSession(res.data);

            const expiresAt = new Date(res.data.expiresAt).getTime();
            expiresAtRef.current = expiresAt;
            warningFiredRef.current = false;

            const tick = () => {
                const remaining = Math.max(0, Math.round((expiresAtRef.current - Date.now()) / 1000));
                setSecondsLeft(remaining);

                if (remaining <= HAPTIC_WARNING_THRESHOLD && remaining > 0 && !warningFiredRef.current) {
                    warningFiredRef.current = true;
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                }

                if (remaining === 0) {
                    clearInterval(timerRef.current);
                    // Functional gap flagged in the audit: the countdown used to just
                    // stop and wait for a manual tap. It now fetches the next QR
                    // automatically so the code shown is (almost) always valid.
                    fetchSession();
                }
            };
            tick();
            timerRef.current = setInterval(tick, 1000);
        } catch (err) {
            if (err.response?.status === 401) {
                logout();
            } else {
                toast.show(err.response?.data?.error || "Failed to generate QR", { variant: "error" });
            }
        } finally {
            setLoading(false);
        }
    }, [logout, toast]);

    useEffect(() => {
        fetchSession();
        return () => clearInterval(timerRef.current);
    }, [fetchSession]);

    const qrValue = session
        ? JSON.stringify({
            rationCardId: session.rationCardId,
            sessionId: session.sessionId,
            expiresAt: session.expiresAt,
        })
        : "";

    const isExpired = secondsLeft === 0 && session !== null;

    // Cross-fade + scale between the active QR and expired placard instead
    // of an instant swap. Both layers stay mounted and overlap; their
    // opacity/scale are driven by one shared progress value.
    const transitionProgress = useSharedValue(0);
    useEffect(() => {
        transitionProgress.value = withTiming(isExpired ? 1 : 0, { duration: TRANSITION_MS });
    }, [isExpired, transitionProgress]);

    const qrLayerStyle = useAnimatedStyle(() => ({
        opacity: 1 - transitionProgress.value,
        transform: [{ scale: 1 - transitionProgress.value * 0.1 }],
    }));
    const expiredLayerStyle = useAnimatedStyle(() => ({
        opacity: transitionProgress.value,
        transform: [{ scale: 0.9 + transitionProgress.value * 0.1 }],
    }));

    return (
        <SafeAreaView style={styles.container}>
            <ScreenHeader>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => navigation.goBack()}
                    accessibilityRole="button"
                    accessibilityLabel="Go back to Dashboard"
                >
                    <Icon name="back" size={typography.size.base} color={colors.onPrimary} />
                    <Text style={styles.back}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Your QR Code</Text>
                <View style={styles.headerSpacer} />
            </ScreenHeader>

            <View style={styles.body}>
                {loading ? (
                    <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading QR code" />
                ) : (
                    <View style={styles.qrStateContainer}>
                        <Animated.View
                            style={[styles.stateLayer, styles.qrBox, qrLayerStyle]}
                            pointerEvents={isExpired ? "none" : "auto"}
                            importantForAccessibility={isExpired ? "no-hide-descendants" : "yes"}
                            accessible={!isExpired}
                            accessibilityRole="image"
                            accessibilityLabel="Your purchase QR code. Show this to the shopkeeper."
                        >
                            <QRCode value={qrValue} size={QR_SIZE} />
                        </Animated.View>
                        <Animated.View
                            style={[styles.stateLayer, styles.expiredBox, expiredLayerStyle]}
                            pointerEvents={isExpired ? "auto" : "none"}
                            importantForAccessibility={isExpired ? "yes" : "no-hide-descendants"}
                        >
                            <Icon name="qrExpired" size={typography.size.display} color={colors.textMuted} />
                            <Text style={styles.expiredText}>QR Expired</Text>
                            <Text style={styles.expiredSub}>Generating a new one…</Text>
                        </Animated.View>
                    </View>
                )}

                {!loading && (
                    <View style={styles.timerBox}>
                        {isExpired ? (
                            <Text style={styles.timerExpired} accessibilityLiveRegion="polite">
                                Expired — refreshing
                            </Text>
                        ) : (
                            <>
                                <Text style={styles.timerLabel}>Valid for</Text>
                                <Text
                                    style={[styles.timerValue, secondsLeft <= HAPTIC_WARNING_THRESHOLD && styles.timerRed]}
                                    accessibilityLabel={`${secondsLeft} seconds remaining`}
                                >
                                    {secondsLeft}s
                                </Text>
                            </>
                        )}
                    </View>
                )}

                <Button
                    title="Refresh QR"
                    icon="refresh"
                    loading={loading}
                    onPress={fetchSession}
                    style={styles.refreshBtn}
                    accessibilityLabel="Refresh QR code now"
                />

                <Text style={styles.hint}>
                    Show this QR to the shopkeeper.{"\n"}It expires in 60 seconds and refreshes automatically.
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    backBtn: { flex: 1, flexDirection: "row", alignItems: "center" },
    back: { color: colors.onPrimary, fontSize: typography.size.base, marginLeft: spacing.xs },
    title: {
        flex: 2,
        textAlign: "center",
        color: colors.onPrimary,
        fontSize: typography.size.md,
        fontWeight: typography.weight.bold,
    },
    // Balances the back button so the title stays centered without a
    // magic-number spacer view.
    headerSpacer: { flex: 1 },
    body: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.xl,
    },
    // Both the QR and expired layers are absolutely positioned so they can
    // cross-fade over each other; the container needs an explicit size
    // since position:absolute children don't contribute one themselves.
    qrStateContainer: {
        width: QR_SIZE + spacing.xl * 2,
        height: QR_SIZE + spacing.xl * 2,
        alignItems: "center",
        justifyContent: "center",
    },
    stateLayer: {
        position: "absolute",
        alignItems: "center",
        justifyContent: "center",
    },
    qrBox: {
        backgroundColor: colors.surface,
        padding: spacing.xl,
        borderRadius: radius.lg,
        ...elevation.high,
    },
    expiredBox: { padding: spacing.xl },
    expiredText: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: colors.danger,
        marginTop: spacing.sm,
    },
    expiredSub: { fontSize: typography.size.sm, color: colors.textMuted, marginTop: spacing.xs },
    timerBox: {
        flexDirection: "row",
        alignItems: "baseline",
        gap: spacing.sm, // was 6 -> rounds to 8
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
    },
    timerLabel: { fontSize: typography.size.base, color: colors.textSecondary }, // was #555 -> textSecondary
    timerValue: { fontSize: typography.size.xxl, fontWeight: typography.weight.bold, color: colors.primary }, // was 800 -> bold
    timerRed: { color: colors.danger },
    timerExpired: { fontSize: typography.size.md, color: colors.danger, fontWeight: typography.weight.semibold },
    refreshBtn: {
        paddingHorizontal: spacing.xxl,
        paddingVertical: spacing.base, // was 14 -> rounds to 16
        borderRadius: radius.sm, // was 12 -> rounds to 10
        marginTop: spacing.base,
        minWidth: 180,
    },
    hint: {
        marginTop: spacing.xl,
        textAlign: "center",
        color: colors.textMuted, // was #888 -> textMuted
        fontSize: typography.size.sm, // was 13 -> rounds to 14
        lineHeight: spacing.lg,
    },
});
