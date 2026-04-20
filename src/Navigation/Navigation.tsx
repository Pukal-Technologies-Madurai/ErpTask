import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "react-native";
import React from "react";

import { useTheme } from "../Context/ThemeContext";
import { RootStackParamList } from "./types";
import DrawerNavigator from "../routes/DrawerNavigator";

import SplashScreen from "../SplashScreen";
import LoginScreen from "../Screens/Login/Login";
import SettingScreen from "../Screens/Home/SettingScreen";
import ProfileScreen from "../Screens/Home/ProfileScreen";
import CompanySwitch from "../Screens/Login/CompanySwitch";

import SaleInvoice from "../Screens/Sales/SaleInvoice";
import SaleOrder from "../Screens/Sales/SaleOrder";
import PurchaseReportSummary from "../Screens/Purchase/PurchaseReportSummary";
import PurchaseOrder from "../Screens/Purchase/PurchaseOrder";
import PurchaseInvoices from "../Screens/Purchase/PurchaseInvoices";
import ItemStack from "../Screens/Stack/ItemStack";
import ReceiptList from "../Screens/Receipts/ReceiptList";
import DeliveryPending from "../Screens/Sales/DeliveryPending";
import OpeningStockItemWise from "../Screens/Home/OpeningStockItemWise";
import OpeningStockGodownWise from "../Screens/Home/OpeningStockGodownWise";
import SalesPendingOrderWise from "../Screens/Sales/SalesPendingOrderWise";
import SalesPendingItemWise from "../Screens/Sales/SalesPendingItemWise";
import Transaction from "../Screens/Payment/Transaction";
import TransactionList from "../Screens/Payment/TransactionList";
import Debtors from "../Screens/Payment/Debtors";
import Expenses from "../Screens/Payment/Expenses";
import TransactionListExpenses from "../Screens/Payment/TransactionListExpenses";
import ItemWiseTransaction from "../Screens/Home/ItemWiseTransaction";
import GodownItemWiseTransaction from "../Screens/Home/GodownitemTransaction";
import GraphicalAnalysisReport from "../Screens/Home/GraphAnalyticsReport";

// Not Used

const Stack = createNativeStackNavigator<RootStackParamList>();

const Navigation = () => {
    const { colors, mode } = useTheme();

    return (
        <SafeAreaProvider>
            <NavigationContainer>
                <StatusBar
                    barStyle={
                        mode === "light" ? "light-content" : "dark-content"
                    }
                    backgroundColor={colors.primary}
                />
                <Stack.Navigator
                    initialRouteName="Splash"
                    screenOptions={{
                        headerShown: false,
                        gestureEnabled: true,
                    }}>
                    <Stack.Screen
                        name="Splash"
                        component={SplashScreen}
                        options={{
                            animationTypeForReplace: "push",
                        }}
                    />

                    <Stack.Screen
                        name="MainDrawer"
                        component={DrawerNavigator}
                        options={{
                            gestureEnabled: false,
                        }}
                    />

                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="setting" component={SettingScreen} />
                    <Stack.Screen name="profile" component={ProfileScreen} />
                    <Stack.Screen
                        name="CompanySwitch"
                        component={CompanySwitch}
                    />

                    <Stack.Screen name="invoiceSale" component={SaleInvoice} />
                    <Stack.Screen
                        name="saleOrderInvoice"
                        component={SaleOrder}
                    />

                    <Stack.Screen name="receiptList" component={ReceiptList} />

                    <Stack.Screen
                        name="PurchaseReportSummary"
                        component={PurchaseReportSummary}
                    />
                    <Stack.Screen
                        name="purchaseOrder"
                        component={PurchaseOrder}
                    />
                    <Stack.Screen
                        name="purchaseInvoice"
                        component={PurchaseInvoices}
                    />

                    <Stack.Screen name="ItemStack" component={ItemStack} />
                    <Stack.Screen
                        name="deliveryPend"
                        component={DeliveryPending}
                    />
                    <Stack.Screen
                        name="saleorderpendorder"
                        component={SalesPendingOrderWise}
                    />
                    <Stack.Screen
                        name="saleorderpenditem"
                        component={SalesPendingItemWise}
                    />
                    <Stack.Screen
                        name="Stockitem"
                        component={OpeningStockItemWise}
                    />
                    <Stack.Screen
                        name="Stockgodown"
                        component={OpeningStockGodownWise}
                    />
                    <Stack.Screen name="transaction" component={Transaction} />
                    <Stack.Screen
                        name="transactionlist"
                        component={TransactionList}
                    />
                    <Stack.Screen name="debtors" component={Debtors} />
                    <Stack.Screen name="expenses" component={Expenses} />
                    <Stack.Screen
                        name="transactionlistexp"
                        component={TransactionListExpenses}
                    />
                    <Stack.Screen
                        name="transactionlistitem"
                        component={ItemWiseTransaction}
                    />
                    <Stack.Screen
                        name="transactionlistgodownitem"
                        component={GodownItemWiseTransaction}
                    />
                    <Stack.Screen
                        name="graphicalanalysis"
                        component={GraphicalAnalysisReport}
                    />

                    {/* Not Used */}
                </Stack.Navigator>
            </NavigationContainer>
        </SafeAreaProvider>
    );
};

export default Navigation;
