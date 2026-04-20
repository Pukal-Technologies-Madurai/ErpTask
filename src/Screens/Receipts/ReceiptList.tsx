import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    RefreshControl,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import Icon from "react-native-vector-icons/MaterialIcons";
import { MMKV } from "react-native-mmkv";
import { SafeAreaView } from "react-native-safe-area-context";

import { fetchReceiptList } from "../../Api/receipt";
import { responsiveHeight, responsiveWidth } from "../../constants/helper";
import { useTheme } from "../../Context/ThemeContext";
import AppHeader from "../../Components/AppHeader";
import FilterModal from "../../Components/FilterModal";
import { formatCurrency, formatDate, formatTime } from "../../constants/utils";

const ITEMS_PER_PAGE = 15;

const ReceiptList = ({ route }: { route: any }) => {
    const item = route.params || {};
    const branchIdProps = item.branchId;
    const { typography, colors } = useTheme();
    const styles = getStyles(typography, colors);
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const storage = new MMKV();

    // -- State --
    const [fromDate, setFromDate] = useState<Date>(new Date());
    const [toDate, setToDate] = useState<Date>(new Date());
    const [userId, setUserId] = useState<string | null>(null);
    const [branchId, setBranchId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTransactionType, setSelectedTransactionType] = useState<string>("");
    const [modalVisible, setModalVisible] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    // -- App Init --
    useEffect(() => {
        const uId = storage.getString("userId");
        const bId = storage.getString("branchId");
        if (uId) setUserId(uId);
        if (bId) setBranchId(bId);
    }, []);

    // -- Fetching --
    const {
        data: rawReceipts = [],
        isLoading,
        isFetching,
        error,
        refetch,
    } = useQuery({
        queryKey: ["receiptList", fromDate, toDate, userId, branchIdProps],
        queryFn: () => fetchReceiptList(fromDate, toDate, userId, branchIdProps),
        enabled: !!fromDate && !!toDate && !!userId && (branchIdProps !== undefined || !!branchId),
    });

    const onRefresh = useCallback(() => {
        refetch();
    }, [refetch]);

    // -- Processed Data (Filtering & Sorting) --
    const processedData = useMemo(() => {
        let filtered = [...rawReceipts];

        // Search Filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                r =>
                    r.receipt_invoice_no?.toLowerCase().includes(query) ||
                    r.CreditAccountGet?.toLowerCase().includes(query) ||
                    r.CreatedByGet?.toLowerCase().includes(query) ||
                    r.DebitAccountGet?.toLowerCase().includes(query),
            );
        }

        // Transaction Type Filter
        if (selectedTransactionType) {
            filtered = filtered.filter(
                r => r.transaction_type === selectedTransactionType,
            );
        }

        return filtered;
    }, [rawReceipts, searchQuery, selectedTransactionType]);

    // Derived unique transaction types for filter chips
    const transactionTypes = useMemo(() => {
        const types = new Set<string>();
        rawReceipts.forEach((r: any) => {
            if (r.transaction_type) types.add(r.transaction_type);
        });
        return Array.from(types);
    }, [rawReceipts]);

    // Summary Stats
    const summary = useMemo(() => {
        const total = processedData.reduce((sum, r) => sum + (r.credit_amount || 0), 0);
        return {
            count: processedData.length,
            totalAmount: total,
        };
    }, [processedData]);

    // Pagination Logic
    const totalPages = Math.ceil(processedData.length / ITEMS_PER_PAGE);
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return processedData.slice(start, start + ITEMS_PER_PAGE);
    }, [processedData, currentPage]);

    // Reset page on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedTransactionType, fromDate, toDate]);

    // -- Sub-Components --

    const SummaryDashboard = () => (
        <View style={styles.dashboardContainer}>
            <View style={[styles.statCard, { borderLeftColor: colors.primary }]}>
                <View style={styles.statIconContainer}>
                    <Icon name="receipt-long" size={20} color={colors.primary} />
                </View>
                <View>
                    <Text style={styles.statLabel}>Total Count</Text>
                    <Text style={styles.statValue}>{summary.count}</Text>
                </View>
            </View>
            <View style={[styles.statCard, { borderLeftColor: colors.success }]}>
                <View style={styles.statIconContainer}>
                    <Icon name="account-balance-wallet" size={20} color={colors.success} />
                </View>
                <View>
                    <Text style={styles.statLabel}>Total Amount</Text>
                    <Text style={[styles.statValue, { color: colors.success }]}>
                        {formatCurrency(summary.totalAmount)}
                    </Text>
                </View>
            </View>
        </View>
    );

    const FilterChips = () => (
        <View style={styles.filterSection}>
            <FlatList
                horizontal
                data={["", ...transactionTypes]}
                renderItem={({ item: type }) => (
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setSelectedTransactionType(type)}
                        style={[
                            styles.chip,
                            selectedTransactionType === type && styles.activeChip,
                        ]}>
                        <Text
                            style={[
                                styles.chipText,
                                selectedTransactionType === type && styles.activeChipText,
                            ]}>
                            {type || "All"}
                        </Text>
                    </TouchableOpacity>
                )}
                keyExtractor={item => item}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipList}
            />
        </View>
    );

    const SearchBar = () => (
        <View style={styles.searchWrapper}>
            <View style={styles.searchBar}>
                <Icon name="search" size={20} color={colors.grey500} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search invoice, account..."
                    placeholderTextColor={colors.grey400}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                        <Icon name="close" size={20} color={colors.grey500} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    const ReceiptItem = ({ item: r }: { item: any }) => {
        const isCash = r.transaction_type?.toLowerCase() === "cash";
        const modeColor = isCash ? colors.success : colors.info;
        const modeIcon = isCash ? "payments" : "account-balance";

        return (
            <View style={styles.receiptCard}>
                <View style={[styles.receiptHeader, { borderLeftColor: modeColor }]}>
                    <View style={styles.headerTop}>
                        <Text style={styles.invoiceNo}>{r.receipt_invoice_no}</Text>
                        <Text style={styles.amountText}>
                            {formatCurrency(r.credit_amount)}
                        </Text>
                    </View>
                    <View style={styles.headerBottom}>
                        <View style={styles.modePill}>
                            <Icon name={modeIcon} size={12} color={modeColor} />
                            <Text style={[styles.modeText, { color: modeColor }]}>
                                {r.transaction_type}
                            </Text>
                        </View>
                        <Text style={styles.dateTimeText}>
                            {formatDate(new Date(r.created_on))} • {formatTime(r.created_on)}
                        </Text>
                    </View>
                </View>

                <View style={styles.receiptBody}>
                    <View style={styles.ledgerRow}>
                        <View style={styles.ledgerIcon}>
                            <Icon name="person" size={16} color={colors.grey600} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.ledgerLabel}>Received From (Credit)</Text>
                            <Text style={styles.ledgerName}>{r.CreditAccountGet}</Text>
                        </View>
                    </View>

                    <View style={styles.ledgerRow}>
                        <View style={styles.ledgerIcon}>
                            <Icon name="arrow-forward" size={16} color={colors.grey600} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.ledgerLabel}>Deposited To (Debit)</Text>
                            <Text style={styles.ledgerName}>{r.DebitAccountGet}</Text>
                        </View>
                    </View>

                    {r.remarks && (
                        <View style={styles.remarksBox}>
                            <Text style={styles.remarksText} numberOfLines={2}>
                                {r.remarks}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.receiptFooter}>
                    <Icon name="account-circle" size={14} color={colors.grey400} />
                    <Text style={styles.footerText}>Created by: {r.CreatedByGet}</Text>
                </View>
            </View>
        );
    };

    const Pagination = () => {
        if (totalPages <= 1) return null;
        return (
            <View style={styles.pagination}>
                <TouchableOpacity
                    disabled={currentPage === 1}
                    onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
                    style={[styles.pageButton, currentPage === 1 && styles.disabledButton]}>
                    <Icon name="chevron-left" size={24} color={currentPage === 1 ? colors.grey300 : colors.primary} />
                </TouchableOpacity>
                <Text style={styles.pageInfo}>
                    Page {currentPage} of {totalPages}
                </Text>
                <TouchableOpacity
                    disabled={currentPage === totalPages}
                    onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    style={[styles.pageButton, currentPage === totalPages && styles.disabledButton]}>
                    <Icon name="chevron-right" size={24} color={currentPage === totalPages ? colors.grey300 : colors.primary} />
                </TouchableOpacity>
            </View>
        );
    };

    const EmptyState = () => (
        <View style={styles.emptyContainer}>
            <Icon name="receipt" size={64} color={colors.grey200} />
            <Text style={styles.emptyTitle}>No Receipts Found</Text>
            <Text style={styles.emptySubtitle}>
                {searchQuery ? "Try a different search term" : "Try adjusting the date filters"}
            </Text>
        </View>
    );

    // -- Main Render --
    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <AppHeader
                title="Receipt Collection"
                navigation={navigation}
                showRightIcon
                rightIconLibrary="MaterialIcon"
                rightIconName="date-range"
                onRightPress={() => setModalVisible(true)}
            />

            <FilterModal
                visible={modalVisible}
                fromDate={fromDate}
                toDate={toDate}
                onFromDateChange={setFromDate}
                onToDateChange={setToDate}
                onApply={() => setModalVisible(false)}
                onClose={() => setModalVisible(false)}
                showToDate
                title="Select Date Range"
            />

            <FlatList
                data={paginatedData}
                keyExtractor={item => item.receipt_id}
                renderItem={({ item }) => <ReceiptItem item={item} />}
                ListHeaderComponent={
                    <View>
                        <SummaryDashboard />
                        <SearchBar />
                        <FilterChips />
                    </View>
                }
                ListFooterComponent={<Pagination />}
                ListEmptyComponent={!isLoading ? <EmptyState /> : null}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={isFetching && !isLoading}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                        tintColor={colors.primary}
                    />
                }
            />

            {isLoading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Fetching Records...</Text>
                </View>
            )}
        </SafeAreaView>
    );
};

