import {
    ScrollView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    RefreshControl,
    Pressable,
    Modal,
} from "react-native";
import React from "react";
import Icon from "react-native-vector-icons/MaterialIcons";
import { MMKV } from "react-native-mmkv";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";

import AppHeader from "../../Components/AppHeader";
import DatePickerButton from "../../Components/DatePickerButton";
import { formatDate } from "../../constants/utils";
import { useTheme } from "../../Context/ThemeContext";
import { RootStackParamList } from "../../Navigation/types";
import { responsiveHeight, responsiveWidth } from "../../constants/helper";

import { API } from "../../constants/api";
import { DeliveryPendingList } from "../../Api/Sales";
import { getpurchaseInvoiceEntry } from "../../Api/Purchase";
import { fetchReceiptList } from "../../Api/receipt";
import { itemStockInfo, itemWiseStock } from "../../Api/OpeningStock";
import { getSalesGraph } from "../../Api/Dashboard";
import { salesOrderInvoice, salesOrderPendingList } from "../../Api/Sales";

type Branch = {
    id: number;
    BranchName: string;
    HasAccess?: number;
    Created_by?: number;
    Created_at?: string;
};

const storage = new MMKV();

const BranchItem = React.memo(function BranchItem({
    branch,
    onPress,
    isSelected,
    colors,
    styles,
}: {
    branch: Branch;
    onPress: (b: Branch) => void;
    isSelected: boolean;
    colors: any;
    styles: any;
}) {
    return (
        <TouchableOpacity
            key={branch.id}
            style={styles.branchItem}
            activeOpacity={0.8}
            onPress={() => onPress(branch)}>
            <View style={styles.checkboxContainer}>
                <Icon
                    name={isSelected ? "check-box" : "check-box-outline-blank"}
                    size={24}
                    color={colors.primary}
                />
                <Text style={styles.branchName}>{branch.BranchName}</Text>
            </View>
        </TouchableOpacity>
    );
});

