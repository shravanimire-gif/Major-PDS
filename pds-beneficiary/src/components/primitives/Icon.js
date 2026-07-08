import React from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { icons, colors, typography } from "../../theme";

const FAMILIES = { Ionicons, MaterialCommunityIcons };

export default function Icon({ name, size = typography.size.base, color = colors.textPrimary, style, ...rest }) {
    const entry = icons[name];
    if (!entry) return null;

    const IconComponent = FAMILIES[entry.family];
    // Icons are decorative by default (hidden from screen readers) unless
    // a caller passes accessibilityLabel to make one meaningful on its own
    // (e.g. a status glyph with no adjacent text).
    const accessible = !!rest.accessibilityLabel;
    return (
        <IconComponent
            name={entry.name}
            size={size}
            color={color}
            style={style}
            importantForAccessibility={accessible ? "yes" : "no-hide-descendants"}
            accessibilityElementsHidden={!accessible}
            {...rest}
        />
    );
}
