import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from "react-native";
import api, { resolvedApiBaseUrl } from "../api/axios";
import { useAuth } from "../context/AuthContext";

const normalizeIndianMobile = (value) => {
    const digits = (value || "").replace(/\D/g, "");

    if (digits.length === 10) {
        return `+91${digits}`;
    }

    if (digits.length === 12 && digits.startsWith("91")) {
        return `+${digits}`;
    }

    return null;
};

export default function LoginScreen() {
    const { login } = useAuth();
    const [mobile, setMobile] = useState("");
    const [otp, setOtp] = useState("");
    const [step, setStep] = useState(1); // 1 = enter mobile, 2 = enter OTP
    const [loading, setLoading] = useState(false);

    const logAxiosError = (label, err) => {
        const cfg = err?.config;
        const payload = {
            label,
            message: err?.message,
            name: err?.name,
            code: err?.code,
            stack: __DEV__ ? err?.stack : undefined,
            responseStatus: err?.response?.status,
            responseStatusText: err?.response?.statusText,
            responseData: err?.response?.data,
            responseHeaders: err?.response?.headers,
            requestMethod: cfg?.method,
            requestUrl: cfg?.url,
            requestBaseURL: cfg?.baseURL,
            fullUrl: cfg?.baseURL && cfg?.url ? `${cfg.baseURL.replace(/\/$/, "")}/${String(cfg.url).replace(/^\//, "")}` : undefined,
            requestHeaders: cfg?.headers,
            requestData: cfg?.data,
        };
        console.log(`[LoginScreen] ${label} — axios error snapshot`, JSON.stringify(payload, null, 2));
        // Axios error objects are not always JSON-serializable; log raw too in dev.
        if (__DEV__) {
            console.log(`[LoginScreen] ${label} — raw error.response`, err?.response);
            console.log(`[LoginScreen] ${label} — raw error.config`, err?.config);
        }
    };

    const getRequestErrorMessage = (err, fallback) => {
        const data = err?.response?.data;
        if (data?.error) {
            if (Array.isArray(data.details) && data.details.length) {
                return `${data.error}: ${data.details.join("; ")}`;
            }
            return String(data.error);
        }
        if (err?.code === "ECONNABORTED") return "Request timed out. Check backend URL and network.";
        if (err?.message === "Network Error") {
            return `Cannot reach API at ${resolvedApiBaseUrl}. Use your dev machine's LAN IP and the same port as the backend (default 5000). Restart Expo after changing .env.`;
        }
        return fallback;
    };

    const handleSendOtp = async () => {
        const normalizedMobile = normalizeIndianMobile(mobile);

        if (!normalizedMobile) {
            return Alert.alert("Error", "Enter a valid mobile number (10 digits or +91XXXXXXXXXX)");
        }

        setLoading(true);
        try {
            const sendPath = "/auth/otp/send";
            const body = { mobile: normalizedMobile };
            console.log("[LoginScreen] Send OTP request", {
                baseURL: api.defaults.baseURL,
                path: sendPath,
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: "(if token exists, set by interceptor)" },
                body,
            });
            await api.post(sendPath, body);
            setMobile(normalizedMobile);
            setStep(2);
        } catch (err) {
            logAxiosError("Send OTP", err);
            Alert.alert("Error", getRequestErrorMessage(err, "Failed to send OTP"));
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp.trim()) return Alert.alert("Error", "Enter the OTP");

        const normalizedMobile = normalizeIndianMobile(mobile);
        if (!normalizedMobile) {
            return Alert.alert("Error", "Invalid mobile number. Please re-enter.");
        }

        setLoading(true);
        try {
            const verifyPath = "/auth/otp/verify";
            const body = { mobile: normalizedMobile, otp: otp.trim() };
            console.log("[LoginScreen] Verify OTP request", {
                baseURL: api.defaults.baseURL,
                path: verifyPath,
                method: "POST",
                body: { ...body, otp: "[redacted]" },
            });
            const res = await api.post(verifyPath, body);
            await login(res.data.token);
        } catch (err) {
            logAxiosError("Verify OTP", err);
            Alert.alert("Error", getRequestErrorMessage(err, "Invalid OTP"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <View style={styles.card}>
                <Text style={styles.logo}>🌾 PDS</Text>
                <Text style={styles.title}>Beneficiary Login</Text>
                <Text style={styles.subtitle}>
                    {step === 1 ? "Enter your registered mobile number" : `OTP sent to ${mobile}`}
                </Text>

                {step === 1 ? (
                    <>
                        <TextInput
                            style={styles.input}
                            placeholder="+91XXXXXXXXXX"
                            keyboardType="phone-pad"
                            value={mobile}
                            onChangeText={setMobile}
                            autoFocus
                        />
                        <TouchableOpacity
                            style={styles.btn}
                            onPress={handleSendOtp}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.btnText}>Send OTP</Text>
                            )}
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter 6-digit OTP"
                            keyboardType="number-pad"
                            value={otp}
                            onChangeText={setOtp}
                            maxLength={6}
                            autoFocus
                        />
                        <TouchableOpacity
                            style={styles.btn}
                            onPress={handleVerifyOtp}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.btnText}>Verify OTP</Text>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setStep(1)} style={styles.back}>
                            <Text style={styles.backText}>← Change number</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f0f4ff",
        justifyContent: "center",
        padding: 24,
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 28,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    logo: { fontSize: 40, textAlign: "center", marginBottom: 8 },
    title: {
        fontSize: 22,
        fontWeight: "700",
        textAlign: "center",
        color: "#1a1a2e",
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        color: "#666",
        textAlign: "center",
        marginBottom: 24,
    },
    input: {
        borderWidth: 1.5,
        borderColor: "#dde3f0",
        borderRadius: 10,
        padding: 14,
        fontSize: 16,
        marginBottom: 16,
        backgroundColor: "#f8f9ff",
    },
    btn: {
        backgroundColor: "#1a73e8",
        borderRadius: 10,
        padding: 15,
        alignItems: "center",
    },
    btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
    back: { marginTop: 16, alignItems: "center" },
    backText: { color: "#1a73e8", fontSize: 14 },
});
