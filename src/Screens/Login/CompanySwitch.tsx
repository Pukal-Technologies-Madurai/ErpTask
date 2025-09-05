import {
    StyleSheet,
    Text,
    View,
    ActivityIndicator,
    Alert,
    TouchableOpacity,
} from "react-native";
import React from "react";
import { MMKV } from "react-native-mmkv";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import CryptoJS from "react-native-crypto-js";
import { RootStackParamList } from "../../Navigation/types";
import { useTheme } from "../../Context/ThemeContext";
import { fetchCompanyInfo } from "../../Api/Login";
import { spacing, shadows } from "../../constants/helper";
import { API, baseurl } from "../../constants/api";
import AppHeader from "../../Components/AppHeader";
import EnhancedDropdown from "../../Components/EnhancedDropdown";
import { SafeAreaView } from "react-native-safe-area-context";

interface CompanyData {
    Company_Name: string;
    Local_Id: string;
    Global_Id: number;
    Web_Api: string;
    Global_User_ID: string;
}

const CompanySwitch = () => {
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { colors, typography } = useTheme();
    const styles = getStyles(colors, typography);
    const storage = new MMKV();

    const userName = storage.getString("userName") || "N/A";
    const password = storage.getString("password") || "";

    const companyName =
        storage.getString("companyName") || "No Company Selected";

    const [selectedCompany, setSelectedCompany] =
        React.useState<CompanyData | null>(null);
    const [isSwitching, setIsSwitching] = React.useState(false);

    const {
        data: companyData = [],
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ["companyInfo", userName],
        queryFn: () => fetchCompanyInfo(userName),
        enabled: !!userName,
    });

    const handleCompanySelection = (item: CompanyData) => {
        setSelectedCompany(item);
    };

    const handleLogin = async () => {
        if (!selectedCompany) {
            Alert.alert("Error", "No company selected");
            return;
        }

        try {
            setIsSwitching(true);

            const passHash = CryptoJS.AES.encrypt(
                password,
                "ly4@&gr$vnh905RyB>?%#@-(KSMT",
            ).toString();

            const response = await fetch(API.userPortalLogin(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    Global_User_ID: selectedCompany.Global_User_ID,
                    username: userName,
                    Password: passHash,
                    Company_Name: selectedCompany.Company_Name,
                    Global_Id: selectedCompany.Global_Id,
                    Local_Id: selectedCompany.Local_Id,
                    Web_Api: selectedCompany.Web_Api,
                }),
            });

            const data = await response.json();

            if (data.success) {
                baseurl(selectedCompany.Web_Api);
                await getUserAuthToken(data.data.Autheticate_Id);
            } else {
                throw new Error(data.message || "Login failed");
            }
        } catch (error: any) {
            console.error("Login Error: ", error);
            setIsSwitching(false);
            Alert.alert(
                "Error",
                `Login failed: ${error.message || "Unknown error"}`,
            );
        }
    };

    const getUserAuthToken = async (token: any) => {
        try {
            console.log("Getting user auth token with:", token);
            const url = `${API.getUserAuthInfo()}`;

            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `${token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log("User auth token response:", data);

            if (data.success) {
                const success = await updateStorage(data.data);

                if (success) {
                    Alert.alert(
                        "Success",
                        `Successfully switched to ${selectedCompany?.Company_Name}`,
                        [
                            {
                                text: "OK",
                                onPress: () => {
                                    navigation.reset({
                                        index: 0,
                                        routes: [{ name: "MainDrawer" }],
                                    });
                                },
                            },
                        ],
                    );
                }

                return data.data;
            } else {
                throw new Error(
                    data.message || "Failed to get user auth token",
                );
            }
        } catch (err) {
            console.error("GetUserAuthToken Error: ", err);
            setIsSwitching(false);
            const errorMessage =
                err instanceof Error ? err.message : "Unknown error";
            Alert.alert(
                "Error",
                `Failed to get user information: ${errorMessage}`,
            );
            throw err;
        }
    };

    const handleSubmitCompanySwitch = async () => {
        if (!selectedCompany) {
            Alert.alert("Error", "Please select a company first");
            return;
        }

        await handleLogin();
    };

    const updateStorage = async (data: any) => {
        try {
            // Validate that we have the required data
            if (!data || (Array.isArray(data) && data.length === 0)) {
                throw new Error("No user data received");
            }

            // Handle both array and object responses
            const userInfo = Array.isArray(data) ? data[0] : data;

            // Update user information in storage
            if (userInfo.UserId) storage.set("userId", String(userInfo.UserId));
            if (userInfo.Company_id)
                storage.set("companyId", String(userInfo.Company_id));
            if (userInfo.Company_Name)
                storage.set("companyName", userInfo.Company_Name);
            if (userInfo.UserName) storage.set("userName", userInfo.UserName);
            if (userInfo.Name) storage.set("name", userInfo.Name);
            if (userInfo.UserType) storage.set("userType", userInfo.UserType);
            if (userInfo.BranchId)
                storage.set("branchId", String(userInfo.BranchId));
            if (userInfo.BranchName)
                storage.set("branchName", userInfo.BranchName);
            if (userInfo.UserTypeId)
                storage.set("userTypeId", String(userInfo.UserTypeId));
            if (userInfo.Autheticate_Id)
                storage.set("authenticateId", userInfo.Autheticate_Id);

            // Store selected company information
            if (selectedCompany) {
                storage.set("webApi", selectedCompany.Web_Api);
                storage.set("localId", selectedCompany.Local_Id);
                storage.set("globalUserId", selectedCompany.Global_User_ID);
                storage.set("globalId", String(selectedCompany.Global_Id));
            }

            setIsSwitching(false);
            return true;
        } catch (error) {
            setIsSwitching(false);
            const errorMessage =
                error instanceof Error ? error.message : "Unknown error";
            Alert.alert(
                "Error",
                `Failed to update user information: ${errorMessage}`,
            );
            return false;
        }
    };

    const renderLoadingState = () => (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[typography.body1, styles.loadingText]}>
                Loading companies...
            </Text>
        </View>
    );

    const renderErrorState = () => (
        <View style={styles.errorContainer}>
            <Text style={[typography.h6, styles.errorTitle]}>
                Unable to load companies
            </Text>
            <Text style={[typography.body2, styles.errorMessage]}>
                {error?.message || "An unexpected error occurred"}
            </Text>
            <Text
                style={[typography.button, styles.retryButton]}
                onPress={() => refetch()}>
                Tap to retry
            </Text>
        </View>
    );

    if (userName === "N/A") {
        return (
            <View style={styles.container}>
                <AppHeader title="Company Switch" navigation={navigation} />
                <View style={styles.errorContainer}>
                    <Text style={[typography.h6, styles.errorTitle]}>
                        No User Found
                    </Text>
                    <Text style={[typography.body2, styles.errorMessage]}>
                        Please log in first to switch companies
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader title="Company Switch" navigation={navigation} />

            <View style={styles.content}>
                {/* Welcome Section */}
                <View style={styles.welcomeSection}>
                    <Text style={[typography.h5, styles.welcomeText]}>
                        Hey 👋 {userName}
                    </Text>
                    <Text style={[typography.body1, styles.currentCompanyText]}>
                        Currently in:{" "}
                        <Text style={styles.currentCompanyName}>
                            {companyName}
                        </Text>
                    </Text>
                    {selectedCompany &&
                        selectedCompany.Company_Name !== companyName && (
                            <Text
                                style={[
                                    typography.body2,
                                    styles.switchingToText,
                                ]}>
                                Switching to:{" "}
                                <Text style={styles.selectedCompanyName}>
                                    {selectedCompany.Company_Name}
                                </Text>
                            </Text>
                        )}
                </View>

                {/* Company Selection Section */}
                <View style={styles.selectionSection}>
                    <Text style={[typography.h6, styles.sectionTitle]}>
                        Switch to Different Company
                    </Text>

                    {isLoading ? (
                        renderLoadingState()
                    ) : error ? (
                        renderErrorState()
                    ) : (
                        <View style={styles.dropdownContainer}>
                            <EnhancedDropdown
                                data={companyData}
                                labelField="Company_Name"
                                valueField="Global_Id"
                                placeholder="Select a company to switch"
                                value={selectedCompany?.Global_Id}
                                onChange={handleCompanySelection}
                                containerStyle={styles.dropdown}
                                searchPlaceholder="Search companies..."
                            />

                            <TouchableOpacity
                                style={[
                                    styles.switchButton,
                                    (!selectedCompany || isSwitching) &&
                                        styles.switchButtonDisabled,
                                ]}
                                onPress={handleSubmitCompanySwitch}
                                disabled={!selectedCompany || isSwitching}>
                                {isSwitching ? (
                                    <View style={styles.switchButtonLoading}>
                                        <ActivityIndicator
                                            size="small"
                                            color={colors.white}
                                            style={{ marginRight: spacing.xs }}
                                        />
                                        <Text
                                            style={[
                                                typography.button,
                                                styles.switchButtonText,
                                            ]}>
                                            Switching...
                                        </Text>
                                    </View>
                                ) : (
                                    <Text
                                        style={[
                                            typography.button,
                                            styles.switchButtonText,
                                            !selectedCompany &&
                                                styles.switchButtonTextDisabled,
                                        ]}>
                                        {selectedCompany
                                            ? `Switch to ${selectedCompany.Company_Name}`
                                            : "Select a Company"}
                                    </Text>
                                )}
                            </TouchableOpacity>

                            {companyData.length === 0 && (
                                <Text
                                    style={[
                                        typography.body2,
                                        styles.noDataText,
                                    ]}>
                                    No companies available for this user
                                </Text>
                            )}
                        </View>
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
};

export default CompanySwitch;

const getStyles = (colors: any, typography: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.primary,
        },
        content: {
            flex: 1,
            padding: spacing.md,
            backgroundColor: colors.background,
        },
        welcomeSection: {
            backgroundColor: colors.white,
            padding: spacing.lg,
            borderRadius: 12,
            marginBottom: spacing.lg,
            ...shadows.small,
        },
        welcomeText: {
            marginBottom: spacing.xs,
            color: colors.text,
        },
        currentCompanyText: {
            color: colors.textSecondary,
        },
        currentCompanyName: {
            color: colors.text,
            fontWeight: "600",
        },
        switchingToText: {
            color: colors.textSecondary,
            marginTop: spacing.xs,
        },
        selectedCompanyName: {
            color: colors.primary,
            fontWeight: "600",
        },
        selectionSection: {
            backgroundColor: colors.white,
            padding: spacing.lg,
            borderRadius: 12,
            ...shadows.small,
        },
        sectionTitle: {
            marginBottom: spacing.md,
            color: colors.text,
        },
        dropdownContainer: {
            marginTop: spacing.sm,
        },
        dropdown: {
            marginBottom: spacing.sm,
        },
        loadingContainer: {
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: spacing.xl,
        },
        loadingText: {
            marginTop: spacing.sm,
            color: colors.textSecondary,
        },
        errorContainer: {
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: spacing.xl,
            paddingHorizontal: spacing.lg,
        },
        errorTitle: {
            color: colors.error,
            marginBottom: spacing.xs,
            textAlign: "center",
        },
        errorMessage: {
            color: colors.textSecondary,
            textAlign: "center",
            marginBottom: spacing.md,
        },
        retryButton: {
            color: colors.primary,
            backgroundColor: colors.secondary,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderRadius: 8,
            textAlign: "center",
        },
        noDataText: {
            color: colors.textSecondary,
            textAlign: "center",
            fontStyle: "italic",
            marginTop: spacing.sm,
        },
        switchButton: {
            backgroundColor: colors.primary,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderRadius: 8,
            alignItems: "center",
            marginTop: spacing.md,
            ...shadows.small,
        },
        switchButtonDisabled: {
            backgroundColor: colors.grey400,
            opacity: 0.6,
        },
        switchButtonText: {
            color: colors.white,
            fontWeight: "bold",
        },
        switchButtonTextDisabled: {
            color: colors.grey600,
        },
        switchButtonLoading: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
        },
    });
