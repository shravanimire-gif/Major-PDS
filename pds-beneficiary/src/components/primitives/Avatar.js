import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, typography } from "../../theme";

function initialsOf(name) {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFor(name) {
    const str = name || "";
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) | 0;
    }
    const palette = colors.avatarPalette;
    return palette[Math.abs(hash) % palette.length];
}

// Deterministic initials avatar — the same name always renders the same
// color, so a family member's avatar stays stable across re-fetches.
export default function Avatar({ name, size = typography.size.display, style }) {
    const background = colorFor(name);

    return (
        <View
            style={[
                styles.circle,
                { width: size, height: size, backgroundColor: background },
                style,
            ]}
            accessibilityLabel={name}
            accessibilityRole="image"
        >
            <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initialsOf(name)}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    circle: { alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
    initials: { color: colors.onPrimary, fontWeight: typography.weight.bold },
});
