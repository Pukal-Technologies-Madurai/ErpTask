import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    TextInput,
} from "react-native";
import React from "react";
import Icon from "react-native-vector-icons/MaterialIcons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../Context/ThemeContext";
import AppHeader from "../../Components/AppHeader";
import FilterModal from "../../Components/FilterModal";
import { salesOrderInvoice } from "../../Api/Sales";
import { RootStackParamList } from "../../Navigation/types";
import { responsiveWidth, responsiveHeight } from "../../constants/helper";
import { formatCurrency, formatDate, formatTime } from "../../constants/utils";
import { usePagination } from "../../hooks/usePagination";
import PaginationControls from "../../Components/PaginationControls";
import { MMKV } from "react-native-mmkv";

const SaleOrder = ({ route }: { route: any }) => {
    const item = route.params || {};
    const branchIdProps = item.branchId;
//   console.log("branchId", branchIdProps);
    
    const { typography, colors } = useTheme();
     const storage = new MMKV();
    const styles = getStyles(typography, colors);
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const [fromDate, setFromDate] = React.useState<Date>(new Date());
    const [toDate, setToDate] = React.useState<Date>(new Date());
    const [userId, setUserId] = React.useState("");
    const [branchId, setBranchId] = React.useState("");
    const [searchQuery, setSearchQuery] = React.useState("");
    const [expandedOrders, setExpandedOrders] = React.useState<Set<string>>(
        new Set(),
    );
    const [modalVisible, setModalVisible] = React.useState(false);
    const [refreshing, setRefreshing] = React.useState(false);
    const [selectedBrand, setSelectedBrand] = React.useState<string>("");

    const ITEMS_PER_PAGE = 15;

    React.useEffect(() => {
            const userId =  storage.getString("userId")
            const branchId =  storage.getString("branchId")
            if (userId) setUserId(userId);
            if (branchId) setBranchId(branchId);
        }, [branchId]);

    const {
        data: saleOrder = [],
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ["saleOrder", fromDate, toDate],
        queryFn: () => salesOrderInvoice(fromDate, toDate, userId, branchIdProps),
        enabled: !!fromDate && !!toDate && !!userId && !!branchIdProps,
    });

    // Get unique brands and their totals from products
    const getBrandsWithTotals = () => {
        const brandTotals = new Map<
            string,
            { count: number; amount: number }
        >();

        saleOrder.forEach((order: any) => {
            order.Products_List?.forEach((product: any) => {
                if (product.BrandGet) {
                    const current = brandTotals.get(product.BrandGet) || {
                        count: 0,
                        amount: 0,
                    };
                    brandTotals.set(product.BrandGet, {
                        count: current.count + 1,
                        amount: current.amount + (product.Final_Amo || 0),
                    });
                }
            });
        });

        return Array.from(brandTotals.entries()).map(([brand, totals]) => ({
            brand,
            count: totals.count,
            amount: totals.amount,
        }));
    };

    // Filter data by brand and search query
    const getProcessedData = () => {
        let filtered = [...saleOrder];

        // Filter by search query
        if (searchQuery.trim()) {
            filtered = filtered.filter(
                order =>
                    order.So_Inv_No?.toLowerCase().includes(
                        searchQuery.toLowerCase(),
                    ) ||
                    order.Retailer_Name?.toLowerCase().includes(
                        searchQuery.toLowerCase(),
                    ) ||
                    order.Sales_Person_Name?.toLowerCase().includes(
                        searchQuery.toLowerCase(),
                    ) ||
                    order.Branch_Name?.toLowerCase().includes(
                        searchQuery.toLowerCase(),
                    ),
            );
        }

        // Filter by selected brand
        if (selectedBrand) {
            filtered = filtered.filter(order =>
                order.Products_List?.some(
                    (product: any) => product.BrandGet === selectedBrand,
                ),
            );
        }

        // Pagination
        return filtered;
    };

    const filteredData = getProcessedData();
    const totalAmount = filteredData.reduce(
        (sum, order) => sum + (order.Total_Invoice_value || 0),
        0,
    );

    const {
        currentPage,
        totalPages,
        totalItems,
        totalRecords,
        currentData: displayData,
        setCurrentPage,
    } = usePagination({
        data: filteredData,
        itemsPerPage: ITEMS_PER_PAGE,
    });

    // Toggle order expansion
    const toggleOrder = (orderId: string) => {
        const newExpanded = new Set(expandedOrders);
        if (newExpanded.has(orderId)) {
            newExpanded.delete(orderId);
        } else {
            newExpanded.add(orderId);
        }
        setExpandedOrders(newExpanded);
    };

    // Handle refresh
    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        try {
            await refetch();
        } finally {
            setRefreshing(false);
        }
    }, [refetch]);

    // Reset pagination when filters change
    React.useEffect(() => {
        setCurrentPage(1);
        setExpandedOrders(new Set());
    }, [searchQuery, selectedBrand]);

    // Summary Cards Component
    const SummaryCards = () => (
        <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
                <Icon name="shopping-cart" size={24} color={colors.primary} />
                <Text style={styles.summaryValue}>{totalItems}</Text>
                <Text style={styles.summaryLabel}>Orders</Text>
            </View>
            <View style={styles.summaryCard}>
                <Icon name="currency-rupee" size={24} color={colors.success} />
                <Text style={styles.summaryValue}>
                    {formatCurrency(totalAmount).replace("₹", "")}
                </Text>
                <Text style={styles.summaryLabel}>Total Amount</Text>
            </View>
        </View>
    );

    // Brand Filter Component
    const BrandFilter = () => {
        const brandsWithTotals = getBrandsWithTotals();

        return (
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.brandFilterContainer}>
                <TouchableOpacity
                    style={[
                        styles.brandFilterButton,
                        !selectedBrand && styles.brandFilterButtonActive,
                    ]}
                    onPress={() => setSelectedBrand("")}>
                    <Text
                        style={[
                            styles.brandFilterText,
                            !selectedBrand && styles.brandFilterTextActive,
                        ]}>
                        All
                    </Text>
                </TouchableOpacity>
                {brandsWithTotals.map(({ brand, count, amount }) => (
                    <TouchableOpacity
                        key={brand}
                        style={[
                            styles.brandFilterButton,
                            selectedBrand === brand &&
                                styles.brandFilterButtonActive,
                        ]}
                        onPress={() => setSelectedBrand(brand)}>
                        <Text
                            style={[
                                styles.brandFilterText,
                                selectedBrand === brand &&
                                    styles.brandFilterTextActive,
                            ]}>
                            {brand}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        );
    };

    // Sales Order Card Component
    const SaleOrderCard = ({ order }: { order: any }) => {
        const isExpanded = expandedOrders.has(order.S_Id);

        const getFormattedDate = (dateString: string) => {
            try {
                const date = new Date(dateString);
                return formatDate(date);
            } catch (error) {
                return "--";
            }
        };

        return (
            <View style={styles.orderCard}>
                <TouchableOpacity
                    style={styles.orderHeader}
                    onPress={() => toggleOrder(order.S_Id)}
                    activeOpacity={0.7}>
                    <View style={styles.orderHeaderLeft}>
                        <View style={styles.orderTopRow}>
                            <View style={styles.orderNumberContainer}>
                                <Text style={styles.orderNumber}>
                                    {order.So_Inv_No}
                                </Text>
                                <View style={styles.dateTimeContainer}>
                                    <Icon
                                        name="event"
                                        size={12}
                                        color={colors.textSecondary}
                                        style={styles.dateTimeIcon}
                                    />
                                    <Text style={styles.orderDateTime}>
                                        {order.Created_on
                                            ? getFormattedDate(order.Created_on)
                                            : "--"}
                                    </Text>
                                    <Icon
                                        name="schedule"
                                        size={12}
                                        color={colors.textSecondary}
                                        style={styles.dateTimeIcon}
                                    />
                                    <Text style={styles.orderDateTime}>
                                        {order.Created_on
                                            ? formatTime(order.Created_on)
                                            : "--"}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.orderAmount}>
                                {formatCurrency(order.Total_Invoice_value)}
                            </Text>
                        </View>
                        <View style={styles.orderBottomRow}>
                            <View style={styles.retailerContainer}>
                                <Icon
                                    name="store"
                                    size={14}
                                    color={colors.primary}
                                    style={styles.bottomRowIcon}
                                />
                                <Text
                                    style={styles.retailerName}
                                    numberOfLines={2}>
                                    {order.Retailer_Name}
                                </Text>
                            </View>
                            <View style={styles.salesPersonContainer}>
                                <Icon
                                    name="person"
                                    size={14}
                                    color={colors.textSecondary}
                                    style={styles.bottomRowIcon}
                                />
                                <Text style={styles.salesPerson}>
                                    {order.Sales_Person_Name}
                                </Text>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>

                {isExpanded && (
                    <View style={styles.orderDetails}>
                        {/* Essential Order Info */}
                        <View style={styles.essentialInfo}>
                            <View style={styles.infoGrid}>
                                <View style={styles.infoItem}>
                                    <Icon
                                        name="business"
                                        size={16}
                                        color={colors.primary}
                                    />
                                    <View style={styles.infoContent}>
                                        <Text style={styles.infoLabel}>
                                            Branch
                                        </Text>
                                        <Text
                                            style={styles.infoValue}
                                            numberOfLines={1}>
                                            {order.Branch_Name}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.infoItem}>
                                    <Icon
                                        name="account-balance"
                                        size={16}
                                        color={colors.success}
                                    />
                                    <View style={styles.infoContent}>
                                        <Text style={styles.infoLabel}>
                                            Before Tax
                                        </Text>
                                        <Text style={styles.infoValue}>
                                            {formatCurrency(
                                                order.Total_Before_Tax,
                                            )}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.infoItem}>
                                    <Icon
                                        name="receipt"
                                        size={16}
                                        color={colors.warning}
                                    />
                                    <View style={styles.infoContent}>
                                        <Text style={styles.infoLabel}>
                                            Tax
                                        </Text>
                                        <Text style={styles.infoValue}>
                                            {formatCurrency(order.Total_Tax)}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Products Table */}
                        {order.Products_List &&
                            order.Products_List.length > 0 && (
                                <View style={styles.productsTable}>
                                    <View style={styles.tableHeader}>
                                        <Text
                                            style={[
                                                styles.tableCell,
                                                styles.productNameCell,
                                            ]}>
                                            Product
                                        </Text>
                                        <Text style={styles.tableCell}>
                                            Qty
                                        </Text>
                                        <Text style={styles.tableCell}>
                                            Rate
                                        </Text>
                                        <Text style={styles.tableCell}>
                                            Amount
                                        </Text>
                                    </View>
                                    {order.Products_List.map(
                                        (product: any, index: number) => (
                                            <View
                                                key={index}
                                                style={styles.tableRow}>
                                                <Text
                                                    style={[
                                                        styles.tableCell,
                                                        styles.productNameCell,
                                                    ]}
                                                    numberOfLines={4}>
                                                    {product.Product_Name}
                                                </Text>
                                                <Text style={styles.tableCell}>
                                                    {product.Bill_Qty}
                                                </Text>
                                                <Text style={styles.tableCell}>
                                                    {formatCurrency(
                                                        product.Item_Rate,
                                                    ).replace("₹", "")}
                                                </Text>
                                                <Text style={styles.tableCell}>
                                                    {formatCurrency(
                                                        product.Final_Amo,
                                                    ).replace("₹", "")}
                                                </Text>
                                            </View>
                                        ),
                                    )}
                                </View>
                            )}
                    </View>
                )}
            </View>
        );
    };

    const handleCloseModal = () => {
        setModalVisible(false);
    };

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Sale Order"
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
                style={styles.scrollContainer}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                        tintColor={colors.primary}
                    />
                }
                showsVerticalScrollIndicator={false}>
                {/* Loading State */}
                {isLoading && (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>
                            Loading orders...
                        </Text>
                    </View>
                )}

                {/* Error State */}
                {!isLoading && error && (
                    <View style={styles.errorContainer}>
                        <Icon
                            name="error-outline"
                            size={48}
                            color={colors.accent}
                        />
                        <Text style={styles.errorText}>
                            Error loading orders
                        </Text>
                        <Text style={styles.errorSubtext}>
                            {error.message || "Please try again later"}
                        </Text>
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={onRefresh}>
                            <Icon
                                name="refresh"
                                size={20}
                                color={colors.white}
                            />
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Data Display */}
                {!isLoading && !error && saleOrder.length > 0 && (
                    <>
                        {/* Summary Cards */}
                        <SummaryCards />

                        {/* Brand Filter */}
                        <BrandFilter />

                        {/* Search Bar */}
                        <View style={styles.searchContainer}>
                            <Icon
                                name="search"
                                size={20}
                                color={colors.textSecondary}
                            />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search by order number, retailer, sales person..."
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

                        {/* Results Info */}
                        <View style={styles.resultsContainer}>
                            <Text style={styles.resultsText}>
                                Showing {displayData.length} orders (
                                {totalItems} filtered, {totalRecords} total
                                records)
                            </Text>
                        </View>

                        {/* Orders List */}
                        {displayData.map((order, index) => (
                            <SaleOrderCard key={order.S_Id} order={order} />
                        ))}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <PaginationControls
                                currentPage={currentPage}
                                totalPages={totalPages}
                                totalItems={totalItems}
                                totalRecords={totalRecords}
                                onPageChange={setCurrentPage}
                            />
                        )}
                    </>
                )}

                {/* No Data State */}
                {!isLoading && !error && saleOrder.length === 0 && (
                    <View style={styles.noDataContainer}>
                        <Icon
                            name="shopping-cart"
                            size={48}
                            color={colors.textSecondary}
                        />
                        <Text style={styles.noDataText}>No orders found</Text>
                        <Text style={styles.noDataSubtext}>
                            Please select a date range to view orders
                        </Text>
                    </View>
                )}

                {/* No Results State */}
                {!isLoading &&
                    !error &&
                    saleOrder.length > 0 &&
                    displayData.length === 0 && (
                        <View style={styles.noDataContainer}>
                            <Icon
                                name="search-off"
                                size={48}
                                color={colors.textSecondary}
                            />
                            <Text style={styles.noDataText}>
                                No results found
                            </Text>
                            <Text style={styles.noDataSubtext}>
                                Try adjusting your search or filter criteria
                            </Text>
                        </View>
                    )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default SaleOrder;

const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.primary,
        },
        scrollContainer: {
            backgroundColor: colors.white,
        },
        searchContainer: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(4),
            marginBottom: responsiveHeight(1.5),
            borderRadius: responsiveWidth(2),
            paddingHorizontal: responsiveWidth(4),
            paddingVertical: responsiveHeight(1),
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
            paddingVertical: 8,
        },
        summaryContainer: {
            flexDirection: "row",
            paddingHorizontal: responsiveWidth(4),
            marginVertical: responsiveHeight(2),
            gap: responsiveWidth(2),
        },
        summaryCard: {
            flex: 1,
            backgroundColor: colors.white,
            padding: responsiveWidth(3),
            borderRadius: responsiveWidth(2),
            alignItems: "center",
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 2,
        },
        summaryValue: {
            ...typography.body1,
            color: colors.text,
            fontWeight: "700",
            textAlign: "center",
        },
        summaryLabel: {
            ...typography.caption,
            color: colors.textSecondary,
            textAlign: "center",
        },
        orderCard: {
            backgroundColor: colors.white,
            borderRadius: responsiveWidth(2),
            marginHorizontal: responsiveWidth(4),
            marginVertical: responsiveHeight(0.8),
            elevation: 2,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
        },
        orderHeader: {
            padding: responsiveWidth(3),
        },
        orderHeaderLeft: {
            flex: 1,
            marginRight: 8,
        },
        orderTopRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
        },
        orderBottomRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        orderNumberContainer: {
            flexDirection: "column",
        },
        orderNumber: {
            ...typography.subtitle2,
            fontWeight: "600",
            color: colors.primary,
        },
        dateTimeContainer: {
            flexDirection: "row",
            alignItems: "center",
            marginTop: 4,
        },
        dateTimeIcon: {
            marginHorizontal: 4,
        },
        orderDateTime: {
            ...typography.caption,
            color: colors.textSecondary,
        },
        orderAmount: {
            ...typography.body1,
            color: colors.success,
            fontWeight: "600",
        },
        retailerContainer: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            marginRight: 8,
        },
        salesPersonContainer: {
            flexDirection: "row",
            alignItems: "center",
        },
        bottomRowIcon: {
            marginRight: 4,
        },
        retailerName: {
            ...typography.body2,
            color: colors.text,
            flex: 1,
        },
        salesPerson: {
            ...typography.caption,
            color: colors.textSecondary,
        },
        orderDetails: {
            paddingBottom: 12,
        },
        essentialInfo: {
            padding: responsiveWidth(2),
            backgroundColor: colors.background,
            borderRadius: responsiveWidth(2),
            marginHorizontal: responsiveWidth(3),
        },
        infoGrid: {
            flexDirection: "row",
            justifyContent: "space-between",
            gap: responsiveWidth(1.5),
        },
        infoItem: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.white,
            padding: responsiveWidth(2),
            borderRadius: responsiveWidth(1.5),
        },
        infoContent: {
            marginLeft: 8,
            flex: 1,
        },
        infoLabel: {
            ...typography.caption,
            color: colors.textSecondary,
        },
        infoValue: {
            ...typography.caption,
            color: colors.text,
            fontWeight: "600",
        },
        productsTable: {
            marginTop: responsiveHeight(1.5),
            marginHorizontal: responsiveWidth(3),
            borderWidth: 1,
            borderColor: colors.borderColor,
            borderRadius: responsiveWidth(1),
        },
        tableHeader: {
            flexDirection: "row",
            backgroundColor: colors.background,
            paddingVertical: responsiveHeight(1),
            paddingHorizontal: responsiveWidth(3),
            borderBottomWidth: 1,
            borderBottomColor: colors.borderColor,
        },
        tableRow: {
            flexDirection: "row",
            paddingVertical: responsiveHeight(1),
            paddingHorizontal: responsiveWidth(3),
            borderBottomWidth: 1,
            borderBottomColor: colors.borderColor,
        },
        tableCell: {
            flex: 1,
            ...typography.body2,
            color: colors.text,
        },
        productNameCell: {
            flex: 2,
        },
        // Brand Filter
        brandFilterContainer: {
            paddingHorizontal: responsiveWidth(4),
            marginVertical: responsiveHeight(1.5),
        },
        brandFilterButton: {
            paddingVertical: responsiveHeight(0.5),
            paddingHorizontal: responsiveWidth(4),
            marginRight: responsiveWidth(1.2),
            borderRadius: responsiveWidth(5),
            backgroundColor: colors.background,
            flexDirection: "column",
            alignItems: "center",
        },
        brandFilterButtonActive: {
            backgroundColor: colors.primary,
        },
        brandFilterText: {
            ...typography.caption,
            color: colors.textSecondary,
            marginBottom: 4,
        },
        brandFilterTextActive: {
            color: colors.white,
        },
        resultsContainer: {
            paddingHorizontal: 16,
            marginBottom: 8,
        },
        resultsText: {
            ...typography.caption,
            color: colors.textSecondary,
            textAlign: "center",
        },
        paginationContainer: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 16,
            gap: 16,
        },
        pageButton: {
            padding: 8,
            borderRadius: "50%",
            backgroundColor: colors.secondary,
        },
        pageButtonDisabled: {
            opacity: 0.5,
        },
        pageInfo: {
            ...typography.caption,
            color: colors.textSecondary,
        },
        loadingContainer: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
        },
        loadingText: {
            ...typography.body1,
            color: colors.textSecondary,
        },
        errorContainer: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
        },
        errorText: {
            ...typography.body1,
            color: colors.error,
            textAlign: "center",
            fontWeight: "600",
        },
        retryButton: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.primary,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 8,
            marginTop: 16,
        },
        retryButtonText: {
            ...typography.button,
            color: colors.white,
            marginLeft: 8,
            textAlign: "center",
            fontWeight: "600",
            marginTop: 16,
        },
        errorSubtext: {
            ...typography.body2,
            color: colors.textSecondary,
            textAlign: "center",
            marginTop: 8,
        },
        noDataContainer: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
        },
        noDataText: {
            ...typography.body1,
            color: colors.textSecondary,
            textAlign: "center",
            fontWeight: "600",
            marginTop: 16,
        },
        noDataSubtext: {
            ...typography.body2,
            color: colors.textSecondary,
            textAlign: "center",
            marginTop: 8,
        },
    });
