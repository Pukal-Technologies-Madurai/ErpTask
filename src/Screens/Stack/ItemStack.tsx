import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
} from "react-native";
import { useTheme } from "../../Context/ThemeContext";
import React from "react";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";
import AppHeader from "../../Components/AppHeader";
import FilterModal from "../../Components/FilterModal";
import { itemStockInfo } from "../../Api/OpeningStock";
import { RootStackParamList } from "../../Navigation/types";
import { responsiveHeight, responsiveWidth } from "../../constants/helper";

// Interface for the stock item data
interface StockItem {
    Item_Group_Id: string;
    Group_Name: string;
    Trans_Date: string;
    OB_Bal_Qty: number;
    OB_Rate: number;
    OB_Value: number;
    Pur_Qty: number;
    Pur_Rate: number;
    Pur_value: number;
    Adj_Pur_Qty: number;
    Adj_Pur_Rate: number;
    Adj_Pur_value: number;
    IN_Qty: number;
    IN_Rate: number;
    IN_Value: number;
    Sal_Qty: number;
    Sal_Rate: number;
    Sal_value: number;
    Adj_Sal_Qty: number;
    Adj_Sal_Rate: number;
    Adj_Sal_value: number;
    OUT_Qty: number;
    Out_Rate: number;
    Out_Value: number;
    Expense_value: number;
    Act_Expense: number;
    Bal_Qty: number;
    CL_Rate: number;
    CL_Value: number;
    CR_CL_Rate: number;
    Pre_Qty: number;
    Pre_Rate: number;
    Pre_CL_Value: number;
    Brand: string;
    Group_ST: string;
    Stock_Group: string;
    S_Sub_Group_1: string;
    Grade_Item_Group: string;
}

// Interface for grouped data
interface GroupedData {
    groupName: string;
    totalValue: number;
    totalQuantity: number;
    items: StockItem[];
    isExpanded: boolean;
}

