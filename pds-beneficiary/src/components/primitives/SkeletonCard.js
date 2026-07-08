import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import { colors, radius, spacing } from "../../theme";

export default function SkeletonCard({ height = 80, style }) {
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
            ])
        ).start();
    }, [opacity]);

    return <Animated.View style={[styles.skeleton, { height, opacity }, style]} />;
}

const styles = StyleSheet.create({
    skeleton: {
        backgroundColor: colors.border,
        borderRadius: radius.md, // was 12 -> merged onto the shared card radius (16)
        marginBottom: spacing.md,
    },
});
