import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TextInput,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Pressable,
} from "react-native";
import React from "react";
import { useTheme } from "../../Context/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import Icon from "react-native-vector-icons/MaterialIcons";
import { getPurchaseOrderEntry } from "../../Api/Purchase";
import { RootStackParamList } from "../../Navigation/types";
import { responsiveHeight, responsiveWidth } from "../../constants/helper";
import AppHeader from "../../Components/AppHeader";
import FilterModal from "../../Components/FilterModal";
import { formatCurrency } from "../../constants/utils";

const PurchaseOrder = () => {
    const { colors, typography } = useTheme();
    const styles = getStyles(typography, colors);
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const [fromDate, setFromDate] = React.useState<Date>(new Date());
    const [toDate, setToDate] = React.useState<Date>(new Date());
    const [searchQuery, setSearchQuery] = React.useState("");
    const [expandedOrderId, setExpandedOrderId] = React.useState<number | null>(
        null,
    );
    const [currentPage, setCurrentPage] = React.useState(1);
    const [refreshing, setRefreshing] = React.useState(false);
    const [modalVisible, setModalVisible] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<"orders" | "items">(
        "orders",
    );

    const ITEMS_PER_PAGE = 10;

    // Define types for the order and item
    type OrderItem = {
        Stock_Item: string;
        Stock_Group: string;
        Weight: number;
        Rate: number;
    };

    type Order = {
        ItemDetails?: OrderItem[];
        PartyName?: string;
        PO_ID?: string;
        OrderStatus?: string;
        CreatedAt: string;
    };

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
            (order: Order) =>
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

        return filtered.sort((a: Order, b: Order) => {
            const dateA = new Date(a.CreatedAt).getTime();
            const dateB = new Date(b.CreatedAt).getTime();
            return dateB - dateA; // Sort by most recent first
        });
    }, [purchaseOrderData, searchQuery]);

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

    // Calculate total unique items
    const totalUniqueItems = [
        ...new Set(
            filteredData.flatMap(
                (order: Order) =>
                    order.ItemDetails?.map(item => item.Stock_Item) || [],
            ),
        ),
    ].length;
    const pendingOrders = filteredData.filter(
        (order: Order) => order.OrderStatus !== "Completed",
    ).length;

    // Calculate item-wise summary
    const itemWiseSummary = React.useMemo(() => {
        const summary: {
            [key: string]: {
                totalWeight: number;
                totalValue: number;
                count: number;
                stockGroup: string;
            };
        } = {};

        (filteredData as Order[]).forEach((order: Order) => {
            order.ItemDetails?.forEach((item: OrderItem) => {
                if (!summary[item.Stock_Item]) {
                    summary[item.Stock_Item] = {
                        totalWeight: 0,
                        totalValue: 0,
                        count: 0,
                        stockGroup: item.Stock_Group,
                    };
                }
                summary[item.Stock_Item].totalWeight += item.Weight;
                summary[item.Stock_Item].totalValue += item.Weight * item.Rate;
                summary[item.Stock_Item].count += 1;
            });
        });

        return Object.entries(summary).map(([name, data]) => ({
            name,
            ...data,
        }));
    }, [filteredData]); // Pagination
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

    // Format date
    const formatDate = (dateString: string, includeTime: boolean = false) => {
        const date = new Date(dateString);
        const dateStr = date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
        if (includeTime) {
            const timeStr = date.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
            });
            return `${dateStr}, ${timeStr}`;
        }
        return dateStr;
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
                        <View style={styles.orderDateContainer}>
                            <Icon
                                name="event"
                                size={14}
                                color={colors.textSecondary}
                            />
                            <Text style={styles.orderDate}>
                                {formatDate(order.CreatedAt, true)}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.orderHeaderRight}>
                        <Text style={styles.orderValue}>
                            {formatCurrency(orderValue)}
                        </Text>
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
                                <View style={styles.infoRow}>
                                    <View style={styles.infoItem}>
                                        <Text style={styles.infoLabel}>
                                            Loading Date
                                        </Text>
                                        <Text style={styles.infoValue}>
                                            {formatDate(order.LoadingDate)}
                                        </Text>
                                    </View>
                                    <View style={styles.infoItem}>
                                        <Text style={styles.infoLabel}>
                                            Trade Confirm
                                        </Text>
                                        <Text style={styles.infoValue}>
                                            {formatDate(order.TradeConfirmDate)}
                                        </Text>
                                    </View>
                                </View>
                                <View
                                    style={[styles.infoItem, styles.fullWidth]}>
                                    <Text style={styles.infoLabel}>
                                        Party Address
                                    </Text>
                                    <Text
                                        style={[
                                            styles.infoValue,
                                            styles.addressText,
                                        ]}>
                                        {order.PartyAddress || "-"}
                                    </Text>
                                </View>
                                {order.Remarks && (
                                    <View
                                        style={[
                                            styles.infoItem,
                                            styles.fullWidth,
                                        ]}>
                                        <Text style={styles.infoLabel}>
                                            Remarks
                                        </Text>
                                        <Text
                                            style={[
                                                styles.infoValue,
                                                styles.remarksText,
                                            ]}>
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

    const handleCloseModal = () => {
        setModalVisible(false);
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
            <AppHeader
                title="Purchase Orders"
                navigation={navigation}
                showRightIcon={true}
                rightIconLibrary="MaterialIcon"
                rightIconName="filter-list"
                onRightPress={() => setModalVisible(true)}
            />

            <FilterModal
                visible={modalVisible}
                fromDate={fromDate}
                toDate={toDate}
                onFromDateChange={setFromDate}
                onToDateChange={setToDate}
                onApply={() => setModalVisible(false)}
                onClose={handleCloseModal}
                showToDate={true}
                title="Filter Options"
                fromLabel="From Date"
                toLabel="To Date"
            />

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
                        <View style={styles.summaryCard}>
                            <Icon
                                name="inventory"
                                size={24}
                                color={colors.success}
                            />
                            <Text style={styles.summaryValue}>
                                {totalUniqueItems}
                            </Text>
                            <Text style={styles.summaryLabel}>Total Items</Text>
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
                </View>

                {/* Tab View */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[
                            styles.tabButton,
                            activeTab === "orders" && styles.activeTab,
                        ]}
                        onPress={() => setActiveTab("orders")}>
                        <Icon
                            name="receipt"
                            size={20}
                            color={
                                activeTab === "orders"
                                    ? colors.primary
                                    : colors.textSecondary
                            }
                        />
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === "orders" && styles.activeTabText,
                            ]}>
                            Orders
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.tabButton,
                            activeTab === "items" && styles.activeTab,
                        ]}
                        onPress={() => setActiveTab("items")}>
                        <Icon
                            name="inventory"
                            size={20}
                            color={
                                activeTab === "items"
                                    ? colors.primary
                                    : colors.textSecondary
                            }
                        />
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === "items" && styles.activeTabText,
                            ]}>
                            Items
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Content based on active tab */}
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
                        {activeTab === "orders" ? (
                            <View style={styles.ordersSection}>
                                <Text style={styles.sectionTitle}>
                                    Orders ({filteredData.length})
                                </Text>
                                {paginatedData.map(renderOrderCard)}
                            </View>
                        ) : (
                            <View style={styles.itemsSection}>
                                <Text style={styles.sectionTitle}>
                                    Items ({itemWiseSummary.length})
                                </Text>
                                {itemWiseSummary.map(
                                    (
                                        item: {
                                            name: string;
                                            totalWeight: number;
                                            totalValue: number;
                                            count: number;
                                            stockGroup: string;
                                        },
                                        index: number,
                                    ) => (
                                        <View
                                            key={item.name}
                                            style={styles.itemSummaryCard}>
                                            <View
                                                style={
                                                    styles.itemSummaryHeader
                                                }>
                                                <Text
                                                    style={
                                                        styles.summaryItemName
                                                    }>
                                                    {item.name}
                                                </Text>
                                                <Text
                                                    style={
                                                        styles.summaryItemGroup
                                                    }>
                                                    {item.stockGroup}
                                                </Text>
                                            </View>
                                            <View
                                                style={styles.itemSummaryStats}>
                                                <View style={styles.statItem}>
                                                    <Text
                                                        style={
                                                            styles.statLabel
                                                        }>
                                                        Total Weight
                                                    </Text>
                                                    <Text
                                                        style={
                                                            styles.statValue
                                                        }>
                                                        {item.totalWeight} kg
                                                    </Text>
                                                </View>
                                                <View style={styles.statItem}>
                                                    <Text
                                                        style={
                                                            styles.statLabel
                                                        }>
                                                        Total Value
                                                    </Text>
                                                    <Text
                                                        style={
                                                            styles.statValue
                                                        }>
                                                        {formatCurrency(
                                                            item.totalValue,
                                                        )}
                                                    </Text>
                                                </View>
                                                <View style={styles.statItem}>
                                                    <Text
                                                        style={
                                                            styles.statLabel
                                                        }>
                                                        Orders
                                                    </Text>
                                                    <Text
                                                        style={
                                                            styles.statValue
                                                        }>
                                                        {item.count}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    ),
                                )}
                            </View>
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <View style={styles.paginationContainer}>
                                <TouchableOpacity
                                    style={[
                                        styles.pageButton,
                                        currentPage === 1 &&
                                            styles.pageButtonDisabled,
                                    ]}
                                    onPress={() =>
                                        setCurrentPage(
                                            Math.max(1, currentPage - 1),
                                        )
                                    }
                                    disabled={currentPage === 1}>
                                    <Icon
                                        name="keyboard-arrow-left"
                                        size={24}
                                        color={
                                            currentPage === 1
                                                ? colors.textSecondary
                                                : colors.primary
                                        }
                                    />
                                </TouchableOpacity>

                                <Text style={styles.pageInfo}>
                                    Showing page {currentPage} of {totalPages} (
                                    {filteredData.length} total records)
                                </Text>

                                <TouchableOpacity
                                    style={[
                                        styles.pageButton,
                                        currentPage === totalPages &&
                                            styles.pageButtonDisabled,
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
                                        name="keyboard-arrow-right"
                                        size={24}
                                        color={
                                            currentPage === totalPages
                                                ? colors.textSecondary
                                                : colors.primary
                                        }
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

        // Summary Section
        summarySection: {
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(4),
            marginVertical: responsiveWidth(4),
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
            width: "33.33%",
            backgroundColor: colors.white,
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

        // Tab View
        tabContainer: {
            flexDirection: "row",
            marginHorizontal: responsiveWidth(4),
            marginBottom: responsiveWidth(4),
            backgroundColor: colors.white,
            borderRadius: 8,
            padding: responsiveWidth(1),
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 2,
        },
        tabButton: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: responsiveHeight(1.5),
            gap: responsiveWidth(2),
            borderRadius: 6,
        },
        activeTab: {
            backgroundColor: colors.primary + "15",
        },
        tabText: {
            ...typography.body2,
            color: colors.textSecondary,
            fontWeight: "500",
        },
        activeTabText: {
            color: colors.primary,
            fontWeight: "600",
        },

        // Item Summary Styles
        itemSummaryCard: {
            backgroundColor: colors.white,
            borderRadius: 12,
            padding: responsiveWidth(4),
            marginBottom: responsiveWidth(3),
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        itemSummaryHeader: {
            marginBottom: responsiveWidth(3),
        },
        summaryItemName: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "600",
            marginBottom: responsiveWidth(1),
        },
        summaryItemGroup: {
            ...typography.caption,
            color: colors.primary,
            fontWeight: "500",
        },
        itemSummaryStats: {
            flexDirection: "row",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: responsiveWidth(3),
        },
        statItem: {
            flex: 1,
            minWidth: "30%",
            backgroundColor: colors.grey + "60",
            padding: responsiveWidth(2),
            borderRadius: 8,
            alignItems: "center",
        },
        statLabel: {
            ...typography.caption,
            color: colors.textSecondary,
            marginBottom: responsiveWidth(1),
        },
        statValue: {
            ...typography.caption,
            color: colors.text,
            fontWeight: "600",
        },

        // Section Title
        sectionTitle: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "600",
            marginBottom: responsiveHeight(0.75),
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
        orderDateContainer: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(1),
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
            borderTopColor: colors.borderColor,
            padding: responsiveWidth(1),
            gap: responsiveWidth(0.75),
        },

        // Order Info Section
        orderInfoSection: {
            backgroundColor: colors.success + "8",
            borderRadius: 8,
            padding: responsiveWidth(1.5),
        },
        infoGrid: {
            gap: responsiveWidth(1.5),
        },
        infoRow: {
            flexDirection: "row",
            gap: responsiveWidth(1.5),
        },
        infoItem: {
            flex: 1,
            backgroundColor: colors.white,
            padding: responsiveWidth(1),
            borderRadius: 6,
            gap: responsiveWidth(1),
        },
        fullWidth: {
            flex: 1,
            width: "100%",
        },
        infoLabel: {
            ...typography.caption,
            color: colors.textSecondary,
        },
        infoValue: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "500",
        },
        addressText: {
            minHeight: responsiveHeight(3),
        },
        remarksText: {
            fontStyle: "italic",
        },

        // Items Section
        itemsSection: {
            marginHorizontal: responsiveWidth(3.5),
            marginBottom: responsiveWidth(3.5),
        },
        itemCard: {
            backgroundColor: colors.grey,
            borderRadius: 8,
            padding: responsiveWidth(1.5),
            marginBottom: responsiveWidth(0.75),
        },
        itemHeader: {
            marginBottom: responsiveWidth(0.75),
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
            justifyContent: "space-between",
            paddingHorizontal: responsiveWidth(4),
            paddingVertical: responsiveWidth(4),
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(4),
            marginVertical: responsiveWidth(2),
            borderRadius: 12,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        pageButton: {
            padding: responsiveWidth(2),
            borderRadius: 6,
        },
        pageButtonDisabled: {
            opacity: 0.5,
        },
        pageInfo: {
            ...typography.caption,
            color: colors.textSecondary,
            textAlign: "center",
            flex: 1,
        },
    });
