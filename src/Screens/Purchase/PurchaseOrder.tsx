import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    FlatList,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import Icon from "react-native-vector-icons/MaterialIcons";
import { MMKV } from "react-native-mmkv";

import { useTheme } from "../../Context/ThemeContext";
import { getPurchaseOrderEntry } from "../../Api/Purchase";
import { RootStackParamList } from "../../Navigation/types";
import { responsiveHeight, responsiveWidth } from "../../constants/helper";
import AppHeader from "../../Components/AppHeader";
import FilterModal from "../../Components/FilterModal";
import { formatCurrency } from "../../constants/utils";

/* ================= TYPES ================= */

type OrderItem = {
    Id: number;
    ItemName: string;
    Stock_Group: string;
    Weight: number;
    Rate: number;
    DeliveryLocation: string;
    Stock_Item: string;
};

type DeliveryDetail = {
    Location: string;
    ArrivalDate: string;
    ItemName: string;
    BilledRate: number;
    Quantity: number;
    Weight: number;
};

type StaffDetail = {
    Emp_Name: string;
    Cost_Category: string;
};

type Order = {
    Id: number;
    PO_ID: string;
    PartyName: string;
    Party_District: string;
    OrderStatus: string;
    CreatedAt: string;
    LoadingDate: string;
    TradeConfirmDate: string;
    ItemDetails: OrderItem[];
    DeliveryDetails: DeliveryDetail[];
    StaffDetails: StaffDetail[];
    IsConvertedAsInvoice: number;
    Remarks?: string;
};

/* ================= SCREEN ================= */

