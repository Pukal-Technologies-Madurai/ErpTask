import React, { useState } from "react";
import {
    View, Text, TouchableOpacity,
    FlatList, TextInput
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

    const removeValue = (value: string) => {
        onChange(selected.filter((v) => v !== value));
    };

    return (
        <View style={{ marginBottom: 12 }}>
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
                    padding: 10,
                    minHeight: 50,
                    backgroundColor: "#fff",
                }}
                activeOpacity={0.6}
            >
                {/* Chips */}
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                    {selected.length > 0 ? (
                        selected.map((item) => (
                            <View
                                key={item}
                                style={{
                                    flexDirection: "row",
                                    backgroundColor: "#e3f2fd",
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 16,
                                    marginRight: 6,
                                    marginBottom: 6,
                                }}
                            >
                                <Text style={{ marginRight: 6 }}>{item}</Text>

                                {/* Remove Icon */}
                                <TouchableOpacity onPress={() => removeValue(item)}>
                                    <Text style={{ fontWeight: "bold" }}>×</Text>
                                </TouchableOpacity>
                            </View>
                        ))
                    ) : (
                        <Text style={{ color: "#666" }}>Select</Text>
                    )}
                </View>
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
