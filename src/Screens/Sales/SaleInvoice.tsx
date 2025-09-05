import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    TextInput,
    FlatList,
    Alert,
} from "react-native";
import React from "react";
import Icon from "react-native-vector-icons/MaterialIcons";
import AppHeader from "../../Components/AppHeader";
import { useTheme } from "../../Context/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../Navigation/types";
import { useQuery } from "@tanstack/react-query";
import { salesInvoice } from "../../Api/Sales";
import DatePickerButton from "../../Components/DatePickerButton";
import { responsiveWidth, responsiveHeight } from "../../constants/helper";
import { SafeAreaView } from "react-native-safe-area-context";
import FilterModal from "../../Components/FilterModal";

const SaleInvoice = () => {
    const { colors, typography } = useTheme();
    const styles = getStyles(typography, colors);
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const [fromDate, setFromDate] = React.useState<Date>(new Date());
    const [toDate, setToDate] = React.useState<Date>(new Date());
    const [searchQuery, setSearchQuery] = React.useState("");
    const [modalVisible, setModalVisible] = React.useState(false);
    const [expandedInvoices, setExpandedInvoices] = React.useState<Set<string>>(
        new Set(),
    );
    const [currentPage, setCurrentPage] = React.useState(1);
    const [refreshing, setRefreshing] = React.useState(false);
    const [sortBy, setSortBy] = React.useState<"date" | "amount" | "retailer">(
        "date",
    );
    const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");
    const [filterStatus, setFilterStatus] = React.useState<
        "all" | "active" | "cancelled"
    >("all");

    const ITEMS_PER_PAGE = 15;

    const {
        data: invoiceData = [],
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ["salesInvoice", fromDate, toDate],
        queryFn: () => salesInvoice(fromDate, toDate),
        enabled: !!fromDate && !!toDate,
    });

    // Filter and sort data
    const getProcessedData = () => {
        let filtered = [...invoiceData];

        // Filter by status
        if (filterStatus !== "all") {
            filtered = filtered.filter(invoice =>
                filterStatus === "cancelled"
                    ? invoice.Cancel_status !== "1"
                    : invoice.Cancel_status === "1",
            );
        }

        // Filter by search query
        if (searchQuery.trim()) {
            filtered = filtered.filter(
                invoice =>
                    invoice.Do_Inv_No?.toLowerCase().includes(
                        searchQuery.toLowerCase(),
                    ) ||
                    invoice.Retailer_Name?.toLowerCase().includes(
                        searchQuery.toLowerCase(),
                    ) ||
                    invoice.Branch_Name?.toLowerCase().includes(
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
                        new Date(a.Do_Date).getTime() -
                        new Date(b.Do_Date).getTime();
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
            totalRecords: invoiceData.length,
            totalAmount: filtered.reduce(
                (sum, invoice) => sum + (invoice.Total_Invoice_value || 0),
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

    // Toggle invoice expansion
    const toggleInvoice = (invoiceId: string) => {
        const newExpanded = new Set(expandedInvoices);
        if (newExpanded.has(invoiceId)) {
            newExpanded.delete(invoiceId);
        } else {
            newExpanded.add(invoiceId);
        }
        setExpandedInvoices(newExpanded);
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
        setExpandedInvoices(new Set());
    }, [searchQuery, sortBy, sortOrder, filterStatus]);

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

    // Get status color
    const getStatusColor = (status: string) => {
        return status === "1" ? colors.success : colors.accent;
    };

    // Summary Cards Component
    const SummaryCards = () => (
        <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
                <Icon name="receipt" size={24} color={colors.primary} />
                <Text style={styles.summaryValue}>{totalItems}</Text>
                <Text style={styles.summaryLabel}>Invoices</Text>
            </View>
            <View style={styles.summaryCard}>
                <Icon name="currency-rupee" size={24} color={colors.success} />
                <Text style={styles.summaryValue}>
                    {formatCurrency(totalAmount).replace("₹", "")}
                </Text>
                <Text style={styles.summaryLabel}>Total Amount</Text>
            </View>
            {/* <View style={styles.summaryCard}>
                <Icon name="trending-up" size={24} color={colors.info} />
                <Text style={styles.summaryValue}>
                    {totalItems > 0
                        ? formatCurrency(totalAmount / totalItems).replace(
                              "₹",
                              "",
                          )
                        : "0"}
                </Text>
                <Text style={styles.summaryLabel}>Avg. Invoice</Text>
            </View> */}
        </View>
    );

    // Filter Controls Component
    const FilterControls = () => (
        <View style={styles.filterContainer}>
            <Text style={styles.filterLabel}>Status:</Text>
            <View style={styles.filterButtons}>
                {[
                    { key: "all", label: "All" },
                    { key: "active", label: "Active" },
                    { key: "cancelled", label: "Cancelled" },
                ].map(option => (
                    <TouchableOpacity
                        key={option.key}
                        style={[
                            styles.filterButton,
                            filterStatus === option.key &&
                                styles.activeFilterButton,
                        ]}
                        onPress={() => setFilterStatus(option.key as any)}>
                        <Text
                            style={[
                                styles.filterButtonText,
                                filterStatus === option.key &&
                                    styles.activeFilterButtonText,
                            ]}>
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                ))}
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

    // Invoice Card Component
    const InvoiceCard = ({ invoice }: { invoice: any }) => {
        const isExpanded = expandedInvoices.has(invoice.Do_Id);
        const isActive = invoice.Cancel_status === "1";

        return (
            <View style={styles.invoiceCard}>
                <TouchableOpacity
                    style={styles.invoiceHeader}
                    onPress={() => toggleInvoice(invoice.Do_Id)}
                    activeOpacity={0.7}>
                    <View style={styles.invoiceHeaderLeft}>
                        <View style={styles.invoiceNumberContainer}>
                            <Icon
                                name="receipt"
                                size={18}
                                color={colors.primary}
                            />
                            <Text style={styles.invoiceNumber}>
                                {invoice.Do_Inv_No}
                            </Text>
                            <View
                                style={[
                                    styles.statusBadge,
                                    {
                                        backgroundColor:
                                            getStatusColor(
                                                invoice.Cancel_status,
                                            ) + "20",
                                    },
                                ]}>
                                <Text
                                    style={[
                                        styles.statusText,
                                        {
                                            color: getStatusColor(
                                                invoice.Cancel_status,
                                            ),
                                        },
                                    ]}>
                                    {isActive ? "Active" : "Cancelled"}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.retailerName} numberOfLines={1}>
                            {invoice.Retailer_Name}
                        </Text>
                        <View style={styles.invoiceMeta}>
                            <Text style={styles.invoiceDate}>
                                {formatDate(invoice.Do_Date)}
                            </Text>
                            <Text style={styles.invoiceAmount}>
                                {formatCurrency(invoice.Total_Invoice_value)}
                            </Text>
                        </View>
                    </View>
                    <Icon
                        name={isExpanded ? "expand-less" : "expand-more"}
                        size={24}
                        color={colors.textSecondary}
                    />
                </TouchableOpacity>

                {isExpanded && (
                    <View style={styles.invoiceDetails}>
                        {/* Invoice Info */}
                        <View style={styles.invoiceInfoSection}>
                            <Text style={styles.sectionTitle}>
                                Invoice Details
                            </Text>
                            <View style={styles.infoGrid}>
                                <View style={styles.infoItem}>
                                    <Text style={styles.infoLabel}>
                                        Branch:
                                    </Text>
                                    <Text
                                        style={styles.infoValue}
                                        numberOfLines={2}>
                                        {invoice.Branch_Name}
                                    </Text>
                                </View>
                                <View style={styles.infoItem}>
                                    <Text style={styles.infoLabel}>
                                        Voucher Type:
                                    </Text>
                                    <Text style={styles.infoValue}>
                                        {invoice.VoucherTypeGet}
                                    </Text>
                                </View>
                                <View style={styles.infoItem}>
                                    <Text style={styles.infoLabel}>
                                        Created By:
                                    </Text>
                                    <Text style={styles.infoValue}>
                                        {invoice.Created_BY_Name}
                                    </Text>
                                </View>
                                <View style={styles.infoItem}>
                                    <Text style={styles.infoLabel}>
                                        Created On:
                                    </Text>
                                    <Text style={styles.infoValue}>
                                        {formatDate(invoice.Created_on)}
                                    </Text>
                                </View>
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
                                        {formatCurrency(
                                            invoice.Total_Before_Tax,
                                        )}
                                    </Text>
                                </View>
                                <View style={styles.amountRow}>
                                    <Text style={styles.amountLabel}>
                                        Tax Total:
                                    </Text>
                                    <Text style={styles.amountValue}>
                                        {formatCurrency(invoice.Total_Tax)}
                                    </Text>
                                </View>
                                <View style={styles.amountRow}>
                                    <Text style={styles.amountLabel}>
                                        Expenses:
                                    </Text>
                                    <Text style={styles.amountValue}>
                                        {formatCurrency(invoice.Total_Expences)}
                                    </Text>
                                </View>
                                <View style={styles.amountRow}>
                                    <Text style={styles.amountLabel}>
                                        Round Off:
                                    </Text>
                                    <Text style={styles.amountValue}>
                                        {formatCurrency(invoice.Round_off)}
                                    </Text>
                                </View>
                                <View
                                    style={[styles.amountRow, styles.totalRow]}>
                                    <Text style={styles.totalLabel}>
                                        Total Amount:
                                    </Text>
                                    <Text style={styles.totalValue}>
                                        {formatCurrency(
                                            invoice.Total_Invoice_value,
                                        )}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Products List */}
                        {invoice.Products_List &&
                            invoice.Products_List.length > 0 && (
                                <View style={styles.productsSection}>
                                    <Text style={styles.sectionTitle}>
                                        Products ({invoice.Products_List.length}
                                        )
                                    </Text>
                                    {invoice.Products_List.map(
                                        (product: any, index: number) => (
                                            <View
                                                key={index}
                                                style={styles.productCard}>
                                                <View
                                                    style={
                                                        styles.productHeader
                                                    }>
                                                    <Text
                                                        style={
                                                            styles.productName
                                                        }
                                                        numberOfLines={2}>
                                                        {product.Product_Name}
                                                    </Text>
                                                    <Text
                                                        style={
                                                            styles.productBrand
                                                        }>
                                                        {product.BrandGet}
                                                    </Text>
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
                                                            Amount:
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

                        {/* Expenses List */}
                        {invoice.Expence_Array &&
                            invoice.Expence_Array.length > 0 && (
                                <View style={styles.expensesSection}>
                                    <Text style={styles.sectionTitle}>
                                        Expenses ({invoice.Expence_Array.length}
                                        )
                                    </Text>
                                    {invoice.Expence_Array.map(
                                        (expense: any, index: number) => (
                                            <View
                                                key={index}
                                                style={styles.expenseCard}>
                                                <Text
                                                    style={styles.expenseName}>
                                                    {expense.Expence_Name}
                                                </Text>
                                                <Text
                                                    style={
                                                        styles.expenseAmount
                                                    }>
                                                    {formatCurrency(
                                                        expense.Expence_Value,
                                                    )}
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
                Page {currentPage} of {totalPages} ({totalItems} invoices,{" "}
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
                title="Sales Invoice"
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
                            Loading invoices...
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
                            Error loading invoices
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
                {!isLoading && !error && invoiceData.length > 0 && (
                    <>
                        {/* Summary Cards */}
                        <SummaryCards />

                        {/* Filter Controls */}
                        <FilterControls />

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
                                placeholder="Search by invoice number, retailer, or branch..."
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
                                Showing {displayData.length} invoices (
                                {totalItems} filtered, {totalRecords} total
                                records)
                            </Text>
                        </View>

                        {/* Invoices List */}
                        {displayData.map((invoice, index) => (
                            <InvoiceCard
                                key={invoice.Do_Id}
                                invoice={invoice}
                            />
                        ))}

                        {/* Pagination */}
                        {totalPages > 1 && <PaginationControls />}
                    </>
                )}

                {/* No Data State */}
                {!isLoading && !error && invoiceData.length === 0 && (
                    <View style={styles.noDataContainer}>
                        <Icon
                            name="receipt"
                            size={48}
                            color={colors.textSecondary}
                        />
                        <Text style={styles.noDataText}>No invoices found</Text>
                        <Text style={styles.noDataSubtext}>
                            Please select a date range to view invoices
                        </Text>
                    </View>
                )}

                {/* No Results State */}
                {!isLoading &&
                    !error &&
                    invoiceData.length > 0 &&
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

export default SaleInvoice;

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
        datePickerRow: {
            flexDirection: "row",
            gap: responsiveWidth(3),
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
            gap: responsiveWidth(3),
        },
        summaryCard: {
            flex: 1,
            backgroundColor: colors.white,
            padding: responsiveWidth(4),
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
            marginTop: responsiveWidth(2),
            textAlign: "center",
        },
        summaryLabel: {
            ...typography.caption,
            color: colors.textSecondary,
            marginTop: responsiveWidth(1),
            textAlign: "center",
        },

        // Filter Controls
        filterContainer: {
            flexDirection: "row",
            alignItems: "center",
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
        filterLabel: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "600",
            marginRight: responsiveWidth(3),
        },
        filterButtons: {
            flexDirection: "row",
            flex: 1,
            gap: responsiveWidth(2),
        },
        filterButton: {
            flex: 1,
            paddingVertical: responsiveWidth(2),
            paddingHorizontal: responsiveWidth(3),
            borderRadius: 8,
            backgroundColor: colors.background,
            alignItems: "center",
        },
        activeFilterButton: {
            backgroundColor: colors.primary,
        },
        filterButtonText: {
            ...typography.caption,
            color: colors.textSecondary,
            fontWeight: "600",
        },
        activeFilterButtonText: {
            color: colors.white,
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

        // Invoice Card
        invoiceCard: {
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
        invoiceHeader: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: responsiveWidth(4),
            backgroundColor: colors.primary + "10",
        },
        invoiceHeaderLeft: {
            flex: 1,
        },
        invoiceNumberContainer: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(2),
            marginBottom: responsiveWidth(2),
        },
        invoiceNumber: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "700",
            flex: 1,
        },
        statusBadge: {
            paddingHorizontal: responsiveWidth(2),
            paddingVertical: responsiveWidth(0.5),
            borderRadius: 6,
        },
        statusText: {
            ...typography.caption,
            fontWeight: "600",
        },
        retailerName: {
            ...typography.body1,
            color: colors.text,
            fontWeight: "600",
            marginBottom: responsiveWidth(2),
        },
        invoiceMeta: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        invoiceDate: {
            ...typography.body2,
            color: colors.textSecondary,
        },
        invoiceAmount: {
            ...typography.h6,
            color: colors.primary,
            fontWeight: "700",
        },

        // Invoice Details
        invoiceDetails: {
            padding: responsiveWidth(4),
            gap: responsiveWidth(4),
        },
        invoiceInfoSection: {
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
            marginBottom: responsiveWidth(2),
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
            minWidth: responsiveWidth(20),
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

        // Expenses Section
        expensesSection: {
            backgroundColor: colors.accent + "05",
            padding: responsiveWidth(3),
            borderRadius: 8,
        },
        expenseCard: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: colors.white,
            padding: responsiveWidth(3),
            borderRadius: 8,
            marginTop: responsiveWidth(2),
        },
        expenseName: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "600",
            flex: 1,
        },
        expenseAmount: {
            ...typography.body2,
            color: colors.accent,
            fontWeight: "700",
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
