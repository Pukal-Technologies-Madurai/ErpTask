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
import { responsiveHeight, responsiveWidth } from "../../constants/helper";
import { API } from "../../constants/api";

// ---------------- TYPES ----------------
type TransactionRow = {
    invoice_no?: string;
    Ledger_Date?: string;
    Particulars?: string;
    Credit_Amt?: number;
    Debit_Amt?: number;
    Trans_Id?: string;
};

const TransactionList = () => {
    const { typography, colors } = useTheme();
    const styles = getStyles(typography, colors);
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const route = useRoute<any>();

    const retailer = route.params?.retailer;
    const accId = retailer?.AC_Id ? Number(retailer.AC_Id) : undefined;

    const fromDate = route.params?.fromDate;
    const toDate = route.params?.toDate;

    const [transactions, setTransactions] = useState<TransactionRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // ---------------- FETCH API ----------------
    const fetchTransactions = useCallback(async () => {

        console.log("Transaction API →", {
            fromDate,
            toDate,
            accId,
        });

        if (!accId || !fromDate || !toDate) return;

        setLoading(true);
        try {
            const res = await fetch(
                API.getTransactionReports(fromDate, toDate, accId)
            );
            const json = await res.json();

            setTransactions(Array.isArray(json?.data) ? json.data : []);
        } catch (e) {
            console.error("Transaction fetch failed", e);
            setTransactions([]);
        } finally {
            setLoading(false);
        }
    }, [accId, fromDate, toDate]);

    console.log(
        API.getTransactionReports(fromDate, toDate, accId)
    );

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await fetchTransactions();
        } finally {
            setRefreshing(false);
        }
    };

    const formatDate = (d?: string) => {
        if (!d) return "--";
        return new Date(d).toLocaleDateString("en-IN");
    };

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Transaction List"
                navigation={navigation}
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
                {/* Header */}
                <View style={styles.reportHeader}>
                    <Text style={styles.reportTitle}>
                        TRANSACTION REPORT OF {retailer?.Retailer_Name || "--"}
                    </Text>
                    <Text style={styles.reportSubTitle}>
                        From {fromDate || "--"} To {toDate || "--"}
                    </Text>
                </View>

                {/* Table */}
                <View style={styles.tableContainer}>
                    {/* Header */}
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderText, styles.cellBorder, { flex: 1.2 }]}>
                            Date
                        </Text>
                        <Text style={[styles.tableHeaderText, styles.cellBorder, { flex: 1.2 }]}>
                            Inv No
                        </Text>
                        <Text style={[styles.tableHeaderText, styles.cellBorder, { flex: 1.2 }]}>
                            Part
                        </Text>
                        <Text style={[styles.tableHeaderText, styles.cellBorder, { flex: 1 }]}>
                            Credit
                        </Text>
                        <Text style={[styles.tableHeaderText, { flex: 1 }]}>
                            Debit
                        </Text>
                    </View>

                    {/* Rows */}
                    {transactions.map((t, index) => (
                        <View key={`${t.Trans_Id ?? "row"}-${index}`} style={styles.tableRow}>
                            <Text style={[styles.tableCell, styles.cellBorder, { flex: 1.2 }]}>
                                {formatDate(t.Ledger_Date)}
                            </Text>
                            <Text style={[styles.tableCell, styles.cellBorder, { flex: 1.2 }]}>
                                {t.invoice_no || "--"}
                            </Text>
                            <Text style={[styles.tableCell, styles.cellBorder, { flex: 1.2 }]}>
                                {t.Particulars || "--"}
                            </Text>
                            <Text style={[styles.tableCell, styles.cellBorder, { flex: 1, color: colors.success }]}>
                                {t.Credit_Amt ? t.Credit_Amt.toLocaleString("en-IN") : "-"}
                            </Text>
                            <Text style={[styles.tableCell, styles.cellBorder, { flex: 1, color: colors.error }]}>
                                {t.Debit_Amt ? t.Debit_Amt.toLocaleString("en-IN") : "-"}
                            </Text>
                        </View>
                    ))}

                    {/* Empty State */}
                    {!loading && transactions.length === 0 && (
                        <View style={styles.noDataContainer}>
                            <Icon
                                name="receipt-long"
                                size={48}
                                color={colors.textSecondary}
                            />
                            <Text style={styles.noDataText}>
                                No transactions found
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default TransactionList;


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
            fontWeight: "600",
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
        tableCell: {
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



    });

