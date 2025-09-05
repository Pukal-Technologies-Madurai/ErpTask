import {
    ScrollView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    RefreshControl,
    Pressable,
} from "react-native";
import React from "react";
import { MMKV } from "react-native-mmkv";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import AppHeader from "../../Components/AppHeader";
import DatePickerButton from "../../Components/DatePickerButton";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useTheme } from "../../Context/ThemeContext";
import { RootStackParamList } from "../../Navigation/types";
import { itemStockInfo, itemWiseStock } from "../../Api/OpeningStock";
import { responsiveHeight, responsiveWidth } from "../../constants/helper";
import { salesInvoice, salesOrderInvoice } from "../../Api/Sales";
import { getPurchaseOrderEntry, getPurchaseReport } from "../../Api/Purchase";

const Home = () => {
    const { colors, typography } = useTheme();
    const styles = getStyles(typography, colors);
    const storage = new MMKV();
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
    const [refreshing, setRefreshing] = React.useState(false);

    const {
        data: saleOrderData = [],
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ["saleOrder", selectedDate, selectedDate],
        queryFn: () => salesOrderInvoice(selectedDate, selectedDate),
        enabled: !!selectedDate,
    });

    const { data: invoiceData = [] } = useQuery({
        queryKey: ["invoiceData", selectedDate, selectedDate],
        queryFn: () => salesInvoice(selectedDate, selectedDate),
        enabled: !!selectedDate,
    });

    const { data: purchaseData = [], refetch: refetchPurchase } = useQuery({
        queryKey: ["purchaseData", selectedDate, selectedDate],
        queryFn: () => getPurchaseReport(selectedDate, selectedDate),
        enabled: !!selectedDate,
    });

    const {
        data: purchaseOrderEntryData = [],
        refetch: refetchPurchaseOrderEntry,
    } = useQuery({
        queryKey: ["purchaseOrderEntryData", selectedDate, selectedDate],
        queryFn: () => getPurchaseOrderEntry(selectedDate, selectedDate),
        enabled: !!selectedDate,
    });

    const { data: itemStockValue = [], refetch: refetchItemStockValue } =
        useQuery({
            queryKey: ["itemStackValue", selectedDate],
            queryFn: () => itemStockInfo(selectedDate),
            enabled: !!selectedDate,
        });

    const { data: itemWiseStockData = [], refetch: refetchItemWise } = useQuery(
        {
            queryKey: ["itemWiseStock", selectedDate, selectedDate],
            queryFn: () => itemWiseStock(selectedDate, selectedDate),
            enabled: !!selectedDate,
        },
    );

    // Today's totals
    const totalSales = saleOrderData.reduce(
        (acc: number, item: { Total_Invoice_value?: number }) =>
            acc + (item.Total_Invoice_value || 0),
        0,
    );

    const totalInvoices = invoiceData.reduce(
        (acc: number, item: { Total_Invoice_value?: number }) =>
            acc + (item.Total_Invoice_value || 0),
        0,
    );

    const totalPurchase = purchaseData.reduce(
        (acc: number, stockGroup: any) => {
            // Check if product_details exists and is an array
            if (
                !stockGroup.product_details ||
                !Array.isArray(stockGroup.product_details)
            ) {
                return acc;
            }

            // Iterate through each product in product_details
            const productDetailsTotal = stockGroup.product_details.reduce(
                (productAcc: number, product: any) => {
                    // Check if product_details_1 exists and is an array
                    if (
                        !product.product_details_1 ||
                        !Array.isArray(product.product_details_1)
                    ) {
                        return productAcc;
                    }

                    // Sum all amounts in product_details_1
                    const productDetail1Total =
                        product.product_details_1.reduce(
                            (detailAcc: number, detail: any) => {
                                return detailAcc + (detail.amount || 0);
                            },
                            0,
                        );

                    return productAcc + productDetail1Total;
                },
                0,
            );

            return acc + productDetailsTotal;
        },
        0,
    );

    const totalStockValue = itemStockValue.reduce(
        (acc: number, item: { CL_Value?: number }) =>
            acc + (item.CL_Value || 0),
        0,
    );

    const totalItemWise = itemWiseStockData.reduce(
        (acc: number, item: { Product_Rate?: number }) =>
            acc + (item.Product_Rate || 0),
        0,
    );

    const totalSalesTonnage = saleOrderData.reduce(
        (
            acc: number,
            item: {
                Products_List?: Array<{
                    Total_Qty?: number;
                    Unit_Name?: string;
                }>;
            },
        ) => {
            if (!item.Products_List || !Array.isArray(item.Products_List)) {
                return acc;
            }

            const productsTotal = item.Products_List.reduce(
                (
                    productAcc: number,
                    product: { Total_Qty?: number; Unit_Name?: string },
                ) => {
                    const qty = product.Total_Qty || 0;
                    const unit = product.Unit_Name?.toLowerCase() || "";

                    // Convert to tons based on unit
                    let qtyInTons = 0;
                    if (unit.includes("kg") || unit.includes("kilogram")) {
                        qtyInTons = qty / 1000; // Convert kg to tons
                    } else if (unit.includes("ton") || unit.includes("tonne")) {
                        qtyInTons = qty; // Already in tons
                    } else if (unit.includes("g") && !unit.includes("kg")) {
                        qtyInTons = qty / 1000000; // Convert grams to tons
                    } else {
                        // Assume kg if unit is unclear
                        qtyInTons = qty / 1000;
                    }

                    return productAcc + qtyInTons;
                },
                0,
            );

            return acc + productsTotal;
        },
        0,
    );

    const totalInvoicesTonnage = invoiceData.reduce(
        (
            acc: number,
            item: {
                Products_List?: Array<{
                    Total_Qty?: number;
                    Unit_Name?: string;
                }>;
            },
        ) => {
            if (!item.Products_List || !Array.isArray(item.Products_List)) {
                return acc;
            }

            const productsTotal = item.Products_List.reduce(
                (
                    productAcc: number,
                    product: { Total_Qty?: number; Unit_Name?: string },
                ) => {
                    const qty = product.Total_Qty || 0;
                    const unit = product.Unit_Name?.toLowerCase() || "";

                    // Convert to tons based on unit
                    let qtyInTons = 0;
                    if (unit.includes("kg") || unit.includes("kilogram")) {
                        qtyInTons = qty / 1000; // Convert kg to tons
                    } else if (unit.includes("ton") || unit.includes("tonne")) {
                        qtyInTons = qty; // Already in tons
                    } else if (unit.includes("g") && !unit.includes("kg")) {
                        qtyInTons = qty / 1000000; // Convert grams to tons
                    } else {
                        // Assume kg if unit is unclear
                        qtyInTons = qty / 1000;
                    }

                    return productAcc + qtyInTons;
                },
                0,
            );

            return acc + productsTotal;
        },
        0,
    );

    const totalTonnage = purchaseData.reduce((acc: number, stockGroup: any) => {
        // Check if product_details exists and is an array
        if (
            !stockGroup.product_details ||
            !Array.isArray(stockGroup.product_details)
        ) {
            return acc;
        }

        const productDetailsTotal = stockGroup.product_details.reduce(
            (productAcc: number, product: any) => {
                // Check if product_details_1 exists and is an array
                if (
                    !product.product_details_1 ||
                    !Array.isArray(product.product_details_1)
                ) {
                    return productAcc;
                }

                const productDetail1Total = product.product_details_1.reduce(
                    (detailAcc: number, detail: any) => {
                        const quantityInKg = detail.bill_qty || 0;
                        const quantityInTons = quantityInKg / 1000; // convert kg to tons
                        return detailAcc + quantityInTons;
                    },
                    0,
                );
                return productAcc + productDetail1Total;
            },
            0,
        );
        return acc + productDetailsTotal;
    }, 0);

    const totalPurchaseOrderEntry = purchaseOrderEntryData.reduce(
        (acc: number, current: any) => {
            return (
                acc +
                current.ItemDetails.reduce((itemAcc: any, item: any) => {
                    return itemAcc + item.Weight * item.Rate;
                }, 0)
            );
        },
        0,
    );

    const totalPurchaseOrderEntryTonnage = purchaseOrderEntryData.reduce(
        (acc: number, current: any) => {
            if (!current.ItemDetails || !Array.isArray(current.ItemDetails)) {
                return acc;
            }

            const itemsTotal = current.ItemDetails.reduce(
                (itemAcc: number, item: any) => {
                    // Weight is typically in kg, convert to tons
                    const weightInKg = item.Weight || 0;
                    const weightInTons = weightInKg / 1000;
                    return itemAcc + weightInTons;
                },
                0,
            );

            return acc + itemsTotal;
        },
        0,
    );

    // Calculate total stock tonnage (assuming Bal_Qty is in kg)
    const totalStockTonnage = itemStockValue.reduce(
        (acc: number, item: { Bal_Qty?: number }) => {
            const balQtyInKg = item.Bal_Qty || 0;
            const balQtyInTons = balQtyInKg / 1000; // Convert kg to tons
            return acc + balQtyInTons;
        },
        0,
    );

    const totalItemWiseTonnage = itemWiseStockData.reduce(
        (acc: number, item: { Bal_Qty?: number }) => {
            const balQtyInKg = item.Bal_Qty || 0;
            const balQtyInTons = balQtyInKg / 1000; // Convert kg to tons
            return acc + balQtyInTons;
        },
        0,
    );

    // Format number for display
    const formatNumber = (num: number) => {
        if (num >= 10000000) return `${(num / 10000000).toFixed(1)}Cr`;
        if (num >= 100000) return `${(num / 100000).toFixed(1)}L`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    // Format tonnage for display
    const formatTonnage = (tons: number) => {
        if (tons >= 1000) return `${(tons / 1000).toFixed(1)}K`;
        return tons.toFixed(1);
    };

    // Handle refresh
    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        await Promise.all([
            refetch(),
            refetchPurchase(),
            refetchPurchaseOrderEntry(),
            refetchItemStockValue(),
            refetchItemWise(),
        ]);
        setRefreshing(false);
    }, [
        refetch,
        refetchPurchase,
        refetchPurchaseOrderEntry,
        refetchItemStockValue,
        refetchItemWise,
    ]);

    return (
        <SafeAreaView style={[styles.container]} edges={["top"]}>
            <AppHeader
                navigation={navigation}
                showDrawer={true}
                name={storage.getString("name")}
                subtitle={storage.getString("companyName")}
                showRightIcon={true}
                rightIconLibrary="MaterialIcon"
                rightIconName="compare-arrows"
                onRightPress={() => navigation.navigate("CompanySwitch")}
            />
            <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ flex: 1, backgroundColor: colors.background }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                        tintColor={colors.primary}
                    />
                }>
                {/* Date Picker Section */}
                <View style={styles.datePickerContainer}>
                    <Text style={styles.sectionTitle}>Dashboard Overview</Text>
                    <View style={styles.datePickerRow}>
                        <DatePickerButton
                            title="Select Date"
                            date={selectedDate}
                            style={styles.datePicker}
                            containerStyle={styles.datePickerContainerStyle}
                            titleStyle={styles.datePickerTitle}
                            onDateChange={(date: Date) => setSelectedDate(date)}
                        />
                        <TouchableOpacity
                            style={styles.refreshButton}
                            onPress={onRefresh}>
                            <Icon
                                name="refresh"
                                size={24}
                                color={colors.white}
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Loading State */}
                {isLoading && (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>
                            Loading dashboard data...
                        </Text>
                    </View>
                )}

                {/* Summary Section */}
                <View style={styles.summarySection}>
                    <Text style={styles.sectionTitle}>Quick Summary</Text>
                    <View style={styles.summaryCards}>
                        {/* First Row */}
                        <View style={styles.summaryRow}>
                            <Pressable
                                onPress={() =>
                                    navigation.navigate("saleOrderInvoice")
                                }>
                                <View style={styles.summaryCard}>
                                    <Icon
                                        name="shopping-cart"
                                        size={32}
                                        color={colors.primary}
                                    />
                                    <Text style={styles.summaryCardTitle}>
                                        Sale Orders
                                    </Text>
                                    <Text style={styles.summaryCardValue}>
                                        ₹{formatNumber(totalSales)}
                                    </Text>
                                    <View
                                        style={[
                                            styles.tonnageContainer,
                                            {
                                                backgroundColor:
                                                    colors.primary + "15",
                                            },
                                        ]}>
                                        <Icon
                                            name="scale"
                                            size={16}
                                            color={colors.primary}
                                        />
                                        <Text
                                            style={[
                                                styles.tonnageText,
                                                { color: colors.primary },
                                            ]}>
                                            {formatTonnage(totalSalesTonnage)}{" "}
                                            Tons
                                        </Text>
                                    </View>
                                </View>
                            </Pressable>

                            <Pressable
                                onPress={() =>
                                    navigation.navigate("invoiceSale")
                                }>
                                <View style={styles.summaryCard}>
                                    <Icon
                                        name="receipt"
                                        size={32}
                                        color={colors.accent}
                                    />
                                    <Text style={styles.summaryCardTitle}>
                                        Sale Invoices
                                    </Text>
                                    <Text style={styles.summaryCardValue}>
                                        ₹{formatNumber(totalInvoices)}
                                    </Text>
                                    <View
                                        style={[
                                            styles.tonnageContainer,
                                            {
                                                backgroundColor:
                                                    colors.accent + "15",
                                            },
                                        ]}>
                                        <Icon
                                            name="scale"
                                            size={16}
                                            color={colors.accent}
                                        />
                                        <Text
                                            style={[
                                                styles.tonnageText,
                                                { color: colors.accent },
                                            ]}>
                                            {formatTonnage(
                                                totalInvoicesTonnage,
                                            )}{" "}
                                            Tons
                                        </Text>
                                    </View>
                                </View>
                            </Pressable>
                        </View>

                        {/* Second Row */}
                        <View style={styles.summaryRow}>
                            <Pressable
                                onPress={() =>
                                    navigation.navigate("purchaseInvoice")
                                }>
                                <View style={styles.summaryCard}>
                                    <Icon
                                        name="shopping-bag"
                                        size={32}
                                        color={colors.warning}
                                    />
                                    <Text style={styles.summaryCardTitle}>
                                        Purchase Invoices
                                    </Text>
                                    <Text style={styles.summaryCardValue}>
                                        ₹{formatNumber(totalPurchase)}
                                    </Text>
                                    <View
                                        style={[
                                            styles.tonnageContainer,
                                            {
                                                backgroundColor:
                                                    colors.warning + "15",
                                            },
                                        ]}>
                                        <Icon
                                            name="scale"
                                            size={16}
                                            color={colors.info}
                                        />
                                        <Text
                                            style={[
                                                styles.tonnageText,
                                                { color: colors.info },
                                            ]}>
                                            {formatTonnage(totalTonnage)} Tons
                                        </Text>
                                    </View>
                                </View>
                            </Pressable>

                            <Pressable
                                onPress={() =>
                                    navigation.navigate("purchaseOrder")
                                }>
                                <View style={styles.summaryCard}>
                                    <Icon
                                        name="assignment"
                                        size={32}
                                        color={colors.info}
                                    />
                                    <Text style={styles.summaryCardTitle}>
                                        Purchase Orders
                                    </Text>
                                    <Text style={styles.summaryCardValue}>
                                        ₹{formatNumber(totalPurchaseOrderEntry)}
                                    </Text>
                                    <View
                                        style={[
                                            styles.tonnageContainer,
                                            {
                                                backgroundColor:
                                                    colors.info + "15",
                                            },
                                        ]}>
                                        <Icon
                                            name="scale"
                                            size={16}
                                            color={colors.info}
                                        />
                                        <Text
                                            style={[
                                                styles.tonnageText,
                                                { color: colors.info },
                                            ]}>
                                            {formatTonnage(
                                                totalPurchaseOrderEntryTonnage,
                                            )}{" "}
                                            Tons
                                        </Text>
                                    </View>
                                </View>
                            </Pressable>
                        </View>

                        <View style={styles.summaryRow}>
                            <Pressable
                                onPress={() =>
                                    navigation.navigate("ItemStack")
                                }>
                                <View style={styles.summaryCard}>
                                    <Icon
                                        name="inventory"
                                        size={32}
                                        color={colors.success}
                                    />
                                    <Text style={styles.summaryCardTitle}>
                                        Item Stock Value
                                    </Text>
                                    <Text style={styles.summaryCardValue}>
                                        ₹{formatNumber(totalStockValue)}
                                    </Text>
                                    <View
                                        style={[
                                            styles.tonnageContainer,
                                            {
                                                backgroundColor:
                                                    colors.success + "15",
                                            },
                                        ]}>
                                        <Icon
                                            name="scale"
                                            size={16}
                                            color={colors.success}
                                        />
                                        <Text
                                            style={[
                                                styles.tonnageText,
                                                { color: colors.success },
                                            ]}>
                                            {formatTonnage(totalStockTonnage)}{" "}
                                            Tons
                                        </Text>
                                    </View>
                                </View>
                            </Pressable>

                            <Pressable
                                onPress={() => navigation.navigate("Stock")}>
                                <View style={styles.summaryCard}>
                                    <Icon
                                        name="warehouse"
                                        size={32}
                                        color={colors.warning}
                                    />
                                    <Text style={styles.summaryCardTitle}>
                                        Stock in Hand
                                    </Text>
                                    <Text style={styles.summaryCardValue}>
                                        ₹{formatNumber(totalItemWise)}
                                    </Text>
                                    <View
                                        style={[
                                            styles.tonnageContainer,
                                            {
                                                backgroundColor:
                                                    colors.warning + "15",
                                            },
                                        ]}>
                                        <Icon
                                            name="scale"
                                            size={16}
                                            color={colors.warning}
                                        />
                                        <Text
                                            style={[
                                                styles.tonnageText,
                                                { color: colors.warning },
                                            ]}>
                                            {formatTonnage(
                                                totalItemWiseTonnage,
                                            )}{" "}
                                            Tons
                                        </Text>
                                    </View>
                                </View>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default Home;

