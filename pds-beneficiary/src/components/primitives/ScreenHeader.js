import React from "react";
import { View, StyleSheet } from "react-native";
import { colors, spacing } from "../../theme";

// The shared flat-primary-blue header shell used by Dashboard (content
// header) and QR (nav bar). Both are a row with space-between children on
// a `primary` background — only alignment and padding differ per screen,
// so those stay as props/style overrides rather than being baked in.
export default function ScreenHeader({ children, align = "center", style }) {
    return <View style={[styles.header, { alignItems: align }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        backgroundColor: colors.primary,
        padding: spacing.base,
    },
});
