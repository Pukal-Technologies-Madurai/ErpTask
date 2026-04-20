import {
    StyleSheet,
    Text,
    View,
    FlatList,
    RefreshControl,
    ActivityIndicator,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import Icon from "react-native-vector-icons/MaterialIcons";

import AppHeader from "../../Components/AppHeader";
import FilterModal from "../../Components/FilterModal";
import { API } from "../../constants/api";
import { responsiveHeight, responsiveWidth } from "../../constants/helper";
import { useTheme } from "../../Context/ThemeContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatAPIDate = (date: Date) => date.toISOString().split("T")[0];

const formatDisplayDate = (d?: string) => {
    if (!d) return "";
    const date = new Date(d);
    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
    });
};

const formatCurrency = (amount: number) => {
    if (!amount) return "—";
    if (Math.abs(amount) >= 100_000)
        return `₹${(amount / 100_000).toFixed(1)}L`;
    if (Math.abs(amount) >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
    return `₹${amount.toFixed(0)}`;
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Transaction {
    invoice_no: string;
    Batch: string | null;
    Ledger_Date: string;
    Product_Id: string;
    Product_Name: string;
    Godown_Id: string;
    Godown_Name: string;
    In_Qty: number;
    Out_Qty: number;
    Rate: number;
    Amount: number;
    Trans_Id: string;
    voucher_name: string;
    Particulars: string;
    Retailer_Name: string;
    ord: number;
    // computed
    closing?: number | null;
}

// Voucher type → color / icon mapping
const getVoucherMeta = (
    voucher: string,
    particulars: string,
    colors: any,
): { color: string; bg: string; icon: string; label: string } => {
    const v = (voucher || particulars || "").toLowerCase();
    if (v.includes("opening") || v.includes("ob"))
        return {
            color: colors.info,
            bg: colors.info + "18",
            icon: "account-balance",
            label: "OB",
        };
    if (v.includes("purchase") || v.includes("pur"))
        return {
            color: colors.success,
            bg: colors.success + "18",
            icon: "arrow-downward",
            label: "PUR",
        };
    if (v.includes("sale") || v.includes("sals"))
        return {
            color: colors.accent,
            bg: colors.accent + "18",
            icon: "arrow-upward",
            label: "SALE",
        };
    if (v.includes("return"))
        return {
            color: colors.warning,
            bg: colors.warning + "18",
            icon: "undo",
            label: "RET",
        };
    if (v.includes("transfer"))
        return {
            color: colors.rec,
            bg: colors.rec + "18",
            icon: "swap-horiz",
            label: "TRF",
        };
    return {
        color: colors.textSecondary,
        bg: colors.grey100,
        icon: "receipt",
        label: "TXN",
    };
};

// ─── Screen ───────────────────────────────────────────────────────────────────
const GodownItemWiseTransaction = () => {
    const { typography, colors } = useTheme();
    const styles = getStyles(typography, colors);

    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const route = useRoute<any>();

    const {
        ProductId,
        GodownId,
        productName,
        fromDate: routeFromDate,
        toDate: routeToDate,
    } = route.params;

    const [fromDate, setFromDate] = useState<Date>(
        routeFromDate ? new Date(routeFromDate) : new Date(),
    );
    const [toDate, setToDate] = useState<Date>(
        routeToDate ? new Date(routeToDate) : new Date(),
    );
    const [modalVisible, setModalVisible] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // ── Fetch ──────────────────────────────────────────────────────────────
    const fetchTransactions = useCallback(async () => {
        if (!ProductId) return;
        setLoading(true);
        try {
            const res = await fetch(
                API.godownitemwisetransaction(
                    formatAPIDate(fromDate),
                    formatAPIDate(toDate),
                    ProductId,
                    GodownId,
                ),
            );
            const json = await res.json();
            setTransactions(Array.isArray(json?.data) ? json.data : []);
        } catch (e) {
            console.error("Item transaction fetch failed", e);
            setTransactions([]);
        } finally {
            setLoading(false);
        }
    }, [ProductId, GodownId, fromDate, toDate]);

    useEffect(() => {
        fetchTransactions();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchTransactions();
        setRefreshing(false);
    };

    // ── Running balance (tally ledger style) ──────────────────────────────
    const ledgerRows = useMemo((): Transaction[] => {
        let running = 0;
        const sorted = [...transactions].sort(
            (a, b) =>
                new Date(a.Ledger_Date).getTime() -
                new Date(b.Ledger_Date).getTime() || a.ord - b.ord,
        );
        return sorted.map((row, index) => {
            running += (row.In_Qty || 0) - (row.Out_Qty || 0);
            const next = sorted[index + 1];
            const isLastOfDate =
                !next ||
                new Date(next.Ledger_Date).toDateString() !==
                new Date(row.Ledger_Date).toDateString();
            return { ...row, closing: isLastOfDate ? running : null };
        });
    }, [transactions]);

    // ── Summary totals ─────────────────────────────────────────────────────
    const summary = useMemo(() => {
        const totalIn = transactions.reduce((s, t) => s + (t.In_Qty || 0), 0);
        const totalOut = transactions.reduce((s, t) => s + (t.Out_Qty || 0), 0);
        const totalAmt = transactions.reduce((s, t) => s + (t.Amount || 0), 0);
        const ob = transactions.find(
            t => t.Particulars === "Opening Balance" || t.invoice_no === "OB",
        );
        return { totalIn, totalOut, totalAmt, obQty: ob?.In_Qty ?? 0 };
    }, [transactions]);

    // ── Row renderer ──────────────────────────────────────────────────────
    const renderRow = ({
        item: t,
        index,
    }: {
        item: Transaction;
        index: number;
    }) => {
        const isOB =
            t.Particulars === "Opening Balance" || t.invoice_no === "OB";
        const isIn = (t.In_Qty || 0) > 0;
        const qty = isIn ? t.In_Qty : t.Out_Qty;
        const meta = getVoucherMeta(t.voucher_name, t.Particulars, colors);
        const closingColor =
            t.closing != null
                ? t.closing > 0
                    ? colors.success
                    : t.closing < 0
                        ? colors.accent
                        : colors.text
                : "transparent";

        return (
            <View
                style={[
                    styles.txnCard,
                    isOB && styles.txnCardOB,
                    index === 0 && { marginTop: responsiveHeight(0.5) },
                ]}>
                {/* Left type indicator */}
                <View
                    style={[styles.txnTypeBadge, { backgroundColor: meta.bg }]}>
                    <Icon name={meta.icon} size={14} color={meta.color} />
                    <Text style={[styles.txnTypeLabel, { color: meta.color }]}>
                        {meta.label}
                    </Text>
                </View>

                {/* Main content */}
                <View style={styles.txnContent}>
                    {/* Row 1: Particulars + date */}
                    <View style={styles.txnRow1}>
                        <Text style={styles.txnParticulars} numberOfLines={1}>
                            {t.Particulars || t.voucher_name || "Transaction"}
                        </Text>
                        <Text style={styles.txnDate}>
                            {formatDisplayDate(t.Ledger_Date)}
                        </Text>
                    </View>

                    {/* Row 2: Invoice no + retailer */}
                    {!isOB && (
                        <View style={styles.txnRow2}>
                            <Text style={styles.txnInvoice} numberOfLines={1}>
                                {t.invoice_no || "—"}
                            </Text>
                            {!!t.Retailer_Name && (
                                <Text
                                    style={styles.txnRetailer}
                                    numberOfLines={1}>
                                    {t.Retailer_Name.trim()}
                                </Text>
                            )}
                        </View>
                    )}

                    {/* Row 3: Qty pill + amount + closing */}
                    <View style={styles.txnRow3}>
                        {/* In/Out qty */}
                        <View style={styles.qtyPillsRow}>
                            {(t.In_Qty || 0) > 0 && (
                                <View
                                    style={[
                                        styles.qtyPill,
                                        {
                                            backgroundColor:
                                                colors.success + "18",
                                        },
                                    ]}>
                                    <Icon
                                        name="add"
                                        size={10}
                                        color={colors.success}
                                    />
                                    <Text
                                        style={[
                                            styles.qtyPillText,
                                            { color: colors.success },
                                        ]}>
                                        {t.In_Qty} In
                                    </Text>
                                </View>
                            )}
                            {(t.Out_Qty || 0) > 0 && (
                                <View
                                    style={[
                                        styles.qtyPill,
                                        {
                                            backgroundColor:
                                                colors.accent + "18",
                                        },
                                    ]}>
                                    <Icon
                                        name="remove"
                                        size={10}
                                        color={colors.accent}
                                    />
                                    <Text
                                        style={[
                                            styles.qtyPillText,
                                            { color: colors.accent },
                                        ]}>
                                        {t.Out_Qty} Out
                                    </Text>
                                </View>
                            )}
                            {t.Rate > 0 && (
                                <Text style={styles.txnRate}>@ ₹{t.Rate}</Text>
                            )}
                        </View>

                        {/* Amount + Closing balance */}
                        <View style={styles.txnRightKpis}>
                            {t.Amount > 0 && (
                                <Text style={styles.txnAmount}>
                                    {formatCurrency(t.Amount)}
                                </Text>
                            )}
                            {t.closing != null && (
                                <View
                                    style={[
                                        styles.closingBadge,
                                        { borderColor: closingColor },
                                    ]}>
                                    <Text
                                        style={[
                                            styles.closingText,
                                            { color: closingColor },
                                        ]}>
                                        Bal: {t.closing}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    // ── Header card (product info + totals) ────────────────────────────────
    const ListHeader = () => (
        <View style={styles.listHeader}>
            {/* Product name bar */}
            <View style={styles.productBar}>
                <View style={styles.productIconBg}>
                    <Icon name="inventory-2" size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.productName} numberOfLines={2}>
                        {productName || "Product"}
                    </Text>
                    <Text style={styles.productMeta}>
                        {fromDate.toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                        })}{" "}
                        →{" "}
                        {toDate.toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                        })}
                    </Text>
                </View>
            </View>

            {/* Summary KPI row */}
            <View style={styles.summaryRow}>
                <View style={styles.kpi}>
                    <Text style={styles.kpiValue}>{summary.obQty}</Text>
                    <Text style={styles.kpiLabel}>Opening</Text>
                </View>
                <View style={styles.kpiDivider} />
                <View style={styles.kpi}>
                    <Text style={[styles.kpiValue, { color: colors.success }]}>
                        {summary.totalIn}
                    </Text>
                    <Text style={styles.kpiLabel}>Total In</Text>
                </View>
                <View style={styles.kpiDivider} />
                <View style={styles.kpi}>
                    <Text style={[styles.kpiValue, { color: colors.accent }]}>
                        {summary.totalOut}
                    </Text>
                    <Text style={styles.kpiLabel}>Total Out</Text>
                </View>
                <View style={styles.kpiDivider} />
                <View style={styles.kpi}>
                    <Text style={[styles.kpiValue, { color: colors.primary }]}>
                        {summary.obQty + summary.totalIn - summary.totalOut}
                    </Text>
                    <Text style={styles.kpiLabel}>Closing</Text>
                </View>
                <View style={styles.kpiDivider} />
                <View style={styles.kpi}>
                    <Text style={styles.kpiValue}>
                        {formatCurrency(summary.totalAmt)}
                    </Text>
                    <Text style={styles.kpiLabel}>Amount</Text>
                </View>
            </View>

            <Text style={styles.txnCount}>
                {ledgerRows.length} transaction
                {ledgerRows.length !== 1 ? "s" : ""}
            </Text>
        </View>
    );

    const ListEmpty = () => (
        <View style={styles.emptyContainer}>
            <Icon name="receipt-long" size={56} color={colors.grey300} />
            <Text style={styles.emptyTitle}>No transactions found</Text>
            <Text style={styles.emptySubtitle}>
                Try adjusting the date range
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <AppHeader
                title="Item Transactions"
                navigation={navigation}
                showRightIcon
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
                onApply={() => {
                    setModalVisible(false);
                    fetchTransactions();
                }}
                onClose={() => setModalVisible(false)}
                showToDate
                title="Select Date Range"
                fromLabel="From Date"
                toLabel="To Date"
            />

            {loading && !refreshing ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loaderText}>Loading transactions…</Text>
                </View>
            ) : (
                <FlatList
                    data={ledgerRows}
                    keyExtractor={(_, i) => String(i)}
                    renderItem={renderRow}
                    ListHeaderComponent={<ListHeader />}
                    ListEmptyComponent={<ListEmpty />}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[colors.primary]}
                            tintColor={colors.primary}
                        />
                    }
                    showsVerticalScrollIndicator={false}
                />
            )}
        </SafeAreaView>
    );
};

