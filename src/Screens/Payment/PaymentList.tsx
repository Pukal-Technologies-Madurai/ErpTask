import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React from 'react';
import AppHeader from "../../Components/AppHeader";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from "../../Context/ThemeContext";
import { MMKV } from 'react-native-mmkv';
import { useQuery } from '@tanstack/react-query';
import { fetchPaymentList } from '../../Api/payment';
import { usePagination } from '../../hooks/usePagination';
import Icon from "react-native-vector-icons/MaterialIcons";
import { formatCurrency, formatDate, formatTime } from "../../constants/utils";
import { RefreshControl, ScrollView, TextInput } from 'react-native-gesture-handler';
import FilterModal from '../../Components/FilterModal';
import { responsiveHeight, responsiveWidth } from '../../constants/helper';

const PaymentList = ({ route }: { route: any }) => {
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
    const [expandedPayments, setExpandedPayments] = React.useState<Set<string>>(new Set());
    const [modalVisible, setModalVisible] = React.useState(false);
    const [refreshing, setRefreshing] = React.useState(false);
    const [selectedTransactionType, setSelectedTransactionType] = React.useState<string>("");

    const ITEMS_PER_PAGE = 15;

    //Fetch Payment
    React.useEffect(() => {
        const userId = storage.getString("userId");
        const branchId = storage.getString("branchId");
        if (userId) setUserId(userId);
        if (branchId) setBranchId(branchId);
    }, []);

    const {
        data: payments = [],
        isLoading,
        error,
        refetch,
    } = useQuery(
        {
            queryKey: ["paymentList", formatDate, toDate],
            queryFn: () => fetchPaymentList(fromDate, toDate, userId, branchIdProps),
            enabled: !!fromDate && !!toDate && !!userId && !!branchIdProps,
        }
    )

    //get unique transaction types
    const getTransactionTypes = () => {
        const typeSet = new Set<string>();
        payments.forEach((payment: any) => {
            if (payment.transaction_type) typeSet.add(payment.transaction_type);
        });
        return Array.from(typeSet);
    };

    //Filter Payment by search and transaction type
    const getProcessedData = () => {
        let filtered = [...payments];

        if (branchIdProps) {
            const branchIds = Array.isArray(branchIdProps) ? branchIdProps.map(id => Number(id)) : [Number(branchIdProps)];
            filtered = filtered.filter(invoice => branchIds.includes(invoice.Branch_Id));
        }

        if (searchQuery.trim()) {
            filtered = filtered.filter(
                p =>
                    p.payment_invoice_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.credit_ledger_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.debit_ledger_name?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        if (selectedTransactionType) {
            filtered = filtered.filter(
                p => p.transaction_type === selectedTransactionType
            )
        }

        return filtered;
    };

    const filteredData = React.useMemo(() => getProcessedData(), [
        payments,
        searchQuery,
        selectedTransactionType,
        branchIdProps
    ]);

    const totalAmount = filteredData.reduce((sum, r) => sum + (r.credit_amount || 0), 0);

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

    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedTransactionType, branchIdProps]);


    const togglePayment = (paymentId: string) => {
        const newExpanded = new Set(expandedPayments);
        if (newExpanded.has(paymentId)) newExpanded.delete(paymentId);
        else newExpanded.add(paymentId);
        setExpandedPayments(newExpanded);
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
        setExpandedPayments(new Set());
    }, [searchQuery, selectedTransactionType]);

    //summary Cards 
    const SummaryCards = () => (
        <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
                <Icon name="payment" size={24} color={colors.primary} />
                <Text style={styles.summaryValue}>{totalItems}</Text>
                <Text style={styles.summaryLabel}>Payments</Text>
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

    //transactiontype filters
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

    //paymentCard Component
    const PaymentCard = ({ payment }: { payment: any }) => {
        const isExpanded = expandedPayments.has(payment.paymentId);

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
                    onPress={() => togglePayment(payment.pay_id)}
                    activeOpacity={0.7}
                >
                    <View style={styles.orderHeaderLeft}>
                        <View style={styles.orderTopRow}>
                            <View style={styles.orderNumberContainer}>
                                <Text style={styles.orderNumber}>{payment.credit_ledger_name}</Text>
                                <Text>--</Text>
                                <Text style={styles.orderNumber1}>{payment.debit_ledger_name}</Text>
                                <View style={styles.dateTimeContainer}>
                                    <Icon name="event"
                                        size={12}
                                        color={colors.textSecondary}
                                        style={styles.dateTimeIcon} />
                                    <Text style={styles.orderDateTime}>
                                        {payment.created_on
                                            ? getFormattedDate(payment.created_on)
                                            : "--"}
                                    </Text>
                                </View>
                            </View>
                            <Text
                                style={styles.orderAmount}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                            >
                                {formatCurrency(payment.credit_amount)}
                            </Text>
                        </View>
                        <View style={styles.orderBottomRow}>
                            <View style={styles.retailerContainer}>
                                <Icon name="currency-exchange" size={14} color={colors.primary} style={styles.bottomRowIcon} />
                                <Text style={styles.retailerName} numberOfLines={2}>
                                    {payment.transaction_type}
                                </Text>
                            </View>
                            {/* <View style={styles.salesPersonContainer}>
                                <Icon name="person-outline" size={14} color={colors.textSecondary} style={styles.bottomRowIcon} />
                                <Text style={styles.salesPerson}>{payment.CreatedByGet}</Text>
                            </View> */}
                        </View>

                    </View>

                </TouchableOpacity>

            </View>
        )
    };

    const handleCloseModal = () => {
        setModalVisible(false);
        // setRefreshing(true)
    };

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Payments"
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
                        <Text style={styles.loadingText}>Loading payments...</Text>
                    </View>
                )}

                {!isLoading && error && (
                    <View style={styles.errorContainer}>
                        <Icon name="error-outline" size={48} color={colors.accent} />
                        <Text style={styles.errorText}>Error loading payments</Text>
                        <Text style={styles.errorSubtext}>{error.message || "Please try again later"}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
                            <Icon name="refresh" size={20} color={colors.white} />
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                )}
                {!isLoading && !error && payments.length > 0 && (
                    <>
                        <SummaryCards />
                        <TransactionTypeFilter />

                        <View style={styles.searchContainer}>
                            <Icon name="search" size={20} color={colors.textSecondary} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search by invoice, credit ledger name, or ..."
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
                                Showing {displayData.length} receipts ({totalItems} filtered, {totalRecords} total)
                            </Text>
                        </View>

                        {displayData.map(payments => (
                            <PaymentCard key={payments.pay_id} payment={payments} />
                        ))}
                    </>
                )}

                {!isLoading && !error && payments.length === 0 && (
                    <View style={styles.noDataContainer}>
                        <Icon name="receipt" size={48} color={colors.textSecondary} />
                        <Text style={styles.noDataText}>No payments found</Text>
                        <Text style={styles.noDataSubtext}>Please select a date range to view receipts</Text>
                    </View>
                )}
                {/* Arrow Pagination Controls */}
                {totalPages > 1 && (
                    <View style={styles.paginationContainer}>
                        <TouchableOpacity
                            style={[styles.arrowButton, currentPage === 1 && styles.arrowButtonDisabled]}
                            disabled={currentPage === 1}
                            onPress={() => setCurrentPage(currentPage - 1)}
                        >
                            <Text style={styles.arrowText}>{"<"}</Text>
                        </TouchableOpacity>

                        <Text style={styles.pageInfo}>
                            {currentPage} / {totalPages}
                        </Text>

                        <TouchableOpacity
                            style={[styles.arrowButton, currentPage === totalPages && styles.arrowButtonDisabled]}
                            disabled={currentPage === totalPages}
                            onPress={() => setCurrentPage(currentPage + 1)}
                        >
                            <Text style={styles.arrowText}>{">"}</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    )
}

export default PaymentList;

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
        orderNumber1: {
            ...typography.subtitle2,
            fontWeight: "600",
            color: colors.accent,
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
            marginTop: 6,
            maxWidth: "100%",
            overflow: "hidden",
            textAlign: "left",
            flexShrink: 0,
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
            fontSize: typography.fontSizeMedium,
            marginHorizontal: responsiveWidth(2),
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
            paddingVertical: responsiveHeight(1),
            paddingHorizontal: responsiveWidth(3),
            backgroundColor: colors.primary,
            borderRadius: 6,
        },
        arrowButtonDisabled: {
            backgroundColor: colors.disabled || "#ccc",
        },
        arrowText: {
            color: colors.white,
            fontSize: typography.fontSizeLarge,
            fontWeight: "bold",
        },

    });

