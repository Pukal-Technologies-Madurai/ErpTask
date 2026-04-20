import React, { FC } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AntDesign from "react-native-vector-icons/AntDesign";
import FeatherIcon from "react-native-vector-icons/Feather";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import MaterialIcon from "react-native-vector-icons/MaterialIcons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../Context/ThemeContext";
import { responsiveHeight, responsiveWidth } from "../constants/helper";
import EnhancedDropdown from "./EnhancedDropdown";

const iconLibraries = {
    AntDesign: AntDesign,
    FeatherIcon: FeatherIcon,
    FontAwesome: FontAwesome,
    MaterialIcon: MaterialIcon,
    MaterialCommunityIcons: MaterialCommunityIcons,
} as const;

// Define interfaces for dropdown items
interface FilterDropdownItem {
    label: string;
    value: string;
}

// Define navigation type interface that can handle both stack and drawer navigators
interface NavigationProp {
    openDrawer?: () => void;
    goBack: () => void;
    [key: string]: any; // Allow any other navigation methods
}

type AppHeaderProps = {
    title?: string;
    navigation: NavigationProp;
    // --- First right icon ---
    showRightIcon?: boolean;
    rightIconName?: string;
    rightIconLibrary?: keyof typeof iconLibraries;
    onRightPress?: () => void;
    // --- Second right icon (optional) ---
    showRightIcon2?: boolean;
    rightIconName2?: string;
    rightIconLibrary2?: keyof typeof iconLibraries;
    onRightPress2?: () => void;
    // --- Other ---
    showBack?: boolean;
    showDrawer?: boolean;
    subtitle?: string;
    name?: string;
    showFilterDropdown?: boolean;
    filterTitle?: string;
    filterDropdownData?: FilterDropdownItem[];
    selectedFilter?: string;
    onFilterChange?: (filter: FilterDropdownItem | null) => void;
};

const AppHeader: FC<AppHeaderProps> = ({
    title = "",
    navigation,
    showRightIcon = false,
    rightIconName = "",
    rightIconLibrary = "MaterialIcon",
    onRightPress = () => {},
    showRightIcon2 = false,
    rightIconName2 = "",
    rightIconLibrary2 = "MaterialIcon",
    onRightPress2 = () => {},
    showBack = true,
    showDrawer = false,
    subtitle = "",
    name = "",
    showFilterDropdown = false,
    filterTitle = "",
    filterDropdownData = [],
    selectedFilter = "",
    onFilterChange = () => {},
}) => {
    const { colors, typography } = useTheme();
    const styles = getStyles(typography, colors);

    const RightIcon = rightIconLibrary ? iconLibraries[rightIconLibrary] : null;
    const RightIcon2 = rightIconLibrary2 ? iconLibraries[rightIconLibrary2] : null;

    const hasAnyRightIcon =
        (showRightIcon && RightIcon && rightIconName) ||
        (showRightIcon2 && RightIcon2 && rightIconName2);

    return (
        <View style={styles.headerContainer}>
            <View style={styles.headerContent}>
                {showDrawer && navigation.openDrawer ? (
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => navigation.openDrawer?.()}
                        activeOpacity={0.7}>
                        <FontAwesome
                            name="bars"
                            size={22}
                            color={colors.white}
                        />
                    </TouchableOpacity>
                ) : showBack ? (
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.7}>
                        <MaterialIcon
                            name="arrow-back"
                            size={22}
                            color={colors.white}
                        />
                    </TouchableOpacity>
                ) : (
                    <View style={styles.placeholder} />
                )}

                <View style={styles.titleContainer}>
                    {name ? (
                        <View style={styles.welcomeContainer}>
                            <Text
                                style={styles.welcomeText}
                                numberOfLines={2}
                                adjustsFontSizeToFit
                                minimumFontScale={0.7}>
                                Welcome,{" "}
                                <Text style={styles.nameText}>{name}!</Text>
                            </Text>
                            {subtitle && (
                                <Text
                                    style={styles.subtitleText}
                                    numberOfLines={1}>
                                    {subtitle}
                                </Text>
                            )}
                        </View>
                    ) : (
                        <Text
                            style={styles.headerText}
                            numberOfLines={1}
                            maxFontSizeMultiplier={1.2}>
                            {title}
                        </Text>
                    )}
                </View>

                <View style={styles.filterContainer}>
                    {showFilterDropdown && (
                        <EnhancedDropdown
                            data={filterDropdownData}
                            labelField="label"
                            valueField="value"
                            placeholder={filterTitle}
                            value={selectedFilter}
                            onChange={onFilterChange}
                            iconOnly
                            iconName="filter"
                            iconColor={colors.white}
                            iconSize={22}
                        />
                    )}
                </View>

                {hasAnyRightIcon ? (
                    <View style={styles.rightIconsContainer}>
                        {showRightIcon && RightIcon && rightIconName && (
                            <TouchableOpacity
                                onPress={onRightPress}
                                style={styles.iconButton}
                                activeOpacity={0.7}>
                                <RightIcon
                                    name={rightIconName}
                                    size={22}
                                    color={colors.white}
                                />
                            </TouchableOpacity>
                        )}
                        {showRightIcon2 && RightIcon2 && rightIconName2 && (
                            <TouchableOpacity
                                onPress={onRightPress2}
                                style={styles.iconButton}
                                activeOpacity={0.7}>
                                <RightIcon2
                                    name={rightIconName2}
                                    size={22}
                                    color={colors.white}
                                />
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <View style={styles.placeholder} />
                )}
            </View>
        </View>
    );
};

export default AppHeader;

const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        headerContainer: {
            backgroundColor: colors.primary,
        },
        headerContent: {
            width: "100%",
            minHeight: responsiveHeight(8),
            maxHeight: responsiveHeight(10),
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: responsiveWidth(4),
            paddingVertical: responsiveHeight(1.5),
        },
        titleContainer: {
            flex: 2,
            marginHorizontal: responsiveWidth(2),
            justifyContent: "center",
            minWidth: 0,
        },
        welcomeContainer: {
            width: "100%",
            alignItems: "flex-start",
        },
        headerText: {
            ...typography.h5,
            color: colors.white,
            textAlign: "left",
            fontWeight: "600",
        },
        filterContainer: {
            flex: 0,
            marginHorizontal: responsiveWidth(2),
            justifyContent: "center",
            minWidth: responsiveWidth(10),
        },
        welcomeText: {
            ...typography.h6,
            color: colors.white,
            textAlign: "left",
            fontWeight: "500",
            lineHeight: 22,
            flexShrink: 1,
            flexWrap: "wrap",
        },
        nameText: {
            color: colors.secondary,
            fontWeight: "700",
            textTransform: "capitalize",
        },
        subtitleText: {
            ...typography.caption,
            color: colors.white,
            opacity: 0.8,
            marginTop: 2,
            fontWeight: "400",
        },
        iconButton: {
            padding: responsiveWidth(2.5),
            borderRadius: responsiveWidth(6),
            alignItems: "center",
            justifyContent: "center",
            minWidth: responsiveWidth(10),
            minHeight: responsiveWidth(10),
        },
        placeholder: {
            width: responsiveWidth(10),
            height: responsiveWidth(10),
        },
        rightIconsContainer: {
            flexDirection: "row",
            alignItems: "center",
        },
    });
