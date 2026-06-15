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
import { fetchDebtorsCreditors } from "../../Api/debtorscreditors";

type DebtorCreditor = {
    Acc_Id: string;
    Retailer_Name: string;
    Group_Name: string;
    OB_Amount: string;
    Debit_Amt: number;
    Credit_Amt: number;
    Bal_Amount: number;
    CR_DR: "DR" | "CR";
    Dr_Amount: number;
    Cr_Amount: number;
    Account_Types: "Debtor" | "Creditor";
};

const ITEMS_PER_PAGE = 10;

/* ================= SCREEN ================= */

const SundryDebtorsCreditors = () => {
    const { typography, colors } = useTheme();
    const styles = getStyles(typography, colors);
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const [fromDate, setFromDate] = useState(new Date());
    const [toDate, setToDate] = useState(new Date());
    const [tempFromDate, setTempFromDate] = useState(fromDate);
    const [tempToDate, setTempToDate] = useState(toDate);
    const [searchQuery, setSearchQuery] = useState("");
    const [refreshing, setRefreshing] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [modalVisible, setModalVisible] = useState(false);
    const [activeTab, setActiveTab] =
        useState<"Debtor" | "Creditor">("Debtor");
    const [data, setData] = useState<DebtorCreditor[]>([]);
    const [expandedAccId, setExpandedAccId] = useState<string | null>(null);
    const fetchData = async () => {
        setRefreshing(true);
        try {
            const res = await fetchDebtorsCreditors(fromDate, toDate);
            setData(res);
            setExpandedAccId(null);
        } catch {
            setData([]);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const normalize = (v: string) =>
        v.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

    const hasAnyValue = (item: DebtorCreditor) =>
        Math.abs(Number(item.Dr_Amount || 0)) > 0 ||
        Math.abs(Number(item.Cr_Amount || 0)) > 0 ||
        Math.abs(Number(item.Bal_Amount || 0)) > 0 ||
        Math.abs(Number(String(item.OB_Amount).replace(/[^\d.-]/g, ""))) > 0;

    const filteredData = data
        .filter((i) => i.Account_Types === activeTab)
        .filter((i) => {
            const s = normalize(searchQuery);
            return (
                normalize(i.Retailer_Name).includes(s) ||
                normalize(i.Group_Name).includes(s)
            );
        })
        // ✅ REMOVE ZERO-VALUE RECORDS HERE
        .filter(hasAnyValue);


    /* ================= SUMMARY ================= */

    const summary = useMemo(() => {
        let totalDebit = 0;
        let totalCredit = 0;

        filteredData.forEach(item => {
            totalDebit += Number(item?.Dr_Amount) || 0;
            totalCredit += Number(item?.Cr_Amount) || 0;
        });

        const outstanding = totalDebit - totalCredit;

        return {
            debit: totalDebit,
            credit: totalCredit,
            outstanding,
            suffix: outstanding >= 0 ? "DR" : "CR",
        };
    }, [filteredData]);

    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    const displayData = filteredData.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, activeTab]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filteredData.length]);


    const handleApplyFilter = async () => {
        setModalVisible(false);

        // Update actual filter dates
        setFromDate(tempFromDate);
        setToDate(tempToDate);

        // FORCE fetch immediately with selected dates
        setRefreshing(true);
        try {
            const res = await fetchDebtorsCreditors(tempFromDate, tempToDate);
            setData(res);
            setExpandedAccId(null);
        } catch {
            setData([]);
        } finally {
            setRefreshing(false);
        }
    };

    const formatApiDate = (d: Date) =>
        d.toISOString().split("T")[0];

    const getOBNumber = (ob: string | number) => {
        if (typeof ob === "number") return ob;
        return Number(ob.replace(/[^\d.-]/g, ""));
    };

    const getBalanceInfo = (dr: number, cr: number) => {
        if (dr > cr) {
            return {
                value: dr - cr,
                type: "DR",
            };
        } else if (cr > dr) {
            return {
                value: cr - dr,
                type: "CR",
            };
        }
        return {
            value: 0,
            type: "",
        };
    };


    /* ================= CARD ================= */

    const Card =
        ({ item }: { item: DebtorCreditor }) => {
            const expanded = expandedAccId === item.Acc_Id;
            const isDebtor = item.Account_Types === "Debtor";

            const obValue = getOBNumber(item.OB_Amount);
            const balInfo = getBalanceInfo(
                Number(item.Dr_Amount || 0),
                Number(item.Cr_Amount || 0)
            );


            return (
                <View style={styles.cardWrapper}>
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() =>
                            setExpandedAccId(expanded ? null : item.Acc_Id)
                        }
                    >
                        {/* HEADER */}
                        <View style={styles.rowBetween}>
                            <Text style={styles.title}>
                                {item.Retailer_Name}
                            </Text>

                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() =>
                                    navigation.navigate("transactionlist", {
                                        retailer: item,
                                        fromDate: formatApiDate(fromDate),
                                        toDate: formatApiDate(toDate),
                                        Acc_id: Number(item.Acc_Id),
                                    })
                                }
                            >
                                <Icon name="list-alt" size={25} color="#555555ff" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.subText}>
                            {item.Group_Name}
                        </Text>
                    </TouchableOpacity>

                    {/* EXPANDED GRID (UNCHANGED) */}
                    {expanded && (
                        <View style={styles.gridWrapper}>
                            <View style={styles.gridHeader}>
                                <Text style={styles.gridTitle}>OB</Text>
                                <Text style={styles.gridTitle}>Debit</Text>
                                <Text style={styles.gridTitle}>Credit</Text>
                                <Text style={styles.gridTitle}>Bal</Text>
                            </View>
                            <View style={styles.gridRow}>
                                {/* OB – number only */}
                                <Text style={styles.gridValue}>
                                    {obValue.toLocaleString()}
                                </Text>

                                {/* Debit */}
                                <Text style={styles.gridValue}>
                                    {Number(item.Dr_Amount).toLocaleString()}
                                </Text>

                                {/* Credit */}
                                <Text style={styles.gridValue}>
                                    {Number(item.Cr_Amount).toLocaleString()}
                                </Text>

                                {/* Balance with CR / DR */}
                                <Text
                                    style={[
                                        styles.gridValue,
                                        balInfo.type === "DR" ? styles.drText : styles.crText,
                                    ]}
                                >
                                    {balInfo.value.toLocaleString()} {balInfo.type}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>
            );
        };

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Sundry DEB & CRE"
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
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                    />
                }
            >
                {/* TOGGLE */}
                <View style={styles.toggleCenter}>
                    {["Debtor", "Creditor"].map((t) => (
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
                                {t}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* SUMMARY */}
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryText}>
                        Total Debit: ₹ {summary.debit.toLocaleString()}
                    </Text>

                    <Text style={styles.summaryText}>
                        Total Credit: ₹ {summary.credit.toLocaleString()}
                    </Text>

                    <Text
                        style={[
                            styles.summaryOutstanding,
                            summary.suffix === "DR" ? styles.drText : styles.crText,
                        ]}
                    >
                        Outstanding: ₹ {Math.abs(summary.outstanding).toLocaleString()}{" "}
                        {summary.suffix}
                    </Text>
                </View>

                {/* SEARCH */}
                <View style={styles.searchContainer}>
                    <Icon name="search" size={20} color={colors.textSecondary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by Retailer / Group"
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {/* LIST */}
                {displayData.map((item) => (
                    <Card key={item.Acc_Id} item={item} />
                ))}

                {/* PAGINATION */}

                {filteredData.length > ITEMS_PER_PAGE && (
                    <View style={styles.paginationContainer}>
                        <TouchableOpacity
                            disabled={currentPage === 1}
                            style={[
                                styles.pageBtn,
                                currentPage === 1 && styles.pageBtnDisabled,
                            ]}
                            onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
                        >
                            <Icon name="chevron-left" size={28} color={colors.primary} />
                        </TouchableOpacity>

                        <Text style={styles.pageInfo}>
                            Page {currentPage} of {totalPages}
                        </Text>

                        <TouchableOpacity
                            disabled={currentPage === totalPages}
                            style={[
                                styles.pageBtn,
                                currentPage === totalPages && styles.pageBtnDisabled,
                            ]}
                            onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        >
                            <Icon name="chevron-right" size={28} color={colors.primary} />
                        </TouchableOpacity>
                    </View>
                )}

            </ScrollView>
        </SafeAreaView>
    );
};

export default SundryDebtorsCreditors;

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
            fontSize: 16,
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

    });