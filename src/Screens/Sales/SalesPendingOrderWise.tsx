import {
    Text,
    StyleSheet,
    View,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    TextInput,
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
import { salesOrderPendingList } from "../../Api/Sales";
import { RootStackParamList } from "../../Navigation/types";
import { formatCurrency, formatDate, formatTime } from "../../constants/utils";
import { usePagination } from "../../hooks/usePagination";
import PaginationControls from "../../Components/PaginationControls";
import { MMKV } from "react-native-mmkv";
import { responsiveWidth, responsiveHeight } from "../../constants/helper";
import { API } from "../../constants/api";

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

const SalesPendingOrderWise = ({ route }: { route: any }) => {
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
    const [selectedBrand, setSelectedBrand] = React.useState("");
    const [expandedOrders, setExpandedOrders] = React.useState<Set<string>>(new Set());
    const [modalVisible, setModalVisible] = React.useState(false);
    const [refreshing, setRefreshing] = React.useState(false);
    const [viewMode, setViewMode] = React.useState<"order">("order");
    const [externalFilterTemplate, setExternalFilterTemplate] = React.useState<any[] | null>(null);
    const [level2Columns, setLevel2Columns] = React.useState<Level2Column[]>([]);
    const [level2TypesOrder, setLevel2TypesOrder] = React.useState<number[]>([]);
    const [selectedValuesByType, setSelectedValuesByType] = React.useState<Record<number, string>>({});
    const [appliedDynamicFilters, setAppliedDynamicFilters] = React.useState<Record<string, string>>({});
    const [activeType, setActiveType] = React.useState<number | null>(null);
    const [activeTypeValuesWithTotals, setActiveTypeValuesWithTotals] = React.useState<{ value: string; total: number }[]>([]);
    const [secondLevelValues, setSecondLevelValues] = React.useState<{ value: string; total: number }[]>([]);


    const REPORT_NAME = "SalesReturn";

    React.useEffect(() => {
        const userId = storage.getString("userId");
        const branchId = storage.getString("branchId");
        if (userId) setUserId(userId);
        if (branchId) setBranchId(branchId);
    }, [branchId]);

    const {
        data: saleOrder = [],
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ["saleOrder", fromDate, toDate, appliedDynamicFilters],

        queryFn: () =>
            salesOrderPendingList(fromDate, toDate, userId, branchIdProps, appliedDynamicFilters),
        enabled: !!fromDate && !!toDate && !!userId && !!branchIdProps,
    });

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

    const normalizeColumnKey = (colName: string) => {
        if (!colName) return colName;

        const key = colName.toLowerCase().replace(/\s+/g, "");

        // TYPE-4
        if (key.includes("brand")) return "BrandGet";

        // TYPE-5 (VERY IMPORTANT)
        if (key.includes("variant")) return "Item_Variant_Name";
        if (key.includes("size")) return "Item_Variant_Name";
        if (key.includes("pack")) return "Item_Variant_Name";

        // PRODUCT
        if (key.includes("product")) return "Product_Name";
        if (key.includes("item")) return "Product_Name";
        if (key.includes("party_nature")) return "Party_Nature";
        if (key.includes("Party_Mailing_Address")) return "Party_Mailing_Address";

        return colName;
    };

    const matchesFilter = (obj: any, key: string, value: string): boolean => {
            if (!obj) return false;

            // Check at this level
            if (obj[key] === value) return true;

            // Check nested arrays
            return Object.values(obj).some((v: any) => {
                if (Array.isArray(v)) {
                    return v.some((item: any) => matchesFilter(item, key, value));
                }
                return false;
            });
        };

    const computeValuesWithTotals = (
        column: string,
        parent?: { column: string; value: string }
    ) => {
        const map = new Map<string, number>();
        const key = normalizeColumnKey(column);

        const extractValues = (obj: any): any[] => {
            let values: any[] = [];

            if (!obj) return values;

            // If key exists at this level
            if (obj.hasOwnProperty(key)) {
                values.push(obj[key]);
            }

            // Check nested arrays
            Object.values(obj).forEach((v: any) => {
                if (Array.isArray(v)) {
                    v.forEach((item: any) => {
                        values = values.concat(extractValues(item));
                    });
                }
            });

            return values;
        };


        saleOrder.forEach((order: any) => {
            let includeOrder = true;

            if (parent) {
                const parentKey = normalizeColumnKey(parent.column);
                includeOrder =
                    order[parentKey] === parent.value ||
                    (order.Products_List || []).some((p: any) => p[parentKey] === parent.value);
            }

            if (!includeOrder) return;

            const values = extractValues(order);
            values.forEach((val: any) => {
                if (!val) return;
                map.set(val, (map.get(val) || 0) + 1); 
            });
        });

        return [...map.entries()]
            .map(([value, total]) => ({ value, total }))
            .sort((a, b) => b.total - a.total);
    };


    React.useEffect(() => {
        if (!saleOrder.length) return;

        const type4Col = level2Columns.find(c => c.Type === 4);
        const type5Col = level2Columns.find(c => c.Type === 5);

        if (!type4Col) return;

        // ✅ TYPE-4 VALUES (ALWAYS)
        setActiveTypeValuesWithTotals(
            computeValuesWithTotals(type4Col.Column_Name)
        );

        // ✅ TYPE-5 VALUES (ONLY WHEN TYPE-4 SELECTED)
        if (selectedValuesByType[4] && type5Col) {
            setSecondLevelValues(
                computeValuesWithTotals(type5Col.Column_Name, {
                    column: type4Col.Column_Name,
                    value: selectedValuesByType[4],
                })
            );
        } else {
            setSecondLevelValues([]);
        }
    }, [saleOrder, selectedValuesByType[4]]);


    const formatNumber = (n: number) =>
        Number(n || 0).toLocaleString("en-IN");

    const loadLevel2Filters = React.useCallback(async () => {
        try {
            const res = await fetch(API.getReportFilters("SalesReturn"));
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

    React.useEffect(() => {
        if (level2TypesOrder.length > 0) {
            setActiveType(level2TypesOrder[0]);
        }
    }, [level2TypesOrder]);

    const filterMetaByColumn = React.useMemo(() => {
        const map: Record<string, ReportFilter> = {};
        (externalFilterTemplate || []).forEach((f: ReportFilter) => {
            map[f.columnName] = f;
        });
        return map;
    }, [externalFilterTemplate]);

    const flatItems = React.useMemo(() => {
        const rows: { order: any; item: any }[] = [];

        (saleOrder as any[]).forEach((order) => {
            // Push each product if exists
            order.Products_List?.forEach((product: any) => {
                rows.push({ order, item: product });
            });

            // Also push order-level data as a separate "item"
            rows.push({ order, item: order });
        });

        return rows;
    }, [saleOrder]);


    const flatProductsForFilter = React.useMemo(() => {
        const rows: any[] = [];
        (saleOrder as any[]).forEach((order) => {
            order.Products_List?.forEach((product: any) => {
                rows.push({ order, product });
            });
        });
        return rows;
    }, [saleOrder]);


    /* ---------- FILTER LOGIC (UNCHANGED) ---------- */
    const filteredOrders = React.useMemo(() => {
        let filtered = [...saleOrder];

        // SEARCH
        if (searchQuery.trim()) {
            filtered = filtered.filter((o: any) =>
                (
                    o.So_Inv_No +
                    o.Retailer_Name +
                    o.Sales_Person_Name +
                    o.Branch_Name
                ).toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // LEVEL2 FILTERS
        if (Object.keys(selectedValuesByType).length) {
            filtered = filtered.filter((order: any) =>
                Object.entries(selectedValuesByType).every(([type, val]) => {
                    const col = level2Columns.find(c => c.Type === Number(type));
                    if (!col) return true; // skip unknown type

                    const key = normalizeColumnKey(col.Column_Name);

                    return matchesFilter(order, key, val);
                })
            );
        }

        return filtered;
    }, [saleOrder, searchQuery, selectedValuesByType, level2TypesOrder, level2Columns]);

    const isTypeEnabled = (type: number) => {
        if (type === 4) return true;
        return Boolean(selectedValuesByType[4]);
    };

    const totalAmount = filteredOrders.reduce(
        (sum: number, o: any) => sum + (o.Total_Invoice_value || 0),
        0,
    );

    const {
        currentData: displayData,
        currentPage,
        totalPages,
        totalItems,
        totalRecords,
        setCurrentPage,
    } = usePagination({
        data: filteredOrders,
        itemsPerPage: ITEMS_PER_PAGE,
    });

    const toggleOrder = (id: string) => {
        const copy = new Set(expandedOrders);
        copy.has(id) ? copy.delete(id) : copy.add(id);
        setExpandedOrders(copy);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    const SummaryCards = () => (
        <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
                <Icon name="shopping-cart" size={24} color={colors.primary} />
                <Text style={styles.summaryValue}>{totalItems}</Text>
                <Text style={styles.summaryLabel}>Orders</Text>
            </View>
            <View style={styles.summaryCard}>
                <Icon name="currency-rupee" size={24} color={colors.success} />
                <Text style={styles.summaryValue}>
                    {formatCurrency(totalAmount).replace("₹", "")}
                </Text>
                <Text style={styles.summaryLabel}>Total Amount</Text>
            </View>
        </View>
    );

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

    /* ---------- ORDER CARD (ORIGINAL) ---------- */
    const SaleOrderCard = ({ order }: { order: any }) => {
        const isExpanded = expandedOrders.has(order.S_Id);

        const getFormattedDate = (dateString: string) => {
            try {
                const date = new Date(dateString);
                return formatDate(date);
            } catch (error) {
                return "--";
            }
        };

        return (
            <View style={styles.orderCard}>
                <TouchableOpacity
                    style={styles.orderHeader}
                    onPress={() => toggleOrder(order.S_Id)}
                    activeOpacity={0.7}>
                    <View style={styles.orderHeaderLeft}>
                        <View style={styles.orderTopRow}>
                            <View style={styles.orderNumberContainer}>
                                <Text style={styles.orderNumber}>
                                    {order.So_Inv_No}
                                </Text>
                                <View style={styles.dateTimeContainer}>
                                    <Icon
                                        name="event"
                                        size={12}
                                        color={colors.textSecondary}
                                        style={styles.dateTimeIcon}
                                    />
                                    <Text style={styles.orderDateTime}>
                                        {order.Created_on
                                            ? getFormattedDate(order.Created_on)
                                            : "--"}
                                    </Text>
                                    <Icon
                                        name="schedule"
                                        size={12}
                                        color={colors.textSecondary}
                                        style={styles.dateTimeIcon}
                                    />
                                    <Text style={styles.orderDateTime}>
                                        {order.Created_on
                                            ? formatTime(order.Created_on)
                                            : "--"}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.orderAmount}>
                                {formatCurrency(order.Total_Invoice_value)}
                            </Text>
                        </View>
                        <View style={styles.orderBottomRow}>
                            <View style={styles.retailerContainer}>
                                <Icon
                                    name="store"
                                    size={14}
                                    color={colors.primary}
                                    style={styles.bottomRowIcon}
                                />
                                <Text
                                    style={styles.retailerName}
                                    numberOfLines={2}>
                                    {order.Retailer_Name}
                                </Text>
                            </View>
                            <View style={styles.salesPersonContainer}>
                                <Icon
                                    name="person"
                                    size={14}
                                    color={colors.textSecondary}
                                    style={styles.bottomRowIcon}
                                />
                                <Text style={styles.salesPerson}>
                                    {order.Sales_Person_Name}
                                </Text>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>

                {isExpanded && (
                    <View style={styles.orderDetails}>
                        {/* Essential Order Info */}
                        <View style={styles.essentialInfo}>
                            <View style={styles.infoGrid}>
                                <View style={styles.infoItem}>
                                    <Icon
                                        name="business"
                                        size={16}
                                        color={colors.primary}
                                    />
                                    <View style={styles.infoContent}>
                                        <Text style={styles.infoLabel}>
                                            Branch
                                        </Text>
                                        <Text
                                            style={styles.infoValue}
                                            numberOfLines={1}>
                                            {order.Branch_Name}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.infoItem}>
                                    <Icon
                                        name="account-balance"
                                        size={16}
                                        color={colors.success}
                                    />
                                    <View style={styles.infoContent}>
                                        <Text style={styles.infoLabel}>
                                            Before Tax
                                        </Text>
                                        <Text style={styles.infoValue}>
                                            {formatCurrency(
                                                order.Total_Before_Tax,
                                            )}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.infoItem}>
                                    <Icon
                                        name="receipt"
                                        size={16}
                                        color={colors.warning}
                                    />
                                    <View style={styles.infoContent}>
                                        <Text style={styles.infoLabel}>
                                            Tax
                                        </Text>
                                        <Text style={styles.infoValue}>
                                            {formatCurrency(order.Total_Tax)}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Products Table */}
                        {order.Products_List && order.Products_List.length > 0 && (
                            <View style={styles.productsTable}>
                                <View style={styles.tableHeader}>
                                    <Text
                                        style={[
                                            styles.tableCell,
                                            styles.productNameCell,
                                        ]}>
                                        Product
                                    </Text>
                                    <Text style={styles.tableCell}>Qty</Text>
                                    <Text style={styles.tableCell}>Rate</Text>
                                    <Text style={styles.tableCell}>Amount</Text>
                                </View>
                                {order.Products_List.map(
                                    (product: any, index: number) => (
                                        <View key={index} style={styles.tableRow}>
                                            <Text
                                                style={[
                                                    styles.tableCell,
                                                    styles.productNameCell,
                                                ]}
                                                numberOfLines={4}>
                                                {product.Product_Name}
                                            </Text>
                                            <Text style={styles.tableCell}>
                                                {product.Bill_Qty ?? product.Total_Qty}
                                            </Text>
                                            <Text style={styles.tableCell}>
                                                {formatCurrency(
                                                    product.Item_Rate,
                                                ).replace("₹", "")}
                                            </Text>
                                            <Text style={styles.tableCell}>
                                                {formatCurrency(
                                                    product.Final_Amo,
                                                ).replace("₹", "")}
                                            </Text>
                                        </View>
                                    ),
                                )}
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    };

    const handleCloseModal = () => {
        setModalVisible(false);
    };

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Sales Pending - Orders"
                navigation={navigation}
                showRightIcon={true}
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
                    refetch();
                }}
                onClose={() => setModalVisible(false)}
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
                showsVerticalScrollIndicator={false}>
                {/* Loading State */}
                {isLoading && (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>Loading orders...</Text>
                    </View>
                )}

                {/* Error State */}
                {!isLoading && error && (
                    <View style={styles.errorContainer}>
                        <Icon name="error-outline" size={48} color={colors.accent} />
                        <Text style={styles.errorText}>Error loading orders</Text>
                        <Text style={styles.errorSubtext}>
                            {error.message || "Please try again later"}
                        </Text>
                        <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
                            <Icon name="refresh" size={20} color={colors.white} />
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Data Display */}
                {!isLoading && !error && (saleOrder as any[]).length > 0 && (
                    <>

                        {/* Summary Cards */}
                        <SummaryCards />

                        {/* LEVEL 2 FILTERS */}
                        <Level2Filter />

                        {/* Search Bar */}
                        <View style={styles.searchContainer}>
                            <Icon name="search" size={20} color={colors.textSecondary} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search by order number, retailer, sales person..."
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

                        {/* Results Info */}
                        <View style={styles.resultsContainer}>
                            <Text style={styles.resultsText}>
                                Showing {displayData.length} {viewMode === "order" ? "orders" : "items"} (
                                {totalItems} filtered, {totalRecords} total records)
                            </Text>
                        </View>

                        {/* List */}
                        {displayData.map((order: any) => (
                            <SaleOrderCard key={order.S_Id} order={order} />
                        ))}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <PaginationControls
                                currentPage={currentPage}
                                totalPages={totalPages}
                                totalItems={totalItems}
                                totalRecords={totalRecords}
                                onPageChange={setCurrentPage}
                            />
                        )}
                    </>
                )}

                {/* No Data State */}
                {!isLoading && !error && (saleOrder as any[]).length === 0 && (
                    <View style={styles.noDataContainer}>
                        <Icon name="shopping-cart" size={48} color={colors.textSecondary} />
                        <Text style={styles.noDataText}>No orders found</Text>
                        <Text style={styles.noDataSubtext}>
                            Please select a date range to view orders
                        </Text>
                    </View>
                )}

                {/* No Results State */}
                {!isLoading &&
                    !error &&
                    (saleOrder as any[]).length > 0 &&
                    displayData.length === 0 && (
                        <View style={styles.noDataContainer}>
                            <Icon name="search-off" size={48} color={colors.textSecondary} />
                            <Text style={styles.noDataText}>No results found</Text>
                            <Text style={styles.noDataSubtext}>
                                Try adjusting your search or filter criteria
                            </Text>
                        </View>
                    )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default SalesPendingOrderWise;

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
        brandName: {
            fontSize: 13,
            color: "#48693bff",
            marginTop: 2,
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
        level2FilterContainer: {
            flexDirection: "row",
            paddingVertical: 8,
            paddingHorizontal: 5
        },

    });