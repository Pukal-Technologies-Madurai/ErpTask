import {
    ScrollView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    RefreshControl,
    Pressable,
    Modal
} from "react-native";
import React, { useEffect } from "react";
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
import { fetchReceiptList } from "../../Api/receipt";
import { responsiveHeight, responsiveWidth } from "../../constants/helper";
import { salesInvoice, salesOrderInvoice } from "../../Api/Sales";
import { getpurchaseInvoiceEntry, getPurchaseOrderEntry, getPurchaseReport } from "../../Api/Purchase";
import { API } from "../../constants/api";
import PaymentList from "../Payment/PaymentList";
import { fetchPaymentList } from "../../Api/payment";
import { saleorderPendingList } from "../../Api/Sales";

const Home = () => {
    const { colors, typography } = useTheme();
    const styles = getStyles(typography, colors);
    const storage = new MMKV();
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const [companyId, setCompanyId] = React.useState("");
    const [userId, setUserId] = React.useState("");
    const [branchId, setBranchId] = React.useState<string>("");
    const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
    const [toDate, setToDate] = React.useState<Date>(new Date());
    const [refreshing, setRefreshing] = React.useState(false);
    const [getBranch, setGetBranch] = React.useState([])
    const [selectedBranches, setSelectedBranches] = React.useState([]);
    const [branchModalVisible, setBranchModalVisible] = React.useState(false);

    type Branch = {
        id: number;
        BranchName: string;
        HasAccess?: number;
        Created_by?: number;
        Created_at?: string;
    };

    React.useEffect(() => {
        const companyId = storage.getString("companyId");
        const userId = storage.getString("userId")
        const branchId = storage.getString("branchId")
        if (companyId) setCompanyId(companyId);
        if (userId) setUserId(userId);
        if (branchId) setBranchId(branchId);
    }, []);

    const {
        data: saleOrderData = [],
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ["saleOrder", selectedDate, toDate],
        queryFn: () => salesOrderInvoice(selectedDate, toDate, userId, branchId),
        enabled: !!selectedDate && !!toDate && !!userId && !!branchId,
    });

    const { data: invoiceData = [], } = useQuery({
        queryKey: ["invoiceData", selectedDate, toDate],
        queryFn: () => salesInvoice(selectedDate, toDate, userId, branchId),
        enabled: !!selectedDate && !!toDate && !!userId && !!branchId,
    });

    const { data: purchaseData = [], refetch: refetchPurchase } = useQuery({
        queryKey: ["purchaseData", selectedDate, toDate],
        queryFn: () => getPurchaseReport(selectedDate, toDate, companyId),
        enabled: !!selectedDate && !!toDate,
    });

    const {
        data: purchaseOrderEntryData = [],
        refetch: refetchPurchaseOrderEntry,
    } = useQuery({
        queryKey: ["purchaseOrderEntryData", selectedDate, toDate],
        queryFn: () => getPurchaseOrderEntry(selectedDate, toDate, userId, branchId),
        enabled: !!selectedDate && !!toDate && !!userId && !!branchId,
    });

    const {
        data: purchaseInvoiceEntryData = [],
        refetch: refetchPurchaseInvoiceEntry,
    } = useQuery({
        queryKey: ["purchaseInvoiceEntryData", selectedDate, toDate],
        queryFn: () => getpurchaseInvoiceEntry(selectedDate, toDate, userId, branchId),
        enabled: !!selectedDate && !!toDate && !!userId && !!branchId,
    });

    const { data: itemStockValue = [], refetch: refetchItemStockValue } =
        useQuery({
            queryKey: ["itemStackValue", selectedDate],
            queryFn: () => itemStockInfo(selectedDate),
            enabled: !!selectedDate,
        });

    const { data: receiptList = [], refetch: refetchReceiptList } = useQuery({
        queryKey: ["receiptList", selectedDate, toDate],
        queryFn: () => fetchReceiptList(selectedDate, toDate, userId, branchId),
        enabled: !!selectedDate && !!toDate && !!userId && !!branchId,
    });

    const { data: paymentList = [], refetch: refetchPaymentList } = useQuery({
        queryKey: ["paymentList", selectedDate, toDate],
        queryFn: () => fetchPaymentList(selectedDate, toDate, userId, branchId),
        enabled: !!selectedDate && !!toDate && !!userId && !!branchId,
    });

    const {
        data: saleorderPendingData = [],refetch: refetchSaleorderPendingList,} = useQuery({
        queryKey: ["saleorderPendingList",selectedDate,toDate,userId,branchId],
        queryFn: () =>saleorderPendingList(selectedDate, toDate, userId, branchId),
        enabled:!!selectedDate &&!!toDate &&!!userId &&!!branchId,
    });

    const { data: itemWiseStockData = [], refetch: refetchItemWise } = useQuery(
        {
            queryKey: ["itemWiseStock", selectedDate, toDate],
            queryFn: () => itemWiseStock(selectedDate, toDate),
            enabled: !!selectedDate && !!toDate,
        },
    );

    // Today's totals
    const totalSales = saleOrderData.reduce(
        (acc: any, item: { Total_Invoice_value?: any }) =>
            acc + (item.Total_Invoice_value || 0),
        0,
    );

    const totalSalesPend = saleorderPendingData.reduce(
        (acc: any, item: { Total_Invoice_value?: any }) =>
            acc + (item.Total_Invoice_value || 0),
        0,
    );

    const totalReceipt = receiptList.reduce(
        (acc: any, item: { credit_amount?: any }) =>
            acc + (item.credit_amount || 0),
        0,
    );

    const totalPayment = paymentList.reduce(
        (acc: any, item: { credit_amount?: any }) =>
            acc + (item.credit_amount || 0),
        0,
    )

    const totalInvoices = invoiceData.reduce(
        (acc: any, item: { Total_Invoice_value?: any }) =>
            acc + (item.Total_Invoice_value || 0),
        0,
    );

    const totalPurchaseInvoice = purchaseInvoiceEntryData.reduce(
        (acc: any, item: { Total_Invoice_value?: any }) =>
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

    const totalSalesPendingTonnage = saleorderPendingData.reduce(
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

    //purchaseInvoiceEntryTonnage Calculation//
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

    const totalPurchaseInvoiceEntryTonnage = purchaseInvoiceEntryData.reduce(
        (
            acc: number,
            item: {
                ItemDetails?: Array<{
                    Weight?: number;
                    Unit_Name?: string;
                }>;
            }
        ) => {
            if (!item.ItemDetails || !Array.isArray(item.ItemDetails)) {
                return acc;
            }

            const itemsTotal = item.ItemDetails.reduce(
                (
                    itemAcc: number,
                    product: { Total_Qty?: number; Unit_Name?: string }
                ) => {
                    const qty = product.Total_Qty || 0;
                    const unit = product.Unit_Name?.toLowerCase() || "";

                    // Convert to tons based on unit
                    let qtyInTons = 0;
                    if (unit.includes("kg") || unit.includes("kilogram")) {
                        qtyInTons = qty / 1000;
                    } else if (unit.includes("ton") || unit.includes("tonne")) {
                        qtyInTons = qty;
                    } else if (unit.includes("g") && !unit.includes("kg")) {
                        qtyInTons = qty / 1000000;
                    } else {
                        // Default assume kg if unit unclear
                        qtyInTons = qty / 1000;
                    }

                    return itemAcc + qtyInTons;
                },
                0
            );

            return acc + itemsTotal;
        },
        0 // initial value for outer reduce
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
            refetchPurchaseInvoiceEntry(),
            refetchItemStockValue(),
            refetchItemWise(),
        ]);
        setRefreshing(false);
    }, [
        refetch,
        refetchPurchase,
        refetchPurchaseOrderEntry,
        refetchPurchaseInvoiceEntry,
        refetchItemStockValue,
        refetchItemWise,
    ]);

    React.useEffect(() => {
        const fetchBranches = async () => {
            const uId = storage.getString("userId");
            if (!uId) return;

            const url = API.getUserBranch(parseInt(uId));
            try {
                const res = await fetch(url);
                const json = await res.json();

                if (json.success && Array.isArray(json.data)) {
                    const accessibleBranches = json.data.filter(
                        (branch: { HasAccess?: number }) => branch.HasAccess === 1
                    );
                    setGetBranch(accessibleBranches);
                } else {
                    setGetBranch([]);
                }
            } catch (error) {
                console.error("Error fetching branches:", error);
                setGetBranch([]);
            }
        };

        fetchBranches();
    }, []);


    // console.log("getBranch", getBranch)

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
                    <View style={styles.datePickerRow}>

                        <View style={styles.dateWrapper}>
                            <DatePickerButton
                                title="From Date"
                                date={selectedDate}
                                style={styles.datePicker}
                                containerStyle={styles.datePickerContainerStyle}
                                titleStyle={styles.datePickerTitle}
                                onDateChange={(date: Date) => setSelectedDate(date)}
                            />
                        </View>

                        <View style={styles.dateWrapper}>
                            <DatePickerButton
                                title="To Date"
                                date={toDate}
                                style={styles.datePicker}
                                containerStyle={styles.datePickerContainerStyle}
                                titleStyle={styles.datePickerTitle}
                                onDateChange={(date: Date) => setToDate(date)}
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.refreshButtonSmall}
                            onPress={onRefresh}>
                            <Icon name="refresh" size={22} color={colors.white} />
                        </TouchableOpacity>

                    </View>
                </View>


                {/* Branch Selection Section */}
                <View style={styles.branchSection}>
                    <Text style={styles.sectionTitle}>Branches</Text>

                    {/* Full Width Branch Card */}
                    <Pressable onPress={() => setBranchModalVisible(true)}>
                        <View style={styles.branchCardFull}>
                            <Icon name="store" size={36} color={colors.info} />
                            <View style={styles.branchCardTextContainer}>
                                <Text style={styles.branchCardTitle}>Branches</Text>
                                <Text style={styles.branchCardValue}>
                                    {selectedBranches.length > 0
                                        ? (selectedBranches as Branch[]).map(b => b.BranchName).join(", ")
                                        : "Select Branches"}
                                </Text>
                            </View>
                        </View>
                    </Pressable>

                    {/* Branch Selection Modal */}
                    <Modal
                        visible={branchModalVisible}
                        transparent
                        animationType="slide"
                        onRequestClose={() => setBranchModalVisible(false)}>
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalContainer}>
                                <Text style={styles.modalTitle}>Select Branches</Text>

                                <ScrollView style={styles.branchList}>
                                    {getBranch.map((branch) => {
                                        const isSelected = selectedBranches.some(
                                            b => b.id === branch.id
                                        );
                                        return (
                                            <TouchableOpacity
                                                key={branch.id}
                                                style={styles.branchItem}
                                                activeOpacity={0.8}
                                                onPress={() => {
                                                    setSelectedBranches(prev => {
                                                        if (isSelected) {
                                                            // Remove branch
                                                            const newSelectedBranches = prev.filter(b => b.id !== branch.id);
                                                            setBranchId(newSelectedBranches.length === 1 ? newSelectedBranches[0].id : "");
                                                            return newSelectedBranches;
                                                        } else {
                                                            // Add branch
                                                            setBranchId(prev.length === 0 ? branch.id : "");
                                                            return [...prev, branch];
                                                        }
                                                    });
                                                }}>
                                                <View style={styles.checkboxContainer}>
                                                    <Icon
                                                        name={
                                                            isSelected
                                                                ? "check-box"
                                                                : "check-box-outline-blank"
                                                        }
                                                        size={24}
                                                        color={colors.primary}
                                                    />
                                                    <Text style={styles.branchName}>
                                                        {(branch as Branch).BranchName}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>

                                {/* Done Button */}
                                <TouchableOpacity
                                    style={styles.doneButton}
                                    onPress={() => setBranchModalVisible(false)}>
                                    <Text style={styles.doneButtonText}>Done</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>
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
                                    navigation.navigate("saleOrderInvoice", {
                                        branchId: branchId
                                    })
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
                                    navigation.navigate("invoiceSale", {
                                        branchId: branchId
                                    })
                                }>
                                <View style={styles.summaryCard}>
                                    <Icon
                                        name="source"
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
                            {/* <Pressable
                                onPress={() =>
                                    navigation.navigate("PurchaseReportSummary")
                                }>
                                <View style={styles.summaryCard}>
                                    <Icon
                                        name="shopping-bag"
                                        size={32}
                                        color={colors.warning}
                                    />
                                    <Text style={styles.summaryCardTitle}>
                                        Purchase Report
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
                            </Pressable> */}

                            <Pressable
                                onPress={() =>
                                    navigation.navigate("purchaseOrder", {
                                        branchId: branchId
                                    })
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

                            <Pressable
                                onPress={() =>
                                    navigation.navigate("purchaseInvoice",
                                        { branchId: branchId })
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
                                        ₹{formatNumber(totalPurchaseInvoice)}
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
                                                totalPurchaseInvoiceEntryTonnage,
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

                        <View style={styles.summaryRow}>
                            <Pressable
                                onPress={() =>
                                    navigation.navigate("receiptList",
                                        { branchId: branchId })
                                }>
                                <View style={styles.summaryCard}>
                                    <Icon
                                        name="receipt"
                                        size={32}
                                        color={colors.rec}
                                    />
                                    <Text style={styles.summaryCardTitle}>
                                        Receipt
                                    </Text>
                                    <Text style={styles.summaryCardValue}>
                                        ₹{formatNumber(totalReceipt)}
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
                                        {/* <Text
                                            style={[
                                                styles.tonnageText,
                                                { color: colors.success },
                                            ]}>
                                            {formatTonnage(totalStockTonnage)}{" "}
                                            Tons
                                        </Text> */}
                                    </View>
                                </View>
                            </Pressable>

                            <Pressable
                                onPress={() => navigation.navigate("paymentList",
                                    { branchId: branchId })
                                }>
                                <View style={styles.summaryCard}>
                                    <Icon
                                        name="payment"
                                        size={32}
                                        color={colors.pay}
                                    />
                                    <Text style={styles.summaryCardTitle}>
                                        Payment
                                    </Text>
                                    <Text style={styles.summaryCardValue}>
                                        ₹{formatNumber(totalPayment)}
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
                                        {/* <Text
                                            style={[
                                                styles.tonnageText,
                                                { color: colors.success },
                                            ]}>
                                            {formatTonnage(totalStockTonnage)}{" "}
                                            Tons
                                        </Text> */}
                                    </View>
                                </View>
                            </Pressable>
                        </View>

                        <View style={styles.summaryRow}>
                            <Pressable
                                onPress={() =>
                                    navigation.navigate("saleorderpend",
                                        { branchId: branchId })
                                }>
                                <View style={styles.summaryCard}>
                                    <Icon
                                        name="shopping-cart"
                                        size={32}
                                        color={colors.pen}
                                    />
                                    <Text style={styles.summaryCardTitle}>
                                        Pending Sale Order
                                    </Text>
                                    <Text style={styles.summaryCardValue}>
                                        ₹{formatNumber(totalSalesPend)}
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
                                            {formatTonnage(totalSalesPendingTonnage)}{" "}
                                            Tons
                                        </Text>
                                    </View>
                                </View>
                            </Pressable>

                            {/* <Pressable
                                onPress={() => navigation.navigate("paymentList",
                                    { branchId: branchId })
                                }>
                                <View style={styles.summaryCard}>
                                    <Icon
                                        name="payment"
                                        size={32}
                                        color={colors.pay}
                                    />
                                    <Text style={styles.summaryCardTitle}>
                                        Payment
                                    </Text>
                                    <Text style={styles.summaryCardValue}>
                                        ₹{formatNumber(totalPayment)}
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
                                        {/* <Text
                                            style={[
                                                styles.tonnageText,
                                                { color: colors.success },
                                            ]}>
                                            {formatTonnage(totalStockTonnage)}{" "}
                                            Tons
                                        </Text> */}
                            {/* </View>
                                </View>
                            </Pressable> */}
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
            paddingHorizontal: responsiveWidth(4),
            paddingVertical: responsiveWidth(2),
            backgroundColor: colors.white,
            borderRadius: 12,
            marginHorizontal: responsiveWidth(4),
            marginTop: responsiveWidth(4),
            marginBottom: responsiveWidth(2),
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
            marginHorizontal: responsiveWidth(4),
            marginVertical: responsiveWidth(2),
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
            flex: 1
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
            paddingHorizontal: responsiveWidth(2),
            paddingVertical: responsiveWidth(1),
        },
        summaryCards: {
            gap: responsiveWidth(2),
        },
        summaryRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: responsiveWidth(2),
            marginHorizontal: responsiveWidth(2),
            gap: responsiveWidth(3),
            paddingHorizontal: responsiveWidth(1),
        },
        summaryCard: {
            width: (responsiveWidth(100) - responsiveWidth(15)) / 2,
            backgroundColor: colors.white,
            borderRadius: 12,
            paddingHorizontal: responsiveWidth(2),
            paddingVertical: responsiveWidth(2),
            alignItems: "center",
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 8,
            elevation: 6,
            minHeight: responsiveHeight(16),
            justifyContent: "space-between",
        },
        summaryCardTitle: {
            ...typography.body2,
            color: colors.textSecondary,
            textAlign: "center",
            marginTop: responsiveWidth(0.5),
            marginBottom: responsiveWidth(1),
            fontWeight: "600",
            lineHeight: responsiveWidth(3.5),
        },
        summaryCardValue: {
            ...typography.h4,
            color: colors.textDark,
            fontWeight: "800",
            textAlign: "center",
            marginBottom: responsiveWidth(1),
            letterSpacing: 0.25,
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
        },
        tonnageContainer: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: responsiveWidth(1),
            gap: responsiveWidth(0.5),
            borderRadius: 8,
            paddingHorizontal: responsiveWidth(1.5),
            paddingVertical: responsiveWidth(0.5),
        },
        tonnageText: {
            ...typography.caption,
            fontWeight: "600",
            fontSize: 11,
        },
        branchSection: {
            marginVertical: 12,
            paddingHorizontal: 10,
        },

        branchCardFull: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.cardBackground || "#fff",
            borderRadius: 16,
            padding: 16,
            elevation: 3,
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            width: "100%", // full width
            marginBottom: 10,
        },

        branchCardTextContainer: {
            flex: 1,
            marginLeft: 12,
        },

        branchCardTitle: {
            fontSize: 16,
            color: colors.text,
            fontWeight: "600",
            marginBottom: 4,
        },

        branchCardValue: {
            fontSize: 15,
            color: colors.primary,
            flexWrap: "wrap",
        },

        modalOverlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
        },

        modalContainer: {
            width: "90%",
            maxHeight: "80%",
            backgroundColor: colors.cardBackground || "#fff",
            borderRadius: 16,
            padding: 20,
        },

        modalTitle: {
            fontSize: 18,
            fontWeight: "600",
            marginBottom: 10,
            color: colors.text,
        },

        branchList: {
            marginVertical: 10,
        },

        branchItem: {
            paddingVertical: 10,
            borderBottomWidth: 0.5,
            borderColor: colors.border || "#ddd",
        },

        checkboxContainer: {
            flexDirection: "row",
            alignItems: "center",
        },

        branchName: {
            marginLeft: 10,
            fontSize: 16,
            color: colors.text,
        },

        doneButton: {
            backgroundColor: colors.primary,
            paddingVertical: 12,
            borderRadius: 10,
            alignItems: "center",
            marginTop: 12,
        },

        doneButtonText: {
            color: colors.white,
            fontWeight: "600",
            fontSize: 16,
        },
        datePickerRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        },

        dateWrapper: {
            flex: 1,
            marginRight: 8,
        },

        refreshButtonSmall: {
            backgroundColor: colors.primary,
            padding: 10,
            borderRadius: 8,
            justifyContent: "center",
            alignItems: "center",
        },

    });
