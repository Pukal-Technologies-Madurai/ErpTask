import {
    RefreshControl,
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Modal,
    FlatList,
} from "react-native";
import React, { useState, useCallback, useMemo } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../Context/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AppHeader from "../Components/AppHeader";
import FilterModal from "../Components/FilterModal";
import { getShetList } from "../Api/ShetSheet";
import { useQuery } from "@tanstack/react-query";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import dayjs from "dayjs";
import OpenCamera from "../Components/OpenCamera";

interface Staff {
    Id: string;
    Do_Id: string;
    Emp_Id: number;
    Emp_Type_Id: number;
    Emp_Name: string;
    Involved_Emp_Type: string;
}

interface StockDetail {
    Do_Date: string;
    Delivery_Order_Id: string;
    Item_Id: number;
    S_No: number;
    Godown_Name?: string;
    Product_Name: string;
    Product_Image_Name: string;
    UOM: string;
    Brand_Name: string;
    Bill_Qty: number;
    Act_Qty: number;
    Alt_Act_Qty: number;
    unitValue: number;
    itemRate: number;
    billedRate: number;
    quantityDifference: number;
}

interface DeliveryOrder {
    Do_Id: string;
    Do_Inv_No: string;
    Voucher_Type: string;
    voucherTypeGet: string;
    Do_Date: string;
    Retailer_Id: number;
    Delivery_Status: string;
    Delivery_Status_Id: number;
    retailerNameGet: string;
    Branch_Id: number;
    branchNameGet: string;
    Total_Invoice_value: number;
    Cancel_status: string;
    Created_by: string;
    Created_on: string;
    staffInvolvedStatus: number;
    createdOn: string;
    Narration: string;
    Created_BY_Name: string;
    imageStatus: "uploaded" | "pending";
    involvedStaffs: Staff[];
    stockDetails: StockDetail[];
}

