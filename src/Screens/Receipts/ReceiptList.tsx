import React from "react";
import {
    View,
    Text,
    ScrollView,
    RefreshControl,
    TextInput,
    TouchableOpacity,
    StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import Icon from "react-native-vector-icons/MaterialIcons";
import { MMKV } from "react-native-mmkv";
import { fetchReceiptList } from "../../Api/receipt";
import { responsiveHeight, responsiveWidth } from "../../constants/helper";
import { useTheme } from "../../Context/ThemeContext";
import AppHeader from "../../Components/AppHeader";
import { SafeAreaView } from "react-native-safe-area-context";
import FilterModal from "../../Components/FilterModal";
import { formatCurrency, formatDate, formatTime } from "../../constants/utils";

const ReceiptList = ({ route }: { route: any }) => {
    const item = route.params || {};
    const branchIdProps = item.branchId;
    const { typography, colors } = useTheme();

    const styles = getStyles(typography, colors);
    const navigation =
        useNavigation<NativeStackNavigationProp<any>>();

    const storage = new MMKV();

    const [fromDate, setFromDate] = React.useState<Date>(new Date());
    const [toDate, setToDate] = React.useState<Date>(new Date());
    const [userId, setUserId] = React.useState("");
    const [branchId, setBranchId] = React.useState("");
    const [searchQuery, setSearchQuery] = React.useState("");
    const [expandedReceipts, setExpandedReceipts] = React.useState<Set<string>>(new Set());
    const [modalVisible, setModalVisible] = React.useState(false);
    const [refreshing, setRefreshing] = React.useState(false);
    const [selectedTransactionType, setSelectedTransactionType] = React.useState<string>("");

    // Fetch receipts
    React.useEffect(() => {
        const userId = storage.getString("userId");
        const branchId = storage.getString("branchId");
        if (userId) setUserId(userId);
        if (branchId) setBranchId(branchId);
    }, []);

    const {
        data: receipts = [],
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ["receiptList", fromDate, toDate],
        queryFn: () => fetchReceiptList(fromDate, toDate, userId, branchIdProps),
        enabled: !!fromDate && !!toDate && !!userId && !!branchIdProps,
    });

    // Get unique transaction types
    const getTransactionTypes = () => {
        const typeSet = new Set<string>();
        receipts.forEach((receipt: any) => {
            if (receipt.transaction_type) typeSet.add(receipt.transaction_type);
        });
        return Array.from(typeSet);
    };

    // Filter receipts by search and transaction type
    const getProcessedData = () => {
        let filtered = [...receipts];

        if (branchIdProps) {
            const branchIds = Array.isArray(branchIdProps) ? branchIdProps.map(id => Number(id)) : [Number(branchIdProps)];
            filtered = filtered.filter(invoice => branchIds.includes(invoice.Branch_Id));
        }

        if (searchQuery.trim()) {
            filtered = filtered.filter(
                r =>
                    r.receipt_invoice_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    r.CreditAccountGet?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    r.CreatedByGet?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        if (selectedTransactionType) {
            filtered = filtered.filter(
                r => r.transaction_type === selectedTransactionType
            );
        }

        return filtered;
    };

    const filteredData = getProcessedData();
    const totalAmount = filteredData.reduce((sum, r) => sum + (r.credit_amount || 0), 0);

    // Initialize pagination state manually
    const [currentPage, setCurrentPage] = React.useState(1);
    const ITEMS_PER_PAGE = 15;

    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    // Get current page data
    const displayData = React.useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredData, currentPage]);

    // Reset page to 1 only when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedTransactionType, fromDate, toDate, branchIdProps]);


    const toggleReceipt = (receiptId: string) => {
        const newExpanded = new Set(expandedReceipts);
        if (newExpanded.has(receiptId)) newExpanded.delete(receiptId);
        else newExpanded.add(receiptId);
        setExpandedReceipts(newExpanded);
    };

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        try {
            await refetch();
        } finally {
            setRefreshing(false);
        }
    }, [refetch]);

    React.useEffect(() => {
        setExpandedReceipts(new Set());
    }, [searchQuery, selectedTransactionType]);

    // Summary Cards
    const SummaryCards = () => (
        <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
                <Icon name="receipt" size={24} color={colors.primary} />
                <Text style={styles.summaryValue}>{totalItems}</Text>
                <Text style={styles.summaryLabel}>Receipts</Text>
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

    // Transaction Type Filter
    const TransactionTypeFilter = () => {
        const types = getTransactionTypes();

        return (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.brandFilterContainer}>
                <TouchableOpacity
                    style={[styles.brandFilterButton, !selectedTransactionType && styles.brandFilterButtonActive]}
                    onPress={() => setSelectedTransactionType("")}
                >
                    <Text style={[styles.brandFilterText, !selectedTransactionType && styles.brandFilterTextActive]}>
                        All
                    </Text>
                </TouchableOpacity>

                {types.map(type => (
                    <TouchableOpacity
                        key={type}
                        style={[styles.brandFilterButton, selectedTransactionType === type && styles.brandFilterButtonActive]}
                        onPress={() => setSelectedTransactionType(type)}
                    >
                        <Text style={[styles.brandFilterText, selectedTransactionType === type && styles.brandFilterTextActive]}>
                            {type}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        );
    };

    // Receipt Card Component
    const ReceiptCard = ({ receipt }: { receipt: any }) => {
        const isExpanded = expandedReceipts.has(receipt.receipt_id);

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
                    onPress={() => toggleReceipt(receipt.receipt_id)}
                    activeOpacity={0.7}
                >
                    <View style={styles.orderHeaderLeft}>
                        <View style={styles.orderTopRow}>
                            <View style={styles.orderNumberContainer}>
                                <Text style={styles.orderNumber}>{receipt.debit_ledger_name}</Text>
                                <View style={styles.dateTimeContainer}>
                                    <Icon name="event"
                                        size={12}
                                        color={colors.textSecondary}
                                        style={styles.dateTimeIcon} />
                                    <Text style={styles.orderDateTime}>
                                        {receipt.created_on
                                            ? getFormattedDate(receipt.created_on)
                                            : "--"}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.orderAmount}>
                                {formatCurrency(receipt.credit_amount)}
                            </Text>
                        </View>
                        <View style={styles.orderBottomRow}>
                            <View style={styles.retailerContainer}>
                                <Icon name="store" size={14} color={colors.primary} style={styles.bottomRowIcon} />
                                <Text style={styles.retailerName} numberOfLines={2}>
                                    {receipt.transaction_type}
                                </Text>
                            </View>
                            <View style={styles.salesPersonContainer}>
                                <Icon name="person-outline" size={14} color={colors.textSecondary} style={styles.bottomRowIcon} />
                                <Text style={styles.salesPerson}>{receipt.CreatedByGet}</Text>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

    const handleCloseModal = () => setModalVisible(false);

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Receipts"
                navigation={navigation}
                showRightIcon={true}
                rightIconLibrary="MaterialIcon"
                rightIconName="filter-list"
                onRightPress={() => {
                    console.log(modalVisible)
                    setModalVisible(true)
                }}
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
                {isLoading && (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>Loading receipts...</Text>
                    </View>
                )}

                {!isLoading && error && (
                    <View style={styles.errorContainer}>
                        <Icon name="error-outline" size={48} color={colors.accent} />
                        <Text style={styles.errorText}>Error loading receipts</Text>
                        <Text style={styles.errorSubtext}>{error.message || "Please try again later"}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
                            <Icon name="refresh" size={20} color={colors.white} />
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {!isLoading && !error && receipts.length > 0 && (
                    <>
                        <SummaryCards />
                        <TransactionTypeFilter />

                        <View style={styles.searchContainer}>
                            <Icon name="search" size={20} color={colors.textSecondary} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search by invoice, account, or created by..."
                                placeholderTextColor={colors.textSecondary}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery("")}>
                                    <Icon name="clear" size={20} color={colors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={styles.resultsContainer}>
                            <Text style={styles.resultsText}>
                                Showing {displayData.length} receipts ({totalItems} filtered, {receipts.length} total)
                            </Text>

                        </View>

                        {displayData.map(receipt => (
                            <ReceiptCard key={receipt.receipt_id} receipt={receipt} />
                        ))}
                        {totalPages > 1 && (
                            <View style={styles.paginationContainer}>
                                {/* Previous Arrow */}
                                <TouchableOpacity
                                    style={[styles.arrowButton, currentPage === 1 && styles.arrowDisabled]}
                                    disabled={currentPage === 1}
                                    onPress={() => setCurrentPage(currentPage - 1)}
                                >
                                    <Icon name="chevron-left" size={24} color={currentPage === 1 ? colors.textSecondary : colors.primary} />
                                </TouchableOpacity>

                                <Text style={styles.pageInfo}>
                                    {currentPage} / {totalPages}
                                </Text>

                                {/* Next Arrow */}
                                <TouchableOpacity
                                    style={[styles.arrowButton, currentPage === totalPages && styles.arrowDisabled]}
                                    disabled={currentPage === totalPages}
                                    onPress={() => setCurrentPage(currentPage + 1)}
                                >
                                    <Icon name="chevron-right" size={24} color={currentPage === totalPages ? colors.textSecondary : colors.primary} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </>
                )}

                {!isLoading && !error && receipts.length === 0 && (
                    <View style={styles.noDataContainer}>
                        <Icon name="receipt" size={48} color={colors.textSecondary} />
                        <Text style={styles.noDataText}>No receipts found</Text>
                        <Text style={styles.noDataSubtext}>Please select a date range to view receipts</Text>
                    </View>
                )}

            </ScrollView>
        </SafeAreaView>
    );
};

export default ReceiptList;

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
            color: colors.textsecondary,
        },
        orderAmount: {
            ...typography.body1,
            color: colors.success,
            fontWeight: "600",
            marginTop: 6
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
            backgroundColor: colors.border,
        },
        pageInfo: {
            ...typography.caption,
            color: colors.textSecondary,
            fontSize: 14,
            fontWeight: "500",
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
        arrowButton: {
            padding: 8,
            borderRadius: 6,
        },
        arrowDisabled: {
            opacity: 0.3,
        },
    });