export default GodownItemWiseTransaction;

// ─── Styles ───────────────────────────────────────────────────────────────────
const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.primary,
        },
        listContent: {
            flexGrow: 1,
            backgroundColor: colors.background,
            paddingBottom: responsiveHeight(4),
        },

        // ── Loader ────────────────────────────────────────────────────────
        loaderContainer: {
            flex: 1,
            backgroundColor: colors.background,
            alignItems: "center",
            justifyContent: "center",
            gap: responsiveWidth(3),
        },
        loaderText: {
            ...typography.body2,
            color: colors.textSecondary,
        },

        // ── List Header ───────────────────────────────────────────────────
        listHeader: {
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(3),
            marginTop: responsiveHeight(1),
            marginBottom: responsiveHeight(0.5),
            borderRadius: 14,
            overflow: "hidden",
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.07,
            shadowRadius: 5,
            elevation: 3,
        },
        productBar: {
            flexDirection: "row",
            alignItems: "center",
            padding: responsiveWidth(4),
            gap: responsiveWidth(3),
            borderBottomWidth: 1,
            borderBottomColor: colors.borderColor,
        },
        productIconBg: {
            width: responsiveWidth(10),
            height: responsiveWidth(10),
            borderRadius: responsiveWidth(5),
            backgroundColor: colors.primary + "15",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
        },
        productName: {
            ...typography.body1,
            color: colors.text,
            fontWeight: "700",
        },
        productMeta: {
            ...typography.caption,
            color: colors.textSecondary,
            marginTop: 2,
        },

        // KPI summary row
        summaryRow: {
            flexDirection: "row",
            paddingHorizontal: responsiveWidth(2),
            paddingVertical: responsiveWidth(3),
        },
        kpi: {
            flex: 1,
            alignItems: "center",
        },
        kpiValue: {
            ...typography.body2,
            fontWeight: "700",
            color: colors.text,
        },
        kpiLabel: {
            ...typography.overline,
            color: colors.textSecondary,
            marginTop: 2,
        },
        kpiDivider: {
            width: 1,
            height: responsiveHeight(3.5),
            backgroundColor: colors.borderColor,
            alignSelf: "center",
        },
        txnCount: {
            ...typography.overline,
            color: colors.textSecondary,
            textAlign: "center",
            paddingBottom: responsiveWidth(2),
        },

        // ── Transaction Card ──────────────────────────────────────────────
        txnCard: {
            flexDirection: "row",
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(3),
            marginBottom: responsiveHeight(0.6),
            borderRadius: 10,
            overflow: "hidden",
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 3,
            elevation: 1,
        },
        txnCardOB: {
            borderLeftWidth: 3,
            borderLeftColor: colors.info,
            backgroundColor: colors.info + "06",
        },

        // Left badge
        txnTypeBadge: {
            width: responsiveWidth(12),
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: responsiveWidth(3),
            gap: 3,
            flexShrink: 0,
        },
        txnTypeLabel: {
            fontSize: 9,
            fontWeight: "700",
            letterSpacing: 0.3,
        },

        // Content area
        txnContent: {
            flex: 1,
            paddingVertical: responsiveWidth(2.5),
            paddingRight: responsiveWidth(3),
            paddingLeft: responsiveWidth(2),
            borderLeftWidth: 1,
            borderLeftColor: colors.borderColor,
        },
        txnRow1: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 3,
        },
        txnParticulars: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "600",
            flex: 1,
        },
        txnDate: {
            ...typography.overline,
            color: colors.textSecondary,
            marginLeft: responsiveWidth(2),
            flexShrink: 0,
        },
        txnRow2: {
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 4,
            gap: responsiveWidth(2),
        },
        txnInvoice: {
            ...typography.overline,
            color: colors.primary,
            fontWeight: "600",
            flex: 1,
        },
        txnRetailer: {
            ...typography.overline,
            color: colors.textSecondary,
            flex: 1,
            textAlign: "right",
        },
        txnRow3: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        },

        // Qty pills
        qtyPillsRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(1.5),
            flex: 1,
        },
        qtyPill: {
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 10,
            paddingHorizontal: responsiveWidth(2),
            paddingVertical: 2,
            gap: 2,
        },
        qtyPillText: {
            fontSize: 11,
            fontWeight: "700",
        },
        txnRate: {
            ...typography.overline,
            color: colors.textSecondary,
        },

        // Right KPIs (amount + closing)
        txnRightKpis: {
            alignItems: "flex-end",
            gap: 3,
            flexShrink: 0,
        },
        txnAmount: {
            ...typography.caption,
            color: colors.text,
            fontWeight: "600",
        },
        closingBadge: {
            borderWidth: 1,
            borderRadius: 6,
            paddingHorizontal: responsiveWidth(1.5),
            paddingVertical: 1,
        },
        closingText: {
            fontSize: 10,
            fontWeight: "700",
        },

        // ── Empty state ───────────────────────────────────────────────────
        emptyContainer: {
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: responsiveHeight(10),
            gap: responsiveWidth(2),
        },
        emptyTitle: {
            ...typography.h6,
            color: colors.textSecondary,
            textAlign: "center",
        },
        emptySubtitle: {
            ...typography.body2,
            color: colors.textSecondary,
            textAlign: "center",
        },
    });