const ShetSheet = () => {
    const { typography, colors } = useTheme();
    const styles = getStyles(typography, colors);
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const [modalVisible, setModalVisible] = useState(false);
    const [fromDate, setFromDate] = useState(new Date());
    const [toDate, setToDate] = useState(new Date());
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedFilter, setSelectedFilter] = useState("Date");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

    const filters = ["Date", "Party name", "Inv no", "Godown", "Voucher", "Driver", "Upload"];

    const {
        data: lrReportData = [],
        isLoading,
        refetch,
    } = useQuery<DeliveryOrder[]>({
        queryKey: ["shetSheet", fromDate],
        queryFn: () => getShetList(fromDate.toISOString().split("T")[0]),
        enabled: !!fromDate,
    });

    const onRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    const filteredData = useMemo(() => {
        const base = (() => {
            if (!searchQuery) return lrReportData;
            const query = searchQuery.toLowerCase();

            return lrReportData.filter(item => {
                if (selectedFilter === "Party name") {
                    return item.retailerNameGet.toLowerCase().includes(query);
                }
                if (selectedFilter === "Inv no") {
                    return item.Do_Inv_No.toLowerCase().includes(query);
                }
                if (selectedFilter === "Godown") {
                    const godownType = item.stockDetails?.[0]?.Godown_Name;
                    return godownType?.toLowerCase().includes(query) ?? false;
                }
                if (selectedFilter === "Voucher") {
                    return item.voucherTypeGet
                        ?.toLowerCase()
                        .replace(/\s+/g, '')
                        .includes(query.replace(/\s+/g, '')) ?? false;
                }
                if (selectedFilter === "Driver") {
                    return item.involvedStaffs?.some(
                        s =>
                            s.Involved_Emp_Type === "Load Man" &&
                            s.Emp_Name.toLowerCase().includes(query),
                    );
                }
                if (selectedFilter === "Upload") {
                    // query is exactly "uploaded" or "pending" (set by modal selection)
                    const isUploaded = item.imageStatus === "uploaded";
                    return query === "uploaded" ? isUploaded : !isUploaded;
                }
                // Default: search both if "Date" or other general filter is selected
                return (
                    item.Do_Inv_No.toLowerCase().includes(query) ||
                    item.retailerNameGet.toLowerCase().includes(query)
                );
            });
        })();

        return [...base].sort((a, b) => {
            const cmp = a.Do_Inv_No.localeCompare(b.Do_Inv_No, undefined, {
                numeric: true,
                sensitivity: "base",
            });
            return sortOrder === "asc" ? cmp : -cmp;
        });
    }, [lrReportData, searchQuery, selectedFilter, sortOrder]);

    const [selectionVisible, setSelectionVisible] = useState(false);
    const [selectionData, setSelectionData] = useState<
        { label: string; value: string }[]
    >([]);
    const [selectionTitle, setSelectionTitle] = useState("");

    const uniqueParties = useMemo(() => {
        const names = lrReportData
            .map(item => item.retailerNameGet)
            .filter(Boolean);
        const unique = [...new Set(names)].sort();
        return unique.map(name => ({ label: name, value: name }));
    }, [lrReportData]);

    const uniqueInvNos = useMemo(() => {
        const nos = lrReportData.map(item => item.Do_Inv_No).filter(Boolean);
        const unique = [...new Set(nos)].sort();
        return unique.map(no => ({ label: no, value: no }));
    }, [lrReportData]);

    const uniqueGodowns = useMemo(() => {
        const names = lrReportData
            .map(item => item.stockDetails?.[0]?.Godown_Name)
            .filter((name): name is string => Boolean(name));
        const unique = [...new Set(names)].sort();
        return unique.map(name => ({ label: name, value: name }));
    }, [lrReportData]);

    const uniqueDrivers = useMemo(() => {
        const drivers: string[] = [];
        lrReportData.forEach(item => {
            item.involvedStaffs?.forEach(staff => {
                if (staff.Involved_Emp_Type === "Load Man" && staff.Emp_Name) {
                    drivers.push(staff.Emp_Name);
                }
            });
        });
        const unique = [...new Set(drivers)].sort();
        return unique.map(name => ({ label: name, value: name }));
    }, [lrReportData]);

    const uniqueVouchers = useMemo(() => {
        const vouchers = lrReportData
            .map(item => item.voucherTypeGet)
            .filter(Boolean);
        const unique = [...new Set(vouchers)].sort();
        return unique.map(v => ({ label: v, value: v }));
    }, [lrReportData]);

    const handleFilterPress = (filter: string) => {
        setSelectedFilter(filter);
        if (filter === "Date") {
            setModalVisible(true);
        } else if (filter === "Party name") {
            setSelectionData(uniqueParties);
            setSelectionTitle("Select Party");
            setSelectionVisible(true);
        } else if (filter === "Inv no") {
            setSelectionData(uniqueInvNos);
            setSelectionTitle("Select Invoice Number");
            setSelectionVisible(true);
        } else if (filter === "Godown") {
            setSelectionData(uniqueGodowns);
            setSelectionTitle("Select Godown");
            setSelectionVisible(true);
        } else if (filter === "Voucher") {
            setSelectionData(uniqueVouchers);
            setSelectionTitle("Select Voucher");
            setSelectionVisible(true);
        } else if (filter === "Driver") {
            setSelectionData(uniqueDrivers);
            setSelectionTitle("Select Driver");
            setSelectionVisible(true);
        } else if (filter === "Upload") {
            setSelectionData([
                { label: "Uploaded", value: "uploaded" },
                { label: "Pending", value: "pending" },
            ]);
            setSelectionTitle("Select Upload Status");
            setSelectionVisible(true);
        }
    };

    const renderItem = ({ item }: { item: DeliveryOrder }) => {
        const isUploaded = item.imageStatus === "uploaded";
        const isPending = !isUploaded;

        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.navigate("ShetSheetDetail", { item })}
                style={styles.cardContainer}>
                <View style={styles.cardHeader}>
                    <Text style={styles.dateLabel}>
                        {dayjs(item.Do_Date).format("DD MMM YYYY")}
                    </Text>
                    <View
                        style={[
                            styles.statusBadge,
                            {
                                backgroundColor: isUploaded
                                    ? "#C8E6C9"
                                    : "#FFE082",
                            },
                        ]}>
                        <Text
                            style={[
                                styles.statusText,
                                {
                                    color: isUploaded ? "#2E7D32" : "#5D4037",
                                },
                            ]}>
                            {isUploaded ? "UPLOADED" : "PENDING"}
                        </Text>
                    </View>
                </View>

                <View style={styles.invRow}>
                    <Text style={styles.invNo}>{item.Do_Inv_No}</Text>
                    {item.branchNameGet && (
                        <View
                            style={[
                                styles.tagContainer,
                                {
                                    backgroundColor: item.branchNameGet
                                        .toLowerCase()
                                        .includes("mill")
                                        ? "#E3F2FD"
                                        : "#E1F5FE",
                                },
                            ]}>
                            <Text
                                style={[
                                    styles.tagText,
                                    {
                                        color: item.branchNameGet
                                            .toLowerCase()
                                            .includes("mill")
                                            ? "#1976D2"
                                            : "#0288D1",
                                    },
                                ]}>
                                {item.stockDetails?.[0]?.Godown_Name}
                            </Text>
                            <MaterialIcons
                                name="keyboard-arrow-down"
                                size={14}
                                color={
                                    item.branchNameGet
                                        .toLowerCase()
                                        .includes("mill")
                                        ? "#1976D2"
                                        : "#0288D1"
                                }
                            />
                        </View>
                    )}
                </View>

                <Text style={styles.retailerName}>{item.retailerNameGet}</Text>

                <View style={styles.cardFooter}>
                    <View style={styles.deliveryDateRow}>
                        <MaterialIcons
                            name="calendar-today"
                            size={14}
                            color={colors.textSecondary}
                        />
                        <Text style={styles.deliveryDateText}>
                            {dayjs(item.Do_Date).format("DD MMM YYYY")}
                        </Text>
                    </View>

                    <View style={styles.totalContainer}>
                        <Text style={styles.totalLabel}>INVOICE TOTAL</Text>
                        <Text style={styles.totalValue}>
                            ₹{item.Total_Invoice_value.toLocaleString()}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <AppHeader
                title="Shet Sheet"
                navigation={navigation}
                showRightIcon
                rightIconLibrary="MaterialIcon"
                rightIconName="date-range"
                onRightPress={() => setModalVisible(true)}
            />

            <View style={styles.headerContent}>
                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <View style={styles.searchInputWrapper}>
                        <MaterialIcons
                            name="search"
                            size={20}
                            color={colors.textSecondary}
                        />
                        <TextInput
                            placeholder="Search order number or retailer..."
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholderTextColor={colors.textSecondary}
                        />
                    </View>
                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                        <Text style={styles.clearFilterText}>CLEAR FILTER</Text>
                    </TouchableOpacity>
                </View>

                {/* Filter Slider */}
                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={filters}
                    keyExtractor={item => item}
                    contentContainerStyle={styles.filterList}
                    renderItem={({ item }) => {
                        const isActive = selectedFilter === item;
                        return (
                            <TouchableOpacity
                                style={[
                                    styles.filterChip,
                                    item === "Date" && styles.dateChip,
                                    isActive &&
                                    item !== "Date" &&
                                    styles.activeFilterChip,
                                ]}
                                onPress={() => handleFilterPress(item)}>
                                {item === "Date" && (
                                    <MaterialIcons
                                        name="filter-list"
                                        size={16}
                                        color="#5D4037"
                                        style={{ marginRight: 4 }}
                                    />
                                )}
                                <Text
                                    style={[
                                        styles.filterChipText,
                                        item === "Date" && { color: "#5D4037" },
                                        isActive &&
                                        item !== "Date" &&
                                        styles.activeFilterChipText,
                                    ]}>
                                    {item}
                                </Text>
                                <MaterialIcons
                                    name="keyboard-arrow-down"
                                    size={16}
                                    color={
                                        item === "Date"
                                            ? "#5D4037"
                                            : isActive
                                                ? colors.primary
                                                : colors.textSecondary
                                    }
                                />
                            </TouchableOpacity>
                        );
                    }}
                />

                {/* Sort Row */}
                <View style={styles.sortRow}>
                    <MaterialIcons
                        name="sort"
                        size={16}
                        color={colors.textSecondary}
                    />
                    <Text style={styles.sortLabel}>Sort by Inv No:</Text>
                    <TouchableOpacity
                        style={[
                            styles.sortChip,
                            sortOrder === "asc" && styles.sortChipActive,
                        ]}
                        onPress={() => setSortOrder("asc")}>
                        <MaterialIcons
                            name="arrow-upward"
                            size={13}
                            color={sortOrder === "asc" ? colors.primary : colors.textSecondary}
                        />
                        <Text
                            style={[
                                styles.sortChipText,
                                sortOrder === "asc" && styles.sortChipTextActive,
                            ]}>
                            Ascending
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.sortChip,
                            sortOrder === "desc" && styles.sortChipActive,
                        ]}
                        onPress={() => setSortOrder("desc")}>
                        <MaterialIcons
                            name="arrow-downward"
                            size={13}
                            color={sortOrder === "desc" ? colors.primary : colors.textSecondary}
                        />
                        <Text
                            style={[
                                styles.sortChipText,
                                sortOrder === "desc" && styles.sortChipTextActive,
                            ]}>
                            Descending
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={filteredData}
                keyExtractor={item => item.Do_Id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                    />
                }
                ListEmptyComponent={
                    isLoading ? (
                        <ActivityIndicator
                            style={{ marginTop: 20 }}
                            color={colors.primary}
                        />
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No data found</Text>
                        </View>
                    )
                }
            />

            <FilterModal
                visible={modalVisible}
                fromDate={fromDate}
                toDate={toDate}
                onFromDateChange={setFromDate}
                onToDateChange={setToDate}
                onApply={() => {
                    setModalVisible(true); // Keep open if applying multiple? No, follow original
                    setModalVisible(false);
                    refetch();
                }}
                onClose={() => setModalVisible(false)}
                showToDate
                title="Select Date Range"
            />

            {/* Selection Modal for Party/Inv No */}
            <Modal
                visible={selectionVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setSelectionVisible(false)}>
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={styles.modalOverlayClose}
                        onPress={() => setSelectionVisible(false)}
                    />
                    <View style={styles.selectionModalContent}>
                        <View style={styles.selectionModalHeader}>
                            <Text style={styles.selectionModalTitle}>
                                {selectionTitle}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setSelectionVisible(false)}>
                                <MaterialIcons
                                    name="close"
                                    size={24}
                                    color={colors.text}
                                />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalSearchContainer}>
                            <MaterialIcons
                                name="search"
                                size={20}
                                color={colors.textSecondary}
                            />
                            <TextInput
                                style={styles.modalSearchInput}
                                placeholder={`Search ${selectionTitle.toLowerCase()}...`}
                                placeholderTextColor={colors.textSecondary}
                                onChangeText={text => {
                                    let source = uniqueParties;
                                    if (selectionTitle.includes("Invoice"))
                                        source = uniqueInvNos;
                                    else if (selectionTitle.includes("Godown"))
                                        source = uniqueGodowns;
                                    else if (selectionTitle.includes("Voucher"))
                                        source = uniqueVouchers;
                                    else if (selectionTitle.includes("Driver"))
                                        source = uniqueDrivers;
                                    else if (selectedFilter === "Upload")
                                        source = [
                                            { label: "Uploaded", value: "uploaded" },
                                            { label: "Pending", value: "pending" },
                                        ];

                                    const filtered = source.filter(i =>
                                        i.label
                                            .toLowerCase()
                                            .includes(text.toLowerCase()),
                                    );
                                    setSelectionData(filtered);
                                }}
                            />
                        </View>

                        <FlatList
                            data={selectionData}
                            keyExtractor={item => item.value}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.selectionItem}
                                    onPress={() => {
                                        setSearchQuery(item.value);
                                        setSelectionVisible(false);
                                    }}>
                                    <Text style={styles.selectionItemText}>
                                        {item.label}
                                    </Text>
                                    {searchQuery === item.value && (
                                        <MaterialIcons
                                            name="check"
                                            size={20}
                                            color={colors.primary}
                                        />
                                    )}
                                </TouchableOpacity>
                            )}
                            ItemSeparatorComponent={() => (
                                <View style={styles.separator} />
                            )}
                            contentContainerStyle={{ paddingBottom: 20 }}
                        />
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

