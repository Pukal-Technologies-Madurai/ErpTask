import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TextInput,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Alert,
    Pressable,
} from "react-native";
import React from "react";
import { useTheme } from "../../Context/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../Navigation/types";
import AppHeader from "../../Components/AppHeader";
import { useQuery } from "@tanstack/react-query";
import { getPurchaseOrderEntry } from "../../Api/Purchase";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";
import { responsiveHeight, responsiveWidth } from "../../constants/helper";
import DatePickerButton from "../../Components/DatePickerButton";

const PurchaseOrder = () => {
    const { colors, typography } = useTheme();
    const styles = getStyles(typography, colors);
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const [fromDate, setFromDate] = React.useState<Date>(new Date());
    const [toDate, setToDate] = React.useState<Date>(new Date());
    const [searchQuery, setSearchQuery] = React.useState("");
    const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");
    const [expandedOrderId, setExpandedOrderId] = React.useState<number | null>(
        null,
    );
    const [currentPage, setCurrentPage] = React.useState(1);
    const [refreshing, setRefreshing] = React.useState(false);

    const ITEMS_PER_PAGE = 10;

    const {
        data: purchaseOrderData = [],
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ["purchaseOrderReport", fromDate, toDate],
        queryFn: () => getPurchaseOrderEntry(fromDate, toDate),
        enabled: !!fromDate && !!toDate,
    });

    // Filter and sort data
    const filteredData = React.useMemo(() => {
        let filtered = purchaseOrderData.filter(
            (order: any) =>
                order.PartyName?.toLowerCase().includes(
                    searchQuery.toLowerCase(),
                ) ||
                order.PO_ID?.toLowerCase().includes(
                    searchQuery.toLowerCase(),
                ) ||
                order.OrderStatus?.toLowerCase().includes(
                    searchQuery.toLowerCase(),
                ),
        );

        return filtered.sort((a: any, b: any) => {
            const dateA = new Date(a.CreatedAt).getTime();
            const dateB = new Date(b.CreatedAt).getTime();
            return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
        });
    }, [purchaseOrderData, searchQuery, sortOrder]);

    // Calculate summary statistics
    const totalOrders = filteredData.length;
    const completedOrders = filteredData.filter(
        (order: any) => order.OrderStatus === "Completed",
    ).length;
    const totalValue = filteredData.reduce((sum: number, order: any) => {
        const orderValue =
            order.ItemDetails?.reduce((itemSum: number, item: any) => {
                return itemSum + item.Weight * item.Rate;
            }, 0) || 0;
        return sum + orderValue;
    }, 0);
    const pendingOrders = filteredData.filter(
        (order: any) => order.OrderStatus !== "Completed",
    ).length;

    // Pagination
    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    const paginatedData = filteredData.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE,
    );

    // Handle refresh
    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    // Format date
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    // Toggle order expansion
    const toggleOrderExpansion = (orderId: number) => {
        setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
    };

    // Render order card
    const renderOrderCard = (order: any) => {
        const isExpanded = expandedOrderId === order.Id;
        const orderValue =
            order.ItemDetails?.reduce((sum: number, item: any) => {
                return sum + item.Weight * item.Rate;
            }, 0) || 0;

        return (
            <View key={order.Id} style={styles.orderCard}>
                <Pressable
                    style={styles.orderHeader}
                    onPress={() => toggleOrderExpansion(order.Id)}>
                    <View style={styles.orderHeaderLeft}>
                        <View style={styles.orderIdContainer}>
                            <Text style={styles.orderId}>{order.PO_ID}</Text>
                            <View
                                style={[
                                    styles.statusBadge,
                                    {
                                        backgroundColor:
                                            order.OrderStatus === "Completed"
                                                ? colors.success + "20"
                                                : colors.warning + "20",
                                    },
                                ]}>
                                <Text
                                    style={[
                                        styles.statusText,
                                        {
                                            color:
                                                order.OrderStatus ===
                                                "Completed"
                                                    ? colors.success
                                                    : colors.warning,
                                        },
                                    ]}>
                                    {order.OrderStatus}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.partyName}>{order.PartyName}</Text>
                        <Text style={styles.orderDate}>
                            Created: {formatDate(order.CreatedAt)}
                        </Text>
                    </View>
                    <View style={styles.orderHeaderRight}>
                        <Text style={styles.orderValue}>
                            {formatCurrency(orderValue)}
                        </Text>
                        <Icon
                            name={isExpanded ? "expand-less" : "expand-more"}
                            size={24}
                            color={colors.textSecondary}
                        />
                    </View>
                </Pressable>

                {isExpanded && (
                    <View style={styles.orderDetails}>
                        {/* Order Info */}
                        <View style={styles.orderInfoSection}>
                            <Text style={styles.sectionTitle}>
                                Order Information
                            </Text>
                            <View style={styles.infoGrid}>
                                <View style={styles.infoItem}>
                                    <Text style={styles.infoLabel}>
                                        Loading Date:
                                    </Text>
                                    <Text style={styles.infoValue}>
                                        {formatDate(order.LoadingDate)}
                                    </Text>
                                </View>
                                <View style={styles.infoItem}>
                                    <Text style={styles.infoLabel}>
                                        Trade Confirm:
                                    </Text>
                                    <Text style={styles.infoValue}>
                                        {formatDate(order.TradeConfirmDate)}
                                    </Text>
                                </View>
                                <View style={styles.infoItem}>
                                    <Text style={styles.infoLabel}>
                                        Party Address:
                                    </Text>
                                    <Text style={styles.infoValue}>
                                        {order.PartyAddress}
                                    </Text>
                                </View>
                                {order.Remarks && (
                                    <View style={styles.infoItem}>
                                        <Text style={styles.infoLabel}>
                                            Remarks:
                                        </Text>
                                        <Text style={styles.infoValue}>
                                            {order.Remarks}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Items Section */}
                        <View style={styles.itemsSection}>
                            <Text style={styles.sectionTitle}>
                                Items ({order.ItemDetails?.length || 0})
                            </Text>
                            {order.ItemDetails?.map(
                                (item: any, index: number) => (
                                    <View key={item.Id} style={styles.itemCard}>
                                        <View style={styles.itemHeader}>
                                            <Text style={styles.itemName}>
                                                {item.ItemName}
                                            </Text>
                                            <Text style={styles.itemGroup}>
                                                {item.Stock_Group}
                                            </Text>
                                        </View>
                                        <View style={styles.itemDetails}>
                                            <View style={styles.itemDetailRow}>
                                                <Text
                                                    style={
                                                        styles.itemDetailLabel
                                                    }>
                                                    Weight:
                                                </Text>
                                                <Text
                                                    style={
                                                        styles.itemDetailValue
                                                    }>
                                                    {item.Weight} kg
                                                </Text>
                                            </View>
                                            <View style={styles.itemDetailRow}>
                                                <Text
                                                    style={
                                                        styles.itemDetailLabel
                                                    }>
                                                    Rate:
                                                </Text>
                                                <Text
                                                    style={
                                                        styles.itemDetailValue
                                                    }>
                                                    ₹{item.Rate}/kg
                                                </Text>
                                            </View>
                                            <View style={styles.itemDetailRow}>
                                                <Text
                                                    style={
                                                        styles.itemDetailLabel
                                                    }>
                                                    Total:
                                                </Text>
                                                <Text
                                                    style={
                                                        styles.itemDetailValue
                                                    }>
                                                    {formatCurrency(
                                                        item.Weight * item.Rate,
                                                    )}
                                                </Text>
                                            </View>
                                            <View style={styles.itemDetailRow}>
                                                <Text
                                                    style={
                                                        styles.itemDetailLabel
                                                    }>
                                                    Delivery:
                                                </Text>
                                                <Text
                                                    style={
                                                        styles.itemDetailValue
                                                    }>
                                                    {item.DeliveryLocation}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                ),
                            )}
                        </View>
                    </View>
                )}
            </View>
        );
    };

    if (error) {
        return (
            <SafeAreaView style={styles.container}>
                <AppHeader title="Purchase Orders" navigation={navigation} />
                <View style={styles.errorContainer}>
                    <Icon
                        name="error-outline"
                        size={48}
                        color={colors.accent}
                    />
                    <Text style={styles.errorText}>
                        Failed to load purchase orders
                    </Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={() => refetch()}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader title="Purchase Orders" navigation={navigation} />

            <ScrollView
                style={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                        tintColor={colors.primary}
                    />
                }>
                {/* Date Range Section */}
                <View style={styles.dateSection}>
                    <Text style={styles.sectionTitle}>Date Range</Text>
                    <View style={styles.dateRow}>
                        <View style={styles.datePickerContainer}>
                            <Text style={styles.dateLabel}>From Date</Text>
                            <DatePickerButton
                                title=""
                                date={fromDate}
                                style={styles.datePicker}
                                onDateChange={setFromDate}
                            />
                        </View>
                        <View style={styles.datePickerContainer}>
                            <Text style={styles.dateLabel}>To Date</Text>
                            <DatePickerButton
                                title=""
                                date={toDate}
                                style={styles.datePicker}
                                onDateChange={setToDate}
                            />
                        </View>
                    </View>
                </View>

                {/* Summary Cards */}
                <View style={styles.summarySection}>
                    <Text style={styles.sectionTitle}>Summary</Text>
                    <View style={styles.summaryGrid}>
                        <View style={styles.summaryCard}>
                            <Icon
                                name="receipt-long"
                                size={24}
                                color={colors.primary}
                            />
                            <Text style={styles.summaryValue}>
                                {totalOrders}
                            </Text>
                            <Text style={styles.summaryLabel}>
                                Total Orders
                            </Text>
                        </View>
                        <View style={styles.summaryCard}>
                            <Icon
                                name="currency-rupee"
                                size={24}
                                color={colors.warning}
                            />
                            <Text style={styles.summaryValue}>
                                {formatCurrency(totalValue)}
                            </Text>
                            <Text style={styles.summaryLabel}>Total Value</Text>
                        </View>
                    </View>
                </View>

                {/* Search and Sort Section */}
                <View style={styles.searchSection}>
                    <View style={styles.searchContainer}>
                        <Icon
                            name="search"
                            size={20}
                            color={colors.textSecondary}
                        />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by party, PO ID, or status..."
                            placeholderTextColor={colors.textSecondary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity
                                onPress={() => setSearchQuery("")}>
                                <Icon
                                    name="clear"
                                    size={20}
                                    color={colors.textSecondary}
                                />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity
                        style={styles.sortButton}
                        onPress={() =>
                            setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                        }>
                        <Icon
                            name={
                                sortOrder === "asc"
                                    ? "arrow-upward"
                                    : "arrow-downward"
                            }
                            size={20}
                            color={colors.primary}
                        />
                        <Text style={styles.sortButtonText}>Date</Text>
                    </TouchableOpacity>
                </View>

                {/* Orders List */}
                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator
                            size="large"
                            color={colors.primary}
                        />
                        <Text style={styles.loadingText}>
                            Loading purchase orders...
                        </Text>
                    </View>
                ) : filteredData.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Icon
                            name="inbox"
                            size={48}
                            color={colors.textSecondary}
                        />
                        <Text style={styles.emptyText}>
                            No purchase orders found
                        </Text>
                    </View>
                ) : (
                    <>
                        <View style={styles.ordersSection}>
                            <Text style={styles.sectionTitle}>
                                Orders ({filteredData.length})
                            </Text>
                            {paginatedData.map(renderOrderCard)}
                        </View>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <View style={styles.paginationContainer}>
                                <TouchableOpacity
                                    style={[
                                        styles.paginationButton,
                                        currentPage === 1 &&
                                            styles.paginationButtonDisabled,
                                    ]}
                                    onPress={() =>
                                        setCurrentPage(
                                            Math.max(1, currentPage - 1),
                                        )
                                    }
                                    disabled={currentPage === 1}>
                                    <Icon
                                        name="chevron-left"
                                        size={20}
                                        color={colors.primary}
                                    />
                                </TouchableOpacity>

                                <Text style={styles.paginationText}>
                                    Page {currentPage} of {totalPages}
                                </Text>

                                <TouchableOpacity
                                    style={[
                                        styles.paginationButton,
                                        currentPage === totalPages &&
                                            styles.paginationButtonDisabled,
                                    ]}
                                    onPress={() =>
                                        setCurrentPage(
                                            Math.min(
                                                totalPages,
                                                currentPage + 1,
                                            ),
                                        )
                                    }
                                    disabled={currentPage === totalPages}>
                                    <Icon
                                        name="chevron-right"
                                        size={20}
                                        color={colors.primary}
                                    />
                                </TouchableOpacity>
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default PurchaseOrder;

const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.primary,
        },
        content: {
            flex: 1,
            backgroundColor: colors.background,
        },

        // Date Section
        dateSection: {
            backgroundColor: colors.white,
            margin: responsiveWidth(4),
            padding: responsiveWidth(4),
            borderRadius: 16,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.12,
            shadowRadius: 6,
            elevation: 4,
        },
        dateRow: {
            flexDirection: "row",
            gap: responsiveWidth(4),
        },
        datePickerContainer: {
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: responsiveWidth(3),
        },
        dateLabel: {
            ...typography.body2,
            color: colors.textSecondary,
            fontWeight: "600",
            marginBottom: responsiveWidth(2),
            textAlign: "center",
        },
        datePicker: {
            backgroundColor: "transparent",
            alignItems: "center",
        },

        // Summary Section
        summarySection: {
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(4),
            marginBottom: responsiveWidth(4),
            padding: responsiveWidth(4),
            borderRadius: 12,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        summaryGrid: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: responsiveWidth(3),
        },
        summaryCard: {
            flex: 1,
            minWidth: "45%",
            backgroundColor: colors.surface,
            padding: responsiveWidth(3),
            borderRadius: 8,
            alignItems: "center",
            gap: responsiveWidth(1),
        },
        summaryValue: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "700",
            textAlign: "center",
        },
        summaryLabel: {
            ...typography.caption,
            color: colors.textSecondary,
            textAlign: "center",
        },

        // Search Section
        searchSection: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(3),
            marginHorizontal: responsiveWidth(4),
            marginBottom: responsiveWidth(4),
        },
        searchContainer: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.white,
            borderRadius: 8,
            paddingHorizontal: responsiveWidth(3),
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 2,
        },
        searchInput: {
            flex: 1,
            ...typography.body1,
            color: colors.text,
            paddingVertical: responsiveHeight(1.5),
            paddingHorizontal: responsiveWidth(2),
        },
        sortButton: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.white,
            paddingHorizontal: responsiveWidth(3),
            paddingVertical: responsiveHeight(1.5),
            borderRadius: 8,
            gap: responsiveWidth(1),
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 2,
        },
        sortButtonText: {
            ...typography.body2,
            color: colors.primary,
            fontWeight: "600",
        },

        // Section Title
        sectionTitle: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "600",
            marginBottom: responsiveHeight(2),
        },

        // Orders Section
        ordersSection: {
            marginHorizontal: responsiveWidth(4),
            marginBottom: responsiveWidth(4),
        },

        // Order Card
        orderCard: {
            backgroundColor: colors.white,
            borderRadius: 12,
            marginBottom: responsiveWidth(3),
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        orderHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: responsiveWidth(4),
        },
        orderHeaderLeft: {
            flex: 1,
            marginRight: responsiveWidth(3),
        },
        orderHeaderRight: {
            alignItems: "flex-end",
            gap: responsiveWidth(1),
        },
        orderIdContainer: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(2),
            marginBottom: responsiveWidth(1),
        },
        orderId: {
            ...typography.h6,
            color: colors.primary,
            fontWeight: "700",
        },
        statusBadge: {
            paddingHorizontal: responsiveWidth(2),
            paddingVertical: responsiveWidth(0.5),
            borderRadius: 12,
        },
        statusText: {
            ...typography.caption,
            fontWeight: "600",
            fontSize: responsiveWidth(2.5),
        },
        partyName: {
            ...typography.body1,
            color: colors.text,
            fontWeight: "600",
            marginBottom: responsiveWidth(0.5),
        },
        orderDate: {
            ...typography.caption,
            color: colors.textSecondary,
        },
        orderValue: {
            ...typography.h6,
            color: colors.success,
            fontWeight: "700",
        },

        // Order Details
        orderDetails: {
            borderTopWidth: 1,
            borderTopColor: colors.border,
            padding: responsiveWidth(4),
            gap: responsiveWidth(4),
        },

        // Order Info Section
        orderInfoSection: {},
        infoGrid: {
            gap: responsiveWidth(2),
        },
        infoItem: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingVertical: responsiveWidth(1),
        },
        infoLabel: {
            ...typography.body2,
            color: colors.textSecondary,
            flex: 1,
        },
        infoValue: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "500",
            flex: 2,
            textAlign: "right",
        },

        // Items Section
        itemsSection: {},
        itemCard: {
            backgroundColor: colors.surface,
            borderRadius: 8,
            padding: responsiveWidth(3),
            marginBottom: responsiveWidth(2),
        },
        itemHeader: {
            marginBottom: responsiveWidth(2),
        },
        itemName: {
            ...typography.body1,
            color: colors.text,
            fontWeight: "600",
            marginBottom: responsiveWidth(0.5),
        },
        itemGroup: {
            ...typography.caption,
            color: colors.primary,
            fontWeight: "500",
        },
        itemDetails: {
            gap: responsiveWidth(1),
        },
        itemDetailRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        itemDetailLabel: {
            ...typography.caption,
            color: colors.textSecondary,
        },
        itemDetailValue: {
            ...typography.caption,
            color: colors.text,
            fontWeight: "600",
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
            marginTop: responsiveHeight(2),
        },

        // Empty State
        emptyContainer: {
            alignItems: "center",
            justifyContent: "center",
            padding: responsiveHeight(4),
        },
        emptyText: {
            ...typography.body1,
            color: colors.textSecondary,
            marginTop: responsiveHeight(2),
        },

        // Error State
        errorContainer: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: responsiveWidth(4),
        },
        errorText: {
            ...typography.body1,
            color: colors.textSecondary,
            textAlign: "center",
            marginVertical: responsiveHeight(2),
        },
        retryButton: {
            backgroundColor: colors.primary,
            paddingHorizontal: responsiveWidth(6),
            paddingVertical: responsiveHeight(1.5),
            borderRadius: 8,
        },
        retryButtonText: {
            ...typography.body1,
            color: colors.white,
            fontWeight: "600",
        },

        // Pagination
        paginationContainer: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            padding: responsiveWidth(4),
            gap: responsiveWidth(4),
        },
        paginationButton: {
            width: responsiveWidth(10),
            height: responsiveWidth(10),
            borderRadius: responsiveWidth(5),
            backgroundColor: colors.white,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 2,
        },
        paginationButtonDisabled: {
            backgroundColor: colors.surface,
            opacity: 0.5,
        },
        paginationText: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "600",
        },
    });
