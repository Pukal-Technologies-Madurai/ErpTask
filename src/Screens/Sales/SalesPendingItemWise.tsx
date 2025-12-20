import {
    Text,
    StyleSheet,
    View,
    ScrollView,
    RefreshControl,
    TouchableOpacity,
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
import { formatCurrency } from "../../constants/utils";
import { usePagination } from "../../hooks/usePagination";
import PaginationControls from "../../Components/PaginationControls";
import { responsiveWidth, responsiveHeight } from "../../constants/helper";
import { MMKV } from "react-native-mmkv";

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

const ITEMS_PER_PAGE = 15;

const SalesPendingItemWise = ({ route }: { route: any }) => {
    const branchIdProps = route.params?.branchId;
    const { typography, colors } = useTheme();
    const styles = getStyles(typography, colors);
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
    const [expandedOrders, setExpandedOrders] = React.useState<Set<string>>(
        new Set(),
    );
    const [refreshing, setRefreshing] = React.useState(false);
    const [selectedBrand, setSelectedBrand] = React.useState<string>("");
    const [viewMode, setViewMode] = React.useState<"order" | "item">("order");
    const [expandedBrands, setExpandedBrands] = React.useState<Set<string>>(new Set());
    const [expandedBrand, setExpandedBrand] = React.useState<string | null>(null);


    const ITEMS_PER_PAGE = 15;

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
        queryKey: ["saleOrder", fromDate, toDate],
        queryFn: () =>
            salesOrderPendingList(fromDate, toDate, userId, branchIdProps),
        enabled: !!fromDate && !!toDate && !!userId && !!branchIdProps,
    });

    // Handle refresh
    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        try {
            await refetch();
        } finally {
            setRefreshing(false);
        }
    }, [refetch]);

    // Summary Cards Component
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

    const getBrandsWithTotals = () => {
        const brandTotals = new Map<string, { count: number; amount: number }>();

        (saleOrder as any[]).forEach((order: any) => {
            order.Products_List?.forEach((product: any) => {
                if (product.BrandGet) {
                    const current = brandTotals.get(product.BrandGet) || {
                        count: 0,
                        amount: 0,
                    };
                    brandTotals.set(product.BrandGet, {
                        count: current.count + 1,
                        amount: current.amount + (product.Final_Amo || 0),
                    });
                }
            });
        });

        return Array.from(brandTotals.entries()).map(([brand, totals]) => ({
            brand,
            count: totals.count,
            amount: totals.amount,
        }));
    };

    const filteredData = React.useMemo(() => {
        let filtered = [...(saleOrder as any[])];

        if (searchQuery.trim()) {
            filtered = filtered.filter((order: any) =>
                (
                    order.So_Inv_No?.toLowerCase() +
                    " " +
                    order.Retailer_Name?.toLowerCase() +
                    " " +
                    order.Sales_Person_Name?.toLowerCase() +
                    " " +
                    order.Branch_Name?.toLowerCase()
                ).includes(searchQuery.toLowerCase()),
            );
        }

        if (selectedBrand) {
            filtered = filtered.filter((order: any) =>
                order.Products_List?.some(
                    (product: Product) => product.BrandGet === selectedBrand,
                ),
            );
        }

        return filtered;
    }, [saleOrder, searchQuery, selectedBrand]);

    const filteredOrders = React.useMemo(() => {
        let filtered = [...saleOrder];

        if (searchQuery.trim()) {
            filtered = filtered.filter((order: any) =>
                (
                    order.So_Inv_No +
                    order.Retailer_Name +
                    order.Sales_Person_Name +
                    order.Branch_Name
                )
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase()),
            );
        }

        if (selectedBrand) {
            filtered = filtered.filter((order: any) =>
                order.Products_List?.some(
                    (p: any) => p.BrandGet === selectedBrand,
                ),
            );
        }

        return filtered;
    }, [saleOrder, searchQuery, selectedBrand]);

    const totalAmount = filteredOrders.reduce(
        (sum: number, o: any) => sum + (o.Total_Invoice_value || 0),
        0,
    );


    /* ---------- ITEM WISE FLATTEN (ORIGINAL LOGIC) ---------- */
    const itemWiseData = React.useMemo(() => {
        const list: any[] = [];

        (filteredData as any[]).forEach((order: any) => {
            order.Products_List?.forEach((product: Product) => {
                list.push({
                    ...product,
                    So_Inv_No: order.So_Inv_No,
                    Retailer_Name: order.Retailer_Name,
                    Sales_Person_Name: order.Sales_Person_Name,
                    Created_on: order.Created_on,
                    Branch_Name: order.Branch_Name,
                    Total_Invoice_value: order.Total_Invoice_value,
                });
            });
        });

        return list;
    }, [filteredData]);

    const filteredItems = React.useMemo(() => {
        if (!searchQuery) return itemWiseData;

        return itemWiseData.filter((i: any) =>
            (
                i.Product_Name +
                i.So_Inv_No +
                i.Retailer_Name
            )
                .toLowerCase()
                .includes(searchQuery.toLowerCase()),
        );
    }, [itemWiseData, searchQuery]);

    const brandWiseUIData = React.useMemo(() => {
        const map = new Map<string, any[]>();

        itemWiseData.forEach((item: any) => {
            const brand = item.BrandGet?.trim() || "Others";

            if (!map.has(brand)) {
                map.set(brand, []);
            }
            map.get(brand)?.push(item);
        });

        return Array.from(map.entries()).map(([brand, items]) => ({
            brand,
            items,
            count: items.length,
        }));
    }, [itemWiseData]);


    const {
        currentData: displayData,
        currentPage,
        totalPages,
        totalItems,
        totalRecords,
        setCurrentPage,
    } = usePagination({
        data: filteredItems,
        itemsPerPage: ITEMS_PER_PAGE,
    });

    React.useEffect(() => {
        setCurrentPage(1);
        setExpandedOrders(new Set());
    }, [searchQuery, selectedBrand, viewMode, setCurrentPage]);

    const BrandFilter = () => {
        const brandsWithTotals = getBrandsWithTotals();

        return (
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.brandFilterContainer}>
                <TouchableOpacity
                    style={[
                        styles.brandFilterButton,
                        !selectedBrand && styles.brandFilterButtonActive,
                    ]}
                    onPress={() => setSelectedBrand("")}>
                    <Text
                        style={[
                            styles.brandFilterText,
                            !selectedBrand && styles.brandFilterTextActive,
                        ]}>
                        All
                    </Text>
                </TouchableOpacity>
                {brandsWithTotals.map(({ brand }) => (
                    <TouchableOpacity
                        key={brand}
                        style={[
                            styles.brandFilterButton,
                            selectedBrand === brand &&
                            styles.brandFilterButtonActive,
                        ]}
                        onPress={() => setSelectedBrand(brand)}>
                        <Text
                            style={[
                                styles.brandFilterText,
                                selectedBrand === brand &&
                                styles.brandFilterTextActive,
                            ]}>
                            {brand}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        );
    };

    const handleBrandPress = (brand: string) => {
        setExpandedBrand(prev => (prev === brand ? null : brand));
    };

    const ItemWiseCard = ({ item }: { item: any }) => {
        const formatDate = (value: any) => {
            if (!value) return "—";
            const d = new Date(value);
            if (isNaN(d.getTime())) return "—";
            return d.toLocaleDateString("en-IN");
        };

        return (
            <View style={styles.cardContainer}>
                {/* Header: Product + Brand */}
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.productName}>
                            {item.Product_Name || "--"}
                        </Text>
                        <Text style={styles.brandName}>
                            {item.BrandGet || "--"}
                        </Text>
                    </View>

                    <View style={styles.amountContainer}>
                        <Text style={styles.amount}>
                            {formatCurrency(item.Final_Amo)}
                        </Text>
                    </View>
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Details Row */}
                <View style={styles.detailsRow}>
                    {/* Left Column */}
                    <View style={styles.detailsColumn}>
                        <Text style={styles.label}>Order No</Text>
                        <Text style={styles.value}>{item.So_Inv_No || "--"}</Text>

                        <Text style={styles.label}>Retailer</Text>
                        <Text style={styles.value}>{item.Retailer_Name || "--"}</Text>

                        <Text style={styles.label}>Qty</Text>
                        <Text style={styles.value}>
                            {item.Bill_Qty ?? item.Total_Qty ?? "--"}
                        </Text>
                    </View>

                    {/* Right Column */}
                    <View style={styles.detailsColumn}>
                        <Text style={styles.label}>Sales Person</Text>
                        <Text style={styles.value}>
                            {item.Sales_Person_Name || "--"}
                        </Text>

                        <Text style={styles.label}>Date</Text>
                        <Text style={styles.value}>{formatDate(item.Created_on)}</Text>

                        <Text style={styles.label}>Branch</Text>
                        <Text style={styles.value}>{item.Branch_Name || "--"}</Text>
                    </View>
                </View>
            </View>
        );
    };

    const handleCloseModal = () => {
        setModalVisible(false);
    };

    const toggleBrand = (brand: string) => {
        const set = new Set(expandedBrands);
        if (set.has(brand)) set.delete(brand);
        else set.add(brand);
        setExpandedBrands(set);
    };

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Sales Pending - Items"
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
                enableDynamicFilter={true}
                onClose={handleCloseModal}
                showToDate={true}
                title="Filter Options"
                fromLabel="From Date"
                toLabel="To Date"
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

                        {/* Brand Filter */}
                        <BrandFilter />

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
                        {brandWiseUIData.map(({ brand, items }) => {
                            const isOpen = expandedBrands.has(brand);

                            return (
                                <View key={brand} style={styles.brandCard}>
                                    <TouchableOpacity
                                        style={styles.brandBadge}
                                        onPress={() => toggleBrand(brand)}
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
                                                <Text style={styles.brandName}>{brand}</Text>
                                            </View>
                                            <Icon
                                                name={isOpen ? "expand-less" : "expand-more"}
                                                size={20}
                                                color={colors.text}
                                            />
                                        </View>

                                        <Text style={styles.brandItemCount}>Items: {items.length}</Text>
                                    </TouchableOpacity>

                                    {/* Pending Items List */}
                                    {isOpen &&
                                        items.map((item: Product, idx: number) => (
                                            <ItemWiseCard key={`${brand}-${idx}`} item={item} />
                                        ))}
                                </View>
                            );
                        })}


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

    });