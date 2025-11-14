import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    TextInput,
} from "react-native";
import React from "react";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "../../Context/ThemeContext";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";
import { RootStackParamList } from "../../Navigation/types";
import { salesInvoice } from "../../Api/Sales";
import { responsiveWidth, responsiveHeight } from "../../constants/helper";
import AppHeader from "../../Components/AppHeader";
import FilterModal from "../../Components/FilterModal";
import { formatCurrency, formatDate, formatTime } from "../../constants/utils";
import { MMKV } from "react-native-mmkv";

const SaleInvoice = ({ route }: { route: any }) => {
    const item = route.params || {};
    const branchIdProps = item.branchId;
    console.log("branchIdProps", branchIdProps)

    const { colors, typography } = useTheme();
    const styles = getStyles(typography, colors);
    const storage = new MMKV();
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const [fromDate, setFromDate] = React.useState<Date>(new Date());
    const [toDate, setToDate] = React.useState<Date>(new Date());
    const [userId, setUserId] = React.useState("");
    const [branchId, setBranchId] = React.useState("");
    const [searchQuery, setSearchQuery] = React.useState("");
    const [modalVisible, setModalVisible] = React.useState(false);
    const [expandedInvoices, setExpandedInvoices] = React.useState<Set<string>>(
        new Set(),
    );
    const [selectedBrand, setSelectedBrand] = React.useState("");
    const [currentPage, setCurrentPage] = React.useState(1);
    const [refreshing, setRefreshing] = React.useState(false);
    const [selectedItem, setSelectedItem] = React.useState("");
    const [itemsList, setItemsList] = React.useState<string[]>([]);
    const [selectedFilters, setSelectedFilters] = React.useState<Record<string, string>>({});

    const ITEMS_PER_PAGE = 15;

    React.useEffect(() => {
        const userId = storage.getString("userId")
        const branchId = storage.getString("branchId")
        if (userId) setUserId(userId);
        if (branchId) setBranchId(branchId);
    }, []);

    const {
        data: invoiceData = [],
        isLoading,
        error,
        refetch,
    } = useQuery({
        // include selectedFilters in the key; stringify to ensure deep changes trigger refetch
        queryKey: ["salesInvoice", fromDate, toDate, userId, branchIdProps, JSON.stringify(selectedFilters)],
        queryFn: () => salesInvoice(fromDate, toDate, userId, branchIdProps, selectedFilters),
        enabled: !!fromDate && !!toDate && !!userId && !!branchIdProps,
    });

    console.log("selectedfilters",selectedFilters.Party_Mailing_Name)

    // Filter and sort data
    const getProcessedData = () => {
        let filtered = [...invoiceData];

        // --- Branch filter (show only selected branch(es)) ---
        if (branchIdProps) {
            // Handle single or multiple branch selection gracefully
            const branchIds = Array.isArray(branchIdProps)
                ? branchIdProps.map(id => Number(id))
                : [Number(branchIdProps)];

            // Keep only invoices belonging to selected branches
            filtered = filtered.filter((invoice: any) => branchIds.includes(invoice.Branch_Id));
        }

        // --- Search filter ---
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (invoice: any) =>
                    invoice.Do_Inv_No?.toLowerCase().includes(query) ||
                    invoice.Retailer_Name?.toLowerCase().includes(query) ||
                    invoice.Branch_Name?.toLowerCase().includes(query)
            );
        }

        // --- Brand filter ---
        if (selectedBrand) {
            filtered = filtered.filter((invoice: any) =>
                invoice.Products_List?.some((product: { BrandGet: string }) =>
                    selectedBrand === "No Brand"
                        ? !product.BrandGet || product.BrandGet.trim() === ""
                        : product.BrandGet === selectedBrand
                )
            );
        }

        // --- Item filter ---
        if (selectedItem) {
            filtered = filtered.filter((invoice: any) =>
                invoice.Products_List?.some(
                    (product: any) =>
                        product.Item_Name === selectedItem &&
                        (selectedBrand ? product.BrandGet === selectedBrand : true)
                )
            );
        }


        // --- Pagination ---
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const paginatedData = filtered.slice(startIndex, endIndex);

        return {
            data: paginatedData,
            totalPages: Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE)),
            totalItems: filtered.length,
            totalRecords: invoiceData.length,
            totalAmount: filtered.reduce(
                (sum: number, invoice: any) => sum + (invoice.Total_Invoice_value || 0),
                0
            ),
        };
    };

    const {
        data: displayData,
        totalPages,
        totalItems,
        totalRecords,
        totalAmount,
    } = getProcessedData();

    // Toggle invoice expansion
    const toggleInvoice = (invoiceId: string) => {
        const newExpanded = new Set(expandedInvoices);
        if (newExpanded.has(invoiceId)) {
            newExpanded.delete(invoiceId);
        } else {
            newExpanded.add(invoiceId);
        }
        setExpandedInvoices(newExpanded);
    };

    // Handle refresh
    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        try {
            await refetch();
        } finally {
            setRefreshing(false);
        }
    }, [refetch]);

    // Reset pagination when filters change (searchQuery or selectedFilters)
    React.useEffect(() => {
        setCurrentPage(1);
        setExpandedInvoices(new Set());
    }, [searchQuery, selectedFilters]);

    React.useEffect(() => {
        if (selectedBrand) {
            const iList = getItemsByBrand(selectedBrand) as string[];
            setItemsList(iList);
            setSelectedItem("");
        } else {
            setItemsList([]);
            setSelectedItem("");
        }
    }, [selectedBrand]);


    // Get unique brands with their totals
    const getBrandsWithTotals = () => {
        const brandMap = new Map();

        invoiceData.forEach((invoice: any) => {
            invoice.Products_List?.forEach((product: any) => {
                const brand =
                    product.BrandGet && product.BrandGet.trim() !== ""
                        ? product.BrandGet
                        : "No Brand";
                if (!brandMap.has(brand)) {
                    brandMap.set(brand, {
                        brand,
                        count: 0,
                        amount: 0,
                    });
                }
                const brandInfo = brandMap.get(brand);
                brandInfo.count += product.Bill_Qty || 0;
                brandInfo.amount += product.Final_Amo || 0;
            });
        });

        return Array.from(brandMap.values()).sort((a, b) => b.count - a.count);
    };

    const getItemsByBrand = (brand: any) => {
        if (!brand) return [];

        const items = new Set();

        invoiceData.forEach((invoice: any) => {
            invoice.Products_List?.forEach((product: any) => {
                const b = product.BrandGet?.trim() || "No Brand";

                if (b === brand) {
                    if (product.Item_Name) items.add(product.Item_Name);
                }
            });
        });

        return Array.from(items);
    };

    // Brand Filter Component
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
                {brandsWithTotals.map(({ brand, count }: any) => (
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
                            {brand} ({count})
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        );
    };

    const ItemFilter = () => {
        if (!selectedBrand) return null;

        return (
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.brandFilterContainer}
            >
                <TouchableOpacity
                    style={[
                        styles.brandFilterButton,
                        !selectedItem && styles.brandFilterButtonActive,
                    ]}
                    onPress={() => setSelectedItem("")}
                >
                    <Text
                        style={[
                            styles.brandFilterText,
                            !selectedItem && styles.brandFilterTextActive,
                        ]}
                    >
                        All Items
                    </Text>
                </TouchableOpacity>

                {itemsList.map((itemName) => (
                    <TouchableOpacity
                        key={itemName}
                        style={[
                            styles.brandFilterButton,
                            selectedItem === itemName &&
                            styles.brandFilterButtonActive,
                        ]}
                        onPress={() => setSelectedItem(itemName)}
                    >
                        <Text
                            style={[
                                styles.brandFilterText,
                                selectedItem === itemName &&
                                styles.brandFilterTextActive,
                            ]}
                        >
                            {itemName}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        );
    };


    // Summary Cards Component
    const SummaryCards = () => (
        <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
                <Icon name="receipt" size={24} color={colors.primary} />
                <Text style={styles.summaryValue}>{totalItems}</Text>
                <Text style={styles.summaryLabel}>Invoices</Text>
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

    // Invoice Card Component
    const InvoiceCard = ({ invoice }: { invoice: any }) => {
        const isExpanded = expandedInvoices.has(invoice.Do_Id);
        const isActive = invoice.Cancel_status === "1";

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
                    onPress={() => toggleInvoice(invoice.Do_Id)}
                    activeOpacity={0.7}>
                    <View style={styles.orderHeaderLeft}>
                        <View style={styles.orderTopRow}>
                            <View style={styles.orderNumberContainer}>
                                <Text style={styles.orderNumber}>
                                    {invoice.Do_Inv_No}
                                </Text>
                                <View style={styles.dateTimeContainer}>
                                    <Icon
                                        name="event"
                                        size={12}
                                        color={colors.textSecondary}
                                        style={styles.dateTimeIcon}
                                    />
                                    <Text style={styles.orderDateTime}>
                                        {invoice.Created_on
                                            ? getFormattedDate(
                                                invoice.Created_on,
                                            )
                                            : "--"}
                                    </Text>
                                    <Icon
                                        name="schedule"
                                        size={12}
                                        color={colors.textSecondary}
                                        style={styles.dateTimeIcon}
                                    />
                                    <Text style={styles.orderDateTime}>
                                        {invoice.Created_on
                                            ? formatTime(invoice.Created_on)
                                            : "--"}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.orderAmount}>
                                {formatCurrency(invoice.Total_Invoice_value)}
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
                                    {invoice.Retailer_Name}
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
                                    {invoice.Created_BY_Name}
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
                                            {invoice.Branch_Name}
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
                                                invoice.Total_Before_Tax,
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
                                            {formatCurrency(invoice.Total_Tax)}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Products Table */}
                        {invoice.Products_List &&
                            invoice.Products_List.length > 0 && (
                                <View style={styles.productsTable}>
                                    <View style={styles.tableHeader}>
                                        <Text
                                            style={[
                                                styles.tableCell,
                                                styles.productNameCell,
                                            ]}>
                                            Product
                                        </Text>
                                        <Text style={styles.tableCell}>
                                            Qty
                                        </Text>
                                        <Text style={styles.tableCell}>
                                            Rate
                                        </Text>
                                        <Text style={styles.tableCell}>
                                            Amount
                                        </Text>
                                    </View>
                                    {invoice.Products_List.map(
                                        (product: any, index: number) => (
                                            <View
                                                key={index}
                                                style={styles.tableRow}>
                                                <Text
                                                    style={[
                                                        styles.tableCell,
                                                        styles.productNameCell,
                                                    ]}
                                                    numberOfLines={4}>
                                                    {product.Product_Name}
                                                </Text>
                                                <Text style={styles.tableCell}>
                                                    {product.Bill_Qty}
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
                Page {currentPage} of {totalPages} ({totalItems} invoices,{" "}
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
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Sales Invoice"
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
                enableDynamicFilter = {true}
                onFromDateChange={setFromDate}
                onToDateChange={setToDate}
                onApply={(filters) => {
                    console.log("filter", filters)
                    setSelectedFilters(filters);
                    setModalVisible(false);
                    refetch();
                }}
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
                        <Text style={styles.loadingText}>
                            Loading invoices...
                        </Text>
                    </View>
                )}

                {/* Error State */}
                {!isLoading && error && (
                    <View style={styles.errorContainer}>
                        <Icon
                            name="error-outline"
                            size={48}
                            color={colors.accent}
                        />
                        <Text style={styles.errorText}>
                            Error loading invoices
                        </Text>
                        <Text style={styles.errorSubtext}>
                            {error.message || "Please try again later"}
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
                {!isLoading && !error && invoiceData.length > 0 && (
                    <>
                        {/* Summary Cards */}
                        <SummaryCards />

                        {/* Brand Filter */}
                        <BrandFilter />

                        {/*Item Filter*/}
                        <ItemFilter />

                        {/* Search Bar */}
                        <View style={styles.searchContainer}>
                            <Icon
                                name="search"
                                size={20}
                                color={colors.textSecondary}
                            />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search by invoice number, retailer, or branch..."
                                placeholderTextColor={colors.textSecondary}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => setSearchQuery("")}>
                                    <Icon
                                        name="clear"
                                        size={20}
                                        color={colors.textSecondary}
                                    />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Results Info */}
                        <View style={styles.resultsContainer}>
                            <Text style={styles.resultsText}>
                                {/* Showing {displayData.length} invoices (
                                {totalItems} filtered, {totalRecords} total
                                records) */}
                            </Text>
                        </View>

                        {/* Invoices List */}
                        {displayData.map((invoice, index) => (
                            <InvoiceCard
                                key={invoice.Do_Id}
                                invoice={invoice}
                            />
                        ))}

                        {/* Pagination */}
                        {totalPages > 1 && <PaginationControls />}
                    </>
                )}

                {/* No Data State */}
                {!isLoading && !error && invoiceData.length === 0 && (
                    <View style={styles.noDataContainer}>
                        <Icon
                            name="receipt"
                            size={48}
                            color={colors.textSecondary}
                        />
                        <Text style={styles.noDataText}>No invoices found</Text>
                        <Text style={styles.noDataSubtext}>
                            Please select a date range to view invoices
                        </Text>
                    </View>
                )}

                {/* No Results State */}
                {!isLoading &&
                    !error &&
                    invoiceData.length > 0 &&
                    displayData.length === 0 && (
                        <View style={styles.noDataContainer}>
                            <Icon
                                name="search-off"
                                size={48}
                                color={colors.textSecondary}
                            />
                            <Text style={styles.noDataText}>
                                No results found
                            </Text>
                            <Text style={styles.noDataSubtext}>
                                Try adjusting your search or filter criteria
                            </Text>
                        </View>
                    )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default SaleInvoice;

const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.primary,
        },
        scrollContainer: {
            backgroundColor: colors.background,
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

        // Loading & Error States
        loadingContainer: {
            alignItems: "center",
            justifyContent: "center",
            padding: responsiveHeight(8),
        },
        loadingText: {
            ...typography.body1,
            color: colors.textSecondary,
        },
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

        brandFilterContainer: {
            paddingHorizontal: 16,
            marginBottom: 16,
        },
        brandFilterButton: {
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: colors.background,
            marginRight: 8,
            borderWidth: 1,
            borderColor: colors.borderColor,
        },
        brandFilterButtonActive: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        brandFilterText: {
            ...typography.body2,
            color: colors.textSecondary,
        },
        brandFilterTextActive: {
            color: colors.white,
        },

        // Summary Cards
        summaryContainer: {
            flexDirection: "row",
            paddingHorizontal: responsiveWidth(4),
            marginVertical: responsiveWidth(4),
            gap: responsiveWidth(3),
        },
        summaryCard: {
            flex: 1,
            backgroundColor: colors.white,
            padding: responsiveWidth(4),
            borderRadius: 12,
            alignItems: "center",
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        summaryValue: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "700",
            marginTop: responsiveWidth(2),
            textAlign: "center",
        },
        summaryLabel: {
            ...typography.caption,
            color: colors.textSecondary,
            marginTop: responsiveWidth(1),
            textAlign: "center",
        },

        // Search Container
        searchContainer: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(4),
            marginBottom: responsiveWidth(3),
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

        // Results Container
        resultsContainer: {
            paddingHorizontal: responsiveWidth(4),
            marginBottom: responsiveWidth(2),
        },
        resultsText: {
            ...typography.caption,
            color: colors.textSecondary,
            textAlign: "center",
        },

        // Order Card Styles
        orderCard: {
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
        orderHeader: {
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: responsiveWidth(4),
        },
        orderHeaderLeft: {
            flex: 1,
            marginRight: responsiveWidth(3),
        },
        orderTopRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: responsiveWidth(2),
        },
        orderNumberContainer: {
            flex: 1,
            marginRight: responsiveWidth(3),
        },
        orderNumber: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "700",
            marginBottom: responsiveWidth(1),
        },
        dateTimeContainer: {
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: responsiveWidth(1),
        },
        dateTimeIcon: {
            marginRight: 2,
        },
        orderDateTime: {
            ...typography.caption,
            color: colors.textSecondary,
        },
        orderAmount: {
            ...typography.h6,
            color: colors.primary,
            fontWeight: "700",
        },
        orderBottomRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
        },
        retailerContainer: {
            flex: 1,
            flexDirection: "row",
            alignItems: "flex-start",
            marginRight: responsiveWidth(3),
        },
        bottomRowIcon: {
            marginRight: responsiveWidth(1),
            marginTop: 2,
        },
        retailerName: {
            flex: 1,
            ...typography.body2,
            color: colors.text,
            fontWeight: "500",
        },
        salesPersonContainer: {
            flexDirection: "row",
            alignItems: "center",
        },
        salesPerson: {
            ...typography.caption,
            color: colors.textSecondary,
        },
        statusContainer: {
            flexDirection: "row",
            alignItems: "center",
            marginTop: responsiveWidth(2),
        },
        statusDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            marginRight: responsiveWidth(1),
        },
        statusText: {
            ...typography.caption,
            fontWeight: "600",
        },

        // Expanded Order Details
        orderDetails: {
            padding: responsiveWidth(4),
        },
        essentialInfo: {
            backgroundColor: colors.background,
            padding: responsiveWidth(2),
            borderRadius: responsiveHeight(2),
            marginBottom: responsiveWidth(3),
        },
        infoGrid: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: responsiveWidth(1.5),
        },
        infoItem: {
            flex: 1,
            minWidth: responsiveWidth(25),
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(2),
        },
        infoContent: {
            flex: 1,
        },
        infoLabel: {
            ...typography.caption,
            color: colors.textSecondary,
            marginBottom: 2,
        },
        infoValue: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "600",
        },
        // Products Table
        productsTable: {
            backgroundColor: colors.white,
            borderRadius: 12,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: colors.border,
        },
        tableHeader: {
            flexDirection: "row",
            backgroundColor: colors.backgroundAlt,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingVertical: responsiveWidth(2),
        },
        tableRow: {
            flexDirection: "row",
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingVertical: responsiveWidth(2),
        },
        tableCell: {
            ...typography.body2,
            color: colors.text,
            paddingHorizontal: responsiveWidth(2),
            flex: 1,
            textAlign: "right",
        },
        productNameCell: {
            flex: 2,
            textAlign: "left",
        },

        // Amount Section
        amountSection: {
            backgroundColor: colors.primary + "05",
            padding: responsiveWidth(3),
            borderRadius: 8,
        },
        amountGrid: {
            gap: responsiveWidth(1.5),
        },
        amountRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        amountLabel: {
            ...typography.body2,
            color: colors.textSecondary,
            fontWeight: "500",
        },
        amountValue: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "600",
        },
        totalRow: {
            borderTopWidth: 1,
            borderTopColor: colors.primary + "20",
            paddingTop: responsiveWidth(2),
            marginTop: responsiveWidth(1),
        },
        totalLabel: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "700",
        },
        totalValue: {
            ...typography.h6,
            color: colors.primary,
            fontWeight: "700",
        },

        // Products Section
        productsSection: {
            backgroundColor: colors.background,
            padding: responsiveWidth(3),
            borderRadius: 8,
        },
        productCard: {
            backgroundColor: colors.white,
            padding: responsiveWidth(3),
            borderRadius: 8,
            marginTop: responsiveWidth(2),
            borderLeftWidth: 3,
            borderLeftColor: colors.primary,
        },
        productHeader: {
            marginBottom: responsiveWidth(2),
        },
        productName: {
            ...typography.body1,
            color: colors.text,
            fontWeight: "600",
            marginBottom: responsiveWidth(1),
        },
        productBrand: {
            ...typography.caption,
            color: colors.primary,
            fontWeight: "600",
        },
        productDetails: {
            gap: responsiveWidth(1),
        },
        productRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        productLabel: {
            ...typography.caption,
            color: colors.textSecondary,
            fontWeight: "500",
            minWidth: responsiveWidth(20),
        },
        productValue: {
            ...typography.caption,
            color: colors.text,
            fontWeight: "600",
        },
        productAmount: {
            color: colors.primary,
            fontWeight: "700",
        },

        // Expenses Section
        expensesSection: {
            backgroundColor: colors.accent + "05",
            padding: responsiveWidth(3),
            borderRadius: 8,
        },
        expenseCard: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: colors.white,
            padding: responsiveWidth(3),
            borderRadius: 8,
            marginTop: responsiveWidth(2),
        },
        expenseName: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "600",
            flex: 1,
        },
        expenseAmount: {
            ...typography.body2,
            color: colors.accent,
            fontWeight: "700",
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
    });
