import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    RefreshControl,
    TextInput,
    ScrollView,
} from "react-native";
import React, { useEffect, useMemo, useState } from "react";
import AppHeader from "../../Components/AppHeader";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../../Context/ThemeContext";
import Icon from "react-native-vector-icons/MaterialIcons";
import FilterModal from "../../Components/FilterModal";
import { responsiveHeight, responsiveWidth } from "../../constants/helper";
import { fetchExpenses } from "../../Api/fetchExpenses";

/* ================= TYPES ================= */

export interface Account {
    Acc_Id: string;
    Account_Name: string;
    Debit_Amount: number;
    Credit_Amount: number;
    invoices?: Invoice[];
}

type ExpenseNode = {
    group_id: string;
    group_name: string;
    Parent_AC_id: string | null;
    accounts: Account[];
    children: ExpenseNode[];
};

export interface Invoice {
    Date: string;
    Invoice_No: string;
    Particular: string;
    Debit: number;
    Credit: number;
    Balance: number;
}

/* ================= SCREEN ================= */

const Expenses = () => {
    const { typography, colors } = useTheme();
    const styles = getStyles(typography, colors);
    const navigation = useNavigation<NativeStackNavigationProp<any>>();

    const [fromDate, setFromDate] = useState(new Date());
    const [toDate, setToDate] = useState(new Date());
    const [tempFromDate, setTempFromDate] = useState(fromDate);
    const [tempToDate, setTempToDate] = useState(toDate);
    const [modalVisible, setModalVisible] = useState(false);

    const [activeTab, setActiveTab] =
        useState<"DIRECT" | "INDIRECT">("DIRECT");

    const [searchQuery, setSearchQuery] = useState("");
    const [refreshing, setRefreshing] = useState(true);
    const [data, setData] = useState<ExpenseNode[]>([]);

    /* ================= API ================= */

    const fetchData = async (f = fromDate, t = toDate) => {
        setRefreshing(true);
        try {
            const res = await fetchExpenses(f, t);

            // API returns: [{ group_id: "0", children: [...] }]
            const root = res?.[0]?.children || [];

            setData(root);
            // ❌ NO expanded state handling here anymore
        } catch (err) {
            console.error("Expenses fetch error:", err);
            setData([]);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    /* ================= HELPERS ================= */

    const normalize = (v = "") =>
        v.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

    const calculateTotal = (node: ExpenseNode) => {
        let debit = 0;
        let credit = 0;

        node.accounts?.forEach(a => {
            debit += a.Debit_Amount || 0;
            credit += a.Credit_Amount || 0;
        });

        node.children?.forEach(c => {
            const t = calculateTotal(c);
            debit += t.debit;
            credit += t.credit;
        });

        return { debit, credit };
    };

    const getBalanceColor = (bal: number) =>
        bal >= 0 ? "#e74c3c" : "#2ecc71";

    const formatBal = (bal: number) =>
        `₹${Math.abs(bal).toLocaleString()} ${bal >= 0 ? "DR" : "CR"}`;

    const getIndentStyle = (level: number) => ({
        paddingLeft: responsiveWidth(level * 4),
    });

    /* ================= DATA ================= */

    const section = data.find(d =>
        activeTab === "DIRECT"
            ? d.group_name === "Direct Expenses"
            : d.group_name === "Indirect Expenses"
    );

    const list = section?.children || [];

    const filteredList = list.filter(i =>
        normalize(i.group_name).includes(normalize(searchQuery))
    );

    /* ================= FILTER APPLY ================= */

    const handleApplyFilter = async () => {
        setModalVisible(false);
        setFromDate(tempFromDate);
        setToDate(tempToDate);
        await fetchData(tempFromDate, tempToDate);
    };

    /* ================= UI ================= */
    const ExpenseTreeNode = ({
        node,
        level = 0,
    }: {
        node: ExpenseNode;
        level?: number;
    }) => {
        const [open, setOpen] = useState(false);

        const total = calculateTotal(node);
        const bal = total.debit - total.credit;

        const hasChildren =
            node.children?.length > 0 || node.accounts?.length > 0;

        return (
            <View>
                {/* GROUP ROW */}
                <TouchableOpacity
                    style={styles.rowContainer}
                    disabled={!hasChildren}
                    onPress={() => setOpen(!open)}
                >
                    {/* NAME + ICON */}
                    <View
                        style={[
                            styles.nameRow,
                            getIndentStyle(level),
                        ]}
                    >
                        {hasChildren && (
                            <Icon
                                name={open ? "expand-more" : "chevron-right"}
                                size={20}
                                color="#666"
                            />
                        )}

                        <Icon
                            name="label-important"
                            size={18}
                            color="#2c7be5"
                            style={{ marginHorizontal: 6 }}
                        />

                        <Text style={styles.title}>
                            {node.group_name}
                        </Text>
                    </View>

                    {/* BALANCE */}
                    <Text
                        style={[
                            styles.balanceText,
                            { color: getBalanceColor(bal) },
                        ]}
                    >
                        {formatBal(bal)}
                    </Text>
                </TouchableOpacity>

                {/* EXPANDED */}
                {open && (
                    <>
                        {node.children?.map(child => (
                            <ExpenseTreeNode
                                key={child.group_id}
                                node={child}
                                level={level + 1}
                            />
                        ))}

                        {node.accounts?.map(acc => (
                            <AccountRow
                                key={acc.Acc_Id}
                                account={acc}
                                level={level + 1}
                            />
                        ))}
                    </>
                )}
            </View>
        );
    };


    const AccountRow = ({
        account,
        level,
    }: {
        account: Account;
        level: number;
    }) => {
        const bal = account.Debit_Amount - account.Credit_Amount;

        return (
            <TouchableOpacity
                style={styles.rowContainer}
                onPress={() =>
                    navigation.navigate("transactionlistexp", {
                        accId: account.Acc_Id,
                        accName: account.Account_Name,
                    })
                }
            >
                {/* ACCOUNT NAME */}
                <View
                    style={[
                        styles.nameRow,
                        getIndentStyle(level),
                    ]}
                >
                    <Icon
                        name="fast-forward"
                        size={18}
                        color="#8e44ad"
                        style={{ marginRight: 8 }}
                    />

                    <Text style={styles.nameText}>
                        {account.Account_Name}
                    </Text>
                </View>

                {/* BALANCE */}
                <Text
                    style={[
                        styles.balanceText,
                        { color: getBalanceColor(bal) },
                    ]}
                >
                    {formatBal(bal)}
                </Text>
            </TouchableOpacity>
        );
    };

    const calculateDebitOnly = (node: ExpenseNode): number => {
        let total = 0;

        node.accounts?.forEach(a => {
            total += a.Debit_Amount || 0;
        });

        node.children?.forEach(c => {
            total += calculateDebitOnly(c);
        });

        return total;
    };

    const grandTotals = useMemo(() => {
        let debit = 0;
        let credit = 0;

        data.forEach(section => {
            const t = calculateTotal(section);
            debit += t.debit;
            credit += t.credit;
        });

        return {
            debit,
            credit,
            balance: debit - credit,
        };
    }, [data]);

    const directExpenseTotal = useMemo(() => {
        const direct = data.find(d => d.group_name === "Direct Expenses");
        return direct ? calculateDebitOnly(direct) : 0;
    }, [data]);

    const indirectExpenseTotal = useMemo(() => {
        const indirect = data.find(d => d.group_name === "Indirect Expenses");
        return indirect ? calculateDebitOnly(indirect) : 0;
    }, [data]);


    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Expenses Report"
                navigation={navigation}
                showRightIcon
                rightIconLibrary="MaterialIcon"
                rightIconName="filter-list"
                onRightPress={() => setModalVisible(true)}
            />

            <FilterModal
                visible={modalVisible}
                fromDate={tempFromDate}
                toDate={tempToDate}
                onFromDateChange={setTempFromDate}
                onToDateChange={setTempToDate}
                onApply={handleApplyFilter}
                onClose={() => setModalVisible(false)}
                showToDate
            />

            <ScrollView
                style={styles.scrollContainer}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => fetchData()}
                        colors={[colors.primary]}
                    />
                }
            >
                {/* TOGGLE */}
                <View style={styles.toggleCenter}>
                    {["DIRECT", "INDIRECT"].map(t => (
                        <TouchableOpacity
                            key={t}
                            style={[
                                styles.toggleBtn,
                                activeTab === t && styles.toggleActive,
                            ]}
                            onPress={() => setActiveTab(t as any)}
                        >
                            <Text
                                style={[
                                    styles.toggleText,
                                    activeTab === t && styles.toggleTextActive,
                                ]}
                            >
                                {t === "DIRECT" ? "Direct" : "In-Direct"}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* TOTAL EXPENSES (DIRECT + INDIRECT) */}
                <View style={styles.summaryCard}>
                    <View style={styles.summaryRow}>
                        <View style={styles.summaryCol}>
                            <Text style={styles.summaryTitle}>Total Expenses :</Text>
                            <Text
                                style={[
                                    styles.summaryValue,
                                    {
                                        color:
                                            grandTotals.balance >= 0
                                                ? colors.error
                                                : colors.success,
                                    },
                                ]}
                            >
                                {formatBal(grandTotals.balance)}
                            </Text>
                        </View>
                    </View>

                    {/* TAB-SPECIFIC TOTAL */}
                    <View style={styles.finalTotalRow}>
                        <Text style={styles.finalTotalText}>
                            {activeTab === "DIRECT"
                                ? "Direct Expense : "
                                : "In-Direct Expense : "}
                        </Text>

                        <Text style={[styles.finalTotalValue, { color: colors.error }]}>
                            ₹{(
                                activeTab === "DIRECT"
                                    ? directExpenseTotal
                                    : indirectExpenseTotal
                            ).toLocaleString("en-IN")}{" "}
                            DR
                        </Text>
                    </View>
                </View>

                {/* SEARCH */}
                <View style={styles.searchContainer}>
                    <Icon name="search" size={20} color={colors.textSecondary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search Expenses"
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {/* LIST */}
                {filteredList.length > 0 ? (
                    filteredList.map(node => (
                        <ExpenseTreeNode
                            key={node.group_id}
                            node={node}
                        />
                    ))
                ) : (
                    <View style={styles.emptyContainer}>
                        <Icon
                            name="account-balance-wallet"
                            size={48}
                            color={colors.textSecondary}
                        />
                        <Text style={styles.emptyTitle}>
                            No Expenses Found
                        </Text>
                    </View>
                )}

            </ScrollView>
        </SafeAreaView>
    );
};

export default Expenses;

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
            marginTop: responsiveHeight(1),
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
            marginHorizontal: 12,
            marginTop: 4,
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
        retailerCard: {
            backgroundColor: colors.white,
            borderRadius: responsiveWidth(2),
            marginHorizontal: responsiveWidth(4),
            marginVertical: responsiveHeight(0.8),
            padding: responsiveWidth(3),
            elevation: 2,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
        },
        retailerTitle: {
            ...typography.subtitle2,
            color: colors.primary,
            fontWeight: "600",
            marginBottom: responsiveHeight(0.6),
        },
        retailerText: {
            ...typography.body2,
            color: colors.textSecondary,
            marginBottom: responsiveHeight(0.4),
        },
        retailerRow: {
            flexDirection: "row",
            alignItems: "center",
            marginVertical: 2,
            gap: 8,
        },
        toggleRow: {
            flexDirection: "row",
            padding: 10,
        },
        toggleBtn: {
            borderWidth: 1,
            borderColor: colors.primary,
            paddingVertical: 6,
            paddingHorizontal: 14,
            marginRight: 10,
            borderRadius: 4,
        },
        toggleActive: {
            backgroundColor: colors.primary
        },
        toggleText: {
            color: colors.primary,
            fontWeight: "600"
        },
        toggleTextActive: {
            color: "#FFF"
        },
        amount: {
            fontWeight: "700"
        },
        pagination: {
            flexDirection: "row",
            justifyContent: "center",
            padding: 10,
        },
        card: {
            backgroundColor: colors.white,
            marginHorizontal: 10,
            marginVertical: 6,
            padding: 12,
            borderRadius: 6,
        },
        ledgerContainer: {
            marginTop: responsiveHeight(1),
            paddingTop: responsiveHeight(1),
            borderTopWidth: 1,
            borderTopColor: colors.borderColor,
        },

        ledgerHeader: {
            flexDirection: "row",
            paddingBottom: 6,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderColor,
        },
        ledgerRow: {
            flexDirection: "row",
            paddingVertical: 6,
        },
        ledgerCell: {
            flex: 1,
            ...typography.caption,
            color: colors.text,
        },
        ledgerCellRight: {
            flex: 1,
            textAlign: "right",
            ...typography.caption,
            color: colors.text,
            fontWeight: "600",
        },
        table: {
            marginTop: responsiveHeight(1),
            backgroundColor: colors.background,
            borderRadius: responsiveWidth(1.5),
            padding: responsiveWidth(3),
        },
        cellLabel: {
            ...typography.caption,
            color: colors.textSecondary,
        },
        cellValue: {
            ...typography.body2,
            color: colors.text,
        },
        bold: {
            fontWeight: "700",
        },
        rowBetween: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        title: {
            fontSize: 14,
            fontWeight: "600",
            color: colors.primary,
            flex: 1,
        },
        subText: {
            fontSize: 14,
            color: colors.textSecondary,
            marginTop: 8,
        },
        typeBadge: {
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 20,
        },
        debtorBadge: {
            backgroundColor: "#FFEBEE",
        },
        creditorBadge: {
            backgroundColor: "#E8F5E9",
        },
        typeText: {
            fontSize: 12,
            fontWeight: "600",
        },
        gridWrapper: {
            marginTop: 12,
            borderTopWidth: 1,
            borderColor: colors.borderColor,
            paddingTop: 10,
        },
        gridHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
        },
        gridRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 6,
        },
        gridTitle: {
            width: "25%",
            textAlign: "center",
            fontSize: 12,
            color: colors.textSecondary,
        },
        gridValue: {
            width: "25%",
            textAlign: "center",
            fontSize: 13,
            fontWeight: "600",
            color: colors.text,
        },
        drText: {
            color: "#E53935",
        },
        crText: {
            color: "#2E7D32",
        },
        cardWrapper: {
            backgroundColor: colors.white,
            borderRadius: 14,
            padding: 14,
            marginHorizontal: 12,
            marginBottom: 14,
            elevation: 3,
            shadowColor: "#000",
            shadowOpacity: 0.08,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
        },
        divider: {
            height: 1,
            backgroundColor: colors.borderColor,
            marginVertical: 10,
        },
        toggleCenter: {
            flexDirection: "row",
            justifyContent: "center",
            marginTop: responsiveHeight(1.5),
            marginBottom: responsiveHeight(2),
        },
        grid: {
            marginTop: responsiveHeight(1.5),
            borderWidth: 1,
            borderColor: colors.borderColor,
            borderRadius: 8,
            overflow: "hidden",
            backgroundColor: colors.white,
        },
        summaryText: {
            fontSize: 14,
            color: colors.text,
            fontWeight: "500",
            marginBottom: responsiveHeight(0.4),
        },
        summaryOutstanding: {
            fontSize: 15,
            fontWeight: "700",
        },
        pageBtn: {
            padding: 8,
            borderRadius: 999,
            backgroundColor: "rgba(0,0,0,0.06)",
        },
        pageBtnDisabled: {
            opacity: 0.3,
        },
        pageBtnText: {
            color: colors.white,
            fontWeight: "600",
        },
        childWrapper: {
            paddingLeft: responsiveWidth(4),
            paddingTop: responsiveHeight(0.6),
        },


        childTitle: {
            fontSize: 14,
            color: colors.text,
            marginBottom: 6,
        },

        accountRow: {
            backgroundColor: colors.surface,
            padding: responsiveWidth(3),
            borderRadius: 10,
            marginTop: responsiveHeight(0.8),
        },

        accountName: {
            flex: 1,
            fontSize: 14,
            color: colors.textSecondary,
            marginRight: 10,
        },

        accountValue: {
            fontSize: 14,
            color: colors.text,
        },
        invoiceCard: {
            marginLeft: 24,
            marginTop: 6,
            padding: 10,
            backgroundColor: colors.grey50,
            borderRadius: 8,
        },

        invoiceDate: {
            fontSize: 12,
            fontFamily: "System",
            marginBottom: 4,
            color: colors.text,
        },

        invoiceText: {
            fontSize: 12,
            fontFamily: "System",
            color: colors.textSecondary,
        },

        invoiceRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 6,
        },

        invoiceValue: {
            fontSize: 12,
            fontFamily: "System",
            color: colors.text,
        },

        amountRow: {
            alignItems: "center",
            gap: responsiveWidth(1),
        },
        amountText: {
            fontSize: 14,
            fontWeight: "500",
            minWidth: responsiveWidth(20),
            textAlign: "right",
            color: colors.text,
        },

        tableHeaderText: {
            flex: 1,
            textAlign: "right",
            fontSize: 12,
            color: colors.textSecondary,
            fontWeight: "600",
        },

        tableValue: {
            flex: 1,
            textAlign: "right",
            fontSize: 12,
            fontWeight: "500",
            color: colors.text,
        },

        rowContainer: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: responsiveHeight(1.2),
            paddingHorizontal: responsiveWidth(4),
        },

        nameText: {
            flex: 1,
            fontSize: 14,
            color: colors.text,
        },

        balanceText: {
            width: responsiveWidth(30),
            textAlign: "right",
            fontSize: 14,
            fontWeight: "600",
        },
        nameRow: {
            flexDirection: "row",
            alignItems: "center",
            flex: 1,
        },
        emptyContainer: {
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 60,
            opacity: 0.8,
        },

        emptyTitle: {
            marginTop: 12,
            fontSize: 16,
            fontWeight: "600",
            color: colors.text,
        },

        emptySubText: {
            marginTop: 6,
            fontSize: 13,
            color: colors.textSecondary,
            textAlign: "center",
            paddingHorizontal: 20,
        },

        summaryTitle: {
            fontSize: 16,
            fontWeight: "700",
            color: colors.text,
            marginBottom: 10,
        },

        summaryRow: {
            flexDirection: "row",
            justifyContent: "space-between",
        },

        summaryCol: {
            alignItems: "center",
            flex: 1,
        },

        finalTotalRow: {
            marginTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.borderColor,
            paddingTop: 10,
            flexDirection: "row",
            justifyContent: "space-between",
        },

        finalTotalText: {
            fontSize: 14,
            fontWeight: "600",
            color: colors.text,
        },

        finalTotalValue: {
            fontSize: 15,
            fontWeight: "700",
        },


    });
