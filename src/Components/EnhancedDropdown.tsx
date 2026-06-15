import React, { FC, useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    Modal,
    StyleSheet,
    Animated,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import FeatherIcon from "react-native-vector-icons/Feather";
import { useTheme } from "../Context/ThemeContext";
import { shadows, spacing } from "../constants/helper";

type EnhancedDropdownProps = {
    data: Array<any>;
    labelField: string;
    valueField: string;
    placeholder?: string;
    value?: any;
    onChange?: (item: any) => void;
    showIcon?: boolean;
    iconName?: string;
    iconSize?: number;
    iconColor?: string;
    iconOnly?: boolean;
    containerStyle?: any;
    searchPlaceholder?: string;
};

const EnhancedDropdown: FC<EnhancedDropdownProps> = ({
    data,
    labelField,
    valueField,
    placeholder,
    value,
    onChange,
    showIcon = false,
    iconName = "filter",
    iconSize = 24,
    iconColor = "white",
    iconOnly = false,
    containerStyle,
    searchPlaceholder = "Search...",
}) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [animation] = useState(new Animated.Value(0));
    const { typography, colors } = useTheme();
    const styles = getStyles(typography, colors);

    const filteredData =
        data?.filter(item => {
            if (!item || !item[labelField]) return false;
            return item[labelField]
                .toString()
                .toLowerCase()
                .includes(searchQuery.toLowerCase());
        }) || [];

    const toggleModal = () => {
        setModalVisible(!modalVisible);
        Animated.timing(animation, {
            toValue: modalVisible ? 0 : 1,
            duration: 300,
            useNativeDriver: true,
        }).start();
    };

    const renderItem = ({ item }: { item: any }) => {
        if (!item || !item[labelField]) return null;
        return (
            <TouchableOpacity
                style={[
                    styles.dropdownItem,
                    value === item[valueField] && styles.selectedItem,
                ]}
                onPress={() => {
                    onChange?.(item);
                    toggleModal();
                    setSearchQuery("");
                }}>
                <Text
                    style={[
                        styles.dropdownItemText,
                        value === item[valueField] && styles.selectedItemText,
                    ]}>
                    {item[labelField]}
                </Text>
                {value === item[valueField] && (
                    <Icon name="checkmark" size={22} color={colors.primary} />
                )}
            </TouchableOpacity>
        );
    };

    const getSelectedLabel = () => {
        if (!data || !Array.isArray(data)) return placeholder;
        const selectedItem = data.find(
            item => item && item[valueField] === value,
        );
        return selectedItem ? selectedItem[labelField] : placeholder;
    };

    const modalTranslateY = animation.interpolate({
        inputRange: [0, 1],
        outputRange: [300, 0],
    });

    return (
        <View style={[styles.container, containerStyle]}>
            {iconOnly ? (
                <TouchableOpacity onPress={toggleModal}>
                    <FeatherIcon
                        name={iconName}
                        size={iconSize}
                        color={iconColor}
                    />
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    style={[
                        styles.dropdownButton,
                        showIcon && styles.dropdownButtonWithIcon,
                    ]}
                    onPress={toggleModal}>
                    {showIcon && (
                        <FeatherIcon
                            name={iconName}
                            size={iconSize}
                            color={iconColor}
                            style={styles.iconStyle}
                        />
                    )}
                    <Text style={styles.dropdownButtonText}>
                        {getSelectedLabel()}
                    </Text>
                    <Icon name="chevron-down" size={20} color={colors.grey} />
                </TouchableOpacity>
            )}

            <Modal
                transparent={true}
                visible={modalVisible}
                animationType="fade"
                onRequestClose={toggleModal}>
                <View style={styles.modalContainer}>
                    <TouchableOpacity
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={toggleModal}
                    />
                    <Animated.View
                        style={[
                            styles.modalContent,
                            {
                                transform: [{ translateY: modalTranslateY }],
                            },
                        ]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{placeholder}</Text>
                            <TouchableOpacity
                                onPress={toggleModal}
                                style={styles.closeButton}>
                                <Icon
                                    name="close"
                                    size={24}
                                    color={colors.grey}
                                />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchContainer}>
                            <Icon
                                name="search"
                                size={20}
                                color={colors.grey}
                                style={styles.searchIcon}
                            />
                            <TextInput
                                style={styles.searchInput}
                                placeholder={searchPlaceholder}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholderTextColor={colors.grey}
                            />
                        </View>

                        <FlatList
                            data={filteredData}
                            keyExtractor={item => item[valueField].toString()}
                            renderItem={renderItem}
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Icon
                                        name="search-outline"
                                        size={40}
                                        color={colors.grey}
                                    />
                                    <Text style={styles.emptyText}>
                                        No results found
                                    </Text>
                                </View>
                            }
                        />
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
};

const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        container: {
            width: "100%",
        },
        dropdownButton: {
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: colors.white,
            borderRadius: 8,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderWidth: 1,
            borderColor: colors.grey300,
            marginVertical: spacing.xs,
            ...shadows.small,
        },
        dropdownButtonWithIcon: {
            paddingLeft: spacing.sm,
        },
        dropdownButtonText: {
            flex: 1,
            ...typography.body1,
            color: colors.grey900,
        },
        iconStyle: {
            marginRight: spacing.sm,
        },
        modalContainer: {
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.5)",
        },
        modalOverlay: {
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
        },
        modalContent: {
            backgroundColor: colors.white,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: spacing.md,
            maxHeight: "80%",
            ...shadows.medium,
        },
        modalHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: spacing.md,
        },
        modalTitle: {
            ...typography.h6,
            color: colors.primary,
        },
        closeButton: {
            padding: spacing.xs,
        },
        searchContainer: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.grey100,
            borderRadius: 8,
            paddingHorizontal: spacing.sm,
            marginBottom: spacing.md,
        },
        searchIcon: {
            marginRight: spacing.sm,
        },
        searchInput: {
            flex: 1,
            ...typography.body1,
            color: colors.grey900,
            paddingVertical: spacing.sm,
        },
        dropdownItem: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.grey200,
        },
        selectedItem: {
            backgroundColor: colors.grey100,
        },
        dropdownItemText: {
            flex: 1,
            ...typography.body1,
            color: colors.grey900,
        },
        selectedItemText: {
            color: colors.primary,
            fontWeight: "600",
        },
        emptyContainer: {
            alignItems: "center",
            padding: spacing.md,
        },
        emptyText: {
            ...typography.body1,
            color: colors.grey500,
            marginTop: spacing.sm,
        },
    });

export default EnhancedDropdown;
