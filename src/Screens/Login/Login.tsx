import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    ToastAndroid,
    TouchableOpacity,
    ActivityIndicator,
    View,
    FlatList,
    Modal,
} from "react-native";
import React, { useState } from "react";
import { storage } from "../../constants/storage";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import CryptoJS from "react-native-crypto-js";
import Icon from "react-native-vector-icons/Feather";
import { API, baseurl } from "../../constants/api";
import { RootStackParamList } from "../../Navigation/types";
import { useTheme } from "../../Context/ThemeContext";

// Define the company data interface
interface CompanyData {
    Company_Name: string;
    Local_Id: string;
    Global_Id: number;
    Web_Api: string;
    Global_User_ID: string;
}

const LoginScreen = () => {
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { colors, typography } = useTheme();
    const styles = getStyles(colors, typography);

    const [companies, setCompanies] = useState<CompanyData[]>([]);
    const [selectedCompany, setSelectedCompany] = useState<CompanyData | null>(
        null,
    );
    const [step, setStep] = useState(1);
    const [modalVisible, setModalVisible] = useState(false);

    const [form, setForm] = useState({
        username: "",
        password: "",
    });
    const [isSubmitting, setSubmitting] = useState(false);

    const handleContinue = async () => {
        try {
            console.log("login", `${API.userPortal()}${form.username}`);
            const response = await fetch(`${API.userPortal()}${form.username}`);
            const jsonData = await response.json();

            if (jsonData.success && jsonData.data) {
                const companies: CompanyData[] = jsonData.data;
                setCompanies(companies);

                if (companies.length === 1) {
                    setSelectedCompany(companies[0]);
                    setStep(2);
                } else {
                    setStep(2);
                }
            } else {
                ToastAndroid.show(jsonData.message, ToastAndroid.LONG);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleCompanySelect = (company: CompanyData) => {
        setSelectedCompany(company);
        setModalVisible(false);
    };

    const handleLogin = async () => {
        if (!selectedCompany) {
            ToastAndroid.show("Please select a company", ToastAndroid.LONG);
            return;
        }
        const { username, password } = form;
        setSubmitting(true);

        try {
            const passHash = CryptoJS.AES.encrypt(
                password,
                "ly4@&gr$vnh905RyB>?%#@-(KSMT",
            ).toString();

            const response = await fetch(API.userPortalLogin(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    Global_User_ID: selectedCompany?.Global_User_ID,
                    username: username,
                    Password: passHash,
                    Company_Name: selectedCompany?.Company_Name,
                    Global_Id: selectedCompany?.Global_Id,
                    Local_Id: selectedCompany?.Local_Id,
                    Web_Api: selectedCompany?.Web_Api,
                }),
            });

            const data = await response.json();
            console.log("data:", data);

            if (data.success) {
                getUserAuth(
                    data.data.Autheticate_Id,
                    selectedCompany?.Web_Api || "",
                );
                storage.set("password", password);
            } else {
                ToastAndroid.show(data.message, ToastAndroid.LONG);
            }
        } catch (error: any) {
            console.error("Login Error: ", error);
            ToastAndroid.show(error.message, ToastAndroid.LONG);
        } finally {
            setSubmitting(false);
        }
    };

    const getUserAuth = async (userAuth: string, webApi: string) => {
        try {
            baseurl(webApi);
            const url = `${API.getUserAuthMob()}`;
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    Authorization: `${userAuth}`,
                },
            });

            const data = await response.json();

            if (data.success) {
                const authData = data.user;

                storage.set("userToken", authData.Autheticate_Id);

                await userData(authData);
                setForm({ username: "", password: "" });
                ToastAndroid.show(data.message, ToastAndroid.LONG);
                navigation.replace("MainDrawer");
            } else {
                ToastAndroid.show(data.message, ToastAndroid.LONG);
            }
        } catch (error) {
            console.error("Error fetching user auth data: ", error);
        }
    };

    const userData = async (data: any) => {
        try {
            storage.set("userId", data.UserId);
            storage.set("companyId", String(data.Company_id));
            storage.set("companyName", data.Company_Name);
            storage.set("userName", data.UserName);
            storage.set("name", data.Name);
            storage.set("userType", data.UserType);
            storage.set("branchId", String(data.BranchId));
            storage.set("branchName", data.BranchName);
            storage.set("userType", data.UserType);
            storage.set("userTypeId", data.UserTypeId);
            storage.set("authenticateId", data.Autheticate_Id);
            if (selectedCompany?.Web_Api) {
                storage.set("webApi", selectedCompany.Web_Api);
            }
        } catch (e) {
            console.error("Error storing data: ", e);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
        >
            <View style={styles.topBackground} />

            <View style={styles.formContainer}>
                <View style={styles.loginContainer}>
                    <Text style={styles.loginTitle}>
                        {step === 1 ? "Welcome" : "Login"}
                    </Text>
                    <Text style={styles.loginSubtitle}>
                        {step === 1
                            ? "Enter your username to continue"
                            : "Complete your login details"}
                    </Text>
                </View>

                {step === 1 && (
                    <View style={{ width: "100%" }}>
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your username"
                                placeholderTextColor={colors.textSecondary}
                                value={form.username}
                                onChangeText={text =>
                                    setForm({ ...form, username: text })
                                }
                                autoCapitalize="none"
                            />
                        </View>

                        <TouchableOpacity
                            onPress={handleContinue}
                            style={styles.button}
                        >
                            <Text style={styles.buttonText}>Continue</Text>
                            <Icon
                                name="arrow-right"
                                size={20}
                                color={colors.white}
                            />
                        </TouchableOpacity>
                    </View>
                )}

                {step === 2 && (
                    <View style={{ width: "100%" }}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.input}>Username</Text>
                            <Text style={styles.input}>{form.username}</Text>
                        </View>

                        {companies.length > 1 && (
                            <TouchableOpacity
                                onPress={() => setModalVisible(true)}
                                style={styles.selectButton}
                            >
                                <Text style={styles.selectButtonText}>
                                    {selectedCompany
                                        ? selectedCompany.Company_Name
                                        : "Select your company"}
                                </Text>
                                <Icon
                                    name="chevron-down"
                                    size={20}
                                    color={colors.text}
                                />
                            </TouchableOpacity>
                        )}

                        {selectedCompany && (
                            <>
                                <View style={styles.inputContainer}>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter your password"
                                        placeholderTextColor={
                                            colors.textSecondary
                                        }
                                        value={form.password}
                                        onChangeText={text =>
                                            setForm({ ...form, password: text })
                                        }
                                        secureTextEntry
                                    />
                                </View>

                                <TouchableOpacity
                                    onPress={handleLogin}
                                    style={styles.button}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <ActivityIndicator
                                            color={colors.white}
                                        />
                                    ) : (
                                        <>
                                            <Text style={styles.buttonText}>
                                                Login
                                            </Text>
                                            <Icon
                                                name="log-in"
                                                size={20}
                                                color={colors.white}
                                            />
                                        </>
                                    )}
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                )}
            </View>

            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalView}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalSelectHeading}>
                                Select Company
                            </Text>
                            <TouchableOpacity
                                onPress={() => setModalVisible(false)}
                            >
                                <Icon name="x" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={companies}
                            keyExtractor={(item: CompanyData) =>
                                item.Global_Id.toString()
                            }
                            renderItem={({ item }: { item: CompanyData }) => (
                                <TouchableOpacity
                                    onPress={() => handleCompanySelect(item)}
                                    style={styles.item}
                                >
                                    <Text style={styles.itemText}>
                                        {item.Company_Name}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            showsVerticalScrollIndicator={false}
                        />
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
};

export default LoginScreen;

const getStyles = (colors: any, typography: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        topBackground: {
            position: "absolute",
            top: 0,
            right: 0,
            width: "80%",
            height: "30%",
            backgroundColor: colors.primary,
            borderBottomLeftRadius: 100,
            opacity: 0.1,
        },
        formContainer: {
            flex: 1,
            padding: 24,
            justifyContent: "center",
        },
        loginContainer: {
            marginBottom: 40,
        },
        loginTitle: {
            ...typography.h1,
            marginBottom: 8,
        },
        loginSubtitle: {
            ...typography.body1,
        },
        inputContainer: {
            backgroundColor: colors.secondary,
            borderRadius: 12,
            marginBottom: 16,
            overflow: "hidden",
        },
        input: {
            paddingHorizontal: 20,
            paddingVertical: 16,
            fontSize: 16,
            color: colors.text,
        },
        button: {
            backgroundColor: colors.primary,
            borderRadius: 12,
            padding: 16,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
        },
        buttonText: {
            ...typography.button,
            marginRight: 8,
        },
        selectButton: {
            backgroundColor: colors.secondary,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        },
        selectButtonText: {
            ...typography.body1,
        },
        modalView: {
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.5)",
        },
        modalContainer: {
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            maxHeight: "80%",
        },
        modalHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
        },
        modalSelectHeading: {
            ...typography.h3,
        },
        item: {
            padding: 16,
            borderRadius: 12,
            backgroundColor: colors.secondary,
            marginBottom: 8,
        },
        itemText: {
            ...typography.body1,
        },
    });
