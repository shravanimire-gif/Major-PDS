import React, { useRef } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { colors, radius, spacing, typography } from "../../theme";

// A 6-box OTP field that behaves like one logical input: typing a digit
// auto-advances focus, backspace on an empty box steps back, and pasting
// (or autofilling) the full code into any box distributes it across all
// boxes. `value`/`onChangeText` mirror TextInput's API so screens can treat
// it as a drop-in replacement for a single TextInput.
export default function SegmentedOTPInput({ length = 6, value, onChangeText, error, style }) {
    const inputs = useRef([]);
    const digits = Array.from({ length }, (_, i) => value[i] || "");

    const setDigitAt = (index, text) => {
        const chars = value.split("");
        chars[index] = text;
        onChangeText(chars.join("").slice(0, length));
    };

    const handleChange = (index, text) => {
        const clean = text.replace(/\D/g, "");

        if (clean.length > 1) {
            // Pasted or autofilled the whole code (or a chunk of it).
            const merged = (value.slice(0, index) + clean).slice(0, length);
            onChangeText(merged);
            const focusIndex = Math.min(merged.length, length - 1);
            inputs.current[focusIndex]?.focus();
            return;
        }

        if (!clean) {
            setDigitAt(index, "");
            return;
        }

        // `value` is a plain string, which can't represent a "gap" — if the
        // user taps ahead of the current fill point and types, writing at
        // that box's index would silently shift the digit to the wrong
        // position once re-rendered. Clamp to the next contiguous slot
        // instead so the string never develops a hole.
        const targetIndex = Math.min(index, value.length);
        setDigitAt(targetIndex, clean);
        if (targetIndex < length - 1) {
            inputs.current[targetIndex + 1]?.focus();
        }
    };

    const handleKeyPress = (index, e) => {
        if (e.nativeEvent.key === "Backspace" && !digits[index] && index > 0) {
            inputs.current[index - 1]?.focus();
            setDigitAt(index - 1, "");
        }
    };

    return (
        <View style={style}>
            <View style={styles.row}>
                {digits.map((digit, i) => (
                    <TextInput
                        key={i}
                        ref={(r) => { inputs.current[i] = r; }}
                        style={[styles.box, error && styles.boxError, digit && styles.boxFilled]}
                        value={digit}
                        onChangeText={(text) => handleChange(i, text)}
                        onKeyPress={(e) => handleKeyPress(i, e)}
                        keyboardType="number-pad"
                        maxLength={length} // allows paste-the-whole-code into any box
                        textContentType="oneTimeCode"
                        autoComplete="sms-otp"
                        accessibilityLabel={`OTP digit ${i + 1} of ${length}`}
                    />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: "row", justifyContent: "space-between" },
    box: {
        width: typography.size.display, // 40 — square-ish box sized off the type scale
        height: typography.size.display + spacing.base,
        borderWidth: 1.5,
        borderColor: colors.border,
        borderRadius: radius.sm,
        backgroundColor: colors.surfaceAlt,
        textAlign: "center",
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: colors.textPrimary,
    },
    boxFilled: { borderColor: colors.primary },
    boxError: { borderColor: colors.danger },
});
