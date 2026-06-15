import React from "react";
import {
    createDrawerNavigator,
    DrawerContentComponentProps,
} from "@react-navigation/drawer";
import BottomTabsNavigator from "./BottomTabsNavigator";
import { useTheme } from "../Context/ThemeContext";
import { DrawerParamList } from "../Navigation/types";
import ProfileScreen from "../Screens/Home/ProfileScreen";
import CustomDrawerContent from "../Components/CustomDrawerContent";
import Icon from "react-native-vector-icons/Ionicons";
import SaleInvoice from "../Screens/Sales/SaleInvoice";
import AttendanceInfo from "../Screens/Home/AttendanceInfo";
import SaleOrder from "../Screens/Sales/SaleOrder";
import CompanySwitch from "../Screens/Login/CompanySwitch";

const Drawer = createDrawerNavigator<DrawerParamList>();

const DrawerNavigator = () => {
    const { colors, typography } = useTheme();

    return (
        <Drawer.Navigator
            initialRouteName="HomeTab"
            drawerContent={(props: DrawerContentComponentProps) => (
                <CustomDrawerContent {...props} />
            )}
            screenOptions={{
                headerShown: false,
                drawerStyle: {
                    backgroundColor: colors.background,
                    width: 312,
                    borderTopRightRadius: 24,
                    borderBottomRightRadius: 24,
                    elevation: 10,
                    shadowColor: colors.black,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.24,
                    shadowRadius: 10,
                },
                drawerActiveTintColor: colors.primary,
                drawerInactiveTintColor: colors.textSecondary,
                drawerActiveBackgroundColor: colors.primary + "15",
                headerStyle: {
                    backgroundColor: colors.primary,
                },
                headerTintColor: colors.white,
                drawerLabelStyle: {
                    ...typography.body1,
                    fontWeight: "600",
                    marginLeft: 6,
                },
                drawerItemStyle: {
                    borderRadius: 14,
                    marginHorizontal: 12,
                    marginVertical: 3,
                    paddingHorizontal: 16,
                },
                drawerContentStyle: {
                    backgroundColor: colors.background,
                    paddingTop: 0,
                },
                sceneStyle: {
                    backgroundColor: colors.background,
                },
            }}>
            <Drawer.Screen
                name="HomeTab"
                component={BottomTabsNavigator}
                options={{
                    headerShown: false,
                    title: "Dashboard",
                    drawerLabel: "Dashboard",
                    drawerIcon: ({
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
            <Drawer.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    title: "Profile",
                    drawerLabel: "My Profile",
                    drawerIcon: ({
                        color,
                        size,
                    }: {
                        color: string;
                        size: number;
                    }) => (
                        <Icon name="person-outline" size={size} color={color} />
                    ),
                }}
            />
            <Drawer.Screen
                name="CompanySwitch"
                component={CompanySwitch}
                options={{
                    title: "Switch Company",
                    drawerLabel: "Switch Company",
                    drawerIcon: ({
                        color,
                        size,
                    }: {
                        color: string;
                        size: number;
                    }) => (
                        <Icon
                            name="business-outline"
                            size={size}
                            color={color}
                        />
                    ),
                }}
            />

            <Drawer.Screen
                name="Attendance"
                component={AttendanceInfo}
                options={{
                    title: "Attendance",
                    drawerLabel: "Attendance",
                    drawerIcon: ({
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

            <Drawer.Screen
                name="invoiceSale"
                component={SaleInvoice}
                options={{
                    title: "Sales Invoice",
                    drawerLabel: "Sales Invoice",
                    drawerIcon: ({
                        color,
                        size,
                    }: {
                        color: string;
                        size: number;
                    }) => (
                        <Icon
                            name="receipt-outline"
                            size={size}
                            color={color}
                        />
                    ),
                }}
            />

            <Drawer.Screen
                name="saleOrderInvoice"
                component={SaleOrder}
                options={{
                    title: "Sales Order",
                    drawerLabel: "Sales Order",
                    drawerIcon: ({
                        color,
                        size,
                    }: {
                        color: string;
                        size: number;
                    }) => (
                        <Icon
                            name="document-text-outline"
                            size={size}
                            color={color}
                        />
                    ),
                }}
            />
        </Drawer.Navigator>
    );
};

export default DrawerNavigator;
