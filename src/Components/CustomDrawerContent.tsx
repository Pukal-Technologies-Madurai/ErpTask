import React from "react";
import Icon from "react-native-vector-icons/Ionicons";
import MaterialIcon from "react-native-vector-icons/MaterialIcons";
import {
    View,
    Text,
    TouchableOpacity,
    StatusBar,
    StyleSheet,
    Alert,
} from "react-native";
import {
    DrawerContentScrollView,
    DrawerItemList,
    DrawerContentComponentProps,
} from "@react-navigation/drawer";
import { SafeAreaView } from "react-native-safe-area-context";
import { MMKV } from "react-native-mmkv";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../Navigation/types";
import { useTheme } from "../Context/ThemeContext";
import { responsiveWidth, responsiveHeight } from "../constants/helper";

const CustomDrawerContent: React.FC<DrawerContentComponentProps> = props => {
    const { colors, typography, mode } = useTheme();
    const styles = getStyles(typography, colors);
    const storage = new MMKV();
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const pkg = require("../../package.json");
    const appVersion = pkg.version || "1.0.0";

    const handleLogout = () => {
        Alert.alert("Confirm Logout", "Are you sure you want to logout?", [
            {
                text: "Cancel",
                style: "cancel",
            },
            {
                text: "Logout",
                style: "destructive",
                onPress: () => {
                    storage.clearAll();
                    navigation.reset({
                        index: 0,
                        routes: [{ name: "Login" }],
                    });
                },
            },
        ]);
    };

    return (
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
            <StatusBar
                barStyle="light-content"
                backgroundColor={colors.primary}
                translucent={false}
            />

            {/* Header with App Info Only */}
            <View style={styles.header}>
                {/* App Info */}
                <View style={styles.appInfo}>
                    <View style={styles.logoContainer}>
                        <Icon name="business" size={40} color={colors.white} />
                    </View>
                    <Text style={styles.appName}>Pukal Melanmai</Text>
                    <Text style={styles.version}>v{appVersion}</Text>
                </View>
            </View>

            {/* Navigation Menu */}
            <DrawerContentScrollView
                {...props}
                contentContainerStyle={styles.scrollView}
                showsVerticalScrollIndicator={false}
                style={styles.scrollContainer}>
                <View style={styles.menuContainer}>
                    <DrawerItemList {...props} />
                </View>
            </DrawerContentScrollView>

            {/* Footer Section */}
            <View style={styles.footer}>
                <View style={styles.footerDivider} />

                {/* Logout Button */}
                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleLogout}
                    activeOpacity={0.7}>
                    <Icon
                        name="log-out-outline"
                        size={20}
                        color={colors.white}
                    />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.primary,
        },
        scrollContainer: {
            flex: 1,
        },
        scrollView: {
            flexGrow: 1,
        },

        // Header Section
        header: {
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            paddingTop: responsiveHeight(1),
            paddingHorizontal: responsiveWidth(1.5),
        },
        appInfo: {
            alignItems: "center",
            justifyContent: "center",
        },
        logoContainer: {
            width: responsiveWidth(20),
            height: responsiveWidth(20),
            borderRadius: responsiveWidth(10),
            backgroundColor: colors.white + "20",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: responsiveHeight(2),
            borderWidth: 2,
            borderColor: colors.white + "30",
        },
        appName: {
            ...typography.h4,
            color: colors.white,
            fontWeight: "700",
            marginBottom: responsiveHeight(0.5),
            textAlign: "center",
        },
        version: {
            ...typography.body2,
            color: colors.white,
            opacity: 0.8,
            textAlign: "center",
        },

        // Menu Section
        menuContainer: {
            flex: 1,
            paddingTop: responsiveHeight(2),
            backgroundColor: colors.background,
        },

        // Footer Section
        footer: {
            backgroundColor: colors.background,
            paddingHorizontal: responsiveWidth(4),
            paddingBottom: responsiveHeight(1),
            paddingTop: responsiveHeight(2),
        },
        footerDivider: {
            height: 1,
            backgroundColor: colors.border || colors.textSecondary + "20",
            marginBottom: responsiveHeight(2),
        },
        logoutButton: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.accent,
            paddingVertical: responsiveHeight(1.5),
            paddingHorizontal: responsiveWidth(6),
            borderRadius: 12,
            elevation: 3,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
        },
        logoutText: {
            marginLeft: responsiveWidth(2),
            ...typography.body1,
            color: colors.white,
            fontWeight: "600",
        },
    });

export default CustomDrawerContent;
