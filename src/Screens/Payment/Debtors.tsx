import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    RefreshControl,
    TextInput,
    FlatList,
    ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";

import AppHeader from "../../Components/AppHeader";
import FilterModal from "../../Components/FilterModal";
import { useTheme } from "../../Context/ThemeContext";
import { responsiveHeight, responsiveWidth } from "../../constants/helper";
import { fetchDebtorsCreditors } from "../../Api/debtorscreditors";
import { formatCurrency } from "../../constants/utils";

// -- Constants --
const ITEMS_PER_PAGE = 15;

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

const SundryDebtorsCreditors = () => {
    const { typography, colors } = useTheme();
    const styles = getStyles(typography, colors);
    const navigation = useNavigation<NativeStackNavigationProp<any>>();

    // -- State --
    const [fromDate, setFromDate] = useState(new Date());
    const [toDate, setToDate] = useState(new Date());
    const [searchQuery, setSearchQuery] = useState("");
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [modalVisible, setModalVisible] = useState(false);
    const [activeTab, setActiveTab] = useState<"Debtor" | "Creditor">("Debtor");
    const [rawData, setRawData] = useState<DebtorCreditor[]>([]);

    // -- Data Fetching --
    const fetchData = useCallback(async (fDate: Date, tDate: Date) => {
        setLoading(true);
        try {
            const res = await fetchDebtorsCreditors(fDate, tDate);
            setRawData(res || []);
        } catch (error) {
            console.error("Fetch Debtors/Creditors Error:", error);
            setRawData([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData(fromDate, toDate);
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData(fromDate, toDate);
    };

    const handleApplyFilter = () => {
        setModalVisible(false);
        fetchData(fromDate, toDate);
    };

    // -- Logic & Filtering --
    const filteredData = useMemo(() => {
        let result = rawData.filter(item => item.Account_Types === activeTab);

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(
                item =>
                    item.Retailer_Name?.toLowerCase().includes(query) ||
                    item.Group_Name?.toLowerCase().includes(query),
            );
        }

        // Remove zero-value records (to keep it clean)
        result = result.filter(item => {
            const ob = Math.abs(Number(String(item.OB_Amount).replace(/[^\d.-]/g, "")));
            return (
                item.Dr_Amount !== 0 ||
                item.Cr_Amount !== 0 ||
                item.Bal_Amount !== 0 ||
                ob !== 0
            );
        });

        return result;
    }, [rawData, activeTab, searchQuery]);

    // Summary calculation for the active tab
    const summary = useMemo(() => {
        let totalDebit = 0;
        let totalCredit = 0;
        filteredData.forEach(item => {
            totalDebit += item.Dr_Amount || 0;
            totalCredit += item.Cr_Amount || 0;
        });

        const diff = totalDebit - totalCredit;
        return {
            totalDebit,
            totalCredit,
            diff: Math.abs(diff),
            indicator: diff >= 0 ? "DR" : "CR",
        };
    }, [filteredData]);

    // Pagination
    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredData.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredData, currentPage]);

    // Reset pagination on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, activeTab]);

    // -- Sub-Components --

    const StatsHeader = () => (
        <View style={styles.statsContainer}>
            <View style={[styles.statCard, { borderLeftColor: colors.info }]}>
                <Text style={styles.statLabel}>Total Debit</Text>
                <Text style={[styles.statValue, { color: colors.info }]}>
                    {formatCurrency(summary.totalDebit)}
                </Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: colors.accent }]}>
                <Text style={styles.statLabel}>Total Credit</Text>
                <Text style={[styles.statValue, { color: colors.accent }]}>
                    {formatCurrency(summary.totalCredit)}
                </Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: colors.success }]}>
                <Text style={styles.statLabel}>Outstanding ({summary.indicator})</Text>
                <Text style={[styles.statValue, { color: colors.success }]}>
                    {formatCurrency(summary.diff)}
                </Text>
            </View>
        </View>
    );

    const ToggleBar = () => (
        <View style={styles.toggleWrapper}>
            <View style={styles.toggleInner}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setActiveTab("Debtor")}
                    style={[
                        styles.toggleBtn,
                        activeTab === "Debtor" && styles.toggleBtnActiveDebtor,
                    ]}>
                    <Icon
                        name="arrow-upward"
                        size={16}
                        color={activeTab === "Debtor" ? colors.white : colors.info}
                    />
                    <Text
                        style={[
                            styles.toggleText,
                            activeTab === "Debtor" && styles.toggleTextActive,
                        ]}>
                        Debtors
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setActiveTab("Creditor")}
                    style={[
                        styles.toggleBtn,
                        activeTab === "Creditor" && styles.toggleBtnActiveCreditor,
                    ]}>
                    <Icon
                        name="arrow-downward"
                        size={16}
                        color={activeTab === "Creditor" ? colors.white : colors.accent}
                    />
                    <Text
                        style={[
                            styles.toggleText,
                            activeTab === "Creditor" && styles.toggleTextActive,
                        ]}>
                        Creditors
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const SearchBar = () => (
        <View style={styles.searchWrapper}>
            <View style={styles.searchBar}>
                <Icon name="search" size={20} color={colors.grey500} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or group..."
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

    const RenderItem = ({ item: it }: { item: DebtorCreditor }) => {
        const isDR = it.CR_DR === "DR";
        const accentColor = isDR ? colors.info : colors.accent;
        const obVal = Number(String(it.OB_Amount).replace(/[^\d.-]/g, ""));

        return (
            <View style={styles.card}>
                <View style={[styles.cardHeader, { borderLeftColor: accentColor }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.accountName} numberOfLines={1}>
                            {it.Retailer_Name}
                        </Text>
                        <Text style={styles.groupName}>{it.Group_Name}</Text>
                    </View>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() =>
                            navigation.navigate("transactionlist", {
                                retailer: it,
                                fromDate: fromDate.toISOString().split("T")[0],
                                toDate: toDate.toISOString().split("T")[0],
                                Acc_id: Number(it.Acc_Id),
                            })
                        }
                        style={styles.historyBtn}>
                        <Icon name="history" size={22} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.cardBody}>
                    <View style={styles.dataRow}>
                        <View style={styles.dataCol}>
                            <Text style={styles.dataLabel}>Opening Balance</Text>
                            <Text style={styles.dataValue}>{formatCurrency(obVal)}</Text>
                        </View>
                        <View style={styles.dataCol}>
                            <Text style={styles.dataLabel}>Current Transactions</Text>
                            <View style={{ flexDirection: "row", gap: 10 }}>
                                <Text style={[styles.miniText, { color: colors.info }]}>
                                    D: {formatCurrency(it.Dr_Amount)}
                                </Text>
                                <Text style={[styles.miniText, { color: colors.accent }]}>
                                    C: {formatCurrency(it.Cr_Amount)}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.footerRow}>
                        <Text style={styles.balLabel}>Closing Balance</Text>
                        <View style={[styles.balBadge, { backgroundColor: accentColor + "15" }]}>
                            <Text style={[styles.balValue, { color: accentColor }]}>
                                {formatCurrency(Math.abs(it.Bal_Amount))} {it.CR_DR}
                            </Text>
                        </View>
                    </View>
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
                    style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}>
                    <Icon name="chevron-left" size={24} color={currentPage === 1 ? colors.grey300 : colors.primary} />
                </TouchableOpacity>
                <Text style={styles.pageInfo}>
                    {currentPage} / {totalPages}
                </Text>
                <TouchableOpacity
                    disabled={currentPage === totalPages}
                    onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}>
                    <Icon name="chevron-right" size={24} color={currentPage === totalPages ? colors.grey300 : colors.primary} />
                </TouchableOpacity>
            </View>
        );
    };

    const EmptyState = () => (
        <View style={styles.emptyContainer}>
            <Icon name={activeTab === "Debtor" ? "person-add" : "person-remove"} size={64} color={colors.grey200} />
            <Text style={styles.emptyTitle}>No {activeTab}s Found</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your search or filters</Text>
        </View>
    );

    // -- Main Render --
    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <AppHeader
                title="Debtors & Creditors"
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
                onApply={handleApplyFilter}
                onClose={() => setModalVisible(false)}
                showToDate
                title="Select Date Range"
            />

            <FlatList
                data={paginatedData}
                keyExtractor={item => item.Acc_Id}
                renderItem={({ item }) => <RenderItem item={item} />}
                ListHeaderComponent={
                    <View>
                        <StatsHeader />
                        <ToggleBar />
                        <SearchBar />
                        <View style={styles.resultsInfo}>
                            <Text style={styles.resultsText}>
                                Showing {paginatedData.length} of {filteredData.length} records
                            </Text>
                        </View>
                    </View>
                }
                ListFooterComponent={<Pagination />}
                ListEmptyComponent={!loading ? <EmptyState /> : null}
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

            {loading && !refreshing && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Analyzing Balances...</Text>
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

        // Stats Header
        statsContainer: {
            flexDirection: "row",
            padding: responsiveWidth(4),
            gap: responsiveWidth(2.5),
        },
        statCard: {
            flex: 1,
            backgroundColor: colors.white,
            padding: 10,
            borderRadius: 12,
            borderLeftWidth: 4,
            elevation: 3,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
        },
        statLabel: {
            ...typography.caption,
            color: colors.grey600,
            fontSize: 9,
            textTransform: "uppercase",
            marginBottom: 2,
        },
        statValue: {
            fontSize: 12,
            fontWeight: "700",
        },

        // Toggle Bar
        toggleWrapper: {
            paddingHorizontal: responsiveWidth(4),
            marginBottom: responsiveHeight(1.5),
        },
        toggleInner: {
            flexDirection: "row",
            backgroundColor: "#e0e0e0",
            borderRadius: 12,
            padding: 4,
        },
        toggleBtn: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 10,
            borderRadius: 10,
            gap: 6,
        },
        toggleBtnActiveDebtor: {
            backgroundColor: colors.info,
        },
        toggleBtnActiveCreditor: {
            backgroundColor: colors.accent,
        },
        toggleText: {
            ...typography.body2,
            fontWeight: "700",
            color: colors.grey600,
        },
        toggleTextActive: {
            color: colors.white,
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

        // Results Text
        resultsInfo: {
            paddingHorizontal: responsiveWidth(4),
            marginBottom: 8,
            alignItems: "center",
        },
        resultsText: {
            ...typography.caption,
            color: colors.grey500,
            fontSize: 11,
        },

        // Card Styling
        card: {
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(4),
            marginVertical: responsiveHeight(0.7),
            borderRadius: 16,
            overflow: "hidden",
            elevation: 2,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 3,
        },
        cardHeader: {
            flexDirection: "row",
            alignItems: "center",
            padding: 12,
            borderLeftWidth: 5,
            backgroundColor: "#fcfcfc",
            borderBottomWidth: 1,
            borderBottomColor: "#f0f0f0",
        },
        accountName: {
            ...typography.body2,
            fontWeight: "700",
            color: colors.text,
        },
        groupName: {
            ...typography.caption,
            color: colors.grey500,
            fontSize: 10,
            marginTop: 1,
        },
        historyBtn: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.primary + "10",
            alignItems: "center",
            justifyContent: "center",
        },
        cardBody: {
            padding: 12,
        },
        dataRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 10,
        },
        dataCol: {
            flex: 1,
        },
        dataLabel: {
            ...typography.caption,
            color: colors.grey500,
            fontSize: 10,
            marginBottom: 2,
        },
        dataValue: {
            ...typography.body2,
            fontWeight: "600",
            color: colors.text,
        },
        miniText: {
            fontSize: 11,
            fontWeight: "600",
        },
        divider: {
            height: 1,
            backgroundColor: "#f0f0f0",
            marginVertical: 4,
        },
        footerRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 8,
        },
        balLabel: {
            ...typography.body2,
            fontWeight: "700",
            color: colors.text,
        },
        balBadge: {
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 8,
        },
        balValue: {
            fontWeight: "800",
            fontSize: 13,
        },

        // Pagination
        pagination: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 20,
            gap: 20,
        },
        pageBtn: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.white,
            alignItems: "center",
            justifyContent: "center",
            elevation: 2,
        },
        pageBtnDisabled: {
            backgroundColor: "#f0f0f0",
            elevation: 0,
        },
        pageInfo: {
            ...typography.body2,
            fontWeight: "700",
            color: colors.grey700,
        },

        // Utils
        loadingOverlay: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: "rgba(255,255,255,0.8)",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
        },
        loadingText: {
            marginTop: 12,
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

export default SundryDebtorsCreditors;