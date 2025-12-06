import React from "react";
import {
    View,
    ScrollView,
    TouchableOpacity,
    Text,
    StyleSheet,
} from "react-native";
import { useTheme } from "../Context/ThemeContext";

export interface Level2Option {
    value: string;
    label: string;
}

export interface Level2Group {
    title: string;                      // e.g., "Party Nature", "Active"
    key: string;                        // unique ID for filter
    options: Level2Option[];
}

interface Props {
    groups: Level2Group[];              // Dynamic groups from API
    selectedValues: Record<string, string>; // { Party_Nature: "3", Active: "1" }
    onSelect: (groupKey: string, value: string) => void;
}

const Level2FilterGroup: React.FC<Props> = ({
    groups,
    selectedValues,
    onSelect,
}) => {
    const { colors, typography } = useTheme();
    const styles = getStyles(typography, colors);

    if (!groups || groups.length === 0) return null;

    return (
        <View style={styles.container}>
            {groups.map((group) => (
                <View key={group.key} style={styles.groupContainer}>
                    {group.title && (
                        <Text style={styles.groupTitle}>{group.title}</Text>
                    )}

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.scroll}
                    >
                        {group.options.map((opt) => {
                            const isSelected =
                                selectedValues[group.key] === opt.value;

                            return (
                                <TouchableOpacity
                                    key={opt.value}
                                    onPress={() =>
                                        onSelect(group.key, opt.value)
                                    }
                                    style={[
                                        styles.chip,
                                        isSelected && styles.chipSelected,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            isSelected && styles.chipTextSelected,
                                        ]}
                                    >
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            ))}
        </View>
    );
};

export default Level2FilterGroup;

const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        container: {
            marginTop: 10,
        },
        groupContainer: {
            marginBottom: 14,
        },
        groupTitle: {
            fontSize: 15,
            fontWeight: "600",
            color: colors.text,
            marginLeft: 10,
            marginBottom: 6,
        },
        scroll: {
            paddingHorizontal: 10,
            gap: 10,
        },
        chip: {
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.textSecondary,
            backgroundColor: colors.surface,
        },
        chipSelected: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        chipText: {
            color: colors.text,
            fontSize: 14,
        },
        chipTextSelected: {
            color: "#fff",
            fontWeight: "700",
        },
    });
