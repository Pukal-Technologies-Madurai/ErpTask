import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Platform } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import Home from "../Screens/Home/Home";
import SettingScreen from "../Screens/Home/SettingScreen";
import AttendanceInfo from "../Screens/Home/AttendanceInfo";
import OpeningStock from "../Screens/Home/OpeningStock";
import { useTheme } from "../Context/ThemeContext";
import { BottomTabParamList } from "../Navigation/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BottomTab = createBottomTabNavigator<BottomTabParamList>();

const BottomTabsNavigator = () => {
    const { colors, typography } = useTheme();
    const insets = useSafeAreaInsets();

    return (
        <BottomTab.Navigator
            initialRouteName="Home"
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textSecondary,
                tabBarStyle: {
                    backgroundColor: colors.background,
                    borderTopColor: colors.borderColor,
                    borderTopWidth: 1,
                    height: 60 + insets.bottom,
                    paddingBottom: insets.bottom,
                    paddingTop: 5,
                },
                tabBarLabelStyle: {
                    ...typography.body1,
                    fontWeight: "600",
                },
            }}>
            <BottomTab.Screen
                name="Home"
                component={Home}
                options={{
                    title: "Home",
                    tabBarIcon: ({
                        color,
                        size,
                    }: {
                        color: string;
                        size: number;
                    }) => (
                        <Icon name="home-outline" size={size} color={color} />
                    ),
                }}
            />
            <BottomTab.Screen
                name="Stock"
                component={OpeningStock}
                options={{
                    title: "Stock",
                    tabBarIcon: ({
                        color,
                        size,
                    }: {
                        color: string;
                        size: number;
                    }) => (
                        <Icon
                            name="analytics-outline"
                            size={size}
                            color={color}
                        />
                    ),
                }}
            />
            <BottomTab.Screen
                name="Attendance"
                component={AttendanceInfo}
                options={{
                    title: "Attendance",
                    tabBarIcon: ({
                        color,
                        size,
                    }: {
                        color: string;
                        size: number;
                    }) => (
                        <Icon name="people-outline" size={size} color={color} />
                    ),
                }}
            />
            <BottomTab.Screen
                name="Settings"
                component={SettingScreen}
                options={{
                    title: "Settings",
                    tabBarIcon: ({
                        color,
                        size,
                    }: {
                        color: string;
                        size: number;
                    }) => (
                        <Icon
                            name="settings-outline"
                            size={size}
                            color={color}
                        />
                    ),
                }}
            />
        </BottomTab.Navigator>
    );
};

export default BottomTabsNavigator;
