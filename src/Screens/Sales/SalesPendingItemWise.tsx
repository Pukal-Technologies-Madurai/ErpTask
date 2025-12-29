import {
    Text,
    StyleSheet,
    View,
    ScrollView,
    RefreshControl,
    TouchableOpacity,
    TextInput,
    LayoutAnimation,
    UIManager,
    Platform,
} from "react-native";
import React from "react";
import Icon from "react-native-vector-icons/MaterialIcons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../Context/ThemeContext";
import AppHeader from "../../Components/AppHeader";
import FilterModal from "../../Components/FilterModal";
import { salesOrderPendingItemList } from "../../Api/Sales";
import { RootStackParamList } from "../../Navigation/types";
import { formatCurrency } from "../../constants/utils";
import { usePagination } from "../../hooks/usePagination";
import PaginationControls from "../../Components/PaginationControls";
import { MMKV } from "react-native-mmkv";
import { responsiveHeight, responsiveWidth } from "../../constants/helper";
import { API } from "../../constants/api";

type Product = {
    SO_St_Id?: string;
    Product_Name?: string;
    BrandGet?: string;
    Bill_Qty?: number;
    Total_Qty?: number;
    Item_Rate?: number;
    Final_Amo?: number;
    Created_on?: string;
    [k: string]: any;
};

interface ReportFilter {
    FilterLevel: number | string;
    filterType: number | string;
    columnName: string;
    isGroupFilter?: boolean;
}

interface Level2Column {
    Type: number;
    Column_Name: string;
    isGroupFilter: boolean;
}

const ITEMS_PER_PAGE = 15;

