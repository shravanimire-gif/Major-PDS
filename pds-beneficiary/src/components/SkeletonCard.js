import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

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

    return (
        <Animated.View style={[styles.skeleton, { height, opacity }, style]} />
    );
}

const styles = StyleSheet.create({
    skeleton: {
        backgroundColor: "#dde3f0",
        borderRadius: 12,
        marginBottom: 12,
    },
});
