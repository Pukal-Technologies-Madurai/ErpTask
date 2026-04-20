import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
  TextInput,
  ScrollView,
} from "react-native";
import React, { useEffect, useState, useCallback } from "react";
import AppHeader from "../../Components/AppHeader";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../../Context/ThemeContext";
import Icon from "react-native-vector-icons/MaterialIcons";
import FilterModal from "../../Components/FilterModal";
import { getRetailers } from "../../Api/Transaction";
import { API } from "../../constants/api";
import { responsiveHeight, responsiveWidth } from "../../constants/helper";

// ✅ Retailer Type
type Retailer = {
  Retailer_Id: string;
  Retailer_Name?: string;
  AreaGet?: string;
  Mobile_No?: string;
  AC_Id?: string;
};

const ITEMS_PER_PAGE = 10;
const REPORT_NAME = "Transaction";

const Transaction = () => {
  const { typography, colors } = useTheme();
  const styles = getStyles(typography, colors);
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // 🔹 Dynamic Level-1 filters
  const [appliedDynamicFilters, setAppliedDynamicFilters] = useState<Record<string, string>>({});
  const [externalFilterTemplate, setExternalFilterTemplate] = useState<any[] | null>(null);

  const [retailers, setRetailers] = useState<Retailer[]>([]);

  // 🔹 Load external filter config
  const loadExternalFilters = useCallback(async () => {
    try {
      const res = await fetch(API.getReportFilters(REPORT_NAME));
      console.log("transaction filter", `${API.getReportFilters(REPORT_NAME)}`)
      const json = await res.json();
      setExternalFilterTemplate(Array.isArray(json?.data) ? json.data : []);
    } catch (e) {
      console.error("Failed to load filters", e);
      setExternalFilterTemplate([]);
    }
  }, []);

  useEffect(() => {
    loadExternalFilters();
  }, [loadExternalFilters]);

  // 🔹 Fetch retailers (Level-1 dynamic filters applied)
  const fetchRetailers = async () => {
    try {
      const data: Retailer[] = await getRetailers(
        fromDate,
        toDate,
        appliedDynamicFilters
      );
      setRetailers(data);
    } catch (err) {
      console.error(err);
      setRetailers([]);
    }
  };

  useEffect(() => {
    fetchRetailers();
  }, [fromDate, toDate, appliedDynamicFilters]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchRetailers();
    } finally {
      setRefreshing(false);
    }
  };

  // 🔹 Search filter
  const normalizeString = (str: string) =>
    str.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  const filteredData = retailers.filter((r) => {
    const search = normalizeString(searchQuery);
    const name = normalizeString(r.Retailer_Name ?? "");
    const area = normalizeString(r.AreaGet ?? "");
    return name.includes(search) || area.includes(search);
  });

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const displayData = filteredData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, appliedDynamicFilters]);

  const formatApiDate = (d: Date) =>
    d.toISOString().split("T")[0];

  const RetailerCard = ({ item }: { item: Retailer }) => (
    <TouchableOpacity
      style={styles.retailerCard}
      activeOpacity={0.7}
      onPress={() => navigation.navigate("transactionlist", {
        retailer: item, fromDate: formatApiDate(fromDate),
        toDate: formatApiDate(toDate),
        Ac_id: Number(item.AC_Id),
      })}
    >
      {/* Name */}
      <View style={styles.retailerRow}>
        <Icon name="storefront" size={20} color={colors.textSecondary} />
        <Text style={styles.retailerTitle}>{item.Retailer_Name}</Text>
      </View>

      {/* Address */}
      <View style={styles.retailerRow}>
        <Icon name="location-on" size={20} color={colors.textSecondary} />
        <Text style={styles.retailerText}>{item.AreaGet}</Text>
      </View>

      {/* Mobile */}
      <View style={styles.retailerRow}>
        <Icon name="phone" size={20} color={colors.textSecondary} />
        <Text style={styles.retailerText}>{item.Mobile_No || "--"}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title="Transaction Report"
        navigation={navigation}
        showRightIcon
        rightIconLibrary="MaterialIcon"
        rightIconName="filter-list"
        onRightPress={() => setModalVisible(true)}
      />

      {/* 🔹 Dynamic Level-1 FilterModal */}
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
        onApply={(filters) => {
          setAppliedDynamicFilters(filters || {});
          setModalVisible(false);
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
        showsVerticalScrollIndicator={false}
      >
        {/* Search */}
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search retailer by Name, Area..."
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

        {/* Retailer List */}
        {displayData.map((item) => (
          <RetailerCard key={item.Retailer_Id} item={item} />
        ))}

        {/* Pagination */}
        {totalPages > 1 && (
          <View style={styles.paginationContainer}>
            <TouchableOpacity
              style={[
                styles.arrowButton,
                currentPage === 1 && styles.arrowButtonDisabled,
              ]}
              disabled={currentPage === 1}
              onPress={() => setCurrentPage(currentPage - 1)}
            >
              <Text style={styles.arrowText}>{"<"}</Text>
            </TouchableOpacity>

            <Text style={styles.pageInfo}>
              {currentPage} / {totalPages}
            </Text>

            <TouchableOpacity
              style={[
                styles.arrowButton,
                currentPage === totalPages && styles.arrowButtonDisabled,
              ]}
              disabled={currentPage === totalPages}
              onPress={() => setCurrentPage(currentPage + 1)}
            >
              <Text style={styles.arrowText}>{">"}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Transaction;


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
      marginTop: responsiveHeight(1),
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
    orderNumber1: {
      ...typography.subtitle2,
      fontWeight: "600",
      color: colors.accent,
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
      color: colors.textsecondary,
    },
    orderAmount: {
      ...typography.body1,
      color: colors.success,
      fontWeight: "600",
      marginTop: 6,
      maxWidth: "100%",
      overflow: "hidden",
      textAlign: "left",
      flexShrink: 0,
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
      fontSize: typography.fontSizeMedium,
      marginHorizontal: responsiveWidth(2),
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
    arrowButton: {
      paddingVertical: responsiveHeight(1),
      paddingHorizontal: responsiveWidth(3),
      backgroundColor: colors.primary,
      borderRadius: 6,
    },
    arrowButtonDisabled: {
      backgroundColor: colors.disabled || "#ccc",
    },
    arrowText: {
      color: colors.white,
      fontSize: typography.fontSizeLarge,
      fontWeight: "bold",
    },
    retailerCard: {
      backgroundColor: colors.white,
      borderRadius: responsiveWidth(2),
      marginHorizontal: responsiveWidth(4),
      marginVertical: responsiveHeight(0.8),
      padding: responsiveWidth(3),
      elevation: 2,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    retailerTitle: {
      ...typography.subtitle2,
      color: colors.primary,
      fontWeight: "600",
      marginBottom: responsiveHeight(0.6),
    },
    retailerText: {
      ...typography.body2,
      color: colors.textSecondary,
      marginBottom: responsiveHeight(0.4),
    },
    retailerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 2,
      gap: 8,
    },


  });