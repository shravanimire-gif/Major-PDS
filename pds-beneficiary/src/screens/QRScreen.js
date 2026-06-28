import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function QRScreen({ navigation }) {
    const { logout } = useAuth();
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const timerRef = useRef(null);

    const fetchSession = useCallback(async () => {
        setLoading(true);
        clearInterval(timerRef.current);
        try {
            const res = await api.post("/api/beneficiary/qr-session");
            setSession(res.data);

            const expiresAt = new Date(res.data.expiresAt).getTime();
            const tick = () => {
                const remaining = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
                setSecondsLeft(remaining);
                if (remaining === 0) {
                    clearInterval(timerRef.current);
                }
            };
            tick();
            timerRef.current = setInterval(tick, 1000);
        } catch (err) {
            if (err.response?.status === 401) {
                logout();
            } else {
                Alert.alert("Error", err.response?.data?.error || "Failed to generate QR");
            }
        } finally {
            setLoading(false);
        }
    }, [logout]);

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

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.back}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Your QR Code</Text>
                <View style={{ width: 50 }} />
            </View>

            <View style={styles.body}>
                {loading ? (
                    <ActivityIndicator size="large" color="#1a73e8" />
                ) : isExpired ? (
                    <View style={styles.expiredBox}>
                        <Text style={styles.expiredIcon}>⏰</Text>
                        <Text style={styles.expiredText}>QR Expired</Text>
                        <Text style={styles.expiredSub}>Tap refresh to generate a new one</Text>
                    </View>
                ) : (
                    <View style={styles.qrBox}>
                        <QRCode value={qrValue} size={240} />
                    </View>
                )}

                {!loading && (
                    <View style={styles.timerBox}>
                        {isExpired ? (
                            <Text style={styles.timerExpired}>Expired</Text>
                        ) : (
                            <>
                                <Text style={styles.timerLabel}>Valid for</Text>
                                <Text style={[styles.timerValue, secondsLeft <= 10 && styles.timerRed]}>
                                    {secondsLeft}s
                                </Text>
                            </>
                        )}
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.refreshBtn, loading && styles.refreshBtnDisabled]}
                    onPress={fetchSession}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.refreshText}>🔄 Refresh QR</Text>
                    )}
                </TouchableOpacity>

                <Text style={styles.hint}>
                    Show this QR to the shopkeeper.{"\n"}It expires in 60 seconds and can only be used once.
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f0f4ff" },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#1a73e8",
        padding: 16,
    },
    back: { color: "#fff", fontSize: 16 },
    title: { color: "#fff", fontSize: 18, fontWeight: "700" },
    body: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    qrBox: {
        backgroundColor: "#fff",
        padding: 24,
        borderRadius: 20,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 6,
    },
    expiredBox: { alignItems: "center", marginBottom: 8 },
    expiredIcon: { fontSize: 60 },
    expiredText: { fontSize: 22, fontWeight: "700", color: "#e53935", marginTop: 8 },
    expiredSub: { fontSize: 14, color: "#888", marginTop: 4 },
    timerBox: {
        flexDirection: "row",
        alignItems: "baseline",
        gap: 6,
        marginTop: 20,
        marginBottom: 8,
    },
    timerLabel: { fontSize: 16, color: "#555" },
    timerValue: { fontSize: 32, fontWeight: "800", color: "#1a73e8" },
    timerRed: { color: "#e53935" },
    timerExpired: { fontSize: 18, color: "#e53935", fontWeight: "600" },
    refreshBtn: {
        backgroundColor: "#1a73e8",
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 16,
        minWidth: 180,
        alignItems: "center",
    },
    refreshBtnDisabled: { opacity: 0.6 },
    refreshText: { color: "#fff", fontSize: 16, fontWeight: "600" },
    hint: {
        marginTop: 24,
        textAlign: "center",
        color: "#888",
        fontSize: 13,
        lineHeight: 20,
    },
});
