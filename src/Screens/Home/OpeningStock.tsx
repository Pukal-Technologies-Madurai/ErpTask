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
import Icon from "react-native-vector-icons/MaterialIcons";
import AppHeader from "../../Components/AppHeader";
import DatePickerButton from "../../Components/DatePickerButton";
import { useTheme } from "../../Context/ThemeContext";
import { RootStackParamList } from "../../Navigation/types";
import { godownWiseStock, itemWiseStock } from "../../Api/OpeningStock";
import { responsiveWidth, responsiveHeight } from "../../constants/helper";
import { SafeAreaView } from "react-native-safe-area-context";

const OpeningStock = () => {
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { colors, typography } = useTheme();
    const styles = getStyles(typography, colors);

    const [fromDate, setFromDate] = React.useState<Date>(new Date());
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
                    <View style={styles.itemsList}>
                        {group.items.map((item: any, index: number) => (
                            <View
                                key={`${item.Product_Id}-${index}`}
                                style={styles.itemCard}>
                                {activeTab === "itemWise" ? (
                                    <ItemWiseRow item={item} />
                                ) : (
                                    <GodownWiseRow item={item} />
                                )}
                            </View>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    // Item Wise Row Component
    const ItemWiseRow = ({ item }: { item: any }) => (
        <View style={styles.itemContent}>
            <View style={styles.itemHeader}>
                <Text style={styles.itemName} numberOfLines={2}>
                    {item.stock_item_name}
                </Text>
                <Text
                    style={[
                        styles.balanceQty,
                        {
                            color:
                                item.Bal_Qty >= 0
                                    ? colors.primary
                                    : colors.accent,
                        },
                    ]}>
                    {formatNumber(item.Bal_Qty)}
                </Text>
            </View>

            <View style={styles.itemDetails}>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Group:</Text>
                    <Text
                        style={[styles.detailValue, { flex: 1 }]}
                        numberOfLines={2}>
                        {item.Group_Name}
                    </Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Opening:</Text>
                    <Text style={styles.detailValue}>{item.OB_Bal_Qty}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Purchase:</Text>
                    <Text style={styles.detailValue}>{item.Pur_Qty}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Sales:</Text>
                    <Text style={styles.detailValue}>{item.Sal_Qty}</Text>
                </View>
            </View>
        </View>
    );

    // Godown Wise Row Component
    const GodownWiseRow = ({ item }: { item: any }) => (
        <View style={styles.itemContent}>
            <View style={styles.itemHeader}>
                <Text style={styles.itemName} numberOfLines={2}>
                    {item.stock_item_name}
                </Text>
                <Text
                    style={[
                        styles.balanceQty,
                        {
                            color:
                                item.Bal_Qty >= 0
                                    ? colors.primary
                                    : colors.accent,
                        },
                    ]}>
                    {formatNumber(item.Bal_Qty)}
                </Text>
            </View>

            <View style={styles.godownInfo}>
                <View style={styles.godownHeader}>
                    <Icon name="store" size={16} color={colors.primary} />
                    <Text style={styles.godownName}>{item.Godown_Name}</Text>
                </View>
                <Text style={styles.productRate}>
                    Rate: ₹{item.Product_Rate}
                </Text>
            </View>

            <View style={styles.itemDetails}>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Opening:</Text>
                    <Text style={styles.detailValue}>{item.OB_Bal_Qty}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Purchase:</Text>
                    <Text style={styles.detailValue}>{item.Pur_Qty}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Sales:</Text>
                    <Text style={styles.detailValue}>{item.Sal_Qty}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Unit:</Text>
                    <Text style={styles.detailValue}>{item.Bag}</Text>
                </View>
            </View>
        </View>
    );

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

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <AppHeader
                title="Opening Stock"
                showDrawer={true}
                navigation={navigation}
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
                {/* Date Picker Section */}
                <View style={styles.datePickerContainer}>
                    <Text style={styles.sectionTitle}>Select Date Range</Text>
                    <View style={styles.datePickerRow}>
                        <DatePickerButton
                            title="From Date"
                            date={fromDate}
                            style={styles.datePicker}
                            containerStyle={styles.datePickerItem}
                            titleStyle={styles.datePickerTitle}
                            onDateChange={setFromDate}
                        />
                        <DatePickerButton
                            title="To Date"
                            date={toDate}
                            style={styles.datePicker}
                            containerStyle={styles.datePickerItem}
                            titleStyle={styles.datePickerTitle}
                            onDateChange={setToDate}
                        />
                    </View>
                </View>

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

        // Date Picker Section
        datePickerContainer: {
            padding: responsiveWidth(4),
            backgroundColor: colors.white,
            borderRadius: 12,
            margin: responsiveWidth(4),
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        sectionTitle: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "600",
            marginBottom: responsiveHeight(2),
        },
        datePickerRow: {
            flexDirection: "row",
            gap: responsiveWidth(3),
        },
        datePickerItem: {
            flex: 1,
        },
        datePickerTitle: {
            ...typography.body2,
            color: colors.text,
            marginBottom: 8,
        },
        datePicker: {
            backgroundColor: colors.primary + "20",
            padding: responsiveWidth(3),
            borderRadius: 8,
            alignItems: "center",
        },

        // Tab Container
        tabContainer: {
            flexDirection: "row",
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(4),
            marginBottom: responsiveWidth(4),
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
            borderLeftWidth: 3,
            borderLeftColor: colors.primary,
        },

        // Item Content
        itemContent: {
            padding: responsiveWidth(3),
        },
        itemHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: responsiveWidth(2),
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
            marginBottom: responsiveWidth(2),
            paddingVertical: responsiveWidth(1),
            paddingHorizontal: responsiveWidth(2),
            backgroundColor: colors.primary + "10",
            borderRadius: 6,
        },
        godownHeader: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(1),
        },
        godownName: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "600",
        },
        productRate: {
            ...typography.caption,
            color: colors.primary,
            fontWeight: "600",
        },

        // Item Details
        itemDetails: {
            gap: responsiveWidth(1),
        },
        detailRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        detailLabel: {
            ...typography.caption,
            color: colors.textSecondary,
            fontWeight: "500",
            minWidth: responsiveWidth(20),
        },
        detailValue: {
            ...typography.caption,
            color: colors.text,
            fontWeight: "600",
            textAlign: "right",
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
    });