const PurchaseOrder = ({ route }: { route: any }) => {
    const { branchId: branchIdProps } = route.params || {};
    const { colors, typography } = useTheme();
    const styles = getStyles(typography, colors);
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const storage = new MMKV();

    // -- State --
    const [fromDate, setFromDate] = useState<Date>(new Date());
    const [toDate, setToDate] = useState<Date>(new Date());
    const [searchQuery, setSearchQuery] = useState("");
    const [modalVisible, setModalVisible] = useState(false);
    const [activeTab, setActiveTab] = useState<"orders" | "items">("orders");
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [userId, setUserId] = useState(0);

    // -- Init --
    useEffect(() => {
        const uId = storage.getString("userId");
        if (uId) setUserId(parseInt(uId));
    }, []);

    // -- Data --
    const {
        data: purchaseOrderData = [],
        isLoading,
        refetch,
        isRefetching
    } = useQuery({
        queryKey: ["purchaseOrderReport", fromDate, toDate, userId, branchIdProps],
        queryFn: () => getPurchaseOrderEntry(fromDate, toDate, userId, branchIdProps),
        enabled: !!userId && !!branchIdProps,
    });

    const filteredData = useMemo(() => {
        let list = [...purchaseOrderData];
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            list = list.filter(o =>
                o.PartyName?.toLowerCase().includes(query) ||
                o.PO_ID?.toLowerCase().includes(query) ||
                o.ItemDetails?.some((i: any) => i.ItemName?.toLowerCase().includes(query))
            );
        }
        return list.sort((a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime());
    }, [purchaseOrderData, searchQuery]);

    const stats = useMemo(() => {
        const total = filteredData.length;
        const value = filteredData.reduce((sum, o) =>
            sum + (o.ItemDetails?.reduce((isum: number, i: any) => isum + (i.Weight * i.Rate), 0) || 0), 0);
        const completed = filteredData.filter(o => o.OrderStatus === "Completed").length;
        const invoiced = filteredData.filter(o => o.IsConvertedAsInvoice === 1).length;
        return { total, value, completed, invoiced };
    }, [filteredData]);

    const itemSummary = useMemo(() => {
        const map: any = {};
        filteredData.forEach(o => {
            o.ItemDetails?.forEach((i: any) => {
                const key = i.Stock_Item || i.ItemName;
                if (!map[key]) map[key] = { name: key, group: i.Stock_Group, weight: 0, value: 0, count: 0 };
                map[key].weight += i.Weight || 0;
                map[key].value += (i.Weight * i.Rate) || 0;
                map[key].count += 1;
            });
        });
        return Object.values(map).sort((a: any, b: any) => b.weight - a.weight);
    }, [filteredData]);

    // -- Handlers --
    const toggleExpand = (id: number) => {
        const next = new Set(expandedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedIds(next);
    };

    const formatDate = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "-";

    // -- Components --

    const Dashboard = () => (
        <View style={styles.dashboard}>
            <View style={styles.statsRow}>
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Total Orders</Text>
                    <Text style={styles.statValue}>{stats.total}</Text>
                    <View style={styles.statSub}>
                        <Icon name="check-circle" size={10} color={colors.success} />
                        <Text style={styles.statSubText}>{stats.completed} Completed</Text>
                    </View>
                </View>
                <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: "#eee" }]}>
                    <Text style={styles.statLabel}>Total Value</Text>
                    <Text style={[styles.statValue, { color: colors.primary }]}>{formatCurrency(stats.value)}</Text>
                    <View style={styles.statSub}>
                        <Icon name="receipt" size={10} color={colors.accent} />
                        <Text style={styles.statSubText}>{stats.invoiced} Invoiced</Text>
                    </View>
                </View>
            </View>
        </View>
    );

    const OrderCard = ({ item }: { item: Order }) => {
        const isExpanded = expandedIds.has(item.Id);
        const orderVal = item.ItemDetails?.reduce((s, i) => s + (i.Weight * i.Rate), 0) || 0;
        const totalQty = item.ItemDetails?.reduce((s, i) => s + (i.Weight || 0), 0) || 0;

        return (
            <View style={styles.card}>
                <TouchableOpacity activeOpacity={0.9} onPress={() => toggleExpand(item.Id)} style={styles.cardMain}>
                    {/* Top Row: PO ID & Status */}
                    <View style={styles.cardTop}>
                        <View style={styles.poBox}>
                            <Text style={styles.poText}>{item.PO_ID}</Text>
                            {item.IsConvertedAsInvoice === 1 && (
                                <View style={styles.invoiceBadge}>
                                    <Icon name="auto-awesome" size={10} color={colors.white} />
                                    <Text style={styles.invoiceBadgeText}>INVOICED</Text>
                                </View>
                            )}
                        </View>
                        <View style={[styles.statusBadge, {
                            backgroundColor: item.OrderStatus === "Completed" ? colors.success + "15" : colors.warning + "15"
                        }]}>
                            <Text style={[styles.statusText, {
                                color: item.OrderStatus === "Completed" ? colors.success : colors.warning
                            }]}>{item.OrderStatus}</Text>
                        </View>
                    </View>

                    {/* Party & Location */}
                    <Text style={styles.partyName}>{item.PartyName}</Text>
                    <View style={styles.locationRow}>
                        <Icon name="location-on" size={12} color={colors.grey500} />
                        <Text style={styles.locationText}>{item.Party_District || "N/A"}</Text>
                        <View style={styles.dot} />
                        <Text style={styles.dateLabel}>{formatDate(item.CreatedAt)}</Text>
                    </View>

                    {/* Value & Qty Summary */}
                    <View style={styles.summaryFooter}>
                        <View style={styles.summaryItem}>
                            <Icon name="layers" size={14} color={colors.grey400} />
                            <Text style={styles.summaryLabelText}>{item.ItemDetails?.length || 0} Items</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Icon name="fitness-center" size={14} color={colors.grey400} />
                            <Text style={styles.summaryLabelText}>{totalQty} KG</Text>
                        </View>
                        <View style={styles.spacer} />
                        <Text style={styles.orderValText}>{formatCurrency(orderVal)}</Text>
                    </View>

                    {/* Expand Arrow */}
                    <View style={styles.expandRow}>
                        <Icon name={isExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={20} color={colors.grey300} />
                    </View>
                </TouchableOpacity>

                {isExpanded && (
                    <View style={styles.detailsArea}>
                        {/* Items Sub-Section */}
                        <Text style={styles.subTitle}>Item Details</Text>
                        {item.ItemDetails?.map(it => (
                            <View key={it.Id} style={styles.itemRow}>
                                <View style={styles.itemLead}>
                                    <View style={styles.itemPill} />
                                    <Text style={styles.itName}>{it.ItemName}</Text>
                                </View>
                                <View style={styles.itemValues}>
                                    <Text style={styles.itQty}>{it.Weight} KG</Text>
                                    <Text style={styles.itRate}>@ {it.Rate}</Text>
                                </View>
                            </View>
                        ))}

                        {/* Logistics Section */}
                        <View style={styles.logisticsBox}>
                            <View style={styles.logRow}>
                                <View style={styles.logItem}>
                                    <Text style={styles.logLabel}>Arrived At</Text>
                                    <Text style={styles.logValue}>{item.DeliveryDetails?.[0]?.Location || "N/A"}</Text>
                                </View>
                                <View style={styles.logItem}>
                                    <Text style={styles.logLabel}>Loading Date</Text>
                                    <Text style={styles.logValue}>{formatDate(item.LoadingDate)}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Staff Section */}
                        {item.StaffDetails?.length > 0 && (
                            <View style={styles.staffArea}>
                                <Text style={styles.staffTitle}>Assigned Team</Text>
                                <View style={styles.staffGrid}>
                                    {item.StaffDetails.map((s, idx) => (
                                        <View key={idx} style={styles.staffChip}>
                                            <Icon name={s.Cost_Category === "Owners" ? "person" : "badge"} size={10} color={colors.primary} />
                                            <Text style={styles.staffName}>{s.Emp_Name}</Text>
                                            <Text style={styles.staffLabelSmall}>({s.Cost_Category})</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {item.Remarks && (
                            <View style={styles.remarksBox}>
                                <Text style={styles.remarksText}>Note: {item.Remarks}</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <AppHeader
                title="Purchase Orders"
                navigation={navigation}
                showRightIcon
                rightIconLibrary="MaterialIcon"
                rightIconName="date-range"
                onRightPress={() => setModalVisible(true)}
            />

            <View style={styles.mainContainer}>
                <Dashboard />

                <View style={styles.tabBar}>
                    <TouchableOpacity onPress={() => setActiveTab("orders")} style={[styles.tab, activeTab === "orders" && styles.activeTab]}>
                        <Text style={[styles.tabLabel, activeTab === "orders" && styles.activeTabLabel]}>Orders</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setActiveTab("items")} style={[styles.tab, activeTab === "items" && styles.activeTab]}>
                        <Text style={[styles.tabLabel, activeTab === "items" && styles.activeTabLabel]}>Stock Summary</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.searchBar}>
                    <Icon name="search" size={18} color={colors.grey500} />
                    <TextInput
                        placeholder="Search supplier or PO ID..."
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {activeTab === "orders" ? (
                    <FlatList
                        data={filteredData}
                        keyExtractor={o => o.Id.toString()}
                        renderItem={({ item }) => <OrderCard item={item} />}
                        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[colors.primary]} />}
                        contentContainerStyle={styles.listContainer}
                        ListEmptyComponent={!isLoading ? (
                            <View style={styles.empty}>
                                <Icon name="receipt" size={60} color={colors.grey200} />
                                <Text style={styles.emptyText}>No Orders Found</Text>
                            </View>
                        ) : null}
                    />
                ) : (
                    <FlatList
                        data={itemSummary}
                        keyExtractor={(it: any) => it.name}
                        renderItem={({ item }: any) => (
                            <View style={styles.itemSummaryCard}>
                                <View style={styles.itSumHeader}>
                                    <Text style={styles.itSumName}>{item.name}</Text>
                                    <Text style={styles.itSumGroup}>{item.group}</Text>
                                </View>
                                <View style={styles.itSumBody}>
                                    <View style={styles.itSumStat}>
                                        <Text style={styles.itSumVal}>{item.weight} KG</Text>
                                        <Text style={styles.itSumLabel}>Weight</Text>
                                    </View>
                                    <View style={styles.itSumStat}>
                                        <Text style={styles.itSumVal}>{item.count}</Text>
                                        <Text style={styles.itSumLabel}>POs</Text>
                                    </View>
                                    <View style={styles.itSumStat}>
                                        <Text style={styles.itSumVal}>{formatCurrency(item.value)}</Text>
                                        <Text style={styles.itSumLabel}>Value</Text>
                                    </View>
                                </View>
                            </View>
                        )}
                        contentContainerStyle={styles.listContainer}
                    />
                )}

                {isLoading && !isRefetching && (
                    <View style={styles.loading}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Syncing Purchase Orders...</Text>
                    </View>
                )}

                <FilterModal
                    visible={modalVisible}
                    fromDate={fromDate}
                    toDate={toDate}
                    onFromDateChange={setFromDate}
                    onToDateChange={setToDate}
                    onApply={() => { setModalVisible(false); refetch(); }}
                    onClose={() => setModalVisible(false)}
                    showToDate
                />
            </View>
        </SafeAreaView>
    );
};

const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.primary,
        },
        mainContainer: {
            flex: 1,
            backgroundColor: colors.white,
        },
        dashboard: {
            backgroundColor: colors.white,
            margin: 12,
            borderRadius: 16,
            padding: 16,
            elevation: 4,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
        },
        statsRow: {
            flexDirection: "row",
        },
        statBox: {
            flex: 1,
            alignItems: "center",
        },
        statLabel: {
            ...typography.caption,
            color: colors.grey500,
            marginBottom: 4,
        },
        statValue: {
            ...typography.h6,
            fontWeight: "800",
            color: colors.text,
        },
        statSub: {
            flexDirection: "row",
            alignItems: "center",
            marginTop: 4,
            gap: 4,
        },
        statSubText: {
            fontSize: 9,
            fontWeight: "700",
            color: colors.grey600,
            textTransform: "uppercase",
        },

        // Tabs
        tabBar: {
            flexDirection: "row",
            marginHorizontal: 12,
            marginBottom: 12,
            backgroundColor: "#eee",
            padding: 4,
            borderRadius: 12,
        },
        tab: {
            flex: 1,
            paddingVertical: 10,
            alignItems: "center",
            borderRadius: 10,
        },
        activeTab: {
            backgroundColor: colors.primary,
        },
        tabLabel: {
            fontWeight: "700",
            color: colors.grey600,
        },
        activeTabLabel: {
            color: colors.white,
        },

        // Search
        searchBar: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.white,
            marginHorizontal: 12,
            marginBottom: 10,
            paddingHorizontal: 15,
            height: 44,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#eee",
        },
        searchInput: {
            flex: 1,
            marginLeft: 10,
            fontSize: 14,
            color: colors.text,
        },

        // List
        listContainer: {
            paddingHorizontal: 12,
            paddingBottom: 40,
        },
        card: {
            backgroundColor: colors.white,
            borderRadius: 16,
            marginBottom: 12,
            overflow: "hidden",
            elevation: 2,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
        },
        cardMain: {
            padding: 16,
        },
        cardTop: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
        },
        poBox: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
        },
        poText: {
            ...typography.body2,
            fontWeight: "800",
            color: colors.primary,
        },
        invoiceBadge: {
            backgroundColor: colors.accent,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
            gap: 4,
        },
        invoiceBadgeText: {
            fontSize: 8,
            fontWeight: "800",
            color: colors.white,
        },
        statusBadge: {
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
        },
        statusText: {
            fontSize: 10,
            fontWeight: "800",
            textTransform: "uppercase",
        },
        partyName: {
            ...typography.body1,
            fontWeight: "700",
            color: colors.text,
            marginBottom: 4,
        },
        locationRow: {
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 12,
        },
        locationText: {
            fontSize: 12,
            color: colors.grey500,
            marginLeft: 4,
        },
        dot: {
            width: 3,
            height: 3,
            borderRadius: 2,
            backgroundColor: colors.grey300,
            marginHorizontal: 8,
        },
        dateLabel: {
            fontSize: 12,
            color: colors.grey500,
        },
        summaryFooter: {
            flexDirection: "row",
            alignItems: "center",
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: "#f5f5f5",
            gap: 12,
        },
        summaryItem: {
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
        },
        summaryLabelText: {
            fontSize: 11,
            fontWeight: "600",
            color: colors.grey600,
        },
        spacer: {
            flex: 1,
        },
        orderValText: {
            ...typography.body2,
            fontWeight: "800",
            color: colors.text,
        },
        expandRow: {
            alignItems: "center",
            marginTop: 4,
        },

        // Details Area
        detailsArea: {
            backgroundColor: "#fafafa",
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: "#f0f0f0",
        },
        subTitle: {
            fontSize: 11,
            fontWeight: "800",
            color: colors.grey400,
            textTransform: "uppercase",
            marginBottom: 10,
            letterSpacing: 0.5,
        },
        itemRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
            backgroundColor: colors.white,
            padding: 10,
            borderRadius: 8,
        },
        itemLead: {
            flexDirection: "row",
            alignItems: "center",
            flex: 1,
        },
        itemPill: {
            width: 3,
            height: 15,
            backgroundColor: colors.primary,
            borderRadius: 2,
            marginRight: 10,
        },
        itName: {
            fontSize: 12,
            fontWeight: "600",
            color: colors.text,
            flex: 1,
        },
        itemValues: {
            alignItems: "flex-end",
        },
        itQty: {
            fontSize: 12,
            fontWeight: "700",
            color: colors.text,
        },
        itRate: {
            fontSize: 10,
            color: colors.grey500,
        },
        logisticsBox: {
            marginTop: 15,
            padding: 12,
            backgroundColor: "#eee",
            borderRadius: 10,
        },
        logRow: {
            flexDirection: "row",
        },
        logItem: {
            flex: 1,
        },
        logLabel: {
            fontSize: 9,
            color: colors.grey600,
            textTransform: "uppercase",
        },
        logValue: {
            fontSize: 12,
            fontWeight: "700",
            color: colors.text,
        },
        staffArea: {
            marginTop: 15,
        },
        staffTitle: {
            fontSize: 10,
            fontWeight: "700",
            color: colors.grey500,
            marginBottom: 8,
        },
        staffGrid: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
        },
        staffChip: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.white,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
            borderWidth: 0.5,
            borderColor: "#ddd",
            gap: 4,
        },
        staffName: {
            fontSize: 10,
            fontWeight: "700",
            color: colors.text,
        },
        staffLabelSmall: {
            fontSize: 9,
            color: colors.grey500,
        },
        remarksBox: {
            marginTop: 12,
            padding: 8,
            backgroundColor: colors.warning + "10",
            borderRadius: 6,
            borderLeftWidth: 2,
            borderLeftColor: colors.warning,
        },
        remarksText: {
            fontSize: 11,
            fontStyle: "italic",
            color: colors.textSecondary,
        },

        // Item Summary Tab
        itemSummaryCard: {
            backgroundColor: colors.white,
            borderRadius: 16,
            padding: 16,
            marginBottom: 12,
            borderLeftWidth: 5,
            borderLeftColor: colors.accent,
        },
        itSumHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
        },
        itSumName: {
            fontSize: 13,
            fontWeight: "800",
            color: colors.text,
            flex: 0.7,
        },
        itSumGroup: {
            fontSize: 10,
            fontWeight: "700",
            color: colors.accent,
            backgroundColor: colors.accent + "15",
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
        },
        itSumBody: {
            flexDirection: "row",
            justifyContent: "space-between",
            backgroundColor: "#f9f9f9",
            padding: 12,
            borderRadius: 12,
        },
        itSumStat: {
            alignItems: "center",
        },
        itSumVal: {
            fontSize: 13,
            fontWeight: "800",
            color: colors.text,
        },
        itSumLabel: {
            fontSize: 9,
            color: colors.grey500,
            marginTop: 2,
            textTransform: "uppercase",
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
            paddingVertical: 100,
            alignItems: "center",
        },
        emptyText: {
            fontSize: 14,
            fontWeight: "600",
            color: colors.grey400,
            marginTop: 15,
        },
    });

export default PurchaseOrder;
