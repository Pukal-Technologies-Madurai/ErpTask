import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    RefreshControl,
} from "react-native";
import React, { useEffect, useState, useCallback } from "react";
import AppHeader from "../../Components/AppHeader";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../../Context/ThemeContext";
import Icon from "react-native-vector-icons/MaterialIcons";
import FilterModal from "../../Components/FilterModal";
import { responsiveHeight, responsiveWidth } from "../../constants/helper";
import { API } from "../../constants/api";

/* ---------------- TYPES ---------------- */
type TransactionRow = {
    invoice_no?: string;
    Ledger_Date?: string;
    Particulars?: string;
    Credit_Amt?: number;
    Debit_Amt?: number;
    Trans_Id?: string;
    Narration?: string;
    Line_Naration?: string;
};

/* ---------------- HELPERS ---------------- */
const formatAPIDate = (date: Date) =>
    date.toISOString().split("T")[0];

const formatRowDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString("en-IN") : "--";

/* ---------------- SCREEN ---------------- */
const TransactionListExpenses = () => {
    const { typography, colors } = useTheme();
    const styles = getStyles(typography, colors);
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const route = useRoute<any>();

    const { accId, accName } = route.params ?? {};

    const [fromDate, setFromDate] = useState(new Date());
    const [toDate, setToDate] = useState(new Date());
    const [modalVisible, setModalVisible] = useState(false);

    const [transactions, setTransactions] = useState<TransactionRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    /* ---------------- FETCH ---------------- */
    const fetchTransactions = useCallback(async () => {
        if (!accId) return;

        const from = formatAPIDate(fromDate);
        const to = formatAPIDate(toDate);

        setLoading(true);
        try {
            const res = await fetch(
                API.getTransactionReports(from, to, accId)
            );
            const json = await res.json();
            setTransactions(Array.isArray(json?.data) ? json.data : []);
        } catch (e) {
            console.error("Expense transaction fetch failed", e);
            setTransactions([]);
        } finally {
            setLoading(false);
        }
    }, [accId, fromDate, toDate]);

    useEffect(() => {
        fetchTransactions();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchTransactions();
        setRefreshing(false);
    };

    const handleApplyFilter = () => {
        setModalVisible(false);
        fetchTransactions();
    };

    const formatDisplayDate = (date: Date) =>
        date.toLocaleDateString("en-IN");

    /* ---------------- TOTALS ---------------- */
    const totals = transactions.reduce(
        (acc, item) => {
            acc.credit += item.Credit_Amt || 0;
            acc.debit += item.Debit_Amt || 0;
            return acc;
        },
        { credit: 0, debit: 0 }
    );

    const netBal = totals.debit - totals.credit;

    /* ---------------- UI ---------------- */
    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Expenses Transaction Details"
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
                onApply={handleApplyFilter}
                onClose={() => setModalVisible(false)}
                showToDate
            />

            <ScrollView
                style={styles.scrollContainer}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                    />
                }
            >
                <View style={styles.reportHeader}>
                    <Text style={styles.reportTitle}>
                    {accName || "Expense Ledger" || "--"}
                    </Text>

                    <Text style={styles.reportPeriod}>
                        From: {formatDisplayDate(fromDate)}  –  {formatDisplayDate(toDate)}
                    </Text>
                </View>

                {/* TABLE */}
                <View style={styles.tableContainer}>
                    {/* HEADER */}
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderText, styles.cellBorder, { flex: 1.3 }]}>Date</Text>
                        <Text style={[styles.tableHeaderText, styles.cellBorder, { flex: 1.2 }]}>Inv No</Text>
                        <Text style={[styles.tableHeaderText, styles.cellBorder, { flex: 2 }]}>Particular</Text>
                        <Text style={[styles.tableHeaderText, styles.cellBorder, { flex: 1 }]}>Credit</Text>
                        <Text style={[styles.tableHeaderText, { flex: 1 }]}>Debit</Text>
                    </View>

                    {/* ROWS */}
                    {transactions.map((t, i) => {
                        const showNarration =
                            t.Narration && t.Narration.trim().length > 0;

                        const showLineNarration =
                            t.Line_Naration &&
                            t.Line_Naration.trim().length > 0 &&
                            t.Line_Naration !== t.Narration;

                        return (
                            <View key={`${t.Trans_Id}-${i}`} style={styles.rowWrapper}>

                                {/* MAIN ROW */}
                                <View style={styles.tableRow}>
                                    <Text style={[styles.td, styles.cellBorder, { flex: 1.3 }]}>
                                        {formatRowDate(t.Ledger_Date)}
                                    </Text>

                                    <Text style={[styles.td, styles.cellBorder, { flex: 1.2 }]}>
                                        {t.invoice_no || "--"}
                                    </Text>

                                    <Text style={[styles.td, styles.cellBorder, { flex: 2 }]}>
                                        {t.Particulars || "--"}
                                    </Text>

                                    <Text
                                        style={[
                                            styles.td,
                                            styles.cellBorder,
                                            { flex: 1, color: colors.success },
                                        ]}
                                    >
                                        {t.Credit_Amt ? t.Credit_Amt.toLocaleString("en-IN") : "-"}
                                    </Text>

                                    <Text style={[styles.td, { flex: 1, color: colors.error }]}>
                                        {t.Debit_Amt ? t.Debit_Amt.toLocaleString("en-IN") : "-"}
                                    </Text>
                                </View>

                                {/* NARRATION SECTION (FULL WIDTH, SAME ROW) */}
                                {(showNarration || showLineNarration) && (
                                    <View style={styles.narrationRow}>
                                        {showNarration && (
                                            <Text style={styles.narrationText}>
                                                • {t.Narration}
                                            </Text>
                                        )}

                                        {showLineNarration && (
                                            <Text style={styles.narrationText2}>
                                                • {t.Line_Naration}
                                            </Text>
                                        )}
                                    </View>
                                )}
                            </View>
                        );
                    })}


                    {/* TOTAL */}
                    {transactions.length > 0 && (
                        <>
                            <View style={styles.totalRow}>
                                <Text style={[styles.totalText, { flex: 4.4 }]}>
                                    TOTAL
                                </Text>
                                <Text style={[styles.totalText, { flex: 1, color: colors.success }]}>
                                    {totals.credit.toLocaleString("en-IN")}
                                </Text>
                                <Text style={[styles.totalText, { flex: 1, color: colors.error }]}>
                                    {totals.debit.toLocaleString("en-IN")}
                                </Text>
                            </View>

                            <View style={styles.netTotalRow}>
                                <Text style={[styles.netText, { flex: 5.4 }]}>
                                    NET BALANCE
                                </Text>
                                <Text
                                    style={[
                                        styles.netText,
                                        { color: netBal >= 0 ? colors.error : colors.success },
                                    ]}
                                >
                                    ₹{Math.abs(netBal).toLocaleString("en-IN")}{" "}
                                    {netBal >= 0 ? "DR" : "CR"}
                                </Text>
                            </View>
                        </>
                    )}

                    {!loading && transactions.length === 0 && (
                        <View style={styles.noDataContainer}>
                            <Icon name="receipt-long" size={44} color={colors.textSecondary} />
                            <Text>No transactions found</Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default TransactionListExpenses;

const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.primary,
        },
        scrollContainer: {
            backgroundColor: colors.white,
        },

        reportHeader: {
            padding: responsiveWidth(4),
            alignItems: "center",
        },
        reportTitle: {
            ...typography.subtitle2,
            fontWeight: "600",
            color: colors.text,
            textAlign: "center",
        },
        reportSubTitle: {
            ...typography.caption,
            color: colors.textSecondary,
            marginTop: responsiveHeight(0.6),
        },

        tableContainer: {
            width: '98%',
            alignSelf: 'center',
            borderWidth: 1,
            borderColor: colors.borderColor,
            borderRadius: responsiveWidth(1),
            overflow: "hidden",
            marginBottom: responsiveHeight(2),
            marginTop: 12,
        },

        tableHeaderText: {
            ...typography.caption,
            color: colors.textSecondary,
            fontWeight: "800",
            textAlign: "center",
            fontSize: 12,
            paddingVertical: 10,
            paddingHorizontal: 6,
        },
        tableHeader: {
            flexDirection: "row",
            paddingHorizontal: responsiveWidth(2),
            backgroundColor: "#F3F4F6",
            borderBottomWidth: 1,
            borderColor: "#D1D5DB",
        },
        tableRow: {
            flexDirection: "row",
            paddingVertical: responsiveHeight(1),
            paddingHorizontal: responsiveWidth(2),
            borderBottomWidth: 1,
            borderBottomColor: colors.borderColor,
            borderColor: "#E5E7EB",
            backgroundColor: "#FFFFFF",
        },
        td: {
            ...typography.body2,
            color: colors.text,
            textAlign: "center",
            fontSize: 12,
            paddingVertical: 8,
            paddingHorizontal: 6,
        },
        noDataContainer: {
            marginTop: responsiveHeight(4),
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: responsiveHeight(3),
        },

        noDataText: {
            fontSize: 14,
            fontFamily: typography?.medium || typography?.regular,
            color: colors?.textSecondary || colors?.text,
            textAlign: "center",
        },

        cellBorder: {
            borderRightWidth: 1,
            borderColor: "#E5E7EB",
        },
        reportPeriod: {
            marginTop: 4,
            fontSize: 13,
            color: colors.textSecondary,
            textAlign: "center",
        },
        totalRow: {
            flexDirection: "row",
            borderTopWidth: 1,
            borderColor: colors.border,
            paddingVertical: 10,
            backgroundColor: colors.card,
        },

        totalText: {
            fontWeight: "600",
            fontSize: 14,
            textAlign: "right",
            paddingHorizontal: 6,
        },

        netTotalRow: {
            flexDirection: "row",
            paddingVertical: 10,
            backgroundColor: colors.background,
        },

        netText: {
            fontWeight: "700",
            fontSize: 14,
            textAlign: "right",
            paddingHorizontal: 6,
        },
        rowWrapper: {
            borderBottomWidth: 1,
            borderColor: "#ddd",
        },

        narrationRow: {
            paddingHorizontal: 8,
            paddingVertical: 6,
            backgroundColor: "#f7f7f7",
        },

        narrationText: {
            fontSize: 11,
            color: "#555",
            lineHeight: 16,
        },

        narrationText2: {
            fontSize: 11,
            color: "#830606ff",
            lineHeight: 16,
        },


    });