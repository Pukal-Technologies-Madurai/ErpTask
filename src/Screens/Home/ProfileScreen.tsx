import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    Alert,
} from "react-native";
import React from "react";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MMKV } from "react-native-mmkv";
import Icon from "react-native-vector-icons/MaterialIcons";
import AppHeader from "../../Components/AppHeader";
import { useTheme } from "../../Context/ThemeContext";
import { RootStackParamList } from "../../Navigation/types";
import { SafeAreaView } from "react-native-safe-area-context";

const ProfileScreen = () => {
    const { colors, typography } = useTheme();
    const styles = getStyles(typography, colors);
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const storage = new MMKV();

    // Get user data from storage
    const userName = storage.getString("userName") || "N/A";
    const companyName = storage.getString("companyName") || "N/A";
    const branchName = storage.getString("branchName") || "N/A";
    const userType = storage.getString("userType") || "N/A";
    const name = storage.getString("name") || "N/A";

    const handleLogout = () => {
        Alert.alert("Logout", "Are you sure you want to logout?", [
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

    const ProfileItem = ({
        icon,
        label,
        value,
    }: {
        icon: string;
        label: string;
        value: string;
    }) => (
        <View style={styles.profileItem}>
            <View style={styles.profileItemLeft}>
                <View style={styles.iconContainer}>
                    <Icon name={icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.label}>{label}</Text>
                    <Text style={styles.value}>{value}</Text>
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader title="Profile" navigation={navigation} />

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}>
                {/* Profile Header */}
                <View style={styles.profileHeader}>
                    <View style={styles.avatarContainer}>
                        <Icon name="person" size={48} color={colors.white} />
                    </View>
                    <Text style={styles.profileName}>{name}</Text>
                    <Text style={styles.profileRole}>{userType}</Text>
                </View>

                <View style={styles.profileSection}>
                    <Text style={styles.sectionTitle}>
                        Personal Information
                    </Text>

                    <ProfileItem
                        icon="person-outline"
                        label="Full Name"
                        value={name}
                    />

                    <ProfileItem
                        icon="account-circle"
                        label="Username"
                        value={userName}
                    />

                    <ProfileItem
                        icon="work-outline"
                        label="User Type"
                        value={userType}
                    />
                </View>

                <View style={styles.profileSection}>
                    <Text style={styles.sectionTitle}>Company Information</Text>

                    <ProfileItem
                        icon="business"
                        label="Company Name"
                        value={companyName}
                    />

                    <ProfileItem
                        icon="location-on"
                        label="Branch Name"
                        value={branchName}
                    />
                </View>

                <View style={styles.actionSection}>
                    <TouchableOpacity
                        style={styles.logoutButton}
                        onPress={handleLogout}
                        activeOpacity={0.8}>
                        <Icon name="logout" size={20} color={colors.white} />
                        <Text style={styles.logoutButtonText}>Logout</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default ProfileScreen;

const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.primary,
        },
        scrollView: {
            flex: 1,
            backgroundColor: colors.background,
        },
        profileHeader: {
            backgroundColor: colors.background,
            paddingVertical: 30,
            paddingHorizontal: 20,
            alignItems: "center",
            marginBottom: 20,
        },
        avatarContainer: {
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: colors.accent,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 16,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 6,
            elevation: 8,
        },
        profileName: {
            ...typography.h4,
            color: colors.text,
            fontWeight: "700",
            marginBottom: 4,
            textAlign: "center",
        },
        profileRole: {
            ...typography.body1,
            color: colors.textSecondary,
            opacity: 0.9,
            textTransform: "capitalize",
        },
        profileSection: {
            backgroundColor: colors.secondary,
            marginHorizontal: 16,
            marginBottom: 16,
            borderRadius: 12,
            paddingVertical: 16,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        sectionTitle: {
            ...typography.h6,
            color: colors.text,
            marginHorizontal: 16,
            marginBottom: 12,
            fontWeight: "600",
        },
        profileItem: {
            marginHorizontal: 16,
            marginBottom: 12,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderColor,
        },
        profileItemLeft: {
            flexDirection: "row",
            alignItems: "center",
        },
        iconContainer: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.primary + "20",
            justifyContent: "center",
            alignItems: "center",
            marginRight: 12,
        },
        textContainer: {
            flex: 1,
        },
        label: {
            ...typography.caption,
            color: colors.textSecondary,
            marginBottom: 2,
            fontWeight: "500",
        },
        value: {
            ...typography.body1,
            color: colors.text,
            fontWeight: "600",
        },
        actionSection: {
            paddingHorizontal: 16,
            paddingVertical: 20,
            gap: 12,
        },
        editButton: {
            backgroundColor: colors.primary,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 14,
            borderRadius: 8,
            gap: 8,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 4,
        },
        editButtonText: {
            ...typography.button,
            color: colors.white,
            fontWeight: "600",
        },
        logoutButton: {
            backgroundColor: colors.accent,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 14,
            borderRadius: 8,
            gap: 8,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 4,
        },
        logoutButtonText: {
            ...typography.button,
            color: colors.white,
            fontWeight: "600",
        },
    });