const ItemStack = () => {
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { colors, typography } = useTheme();
    const styles = getStyles(typography, colors);

    const [modalVisible, setModalVisible] = React.useState(false);
    const [reqDate, setReqDate] = React.useState<Date>(new Date());
    const [searchText, setSearchText] = React.useState<string>("");
    const [groupBy, setGroupBy] = React.useState<
        "Stock_Group" | "Grade_Item_Group"
    >("Stock_Group");
    const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
        new Set(),
    );

    const {
        data: itemStockValue = [],
        isLoading: isItemStockValueLoading,
        error: itemStockValueError,
        refetch: refetchItemStockValue,
    } = useQuery({
        queryKey: ["itemStackValue", reqDate],
        queryFn: () => itemStockInfo(reqDate),
        enabled: !!reqDate,
    });

    // Group data by selected criteria
    const groupedData = React.useMemo((): GroupedData[] => {
        if (!itemStockValue || itemStockValue.length === 0) return [];

        const filtered = itemStockValue.filter((item: StockItem) => {
            const searchLower = searchText.toLowerCase();
            return (
                item.Group_Name.toLowerCase().includes(searchLower) ||
                item.Brand.toLowerCase().includes(searchLower) ||
                item.Stock_Group.toLowerCase().includes(searchLower) ||
                item.Grade_Item_Group.toLowerCase().includes(searchLower)
            );
        });

        const grouped = filtered.reduce(
            (acc: { [key: string]: GroupedData }, item: StockItem) => {
                const key = item[groupBy];
                if (!acc[key]) {
                    acc[key] = {
                        groupName: key,
                        totalValue: 0,
                        totalQuantity: 0,
                        items: [],
                        isExpanded: expandedGroups.has(key),
                    };
                }
                acc[key].totalValue += item.CL_Value;
                acc[key].totalQuantity += item.Bal_Qty;
                acc[key].items.push(item);
                // Update expanded state
                acc[key].isExpanded = expandedGroups.has(key);
                return acc;
            },
            {},
        );

        // Convert to array and sort
        const groupedArray: GroupedData[] = Object.values(grouped);

        return groupedArray.sort((a: GroupedData, b: GroupedData) => {
            return b.totalValue - a.totalValue;
        });
    }, [itemStockValue, searchText, groupBy, expandedGroups]);

    // Calculate totals
    const totalValue = React.useMemo((): number => {
        return groupedData.reduce(
            (sum: number, group: GroupedData) => sum + group.totalValue,
            0,
        );
    }, [groupedData]);

    const totalQuantity = React.useMemo((): number => {
        return groupedData.reduce(
            (sum: number, group: GroupedData) => sum + group.totalQuantity,
            0,
        );
    }, [groupedData]);

    const formatNumber = (num: number) => {
        if (num >= 10000000) return `${(num / 10000000).toFixed(1)}Cr`;
        if (num >= 100000) return `${(num / 100000).toFixed(1)}L`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toFixed(0);
    };

    const formatCurrency = (amount: number) => {
        return `₹${formatNumber(amount)}`;
    };

    const toggleGroup = (groupName: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(groupName)) {
            newExpanded.delete(groupName);
        } else {
            newExpanded.add(groupName);
        }
        setExpandedGroups(newExpanded);
    };

    // Summary Cards Component
    const SummaryCards = () => (
        <View style={styles.summaryCardsContainer}>
            <View style={styles.summaryCard}>
                <Icon
                    name="account-balance-wallet"
                    size={24}
                    color={colors.primary}
                />
                <Text style={styles.summaryCardValue}>
                    {formatCurrency(totalValue)}
                </Text>
                <Text style={styles.summaryCardLabel}>Total Value</Text>
            </View>
            <View style={styles.summaryCard}>
                <Icon name="storage" size={24} color={colors.accent} />
                <Text style={styles.summaryCardValue}>
                    {formatNumber(totalQuantity)}
                </Text>
                <Text style={styles.summaryCardLabel}>Total Quantity</Text>
            </View>
            <View style={styles.summaryCard}>
                <Icon name="category" size={24} color={colors.success} />
                <Text style={styles.summaryCardValue}>
                    {groupedData.length}
                </Text>
                <Text style={styles.summaryCardLabel}>Groups</Text>
            </View>
        </View>
    );

    // Group Card Component
    const GroupCard = ({ group }: { group: GroupedData }) => {
        const isExpanded = expandedGroups.has(group.groupName);

        return (
            <View style={styles.groupCard}>
                <TouchableOpacity
                    style={[
                        styles.groupHeader,
                        isExpanded && styles.groupHeaderExpanded,
                    ]}
                    onPress={() => toggleGroup(group.groupName)}
                >
                    <View style={styles.groupHeaderContent}>
                        <View style={styles.groupTitleContainer}>
                            <Icon
                                name={
                                    isExpanded ? "expand-less" : "expand-more"
                                }
                                size={24}
                                color={colors.primary}
                            />
                            <Text style={styles.groupTitle}>
                                {group.groupName}
                            </Text>
                            <View style={styles.groupBadge}>
                                <Text style={styles.groupBadgeText}>
                                    {group.items[0].Group_ST}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.groupMetrics}>
                            <View style={styles.groupMetric}>
                                <Icon
                                    name="inventory"
                                    size={16}
                                    color={colors.info}
                                />
                                <Text style={styles.groupMetricValue}>
                                    {group.items.length} items
                                </Text>
                            </View>
                            <View style={styles.groupMetric}>
                                <Icon
                                    name="add-shopping-cart"
                                    size={16}
                                    color={colors.success}
                                />
                                <Text style={styles.groupMetricValue}>
                                    {formatCurrency(
                                        group.items.reduce(
                                            (sum, item) => sum + item.Pur_value,
                                            0,
                                        ),
                                    )}
                                </Text>
                            </View>
                            <View style={styles.groupMetric}>
                                <Icon
                                    name="shopping-cart-checkout"
                                    size={16}
                                    color={colors.warning}
                                />
                                <Text style={styles.groupMetricValue}>
                                    {formatCurrency(
                                        group.items.reduce(
                                            (sum, item) => sum + item.Sal_value,
                                            0,
                                        ),
                                    )}
                                </Text>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>

                {isExpanded && (
                    <View style={styles.groupContent}>
                        {group.items.map((item, index) => (
                            <View
                                key={`${item.Stock_Group}-${item.Grade_Item_Group}-${index}`}
                                style={styles.itemCard}
                            >
                                <View style={styles.itemHeader}>
                                    <View style={styles.itemHeaderLeft}>
                                        <Text style={styles.itemName}>
                                            {item.Group_Name}
                                        </Text>
                                        <View style={styles.itemSubInfo}>
                                            <Text
                                                style={styles.itemSubInfoText}
                                            >
                                                {item.S_Sub_Group_1}
                                            </Text>
                                            <View style={styles.divider} />
                                            <View style={styles.itemBadge}>
                                                <Text
                                                    style={styles.itemBadgeText}
                                                >
                                                    {item.Grade_Item_Group}
                                                </Text>
                                            </View>
                                            {/* <Text
                                                style={styles.itemSubInfoText}>
                                                {item.Brand}
                                            </Text> */}
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.itemStats}>
                                    <View style={styles.statsRow}>
                                        <View style={styles.statItem}>
                                            <Text style={styles.statLabel}>
                                                Opening Balance
                                            </Text>
                                            <Text style={styles.statValue}>
                                                {item.OB_Bal_Qty} Qty |{" "}
                                                {formatCurrency(item.OB_Value)}
                                            </Text>
                                        </View>
                                        <View style={styles.statItem}>
                                            <Text style={styles.statLabel}>
                                                Current Balance
                                            </Text>
                                            <Text style={styles.statValue}>
                                                {item.Bal_Qty} Qty |{" "}
                                                {formatCurrency(item.CL_Value)}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.transactionSummary}>
                                        <View style={styles.transactionItem}>
                                            <Icon
                                                name="add-circle-outline"
                                                size={16}
                                                color={colors.success}
                                            />
                                            <Text
                                                style={styles.transactionLabel}
                                            >
                                                IN
                                            </Text>
                                            <Text
                                                style={styles.transactionValue}
                                            >
                                                {item.IN_Qty} Qty |{" "}
                                                {formatCurrency(item.IN_Value)}
                                            </Text>
                                        </View>
                                        <View style={styles.transactionItem}>
                                            <Icon
                                                name="remove-circle-outline"
                                                size={16}
                                                color={colors.error}
                                            />
                                            <Text
                                                style={styles.transactionLabel}
                                            >
                                                OUT
                                            </Text>
                                            <Text
                                                style={styles.transactionValue}
                                            >
                                                {item.OUT_Qty} Qty |{" "}
                                                {formatCurrency(item.Out_Value)}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    const handleCloseModal = () => {
        setModalVisible(false);
    };

    return (
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
            <AppHeader
                title="Item Stock Value"
                navigation={navigation}
                showRightIcon={true}
                rightIconLibrary="MaterialIcon"
                rightIconName="filter-list"
                onRightPress={() => setModalVisible(true)}
            />

            <FilterModal
                visible={modalVisible}
                fromDate={reqDate}
                onFromDateChange={setReqDate}
                onApply={() => setModalVisible(false)}
                onClose={handleCloseModal}
                showToDate={false}
                title="Filter Options"
                fromLabel="From Date"
            />

            <ScrollView
                style={styles.scrollContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* Loading State */}
                {isItemStockValueLoading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator
                            size="large"
                            color={colors.primary}
                        />
                        <Text style={styles.loadingText}>
                            Loading stock data...
                        </Text>
                    </View>
                )}

                {/* Error State */}
                {!isItemStockValueLoading && itemStockValueError && (
                    <View style={styles.errorContainer}>
                        <Icon
                            name="error-outline"
                            size={48}
                            color={colors.accent}
                        />
                        <Text style={styles.errorText}>
                            Failed to load stock data
                        </Text>
                        <Text style={styles.errorSubtext}>
                            Please check your connection and try again
                        </Text>
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={() => refetchItemStockValue()}
                        >
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
                {!isItemStockValueLoading &&
                    !itemStockValueError &&
                    itemStockValue.length > 0 && (
                        <>
                            {/* Summary Cards */}
                            <SummaryCards />

                            {/* Search Bar */}
                            <View style={styles.searchContainer}>
                                <Icon
                                    name="search"
                                    size={20}
                                    color={colors.textSecondary}
                                />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search stocks..."
                                    value={searchText}
                                    onChangeText={setSearchText}
                                    placeholderTextColor={colors.textSecondary}
                                />
                                {searchText.length > 0 && (
                                    <TouchableOpacity
                                        onPress={() => setSearchText("")}
                                    >
                                        <Icon
                                            name="clear"
                                            size={20}
                                            color={colors.textSecondary}
                                        />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Group Toggle */}
                            <View style={styles.groupToggleContainer}>
                                <View style={styles.groupToggleButtons}>
                                    <TouchableOpacity
                                        style={[
                                            styles.groupToggleButton,
                                            groupBy === "Stock_Group" &&
                                                styles.activeGroupToggleButton,
                                        ]}
                                        onPress={() =>
                                            setGroupBy("Stock_Group")
                                        }
                                    >
                                        <Icon
                                            name="category"
                                            size={18}
                                            color={
                                                groupBy === "Stock_Group"
                                                    ? colors.white
                                                    : colors.text
                                            }
                                        />
                                        <Text
                                            style={[
                                                styles.groupToggleButtonText,
                                                groupBy === "Stock_Group" &&
                                                    styles.activeGroupToggleButtonText,
                                            ]}
                                        >
                                            Stock Group
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.groupToggleButton,
                                            groupBy === "Grade_Item_Group" &&
                                                styles.activeGroupToggleButton,
                                        ]}
                                        onPress={() =>
                                            setGroupBy("Grade_Item_Group")
                                        }
                                    >
                                        <Icon
                                            name="label"
                                            size={18}
                                            color={
                                                groupBy === "Grade_Item_Group"
                                                    ? colors.white
                                                    : colors.text
                                            }
                                        />
                                        <Text
                                            style={[
                                                styles.groupToggleButtonText,
                                                groupBy ===
                                                    "Grade_Item_Group" &&
                                                    styles.activeGroupToggleButtonText,
                                            ]}
                                        >
                                            Grade Item Group
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Stock Groups */}
                            <View
                                style={{
                                    paddingHorizontal: responsiveWidth(4),
                                }}
                            >
                                {groupedData.map((group, index) => (
                                    <GroupCard
                                        key={`${group.groupName}-${index}`}
                                        group={group}
                                    />
                                ))}
                            </View>

                            {/* Empty State */}
                            {groupedData.length === 0 && (
                                <View style={styles.emptyContainer}>
                                    <Icon
                                        name="inbox"
                                        size={48}
                                        color={colors.textSecondary}
                                    />
                                    <Text style={styles.emptyText}>
                                        No stock data found
                                    </Text>
                                    <Text style={styles.emptySubtext}>
                                        Try adjusting your search or date
                                        selection
                                    </Text>
                                </View>
                            )}
                        </>
                    )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default ItemStack;

const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.primary,
        },
        scrollContainer: {
            backgroundColor: colors.background,
        },

        // Controls Section
        controlsContainer: {
            backgroundColor: colors.white,
            padding: responsiveWidth(4),
            borderBottomWidth: 1,
            borderBottomColor: colors.grey500,
        },

        groupByContainer: {
            marginBottom: responsiveHeight(2),
        },

        controlLabel: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "600",
            marginBottom: responsiveHeight(1),
        },

        toggleContainer: {
            flexDirection: "row",
            backgroundColor: colors.surface,
            borderRadius: 8,
            padding: 2,
        },

        toggleButton: {
            flex: 1,
            paddingVertical: responsiveHeight(1),
            paddingHorizontal: responsiveWidth(3),
            borderRadius: 6,
            alignItems: "center",
        },

        toggleButtonActive: {
            backgroundColor: colors.primary,
        },

        toggleButtonText: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "500",
        },

        toggleButtonTextActive: {
            color: colors.white,
            fontWeight: "600",
        },

        // Summary Section
        summaryContainer: {
            flexDirection: "row",
            paddingHorizontal: responsiveWidth(4),
            paddingVertical: responsiveHeight(2),
            backgroundColor: colors.white,
            borderBottomWidth: 1,
            borderBottomColor: colors.grey500,
            gap: responsiveWidth(2),
        },

        summaryCard: {
            flex: 1,
            backgroundColor: colors.surface,
            padding: responsiveWidth(3),
            borderRadius: 8,
            alignItems: "center",
        },

        summaryLabel: {
            ...typography.caption,
            color: colors.textSecondary,
            fontWeight: "500",
            marginBottom: responsiveHeight(0.5),
        },

        summaryValue: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "700",
        },

        // Loading and Error States
        loadingContainer: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            gap: responsiveHeight(2),
        },

        loadingText: {
            ...typography.body1,
            color: colors.textSecondary,
        },

        errorContainer: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            gap: responsiveHeight(2),
        },

        errorText: {
            ...typography.body1,
            color: colors.error,
            textAlign: "center",
        },

        retryButton: {
            backgroundColor: colors.primary,
            paddingHorizontal: responsiveWidth(6),
            paddingVertical: responsiveHeight(1.5),
            borderRadius: 8,
        },

        retryButtonText: {
            ...typography.body2,
            color: colors.white,
            fontWeight: "600",
        },

        emptyContainer: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingVertical: responsiveHeight(10),
            gap: responsiveHeight(2),
        },

        emptyText: {
            ...typography.body1,
            color: colors.textSecondary,
        },

        // List Section
        listContainer: {
            flex: 1,
            backgroundColor: colors.background,
        },

        groupContainer: {
            marginBottom: responsiveHeight(1),
        },

        groupHeader: {
            padding: responsiveWidth(4),
            backgroundColor: colors.white,
        },

        groupHeaderExpanded: {
            backgroundColor: colors.primary + "08",
            borderBottomWidth: 1,
            borderBottomColor: colors.primary + "20",
        },

        groupTitleContainer: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(2),
            marginBottom: responsiveWidth(3),
        },

        groupTitle: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "600",
            flex: 1,
        },

        groupBadge: {
            backgroundColor: colors.info + "15",
            paddingHorizontal: responsiveWidth(2),
            paddingVertical: responsiveWidth(0.5),
            borderRadius: 12,
        },

        groupBadgeText: {
            ...typography.caption,
            color: colors.info,
            fontWeight: "600",
        },

        groupMetrics: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },

        groupMetric: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(1),
        },

        groupMetricValue: {
            ...typography.caption,
            color: colors.text,
            fontWeight: "500",
        },

        itemHeaderLeft: {
            flexDirection: "row",
            alignItems: "flex-start",
            gap: responsiveWidth(3),
        },

        itemSubInfo: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(2),
            marginTop: responsiveWidth(1),
        },

        itemSubInfoText: {
            ...typography.caption,
            color: colors.grey700,
        },

        divider: {
            width: 1,
            height: "100%",
            backgroundColor: colors.grey300,
        },

        itemStats: {
            padding: responsiveWidth(2),
            backgroundColor: colors.grey50,
            borderBottomLeftRadius: 6,
            borderBottomRightRadius: 6,
        },

        statsRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: responsiveWidth(2),
        },

        statItem: {
            flex: 1,
        },

        statLabel: {
            ...typography.caption,
            color: colors.grey700,
            marginBottom: 2,
        },

        statValue: {
            ...typography.subtitle1,
            color: colors.text,
            fontWeight: "600",
        },

        transactionSummary: {
            flexDirection: "row",
            justifyContent: "space-between",
            paddingTop: responsiveWidth(3),
            borderTopWidth: 1,
            borderTopColor: colors.grey200,
        },

        transactionItem: {
            alignItems: "center",
            flex: 1,
        },

        transactionLabel: {
            ...typography.overline,
            color: colors.grey700,
            marginBottom: 2,
        },

        transactionValue: {
            ...typography.subtitle2,
            fontWeight: "600",
        },

        groupSubtitle: {
            ...typography.caption,
            color: colors.textSecondary,
            marginTop: responsiveHeight(0.2),
        },

        groupHeaderRight: {
            alignItems: "flex-end",
        },

        groupValue: {
            ...typography.body1,
            color: colors.primary,
            fontWeight: "700",
        },

        groupQuantity: {
            ...typography.caption,
            color: colors.textSecondary,
            marginTop: responsiveHeight(0.2),
        },

        stockItem: {
            backgroundColor: colors.white,
            paddingHorizontal: responsiveWidth(6),
            paddingVertical: responsiveHeight(1.5),
            borderBottomWidth: 1,
            borderBottomColor: colors.grey500,
        },

        stockItemHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: responsiveHeight(0.5),
        },

        stockItemName: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "600",
            flex: 1,
        },

        stockItemValue: {
            ...typography.body2,
            color: colors.primary,
            fontWeight: "700",
        },

        stockItemDetails: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },

        stockItemBrand: {
            ...typography.caption,
            color: colors.textSecondary,
            flex: 1,
        },

        stockItemQuantity: {
            ...typography.caption,
            color: colors.textSecondary,
            fontWeight: "500",
        },

        // New Summary Cards Styles
        summaryCardsContainer: {
            flexDirection: "row",
            paddingHorizontal: responsiveWidth(4),
            paddingVertical: responsiveHeight(2),
            backgroundColor: colors.white,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderColor,
            gap: responsiveWidth(2),
        },

        summaryCardValue: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "700",
            marginTop: responsiveHeight(0.5),
        },

        summaryCardLabel: {
            ...typography.caption,
            color: colors.textSecondary,
            fontWeight: "500",
            marginTop: responsiveHeight(0.5),
            textAlign: "center",
        },

        // Search Container Styles
        searchContainer: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(4),
            marginVertical: responsiveHeight(1),
            paddingHorizontal: responsiveWidth(3),
            paddingVertical: responsiveHeight(1),
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.borderColor,
            gap: responsiveWidth(2),
        },

        searchInput: {
            flex: 1,
            ...typography.body2,
            color: colors.text,
            paddingVertical: responsiveHeight(0.5),
        },

        // Group Toggle Styles
        groupToggleContainer: {
            paddingHorizontal: responsiveWidth(4),
            paddingVertical: responsiveHeight(2),
            backgroundColor: colors.white,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderColor,
        },

        groupToggleButtons: {
            flexDirection: "row",
            gap: responsiveWidth(2),
            marginTop: responsiveHeight(1),
        },

        groupToggleButton: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: responsiveHeight(1),
            borderRadius: 6,
            backgroundColor: colors.surface,
            gap: responsiveWidth(1),
        },

        activeGroupToggleButton: {
            backgroundColor: colors.primary,
        },

        groupToggleButtonText: {
            ...typography.caption,
            color: colors.text,
            fontWeight: "500",
        },

        activeGroupToggleButtonText: {
            color: colors.white,
            fontWeight: "600",
        },

        // Group Card Styles
        groupCard: {
            backgroundColor: colors.white,
            marginBottom: responsiveHeight(1),
            borderRadius: 8,
            elevation: 2,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            overflow: "hidden", // This will ensure content stays within borders
        },

        groupHeaderContent: {
            width: "100%",
        },

        groupStats: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(2),
        },

        groupStat: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(0.5),
        },

        groupStatText: {
            ...typography.caption,
            color: colors.textSecondary,
            fontWeight: "500",
        },

        groupContent: {
            padding: responsiveWidth(2),
            backgroundColor: colors.background,
        },

        // Item Card Styles
        itemCard: {
            backgroundColor: colors.surface,
            marginBottom: responsiveHeight(0.75),
            borderRadius: 6,
            borderLeftWidth: 3,
            borderLeftColor: colors.primary,
        },

        itemHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: responsiveWidth(2),
            paddingBottom: responsiveHeight(1),
        },

        itemName: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "600",
            flex: 1,
        },

        itemBadge: {
            backgroundColor: colors.accent + "20",
            paddingHorizontal: responsiveWidth(2),
            paddingVertical: responsiveHeight(0.3),
            borderRadius: 4,
        },

        itemBadgeText: {
            ...typography.caption,
            color: colors.accent,
            fontWeight: "600",
        },

        itemContent: {
            flexDirection: "row",
            justifyContent: "space-between",
            gap: responsiveWidth(2),
        },

        itemMetric: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(1),
        },

        itemMetricLabel: {
            ...typography.caption,
            color: colors.textSecondary,
            fontWeight: "500",
        },

        itemMetricValue: {
            ...typography.caption,
            color: colors.text,
            fontWeight: "600",
        },

        // Error Container Updates
        errorSubtext: {
            ...typography.caption,
            color: colors.textSecondary,
            textAlign: "center",
            marginTop: responsiveHeight(0.5),
        },

        emptySubtext: {
            ...typography.caption,
            color: colors.textSecondary,
            textAlign: "center",
            marginTop: responsiveHeight(0.5),
        },
    });
