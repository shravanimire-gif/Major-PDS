import React, { useCallback, useEffect, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import SkeletonCard from "../components/SkeletonCard";

const CATEGORY_COLOR = { APL: "#2196F3", BPL: "#FF9800", AAY: "#F44336" };

export default function DashboardScreen({ navigation }) {
    const { logout } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchAll = useCallback(async () => {
        try {
            const [meRes, walletRes, familyRes, txRes] = await Promise.all([
                api.get("/api/beneficiary/me"),
                api.get("/api/beneficiary/wallet"),
                api.get("/api/beneficiary/family"),
                api.get("/api/beneficiary/transactions?limit=5"),
            ]);
            setData({
                beneficiary: meRes.data.beneficiary,
                wallet: walletRes.data.wallet,
                family: familyRes.data.family,
                transactions: txRes.data.transactions,
            });
        } catch (err) {
            if (err.response?.status === 401) {
                logout();
            } else {
                Alert.alert("Error", "Failed to load data. Pull to refresh.");
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [logout]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const onRefresh = () => { setRefreshing(true); fetchAll(); };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.padding}>
                    <SkeletonCard height={90} />
                    <SkeletonCard height={120} />
                    <SkeletonCard height={100} />
                    <SkeletonCard height={160} />
                </View>
            </SafeAreaView>
        );
    }

    const { beneficiary, wallet, family, transactions } = data || {};
    const catColor = CATEGORY_COLOR[beneficiary?.category] || "#666";

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>Welcome back 👋</Text>
                        <Text style={styles.name}>{beneficiary?.head_name}</Text>
                        <Text style={styles.cardNum}>Card: {beneficiary?.card_number}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: catColor }]}>
                        <Text style={styles.badgeText}>{beneficiary?.category}</Text>
                    </View>
                </View>

                {/* Wallet */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>🌾 Monthly Wallet</Text>
                    <View style={styles.grainRow}>
                        <GrainItem label="Rice" value={wallet?.rice_balance_kg} unit="kg" color="#4CAF50" />
                        <GrainItem label="Wheat" value={wallet?.wheat_balance_kg} unit="kg" color="#FF9800" />
                        <GrainItem label="Sugar" value={wallet?.sugar_balance_kg} unit="kg" color="#9C27B0" />
                    </View>
                </View>

                {/* QR Button */}
                <TouchableOpacity
                    style={styles.qrBtn}
                    onPress={() => navigation.navigate("QR")}
                >
                    <Text style={styles.qrBtnText}>📱 Generate QR Code</Text>
                </TouchableOpacity>

                {/* Family */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>👨‍👩‍👧 Family Members ({family?.length})</Text>
                    {family?.map((m, i) => (
                        <View key={i} style={styles.memberRow}>
                            <Text style={styles.memberName}>{m.name} {m.is_head ? "⭐" : ""}</Text>
                            <Text style={styles.memberAge}>{m.age} yrs</Text>
                        </View>
                    ))}
                </View>

                {/* Transactions */}
                <View style={[styles.card, { marginBottom: 32 }]}>
                    <Text style={styles.cardTitle}>📋 Recent Transactions</Text>
                    {transactions?.length === 0 && (
                        <Text style={styles.emptyText}>No transactions yet</Text>
                    )}
                    {transactions?.map((t) => (
                        <View key={t.id} style={styles.txRow}>
                            <View>
                                <Text style={styles.txShop}>{t.shop_name}</Text>
                                <Text style={styles.txDate}>
                                    {new Date(t.created_at).toLocaleDateString("en-IN", {
                                        day: "numeric", month: "short", year: "numeric",
                                    })}
                                </Text>
                            </View>
                            <View style={styles.txQtys}>
                                {t.rice_qty_kg > 0 && <Text style={styles.txQty}>🌾 {t.rice_qty_kg}kg</Text>}
                                {t.wheat_qty_kg > 0 && <Text style={styles.txQty}>🌿 {t.wheat_qty_kg}kg</Text>}
                                {t.sugar_qty_kg > 0 && <Text style={styles.txQty}>🍬 {t.sugar_qty_kg}kg</Text>}
                            </View>
                        </View>
                    ))}
                </View>
            </ScrollView>

            {/* Logout */}
            <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
                <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

function GrainItem({ label, value, unit, color }) {
    return (
        <View style={styles.grainItem}>
            <Text style={[styles.grainValue, { color }]}>{value ?? 0}</Text>
            <Text style={styles.grainUnit}>{unit}</Text>
            <Text style={styles.grainLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f0f4ff" },
    padding: { padding: 16 },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        backgroundColor: "#1a73e8",
        padding: 20,
        paddingTop: 16,
    },
    greeting: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
    name: { color: "#fff", fontSize: 22, fontWeight: "700", marginTop: 2 },
    cardNum: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 4 },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    badgeText: { color: "#fff", fontWeight: "700", fontSize: 13 },
    card: {
        backgroundColor: "#fff",
        margin: 16,
        marginBottom: 0,
        borderRadius: 14,
        padding: 16,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    cardTitle: { fontSize: 15, fontWeight: "700", color: "#1a1a2e", marginBottom: 12 },
    grainRow: { flexDirection: "row", justifyContent: "space-around" },
    grainItem: { alignItems: "center" },
    grainValue: { fontSize: 28, fontWeight: "800" },
    grainUnit: { fontSize: 12, color: "#888", marginTop: -2 },
    grainLabel: { fontSize: 13, color: "#444", marginTop: 4 },
    qrBtn: {
        backgroundColor: "#1a73e8",
        margin: 16,
        marginBottom: 0,
        borderRadius: 14,
        padding: 18,
        alignItems: "center",
    },
    qrBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
    memberRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
    },
    memberName: { fontSize: 15, color: "#1a1a2e" },
    memberAge: { fontSize: 14, color: "#888" },
    txRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
    },
    txShop: { fontSize: 14, fontWeight: "600", color: "#1a1a2e" },
    txDate: { fontSize: 12, color: "#888", marginTop: 2 },
    txQtys: { alignItems: "flex-end" },
    txQty: { fontSize: 12, color: "#555" },
    emptyText: { color: "#aaa", textAlign: "center", paddingVertical: 12 },
    logoutBtn: {
        margin: 16,
        padding: 14,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: "#e53935",
        alignItems: "center",
    },
    logoutText: { color: "#e53935", fontWeight: "600", fontSize: 15 },
});