const Home = () => {
    const { colors, typography } = useTheme();
    const styles = getStyles(typography, colors);
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    // --- Read initial storage synchronously to avoid race with queries ---
    const companyId = storage.getString("companyId") ?? "";
    const userId = storage.getString("userId") ?? "";
    const initialUserTypeId = storage.getString("userTypeId") ?? "";
    const initialBranchId = storage.getString("branchId") ?? "";

    const ADMIN_USER_TYPES = ["0", "1", "2"];
    const isAdmin = ADMIN_USER_TYPES.includes(initialUserTypeId);

    const [branchId, setBranchId] = React.useState<string | number>(
        initialBranchId,
    );
    const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
    // toDate always mirrors selectedDate (same-day queries)
    const [toDate, setToDate] = React.useState<Date>(new Date());
    const [refreshing, setRefreshing] = React.useState(false);
    const [getBranch, setGetBranch] = React.useState<Branch[]>([]);
    const [selectedBranches, setSelectedBranches] = React.useState<Branch[]>(
        [],
    );
    const [branchLoading, setBranchLoading] = React.useState(false);
    // Unified filter modal
    const [filterModalVisible, setFilterModalVisible] = React.useState(false);
    // Single date draft (from = to when applied)
    const [tempSelectedDate, setTempSelectedDate] = React.useState<Date>(
        new Date(),
    );
    const [tempBranches, setTempBranches] = React.useState<Branch[]>([]);

    const today = new Date();
    const last30 = new Date();
    last30.setDate(today.getDate() - 30);
    const getMonthRange = () => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date();

        return {
            from: firstDay.toISOString().split("T")[0],
            to: lastDay.toISOString().split("T")[0],
        };
    };

    const { from, to } = getMonthRange();
    const pendingFromDate = last30;
    const pendingToDate = today;

    // --- Branch fetch on mount (unchanged, but cancellable) ---
    React.useEffect(() => {
        const controller = new AbortController();

        const fetchBranches = async () => {
            if (!userId) return;

            const url = API.getUserBranch(parseInt(userId, 10));
            try {
                const res = await fetch(url, { signal: controller.signal });
                if (!res.ok) throw new Error("Network response not ok");
                const json = await res.json();

                if (json.success && Array.isArray(json.data)) {
                    const accessibleBranches: Branch[] = json.data.filter(
                        (branch: Branch) => branch.HasAccess === 1,
                    );
                    setGetBranch(accessibleBranches);
                } else {
                    setGetBranch([]);
                }
            } catch (error: any) {
                if (error.name === "AbortError") {
                    // ignore
                } else {
                    console.error("Error fetching branches:", error);
                    setGetBranch([]);
                }
            }
        };

        fetchBranches();
        return () => controller.abort();
    }, []);

    const {
        data: saleOrderData = [],
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ["saleOrder", selectedDate, toDate, userId, branchId],
        queryFn: () =>
            salesOrderInvoice(selectedDate, toDate, userId, branchId),
        enabled: !!selectedDate && !!toDate && !!userId && !!branchId,
    });

    const {
        data: purchaseOrderEntryData = [],
        refetch: refetchPurchaseOrderEntry,
    } = useQuery({
        queryKey: [
            "purchaseOrderEntryData",
            selectedDate,
            toDate,
            userId,
            branchId,
        ],
        queryFn: () =>
            salesOrderInvoice(selectedDate, toDate, userId, Number(branchId)),
        enabled: !!selectedDate && !!toDate && !!userId && !!branchId,
    });

    const {
        data: purchaseInvoiceEntryData = [],
        refetch: refetchPurchaseInvoiceEntry,
    } = useQuery({
        queryKey: [
            "purchaseInvoiceEntryData",
            selectedDate,
            toDate,
            userId,
            branchId,
        ],
        queryFn: () =>
            getpurchaseInvoiceEntry(selectedDate, toDate, userId, branchId),
        enabled: !!selectedDate && !!toDate && !!userId && !!branchId,
    });

    const { data: itemStockValue = [], refetch: refetchItemStockValue } =
        useQuery({
            queryKey: ["itemStackValue", selectedDate],
            queryFn: () => itemStockInfo(selectedDate),
            enabled: !!selectedDate,
        });

    const { data: receiptList = [], refetch: refetchReceiptList } = useQuery({
        queryKey: ["receiptList", selectedDate, toDate, userId, branchId],
        queryFn: () => fetchReceiptList(selectedDate, toDate, userId, branchId),
        enabled: !!selectedDate && !!toDate && !!userId && !!branchId,
    });

    const {
        data: DeliveryPendingData = [],
        refetch: refetchDeliveryPendingList,
    } = useQuery({
        queryKey: [
            "deliveryPendingList",
            selectedDate,
            toDate,
            userId,
            branchId,
        ],
        queryFn: () =>
            DeliveryPendingList(selectedDate, toDate, userId, branchId),
        enabled: !!selectedDate && !!toDate && !!userId && !!branchId,
    });

    const { data: salesGraphData = [], isLoading: salesGraphLoading } =
        useQuery({
            queryKey: ["salesGraph", from, to, companyId],
            queryFn: () => getSalesGraph(from, to, Number(companyId)),
            enabled: !!companyId,
        });

    const dayWiseData = React.useMemo(() => {
        if (!salesGraphData?.DayWise) return [];

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        return salesGraphData.DayWise.filter((item: any) => {
            const d = new Date(item.Invoice_Date);
            return (
                d.getMonth() === currentMonth && d.getFullYear() === currentYear
            );
        });
    }, [salesGraphData]);

    const totalSales = React.useMemo(() => {
        return (saleOrderData || []).reduce(
            (acc: number, item: { Total_Invoice_value?: number }) =>
                acc + (item.Total_Invoice_value || 0),
            0,
        );
    }, [saleOrderData]);

    const totaldelPend = React.useMemo(() => {
        return (DeliveryPendingData || []).reduce(
            (acc: number, item: { Total_Invoice_value?: number }) =>
                acc + (item.Total_Invoice_value || 0),
            0,
        );
    }, [DeliveryPendingData]);

    const totalReceipt = React.useMemo(() => {
        return (receiptList || []).reduce(
            (acc: number, item: { credit_amount?: number }) =>
                acc + (item.credit_amount || 0),
            0,
        );
    }, [receiptList]);

    const totalPurchaseInvoice = React.useMemo(() => {
        return (purchaseInvoiceEntryData || []).reduce(
            (acc: number, item: { Total_Invoice_value?: number }) =>
                acc + (item.Total_Invoice_value || 0),
            0,
        );
    }, [purchaseInvoiceEntryData]);

    const totalStockValue = React.useMemo(() => {
        return (itemStockValue || []).reduce(
            (acc: number, item: { CL_Value?: number }) =>
                acc + (item.CL_Value || 0),
            0,
        );
    }, [itemStockValue]);

    const totalPurchaseOrderEntry = React.useMemo(() => {
        return (purchaseOrderEntryData || []).reduce(
            (acc: number, current: any) => {
                if (!current.ItemDetails || !Array.isArray(current.ItemDetails))
                    return acc;
                const itemsSum = current.ItemDetails.reduce(
                    (itemAcc: number, item: any) => {
                        return itemAcc + (item.Weight || 0) * (item.Rate || 0);
                    },
                    0,
                );
                return acc + itemsSum;
            },
            0,
        );
    }, [purchaseOrderEntryData]);

    const formatNumber = React.useCallback((num: number) => {
        if (num >= 10000000) return `${(num / 10000000).toFixed(1)}Cr`;
        if (num >= 100000) return `${(num / 100000).toFixed(1)}L`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    }, []);

    const totalGraphValue = React.useMemo(() => {
        return dayWiseData.reduce(
            (acc: number, item: any) => acc + (item.Total_Invoice_value || 0),
            0,
        );
    }, [dayWiseData]);

    const totalInvoiceCountMonth = React.useMemo(() => {
        return dayWiseData.reduce(
            (acc: number, item: any) => acc + (item.Invoice_Count || 0),
            0,
        );
    }, [dayWiseData]);

    // Today's data from DayWise
    const todayData = React.useMemo(() => {
        if (!salesGraphData?.DayWise) return null;
        const todayStr = new Date().toISOString().split("T")[0];
        return (
            salesGraphData.DayWise.find((item: any) =>
                item.Invoice_Date?.startsWith(todayStr),
            ) ?? null
        );
    }, [salesGraphData]);

    const todayInvoiceValue = todayData?.Total_Invoice_value ?? 0;
    const todayInvoiceCount = todayData?.Invoice_Count ?? 0;

    const toggleTempBranch = React.useCallback((branch: Branch) => {
        setTempBranches(prev => {
            const exists = prev.some(b => b.id === branch.id);
            return exists
                ? prev.filter(b => b.id !== branch.id)
                : [...prev, branch];
        });
    }, []);

    const openFilterModal = React.useCallback(() => {
        // Seed temp state from currently applied values
        setTempSelectedDate(selectedDate);
        setTempBranches(selectedBranches);
        setFilterModalVisible(true);
    }, [selectedDate, selectedBranches]);

    const applyFilters = React.useCallback(async () => {
        setFilterModalVisible(false);

        // Apply single date as both from and to
        setSelectedDate(tempSelectedDate);
        setToDate(tempSelectedDate);

        // Apply branches
        let newBranchId = "";
        if (
            tempBranches.length === 0 ||
            tempBranches.length === getBranch.length
        ) {
            newBranchId = "";
        } else {
            newBranchId = tempBranches.map(b => b.id).join(",");
        }
        setSelectedBranches(tempBranches);
        setBranchId(newBranchId);
        if (newBranchId) {
            storage.set("branchId", newBranchId);
        } else {
            storage.delete("branchId");
        }

        if (branchLoading) return;
        setBranchLoading(true);
        try {
            const promises: Promise<any>[] = [];
            if (typeof refetch === "function") promises.push(refetch());
            if (typeof refetchPurchaseOrderEntry === "function")
                promises.push(refetchPurchaseOrderEntry());
            if (typeof refetchPurchaseInvoiceEntry === "function")
                promises.push(refetchPurchaseInvoiceEntry());
            if (typeof refetchItemStockValue === "function")
                promises.push(refetchItemStockValue());
            if (typeof refetchReceiptList === "function")
                promises.push(refetchReceiptList());
            if (typeof refetchDeliveryPendingList === "function")
                promises.push(refetchDeliveryPendingList());
            await Promise.all(promises);
        } finally {
            setBranchLoading(false);
        }
    }, [
        tempSelectedDate,
        tempBranches,
        branchLoading,
        getBranch,
        refetch,
        refetchPurchaseOrderEntry,
        refetchPurchaseInvoiceEntry,
        refetchItemStockValue,
        refetchReceiptList,
        refetchDeliveryPendingList,
    ]);

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        try {
            const p: Promise<any>[] = [];
            if (typeof refetch === "function") p.push(refetch());
            if (typeof refetchPurchaseOrderEntry === "function")
                p.push(refetchPurchaseOrderEntry());
            if (typeof refetchPurchaseInvoiceEntry === "function")
                p.push(refetchPurchaseInvoiceEntry());
            if (typeof refetchItemStockValue === "function")
                p.push(refetchItemStockValue());
            if (typeof refetchReceiptList === "function")
                p.push(refetchReceiptList());
            if (typeof refetchDeliveryPendingList === "function")
                p.push(refetchDeliveryPendingList());
            await Promise.all(p);
        } finally {
            setRefreshing(false);
        }
    }, [
        refetch,
        refetchPurchaseOrderEntry,
        refetchPurchaseInvoiceEntry,
        refetchItemStockValue,
        refetchReceiptList,
        refetchDeliveryPendingList,
    ]);

    return (
        <SafeAreaView style={[styles.container]} edges={["top"]}>
            <AppHeader
                navigation={navigation}
                showDrawer={true}
                name={storage.getString("name")}
                subtitle={storage.getString("companyName")}
                showRightIcon={isAdmin}
                rightIconLibrary="MaterialIcon"
                rightIconName="compare-arrows"
                onRightPress={() => navigation.navigate("CompanySwitch")}
                showRightIcon2={true}
                rightIconLibrary2="MaterialIcon"
                rightIconName2="filter-list"
                onRightPress2={openFilterModal}
            />

            {/* ── Unified Filter Modal (date range + branches) ── */}
            <Modal
                visible={filterModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setFilterModalVisible(false)}>
                <View style={styles.filterModalOverlay}>
                    <View style={styles.filterModalSheet}>
                        {/* Handle bar */}
                        <View style={styles.filterSheetHandle} />

                        {/* Header */}
                        <View style={styles.filterSheetHeader}>
                            <Text style={styles.filterSheetTitle}>Filters</Text>
                            <TouchableOpacity
                                onPress={() => setFilterModalVisible(false)}
                                hitSlop={{
                                    top: 10,
                                    bottom: 10,
                                    left: 10,
                                    right: 10,
                                }}>
                                <Icon
                                    name="close"
                                    size={22}
                                    color={colors.textSecondary}
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Single Date Picker */}
                        <Text style={styles.filterSectionLabel}>Date</Text>
                        <DatePickerButton
                            date={tempSelectedDate}
                            maxDate={new Date()}
                            onDateChange={setTempSelectedDate}
                            containerStyle={styles.filterDatePickerContainer}
                        />

                        {/* Branch Selection */}
                        <Text style={styles.filterSectionLabel}>Branches</Text>
                        <ScrollView
                            style={styles.filterBranchList}
                            showsVerticalScrollIndicator={false}>
                            {getBranch.map(branch => {
                                const isSelected = tempBranches.some(
                                    b => b.id === branch.id,
                                );
                                return (
                                    <TouchableOpacity
                                        key={branch.id}
                                        style={styles.filterBranchItem}
                                        activeOpacity={0.7}
                                        onPress={() =>
                                            toggleTempBranch(branch)
                                        }>
                                        <Icon
                                            name={
                                                isSelected
                                                    ? "check-box"
                                                    : "check-box-outline-blank"
                                            }
                                            size={22}
                                            color={colors.primary}
                                        />
                                        <Text style={styles.filterBranchName}>
                                            {branch.BranchName}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Apply Button */}
                        <TouchableOpacity
                            style={[
                                styles.filterApplyBtn,
                                branchLoading && { opacity: 0.6 },
                            ]}
                            onPress={applyFilters}
                            disabled={branchLoading}>
                            <Text style={styles.filterApplyText}>
                                {branchLoading
                                    ? "Applying..."
                                    : "Apply Filters"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

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
                {/* Active filter chip bar */}
                <View style={styles.activeFilterBar}>
                    <Icon name="date-range" size={14} color={colors.primary} />
                    <Text style={styles.activeFilterText}>
                        {formatDate(selectedDate)}
                    </Text>
                    {selectedBranches.length > 0 && (
                        <>
                            <View style={styles.activeFilterDot} />
                            <Icon
                                name="store"
                                size={14}
                                color={colors.primary}
                            />
                            <Text style={styles.activeFilterText}>
                                {selectedBranches
                                    .map(b => b.BranchName)
                                    .join(", ")}
                            </Text>
                        </>
                    )}
                    <TouchableOpacity
                        style={styles.activeFilterRefresh}
                        onPress={onRefresh}>
                        <Icon name="refresh" size={16} color={colors.white} />
                    </TouchableOpacity>
                </View>

                {/* Sales Overview Card — Month + Today */}
                <View style={styles.graphCardContainer}>
                    <View style={styles.graphCard}>
                        {/* Header row — non-interactive */}
                        <View style={styles.graphCardHeader}>
                            <View style={styles.graphCardHeaderLeft}>
                                <Icon
                                    name="insert-chart"
                                    size={18}
                                    color={colors.white}
                                />
                                <Text style={styles.graphCardHeaderText}>
                                    Sales Overview
                                </Text>
                            </View>
                        </View>

                        {/* Two panels — each independently pressable */}
                        <View style={styles.graphPanelsRow}>
                            {/* This Month → graphicalanalysis */}
                            <Pressable
                                style={({ pressed }) => [
                                    styles.graphPanel,
                                    pressed && { opacity: 0.7 },
                                ]}
                                onPress={() =>
                                    navigation.navigate("graphicalanalysis")
                                }>
                                <Text style={styles.graphPanelLabel}>
                                    This Month
                                </Text>
                                <Text style={styles.graphPanelValue}>
                                    ₹{formatNumber(totalGraphValue)}
                                </Text>
                                <View style={styles.graphPanelBadge}>
                                    <Icon
                                        name="receipt"
                                        size={11}
                                        color={colors.primary}
                                    />
                                    <Text style={styles.graphPanelBadgeText}>
                                        {totalInvoiceCountMonth} Invoices
                                    </Text>
                                </View>
                            </Pressable>

                            {/* Divider */}
                            <View style={styles.graphPanelDivider} />

                            {/* Today → invoiceSale */}
                            <Pressable
                                style={({ pressed }) => [
                                    styles.graphPanel,
                                    pressed && { opacity: 0.7 },
                                ]}
                                onPress={() =>
                                    navigation.navigate("invoiceSale", {
                                        branchId,
                                    })
                                }>
                                <Text style={styles.graphPanelLabel}>
                                    Today
                                </Text>
                                <Text
                                    style={[
                                        styles.graphPanelValue,
                                        {
                                            color:
                                                colors.accent ??
                                                colors.secondary,
                                        },
                                    ]}>
                                    ₹{formatNumber(todayInvoiceValue)}
                                </Text>
                                <View style={styles.graphPanelBadge}>
                                    <Icon
                                        name="receipt"
                                        size={11}
                                        color={
                                            colors.accent ?? colors.secondary
                                        }
                                    />
                                    <Text
                                        style={[
                                            styles.graphPanelBadgeText,
                                            {
                                                color:
                                                    colors.accent ??
                                                    colors.secondary,
                                            },
                                        ]}>
                                        {todayInvoiceCount} Invoices
                                    </Text>
                                </View>
                            </Pressable>
                        </View>
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

                    <View style={styles.gridContainer}>
                        {/* Sale Orders */}
                        <Pressable
                            style={styles.gridCell}
                            onPress={() =>
                                navigation.navigate("saleOrderInvoice", {
                                    branchId,
                                })
                            }>
                            <View
                                style={[
                                    styles.gridCard,
                                    { borderTopColor: colors.primary },
                                ]}>
                                <Icon
                                    name="shopping-cart"
                                    size={24}
                                    color={colors.primary}
                                />
                                <Text style={styles.gridLabel}>
                                    Sale Orders
                                </Text>
                                <Text style={styles.gridValue}>
                                    ₹{formatNumber(totalSales)}
                                </Text>
                            </View>
                        </Pressable>

                        {/* Purchase Orders */}
                        <Pressable
                            style={styles.gridCell}
                            onPress={() =>
                                navigation.navigate("purchaseOrder", {
                                    branchId,
                                })
                            }>
                            <View
                                style={[
                                    styles.gridCard,
                                    { borderTopColor: colors.info },
                                ]}>
                                <Icon
                                    name="assignment"
                                    size={24}
                                    color={colors.info}
                                />
                                <Text style={styles.gridLabel}>
                                    Purchase Orders
                                </Text>
                                <Text style={styles.gridValue}>
                                    ₹{formatNumber(totalPurchaseOrderEntry)}
                                </Text>
                            </View>
                        </Pressable>

                        {/* Purchase Invoices */}
                        <Pressable
                            style={styles.gridCell}
                            onPress={() =>
                                navigation.navigate("purchaseInvoice", {
                                    branchId,
                                })
                            }>
                            <View
                                style={[
                                    styles.gridCard,
                                    { borderTopColor: colors.warning },
                                ]}>
                                <Icon
                                    name="shopping-bag"
                                    size={24}
                                    color={colors.warning}
                                />
                                <Text style={styles.gridLabel}>
                                    Purchase Invoices
                                </Text>
                                <Text style={styles.gridValue}>
                                    ₹{formatNumber(totalPurchaseInvoice)}
                                </Text>
                            </View>
                        </Pressable>

                        {/* Stock Godownwise */}
                        <Pressable
                            style={styles.gridCell}
                            onPress={() => navigation.navigate("Stockgodown")}>
                            <View
                                style={[
                                    styles.gridCard,
                                    { borderTopColor: colors.sih },
                                ]}>
                                <Icon
                                    name="warehouse"
                                    size={24}
                                    color={colors.sih}
                                />
                                <Text style={styles.gridLabel}>
                                    Warehouse {"\n"} Stock
                                </Text>
                                <Text style={styles.gridValue}>
                                    ₹{formatNumber(totalStockValue)}
                                </Text>
                            </View>
                        </Pressable>

                        {/* Receipt */}
                        <Pressable
                            style={styles.gridCell}
                            onPress={() =>
                                navigation.navigate("receiptList", { branchId })
                            }>
                            <View
                                style={[
                                    styles.gridCard,
                                    { borderTopColor: colors.rec },
                                ]}>
                                <Icon
                                    name="receipt"
                                    size={24}
                                    color={colors.rec}
                                />
                                <Text style={styles.gridLabel}>Receipt</Text>
                                <Text style={styles.gridValue}>
                                    ₹{formatNumber(totalReceipt)}
                                </Text>
                            </View>
                        </Pressable>

                        {/* Delivery Pending */}
                        <Pressable
                            style={styles.gridCell}
                            onPress={() =>
                                navigation.navigate("deliveryPend", {
                                    branchId,
                                })
                            }>
                            <View
                                style={[
                                    styles.gridCard,
                                    { borderTopColor: colors.del },
                                ]}>
                                <Icon
                                    name="delivery-dining"
                                    size={24}
                                    color={colors.del}
                                />
                                <Text style={styles.gridLabel}>
                                    Delivery Pending
                                </Text>
                                <Text style={styles.gridValue}>
                                    ₹{formatNumber(totaldelPend)}
                                </Text>
                            </View>
                        </Pressable>

                        {/* Sundry DEB & CRE */}
                        <Pressable
                            style={styles.gridCell}
                            onPress={() =>
                                navigation.navigate("debtors", { branchId })
                            }>
                            <View
                                style={[
                                    styles.gridCard,
                                    { borderTopColor: colors.deb },
                                ]}>
                                <Icon
                                    name="credit-card-off"
                                    size={24}
                                    color={colors.deb}
                                />
                                <Text style={styles.gridLabel}>
                                    Sundry DEB {"\n"} & CRE
                                </Text>
                                <Text style={styles.gridValue}></Text>
                            </View>
                        </Pressable>

                        {/* Transaction */}
                        <Pressable
                            style={styles.gridCell}
                            onPress={() =>
                                navigation.navigate("transaction", { branchId })
                            }>
                            <View
                                style={[
                                    styles.gridCard,
                                    { borderTopColor: colors.tran },
                                ]}>
                                <Icon
                                    name="sync-alt"
                                    size={24}
                                    color={colors.tran}
                                />
                                <Text style={styles.gridLabel}>
                                    Transaction
                                </Text>
                                <Text style={styles.gridValue}></Text>
                            </View>
                        </Pressable>

                        {/* Expenses */}
                        <Pressable
                            style={styles.gridCell}
                            onPress={() =>
                                navigation.navigate("expenses", { branchId })
                            }>
                            <View
                                style={[
                                    styles.gridCard,
                                    { borderTopColor: colors.exp },
                                ]}>
                                <Icon
                                    name="payments"
                                    size={24}
                                    color={colors.exp}
                                />
                                <Text style={styles.gridLabel}>Expenses</Text>
                                <Text style={styles.gridValue}></Text>
                            </View>
                        </Pressable>

                        {/* Shet Sheet */}
                        <Pressable
                            style={styles.gridCell}
                            onPress={() => navigation.navigate("ShetSheet")}>
                            <View
                                style={[
                                    styles.gridCard,
                                    { borderTopColor: colors.exp },
                                ]}>
                                <Icon
                                    name="description"
                                    size={24}
                                    color={colors.exp}
                                />
                                <Text style={styles.gridLabel}>Shet Sheet</Text>
                                <Text style={styles.gridValue}></Text>
                            </View>
                        </Pressable>
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

        // Active filter chip bar (replaces the old date picker bar)
        activeFilterBar: {
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 6,
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(3),
            marginTop: 8,
            marginBottom: 6,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.07,
            shadowRadius: 3,
            elevation: 2,
        },
        activeFilterText: {
            ...typography.caption,
            color: colors.primary,
            fontWeight: "600",
            flexShrink: 1,
        },
        activeFilterDot: {
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.textSecondary,
        },
        activeFilterRefresh: {
            marginLeft: "auto" as any,
            backgroundColor: colors.primary,
            padding: 5,
            borderRadius: 6,
        },
        // Filter modal (bottom sheet)
        filterModalOverlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "flex-end",
        },
        filterModalSheet: {
            backgroundColor: colors.white,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: 16,
            paddingBottom: 24,
            maxHeight: "85%",
        },
        filterSheetHandle: {
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border ?? "#E5E7EB",
            alignSelf: "center",
            marginTop: 10,
            marginBottom: 6,
        },
        filterSheetHeader: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 10,
            borderBottomWidth: 0.5,
            borderColor: colors.border ?? "#E5E7EB",
            marginBottom: 14,
        },
        filterSheetTitle: {
            ...typography.h6,
            fontWeight: "700",
            color: colors.text,
        },
        filterSectionLabel: {
            ...typography.caption,
            color: colors.textSecondary,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 0.8,
            marginBottom: 8,
        },
        filterDateRow: {
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 18,
        },
        filterDateCell: {
            flex: 1,
        },
        filterDateCellLabel: {
            ...typography.caption,
            color: colors.textSecondary,
            marginBottom: 4,
            fontWeight: "600",
        },
        filterDatePickerContainer: {
            marginBottom: 0,
        },
        filterDateArrow: {
            marginHorizontal: 8,
            marginTop: 16,
        },
        filterBranchList: {
            maxHeight: responsiveHeight(25),
            marginBottom: 16,
        },
        filterBranchItem: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 9,
            borderBottomWidth: 0.5,
            borderColor: colors.border ?? "#E5E7EB",
            gap: 10,
        },
        filterBranchName: {
            ...typography.body1,
            color: colors.text,
            flex: 1,
        },
        filterApplyBtn: {
            backgroundColor: colors.primary,
            paddingVertical: 12,
            borderRadius: 10,
            alignItems: "center",
        },
        filterApplyText: {
            color: colors.white,
            fontWeight: "700",
            fontSize: 15,
        },

        // Graph / Sales Overview card
        graphCardContainer: {
            marginHorizontal: responsiveWidth(3),
            marginBottom: 6,
        },
        graphCard: {
            backgroundColor: colors.white,
            borderRadius: 12,
            overflow: "hidden",
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 6,
            elevation: 4,
        },
        // Header strip
        graphCardHeader: {
            backgroundColor: colors.primary,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 14,
            paddingVertical: 10,
        },
        graphCardHeaderLeft: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
        },
        graphCardHeaderText: {
            ...typography.body2,
            color: colors.white,
            fontWeight: "700",
            letterSpacing: 0.3,
        },
        graphCardHeaderRight: {
            opacity: 0.8,
        },
        // Two-panel body
        graphPanelsRow: {
            flexDirection: "row",
            paddingHorizontal: 8,
            paddingVertical: 14,
        },
        graphPanel: {
            flex: 1,
            alignItems: "center",
            gap: 4,
        },
        graphPanelDivider: {
            width: 1,
            backgroundColor: colors.border ?? "#E5E7EB",
            marginVertical: 4,
        },
        graphPanelLabel: {
            ...typography.caption,
            color: colors.textSecondary,
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: 0.6,
        },
        graphPanelValue: {
            ...typography.h5,
            fontWeight: "800",
            color: colors.primary,
        },
        graphPanelBadge: {
            flexDirection: "row",
            alignItems: "center",
            gap: 3,
            backgroundColor: colors.primary + "12",
            paddingHorizontal: 7,
            paddingVertical: 2,
            borderRadius: 20,
        },
        graphPanelBadgeText: {
            ...typography.caption,
            color: colors.primary,
            fontWeight: "600",
        },

        // Branch pill bar
        branchSection: {
            marginHorizontal: responsiveWidth(3),
            marginBottom: 6,
        },
        branchCardFull: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.white,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
            shadowColor: colors.black,
            shadowOpacity: 0.07,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 1 },
            elevation: 2,
        },
        branchCardTextContainer: {
            flex: 1,
            marginLeft: 8,
        },
        branchCardTitle: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "600",
        },
        branchCardValue: {
            ...typography.caption,
            color: colors.primary,
        },

        // Section header
        sectionTitle: {
            ...typography.body2,
            color: colors.textSecondary,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 0.8,
            marginHorizontal: responsiveWidth(3),
            marginVertical: 8,
        },

        // Loading State
        loadingContainer: {
            alignItems: "center",
            justifyContent: "center",
            padding: responsiveHeight(2),
        },
        loadingText: {
            ...typography.body2,
            color: colors.textSecondary,
        },

        // Summary 3-column grid
        summarySection: {
            paddingHorizontal: responsiveWidth(2),
            paddingBottom: 16,
        },
        gridContainer: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            paddingHorizontal: responsiveWidth(2),
            gap: responsiveWidth(4),
        },
        gridCell: {
            width:
                (responsiveWidth(90) -
                    responsiveWidth(4) -
                    responsiveWidth(4)) /
                3,
        },
        gridCard: {
            backgroundColor: colors.white,
            borderRadius: 10,
            paddingVertical: 12,
            paddingHorizontal: 6,
            alignItems: "center",
            justifyContent: "center",
            borderTopWidth: 3,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.07,
            shadowRadius: 4,
            elevation: 2,
            minHeight: responsiveHeight(12),
            gap: 4,
        },
        gridLabel: {
            ...typography.overline,
            color: colors.textSecondary,
            textAlign: "center",
            fontWeight: "600",
            marginTop: 2,
        },
        gridValue: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "800",
            textAlign: "center",
        },
        // Legacy stubs (unused but kept to avoid TS errors)
        metricCard: { flexDirection: "row" },
        metricCardContent: { flex: 1 },
        metricCardLabel: { ...typography.caption },
        metricCardValue: { ...typography.h6, fontWeight: "700" },

        // Modal
        modalOverlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
        },
        modalContainer: {
            width: "90%",
            maxHeight: "80%",
            backgroundColor: colors.white,
            borderRadius: 16,
            padding: 16,
        },
        modalTitle: {
            ...typography.h6,
            fontWeight: "600",
            marginBottom: 8,
            color: colors.text,
        },
        branchList: {
            marginVertical: 6,
        },
        branchItem: {
            paddingVertical: 8,
            borderBottomWidth: 0.5,
            borderColor: colors.borderColor || "#ddd",
        },
        checkboxContainer: {
            flexDirection: "row",
            alignItems: "center",
        },
        branchName: {
            marginLeft: 10,
            ...typography.body1,
            color: colors.text,
        },
        doneButton: {
            backgroundColor: colors.primary,
            paddingVertical: 10,
            borderRadius: 8,
            alignItems: "center",
            marginTop: 10,
        },
        doneButtonText: {
            color: colors.white,
            fontWeight: "600",
            fontSize: 15,
        },

        // Unused legacy keys kept for safety
        refreshButton: {
            backgroundColor: colors.primary,
            padding: responsiveWidth(2.5),
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
        },
        changeContainer: { flexDirection: "row" },
        changeText: { ...typography.body2, fontWeight: "700" },
        summaryCards: {},
        summaryRow: { flexDirection: "row" },
        summaryCard: { flex: 1 },
        summaryCardTitle: { ...typography.caption },
        summaryCardValue: { ...typography.h6, fontWeight: "700" },
        dateInfoContainer: { alignItems: "center" },
        dateInfoText: { ...typography.caption },
    });
