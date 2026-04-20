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
    Ledger_Desc?: string;
    Particulars: string;
    Credit_Amt: number;
    Debit_Amt: number;
    Trans_Id: string;
    ord: number;
    Narration?: string;
    Line_Naration?: string;
    // Computed fields
    runningBalance?: number;
};

// ---------------- SCREEN ----------------

const TransactionList = () => {
    const { typography, colors } = useTheme();
    const styles = getStyles(typography, colors);
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const route = useRoute<any>();

    const retailer = route.params?.retailer;
    const accId = Number(retailer?.AC_Id ?? retailer?.Acc_Id);

    const [fromDate, setFromDate] = useState<Date>(new Date());
    const [toDate, setToDate] = useState<Date>(new Date());
    const [modalVisible, setModalVisible] = useState(false);
    const [transactions, setTransactions] = useState<TransactionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // ---------------- FETCH ----------------
    const fetchTransactions = useCallback(async () => {
        const from = fromDate.toISOString().split("T")[0];
        const to = toDate.toISOString().split("T")[0];

        setLoading(true);
        try {
            const res = await fetch(API.getTransactionReports(from, to, accId));
            const json = await res.json();
            setTransactions(Array.isArray(json?.data) ? json.data : []);
        } catch (e) {
            console.error("Transaction fetch failed", e);
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
            // Formula: Debit adds to balance, Credit subtracts (assuming asset/debtor style)
            // or vice versa depending on account type. Actually standard ledger usually
            // shows running balance as (Debit - Credit) or (Credit - Debit).
            // We'll follow the provided sample's logic (OB was CR, added to CR).
            // But usually DR is positive for Debtors. Let's stick to (Debit - Credit)
            // and the sign/indicator handles the rest.
            balance += (t.Debit_Amt || 0) - (t.Credit_Amt || 0);
            return { ...t, runningBalance: balance };
        });
    }, [transactions]);

    const totals = useMemo(() => {
        const tCredit = transactions.reduce((s, t) => s + (t.Credit_Amt || 0), 0);
        const tDebit = transactions.reduce((s, t) => s + (t.Debit_Amt || 0), 0);
        const obRow = transactions.find(t => t.invoice_no === "OB");
        const ob = (obRow?.Debit_Amt || 0) - (obRow?.Credit_Amt || 0);

        return { tCredit, tDebit, ob };
    }, [transactions]);

    // ---------------- COMPONENTS ----------------

    const ListHeader = () => (
        <View style={styles.headerArea}>
            <View style={styles.accountBox}>
                <View style={styles.accountIconBg}>
                    <Icon name="account-balance" size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.accountName} numberOfLines={2}>
                        {retailer?.Retailer_Name || retailer?.Account_name || "Account Ledger"}
                    </Text>
                    <Text style={styles.dateRange}>
                        {fromDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} —{" "}
                        {toDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </Text>
                </View>
            </View>

            <View style={styles.summaryRow}>
                <View style={styles.stat}>
                    <Text style={styles.statLabel}>Total In (DR)</Text>
                    <Text style={[styles.statValue, { color: colors.info }]}>
                        {formatCurrency(totals.tDebit)}
                    </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                    <Text style={styles.statLabel}>Total Out (CR)</Text>
                    <Text style={[styles.statValue, { color: colors.accent }]}>
                        {formatCurrency(totals.tCredit)}
                    </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                    <Text style={styles.statLabel}>Net Balance</Text>
                    <Text style={[styles.statValue, { color: colors.primary }]}>
                        {formatCurrency(Math.abs(totals.tDebit - totals.tCredit))}
                        <Text style={styles.miniIndicator}>
                            {" "}{totals.tDebit - totals.tCredit >= 0 ? "DR" : "CR"}
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
        const color = isDebit ? colors.info : colors.accent;

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
                        <Text style={styles.narration} numberOfLines={2}>
                            {item.Narration || item.Line_Naration}
                        </Text>
                    )}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <AppHeader
                title="Transaction History"
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
                        <Icon name="history-toggle-off" size={64} color={colors.grey200} />
                        <Text style={styles.emptyTitle}>No Transactions</Text>
                        <Text style={styles.emptySubtitle}>Try a wider date range</Text>
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
                    <Text style={styles.loadingText}>Fetching Ledger...</Text>
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
            backgroundColor: colors.primary + "05",
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
        narration: {
            ...typography.caption,
            color: colors.grey500,
            fontSize: 11,
            lineHeight: 15,
            fontStyle: "italic",
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

export default TransactionList;