const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.primary,
        },
        listContent: {
            backgroundColor: "#f8f9fa",
            paddingBottom: responsiveHeight(4),
            flexGrow: 1,
        },

        // Summary Dashboard
        dashboardContainer: {
            flexDirection: "row",
            padding: responsiveWidth(4),
            gap: responsiveWidth(3),
        },
        statCard: {
            flex: 1,
            backgroundColor: colors.white,
            padding: responsiveWidth(3),
            borderRadius: 12,
            borderLeftWidth: 4,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            elevation: 3,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
        },
        statIconContainer: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: "#f2f2f2",
            alignItems: "center",
            justifyContent: "center",
        },
        statLabel: {
            ...typography.caption,
            color: colors.grey600,
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 0.5,
        },
        statValue: {
            ...typography.subtitle1,
            fontWeight: "700",
            color: colors.text,
        },

        // Search Bar
        searchWrapper: {
            paddingHorizontal: responsiveWidth(4),
            marginBottom: responsiveHeight(1),
        },
        searchBar: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.white,
            borderRadius: 12,
            paddingHorizontal: 15,
            height: 48,
            borderWidth: 1,
            borderColor: "#e0e0e0",
        },
        searchInput: {
            flex: 1,
            color: colors.text,
            marginLeft: 10,
            ...typography.body2,
        },

        // Filter Chips
        filterSection: {
            marginBottom: responsiveHeight(1),
        },
        chipList: {
            paddingHorizontal: responsiveWidth(4),
            paddingVertical: 5,
        },
        chip: {
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: colors.white,
            marginRight: 8,
            borderWidth: 1,
            borderColor: "#e0e0e0",
        },
        activeChip: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        chipText: {
            ...typography.caption,
            color: colors.grey700,
            fontWeight: "600",
        },
        activeChipText: {
            color: colors.white,
        },

        // Receipt Card
        receiptCard: {
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(4),
            marginVertical: responsiveHeight(0.8),
            borderRadius: 16,
            overflow: "hidden",
            elevation: 2,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
        },
        receiptHeader: {
            padding: 12,
            borderLeftWidth: 5,
            backgroundColor: "#fcfcfc",
            borderBottomWidth: 1,
            borderBottomColor: "#f0f0f0",
        },
        headerTop: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
        },
        invoiceNo: {
            ...typography.body2,
            fontWeight: "700",
            color: colors.primary,
        },
        amountText: {
            ...typography.subtitle2,
            fontWeight: "800",
            color: colors.text,
        },
        headerBottom: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        modePill: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#f5f5f5",
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
            gap: 4,
        },
        modeText: {
            fontSize: 10,
            fontWeight: "700",
            textTransform: "uppercase",
        },
        dateTimeText: {
            ...typography.caption,
            color: colors.grey500,
            fontSize: 10,
        },
        receiptBody: {
            padding: 12,
            gap: 12,
        },
        ledgerRow: {
            flexDirection: "row",
            gap: 12,
        },
        ledgerIcon: {
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: "#f0f0f0",
            alignItems: "center",
            justifyContent: "center",
        },
        ledgerLabel: {
            ...typography.caption,
            color: colors.grey500,
            fontSize: 10,
        },
        ledgerName: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "600",
        },
        remarksBox: {
            backgroundColor: "#fff9c4",
            padding: 8,
            borderRadius: 8,
            marginTop: 4,
        },
        remarksText: {
            fontSize: 11,
            fontStyle: "italic",
            color: "#5d4037",
        },
        receiptFooter: {
            flexDirection: "row",
            alignItems: "center",
            padding: 10,
            backgroundColor: "#fafafa",
            borderTopWidth: 1,
            borderTopColor: "#f0f0f0",
            gap: 6,
        },
        footerText: {
            ...typography.caption,
            color: colors.grey500,
            fontSize: 11,
        },

        // Pagination
        pagination: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 20,
            gap: 20,
        },
        pageButton: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.white,
            alignItems: "center",
            justifyContent: "center",
            elevation: 2,
        },
        disabledButton: {
            backgroundColor: "#f0f0f0",
            elevation: 0,
        },
        pageInfo: {
            ...typography.body2,
            fontWeight: "600",
            color: colors.grey700,
        },

        // Utils
        loadingOverlay: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: "rgba(255,255,255,0.7)",
            alignItems: "center",
            justifyContent: "center",
        },
        loadingText: {
            marginTop: 10,
            color: colors.primary,
            fontWeight: "600",
        },
        emptyContainer: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 100,
        },
        emptyTitle: {
            ...typography.h6,
            color: colors.grey400,
            marginTop: 15,
        },
        emptySubtitle: {
            ...typography.body2,
            color: colors.grey400,
            marginTop: 5,
        },
    });

export default ReceiptList;
