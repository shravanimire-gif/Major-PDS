import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import api, { resolvedApiBaseUrl } from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { colors, typography, spacing, radius } from "../theme";
import { Card, Button, Input, Icon, StepIndicator, SegmentedOTPInput, useToast } from "../components/primitives";

const STEPS = ["Mobile Number", "Verify OTP"];

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
    const toast = useToast();
    const [mobile, setMobile] = useState("");
    const [otp, setOtp] = useState("");
    const [step, setStep] = useState(1); // 1 = enter mobile, 2 = enter OTP
    const [loading, setLoading] = useState(false);
    const [mobileError, setMobileError] = useState(null);
    const [otpError, setOtpError] = useState(null);

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
        setMobileError(null);
        const normalizedMobile = normalizeIndianMobile(mobile);

        if (!normalizedMobile) {
            setMobileError("Enter a valid mobile number (10 digits or +91XXXXXXXXXX)");
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            toast.show(`OTP sent to ${normalizedMobile}`, { variant: "success" });
        } catch (err) {
            logAxiosError("Send OTP", err);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setMobileError(getRequestErrorMessage(err, "Failed to send OTP"));
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        setOtpError(null);
        if (!otp.trim() || otp.trim().length < 6) {
            setOtpError("Enter the 6-digit OTP");
            return;
        }

        const normalizedMobile = normalizeIndianMobile(mobile);
        if (!normalizedMobile) {
            setOtpError("Invalid mobile number. Please re-enter.");
            setStep(1);
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await login(res.data.token);
        } catch (err) {
            logAxiosError("Verify OTP", err);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setOtpError(getRequestErrorMessage(err, "Invalid OTP"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <Card padding={spacing.xxl} elevation="medium">
                <LinearGradient
                    colors={[colors.primary, colors.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.brandBanner}
                >
                    <Icon name="brand" size={typography.size.xl} color={colors.onPrimary} />
                    <Text style={styles.logo}>PDS</Text>
                </LinearGradient>

                <StepIndicator steps={STEPS} step={step} style={styles.stepIndicator} />

                <Text style={styles.title}>Beneficiary Login</Text>
                <Text style={styles.subtitle}>
                    {step === 1 ? "Enter your registered mobile number" : `OTP sent to ${mobile}`}
                </Text>

                {step === 1 ? (
                    <>
                        <Input
                            placeholder="+91XXXXXXXXXX"
                            keyboardType="phone-pad"
                            value={mobile}
                            onChangeText={(text) => { setMobile(text); setMobileError(null); }}
                            error={mobileError}
                            autoFocus
                        />
                        <Button title="Send OTP" onPress={handleSendOtp} loading={loading} />
                    </>
                ) : (
                    <>
                        <SegmentedOTPInput
                            value={otp}
                            onChangeText={(text) => { setOtp(text); setOtpError(null); }}
                            error={!!otpError}
                            style={styles.otpInput}
                        />
                        {!!otpError && (
                            <Text style={styles.otpErrorText} accessibilityRole="alert">
                                {otpError}
                            </Text>
                        )}
                        <Button title="Verify OTP" onPress={handleVerifyOtp} loading={loading} style={styles.verifyBtn} />
                        <TouchableOpacity
                            onPress={() => { setStep(1); setOtpError(null); }}
                            style={styles.back}
                            accessibilityRole="button"
                            accessibilityLabel="Change mobile number"
                        >
                            <Icon name="back" size={typography.size.sm} color={colors.primary} />
                            <Text style={styles.backText}>Change number</Text>
                        </TouchableOpacity>
                    </>
                )}
            </Card>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: "center",
        padding: spacing.xl,
    },
    brandBanner: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        borderRadius: radius.md,
        paddingVertical: spacing.base,
        marginBottom: spacing.lg,
    },
    logo: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: colors.onPrimary,
        marginLeft: spacing.xs,
    },
    stepIndicator: { marginBottom: spacing.lg },
    title: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        textAlign: "center",
        color: colors.textPrimary,
        marginBottom: spacing.sm, // was 6 -> rounds to 8
    },
    subtitle: {
        fontSize: typography.size.sm,
        color: colors.textSecondary,
        textAlign: "center",
        marginBottom: spacing.xl,
    },
    otpInput: { marginBottom: spacing.xs },
    otpErrorText: {
        color: colors.danger,
        fontSize: typography.size.xs,
        textAlign: "center",
        marginBottom: spacing.base,
    },
    verifyBtn: { marginTop: spacing.xs },
    back: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginTop: spacing.base,
    },
    backText: { color: colors.primary, fontSize: typography.size.sm, marginLeft: spacing.xs },
});
