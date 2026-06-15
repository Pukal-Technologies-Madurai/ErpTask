import React from "react";
import Icon from "react-native-vector-icons/Ionicons";
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
import { storage } from "../constants/storage";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../Navigation/types";
import { useTheme } from "../Context/ThemeContext";
import { responsiveWidth, responsiveHeight } from "../constants/helper";

const CustomDrawerContent: React.FC<DrawerContentComponentProps> = props => {
    const { colors, typography } = useTheme();
    const styles = getStyles(typography, colors);
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

            <View style={styles.header}>
                <View style={styles.brandBadge}>
                    <View style={styles.logoContainer}>
                        <Icon name="cube" size={32} color={colors.white} />
                    </View>

                    <View style={styles.appInfo}>
                        <Text style={styles.appName}>Pukal Melanmai</Text>
                        <Text style={styles.version}>ERP Workspace</Text>
                    </View>

                    <View style={styles.versionTag}>
                        <Text style={styles.versionTagText}>v{appVersion}</Text>
                    </View>
                </View>
            </View>

            <DrawerContentScrollView
                {...props}
                contentContainerStyle={styles.scrollView}
                showsVerticalScrollIndicator={false}
                style={styles.scrollContainer}
            >
                <View style={styles.menuContainer}>
                    <Text style={styles.sectionTitle}>Main Menu</Text>
                    <DrawerItemList {...props} />
                </View>
            </DrawerContentScrollView>

            <View style={styles.footer}>
                <View style={styles.footerDivider} />
                <Text style={styles.footerHint}>You are signed in on this device</Text>
                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleLogout}
                    activeOpacity={0.7}
                >
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
            backgroundColor: colors.background,
        },
        scrollView: {
            flexGrow: 1,
            paddingBottom: responsiveHeight(2),
        },

        header: {
            backgroundColor: colors.primary,
            paddingTop: responsiveHeight(1.2),
            paddingHorizontal: responsiveWidth(4),
            paddingBottom: responsiveHeight(1.6),
        },
        brandBadge: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.white + "18",
            borderRadius: 16,
            paddingHorizontal: responsiveWidth(3),
            paddingVertical: responsiveHeight(1.3),
            borderWidth: 1,
            borderColor: colors.white + "30",
        },
        logoContainer: {
            width: responsiveWidth(13),
            height: responsiveWidth(13),
            borderRadius: responsiveWidth(6.5),
            backgroundColor: colors.white + "22",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.white + "35",
            marginRight: responsiveWidth(3),
        },
        appInfo: {
            flex: 1,
        },
        appName: {
            ...typography.h5,
            color: colors.white,
            fontWeight: "700",
        },
        version: {
            ...typography.body2,
            color: colors.white,
            opacity: 0.9,
            marginTop: responsiveHeight(0.2),
        },
        versionTag: {
            backgroundColor: colors.white + "24",
            borderRadius: 999,
            paddingHorizontal: responsiveWidth(2.2),
            paddingVertical: responsiveHeight(0.4),
            borderWidth: 1,
            borderColor: colors.white + "35",
        },
        versionTagText: {
            ...typography.caption,
            color: colors.white,
            fontWeight: "600",
        },

        menuContainer: {
            flex: 1,
            paddingTop: responsiveHeight(1.8),
            backgroundColor: colors.background,
            paddingHorizontal: responsiveWidth(1.6),
        },
        sectionTitle: {
            ...typography.overline,
            color: colors.textSecondary,
            letterSpacing: 1,
            textTransform: "uppercase",
            marginLeft: responsiveWidth(3),
            marginBottom: responsiveHeight(0.8),
            opacity: 0.9,
        },

        footer: {
            backgroundColor: colors.background,
            paddingHorizontal: responsiveWidth(4),
            paddingBottom: responsiveHeight(1),
            paddingTop: responsiveHeight(1.2),
        },
        footerDivider: {
            height: 1,
            backgroundColor: colors.borderColor || colors.textSecondary + "20",
            marginBottom: responsiveHeight(1.4),
        },
        footerHint: {
            ...typography.caption,
            color: colors.textSecondary,
            marginBottom: responsiveHeight(1.2),
        },
        logoutButton: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.accent,
            paddingVertical: responsiveHeight(1.4),
            paddingHorizontal: responsiveWidth(6),
            borderRadius: 14,
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
            fontWeight: "700",
        },
    });

export default CustomDrawerContent;
