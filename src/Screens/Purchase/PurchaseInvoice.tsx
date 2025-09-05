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
import { useTheme } from "../../Context/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../Navigation/types";
import { useQuery } from "@tanstack/react-query";
import { getPurchaseReport } from "../../Api/Purchase";
import AppHeader from "../../Components/AppHeader";
import DatePickerButton from "../../Components/DatePickerButton";
import { responsiveWidth, responsiveHeight } from "../../constants/helper";
import { SafeAreaView } from "react-native-safe-area-context";

const PurchaseInvoice = () => {
    const { colors, typography } = useTheme();
    const styles = getStyles(typography, colors);
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();

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
    const [sortBy, setSortBy] = React.useState<"group" | "amount" | "quantity">(
        "group",
    );
    const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");

    const ITEMS_PER_PAGE = 10;

    const {
        data: purchaseData = [],
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ["purchaseReport", fromDate, toDate],
        queryFn: () => getPurchaseReport(fromDate, toDate),
        enabled: !!fromDate && !!toDate,
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

        // Sort data
        filtered.sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case "group":
                    comparison = (a.Stock_Group || "").localeCompare(
                        b.Stock_Group || "",
                    );
                    break;
                case "amount":
                    const amountA = calculateGroupTotal(a);
                    const amountB = calculateGroupTotal(b);
                    comparison = amountA - amountB;
                    break;
                case "quantity":
                    const qtyA = calculateGroupQuantity(a);
                    const qtyB = calculateGroupQuantity(b);
                    comparison = qtyA - qtyB;
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
    }, [searchQuery, sortBy, sortOrder]);

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
        }).format(amount);
    };

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

    // Sort Controls Component
    const SortControls = () => (
        <View style={styles.sortContainer}>
            <Text style={styles.sortLabel}>Sort by:</Text>
            <View style={styles.sortButtons}>
                {[
                    { key: "group", label: "Group", icon: "category" },
                    { key: "amount", label: "Amount", icon: "attach-money" },
                    { key: "quantity", label: "Quantity", icon: "inventory" },
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
                                setSortOrder("asc");
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

    // Purchase Group Card Component
    const PurchaseGroupCard = ({ group }: { group: any }) => {
        const isExpanded = expandedGroups.has(group.Stock_Group);
        const groupTotal = calculateGroupTotal(group);
        const groupQuantity = calculateGroupQuantity(group);

        return (
            <View style={styles.groupCard}>
                <TouchableOpacity
                    style={styles.groupHeader}
                    onPress={() => toggleGroup(group.Stock_Group)}
                    activeOpacity={0.7}>
                    <View style={styles.groupHeaderLeft}>
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
                        <View style={styles.groupMeta}>
                            <Text style={styles.groupAmount}>
                                {formatCurrency(groupTotal)}
                            </Text>
                            <Text style={styles.groupQuantity}>
                                Qty: {formatNumber(groupQuantity)}
                            </Text>
                        </View>
                        <Text style={styles.productCount}>
                            {group.product_details?.length || 0} Products
                        </Text>
                    </View>
                    <Icon
                        name={isExpanded ? "expand-less" : "expand-more"}
                        size={24}
                        color={colors.textSecondary}
                    />
                </TouchableOpacity>

                {isExpanded && group.product_details && (
                    <View style={styles.productsContainer}>
                        {group.product_details.map(
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

        return (
            <View style={styles.productCard}>
                <TouchableOpacity
                    style={styles.productHeader}
                    onPress={() => toggleItem(itemKey)}
                    activeOpacity={0.7}>
                    <View style={styles.productHeaderLeft}>
                        <Text style={styles.productName}>
                            {product.Item_Name_Modified}
                        </Text>
                        <View style={styles.productMeta}>
                            <Text style={styles.productAmount}>
                                {formatCurrency(productTotal)}
                            </Text>
                            <Text style={styles.productQuantity}>
                                Qty: {formatNumber(productQuantity)}
                            </Text>
                        </View>
                        <Text style={styles.transactionCount}>
                            {product.product_details_1?.length || 0}{" "}
                            Transactions
                        </Text>
                    </View>
                    <Icon
                        name={isExpanded ? "expand-less" : "expand-more"}
                        size={20}
                        color={colors.textSecondary}
                    />
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
            <View style={styles.transactionHeader}>
                <View style={styles.transactionTitleRow}>
                    <Icon name="receipt" size={16} color={colors.primary} />
                    <Text style={styles.transactionPO}>
                        {transaction.po_no}
                    </Text>
                    <Text style={styles.transactionDate}>
                        {formatDate(transaction.po_date)}
                    </Text>
                </View>
                <Text style={styles.transactionAmount}>
                    {formatCurrency(transaction.amount)}
                </Text>
            </View>

            <View style={styles.transactionDetails}>
                <View style={styles.transactionRow}>
                    <Text style={styles.transactionLabel}>Item:</Text>
                    <Text style={styles.transactionValue} numberOfLines={2}>
                        {transaction.stock_item_name}
                    </Text>
                </View>
                <View style={styles.transactionRow}>
                    <Text style={styles.transactionLabel}>Supplier:</Text>
                    <Text style={styles.transactionValue}>
                        {transaction.ledger_name}
                    </Text>
                </View>
                <View style={styles.transactionRow}>
                    <Text style={styles.transactionLabel}>Quantity:</Text>
                    <Text style={styles.transactionValue}>
                        {formatNumber(transaction.bill_qty)}{" "}
                        {transaction.bill_unit}
                    </Text>
                </View>
                <View style={styles.transactionRow}>
                    <Text style={styles.transactionLabel}>Rate:</Text>
                    <Text style={styles.transactionValue}>
                        {formatCurrency(transaction.item_rate)} per{" "}
                        {transaction.bill_unit}
                    </Text>
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

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader title="Purchase Invoice" navigation={navigation} />

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
                {/* Date Picker Section */}
                <View style={styles.datePickerContainer}>
                    <Text style={styles.sectionTitle}>Select Date Range</Text>
                    <View style={styles.datePickerRow}>
                        <DatePickerButton
                            title="From Date"
                            date={fromDate}
                            style={styles.datePicker}
                            containerStyle={styles.datePickerItem}
                            titleStyle={styles.datePickerTitle}
                            onDateChange={setFromDate}
                        />
                        <DatePickerButton
                            title="To Date"
                            date={toDate}
                            style={styles.datePicker}
                            containerStyle={styles.datePickerItem}
                            titleStyle={styles.datePickerTitle}
                            onDateChange={setToDate}
                        />
                    </View>
                </View>

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
                {!isLoading && !error && purchaseData.length > 0 && (
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
                                placeholder="Search by group, item, PO number..."
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

export default PurchaseInvoice;

const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.primary,
        },
        scrollContainer: {
            backgroundColor: colors.background,
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
            gap: responsiveWidth(3),
        },
        datePickerItem: {
            flex: 1,
        },
        datePickerTitle: {
            ...typography.body2,
            color: colors.text,
            marginBottom: 8,
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
            marginBottom: responsiveWidth(4),
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

        // Group Card
        groupCard: {
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
        groupHeader: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: responsiveWidth(4),
            backgroundColor: colors.primary + "10",
        },
        groupHeaderLeft: {
            flex: 1,
        },
        groupTitleContainer: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(2),
            marginBottom: responsiveWidth(2),
        },
        groupTitle: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "700",
            flex: 1,
        },
        groupMeta: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: responsiveWidth(1),
        },
        groupAmount: {
            ...typography.h6,
            color: colors.primary,
            fontWeight: "700",
        },
        groupQuantity: {
            ...typography.body2,
            color: colors.textSecondary,
        },
        productCount: {
            ...typography.caption,
            color: colors.textSecondary,
            fontStyle: "italic",
        },

        // Products Container
        productsContainer: {
            padding: responsiveWidth(4),
            gap: responsiveWidth(3),
        },

        // Product Card
        productCard: {
            backgroundColor: colors.background,
            borderRadius: 8,
            overflow: "hidden",
            borderLeftWidth: 3,
            borderLeftColor: colors.info,
        },
        productHeader: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: responsiveWidth(3),
            backgroundColor: colors.white,
        },
        productHeaderLeft: {
            flex: 1,
        },
        productName: {
            ...typography.body1,
            color: colors.text,
            fontWeight: "600",
            marginBottom: responsiveWidth(1),
        },
        productMeta: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: responsiveWidth(0.5),
        },
        productAmount: {
            ...typography.body1,
            color: colors.info,
            fontWeight: "700",
        },
        productQuantity: {
            ...typography.caption,
            color: colors.textSecondary,
        },
        transactionCount: {
            ...typography.caption,
            color: colors.textSecondary,
            fontStyle: "italic",
        },

        // Transactions Container
        transactionsContainer: {
            padding: responsiveWidth(3),
            gap: responsiveWidth(2),
        },

        // Transaction Card
        transactionCard: {
            backgroundColor: colors.white,
            padding: responsiveWidth(3),
            borderRadius: 8,
            borderLeftWidth: 2,
            borderLeftColor: colors.success,
        },
        transactionHeader: {
            marginBottom: responsiveWidth(2),
        },
        transactionTitleRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(2),
            marginBottom: responsiveWidth(1),
        },
        transactionPO: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "600",
            flex: 1,
        },
        transactionDate: {
            ...typography.caption,
            color: colors.textSecondary,
        },
        transactionAmount: {
            ...typography.h6,
            color: colors.success,
            fontWeight: "700",
        },
        transactionDetails: {
            gap: responsiveWidth(1),
        },
        transactionRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
        },
        transactionLabel: {
            ...typography.caption,
            color: colors.textSecondary,
            fontWeight: "500",
            minWidth: responsiveWidth(20),
        },
        transactionValue: {
            ...typography.caption,
            color: colors.text,
            fontWeight: "600",
            flex: 1,
            textAlign: "right",
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
