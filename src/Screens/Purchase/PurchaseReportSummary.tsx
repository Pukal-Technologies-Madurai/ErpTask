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
import FontAwesomeIcon from "react-native-vector-icons/FontAwesome6";
import { useNavigation } from "@react-navigation/native";
import { storage } from "../../constants/storage";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import AppHeader from "../../Components/AppHeader";
import FilterModal from "../../Components/FilterModal";
import { getPurchaseReport } from "../../Api/Purchase";
import { formatCurrency } from "../../constants/utils";
import { useTheme } from "../../Context/ThemeContext";
import { RootStackParamList } from "../../Navigation/types";
import { responsiveWidth, responsiveHeight } from "../../constants/helper";

const PurchaseReportSummary = () => {
    const { colors, typography } = useTheme();
    const styles = getStyles(typography, colors);
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const [companyId, setCompanyId] = React.useState("");
    const [modalVisible, setModalVisible] = React.useState(false);
    const [fromDate, setFromDate] = React.useState<Date>(new Date());
    const [toDate, setToDate] = React.useState<Date>(new Date());
    const [searchQuery, setSearchQuery] = React.useState("");
    const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
        new Set(),
    );
    const [expandedItems, setExpandedItems] = React.useState<Set<string>>(
        new Set(),
    );
    const [currentPage, setCurrentPage] = React.useState(1);
    const [refreshing, setRefreshing] = React.useState(false);

    const ITEMS_PER_PAGE = 10;

    React.useEffect(() => {
        const companyId = storage.getString("companyId");
        if (companyId) setCompanyId(companyId);
    }, []);

    const {
        data: purchaseData = [],
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ["purchaseReport", fromDate, toDate, companyId],
        queryFn: () => getPurchaseReport(fromDate, toDate, companyId),
        enabled: !!fromDate && !!toDate && !!companyId,
    });

    // Process and filter data
    const getProcessedData = () => {
        let filtered = [...purchaseData];

        // Filter by search query
        if (searchQuery.trim()) {
            filtered = filtered.filter(
                group =>
                    group.Stock_Group?.toLowerCase().includes(
                        searchQuery.toLowerCase(),
                    ) ||
                    group.product_details?.some(
                        (product: any) =>
                            product.Item_Name_Modified?.toLowerCase().includes(
                                searchQuery.toLowerCase(),
                            ) ||
                            product.product_details_1?.some(
                                (detail: any) =>
                                    detail.po_no
                                        ?.toLowerCase()
                                        .includes(searchQuery.toLowerCase()) ||
                                    detail.ledger_name
                                        ?.toLowerCase()
                                        .includes(searchQuery.toLowerCase()) ||
                                    detail.stock_item_name
                                        ?.toLowerCase()
                                        .includes(searchQuery.toLowerCase()),
                            ),
                    ),
            );
        }

        // Pagination
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const paginatedData = filtered.slice(startIndex, endIndex);

        return {
            data: paginatedData,
            totalPages: Math.ceil(filtered.length / ITEMS_PER_PAGE),
            totalItems: filtered.length,
            totalRecords: purchaseData.length,
            totalAmount: calculateTotalAmount(filtered),
            totalQuantity: calculateTotalQuantity(filtered),
        };
    };

    // Calculate total amount for a group
    const calculateGroupTotal = (group: any) => {
        if (!group.product_details || !Array.isArray(group.product_details))
            return 0;

        return group.product_details.reduce((acc: number, product: any) => {
            if (
                !product.product_details_1 ||
                !Array.isArray(product.product_details_1)
            )
                return acc;

            const productTotal = product.product_details_1.reduce(
                (sum: number, detail: any) => sum + (detail.amount || 0),
                0,
            );
            return acc + productTotal;
        }, 0);
    };

    // Calculate total quantity for a group
    const calculateGroupQuantity = (group: any) => {
        if (!group.product_details || !Array.isArray(group.product_details))
            return 0;

        return group.product_details.reduce((acc: number, product: any) => {
            if (
                !product.product_details_1 ||
                !Array.isArray(product.product_details_1)
            )
                return acc;

            const productQuantity = product.product_details_1.reduce(
                (sum: number, detail: any) => sum + (detail.bill_qty || 0),
                0,
            );
            return acc + productQuantity;
        }, 0);
    };

    // Calculate total amount for all groups
    const calculateTotalAmount = (groups: any[]) => {
        return groups.reduce(
            (acc: number, group: any) => acc + calculateGroupTotal(group),
            0,
        );
    };

    // Calculate total quantity for all groups
    const calculateTotalQuantity = (groups: any[]) => {
        return groups.reduce(
            (acc: number, group: any) => acc + calculateGroupQuantity(group),
            0,
        );
    };

    const {
        data: displayData,
        totalPages,
        totalItems,
        totalRecords,
        totalAmount,
        totalQuantity,
    } = getProcessedData();

    // Toggle group expansion
    const toggleGroup = (groupName: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(groupName)) {
            newExpanded.delete(groupName);
        } else {
            newExpanded.add(groupName);
        }
        setExpandedGroups(newExpanded);
    };

    // Toggle item expansion
    const toggleItem = (itemKey: string) => {
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(itemKey)) {
            newExpanded.delete(itemKey);
        } else {
            newExpanded.add(itemKey);
        }
        setExpandedItems(newExpanded);
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
        setExpandedGroups(new Set());
        setExpandedItems(new Set());
    }, [searchQuery]);

    // Format number
    const formatNumber = (num: number) => {
        if (num >= 10000000) return `${(num / 10000000).toFixed(1)}Cr`;
        if (num >= 100000) return `${(num / 100000).toFixed(1)}L`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toLocaleString();
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
                <Icon name="category" size={24} color={colors.primary} />
                <Text style={styles.summaryValue}>{totalItems}</Text>
                <Text style={styles.summaryLabel}>Groups</Text>
            </View>
            <View style={styles.summaryCard}>
                <Icon name="inventory" size={24} color={colors.info} />
                <Text style={styles.summaryValue}>
                    {formatNumber(totalQuantity)}
                </Text>
                <Text style={styles.summaryLabel}>Total Qty</Text>
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

    // Purchase Group Card Component
    const PurchaseGroupCard = ({ group }: { group: any }) => {
        const groupTotal = calculateGroupTotal(group);
        const groupQuantity = calculateGroupQuantity(group);
        const isExpanded = expandedGroups.has(group.Stock_Group);

        return (
            <View style={styles.groupCard}>
                <TouchableOpacity
                    style={[
                        styles.groupHeader,
                        isExpanded && styles.groupHeaderExpanded,
                    ]}
                    onPress={() => toggleGroup(group.Stock_Group)}
                    activeOpacity={0.7}
                >
                    <View style={styles.groupHeaderContent}>
                        <View style={styles.groupTitleContainer}>
                            <Icon
                                name="category"
                                size={20}
                                color={colors.primary}
                            />
                            <Text style={styles.groupTitle}>
                                {group.Stock_Group}
                            </Text>
                        </View>
                        <View style={styles.groupMetaInfo}>
                            <View style={styles.groupMetaItem}>
                                <FontAwesomeIcon
                                    name="weight-hanging"
                                    size={16}
                                    color={colors.accent}
                                />
                                <Text style={styles.groupMetaValue}>
                                    {formatNumber(groupQuantity)} kg
                                </Text>
                            </View>
                            <View style={styles.groupMetaItem}>
                                <Icon
                                    name="payments"
                                    size={16}
                                    color={colors.success}
                                />
                                <Text
                                    style={[
                                        styles.groupMetaValue,
                                        { color: colors.success },
                                    ]}
                                >
                                    {formatCurrency(groupTotal)}
                                </Text>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>

                {isExpanded && (
                    <View style={styles.productsContainer}>
                        {group.product_details?.map(
                            (product: any, productIndex: number) => (
                                <ProductCard
                                    key={`${group.Stock_Group}-${productIndex}`}
                                    product={product}
                                    groupName={group.Stock_Group}
                                    productIndex={productIndex}
                                />
                            ),
                        )}
                    </View>
                )}
            </View>
        );
    };

    // Product Card Component
    const ProductCard = ({
        product,
        groupName,
        productIndex,
    }: {
        product: any;
        groupName: string;
        productIndex: number;
    }) => {
        const itemKey = `${groupName}-${productIndex}`;
        const isExpanded = expandedItems.has(itemKey);

        const productTotal =
            product.product_details_1?.reduce(
                (sum: number, detail: any) => sum + (detail.amount || 0),
                0,
            ) || 0;

        const productQuantity =
            product.product_details_1?.reduce(
                (sum: number, detail: any) => sum + (detail.bill_qty || 0),
                0,
            ) || 0;

        const totalOrders = product.product_details_1?.length || 0;

        return (
            <View
                style={[
                    styles.productCard,
                    isExpanded && styles.productCardExpanded,
                ]}
            >
                <TouchableOpacity
                    style={[
                        styles.productHeader,
                        isExpanded && styles.productHeaderExpanded,
                    ]}
                    onPress={() => toggleItem(itemKey)}
                    activeOpacity={0.7}
                >
                    <View style={styles.productInfo}>
                        <View style={styles.productMainInfo}>
                            <View style={styles.productNameContainer}>
                                <Icon
                                    name="inventory"
                                    size={18}
                                    color={colors.info}
                                />
                                <Text style={styles.productName}>
                                    {product.Item_Name_Modified}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.productStats}>
                            <View style={styles.statItem}>
                                <FontAwesomeIcon
                                    name="weight-hanging"
                                    size={14}
                                    color={colors.info}
                                />
                                <Text style={styles.statValue}>
                                    {formatNumber(productQuantity)} kg
                                </Text>
                            </View>
                            <View style={styles.statItem}>
                                <Icon
                                    name="receipt"
                                    size={14}
                                    color={colors.primary}
                                />
                                <Text style={styles.statValue}>
                                    {totalOrders} Orders
                                </Text>
                            </View>
                            <View style={styles.statItem}>
                                <Icon
                                    name="payments"
                                    size={14}
                                    color={colors.success}
                                />
                                <Text
                                    style={[
                                        styles.statValue,
                                        { color: colors.success },
                                    ]}
                                >
                                    {formatCurrency(productTotal)}
                                </Text>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>

                {isExpanded && product.product_details_1 && (
                    <View style={styles.transactionsContainer}>
                        {product.product_details_1.map(
                            (transaction: any, transIndex: number) => (
                                <TransactionCard
                                    key={transIndex}
                                    transaction={transaction}
                                />
                            ),
                        )}
                    </View>
                )}
            </View>
        );
    };

    // Transaction Card Component
    const TransactionCard = ({ transaction }: { transaction: any }) => (
        <View style={styles.transactionCard}>
            <View style={styles.transactionTableHeader}>
                <View style={styles.transactionHeaderTop}>
                    <View style={styles.poContainer}>
                        <Icon name="receipt" size={16} color={colors.primary} />
                        <Text style={styles.poNumber}>{transaction.po_no}</Text>
                    </View>
                    <Text style={styles.poDate}>
                        {formatDate(transaction.po_date)}
                    </Text>
                </View>
                <Text style={styles.supplierName}>
                    {transaction.ledger_name}
                </Text>
            </View>

            <View style={styles.transactionTable}>
                <View style={styles.tableRow}>
                    <View style={[styles.tableCell, styles.itemNameCell]}>
                        <Text style={styles.tableCellLabel}>Item Name</Text>
                        <Text style={styles.tableCellValue} numberOfLines={2}>
                            {transaction.stock_item_name}
                        </Text>
                    </View>
                    <View style={styles.tableCell}>
                        <Text style={styles.tableCellLabel}>Quantity</Text>
                        <Text style={styles.tableCellValue}>
                            {formatNumber(transaction.bill_qty)}{" "}
                            {/* {transaction.bill_unit} */}
                        </Text>
                    </View>
                    <View style={styles.tableCell}>
                        <Text style={styles.tableCellLabel}>Rate</Text>
                        <Text style={styles.tableCellValue}>
                            {formatCurrency(transaction.item_rate)}
                        </Text>
                    </View>
                    <View style={styles.tableCell}>
                        <Text style={styles.tableCellLabel}>Amount</Text>
                        <Text
                            style={[
                                styles.tableCellValue,
                                { color: colors.success },
                            ]}
                        >
                            {formatCurrency(transaction.amount)}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );

    // Pagination Component
    const PaginationControls = () => (
        <View style={styles.paginationContainer}>
            <TouchableOpacity
                style={[
                    styles.pageButton,
                    currentPage === 1 && styles.pageButtonDisabled,
                ]}
                onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
            >
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
                Page {currentPage} of {totalPages} ({totalItems} groups,{" "}
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
                disabled={currentPage === totalPages}
            >
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
                title="Purchase Report"
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
                showsVerticalScrollIndicator={false}
            >
                {/* Loading State */}
                {isLoading && (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>
                            Loading purchase data...
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
                            Failed to load data
                        </Text>
                        <Text style={styles.errorSubtext}>
                            Please check your connection and try again
                        </Text>
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={onRefresh}
                        >
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
                {!isLoading && !error && purchaseData.length > 0 && (
                    <>
                        <SummaryCards />

                        {/* Search Bar */}
                        <View style={styles.searchContainer}>
                            <Icon
                                name="search"
                                size={20}
                                color={colors.textSecondary}
                            />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search by group, item, PO number..."
                                placeholderTextColor={colors.textSecondary}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => setSearchQuery("")}
                                >
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
                                Showing {displayData.length} groups (
                                {totalItems} filtered, {totalRecords} total
                                records)
                            </Text>
                        </View>

                        {/* Purchase Groups List */}
                        {displayData.map((group, index) => (
                            <PurchaseGroupCard
                                key={group.Stock_Group || index}
                                group={group}
                            />
                        ))}

                        {/* Pagination */}
                        {totalPages > 1 && <PaginationControls />}
                    </>
                )}

                {/* No Data State */}
                {!isLoading && !error && purchaseData.length === 0 && (
                    <View style={styles.noDataContainer}>
                        <Icon
                            name="shopping-bag"
                            size={48}
                            color={colors.textSecondary}
                        />
                        <Text style={styles.noDataText}>
                            No purchase data found
                        </Text>
                        <Text style={styles.noDataSubtext}>
                            Please select a date range to view purchase records
                        </Text>
                    </View>
                )}

                {/* No Results State */}
                {!isLoading &&
                    !error &&
                    purchaseData.length > 0 &&
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

export default PurchaseReportSummary;

const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.primary,
        },
        scrollContainer: {
            backgroundColor: colors.background,
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
        },
        summaryLabel: {
            ...typography.caption,
            color: colors.textSecondary,
            marginTop: responsiveWidth(0.5),
            textAlign: "center",
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

        // Group Card
        groupCard: {
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(4),
            marginBottom: responsiveWidth(3),
            borderRadius: 12,
            elevation: 3,
            overflow: "hidden",
        },
        groupHeader: {
            padding: responsiveWidth(4),
            backgroundColor: colors.white,
        },
        groupHeaderExpanded: {
            backgroundColor: colors.primary + "10",
        },
        groupHeaderContent: {
            flex: 1,
        },
        groupTitleContainer: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(2),
            marginBottom: responsiveWidth(3),
        },
        groupTitle: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "700",
            flex: 1,
        },
        groupMetaInfo: {
            flexDirection: "row",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: responsiveWidth(4),
        },
        groupMetaItem: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(1),
        },
        groupMetaValue: {
            ...typography.body1,
            color: colors.info,
            fontWeight: "600",
        },

        // Products Container
        productsContainer: {
            padding: responsiveWidth(4),
            gap: responsiveWidth(3),
        },

        // Product Card
        productCard: {
            backgroundColor: colors.white,
            borderRadius: 8,
            overflow: "hidden",
            marginBottom: responsiveWidth(2),
            borderWidth: 0.5,
            borderColor: colors.borderColor,
        },
        productCardExpanded: {
            borderColor: colors.primary,
            borderWidth: 1,
        },
        productHeader: {
            backgroundColor: colors.white,
        },
        productHeaderExpanded: {
            backgroundColor: colors.primary + "05",
            borderBottomColor: colors.primary,
        },
        productInfo: {
            padding: responsiveWidth(3),
        },
        productMainInfo: {
            marginBottom: responsiveWidth(2),
        },
        productNameContainer: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(2),
        },
        productName: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "600",
            flex: 1,
        },
        productStats: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: responsiveWidth(4),
        },
        statItem: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(1),
        },
        statValue: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "500",
        },

        // Transactions Container
        transactionsContainer: {
            padding: responsiveWidth(3),
            gap: responsiveWidth(2),
        },

        // Transaction Card
        transactionCard: {
            backgroundColor: colors.white,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.grey400,
            marginBottom: responsiveWidth(2),
        },
        transactionTableHeader: {
            padding: responsiveWidth(3),
            borderBottomWidth: 1,
            borderBottomColor: colors.grey400,
            backgroundColor: colors.backgroundAlt,
        },
        transactionHeaderTop: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: responsiveWidth(1),
        },
        poContainer: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(2),
        },
        poNumber: {
            ...typography.body1,
            color: colors.primary,
            fontWeight: "600",
        },
        poDate: {
            ...typography.body2,
            color: colors.textSecondary,
        },
        supplierName: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "500",
        },
        transactionTable: {
            padding: responsiveWidth(3),
        },
        tableRow: {
            flexDirection: "row",
            alignItems: "flex-start",
            gap: responsiveWidth(2),
        },
        tableCell: {
            flex: 1,
        },
        itemNameCell: {
            flex: 2,
        },
        tableCellLabel: {
            ...typography.caption,
            color: colors.textSecondary,
            marginBottom: responsiveWidth(1),
        },
        tableCellValue: {
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

        // No Data States
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
