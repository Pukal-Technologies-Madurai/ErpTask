import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    TextInput,
    Image,
} from "react-native";
import React from "react";
import Icon from "react-native-vector-icons/MaterialIcons";
import { RootStackParamList } from "../../Navigation/types";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import AppHeader from "../../Components/AppHeader";
import { useTheme } from "../../Context/ThemeContext";
import { useQuery } from "@tanstack/react-query";
import { salesOrderInvoice } from "../../Api/Sales";
import DatePickerButton from "../../Components/DatePickerButton";
import { responsiveWidth, responsiveHeight } from "../../constants/helper";
import { SafeAreaView } from "react-native-safe-area-context";
import FilterModal from "../../Components/FilterModal";

const SaleOrder = () => {
    const { typography, colors } = useTheme();
    const styles = getStyles(typography, colors);
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const [fromDate, setFromDate] = React.useState<Date>(new Date());
    const [toDate, setToDate] = React.useState<Date>(new Date());
    const [searchQuery, setSearchQuery] = React.useState("");
    const [expandedOrders, setExpandedOrders] = React.useState<Set<string>>(
        new Set(),
    );
    const [modalVisible, setModalVisible] = React.useState(false);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [refreshing, setRefreshing] = React.useState(false);
    const [sortBy, setSortBy] = React.useState<"date" | "amount" | "retailer">(
        "date",
    );
    const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");

    const ITEMS_PER_PAGE = 15;

    const {
        data: saleOrder = [],
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ["saleOrder", fromDate, toDate],
        queryFn: () => salesOrderInvoice(fromDate, toDate),
        enabled: !!fromDate && !!toDate,
    });

    // Filter and sort data
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

        // Sort data
        filtered.sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case "date":
                    comparison =
                        new Date(a.So_Date).getTime() -
                        new Date(b.So_Date).getTime();
                    break;
                case "amount":
                    comparison = a.Total_Invoice_value - b.Total_Invoice_value;
                    break;
                case "retailer":
                    comparison = (a.Retailer_Name || "").localeCompare(
                        b.Retailer_Name || "",
                    );
                    break;
            }
            return sortOrder === "asc" ? comparison : -comparison;
        });

        // Pagination
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const paginatedData = filtered.slice(startIndex, endIndex);

        return {
            data: paginatedData,
            totalPages: Math.ceil(filtered.length / ITEMS_PER_PAGE),
            totalItems: filtered.length,
            totalRecords: saleOrder.length,
            totalAmount: filtered.reduce(
                (sum, order) => sum + (order.Total_Invoice_value || 0),
                0,
            ),
        };
    };

    const {
        data: displayData,
        totalPages,
        totalItems,
        totalRecords,
        totalAmount,
    } = getProcessedData();

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
    }, [searchQuery, sortBy, sortOrder]);

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2,
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

    // Sort Controls Component
    const SortControls = () => (
        <View style={styles.sortContainer}>
            <Text style={styles.sortLabel}>Sort by:</Text>
            <View style={styles.sortButtons}>
                {[
                    { key: "date", label: "Date", icon: "date-range" },
                    { key: "amount", label: "Amount", icon: "attach-money" },
                    { key: "retailer", label: "Retailer", icon: "person" },
                ].map(option => (
                    <TouchableOpacity
                        key={option.key}
                        style={[
                            styles.sortButton,
                            sortBy === option.key && styles.activeSortButton,
                        ]}
                        onPress={() => {
                            if (sortBy === option.key) {
                                setSortOrder(
                                    sortOrder === "asc" ? "desc" : "asc",
                                );
                            } else {
                                setSortBy(option.key as any);
                                setSortOrder("desc");
                            }
                        }}>
                        <Icon
                            name={
                                sortBy === option.key
                                    ? sortOrder === "asc"
                                        ? "arrow-upward"
                                        : "arrow-downward"
                                    : "sort"
                            }
                            size={16}
                            color={
                                sortBy === option.key
                                    ? colors.white
                                    : colors.textSecondary
                            }
                        />
                        <Text
                            style={[
                                styles.sortButtonText,
                                sortBy === option.key &&
                                    styles.activeSortButtonText,
                            ]}>
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    // Sales Order Card Component
    const SaleOrderCard = ({ order }: { order: any }) => {
        const isExpanded = expandedOrders.has(order.S_Id);

        return (
            <View style={styles.orderCard}>
                <TouchableOpacity
                    style={styles.orderHeader}
                    onPress={() => toggleOrder(order.S_Id)}
                    activeOpacity={0.7}>
                    <View style={styles.orderHeaderLeft}>
                        <View style={styles.orderNumberContainer}>
                            <Icon
                                name="shopping-cart"
                                size={18}
                                color={colors.primary}
                            />
                            <Text style={styles.orderNumber}>
                                {order.So_Inv_No}
                            </Text>
                        </View>
                        <Text style={styles.retailerName} numberOfLines={1}>
                            {order.Retailer_Name}
                        </Text>
                        <View style={styles.orderMeta}>
                            <Text style={styles.orderDate}>
                                {formatDate(order.So_Date)}
                            </Text>
                            <Text style={styles.orderAmount}>
                                {formatCurrency(order.Total_Invoice_value)}
                            </Text>
                        </View>
                        <Text style={styles.salesPerson}>
                            Sales: {order.Sales_Person_Name}
                        </Text>
                    </View>
                    <Icon
                        name={isExpanded ? "expand-less" : "expand-more"}
                        size={24}
                        color={colors.textSecondary}
                    />
                </TouchableOpacity>

                {isExpanded && (
                    <View style={styles.orderDetails}>
                        {/* Order Info */}
                        <View style={styles.orderInfoSection}>
                            <Text style={styles.sectionTitle}>
                                Order Details
                            </Text>
                            <View style={styles.infoGrid}>
                                <View style={styles.infoItem}>
                                    <Text style={styles.infoLabel}>
                                        Branch:
                                    </Text>
                                    <Text
                                        style={styles.infoValue}
                                        numberOfLines={2}>
                                        {order.Branch_Name}
                                    </Text>
                                </View>
                                <View style={styles.infoItem}>
                                    <Text style={styles.infoLabel}>
                                        Voucher Type:
                                    </Text>
                                    <Text style={styles.infoValue}>
                                        {order.VoucherTypeGet}
                                    </Text>
                                </View>
                                <View style={styles.infoItem}>
                                    <Text style={styles.infoLabel}>
                                        Created By:
                                    </Text>
                                    <Text style={styles.infoValue}>
                                        {order.Created_BY_Name}
                                    </Text>
                                </View>
                                <View style={styles.infoItem}>
                                    <Text style={styles.infoLabel}>
                                        Created On:
                                    </Text>
                                    <Text style={styles.infoValue}>
                                        {formatDate(order.Created_on)}
                                    </Text>
                                </View>
                                {order.Narration && (
                                    <View style={styles.infoItem}>
                                        <Text style={styles.infoLabel}>
                                            Notes:
                                        </Text>
                                        <Text style={styles.infoValue}>
                                            {order.Narration}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Amount Breakdown */}
                        <View style={styles.amountSection}>
                            <Text style={styles.sectionTitle}>
                                Amount Breakdown
                            </Text>
                            <View style={styles.amountGrid}>
                                <View style={styles.amountRow}>
                                    <Text style={styles.amountLabel}>
                                        Before Tax:
                                    </Text>
                                    <Text style={styles.amountValue}>
                                        {formatCurrency(order.Total_Before_Tax)}
                                    </Text>
                                </View>
                                <View style={styles.amountRow}>
                                    <Text style={styles.amountLabel}>
                                        CGST:
                                    </Text>
                                    <Text style={styles.amountValue}>
                                        {formatCurrency(order.CSGT_Total)}
                                    </Text>
                                </View>
                                <View style={styles.amountRow}>
                                    <Text style={styles.amountLabel}>
                                        SGST:
                                    </Text>
                                    <Text style={styles.amountValue}>
                                        {formatCurrency(order.SGST_Total)}
                                    </Text>
                                </View>
                                <View style={styles.amountRow}>
                                    <Text style={styles.amountLabel}>
                                        IGST:
                                    </Text>
                                    <Text style={styles.amountValue}>
                                        {formatCurrency(order.IGST_Total)}
                                    </Text>
                                </View>
                                <View style={styles.amountRow}>
                                    <Text style={styles.amountLabel}>
                                        Tax Total:
                                    </Text>
                                    <Text style={styles.amountValue}>
                                        {formatCurrency(order.Total_Tax)}
                                    </Text>
                                </View>
                                <View style={styles.amountRow}>
                                    <Text style={styles.amountLabel}>
                                        Round Off:
                                    </Text>
                                    <Text style={styles.amountValue}>
                                        {formatCurrency(order.Round_off)}
                                    </Text>
                                </View>
                                <View
                                    style={[styles.amountRow, styles.totalRow]}>
                                    <Text style={styles.totalLabel}>
                                        Total Amount:
                                    </Text>
                                    <Text style={styles.totalValue}>
                                        {formatCurrency(
                                            order.Total_Invoice_value,
                                        )}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Products List */}
                        {order.Products_List &&
                            order.Products_List.length > 0 && (
                                <View style={styles.productsSection}>
                                    <Text style={styles.sectionTitle}>
                                        Products ({order.Products_List.length})
                                    </Text>
                                    {order.Products_List.map(
                                        (product: any, index: number) => (
                                            <View
                                                key={index}
                                                style={styles.productCard}>
                                                <View
                                                    style={
                                                        styles.productHeader
                                                    }>
                                                    <View
                                                        style={
                                                            styles.productImageContainer
                                                        }>
                                                        {product.ProductImageUrl ? (
                                                            <Image
                                                                source={{
                                                                    uri: product.ProductImageUrl,
                                                                }}
                                                                style={
                                                                    styles.productImage
                                                                }
                                                                resizeMode="cover"
                                                            />
                                                        ) : (
                                                            <View
                                                                style={
                                                                    styles.productImagePlaceholder
                                                                }>
                                                                <Icon
                                                                    name="image"
                                                                    size={20}
                                                                    color={
                                                                        colors.textSecondary
                                                                    }
                                                                />
                                                            </View>
                                                        )}
                                                    </View>
                                                    <View
                                                        style={
                                                            styles.productInfo
                                                        }>
                                                        <Text
                                                            style={
                                                                styles.productName
                                                            }
                                                            numberOfLines={2}>
                                                            {
                                                                product.Product_Name
                                                            }
                                                        </Text>
                                                        <Text
                                                            style={
                                                                styles.productBrand
                                                            }>
                                                            {product.BrandGet}
                                                        </Text>
                                                        <Text
                                                            style={
                                                                styles.productUOM
                                                            }>
                                                            Unit: {product.UOM}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <View
                                                    style={
                                                        styles.productDetails
                                                    }>
                                                    <View
                                                        style={
                                                            styles.productRow
                                                        }>
                                                        <Text
                                                            style={
                                                                styles.productLabel
                                                            }>
                                                            Quantity:
                                                        </Text>
                                                        <Text
                                                            style={
                                                                styles.productValue
                                                            }>
                                                            {product.Bill_Qty}{" "}
                                                            {product.Unit_Name}
                                                        </Text>
                                                    </View>
                                                    <View
                                                        style={
                                                            styles.productRow
                                                        }>
                                                        <Text
                                                            style={
                                                                styles.productLabel
                                                            }>
                                                            Rate:
                                                        </Text>
                                                        <Text
                                                            style={
                                                                styles.productValue
                                                            }>
                                                            {formatCurrency(
                                                                product.Item_Rate,
                                                            )}
                                                        </Text>
                                                    </View>
                                                    <View
                                                        style={
                                                            styles.productRow
                                                        }>
                                                        <Text
                                                            style={
                                                                styles.productLabel
                                                            }>
                                                            Taxable Amount:
                                                        </Text>
                                                        <Text
                                                            style={
                                                                styles.productValue
                                                            }>
                                                            {formatCurrency(
                                                                product.Taxable_Amount,
                                                            )}
                                                        </Text>
                                                    </View>
                                                    <View
                                                        style={
                                                            styles.productRow
                                                        }>
                                                        <Text
                                                            style={
                                                                styles.productLabel
                                                            }>
                                                            Tax Rate:
                                                        </Text>
                                                        <Text
                                                            style={
                                                                styles.productValue
                                                            }>
                                                            {product.Tax_Rate}%
                                                        </Text>
                                                    </View>
                                                    <View
                                                        style={
                                                            styles.productRow
                                                        }>
                                                        <Text
                                                            style={
                                                                styles.productLabel
                                                            }>
                                                            Final Amount:
                                                        </Text>
                                                        <Text
                                                            style={[
                                                                styles.productValue,
                                                                styles.productAmount,
                                                            ]}>
                                                            {formatCurrency(
                                                                product.Final_Amo,
                                                            )}
                                                        </Text>
                                                    </View>
                                                    <View
                                                        style={
                                                            styles.productRow
                                                        }>
                                                        <Text
                                                            style={
                                                                styles.productLabel
                                                            }>
                                                            HSN Code:
                                                        </Text>
                                                        <Text
                                                            style={
                                                                styles.productValue
                                                            }>
                                                            {product.HSN_Code}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                        ),
                                    )}
                                </View>
                            )}

                        {/* Converted Invoices */}
                        {order.ConvertedInvoice &&
                            order.ConvertedInvoice.length > 0 && (
                                <View style={styles.convertedSection}>
                                    <Text style={styles.sectionTitle}>
                                        Converted Invoices (
                                        {order.ConvertedInvoice.length})
                                    </Text>
                                    {order.ConvertedInvoice.map(
                                        (invoice: any, index: number) => (
                                            <View
                                                key={index}
                                                style={styles.convertedCard}>
                                                <Text
                                                    style={
                                                        styles.convertedText
                                                    }>
                                                    {invoice.invoice_number ||
                                                        `Invoice ${index + 1}`}
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

    // Pagination Component
    const PaginationControls = () => (
        <View style={styles.paginationContainer}>
            <TouchableOpacity
                style={[
                    styles.pageButton,
                    currentPage === 1 && styles.pageButtonDisabled,
                ]}
                onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}>
                <Icon
                    name="chevron-left"
                    size={20}
                    color={
                        currentPage === 1
                            ? colors.textSecondary
                            : colors.primary
                    }
                />
            </TouchableOpacity>

            <Text style={styles.pageInfo}>
                Page {currentPage} of {totalPages} ({totalItems} orders,{" "}
                {totalRecords} total records)
            </Text>

            <TouchableOpacity
                style={[
                    styles.pageButton,
                    currentPage === totalPages && styles.pageButtonDisabled,
                ]}
                onPress={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}>
                <Icon
                    name="chevron-right"
                    size={20}
                    color={
                        currentPage === totalPages
                            ? colors.textSecondary
                            : colors.primary
                    }
                />
            </TouchableOpacity>
        </View>
    );

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

                        {/* Sort Controls */}
                        <SortControls />

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
                        {totalPages > 1 && <PaginationControls />}
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
            backgroundColor: colors.background,
        },
        sectionTitle: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "600",
            marginBottom: responsiveHeight(2),
        },
        datePicker: {
            backgroundColor: colors.primary + "20",
            padding: responsiveWidth(3),
            borderRadius: 8,
            alignItems: "center",
        },

        // Loading & Error States
        loadingContainer: {
            alignItems: "center",
            justifyContent: "center",
            padding: responsiveHeight(8),
        },
        loadingText: {
            ...typography.body1,
            color: colors.textSecondary,
        },
        errorContainer: {
            alignItems: "center",
            justifyContent: "center",
            padding: responsiveHeight(8),
            gap: responsiveWidth(3),
        },
        errorText: {
            ...typography.h6,
            color: colors.accent,
            textAlign: "center",
            fontWeight: "600",
        },
        errorSubtext: {
            ...typography.body2,
            color: colors.textSecondary,
            textAlign: "center",
        },
        retryButton: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primary,
            paddingHorizontal: responsiveWidth(6),
            paddingVertical: responsiveWidth(3),
            borderRadius: 8,
            gap: responsiveWidth(2),
            marginTop: responsiveWidth(2),
        },
        retryButtonText: {
            ...typography.body1,
            color: colors.white,
            fontWeight: "600",
        },

        // Summary Cards
        summaryContainer: {
            flexDirection: "row",
            paddingHorizontal: responsiveWidth(4),
            marginVertical: responsiveWidth(4),
            gap: responsiveWidth(2),
        },
        summaryCard: {
            flex: 1,
            backgroundColor: colors.white,
            padding: responsiveWidth(3),
            borderRadius: 12,
            alignItems: "center",
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        summaryValue: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "700",
            marginTop: responsiveWidth(1),
            textAlign: "center",
            fontSize: responsiveWidth(3.5),
        },
        summaryLabel: {
            ...typography.caption,
            color: colors.textSecondary,
            marginTop: responsiveWidth(0.5),
            textAlign: "center",
            fontSize: responsiveWidth(2.5),
        },

        // Sort Controls
        sortContainer: {
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(4),
            marginBottom: responsiveWidth(3),
            padding: responsiveWidth(4),
            borderRadius: 12,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        sortLabel: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "600",
            marginBottom: responsiveWidth(2),
        },
        sortButtons: {
            flexDirection: "row",
            gap: responsiveWidth(2),
        },
        sortButton: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: responsiveWidth(2.5),
            paddingHorizontal: responsiveWidth(2),
            borderRadius: 8,
            backgroundColor: colors.background,
            gap: responsiveWidth(1),
        },
        activeSortButton: {
            backgroundColor: colors.primary,
        },
        sortButtonText: {
            ...typography.caption,
            color: colors.textSecondary,
            fontWeight: "600",
        },
        activeSortButtonText: {
            color: colors.white,
        },

        // Search Container
        searchContainer: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(4),
            marginBottom: responsiveWidth(3),
            borderRadius: 12,
            paddingHorizontal: responsiveWidth(4),
            paddingVertical: responsiveWidth(2),
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
            gap: responsiveWidth(2),
        },
        searchInput: {
            flex: 1,
            ...typography.body1,
            color: colors.text,
            paddingVertical: responsiveWidth(2),
        },

        // Results Container
        resultsContainer: {
            paddingHorizontal: responsiveWidth(4),
            marginBottom: responsiveWidth(2),
        },
        resultsText: {
            ...typography.caption,
            color: colors.textSecondary,
            textAlign: "center",
        },

        // Order Card
        orderCard: {
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(4),
            marginBottom: responsiveWidth(3),
            borderRadius: 12,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
            overflow: "hidden",
        },
        orderHeader: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: responsiveWidth(4),
            backgroundColor: colors.primary + "10",
        },
        orderHeaderLeft: {
            flex: 1,
        },
        orderNumberContainer: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(2),
            marginBottom: responsiveWidth(2),
        },
        orderNumber: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "700",
            flex: 1,
        },
        retailerName: {
            ...typography.body1,
            color: colors.text,
            fontWeight: "600",
            marginBottom: responsiveWidth(1),
        },
        orderMeta: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: responsiveWidth(1),
        },
        orderDate: {
            ...typography.body2,
            color: colors.textSecondary,
        },
        orderAmount: {
            ...typography.h6,
            color: colors.primary,
            fontWeight: "700",
        },
        salesPerson: {
            ...typography.caption,
            color: colors.textSecondary,
            fontStyle: "italic",
        },

        // Order Details
        orderDetails: {
            padding: responsiveWidth(4),
            gap: responsiveWidth(4),
        },
        orderInfoSection: {
            backgroundColor: colors.background,
            padding: responsiveWidth(3),
            borderRadius: 8,
        },
        infoGrid: {
            gap: responsiveWidth(2),
        },
        infoItem: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
        },
        infoLabel: {
            ...typography.body2,
            color: colors.textSecondary,
            fontWeight: "500",
            minWidth: responsiveWidth(25),
        },
        infoValue: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "600",
            flex: 1,
            textAlign: "right",
        },

        // Amount Section
        amountSection: {
            backgroundColor: colors.primary + "05",
            padding: responsiveWidth(3),
            borderRadius: 8,
        },
        amountGrid: {
            gap: responsiveWidth(1.5),
        },
        amountRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        amountLabel: {
            ...typography.body2,
            color: colors.textSecondary,
            fontWeight: "500",
        },
        amountValue: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "600",
        },
        totalRow: {
            borderTopWidth: 1,
            borderTopColor: colors.primary + "20",
            paddingTop: responsiveWidth(2),
            marginTop: responsiveWidth(1),
        },
        totalLabel: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "700",
        },
        totalValue: {
            ...typography.h6,
            color: colors.primary,
            fontWeight: "700",
        },

        // Products Section
        productsSection: {
            backgroundColor: colors.background,
            padding: responsiveWidth(3),
            borderRadius: 8,
        },
        productCard: {
            backgroundColor: colors.white,
            padding: responsiveWidth(3),
            borderRadius: 8,
            marginTop: responsiveWidth(2),
            borderLeftWidth: 3,
            borderLeftColor: colors.primary,
        },
        productHeader: {
            flexDirection: "row",
            marginBottom: responsiveWidth(2),
            gap: responsiveWidth(3),
        },
        productImageContainer: {
            width: responsiveWidth(15),
            height: responsiveWidth(15),
        },
        productImage: {
            width: "100%",
            height: "100%",
            borderRadius: 8,
        },
        productImagePlaceholder: {
            width: "100%",
            height: "100%",
            backgroundColor: colors.background,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
        },
        productInfo: {
            flex: 1,
        },
        productName: {
            ...typography.body1,
            color: colors.text,
            fontWeight: "600",
            marginBottom: responsiveWidth(1),
        },
        productBrand: {
            ...typography.caption,
            color: colors.primary,
            fontWeight: "600",
            marginBottom: responsiveWidth(0.5),
        },
        productUOM: {
            ...typography.caption,
            color: colors.textSecondary,
        },
        productDetails: {
            gap: responsiveWidth(1),
        },
        productRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        productLabel: {
            ...typography.caption,
            color: colors.textSecondary,
            fontWeight: "500",
            minWidth: responsiveWidth(25),
        },
        productValue: {
            ...typography.caption,
            color: colors.text,
            fontWeight: "600",
        },
        productAmount: {
            color: colors.primary,
            fontWeight: "700",
        },

        // Converted Section
        convertedSection: {
            backgroundColor: colors.success + "05",
            padding: responsiveWidth(3),
            borderRadius: 8,
        },
        convertedCard: {
            backgroundColor: colors.white,
            padding: responsiveWidth(3),
            borderRadius: 8,
            marginTop: responsiveWidth(2),
            borderLeftWidth: 3,
            borderLeftColor: colors.success,
        },
        convertedText: {
            ...typography.body2,
            color: colors.text,
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

        // No Data State
        noDataContainer: {
            alignItems: "center",
            justifyContent: "center",
            padding: responsiveHeight(8),
            gap: responsiveWidth(2),
        },
        noDataText: {
            ...typography.h6,
            color: colors.textSecondary,
            textAlign: "center",
        },
        noDataSubtext: {
            ...typography.body2,
            color: colors.textSecondary,
            textAlign: "center",
        },
    });
