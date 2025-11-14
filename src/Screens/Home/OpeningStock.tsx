import React from "react";
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    TextInput,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useTheme } from "../../Context/ThemeContext";
import { RootStackParamList } from "../../Navigation/types";
import { godownWiseStock, itemWiseStock } from "../../Api/OpeningStock";
import { responsiveWidth, responsiveHeight } from "../../constants/helper";
import AppHeader from "../../Components/AppHeader";
import FilterModal from "../../Components/FilterModal";

const OpeningStock = () => {
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { colors, typography } = useTheme();
    const styles = getStyles(typography, colors);

    const [fromDate, setFromDate] = React.useState<Date>(new Date());
    const [modalVisible, setModalVisible] = React.useState(false);

    const [toDate, setToDate] = React.useState<Date>(new Date());
    const [activeTab, setActiveTab] = React.useState<"itemWise" | "godownWise">(
        "itemWise",
    );
    const [searchQuery, setSearchQuery] = React.useState("");
    const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
        new Set(),
    );
    const [currentPage, setCurrentPage] = React.useState(1);
    const [refreshing, setRefreshing] = React.useState(false);
    const [sortBy, setSortBy] = React.useState<"name" | "count" | "balance">(
        "name",
    );
    const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");

    const ITEMS_PER_PAGE = 20;

    const {
        data: itemWiseStockData = [],
        isLoading: isItemWiseLoading,
        error: itemWiseError,
        refetch: refetchItemWise,
    } = useQuery({
        queryKey: ["itemWiseStock", fromDate, toDate],
        queryFn: () => itemWiseStock(fromDate, toDate),
        enabled: !!fromDate && !!toDate,
    });

    const {
        data: goDownWiseStockData = [],
        isLoading: isGodownWiseLoading,
        error: godownWiseError,
        refetch: refetchGodownWise,
    } = useQuery({
        queryKey: ["godownWiseStock", fromDate, toDate],
        queryFn: () => godownWiseStock(fromDate, toDate),
        enabled: !!fromDate && !!toDate,
    });

    const isLoading =
        activeTab === "itemWise" ? isItemWiseLoading : isGodownWiseLoading;
    const currentError =
        activeTab === "itemWise" ? itemWiseError : godownWiseError;

    // Group data by Stock_Group or Godown_Name based on active tab
    const groupDataByStockGroup = (data: any[]) => {
        const grouped = data.reduce((acc: any, item: any) => {
            // For godown-wise view, group by Godown_Name, otherwise by Stock_Group
            const group =
                activeTab === "godownWise"
                    ? item.Godown_Name || "Unknown Godown"
                    : item.Stock_Group || "Others";
            if (!acc[group]) {
                acc[group] = [];
            }
            acc[group].push(item);
            return acc;
        }, {});

        // Convert to array and sort based on selected criteria
        const groupArray = Object.keys(grouped).map(group => ({
            groupName: group,
            items: grouped[group],
            count: grouped[group].length,
            totalBalance: grouped[group].reduce(
                (sum: number, item: any) => sum + (item.Bal_Qty || 0),
                0,
            ),
        }));

        // Sort groups
        return groupArray.sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case "name":
                    comparison = a.groupName.localeCompare(b.groupName);
                    break;
                case "count":
                    comparison = a.count - b.count;
                    break;
                case "balance":
                    comparison = a.totalBalance - b.totalBalance;
                    break;
            }
            return sortOrder === "asc" ? comparison : -comparison;
        });
    };

    // Filter data based on search query
    const filterData = (data: any[]) => {
        if (!searchQuery.trim()) return data;

        return data.filter(
            group =>
                group.groupName
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase()) ||
                group.items.some(
                    (item: any) =>
                        item.stock_item_name
                            ?.toLowerCase()
                            .includes(searchQuery.toLowerCase()) ||
                        (activeTab === "godownWise" &&
                            item.Godown_Name?.toLowerCase().includes(
                                searchQuery.toLowerCase(),
                            )) ||
                        (activeTab === "itemWise" &&
                            item.Group_Name?.toLowerCase().includes(
                                searchQuery.toLowerCase(),
                            )),
                ),
        );
    };

    // Get current data based on active tab
    const getCurrentData = () => {
        const rawData =
            activeTab === "itemWise" ? itemWiseStockData : goDownWiseStockData;
        const groupedData = groupDataByStockGroup(rawData);
        const filteredData = filterData(groupedData);

        // Pagination
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const paginatedData = filteredData.slice(startIndex, endIndex);

        return {
            data: paginatedData,
            totalPages: Math.ceil(filteredData.length / ITEMS_PER_PAGE),
            totalItems: filteredData.length,
            totalRecords: rawData.length,
        };
    };

    const {
        data: displayData,
        totalPages,
        totalItems,
        totalRecords,
    } = getCurrentData();

    // Toggle group expansion
    const toggleGroup = (groupName: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(groupName)) {
            newExpanded.delete(groupName);
        } else {
            newExpanded.add(groupName);
        }
        setExpandedGroups(newExpanded);
    };

    // Handle refresh
    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        try {
            if (activeTab === "itemWise") {
                await refetchItemWise();
            } else {
                await refetchGodownWise();
            }
        } finally {
            setRefreshing(false);
        }
    }, [activeTab, refetchItemWise, refetchGodownWise]);

    // Reset pagination when changing tabs, search, or sort
    React.useEffect(() => {
        setCurrentPage(1);
        setExpandedGroups(new Set());
    }, [activeTab, searchQuery, sortBy, sortOrder]);

    // Format number for display
    const formatNumber = (num: number) => {
        if (Math.abs(num) >= 10000000)
            return `${(num / 10000000).toFixed(1)}Cr`;
        if (Math.abs(num) >= 100000) return `${(num / 100000).toFixed(1)}L`;
        if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    // Stock Group Card Component
    const StockGroupCard = ({ group }: { group: any }) => {
        const isExpanded = expandedGroups.has(group.groupName);

        return (
            <View style={styles.groupCard}>
                <TouchableOpacity
                    style={styles.groupHeader}
                    onPress={() => toggleGroup(group.groupName)}
                    activeOpacity={0.7}>
                    <View style={styles.groupHeaderLeft}>
                        <View style={styles.groupNameContainer}>
                            <Icon
                                name={
                                    activeTab === "godownWise"
                                        ? "store"
                                        : "category"
                                }
                                size={18}
                                color={colors.primary}
                            />
                            <Text style={styles.groupName}>
                                {group.groupName}
                            </Text>
                        </View>
                        <View style={styles.groupStats}>
                            <Text style={styles.groupCount}>
                                Items: {group.count}
                            </Text>
                            <Text
                                style={[
                                    styles.groupBalance,
                                    {
                                        color:
                                            group.totalBalance >= 0
                                                ? colors.primary
                                                : colors.accent,
                                    },
                                ]}>
                                Balance: {formatNumber(group.totalBalance)}
                            </Text>
                        </View>
                    </View>
                    <Icon
                        name={isExpanded ? "expand-less" : "expand-more"}
                        size={24}
                        color={colors.textSecondary}
                    />
                </TouchableOpacity>

                {isExpanded && (
                    <View style={{ marginTop: 5 }}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View>

                                {/* ✅ Show table header based on active tab */}
                                {activeTab === "itemWise" ? (
                                    <ItemWiseHeader />
                                ) : (
                                    <GodownWiseHeader />
                                )}

                                {/* ✅ List rows */}
                                {group.items.map((item: any, index: number) => (
                                    <View key={`${item.Product_Id}-${index}`} style={styles.itemCard}>
                                        {activeTab === "itemWise" ? (
                                            <ItemWiseRow item={item} />
                                        ) : (
                                            <GodownWiseRow item={item} />
                                        )}
                                    </View>
                                ))}

                            </View>
                        </ScrollView>
                    </View>
                )}
            </View>
        );
    };

    // Item Wise Row Component
    const ItemWiseHeader = () => {
        const COL_WIDTH = 90;
        return (
            <View style={[styles.tableRow, { backgroundColor: "#eee", paddingVertical: 6 }]}>
                <Text style={[styles.rowCell, { width: COL_WIDTH * 2, fontWeight: "bold" }]}>Name</Text>
                <Text style={[styles.rowCell, { width: COL_WIDTH, fontWeight: "bold" }]}>OB</Text>
                <Text style={[styles.rowCell, { width: COL_WIDTH, fontWeight: "bold" }]}>Cls</Text>
                <Text style={[styles.rowCell, { width: COL_WIDTH, fontWeight: "bold" }]}>In</Text>
                <Text style={[styles.rowCell, { width: COL_WIDTH, fontWeight: "bold" }]}>Out</Text>
            </View>
        );
    };

    const ItemWiseRow = ({ item }: { item: any }) => {
        const COL_WIDTH = 90;

        return (
            <View style={styles.tableRow}>
                <Text
                    style={[styles.rowCell, { width: COL_WIDTH * 2 }]}
                    numberOfLines={2}
                >
                    {item.stock_item_name}
                </Text>

                <Text style={[styles.rowCell, { width: COL_WIDTH }]}>
                    {item.OB_Act_Qty}
                </Text>

                <Text
                    style={[
                        styles.rowCell,
                        {
                            width: COL_WIDTH,
                            color: item.Bal_Act_Qty >= 0 ? colors.primary : colors.accent
                        }
                    ]}
                >
                    {item.Bal_Act_Qty}
                </Text>

                <Text style={[styles.rowCell, { width: COL_WIDTH }]}>
                    {item.Pur_Qty}
                </Text>

                <Text style={[styles.rowCell, { width: COL_WIDTH }]}>
                    {item.Sal_Qty}
                </Text>
            </View>
        );
    };


    // Godown Wise Row Component
    const GodownWiseHeader = () => {
        const COL_WIDTH = 90;
        return (
            <View style={[styles.tableRow, { backgroundColor: "#eee", paddingVertical: 6 }]}>
                <Text style={[styles.rowCell, { width: COL_WIDTH * 2, fontWeight: "bold" }]}>Name</Text>
                <Text style={[styles.rowCell, { width: COL_WIDTH, fontWeight: "bold" }]}>OB</Text>
                <Text style={[styles.rowCell, { width: COL_WIDTH, fontWeight: "bold" }]}>Cls</Text>
                <Text style={[styles.rowCell, { width: COL_WIDTH, fontWeight: "bold" }]}>In</Text>
                <Text style={[styles.rowCell, { width: COL_WIDTH, fontWeight: "bold" }]}>Out</Text>
                <Text style={[styles.rowCell, { width: COL_WIDTH, fontWeight: "bold" }]}>Unit</Text>
            </View>
        );
    };

    const GodownWiseRow = ({ item }: { item: any }) => {
        const COL_WIDTH = 90;

        return (
            <View style={styles.tableRow}>
                <Text
                    style={[styles.rowCell, { width: COL_WIDTH * 2 }]}
                    numberOfLines={2}
                >
                    {item.stock_item_name}
                </Text>

                <Text style={[styles.rowCell, { width: COL_WIDTH }]}>
                    {item.OB_Bal_Qty}
                </Text>

                <Text
                    style={[
                        styles.rowCell,
                        {
                            width: COL_WIDTH,
                            color: item.Act_Bal_Qty >= 0 ? colors.primary : colors.accent,
                        },
                    ]}
                >
                    {item.Act_Bal_Qty}
                </Text>

                <Text style={[styles.rowCell, { width: COL_WIDTH }]}>
                    {item.Pur_Qty}
                </Text>

                <Text style={[styles.rowCell, { width: COL_WIDTH }]}>
                    {item.Sal_Qty}
                </Text>

                <Text style={[styles.rowCell, { width: COL_WIDTH }]}>
                    {item.Bag}
                </Text>
            </View>
        );
    };

    // Pagination Component
    const PaginationControls = () => (
        <View style={styles.paginationContainer}>
            <TouchableOpacity
                style={[
                    styles.pageButton,
                    currentPage === 1 && styles.pageButtonDisabled,
                ]}
                onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}>
                <Icon
                    name="chevron-left"
                    size={20}
                    color={
                        currentPage === 1
                            ? colors.textSecondary
                            : colors.primary
                    }
                />
            </TouchableOpacity>

            <Text style={styles.pageInfo}>
                Page {currentPage} of {totalPages} ({totalItems}{" "}
                {activeTab === "godownWise" ? "godowns" : "groups"},{" "}
                {totalRecords} total records)
            </Text>

            <TouchableOpacity
                style={[
                    styles.pageButton,
                    currentPage === totalPages && styles.pageButtonDisabled,
                ]}
                onPress={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}>
                <Icon
                    name="chevron-right"
                    size={20}
                    color={
                        currentPage === totalPages
                            ? colors.textSecondary
                            : colors.primary
                    }
                />
            </TouchableOpacity>
        </View>
    );

    const handleCloseModal = () => {
        setModalVisible(false);
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <AppHeader
                title="Stock in Hand"
                showDrawer={true}
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
                onApply={() => setModalVisible(false)}
                onClose={handleCloseModal}
                showToDate={true}
                title="Filter Options"
                fromLabel="From Date"
                toLabel="To Date"
                brand={true}
            />

            <ScrollView
                style={styles.contentContainer}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                        tintColor={colors.primary}
                    />
                }
                showsVerticalScrollIndicator={false}>
                {/* Tab Switcher */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[
                            styles.tab,
                            activeTab === "itemWise" && styles.activeTab,
                        ]}
                        onPress={() => setActiveTab("itemWise")}>
                        <Icon
                            name="inventory"
                            size={20}
                            color={
                                activeTab === "itemWise"
                                    ? colors.white
                                    : colors.textSecondary
                            }
                        />
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === "itemWise" &&
                                styles.activeTabText,
                            ]}>
                            Item Wise
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.tab,
                            activeTab === "godownWise" && styles.activeTab,
                        ]}
                        onPress={() => setActiveTab("godownWise")}>
                        <Icon
                            name="store"
                            size={20}
                            color={
                                activeTab === "godownWise"
                                    ? colors.white
                                    : colors.textSecondary
                            }
                        />
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === "godownWise" &&
                                styles.activeTabText,
                            ]}>
                            Godown Wise
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Icon
                        name="search"
                        size={20}
                        color={colors.textSecondary}
                    />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={
                            activeTab === "godownWise"
                                ? "Search by godown or item name..."
                                : "Search by group or item name..."
                        }
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery("")}>
                            <Icon
                                name="clear"
                                size={20}
                                color={colors.textSecondary}
                            />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Sort Controls */}
                <View style={styles.sortContainer}>
                    <View style={styles.sortButtons}>
                        <TouchableOpacity
                            style={[
                                styles.sortButton,
                                sortBy === "name" && styles.sortButtonActive,
                            ]}
                            onPress={() => {
                                if (sortBy === "name") {
                                    setSortOrder(prev =>
                                        prev === "asc" ? "desc" : "asc",
                                    );
                                } else {
                                    setSortBy("name");
                                    setSortOrder("asc");
                                }
                            }}>
                            <Icon
                                name={
                                    sortBy === "name" && sortOrder === "desc"
                                        ? "arrow-downward"
                                        : "arrow-upward"
                                }
                                size={16}
                                color={
                                    sortBy === "name"
                                        ? colors.white
                                        : colors.text
                                }
                            />
                            <Text
                                style={[
                                    styles.sortButtonText,
                                    sortBy === "name" &&
                                    styles.sortButtonTextActive,
                                ]}>
                                Name
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.sortButton,
                                sortBy === "count" && styles.sortButtonActive,
                            ]}
                            onPress={() => {
                                if (sortBy === "count") {
                                    setSortOrder(prev =>
                                        prev === "asc" ? "desc" : "asc",
                                    );
                                } else {
                                    setSortBy("count");
                                    setSortOrder("desc");
                                }
                            }}>
                            <Icon
                                name={
                                    sortBy === "count" && sortOrder === "desc"
                                        ? "arrow-downward"
                                        : "arrow-upward"
                                }
                                size={16}
                                color={
                                    sortBy === "count"
                                        ? colors.white
                                        : colors.text
                                }
                            />
                            <Text
                                style={[
                                    styles.sortButtonText,
                                    sortBy === "count" &&
                                    styles.sortButtonTextActive,
                                ]}>
                                Count
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.sortButton,
                                sortBy === "balance" && styles.sortButtonActive,
                            ]}
                            onPress={() => {
                                if (sortBy === "balance") {
                                    setSortOrder(prev =>
                                        prev === "asc" ? "desc" : "asc",
                                    );
                                } else {
                                    setSortBy("balance");
                                    setSortOrder("desc");
                                }
                            }}>
                            <Icon
                                name={
                                    sortBy === "balance" && sortOrder === "desc"
                                        ? "arrow-downward"
                                        : "arrow-upward"
                                }
                                size={16}
                                color={
                                    sortBy === "balance"
                                        ? colors.white
                                        : colors.text
                                }
                            />
                            <Text
                                style={[
                                    styles.sortButtonText,
                                    sortBy === "balance" &&
                                    styles.sortButtonTextActive,
                                ]}>
                                Balance
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Loading State */}
                {isLoading && (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>
                            Loading stock data...
                        </Text>
                    </View>
                )}

                {/* Error State */}
                {!isLoading && currentError && (
                    <View style={styles.errorContainer}>
                        <Icon
                            name="error-outline"
                            size={48}
                            color={colors.accent}
                        />
                        <Text style={styles.errorText}>
                            Error loading stock data
                        </Text>
                        <Text style={styles.errorSubtext}>
                            {currentError.message || "Please try again later"}
                        </Text>
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={onRefresh}>
                            <Icon
                                name="refresh"
                                size={20}
                                color={colors.white}
                            />
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Data Display */}
                {!isLoading && !currentError && displayData.length > 0 && (
                    <>
                        {/* Summary Info */}
                        <View style={styles.summaryContainer}>
                            <Text style={styles.summaryText}>
                                Showing {displayData.length}{" "}
                                {activeTab === "godownWise"
                                    ? "godowns"
                                    : "groups"}{" "}
                                ({totalItems} total{" "}
                                {activeTab === "godownWise"
                                    ? "godowns"
                                    : "groups"}
                                , {totalRecords} total records)
                            </Text>
                        </View>

                        {/* Stock Groups */}
                        {displayData.map((group, index) => (
                            <StockGroupCard
                                key={group.groupName}
                                group={group}
                            />
                        ))}

                        {/* Pagination */}
                        {totalPages > 1 && <PaginationControls />}
                    </>
                )}

                {/* No Data State */}
                {!isLoading && !currentError && displayData.length === 0 && (
                    <View style={styles.noDataContainer}>
                        <Icon
                            name="inventory"
                            size={48}
                            color={colors.textSecondary}
                        />
                        <Text style={styles.noDataText}>
                            No stock data found
                        </Text>
                        <Text style={styles.noDataSubtext}>
                            {searchQuery
                                ? "Try adjusting your search terms"
                                : "Please select a date range to view data"}
                        </Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default OpeningStock;

const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.primary,
        },
        contentContainer: {
            backgroundColor: colors.background,
        },

        // Tab Container
        tabContainer: {
            flexDirection: "row",
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(4),
            marginVertical: responsiveWidth(4),
            borderRadius: 12,
            padding: 4,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        tab: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: responsiveWidth(3),
            borderRadius: 8,
            gap: responsiveWidth(2),
        },
        activeTab: {
            backgroundColor: colors.primary,
        },
        tabText: {
            ...typography.body1,
            color: colors.textSecondary,
            fontWeight: "500",
        },
        activeTabText: {
            color: colors.white,
            fontWeight: "600",
        },

        // Search Container
        searchContainer: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(4),
            marginBottom: responsiveWidth(4),
            borderRadius: 12,
            paddingHorizontal: responsiveWidth(4),
            paddingVertical: responsiveWidth(2),
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
            gap: responsiveWidth(2),
        },
        searchInput: {
            flex: 1,
            ...typography.body1,
            color: colors.text,
            paddingVertical: responsiveWidth(2),
        },

        // Loading & Summary
        loadingContainer: {
            alignItems: "center",
            justifyContent: "center",
            padding: responsiveHeight(8),
        },
        loadingText: {
            ...typography.body1,
            color: colors.textSecondary,
        },
        summaryContainer: {
            paddingHorizontal: responsiveWidth(4),
            marginBottom: responsiveWidth(2),
        },
        summaryText: {
            ...typography.caption,
            color: colors.textSecondary,
            textAlign: "center",
        },

        // Group Card
        groupCard: {
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(4),
            marginBottom: responsiveWidth(3),
            borderRadius: 12,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
            overflow: "hidden",
        },
        groupHeader: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: responsiveWidth(4),
            backgroundColor: colors.primary + "10",
        },
        groupHeaderLeft: {
            flex: 1,
        },
        groupNameContainer: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(2),
            marginBottom: responsiveWidth(1),
        },
        groupName: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "700",
            flex: 1,
        },
        groupStats: {
            flexDirection: "row",
            gap: responsiveWidth(4),
        },
        groupCount: {
            ...typography.caption,
            color: colors.textSecondary,
            fontWeight: "500",
        },
        groupBalance: {
            ...typography.caption,
            fontWeight: "600",
        },

        // Items List
        itemsList: {
            paddingHorizontal: responsiveWidth(2),
            paddingBottom: responsiveWidth(2),
        },
        itemCard: {
            backgroundColor: colors.background,
            marginHorizontal: responsiveWidth(2),
            marginVertical: responsiveWidth(1),
            borderRadius: 8,
            borderLeftWidth: 1,
            borderRightWidth:1,
            borderLeftColor: colors.primary,
            borderRightColor: colors.primary,
        },

        // Item Content
        itemContent: {
            backgroundColor: colors.surface,
            borderRadius: 8,
            overflow: "hidden",
        },
        itemHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: responsiveWidth(3),
            backgroundColor: colors.white,
            borderBottomWidth: 1,
            borderBottomColor: colors.grey100,
        },
        itemName: {
            ...typography.body1,
            color: colors.text,
            fontWeight: "600",
            flex: 1,
            marginRight: responsiveWidth(2),
        },
        balanceQty: {
            ...typography.h6,
            fontWeight: "700",
            minWidth: responsiveWidth(15),
            textAlign: "right",
        },

        // Godown Info
        godownInfo: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingVertical: responsiveWidth(2),
            paddingHorizontal: responsiveWidth(3),
            backgroundColor: colors.primary + "08",
            borderBottomWidth: 1,
            borderBottomColor: colors.primary + "15",
        },
        godownHeader: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(2),
        },
        godownName: {
            ...typography.subtitle1,
            color: colors.text,
            fontWeight: "600",
            marginLeft: 6,
            fontSize: 14,
        },
        productRate: {
            ...typography.subtitle2,
            color: colors.primary,
            fontWeight: "600",
            backgroundColor: colors.primary + "10",
            paddingHorizontal: responsiveWidth(2),
            paddingVertical: responsiveWidth(0.5),
            borderRadius: 4,
        },

        // Item Details
        itemDetails: {
            padding: responsiveWidth(3),
            backgroundColor: colors.grey50,
        },
        detailRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingVertical: responsiveWidth(1),
        },
        detailLabel: {
            ...typography.body2,
            color: colors.textSecondary,
            fontWeight: "500",
            minWidth: responsiveWidth(20),
        },
        detailValue: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "600",
            textAlign: "right",
            flex: 1,
        },

        // Pagination
        paginationContainer: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: responsiveWidth(4),
            paddingVertical: responsiveWidth(4),
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(4),
            marginVertical: responsiveWidth(2),
            borderRadius: 12,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        pageButton: {
            padding: responsiveWidth(2),
            borderRadius: 6,
        },
        pageButtonDisabled: {
            opacity: 0.5,
        },
        pageInfo: {
            ...typography.caption,
            color: colors.textSecondary,
            textAlign: "center",
            flex: 1,
        },

        // Sort Controls
        sortContainer: {
            paddingHorizontal: responsiveWidth(4),
            paddingVertical: responsiveWidth(2),
            backgroundColor: colors.white,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderColor,
        },
        sortButtons: {
            flexDirection: "row",
            gap: responsiveWidth(2),
        },
        sortButton: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            padding: responsiveWidth(2),
            borderRadius: 6,
            backgroundColor: colors.surface,
            gap: responsiveWidth(1),
        },
        sortButtonActive: {
            backgroundColor: colors.primary,
        },
        sortButtonText: {
            ...typography.caption,
            color: colors.text,
            fontWeight: "500",
        },
        sortButtonTextActive: {
            color: colors.white,
            fontWeight: "600",
        },

        // No Data State
        noDataContainer: {
            alignItems: "center",
            justifyContent: "center",
            padding: responsiveHeight(8),
            gap: responsiveWidth(2),
        },
        noDataText: {
            ...typography.h6,
            color: colors.textSecondary,
            textAlign: "center",
        },
        noDataSubtext: {
            ...typography.body2,
            color: colors.textSecondary,
            textAlign: "center",
        },

        // Error State
        errorContainer: {
            alignItems: "center",
            justifyContent: "center",
            padding: responsiveHeight(8),
            gap: responsiveWidth(3),
        },
        errorText: {
            ...typography.h6,
            color: colors.accent,
            textAlign: "center",
            fontWeight: "600",
        },
        errorSubtext: {
            ...typography.body2,
            color: colors.textSecondary,
            textAlign: "center",
        },
        retryButton: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primary,
            paddingHorizontal: responsiveWidth(6),
            paddingVertical: responsiveWidth(3),
            borderRadius: 8,
            gap: responsiveWidth(2),
            marginTop: responsiveWidth(2),
        },
        retryButtonText: {
            ...typography.body1,
            color: colors.white,
            fontWeight: "600",
        },
        tableHeader: {
            flexDirection: "row",
            paddingVertical: 6,
            borderBottomWidth: 1,
            borderColor: "#ddd",
            backgroundColor: "#f1f1f1",
        },

        tableRow: {
            flexDirection: "row",
            paddingVertical: 8,
            alignItems: "center",
            borderBottomWidth: 0.7,
            borderColor: "#e2e2e2",
        },

        headerText: {
            flex: 1,
            fontSize: 13,
            fontWeight: "700",
            textAlign: "center",
            color: "#444",
        },

        rowText: {
            flex: 1,
            fontSize: 13,
            fontWeight: "600",
            textAlign: "center",
            color: "#000",
        },
        tableWrapper: {
            marginBottom: 8,
            borderWidth: 1,
            borderColor: "#ccc",
            borderRadius: 6,
            overflow: "hidden"
        },

        headerCell: {
            flex: 1,
            paddingVertical: 8,
            paddingHorizontal: 6,
            borderRightWidth: 1,
            borderColor: "#ccc",
            textAlign: "center",
            fontWeight: "700",
            fontSize: 13,
            color: "#333",
        },

        rowCell: {
            flex: 1,
            paddingVertical: 8,
            paddingHorizontal: 6,
            borderRightWidth: 1,
            borderColor: "#ddd",
            textAlign: "center",
            fontSize: 13,
            fontWeight: "600",
            color: "#000"
        },
        godownHeaderContainer: {
            padding: 6,
            backgroundColor: "#eef7ff",
            borderBottomWidth: 1,
            borderColor: "#d0dce7",
        },

        godownTitleRow: {
            flexDirection: "row",
            alignItems: "center",
        },
        godownRate: {
            fontSize: 13,
            fontWeight: "600",
            marginTop: 2,
        },
    });