const SalesPendingItemWise = ({ route }: { route: any }) => {
    const branchIdProps = route.params?.branchId;
    const { typography, colors } = useTheme();
    const styles = getStyles(typography, colors);
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const storage = new MMKV();

    const today = new Date();
    const last30 = new Date();
    last30.setDate(today.getDate() - 30);

    const [fromDate, setFromDate] = React.useState(last30);
    const [toDate, setToDate] = React.useState(today);
    const [userId, setUserId] = React.useState("");
    const [branchId, setBranchId] = React.useState("");
    const [searchQuery, setSearchQuery] = React.useState("");
    const [modalVisible, setModalVisible] = React.useState(false);
    const [refreshing, setRefreshing] = React.useState(false);
    const [level2Columns, setLevel2Columns] = React.useState<{ Type: number; Column_Name: string; isGroupFilter: boolean; }[]>([]);
    const [selectedValuesByType, setSelectedValuesByType] = React.useState<Record<number, string>>({});
    const [activeTypeValuesWithTotals, setActiveTypeValuesWithTotals] = React.useState<{ value: string; total: number }[]>([]);
    const [secondLevelValues, setSecondLevelValues] = React.useState<{ value: string; total: number }[]>([]);
    const [externalFilterTemplate, setExternalFilterTemplate] = React.useState<any[] | null>(null);
    const [appliedDynamicFilters, setAppliedDynamicFilters] = React.useState<Record<string, string>>({});
    const [level2TypesOrder, setLevel2TypesOrder] = React.useState<number[]>([]);
    const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());
    const [storageLoaded, setStorageLoaded] = React.useState(false);

    const REPORT_NAME = "SalesReturn_Item";

    React.useEffect(() => {
        const uId = storage.getString("userId");
        const bId = storage.getString("branchId");
        if (uId) setUserId(uId);
        if (bId) setBranchId(bId);
        setStorageLoaded(true); // mark storage as ready
    }, []);

    // --- useQuery will now be enabled only after storage loaded ---
    const {
        data: saleOrder = [],
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ["saleorder", fromDate, toDate, appliedDynamicFilters, userId, branchIdProps],
        queryFn: () =>
            salesOrderPendingItemList(fromDate, toDate, userId, branchIdProps, appliedDynamicFilters),
        enabled: storageLoaded && !!userId && !!branchIdProps,
    });

    // --- Force refetch if userId or branchIdProps change ---
    React.useEffect(() => {
        if (storageLoaded && userId && branchIdProps) {
            refetch();
        }
    }, [storageLoaded, userId, branchIdProps, refetch]);

    const loadExternalFilters = React.useCallback(async () => {
        try {
            const res = await fetch(API.getReportFilters(REPORT_NAME));
            const json = await res.json();
            setExternalFilterTemplate(Array.isArray(json?.data) ? json.data : []);
        } catch (err) {
            console.error("Failed to load filters", err);
            setExternalFilterTemplate([]);
        }
    }, []);

    React.useEffect(() => {
        if (modalVisible) loadExternalFilters();
    }, [modalVisible, loadExternalFilters]);

    React.useEffect(() => {
        loadExternalFilters();
    }, [loadExternalFilters]);


    const normalizeColumnKey = (colName: string) => {
        if (!colName) return colName;
        const key = colName.toLowerCase().replace(/\s+/g, "");
        if (key.includes("brand")) return "BrandGet";
        if (key.includes("variant") || key.includes("size") || key.includes("pack")) return "Item_Variant_Name";
        if (key.includes("product") || key.includes("item")) return "Product_Name";
        return colName;
    };

    const matchesFilter = (obj: any, key: string, value: string): boolean => {
        if (!obj) return false;
        if (obj[key] === value) return true;
        return Object.values(obj).some((v: any) => Array.isArray(v) && v.some((item: any) => matchesFilter(item, key, value)));
    };

    const computeValuesWithTotals = (column: string, parent?: { column: string; value: string }) => {
        const map = new Map<string, number>();
        const key = normalizeColumnKey(column);

        const extract = (obj: any): string[] => {
            if (!obj) return [];
            let vals: string[] = [];
            if (obj[key]) vals.push(obj[key]);
            Object.values(obj).forEach(v => {
                if (Array.isArray(v)) v.forEach(x => vals.push(...extract(x)));
            });
            return vals;
        };

        saleOrder.forEach((order: any) => {
            if (parent) {
                const pKey = normalizeColumnKey(parent.column);
                if (!matchesFilter(order, pKey, parent.value)) return;
            }
            extract(order).forEach((v: string) => {
                if (!v) return;
                map.set(v, (map.get(v) || 0) + 1);
            });
        });

        return [...map.entries()].map(([value, total]) => ({ value, total }))
            .sort((a, b) => b.total - a.total);
    };

    React.useEffect(() => {
        (async () => {
            const res = await fetch(API.getReportFilters(REPORT_NAME));
            const json = await res.json();
            const lvl2 = (json?.data || [])
                .filter((x: any) => String(x.FilterLevel) === "2")
                .map((x: any) => ({
                    Type: Number(x.filterType),
                    Column_Name: x.columnName,
                    isGroupFilter: Boolean(x.isGroupFilter),
                }));
            setLevel2Columns(lvl2);
        })();
    }, []);

    React.useEffect(() => {
        const type4 = level2Columns.find(x => x.Type === 4);
        const type5 = level2Columns.find(x => x.Type === 5);

        if (!type4 || !saleOrder.length) return;

        setActiveTypeValuesWithTotals(computeValuesWithTotals(type4.Column_Name));

        if (selectedValuesByType[4] && type5) {
            setSecondLevelValues(computeValuesWithTotals(type5.Column_Name, {
                column: type4.Column_Name,
                value: selectedValuesByType[4],
            }));
        } else {
            setSecondLevelValues([]);
        }
    }, [saleOrder, selectedValuesByType[4], level2Columns]);

    const filteredOrders = React.useMemo(() => {
        if (!saleOrder || saleOrder.length === 0) return [];

        if (!appliedDynamicFilters || Object.keys(appliedDynamicFilters).length === 0) {
            return saleOrder; // <- show all initially
        }

        return saleOrder.filter((order: any) =>
            Object.entries(appliedDynamicFilters).every(([key, value]) => {
                const col = level2Columns.find(c => c.Column_Name === key);
                if (!col) return true;
                return matchesFilter(order, key, value);
            })
        );
    }, [saleOrder, appliedDynamicFilters, level2Columns]);

    const itemWiseData = React.useMemo(() => {
        const list: any[] = [];
        filteredOrders.forEach((order: any) => {
            order.Products_List?.forEach((product: Product) => {
                list.push({
                    ...product,
                    So_Inv_No: order.So_Inv_No,
                    Retailer_Name: order.Retailer_Name,
                    Sales_Person_Name: order.Sales_Person_Name,
                    Created_on: order.Created_on,
                    Branch_Name: order.Branch_Name,
                });
            });
        });
        return list;
    }, [filteredOrders]);

    const filteredItems = React.useMemo(() => {
        if (!searchQuery) return itemWiseData;
        return itemWiseData.filter((i: any) =>
            (i.Product_Name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (i.BrandGet || "").toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [itemWiseData, searchQuery]);

    const { currentData: displayData, currentPage, totalPages, totalItems, totalRecords, setCurrentPage } = usePagination({
        data: filteredItems,
        itemsPerPage: ITEMS_PER_PAGE,
    });

    const getGroupFilterColumn = React.useCallback(() => {
        const groupFilter = externalFilterTemplate?.find(
            (f: any) =>
                String(f.filterType) === "GROUP_FILTER" &&
                f.isGroupFilter === true
        );

        if (!groupFilter?.columnName) return "";

        const col = groupFilter.columnName.toLowerCase();

        if (col.includes("brand")) return "BrandGet";
        if (col.includes("bag")) return "Bag";
        if (col.includes("product") || col.includes("item")) return "Product_Name";

        return groupFilter.columnName;
    }, [externalFilterTemplate]);


    console.log("GROUP COLUMN:", getGroupFilterColumn());

    React.useEffect(() => {
        setCurrentPage(1);
        setExpandedGroups(new Set());
    }, [searchQuery, selectedValuesByType[4], getGroupFilterColumn, setCurrentPage]);


    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        try { await refetch(); } finally { setRefreshing(false); }
    }, [refetch]);

    const formatNumber = (n: number) =>
        Number(n || 0).toLocaleString("en-IN");

    const loadLevel2Filters = React.useCallback(async () => {
        try {
            const res = await fetch(API.getReportFilters("SalesReturn_Item"));
            const json = await res.json();

            const raw: ReportFilter[] = Array.isArray(json?.data)
                ? json.data
                : [];

            const lvl2: Level2Column[] = raw
                .filter(
                    (x) =>
                        String(x.FilterLevel) === "2" &&
                        x.filterType !== undefined
                )
                .map((x) => ({
                    Type: Number(x.filterType),
                    Column_Name: x.columnName,
                    isGroupFilter: Boolean(x.isGroupFilter),
                }))
                .filter((x) => !Number.isNaN(x.Type));

            const uniqTypes = Array.from(
                new Set<number>(lvl2.map((x) => x.Type))
            ).sort((a, b) => a - b);

            setLevel2Columns(lvl2);
            setLevel2TypesOrder(uniqTypes);
        } catch (e) {
            setLevel2Columns([]);
            setLevel2TypesOrder([]);
        }
    }, []);

    React.useEffect(() => {
        loadLevel2Filters();
    }, [loadLevel2Filters]);


    const groupedData = React.useMemo(() => {
        const groupColumn = getGroupFilterColumn();
        if (!groupColumn) return [];

        const map = new Map<string, any[]>();

        filteredItems.forEach((item: any) => {
            const key = item[groupColumn]?.trim() || "Others";

            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(item);
        });

        return Array.from(map.entries()).map(([groupName, items]) => ({
            groupName,
            items,
        }));
    }, [filteredItems, getGroupFilterColumn]);


    // ---------- Level2Filter Component ----------
    const Level2Filter = () => {
        const parentSelected = selectedValuesByType[4];

        return (
            <>
                {/* ================= TYPE 4 (PARENT) ================= */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.level2FilterContainer}
                >
                    <TouchableOpacity
                        style={[
                            styles.brandFilterButton,
                            !parentSelected && styles.brandFilterButtonActive,
                        ]}
                        onPress={() => setSelectedValuesByType({})}
                    >
                        <Text
                            style={[
                                styles.brandFilterText,
                                !parentSelected && styles.brandFilterTextActive,
                            ]}
                        >
                            All
                        </Text>
                    </TouchableOpacity>

                    {activeTypeValuesWithTotals.map(({ value, total }) => {
                        const selected = parentSelected === value;

                        return (
                            <TouchableOpacity
                                key={value}
                                style={[
                                    styles.brandFilterButton,
                                    selected && styles.brandFilterButtonActive,
                                ]}
                                onPress={() =>
                                    setSelectedValuesByType({ 4: value })
                                }
                            >
                                <Text
                                    style={[
                                        styles.brandFilterText,
                                        selected && styles.brandFilterTextActive,
                                    ]}
                                >
                                    {value} ({formatNumber(total)})
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* ================= TYPE 5 (CHILD) ================= */}
                {parentSelected && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={[styles.level2FilterContainer, { marginTop: 6 }]}
                    >
                        {/* ALL CHIP — ALWAYS VISIBLE */}
                        <TouchableOpacity
                            style={[
                                styles.brandFilterButton,
                                !selectedValuesByType[5] &&
                                styles.brandFilterButtonActive,
                            ]}
                            onPress={() =>
                                setSelectedValuesByType({ 4: parentSelected })
                            }
                        >
                            <Text
                                style={[
                                    styles.brandFilterText,
                                    !selectedValuesByType[5] &&
                                    styles.brandFilterTextActive,
                                ]}
                            >
                                All
                            </Text>
                        </TouchableOpacity>

                        {/* CHILD VALUES — ONLY IF EXISTS */}
                        {secondLevelValues.map(({ value, total }) => {
                            const selected = selectedValuesByType[5] === value;

                            return (
                                <TouchableOpacity
                                    key={value}
                                    style={[
                                        styles.brandFilterButton,
                                        selected &&
                                        styles.brandFilterButtonActive,
                                    ]}
                                    onPress={() =>
                                        setSelectedValuesByType({
                                            4: parentSelected,
                                            5: value,
                                        })
                                    }
                                >
                                    <Text
                                        style={[
                                            styles.brandFilterText,
                                            selected &&
                                            styles.brandFilterTextActive,
                                        ]}
                                    >
                                        {value} ({formatNumber(total)})
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}

            </>
        );
    };

    const toggleGroup = (groupName: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

        setExpandedGroups(prev => {
            const set = new Set(prev);
            set.has(groupName) ? set.delete(groupName) : set.add(groupName);
            return set;
        });
    };


    const ItemWiseCard = ({ item }: { item: any }) => (
        <View style={styles.cardContainer}>
            <View style={styles.singleRow}>
                <Text style={styles.itemName}>{item.Product_Name || "--"}</Text>
                <Text style={styles.qtyText}>Qty – {item.Total_Qty} Kgs</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Sales Pending - Items"
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
                showToDate
                title="Filter Options"
                enableDynamicFilter
                reportName={REPORT_NAME}
                expectedReportName={REPORT_NAME}
                externalFilters={externalFilterTemplate || undefined}
                onApply={(selectedFilters) => {
                    setAppliedDynamicFilters(selectedFilters || {});
                    setSelectedValuesByType({});
                    setModalVisible(false);
                }}
                onClose={() => setModalVisible(false)}
            />

            <ScrollView
                style={styles.scrollContainer}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
                }
                showsVerticalScrollIndicator={false}
            >
                <Level2Filter />

                <View style={styles.searchContainer}>
                    <Icon name="search" size={20} color={colors.textSecondary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by Products/Items..."
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery("")}>
                            <Icon name="clear" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>

                {groupedData.map(({ groupName, items }) => {
                    const isOpen = expandedGroups.has(groupName);

                    return (
                        <View key={groupName} style={styles.brandCard}>
                            <TouchableOpacity
                                style={styles.brandBadge}
                                onPress={() => toggleGroup(groupName)}
                                activeOpacity={0.8}
                            >
                                <View style={styles.brandHeader}>
                                    <View style={styles.brandTitle}>
                                        <Icon
                                            name="storefront"
                                            size={18}
                                            color={colors.text}
                                            style={{ marginRight: 8 }}
                                        />
                                        <Text style={styles.brandName}>{groupName}</Text>
                                    </View>

                                    <Icon
                                        name={isOpen ? "expand-less" : "expand-more"}
                                        size={20}
                                        color={colors.text}
                                    />
                                </View>

                                <Text style={styles.brandItemCount}>
                                    Items: {items.length}
                                </Text>
                            </TouchableOpacity>

                            {isOpen &&
                                items.map((item, idx) => (
                                    <ItemWiseCard
                                        key={`${groupName}-${idx}`}
                                        item={item}
                                    />
                                ))}
                        </View>
                    );
                })}

                {totalPages > 1 && (
                    <PaginationControls
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        totalRecords={totalRecords}
                        onPageChange={setCurrentPage}
                    />
                )}

                {!isLoading && !error && saleOrder.length === 0 && (
                    <View style={styles.noDataContainer}>
                        <Icon name="shopping-cart" size={48} color={colors.textSecondary} />
                        <Text style={styles.noDataText}>No Items found</Text>
                        <Text style={styles.noDataSubtext}> Please select a date range to view Sales Pending Items </Text>
                    </View>
                )}

                {!isLoading && !error && saleOrder.length > 0 && displayData.length === 0 && (
                    <View style={styles.noDataContainer}>
                        <Icon name="search-off" size={48} color={colors.textSecondary} />
                        <Text style={styles.noDataText}>No results found</Text>
                        <Text style={styles.noDataSubtext}> Try adjusting your search or filter criteria </Text>
                    </View>
                )}

            </ScrollView>
        </SafeAreaView>
    );
};

export default SalesPendingItemWise;

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
            color: colors.textSecondary,
        },
        orderAmount: {
            ...typography.body1,
            color: colors.success,
            fontWeight: "600",
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
        // Brand Filter
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
        toggleContainer: {
            flexDirection: "row",
            justifyContent: "center",
            marginVertical: 10,
        },
        toggleButton: {
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderWidth: 1,
            borderColor: colors.primary,
            borderRadius: 6,
            marginHorizontal: 5,
        },
        toggleButtonActive: {
            backgroundColor: colors.primary,
        },
        toggleText: {
            color: colors.primary,
            fontWeight: "600",
        },
        toggleTextActive: {
            color: colors.white,
        },

        // Item card
        itemCard: {
            backgroundColor: colors.cardBackground,
            padding: 12,
            marginVertical: 8,
            borderRadius: 8,
            elevation: 2,
        },
        itemProductName: {
            fontSize: 16,
            fontWeight: "700",
            color: colors.primary,
        },
        itemTop: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
        },
        itemBrand: {
            fontSize: 14,
            color: colors.textSecondary,
            marginBottom: 10,
        },
        itemRow: {
            flexDirection: "row",
            justifyContent: "space-between",
        },
        itemAmount: {
            fontWeight: "700",
            color: colors.success,
        },
        itemLeft: {
            width: "48%",
        },
        itemRight: {
            width: "48%",
        },
        itemLabel: {
            color: colors.textSecondary,
            fontSize: 12,
        },
        itemValue: {
            color: colors.textPrimary,
            fontWeight: "600",
            marginBottom: 6,
        },
        cardContainer: {
            backgroundColor: "#fff",
            borderRadius: 12,
            padding: 16,
            marginVertical: 8,
            marginHorizontal: 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.1,
            shadowRadius: 6,
            elevation: 5,
        },
        cardHeader: {
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 12,
        },
        productName: {
            fontSize: 16,
            fontWeight: "700",
            color: "#339e38ff",
        },
        amountContainer: {
            alignItems: "flex-end",
        },
        amount: {
            fontSize: 16,
            fontWeight: "700",
            color: "#1e88e5",
        },
        divider: {
            height: 1,
            backgroundColor: "#eee",
            marginVertical: 8,
        },
        detailsRow: {
            flexDirection: "row",
            justifyContent: "space-between",
        },
        detailsColumn: {
            flex: 1,
        },
        label: {
            fontSize: 12,
            color: "#999",
            marginTop: 4,
        },
        value: {
            fontSize: 14,
            fontWeight: "500",
            color: "#444",
            marginBottom: 4,
        },
        brandCard: {
            backgroundColor: "#fff",
            borderRadius: 12,
            marginBottom: 12,
            padding: 10,
        },

        brandHeaderTouchable: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },

        brandCount: {
            fontSize: 12,
            color: "#666",
        },
        brandBadge: {
            width: "100%",                // full width
            paddingVertical: responsiveHeight(2),
            paddingHorizontal: responsiveWidth(4),
            borderRadius: 12,
            backgroundColor: "#F9FAFB",
            borderWidth: 1,
            borderColor: "#E5E7EB",
        },

        brandBadgeActive: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },

        brandHeader: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
        },

        brandTitle: {
            flexDirection: "row",
            alignItems: "center",
            fontSize: 16,
            fontWeight: "600",
        },

        brandName: {
            fontSize: 16,
            fontWeight: "700",
            color: "#48693bff",
            marginTop: 2,
        },

        brandNameActive: {
            color: colors.white,
        },

        brandItemCount: {
            marginTop: 4,
            fontSize: 13,
            color: colors.textSecondary,
        },

        brandItemCountActive: {
            color: "rgba(255,255,255,0.85)",
        },
        singleRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },

        itemName: {
            fontSize: 16,
            fontWeight: "600",
            color: "#222",
        },

        qtyText: {
            fontSize: 14,
            fontWeight: "500",
            color: "#184fc7ff",
        },
        filterChip: {
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 20,
            backgroundColor: colors.backgroundSecondary,
            marginHorizontal: 6,
            marginVertical: 4,
        },
        filterChipActive: {
            backgroundColor: colors.primary,
        },
        filterChipText: {
            fontSize: 14,
            color: colors.text,
        },
        level2FilterContainer: {
            flexDirection: "row",
            paddingVertical: 8,
            paddingHorizontal: 5
        },


    });