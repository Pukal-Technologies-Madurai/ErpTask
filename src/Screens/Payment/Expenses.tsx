import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    RefreshControl,
    TextInput,
    ScrollView,
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
import { fetchExpenses } from "../../Api/fetchExpenses";
import { formatCurrency } from "../../constants/utils";

/* ================= TYPES ================= */

export interface Account {
    Acc_Id: string;
    Account_Name: string;
    Debit_Amount: number;
    Credit_Amount: number;
}

type ExpenseNode = {
    group_id: string;
    group_name: string;
    Parent_AC_id: string | null;
    accounts: Account[];
    children: ExpenseNode[];
};

/* ================= SCREEN ================= */

const Expenses = () => {
    const { typography, colors } = useTheme();
    const styles = getStyles(typography, colors);
    const navigation = useNavigation<NativeStackNavigationProp<any>>();

    // -- State --
    const [fromDate, setFromDate] = useState(new Date());
    const [toDate, setToDate] = useState(new Date());
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<"DIRECT" | "INDIRECT">("DIRECT");
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [rawData, setRawData] = useState<ExpenseNode[]>([]);
    const [modalVisible, setModalVisible] = useState(false);

    // -- Data Fetching --
    const fetchData = useCallback(async (f: Date, t: Date) => {
        setLoading(true);
        try {
            const res = await fetchExpenses(f, t);
            // Root usually has children[0] as Direct and children[1] as Indirect
            const rootChildren = res?.[0]?.children || [];
            setRawData(rootChildren);
        } catch (err) {
            console.error("Expenses fetch error:", err);
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

    // -- Logic Helpers --

    const calculateBalance = (node: ExpenseNode) => {
        let debit = 0;
        let credit = 0;
        node.accounts?.forEach(a => {
            debit += a.Debit_Amount || 0;
            credit += a.Credit_Amount || 0;
        });
        node.children?.forEach(c => {
            const sub = calculateBalance(c);
            debit += sub.debit;
            credit += sub.credit;
        });
        return { debit, credit, bal: debit - credit };
    };

    // Filtered tree logic (Basic search by group name)
    const displayGroups = useMemo(() => {
        const root = rawData.find(d =>
            activeTab === "DIRECT"
                ? d.group_name?.toLowerCase().includes("direct")
                : d.group_name?.toLowerCase().includes("indirect"),
        );
        let list = root?.children || [];

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            list = list.filter(
                node =>
                    node.group_name?.toLowerCase().includes(query) ||
                    node.accounts?.some(a =>
                        a.Account_Name?.toLowerCase().includes(query),
                    ),
            );
        }
        return list;
    }, [rawData, activeTab, searchQuery]);

    const grandSummary = useMemo(() => {
        let totalDR = 0;
        let totalCR = 0;
        rawData.forEach(node => {
            const sub = calculateBalance(node);
            totalDR += sub.debit;
            totalCR += sub.credit;
        });
        return { dr: totalDR, cr: totalCR, bal: totalDR - totalCR };
    }, [rawData]);

    // -- Sub-Components --

    const Dashboard = () => (
        <View style={styles.dashboard}>
            <View style={styles.mainStat}>
                <Text style={styles.mainStatLabel}>Consolidated Expenses</Text>
                <Text style={[styles.mainStatValue, { color: colors.error }]}>
                    {formatCurrency(grandSummary.bal)}
                    <Text style={styles.indicatorText}> DR</Text>
                </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.subStats}>
                <View style={styles.subStatItem}>
                    <Text style={styles.subStatLabel}>Total In (DR)</Text>
                    <Text style={styles.subStatValue}>
                        {formatCurrency(grandSummary.dr)}
                    </Text>
                </View>
                <View style={styles.subStatItem}>
                    <Text style={styles.subStatLabel}>Total Recovery (CR)</Text>
                    <Text style={styles.subStatValue}>
                        {formatCurrency(grandSummary.cr)}
                    </Text>
                </View>
            </View>
        </View>
    );

    const ToggleTabs = () => (
        <View style={styles.toggleWrapper}>
            <View style={styles.toggleInner}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setActiveTab("DIRECT")}
                    style={[
                        styles.toggleBtn,
                        activeTab === "DIRECT" && styles.toggleBtnActive,
                    ]}>
                    <Text
                        style={[
                            styles.toggleText,
                            activeTab === "DIRECT" && styles.toggleTextActive,
                        ]}>
                        Direct
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setActiveTab("INDIRECT")}
                    style={[
                        styles.toggleBtn,
                        activeTab === "INDIRECT" && styles.toggleBtnActive,
                    ]}>
                    <Text
                        style={[
                            styles.toggleText,
                            activeTab === "INDIRECT" && styles.toggleTextActive,
                        ]}>
                        In-Direct
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const AccountRow = ({ acc, level }: { acc: Account; level: number }) => {
        const bal = acc.Debit_Amount - acc.Credit_Amount;
        return (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate("transactionlistexp", {
                        accId: acc.Acc_Id,
                        fromDate: fromDate.toISOString().split("T")[0],
                        toDate: toDate.toISOString().split("T")[0],
                    })
                }
                style={[styles.accountRow, { marginLeft: level * 16 }]}>
                <View style={styles.accountIcon}>
                    <Icon name="description" size={14} color={colors.grey500} />
                </View>
                <Text style={styles.accountName} numberOfLines={1}>
                    {acc.Account_Name}
                </Text>
                <Text
                    style={[
                        styles.accountBal,
                        { color: bal > 0 ? colors.error : colors.success },
                    ]}>
                    {formatCurrency(Math.abs(bal))}
                </Text>
            </TouchableOpacity>
        );
    };

    const GroupNode = ({
        node,
        level = 0,
    }: {
        node: ExpenseNode;
        level?: number;
    }) => {
        const [isExpanded, setIsExpanded] = useState(level === 0); // Expand first level by default
        const { bal } = calculateBalance(node);
        const hasContent = node.children.length > 0 || node.accounts.length > 0;

        return (
            <View
                style={[
                    styles.groupContainer,
                    level > 0 && styles.nestedGroup,
                ]}>
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setIsExpanded(!isExpanded)}
                    style={[
                        styles.groupHeader,
                        {
                            borderLeftColor:
                                level % 2 === 0
                                    ? colors.primary
                                    : colors.accent,
                        },
                    ]}>
                    <Icon
                        name={
                            isExpanded
                                ? "keyboard-arrow-down"
                                : "keyboard-arrow-right"
                        }
                        size={20}
                        color={colors.grey600}
                    />
                    <Icon
                        name={level === 0 ? "folder" : "folder_open"}
                        size={18}
                        color={colors.primary}
                        style={{ marginHorizontal: 4 }}
                    />
                    <Text style={styles.groupName} numberOfLines={1}>
                        {node.group_name}
                    </Text>
                    <View style={styles.spacer} />
                    <Text
                        style={[
                            styles.groupBal,
                            { color: bal > 0 ? colors.error : colors.success },
                        ]}>
                        {formatCurrency(Math.abs(bal))}
                    </Text>
                </TouchableOpacity>

                {isExpanded && (
                    <View style={styles.groupContent}>
                        {node.children.map(child => (
                            <GroupNode
                                key={child.group_id}
                                node={child}
                                level={level + 1}
                            />
                        ))}
                        {node.accounts.map(acc => (
                            <AccountRow
                                key={acc.Acc_Id}
                                acc={acc}
                                level={level + 1}
                            />
                        ))}
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <AppHeader
                title="Expenses Report"
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
                onApply={() => {
                    setModalVisible(false);
                    fetchData(fromDate, toDate);
                }}
                onClose={() => setModalVisible(false)}
                showToDate
                title="Filter Expenses"
            />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                    />
                }>
                <Dashboard />
                <ToggleTabs />

                <View style={styles.searchBox}>
                    <View style={styles.searchInner}>
                        <Icon name="search" size={20} color={colors.grey500} />
                        <TextInput
                            placeholder="Find group or account..."
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                </View>

                <View style={styles.treeContainer}>
                    {displayGroups.length > 0
                        ? displayGroups.map(group => (
                              <GroupNode key={group.group_id} node={group} />
                          ))
                        : !loading && (
                              <View style={styles.empty}>
                                  <Icon
                                      name="account-balance-wallet"
                                      size={64}
                                      color={colors.grey200}
                                  />
                                  <Text style={styles.emptyTitle}>
                                      No Records Found
                                  </Text>
                                  <Text style={styles.emptySubtitle}>
                                      Try selecting a different tab or date
                                  </Text>
                              </View>
                          )}
                </View>
            </ScrollView>

            {loading && !refreshing && (
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>
                        Compiling Expenses...
                    </Text>
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
        scroll: {
            backgroundColor: "#f8f9fa",
        },
        scrollContent: {
            paddingBottom: 40,
        },

        // Dashboard
        dashboard: {
            backgroundColor: colors.white,
            padding: 20,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
            elevation: 4,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            marginBottom: 15,
        },
        mainStat: {
            alignItems: "center",
            marginBottom: 15,
        },
        mainStatLabel: {
            ...typography.caption,
            color: colors.grey600,
            textTransform: "uppercase",
            letterSpacing: 1,
        },
        mainStatValue: {
            ...typography.h5,
            fontWeight: "800",
            marginTop: 5,
        },
        indicatorText: {
            fontSize: 14,
            fontWeight: "600",
        },
        statDivider: {
            height: 1,
            backgroundColor: "#f0f0f0",
            marginVertical: 10,
        },
        subStats: {
            flexDirection: "row",
            justifyContent: "space-between",
        },
        subStatItem: {
            flex: 1,
            alignItems: "center",
        },
        subStatLabel: {
            fontSize: 10,
            color: colors.grey500,
            marginBottom: 2,
        },
        subStatValue: {
            fontSize: 13,
            fontWeight: "700",
            color: colors.text,
        },

        // Toggle
        toggleWrapper: {
            paddingHorizontal: 20,
            marginBottom: 15,
        },
        toggleInner: {
            flexDirection: "row",
            backgroundColor: "#e0e0e0",
            borderRadius: 12,
            padding: 4,
        },
        toggleBtn: {
            flex: 1,
            paddingVertical: 10,
            alignItems: "center",
            borderRadius: 10,
        },
        toggleBtnActive: {
            backgroundColor: colors.primary,
        },
        toggleText: {
            fontWeight: "700",
            color: colors.grey600,
        },
        toggleTextActive: {
            color: colors.white,
        },

        // Search
        searchBox: {
            paddingHorizontal: 20,
            marginBottom: 15,
        },
        searchInner: {
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
            marginLeft: 10,
            color: colors.text,
        },

        // Tree List
        treeContainer: {
            paddingHorizontal: 12,
        },
        groupContainer: {
            backgroundColor: colors.white,
            borderRadius: 12,
            marginBottom: 10,
            overflow: "hidden",
            elevation: 1,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
        },
        nestedGroup: {
            marginTop: 4,
            marginBottom: 4,
            elevation: 0,
            borderLeftWidth: 1,
            borderLeftColor: "#eee",
        },
        groupHeader: {
            flexDirection: "row",
            alignItems: "center",
            padding: 12,
            borderLeftWidth: 4,
        },
        groupName: {
            fontSize: 13,
            fontWeight: "700",
            color: colors.text,
            flex: 1,
        },
        groupBal: {
            fontSize: 12,
            fontWeight: "800",
        },
        spacer: {
            width: 10,
        },
        groupContent: {
            paddingBottom: 4,
        },

        // Account Row
        accountRow: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderTopWidth: 0.5,
            borderTopColor: "#f5f5f5",
        },
        accountIcon: {
            marginRight: 10,
        },
        accountName: {
            fontSize: 12,
            color: colors.grey700,
            flex: 1,
        },
        accountBal: {
            fontSize: 11,
            fontWeight: "600",
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
            marginTop: 12,
            color: colors.primary,
            fontWeight: "600",
        },
        empty: {
            paddingVertical: 100,
            alignItems: "center",
        },
        emptyTitle: {
            fontSize: 16,
            fontWeight: "700",
            color: colors.grey400,
            marginTop: 10,
        },
        emptySubtitle: {
            fontSize: 12,
            color: colors.grey400,
            marginTop: 4,
        },
    });

export default Expenses;
