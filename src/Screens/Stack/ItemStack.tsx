import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
} from "react-native";
import React from "react";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";
import { RootStackParamList } from "../../Navigation/types";
import { useTheme } from "../../Context/ThemeContext";
import { itemStockInfo } from "../../Api/OpeningStock";
import { responsiveHeight, responsiveWidth } from "../../constants/helper";
import AppHeader from "../../Components/AppHeader";
import DatePickerButton from "../../Components/DatePickerButton";

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
    const [reqDate, setReqDate] = React.useState<Date>(new Date());
    const [searchText, setSearchText] = React.useState<string>("");
    const [groupBy, setGroupBy] = React.useState<
        "Stock_Group" | "Grade_Item_Group"
    >("Stock_Group");
    const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
        new Set(),
    );
    const [sortBy, setSortBy] = React.useState<"value" | "quantity" | "name">(
        "value",
    );
    const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");

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
            let aValue: number | string, bValue: number | string;

            switch (sortBy) {
                case "value":
                    aValue = a.totalValue;
                    bValue = b.totalValue;
                    break;
                case "quantity":
                    aValue = a.totalQuantity;
                    bValue = b.totalQuantity;
                    break;
                case "name":
                    aValue = a.groupName;
                    bValue = b.groupName;
                    break;
                default:
                    aValue = a.totalValue;
                    bValue = b.totalValue;
            }

            if (sortBy === "name") {
                return sortOrder === "asc"
                    ? (aValue as string).localeCompare(bValue as string)
                    : (bValue as string).localeCompare(aValue as string);
            } else {
                return sortOrder === "asc"
                    ? (aValue as number) - (bValue as number)
                    : (bValue as number) - (aValue as number);
            }
        });
    }, [
        itemStockValue,
        searchText,
        groupBy,
        expandedGroups,
        sortBy,
        sortOrder,
    ]);

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

    // Sort Controls Component
    const SortControls = () => (
        <View style={styles.sortControlsContainer}>
            <Text style={styles.sortLabel}>Sort By:</Text>
            <View style={styles.sortButtonsContainer}>
                <TouchableOpacity
                    style={[
                        styles.sortButton,
                        sortBy === "value" && styles.activeSortButton,
                    ]}
                    onPress={() => setSortBy("value")}>
                    <Icon
                        name="monetization-on"
                        size={18}
                        color={sortBy === "value" ? colors.white : colors.text}
                    />
                    <Text
                        style={[
                            styles.sortButtonText,
                            sortBy === "value" && styles.activeSortButtonText,
                        ]}>
                        Value
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.sortButton,
                        sortBy === "quantity" && styles.activeSortButton,
                    ]}
                    onPress={() => setSortBy("quantity")}>
                    <Icon
                        name="inventory"
                        size={18}
                        color={
                            sortBy === "quantity" ? colors.white : colors.text
                        }
                    />
                    <Text
                        style={[
                            styles.sortButtonText,
                            sortBy === "quantity" &&
                                styles.activeSortButtonText,
                        ]}>
                        Quantity
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.sortButton,
                        sortBy === "name" && styles.activeSortButton,
                    ]}
                    onPress={() => setSortBy("name")}>
                    <Icon
                        name="sort-by-alpha"
                        size={18}
                        color={sortBy === "name" ? colors.white : colors.text}
                    />
                    <Text
                        style={[
                            styles.sortButtonText,
                            sortBy === "name" && styles.activeSortButtonText,
                        ]}>
                        Name
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    // Group Card Component
    const GroupCard = ({ group }: { group: GroupedData }) => {
        const isExpanded = expandedGroups.has(group.groupName);

        return (
            <View style={styles.groupCard}>
                <TouchableOpacity
                    style={styles.groupHeader}
                    onPress={() => toggleGroup(group.groupName)}>
                    <View style={styles.groupHeaderContent}>
                        <Icon
                            name={isExpanded ? "expand-less" : "expand-more"}
                            size={24}
                            color={colors.primary}
                        />
                        <Text style={styles.groupTitle}>{group.groupName}</Text>
                    </View>
                    <View style={styles.groupStats}>
                        <View style={styles.groupStat}>
                            <Icon
                                name="inventory"
                                size={16}
                                color={colors.textSecondary}
                            />
                            <Text style={styles.groupStatText}>
                                {group.items.length}
                            </Text>
                        </View>
                        <View style={styles.groupStat}>
                            <Icon
                                name="monetization-on"
                                size={16}
                                color={colors.textSecondary}
                            />
                            <Text style={styles.groupStatText}>
                                {formatCurrency(
                                    group.items.reduce(
                                        (sum, item) => sum + item.CL_Value,
                                        0,
                                    ),
                                )}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>

                {isExpanded && (
                    <View style={styles.groupContent}>
                        {group.items.map((item, index) => (
                            <View
                                key={`${item.Stock_Group}-${item.Grade_Item_Group}-${index}`}
                                style={styles.itemCard}>
                                <View style={styles.itemHeader}>
                                    <Text style={styles.itemName}>
                                        {item.Stock_Group}
                                    </Text>
                                    <View style={styles.itemBadge}>
                                        <Text style={styles.itemBadgeText}>
                                            {item.Grade_Item_Group}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.itemContent}>
                                    <View style={styles.itemMetric}>
                                        <Icon
                                            name="account-balance-wallet"
                                            size={16}
                                            color={colors.primary}
                                        />
                                        <Text style={styles.itemMetricLabel}>
                                            Value
                                        </Text>
                                        <Text style={styles.itemMetricValue}>
                                            {formatCurrency(item.CL_Value)}
                                        </Text>
                                    </View>
                                    <View style={styles.itemMetric}>
                                        <Icon
                                            name="speed"
                                            size={16}
                                            color={colors.accent}
                                        />
                                        <Text style={styles.itemMetricLabel}>
                                            Rate
                                        </Text>
                                        <Text style={styles.itemMetricValue}>
                                            {formatNumber(item.CL_Rate)}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
            <AppHeader title="Stock Value" navigation={navigation} />

            <ScrollView
                style={styles.scrollContainer}
                showsVerticalScrollIndicator={false}>
                {/* Date Picker Section */}
                <View style={styles.datePickerContainer}>
                    <Text style={styles.sectionTitle}>Select Date</Text>
                    <DatePickerButton
                        title="Select Date"
                        date={reqDate}
                        style={styles.datePicker}
                        onDateChange={setReqDate}
                    />
                </View>

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
                            onPress={() => refetchItemStockValue()}>
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

                            {/* Sort Controls */}
                            <SortControls />

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
                                        onPress={() => setSearchText("")}>
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
                                <Text style={styles.sortLabel}>Group by:</Text>
                                <View style={styles.groupToggleButtons}>
                                    <TouchableOpacity
                                        style={[
                                            styles.groupToggleButton,
                                            groupBy === "Stock_Group" &&
                                                styles.activeGroupToggleButton,
                                        ]}
                                        onPress={() =>
                                            setGroupBy("Stock_Group")
                                        }>
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
                                            ]}>
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
                                        }>
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
                                            ]}>
                                            Grade Group
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Stock Groups */}
                            {groupedData.map((group, index) => (
                                <GroupCard
                                    key={`${group.groupName}-${index}`}
                                    group={group}
                                />
                            ))}

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

        sortContainer: {
            marginBottom: responsiveHeight(2),
        },

        sortButtonsContainer: {
            flexDirection: "row",
            gap: responsiveWidth(2),
        },

        sortButton: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: responsiveWidth(3),
            paddingVertical: responsiveHeight(0.8),
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

        expandContainer: {
            flexDirection: "row",
            justifyContent: "space-between",
            gap: responsiveWidth(2),
        },

        expandButton: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: responsiveHeight(1),
            borderRadius: 6,
            backgroundColor: colors.primary + "15",
            gap: responsiveWidth(1),
        },

        expandButtonText: {
            ...typography.caption,
            color: colors.primary,
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
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: colors.white,
            paddingHorizontal: responsiveWidth(4),
            paddingVertical: responsiveHeight(2),
            borderBottomWidth: 1,
            borderBottomColor: colors.grey500,
        },

        groupHeaderLeft: {
            flexDirection: "row",
            alignItems: "center",
            flex: 1,
        },

        groupHeaderText: {
            marginLeft: responsiveWidth(2),
            flex: 1,
        },

        groupTitle: {
            ...typography.body1,
            color: colors.text,
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
            borderBottomColor: colors.grey500,
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

        // Sort Controls Styles
        sortControlsContainer: {
            paddingHorizontal: responsiveWidth(4),
            paddingVertical: responsiveHeight(2),
            backgroundColor: colors.white,
            borderBottomWidth: 1,
            borderBottomColor: colors.grey500,
        },

        sortLabel: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "600",
            marginBottom: responsiveHeight(1),
        },

        activeSortButton: {
            backgroundColor: colors.primary,
        },

        activeSortButtonText: {
            color: colors.white,
            fontWeight: "600",
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
            borderColor: colors.grey500,
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
            borderBottomColor: colors.grey500,
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
            marginHorizontal: responsiveWidth(4),
            marginVertical: responsiveHeight(1),
            borderRadius: 8,
            elevation: 2,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
        },

        groupHeaderContent: {
            flexDirection: "row",
            alignItems: "center",
            flex: 1,
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
            paddingHorizontal: responsiveWidth(4),
            paddingBottom: responsiveHeight(2),
        },

        // Item Card Styles
        itemCard: {
            backgroundColor: colors.surface,
            marginVertical: responsiveHeight(0.5),
            padding: responsiveWidth(3),
            borderRadius: 6,
            borderLeftWidth: 3,
            borderLeftColor: colors.primary,
        },

        itemHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: responsiveHeight(1),
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

        // Date Picker Section
        datePickerContainer: {
            paddingHorizontal: responsiveWidth(4),
            paddingVertical: responsiveHeight(2),
            backgroundColor: colors.white,
            borderBottomWidth: 1,
            borderBottomColor: colors.grey500,
        },

        sectionTitle: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "600",
            marginBottom: responsiveHeight(1),
        },

        datePicker: {
            backgroundColor: colors.surface,
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
