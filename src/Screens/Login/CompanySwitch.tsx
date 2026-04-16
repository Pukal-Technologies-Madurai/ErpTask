import {
    StyleSheet,
    Text,
    View,
    ActivityIndicator,
    Alert,
    TouchableOpacity,
    ScrollView,
    ToastAndroid,
} from "react-native";
import React from "react";
import { storage } from "../../constants/storage";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import CheckBox from "@react-native-community/checkbox";
import CryptoJS from "react-native-crypto-js";
import { RootStackParamList } from "../../Navigation/types";
import { useTheme } from "../../Context/ThemeContext";
import { fetchCompanyInfo } from "../../Api/Login";
import { spacing, shadows } from "../../constants/helper";
import { API, baseurl } from "../../constants/api";
import AppHeader from "../../Components/AppHeader";

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

    const userName = storage.getString("userName") || "N/A";
    const password = storage.getString("password") || "";
    const name = storage.getString("name") || "N/A";
    const currentCompanyId = storage.getString("companyId");

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

    // Initialize selected company when data is loaded
    React.useEffect(() => {
        if (companyData.length > 0 && currentCompanyId) {
            const current = companyData.find(
                (company: CompanyData) =>
                    String(company.Global_Id) === currentCompanyId,
            );
            if (current) {
                setSelectedCompany(current);
            }
        }
    }, [companyData, currentCompanyId]);

    const handleCompanySelection = async (item: CompanyData) => {
        if (isSwitching) return; // Prevent multiple switches at once

        setSelectedCompany(item);
        setIsSwitching(true);

        try {
            const passHash = CryptoJS.AES.encrypt(
                password,
                "ly4@&gr$vnh905RyB>?%#@-(KSMT",
            ).toString();

            const response = await fetch(API.userPortalLogin(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    Global_User_ID: item.Global_User_ID,
                    username: userName,
                    Password: passHash,
                    Company_Name: item.Company_Name,
                    Global_Id: item.Global_Id,
                    Local_Id: item.Local_Id,
                    Web_Api: item.Web_Api,
                }),
            });

            const data = await response.json();
            // console.log("Selected company:", selectedCompany?.Company_Name);

            if (data.success) {
                baseurl(item.Web_Api);
                await getUserAuthToken(
                    data.data.Autheticate_Id,
                    item.Company_Name,
                );
            } else {
                throw new Error(data.message || "Login failed");
            }
        } catch (error: any) {
            console.error("Login Error: ", error);
            setIsSwitching(false);
            setSelectedCompany(null);
            Alert.alert(
                "Error",
                `Login failed: ${error.message || "Unknown error"}`,
            );
        }
    };

    const getUserAuthToken = async (token: any, companyName: string) => {
        try {
            // console.log("Getting user auth token with:", token);
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
            // console.log("User auth token response:", data);

            if (data.success) {
                const success = await updateStorage(data.data);

                if (success) {
                    ToastAndroid.show(
                        `Successfully switched to ${companyName}`,
                        ToastAndroid.LONG,
                    );
                    navigation.reset({
                        index: 0,
                        routes: [{ name: "MainDrawer" }],
                    });
                    // Alert.alert(
                    //     "Success",
                    //     `Successfully switched to ${companyName}`,
                    //     [
                    //         {
                    //             text: "OK",
                    //             onPress: () => {
                    //                 navigation.reset({
                    //                     index: 0,
                    //                     routes: [{ name: "MainDrawer" }],
                    //                 });
                    //             },
                    //         },
                    //     ],
                    // );
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
                onPress={() => refetch()}
            >
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
                        Hey 👋 {name}
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
                                ]}
                            >
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
                            <ScrollView style={styles.companiesList}>
                                {companyData.map((company: CompanyData) => (
                                    <TouchableOpacity
                                        key={company.Global_Id}
                                        style={[
                                            styles.companyItem,
                                            isSwitching &&
                                                styles.companyItemDisabled,
                                        ]}
                                        onPress={() =>
                                            !isSwitching &&
                                            handleCompanySelection(company)
                                        }
                                        disabled={isSwitching}
                                    >
                                        <CheckBox
                                            value={
                                                selectedCompany?.Global_Id ===
                                                    company.Global_Id ||
                                                (!selectedCompany &&
                                                    String(
                                                        company.Global_Id,
                                                    ) === currentCompanyId)
                                            }
                                            onValueChange={() =>
                                                !isSwitching &&
                                                handleCompanySelection(company)
                                            }
                                            disabled={isSwitching}
                                            tintColors={{
                                                true: colors.primary,
                                                false: colors.grey400,
                                            }}
                                            style={styles.checkbox}
                                        />
                                        <View
                                            style={styles.companyNameContainer}
                                        >
                                            <Text
                                                style={[
                                                    typography.body1,
                                                    styles.companyName,
                                                    (selectedCompany?.Global_Id ===
                                                        company.Global_Id ||
                                                        (!selectedCompany &&
                                                            String(
                                                                company.Global_Id,
                                                            ) ===
                                                                currentCompanyId)) &&
                                                        styles.selectedCompanyItemText,
                                                ]}
                                            >
                                                {company.Company_Name}
                                            </Text>
                                            {selectedCompany?.Global_Id ===
                                                company.Global_Id &&
                                                isSwitching && (
                                                    <ActivityIndicator
                                                        size="small"
                                                        color={colors.primary}
                                                        style={
                                                            styles.loadingIndicator
                                                        }
                                                    />
                                                )}
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {companyData.length === 0 && (
                                <Text
                                    style={[
                                        typography.body2,
                                        styles.noDataText,
                                    ]}
                                >
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
        companiesList: {
            maxHeight: 300,
            marginBottom: spacing.sm,
        },
        companyItem: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.xs,
            borderBottomWidth: 1,
            borderBottomColor: colors.grey200,
        },
        checkbox: {
            marginRight: spacing.sm,
        },
        companyName: {
            flex: 1,
            color: colors.text,
        },
        selectedCompanyItemText: {
            color: colors.primary,
            fontWeight: "600",
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
        companyNameContainer: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        },
        loadingIndicator: {
            marginLeft: spacing.sm,
        },
        companyItemDisabled: {
            opacity: 0.6,
        },
    });
