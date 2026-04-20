import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
    StyleSheet,
    Text,
    View,
    FlatList,
    RefreshControl,
    ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";

import AppHeader from "../../Components/AppHeader";
import FilterModal from "../../Components/FilterModal";
import { useTheme } from "../../Context/ThemeContext";
import { responsiveHeight, responsiveWidth } from "../../constants/helper";
import { API } from "../../constants/api";
import { formatCurrency } from "../../constants/utils";

// ---------------- TYPES ----------------
type TransactionRow = {
    invoice_no?: string;
    Ledger_Date: string;
    Particulars: string;
    Credit_Amt: number;
    Debit_Amt: number;
    Trans_Id: string;
    ord: number;
    Narration?: string;
    Line_Naration?: string;
    Account_name?: string;
    // Computed field
    runningBalance?: number;
};

// ---------------- SCREEN ----------------

const TransactionListExpenses = () => {
    const { typography, colors } = useTheme();
    const styles = getStyles(typography, colors);
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const route = useRoute<any>();

    const {
        accId,
        accName,
        fromDate: routeFromDate,
        toDate: routeToDate,
    } = route.params ?? {};

    const [fromDate, setFromDate] = useState<Date>(
        routeFromDate ? new Date(routeFromDate) : new Date(),
    );
    const [toDate, setToDate] = useState<Date>(
        routeToDate ? new Date(routeToDate) : new Date(),
    );

    const [modalVisible, setModalVisible] = useState(false);
    const [transactions, setTransactions] = useState<TransactionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // ---------------- FETCH ----------------
    const fetchTransactions = useCallback(async () => {
        if (!accId) return;
        const from = fromDate.toISOString().split("T")[0];
        const to = toDate.toISOString().split("T")[0];

        setLoading(true);
        try {
            const res = await fetch(API.getTransactionReports(from, to, accId));
            const json = await res.json();
            setTransactions(Array.isArray(json?.data) ? json.data : []);
        } catch (e) {
            console.error("Expense transaction fetch failed", e);
            setTransactions([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [accId, fromDate, toDate]);

    useEffect(() => {
        fetchTransactions();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchTransactions();
    };

    // ---------------- LOGIC ----------------
    const ledgerData = useMemo(() => {
        // Sort by date then by order index
        const sorted = [...transactions].sort((a, b) => {
            const dateA = new Date(a.Ledger_Date).getTime();
            const dateB = new Date(b.Ledger_Date).getTime();
            if (dateA !== dateB) return dateA - dateB;
            return a.ord - b.ord;
        });

        let balance = 0;
        return sorted.map(t => {
            // Expenses are usually Debit-heavy.
            // Balance = Previous + Debit - Credit
            balance += (t.Debit_Amt || 0) - (t.Credit_Amt || 0);
            return { ...t, runningBalance: balance };
        });
    }, [transactions]);

    const totals = useMemo(() => {
        const debit = transactions.reduce((s, t) => s + (t.Debit_Amt || 0), 0);
        const credit = transactions.reduce((s, t) => s + (t.Credit_Amt || 0), 0);
        return { debit, credit, net: debit - credit };
    }, [transactions]);

    // ---------------- COMPONENTS ----------------

    const ListHeader = () => (
        <View style={styles.headerArea}>
            <View style={styles.accountBox}>
                <View style={styles.accountIconBg}>
                    <Icon name="receipt" size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.accountName} numberOfLines={2}>
                        {accName || "Expense Ledger"}
                    </Text>
                    <Text style={styles.dateRange}>
                        {fromDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} —{" "}
                        {toDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </Text>
                </View>
            </View>

            <View style={styles.summaryRow}>
                <View style={styles.stat}>
                    <Text style={styles.statLabel}>Total Spend (DR)</Text>
                    <Text style={[styles.statValue, { color: colors.error }]}>
                        {formatCurrency(totals.debit)}
                    </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                    <Text style={styles.statLabel}>Recovery (CR)</Text>
                    <Text style={[styles.statValue, { color: colors.success }]}>
                        {formatCurrency(totals.credit)}
                    </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                    <Text style={styles.statLabel}>Net Period</Text>
                    <Text style={[styles.statValue, { color: colors.primary }]}>
                        {formatCurrency(Math.abs(totals.net))}
                        <Text style={styles.miniIndicator}>
                            {" "}{totals.net >= 0 ? "DR" : "CR"}
                        </Text>
                    </Text>
                </View>
            </View>
        </View>
    );

    const TransactionItem = ({ item }: { item: TransactionRow }) => {
        const date = new Date(item.Ledger_Date);
        const day = date.getDate();
        const month = date.toLocaleDateString("en-IN", { month: "short" });

        const isDebit = (item.Debit_Amt || 0) > 0;
        const isOB = item.invoice_no === "OB";
        const amount = isDebit ? item.Debit_Amt : item.Credit_Amt;
        const color = isDebit ? colors.error : colors.success; // Expenses: DR is Red (Debit), CR is Green (Credit)

        return (
            <View style={[styles.card, isOB && styles.obCard]}>
                {/* Date Side */}
                <View style={styles.dateCol}>
                    <Text style={styles.dayText}>{day}</Text>
                    <View style={styles.monthPill}>
                        <Text style={styles.monthText}>{month}</Text>
                    </View>
                </View>

                {/* Content */}
                <View style={styles.contentCol}>
                    <View style={styles.topLine}>
                        <Text style={styles.particulars} numberOfLines={1}>{item.Particulars}</Text>
                        <Text style={[styles.amount, { color }]}>
                            {isDebit ? "+" : "-"}{formatCurrency(amount)}
                        </Text>
                    </View>

                    <View style={styles.midLine}>
                        <Text style={styles.invoiceNo}>{item.invoice_no || "—"}</Text>
                        {item.runningBalance !== undefined && (
                            <View style={styles.balBadge}>
                                <Text style={styles.balText}>
                                    Bal: {formatCurrency(Math.abs(item.runningBalance))}
                                    <Text style={{ fontSize: 8 }}>
                                        {" "}{item.runningBalance >= 0 ? "DR" : "CR"}
                                    </Text>
                                </Text>
                            </View>
                        )}
                    </View>

                    {(item.Narration || item.Line_Naration) && (
                        <View style={styles.narrationBox}>
                            <Icon name="notes" size={12} color={colors.grey400} style={{ marginTop: 2 }} />
                            <Text style={styles.narration} numberOfLines={3}>
                                {item.Narration || item.Line_Naration}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <AppHeader
                title="Expense Transactions"
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
                onApply={() => { setModalVisible(false); fetchTransactions(); }}
                onClose={() => setModalVisible(false)}
                showToDate
                title="Select Date Range"
            />

            <FlatList
                data={ledgerData}
                keyExtractor={(item, index) => `${item.Trans_Id}-${index}`}
                renderItem={({ item }) => <TransactionItem item={item} />}
                ListHeaderComponent={<ListHeader />}
                ListEmptyComponent={!loading ? (
                    <View style={styles.empty}>
                        <Icon name="description" size={64} color={colors.grey200} />
                        <Text style={styles.emptyTitle}>No Entries</Text>
                        <Text style={styles.emptySubtitle}>No expense transactions for this period</Text>
                    </View>
                ) : null}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                        tintColor={colors.primary}
                    />
                }
            />

            {loading && !refreshing && (
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading Ledger...</Text>
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

        // Header Area
        headerArea: {
            backgroundColor: colors.white,
            marginBottom: 10,
            paddingBottom: 5,
            elevation: 3,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
        },
        accountBox: {
            flexDirection: "row",
            alignItems: "center",
            padding: responsiveWidth(4),
            gap: 15,
        },
        accountIconBg: {
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: colors.primary + "15",
            alignItems: "center",
            justifyContent: "center",
        },
        accountName: {
            ...typography.body1,
            fontWeight: "700",
            color: colors.text,
        },
        dateRange: {
            ...typography.caption,
            color: colors.grey500,
            marginTop: 2,
        },
        summaryRow: {
            flexDirection: "row",
            paddingHorizontal: responsiveWidth(2),
            paddingVertical: 10,
            borderTopWidth: 1,
            borderTopColor: "#f0f0f0",
        },
        stat: {
            flex: 1,
            alignItems: "center",
        },
        statLabel: {
            ...typography.caption,
            fontSize: 9,
            color: colors.grey600,
            textTransform: "uppercase",
            marginBottom: 2,
        },
        statValue: {
            fontSize: 12,
            fontWeight: "700",
        },
        miniIndicator: {
            fontSize: 8,
            fontWeight: "700",
        },
        statDivider: {
            width: 1,
            height: 20,
            backgroundColor: "#e0e0e0",
            alignSelf: "center",
        },

        // Cards
        card: {
            flexDirection: "row",
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(3),
            marginVertical: responsiveHeight(0.6),
            borderRadius: 14,
            padding: 12,
            gap: 12,
            elevation: 2,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 3,
        },
        obCard: {
            backgroundColor: colors.primary + "10",
            borderLeftWidth: 4,
            borderLeftColor: colors.primary,
        },
        dateCol: {
            alignItems: "center",
            justifyContent: "center",
            width: 45,
            gap: 4,
        },
        dayText: {
            ...typography.h6,
            fontWeight: "800",
            color: colors.text,
            lineHeight: 24,
        },
        monthPill: {
            backgroundColor: "#f0f0f0",
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 6,
        },
        monthText: {
            fontSize: 9,
            fontWeight: "700",
            color: colors.grey700,
            textTransform: "uppercase",
        },
        contentCol: {
            flex: 1,
            gap: 6,
        },
        topLine: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        particulars: {
            ...typography.body2,
            fontWeight: "700",
            color: colors.text,
            flex: 1,
        },
        amount: {
            ...typography.body2,
            fontWeight: "800",
            marginLeft: 10,
        },
        midLine: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        invoiceNo: {
            ...typography.caption,
            color: colors.primary,
            fontWeight: "600",
        },
        balBadge: {
            backgroundColor: "#f5f5f5",
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 6,
            borderWidth: 0.5,
            borderColor: "#e0e0e0",
        },
        balText: {
            fontSize: 10,
            fontWeight: "700",
            color: colors.grey700,
        },
        narrationBox: {
            flexDirection: "row",
            gap: 6,
            backgroundColor: "#FFF9C4", // Light yellow for expense details
            paddingHorizontal: 8,
            paddingVertical: 6,
            borderRadius: 8,
            marginTop: 2,
        },
        narration: {
            ...typography.caption,
            color: "#5D4037",
            fontSize: 11,
            lineHeight: 16,
            flex: 1,
        },

        // Utils
        loading: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: "rgba(255,255,255,0.8)",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
        },
        loadingText: {
            marginTop: 10,
            color: colors.primary,
            fontWeight: "600",
        },
        empty: {
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

export default TransactionListExpenses;
