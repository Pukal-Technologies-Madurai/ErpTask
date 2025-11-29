import React, { useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    TextInput,
} from "react-native";

export interface MultiSelectItem {
    label: string;
    value: string;
}

type Props = {
    label: string;
    selected: string[];
    options: MultiSelectItem[];
    onChange: (values: string[]) => void;
};

const MultiSelectDropdown = ({ label, selected, options, onChange }: Props) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    // Filter using search box
    const filtered = options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase())
    );

    const toggleValue = (value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter((v) => v !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    return (
        <View style={{ marginBottom: 12 }}>
            {/* Label */}
            <Text style={{ marginBottom: 6, fontWeight: "600", fontSize: 14 }}>
                {label}
            </Text>

            {/* Dropdown Header */}
            <TouchableOpacity
                onPress={() => setOpen(!open)}
                style={{
                    borderWidth: 1,
                    borderColor: "#999",
                    borderRadius: 8,
                    padding: 12,
                    backgroundColor: "#fff",
                }}
                activeOpacity={0.6}
            >
                <Text numberOfLines={1}>
                    {selected.length > 0
                        ? selected.join(", ")
                        : "Select"}
                </Text>
            </TouchableOpacity>

            {/* Dropdown Content */}
            {open && (
                <View
                    style={{
                        borderWidth: 1,
                        borderColor: "#999",
                        borderRadius: 8,
                        marginTop: 4,
                        backgroundColor: "white",
                        maxHeight: 250,
                        overflow: "hidden",
                    }}
                >
                    {/* Search Box */}
                    <TextInput
                        placeholder="Search..."
                        value={search}
                        onChangeText={setSearch}
                        style={{
                            padding: 10,
                            borderBottomWidth: 1,
                            borderColor: "#ddd",
                        }}
                    />

                    {/* List */}
                    <FlatList
                        data={filtered}
                        keyExtractor={(item) => item.value}
                        renderItem={({ item }) => {
                            const isSelected = selected.includes(item.label);

                            return (
                                <TouchableOpacity
                                    onPress={() => toggleValue(item.label)}
                                    style={{
                                        padding: 12,
                                        backgroundColor: isSelected
                                            ? "#e3f2fd"
                                            : "white",
                                        borderBottomWidth: 1,
                                        borderColor: "#eee",
                                    }}
                                >
                                    <Text>{item.label}</Text>
                                </TouchableOpacity>
                            );
                        }}
                    />
                </View>
            )}
        </View>
    );
};

export default MultiSelectDropdown;