const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.primary,
        },

        // Date Picker Section
        datePickerContainer: {
            padding: responsiveWidth(4),
            backgroundColor: colors.white,
            borderRadius: 12,
            margin: responsiveWidth(4),
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        sectionTitle: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "600",
            marginBottom: responsiveHeight(2),
        },
        datePickerRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(3),
        },
        dateInfoContainer: {
            marginTop: responsiveWidth(2),
            alignItems: "center",
        },
        dateInfoText: {
            ...typography.caption,
            color: colors.textSecondary,
            fontStyle: "italic",
        },
        datePickerContainerStyle: {
            flex: 1,
        },
        datePickerTitle: {
            ...typography.body1,
            color: colors.text,
            marginBottom: 8,
        },
        datePicker: {
            backgroundColor: colors.primary + "30",
            padding: responsiveWidth(3),
            borderRadius: 8,
            alignItems: "center",
        },
        refreshButton: {
            backgroundColor: colors.primary,
            padding: responsiveWidth(3),
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            minWidth: responsiveWidth(12),
            minHeight: responsiveWidth(12),
        },

        // Loading State
        loadingContainer: {
            alignItems: "center",
            justifyContent: "center",
            padding: responsiveHeight(4),
        },
        loadingText: {
            ...typography.body1,
            color: colors.textSecondary,
        },

        // Summary Section
        summarySection: {
            paddingHorizontal: responsiveWidth(4),
            paddingVertical: responsiveHeight(2),
        },
        summaryCards: {
            gap: responsiveWidth(4),
        },
        summaryRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: responsiveWidth(4),
            gap: responsiveWidth(4),
        },
        summaryCard: {
            width: (responsiveWidth(100) - responsiveWidth(12)) / 2,
            backgroundColor: colors.white,
            borderRadius: 16,
            padding: responsiveWidth(4),
            alignItems: "center",
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 8,
            elevation: 6,
            minHeight: responsiveHeight(18),
            justifyContent: "space-between",
        },
        summaryCardTitle: {
            ...typography.body2,
            color: colors.textSecondary,
            textAlign: "center",
            marginTop: responsiveWidth(2),
            marginBottom: responsiveWidth(3),
            fontSize: responsiveWidth(3.5),
            fontWeight: "600",
            lineHeight: responsiveWidth(4.5),
        },
        summaryCardValue: {
            ...typography.h4,
            color: colors.text,
            fontWeight: "800",
            textAlign: "center",
            fontSize: responsiveWidth(5.5),
            marginBottom: responsiveWidth(2),
            letterSpacing: 0.5,
        },
        changeContainer: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: responsiveWidth(3),
            gap: responsiveWidth(1.5),
            backgroundColor: colors.surface,
            borderRadius: 20,
            paddingHorizontal: responsiveWidth(3),
            paddingVertical: responsiveWidth(1.5),
            shadowColor: colors.black + "50",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 2,
            elevation: 2,
        },
        changeText: {
            ...typography.body2,
            fontWeight: "700",
            fontSize: responsiveWidth(3.2),
        },
        tonnageContainer: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: responsiveWidth(2),
            gap: responsiveWidth(1),
            borderRadius: 12,
            paddingHorizontal: responsiveWidth(2),
            paddingVertical: responsiveWidth(1),
        },
        tonnageText: {
            ...typography.caption,
            fontWeight: "700",
            fontSize: responsiveWidth(3),
        },
    });
