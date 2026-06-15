import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    RefreshControl,
    ActivityIndicator
} from "react-native";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import AppHeader from "../../Components/AppHeader";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../../Context/ThemeContext";
import { responsiveHeight, responsiveWidth } from "../../constants/helper";
import Icon from "react-native-vector-icons/MaterialIcons";
import FilterModal from "../../Components/FilterModal";
import { API } from "../../constants/api";

/* ---------------- HELPERS ---------------- */
const formatAPIDate = (date: Date) =>
    date.toISOString().split("T")[0];

const formatRowDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString("en-IN") : "";

/* ---------------- SCREEN ---------------- */
const ItemWiseTransaction = () => {
    const { typography, colors } = useTheme();
    const styles = getStyles(typography, colors);

    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const route = useRoute<any>();

    const { ProductId, productName, fromDate: routeFromDate, toDate: routeToDate } = route.params;

    const [fromDate, setFromDate] = useState<Date>(
        routeFromDate ? new Date(routeFromDate) : new Date()
    );
    const [toDate, setToDate] = useState<Date>(
        routeToDate ? new Date(routeToDate) : new Date()
    );

    const [modalVisible, setModalVisible] = useState(false);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    /* ---------------- FETCH ---------------- */
    const fetchTransactions = useCallback(async () => {
        if (!ProductId) return;

        setLoading(true);
        try {
            const res = await fetch(
                API.itemtransaction(
                    formatAPIDate(fromDate),
                    formatAPIDate(toDate),
                    ProductId
                )
            );
            const json = await res.json();
            setTransactions(Array.isArray(json?.data) ? json.data : []);
        } catch (e) {
            console.error("Item transaction fetch failed", e);
            setTransactions([]);
        } finally {
            setLoading(false);
        }
    }, [ProductId, fromDate, toDate]);

    useEffect(() => {
        fetchTransactions();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchTransactions();
        setRefreshing(false);
    };

    /* ---------------- RUNNING CLOSING (TALLY) ---------------- */
    const ledgerRows = useMemo(() => {
        let running = 0;

        const sorted = [...transactions].sort(
            (a, b) =>
                new Date(a.Ledger_Date).getTime() -
                new Date(b.Ledger_Date).getTime()
        );

        return sorted.map((row, index) => {
            running += (row.In_Qty || 0) - (row.Out_Qty || 0);

            const next = sorted[index + 1];
            const isLastOfDate =
                !next ||
                new Date(next.Ledger_Date).toDateString() !==
                new Date(row.Ledger_Date).toDateString();

            return {
                ...row,
                closing: isLastOfDate ? running : null,
            };
        });
    }, [transactions]);


    /* ---------------- UI ---------------- */
    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Item Wise Transactions"
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

                {loading && !refreshing && (
                    <View style={styles.loaderContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                )}
                {/* DATE → ITEM NAME */}
                <View style={styles.reportHeader}>
                    <Text style={styles.reportTitle}>
                        {productName}
                    </Text>
                    <Text style={styles.reportPeriod}>
                        From {fromDate.toLocaleDateString("en-IN")} To{" "}
                        {toDate.toLocaleDateString("en-IN")}
                    </Text>
                </View>

                {/* TABLE */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {!loading && (
                        <View style={styles.tableContainer}>
                            {/* HEADER */}
                            <View style={styles.tableRow}>
                                <Text style={[styles.tableHeader, { width: 80 }]}>Date</Text>
                                <Text style={[styles.tableHeader, { width: 60 }]}>Vch.Ty</Text>
                                <Text style={[styles.tableHeader, { width: 100 }]}>Vch.No</Text>
                                <Text style={[styles.tableHeader, { width: 100 }]}>Retailer</Text>
                                <Text style={[styles.tableHeader, { width: 70, textAlign: "right" }]}>In</Text>
                                <Text style={[styles.tableHeader, { width: 70, textAlign: "right" }]}>Out</Text>
                                <Text style={[styles.tableHeader, { width: 80, textAlign: "right" }]}>Cls</Text>
                            </View>


                            {/* ROWS */}
                            {ledgerRows.map((t, i) => (
                                <View key={i} style={styles.tableRow}>
                                    <Text style={[styles.td, { width: 80 }]}>
                                        {formatRowDate(t.Ledger_Date)}
                                    </Text>

                                    <Text style={[styles.td, { width: 60 }]}>
                                        {t.voucher_name || "-"}
                                    </Text>

                                    <Text style={[styles.td, { width: 100 }]}>
                                        {t.invoice_no || "-"}
                                    </Text>

                                    <Text style={[styles.td, { width: 100 }]}>
                                        {t.Retailer_Name || "-"}
                                    </Text>

                                    <Text style={[styles.td, styles.inCell, { width: 70 }]}>
                                        {t.In_Qty || ""}
                                    </Text>

                                    <Text style={[styles.td, styles.outCell, { width: 70 }]}>
                                        {t.Out_Qty || ""}
                                    </Text>

                                    <Text
                                        style={[
                                            styles.td, styles.closingCell,
                                            {
                                                width: 80, color: t.closing > 0
                                                    ? "green" : t.closing < 0 ? "red" : "#000",
                                            },]}
                                    >
                                        {t.closing !== null ? t.closing : ""}
                                    </Text>

                                </View>
                            ))}


                            {!loading && ledgerRows.length === 0 && (
                                <View style={styles.noDataContainer}>
                                    <Icon name="inventory" size={44} color={colors.textSecondary} />
                                    <Text>No transactions found</Text>
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>
            </ScrollView>
        </SafeAreaView>
    );
};

export default ItemWiseTransaction;

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
        openingRow: {
            backgroundColor: colors.grey100,
        },
        inCell: {
            textAlign: "right",
            color: colors.success,
        },
        outCell: {
            textAlign: "right",
            color: colors.error,
        },
        closingCell: {
            textAlign: "right",
            fontWeight: "600",
        },
        loaderContainer: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: responsiveHeight(8),
        },

        loaderText: {
            marginTop: 10,
            fontSize: 14,
            color: colors.textSecondary,
        },

    });