import React, { useEffect, useState } from "react";
import {
    View,
    StyleSheet,
    ActivityIndicator,
    Image,
    Dimensions,
    Text,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { storage } from "./constants/storage";
import { useTheme } from "./Context/ThemeContext";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "./Navigation/types";

const SplashScreen = () => {
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { colors, typography } = useTheme();
    const styles = getStyles(colors, typography);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const token = storage.getString("userToken");
                await new Promise(resolve => setTimeout(resolve, 1200));
                setLoading(false);

                navigation.replace(token ? "MainDrawer" : "Login");
                // navigation.replace("MainDrawer");
            } catch (err) {
                console.error(err);
                setLoading(false);
                navigation.replace("Login");
            }
        })();
    }, [navigation]);

    return (
        <View style={styles.container}>
            <Image
                source={require("../assets/images/logo.png")}
                style={styles.logo}
            />
            <Text style={styles.title}>Pukal Melanmai</Text>
            {loading && (
                <ActivityIndicator
                    size="large"
                    color={colors.white}
                    style={styles.loader}
                />
            )}
        </View>
    );
};

const getStyles = (colors: any, typography: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: colors.primary,
            padding: 20,
        },
        logo: {
            width: Dimensions.get("window").width * 0.35,
            height: Dimensions.get("window").width * 0.35,
            marginBottom: 20,
        },
        title: {
            ...typography.h1,
            color: colors.white,
            fontStyle: "italic",
            marginBottom: 10,
        },
        loader: {
            marginTop: 20,
        },
    });

export default SplashScreen;