export default ShetSheet;

const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.primary,
        },
        headerContent: {
            backgroundColor: colors.white,
            paddingBottom: 10,
        },
        searchContainer: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#EBEEFF",
            margin: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
        },
        searchInputWrapper: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
        },
        searchInput: {
            flex: 1,
            marginLeft: 8,
            fontSize: 14,
            color: colors.text,
            height: 40,
        },
        clearFilterText: {
            color: "#3F51B5",
            fontSize: 12,
            fontWeight: "700",
            marginLeft: 8,
        },
        filterList: {
            paddingHorizontal: 12,
            paddingBottom: 4,
        },
        sortRow: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            paddingTop: 6,
            paddingBottom: 8,
            gap: 6,
        },
        sortLabel: {
            fontSize: 12,
            color: colors.textSecondary,
            fontWeight: "600",
            marginRight: 2,
        },
        sortChip: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: colors.borderColor,
            backgroundColor: colors.white,
            gap: 3,
        },
        sortChipActive: {
            borderColor: colors.primary,
            backgroundColor: "#E8F5E9",
        },
        sortChipText: {
            fontSize: 12,
            color: colors.textSecondary,
        },
        sortChipTextActive: {
            color: colors.primary,
            fontWeight: "700",
        },
        filterChip: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.borderColor,
            marginRight: 8,
            backgroundColor: colors.white,
        },
        dateChip: {
            backgroundColor: "#FFE082",
            borderColor: "#FFE082",
        },
        activeFilterChip: {
            borderColor: colors.primary,
            backgroundColor: "#E8F5E9",
        },
        filterChipText: {
            fontSize: 14,
            color: colors.text,
            marginRight: 4,
        },
        activeFilterChipText: {
            color: colors.primary,
            fontWeight: "bold",
        },
        listContent: {
            minHeight: "100%",
            padding: 12,
            paddingBottom: 40,
            backgroundColor: colors.background,
        },
        cardContainer: {
            backgroundColor: colors.white,
            borderRadius: 16,
            padding: 16,
            marginBottom: 12,
            elevation: 3,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
        },
        cardHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
        },
        dateLabel: {
            fontSize: 13,
            color: colors.textSecondary,
        },
        statusBadge: {
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
        },
        statusText: {
            fontSize: 10,
            fontWeight: "bold",
        },
        invRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
        },
        invNo: {
            flex: 1,
            fontSize: 18,
            fontWeight: "bold",
            color: "#1A237E",
        },
        retailerName: {
            fontSize: 14,
            color: colors.textSecondary,
            marginBottom: 12,
        },
        godownRow: {
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
        },
        godownText: {
            fontSize: 12,
            color: colors.textSecondary,
            marginLeft: 4,
        },
        cardFooter: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-end",
            borderTopWidth: 0.5,
            borderTopColor: "#EEE",
            paddingTop: 12,
        },
        deliveryDateRow: {
            flexDirection: "row",
            alignItems: "center",
        },
        deliveryDateText: {
            fontSize: 12,
            color: colors.textSecondary,
            marginLeft: 6,
        },
        totalContainer: {
            alignItems: "flex-end",
        },
        totalLabel: {
            fontSize: 10,
            color: colors.textSecondary,
            fontWeight: "600",
            letterSpacing: 0.5,
        },
        totalValue: {
            fontSize: 18,
            fontWeight: "bold",
            color: "#1A237E",
        },
        tagContainer: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
        },
        tagText: {
            fontSize: 10,
            fontWeight: "bold",
            marginRight: 2,
        },
        emptyContainer: {
            alignItems: "center",
            padding: 20,
        },
        emptyText: {
            color: colors.textSecondary,
            fontSize: 16,
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
        },
        modalOverlayClose: {
            flex: 1,
        },
        selectionModalContent: {
            backgroundColor: colors.white,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: "70%",
            padding: 20,
        },
        selectionModalHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
        },
        selectionModalTitle: {
            fontSize: 18,
            fontWeight: "bold",
            color: colors.primary,
        },
        selectionItem: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingVertical: 14,
        },
        selectionItemText: {
            fontSize: 15,
            color: colors.text,
            flex: 1,
        },
        separator: {
            height: 1,
            backgroundColor: "#F0F0F0",
        },
        modalSearchContainer: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#F5F5F5",
            borderRadius: 12,
            paddingHorizontal: 12,
            marginBottom: 16,
        },
        modalSearchInput: {
            flex: 1,
            height: 45,
            marginLeft: 8,
            fontSize: 15,
            color: colors.text,
        },
    });
