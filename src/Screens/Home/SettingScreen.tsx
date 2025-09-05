import {
    StyleSheet,
    Text,
    View,
    Switch,
    TouchableOpacity,
    ScrollView,
} from "react-native";
import React from "react";
import { useTheme } from "../../Context/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import { RootStackParamList } from "../../Navigation/types";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AppHeader from "../../Components/AppHeader";
import { SafeAreaView } from "react-native-safe-area-context";

const SettingScreen = () => {
    const { colors, typography, mode, toggleTheme } = useTheme();
    const styles = getStyles(typography, colors);
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const pkg = require("../../../package.json");
    const appVersion = pkg.version || "1.0.0";

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <AppHeader
                title="Settings"
                showDrawer={true}
                navigation={navigation}
            />
            <View style={styles.contentContainer}>
                {/* Header Section */}
                <View style={styles.headerSection}>
                    <Text style={styles.subtitle}>
                        Customize your app experience
                    </Text>
                </View>

                {/* Theme Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Appearance</Text>
                    <View style={styles.settingItem}>
                        <View style={styles.settingContent}>
                            <Text style={styles.settingLabel}>Dark Mode</Text>
                            <Text style={styles.settingDescription}>
                                Switch between light and dark themes
                            </Text>
                        </View>
                        <Switch
                            value={mode === "dark"}
                            onValueChange={toggleTheme}
                            trackColor={{
                                false: colors.grey,
                                true: colors.primary,
                            }}
                            thumbColor={
                                mode === "dark" ? colors.accent : colors.white
                            }
                            ios_backgroundColor={colors.grey}
                        />
                    </View>
                </View>

                {/* Profile Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <TouchableOpacity
                        style={styles.settingItem}
                        onPress={() => navigation.navigate("profile")}>
                        <View style={styles.settingContent}>
                            <Text style={styles.settingLabel}>Profile</Text>
                            <Text style={styles.settingDescription}>
                                View your profile information
                            </Text>
                        </View>
                        <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                </View>

                {/* About Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>About</Text>
                    <View style={styles.settingItem}>
                        <View style={styles.settingContent}>
                            <Text style={styles.settingLabel}>App Version</Text>
                            <Text style={styles.settingDescription}>
                                {appVersion}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        Current Theme: {mode === "dark" ? "Dark" : "Light"} Mode
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
};

export default SettingScreen;

const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.primary,
        },
        contentContainer: {
            backgroundColor: colors.background,
        },
        headerSection: {
            padding: 20,
            paddingBottom: 10,
        },
        title: {
            ...typography.h2,
            color: colors.text,
            marginBottom: 8,
        },
        subtitle: {
            ...typography.body1,
            color: colors.textSecondary,
        },
        section: {
            marginVertical: 8,
            backgroundColor: colors.secondary,
            marginHorizontal: 16,
            borderRadius: 12,
            paddingVertical: 8,
        },
        sectionTitle: {
            ...typography.h6,
            color: colors.text,
            marginHorizontal: 16,
            marginVertical: 12,
            fontWeight: "600",
        },
        settingItem: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderColor,
        },
        settingContent: {
            flex: 1,
            marginRight: 16,
        },
        settingLabel: {
            ...typography.h6,
            color: colors.text,
            marginBottom: 4,
        },
        settingDescription: {
            ...typography.body2,
            color: colors.textSecondary,
            lineHeight: 18,
        },
        chevron: {
            ...typography.h4,
            color: colors.textSecondary,
            fontWeight: "300",
        },
        footer: {
            padding: 20,
            alignItems: "center",
            marginTop: 20,
        },
        footerText: {
            ...typography.caption,
            color: colors.textSecondary,
            textAlign: "center",
        },
    });
