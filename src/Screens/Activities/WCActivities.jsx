import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Dropdown } from "react-native-element-dropdown";

import { useThemeContext } from "../../Context/ThemeContext";
import { typography } from "../../constants/helper";
import { api } from "../../constants/api";
import { formatTime } from "../../constants/utils";

import Icon from "react-native-vector-icons/FontAwesome";
import AntIcon from "react-native-vector-icons/AntDesign";

const WCActivities = () => {
    const { colors, customStyles } = useThemeContext();
    const [data, setData] = useState([]);

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    const dropDownData = [
        { label: "MILL", value: 1 },
        { label: "GODOWN", value: 2 },
    ];
    const [dropDownValue, setDropDownValue] = useState(dropDownData[0].label);

    useEffect(() => {
        getWeightCheck(selectedDate.toISOString(), dropDownValue);
    }, [selectedDate, dropDownValue]);

    const getWeightCheck = async (date, dropValue) => {
        try {
            const response = await fetch(
                api.getweightCheckActivity(date, dropValue),
            );
            const jsonData = await response.json();

            if (jsonData.success) {
                setData(jsonData.data);
            }
        } catch (err) {
            console.log("Error fetching data:", err);
        }
    };

    const showDatepicker = () => {
        setShowDatePicker(true);
    };

    const handleDateChange = (event, date) => {
        setShowDatePicker(false);
        if (date) {
            setSelectedDate(date);
        }
    };

    const renderActivityCards = () => {
        return data.map((activity, index) => (
            <View
                key={index}
                style={[styles(colors).card, styles(colors).cardContainer]}>
                <View
                    style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                    }}>
                    <Text style={styles(colors).cardHead}>
                        <AntIcon
                            name="clockcircleo"
                            size={20}
                            color={colors.primary}
                        />
                        &nbsp;
                        {formatTime(activity.StartTime)}
                    </Text>

                    <Text style={styles(colors).cardHead}>
                        <AntIcon
                            name="clockcircleo"
                            size={20}
                            color={colors.primary}
                        />
                        &nbsp;
                        {formatTime(activity.EndTime)}
                    </Text>
                </View>

                <View style={styles(colors).activityDetails}>
                    {/* <View style={styles(colors).activityDetail}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', }}>
                            <Text style={styles(colors).detailLabel}>Start Time: </Text>
                            <Text style={styles(colors).detailValue}>
                                {new Date(activity.StartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', }}>
                            <Text style={styles(colors).detailLabel}>End Time: </Text>
                            <Text style={styles(colors).detailValue}>
                                {new Date(activity.EndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </View>
                    </View> */}

                    <View style={styles(colors).activityDetail}>
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                            }}>
                            <Text style={styles(colors).detailLabel}>
                                Input KG:{" "}
                            </Text>
                            <Text style={styles(colors).detailValue}>
                                {activity.InputKG}
                            </Text>
                        </View>
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                            }}>
                            <Text style={styles(colors).detailLabel}>
                                Output KG:{" "}
                            </Text>
                            <Text style={styles(colors).detailValue}>
                                {activity.OutputKG}
                            </Text>
                        </View>
                    </View>

                    <View
                        style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={styles(colors).detailLabel}>
                            Checked By:{" "}
                        </Text>
                        <Text style={styles(colors).detailValue}>
                            {activity.WeingtCheckedBy}
                        </Text>
                    </View>

                    <View
                        style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={styles(colors).detailLabel}>Stock: </Text>
                        <Text
                            style={[styles(colors).detailValue, { flex: 1 }]}
                            numberOfLines={2}>
                            {activity.StockItem}
                        </Text>
                    </View>
                </View>
            </View>
        ));
    };

    return (
        <View style={customStyles.container}>
            <View style={styles(colors).userPickContainer}>
                <View style={styles(colors).datePickerWrapper}>
                    <TouchableOpacity
                        style={styles(colors).datePicker}
                        onPress={showDatepicker}>
                        <TextInput
                            maxFontSizeMultiplier={1.2}
                            style={styles(colors).textInput}
                            value={`${selectedDate
                                .getDate()
                                .toString()
                                .padStart(2, "0")}/${(
                                selectedDate.getMonth() + 1
                            )
                                .toString()
                                .padStart(
                                    2,
                                    "0",
                                )}/${selectedDate.getFullYear()}`}
                            editable={false}
                        />
                        <Icon name="calendar" color={colors.accent} size={20} />
                    </TouchableOpacity>

                    {showDatePicker && (
                        <DateTimePicker
                            backgroundColor={colors.primary}
                            value={selectedDate}
                            mode="date"
                            display="default"
                            onChange={handleDateChange}
                        />
                    )}
                </View>

                <Dropdown
                    data={dropDownData}
                    value={dropDownValue}
                    labelField="label"
                    valueField="label"
                    placeholder="Select Location"
                    renderLeftIcon={() => (
                        <Icon
                            name="map-marker"
                            color={colors.accent}
                            size={20}
                            style={{ marginRight: 10 }}
                        />
                    )}
                    onChange={item => {
                        setDropDownValue(item.label);
                    }}
                    maxHeight={300}
                    style={styles(colors).dropdown}
                    placeholderStyle={styles(colors).placeholderStyle}
                    containerStyle={styles(colors).dropdownContainer}
                    selectedTextStyle={styles(colors).selectedTextStyle}
                    iconStyle={styles(colors).iconStyle}
                />
            </View>

            <ScrollView>
                <View style={styles(colors).activityCardsContainer}>
                    {data.length === 0 ? (
                        <View style={customStyles.noDataContainer}>
                            <Text style={customStyles.noDataText}>
                                No activities found.
                            </Text>
                        </View>
                    ) : (
                        renderActivityCards()
                    )}
                </View>
            </ScrollView>
        </View>
    );
};

export default WCActivities;

const styles = colors =>
    StyleSheet.create({
        userPickContainer: {
            padding: 10,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
        },
        datePickerWrapper: {
            width: "45%",
        },
        datePicker: {
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: "#ddd",
            borderRadius: 5,
            paddingHorizontal: 10,
            backgroundColor: colors.secondary,
        },
        textInput: {
            flex: 1,
            color: colors.text,
            ...typography.body1(colors),
        },
        dropdown: {
            width: "45%",
            height: 50,
            borderColor: "#ddd",
            borderWidth: 0.5,
            borderRadius: 8,
            paddingHorizontal: 8,
            backgroundColor: colors.secondary,
        },
        dropdownContainer: {
            backgroundColor: colors.secondary,
            borderColor: colors.textPrimary,
            borderWidth: 0.5,
            borderRadius: 10,
        },
        placeholderStyle: {
            ...typography.body1(colors),
        },
        selectedTextStyle: {
            ...typography.body1(colors),
        },
        iconStyle: {
            width: 20,
            height: 20,
        },

        card: {
            backgroundColor: colors.background,
            borderRadius: 8,
            padding: 16,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
        },
        cardContainer: {
            margin: 15,
        },
        cardHead: {
            ...typography.h5(colors),
            fontWeight: "bold",
            color: colors.primary,
            marginBottom: 8,
        },
        activityDetails: {
            marginTop: 8,
        },
        activityDetail: {
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 5,
        },
        detailLabel: {
            // flex: 1,
            ...typography.body1(colors),
            fontWeight: "bold",
            // color: colors.textDark,
        },
        detailValue: {
            ...typography.h6(colors),
            fontWeight: "bold",
            color: colors.accent,
        },
    });
