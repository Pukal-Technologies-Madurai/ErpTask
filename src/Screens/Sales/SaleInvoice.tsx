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
import { salesInvoice, getFilterColumnName } from "../../Api/Sales";
import { responsiveWidth, responsiveHeight } from "../../constants/helper";
import AppHeader from "../../Components/AppHeader";
import FilterModal from "../../Components/FilterModal";
import { formatCurrency, formatDate, formatTime } from "../../constants/utils";
import { MMKV } from "react-native-mmkv";

const SaleInvoice = ({ route }: { route: any }) => {
  const item = route.params || {};
  const branchIdProps = item.branchId;

  const { colors, typography } = useTheme();
  const styles = getStyles(typography, colors);
  const storage = new MMKV();
  const navigation =useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [fromDate, setFromDate] = React.useState<Date>(new Date());
  const [toDate, setToDate] = React.useState<Date>(new Date());
  const [userId, setUserId] = React.useState("");
  const [branchId, setBranchId] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [modalVisible, setModalVisible] = React.useState(false);
  const [expandedInvoices, setExpandedInvoices] = React.useState<Set<string>>(
    new Set()
  );
  const [currentPage, setCurrentPage] = React.useState(1);
  const [refreshing, setRefreshing] = React.useState(false);
  const [selectedFilters, setSelectedFilters] =
    React.useState<Record<string, string>>({});

  // --- LEVEL2 (dynamic) filter states ---
  const [level2Columns, setLevel2Columns] = React.useState<any[]>([]);
  const [level2TypesOrder, setLevel2TypesOrder] = React.useState<number[]>([]);
  const [activeType, setActiveType] = React.useState<number | null>(null);
  const [selectedValuesByType, setSelectedValuesByType] = React.useState<
    Record<number, string>
  >({});
  const [activeTypeValuesWithTotals, setActiveTypeValuesWithTotals] = React.useState<
    { value: string; total: number }[]
  >([]);
  const [secondLevelValues, setSecondLevelValues] = React.useState<
    { value: string; total: number }[]
  >([]);

  const ITEMS_PER_PAGE = 15;

  React.useEffect(() => {
    const uid = storage.getString("userId");
    const bid = storage.getString("branchId");
    if (uid) setUserId(uid);
    if (bid) setBranchId(bid);
  }, [branchId]);

  // --- fetch Level2 columns from backend and normalize ---
  React.useEffect(() => {
    (async () => {
      try {
        const res = await getFilterColumnName();
        const arr = Array.isArray(res) ? res : res?.data || [];
        const lvl2Raw = (arr || []).filter(
          (f: any) =>
            Number(f?.FilterLevel) === 2 ||
            Number(f?.Filter_Level) === 2 ||
            Number(f?.Filterlevel) === 2
        );

        const lvl2 = lvl2Raw.map((f: any) => {
          const columnName =
            f?.Column_Name ||
            f?.columnName ||
            f?.ColumnName ||
            f?.column_name ||
            f?.Column ||
            "";
          const rawType =
            f?.Type ?? f?.type ?? f?.filterType ?? f?.FilterType ?? f?.filter_type;
          const typeNum = rawType !== undefined ? Number(rawType) : NaN;
          const options =
            f?.options || f?.Options || f?.optionsList || f?.OptionsList || [];
          return {
            ...f,
            Column_Name: String(columnName),
            Type: Number.isNaN(typeNum) ? null : typeNum,
            options: Array.isArray(options) ? options : [],
          };
        });

        setLevel2Columns(lvl2);

        const uniqTypes = Array.from(
          new Set(lvl2.map((x: any) => Number(x.Type)).filter((t: number) => !isNaN(t)))
        ) as number[];

        uniqTypes.sort((a: number, b: number) => a - b);

        setLevel2TypesOrder(uniqTypes);

        if (uniqTypes.length > 0) setActiveType(uniqTypes[0]);
      } catch (err) {
        console.error("getFilterColumnName error:", err);
        setLevel2Columns([]);
        setLevel2TypesOrder([]);
        setActiveType(null);
      }
    })();
  }, []);

  const { data: invoiceData = [], isLoading, error, refetch } = useQuery({
    queryKey: [
      "salesInvoice",
      fromDate,
      toDate,
      userId,
      branchIdProps,
      JSON.stringify(selectedFilters),
      JSON.stringify(selectedValuesByType),
    ],
    queryFn: () =>
      salesInvoice(fromDate, toDate, userId, branchIdProps, selectedFilters),
    enabled: !!fromDate && !!toDate && !!userId && !!branchIdProps,
  });

  const normalizeColumnKey = (colName: string) => {
    if (!colName) return colName;
    const key = colName.toLowerCase().replace(/\s+/g, "_");
    if (key.includes("brand")) return "BrandGet";
    if (key.includes("product") || key.includes("product_name")) return "Product_Name";
    if (key.includes("item") && key.includes("name")) return "Item_Name";
    if (key.includes("stock_group")) return "Stock_Group";
    if (key.includes("ledger") || key.includes("ledger_name")) return "Ledger_Name";
    if (key.includes("ref") && key.includes("broker")) return "Ref_Brokers";
    if (key.includes("Voucher_Type")) return "Voucher_Type";
    return colName;
  };

  const computeValuesWithTotals = (
    columnName: string,
    parentPair?: { column: string; value: string } | undefined
  ) => {
    const totals = new Map<string, number>();

    invoiceData.forEach((inv: any) => {
      let parentMatchesInvoiceLevel = true;
      if (parentPair) {
        const invParentVal = inv?.[parentPair.column];
        if (
          invParentVal === undefined ||
          invParentVal === null ||
          String(invParentVal) === ""
        ) {
          parentMatchesInvoiceLevel = false;
        } else {
          parentMatchesInvoiceLevel = String(invParentVal) === parentPair.value;
        }
      }

      (inv.Products_List || []).forEach((p: any) => {
        let parentOk = true;
        if (parentPair) {
          const prodParentVal = p?.[parentPair.column] ?? p?.Stock_Info?.[parentPair.column];
          parentOk = parentMatchesInvoiceLevel || String(prodParentVal) === parentPair.value;
          if (!parentOk) return;
        }

        let v =
          p?.[columnName] ?? (p.Stock_Info && p.Stock_Info[columnName]) ?? inv?.[columnName];

        if (v === undefined || v === null || String(v).trim() === "") return;
        const valStr = String(v);
        const qty = Number(p.Bill_Qty) || 0;
        const prev = totals.get(valStr) || 0;
        totals.set(valStr, prev + qty);
      });
    });

    return Array.from(totals.entries())
      .map(([value, total]) => ({ value, total }))
      .sort((a, b) => b.total - a.total);
  };

React.useEffect(() => {
  // QUICK EXIT
  if (activeType == null) {
    if (activeTypeValuesWithTotals.length !== 0) setActiveTypeValuesWithTotals([]);
    if (secondLevelValues.length !== 0) setSecondLevelValues([]);
    return;
  }

  const colsForType = level2Columns.filter((c) => c.Type === activeType);
  if (!colsForType.length) {
    if (activeTypeValuesWithTotals.length !== 0) setActiveTypeValuesWithTotals([]);
    if (secondLevelValues.length !== 0) setSecondLevelValues([]);
    return;
  }

  const primaryCol = colsForType[0];
  const colName = primaryCol.Column_Name;

  // PARENT TYPE FINDER
  const idx = level2TypesOrder.indexOf(activeType);
  let parentPair: { column: string; value: string } | undefined;

  if (idx > 0) {
    const parentType = level2TypesOrder[idx - 1];
    const selectedParentValue = selectedValuesByType[parentType];

    if (!selectedParentValue) {
      if (activeTypeValuesWithTotals.length !== 0) setActiveTypeValuesWithTotals([]);
      if (secondLevelValues.length !== 0) setSecondLevelValues([]);
      return;
    }

    const parentCols = level2Columns.filter((c) => c.Type === parentType);
    if (parentCols.length > 0) {
      parentPair = {
        column: parentCols[0].Column_Name,
        value: selectedParentValue,
      };
    }
  }

  // NORMALIZED KEYS
  const mappedCol = normalizeColumnKey(colName);
  const parentForCompute = parentPair
    ? {
        column: normalizeColumnKey(parentPair.column),
        value: parentPair.value,
      }
    : undefined;

  // FIRST LEVEL VALUES
  const newValues = computeValuesWithTotals(mappedCol, parentForCompute);

  // ONLY UPDATE IF CHANGED (prevents warnings)
  if (JSON.stringify(newValues) !== JSON.stringify(activeTypeValuesWithTotals)) {
    setActiveTypeValuesWithTotals(newValues);
  }

  // SECOND LEVEL (TYPE 4 → TYPE 5)
  if (activeType === 4) {
    const type5Cols = level2Columns.filter((c) => c.Type === 5);

    if (type5Cols.length && selectedValuesByType[4]) {
      const type5ColName = normalizeColumnKey(type5Cols[0].Column_Name);

      const secondLevel = computeValuesWithTotals(type5ColName, {
        column: normalizeColumnKey(primaryCol.Column_Name),
        value: selectedValuesByType[4],
      });

      if (JSON.stringify(secondLevel) !== JSON.stringify(secondLevelValues)) {
        setSecondLevelValues(secondLevel);
      }
    } else {
      if (secondLevelValues.length !== 0) setSecondLevelValues([]);
    }
  } else {
    if (secondLevelValues.length !== 0) setSecondLevelValues([]);
  }
}, [
  activeType,
  level2Columns,
  level2TypesOrder,
  selectedValuesByType,
  invoiceData
]);

  // Reset pagination & expansion when filters change
  React.useEffect(() => {
    setCurrentPage(1);
    setExpandedInvoices(new Set());
  }, [searchQuery, selectedFilters, selectedValuesByType]);

  const getProcessedData = () => {
    let filtered = [...invoiceData];
    if (branchIdProps) {
      const branchIds = Array.isArray(branchIdProps)
        ? branchIdProps.map((id) => Number(id))
        : [Number(branchIdProps)];
      filtered = filtered.filter((invoice: any) =>
        branchIds.includes(invoice.Branch_Id)
      );
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (invoice: any) =>
          String(invoice.Do_Inv_No || "")
            .toLowerCase()
            .includes(query) ||
          String(invoice.Retailer_Name || "").toLowerCase().includes(query) ||
          String(invoice.Branch_Name || "").toLowerCase().includes(query)
      );
    }

    if (level2TypesOrder.length > 0) {
      level2TypesOrder.forEach((t, idx) => {
        const selVal = selectedValuesByType[t];
        if (!selVal) return;
        const cols = level2Columns.filter((c) => c.Type === t);
        if (!cols || cols.length === 0) return;
        const colName = cols[0].Column_Name;
        const mappedCol = normalizeColumnKey(colName);

        filtered = filtered.filter((inv: any) => {
          if (inv && inv[mappedCol] !== undefined && inv[mappedCol] !== null) {
            if (String(inv[mappedCol]) === selVal) return true;
          }
          const prodMatch = (inv.Products_List || []).some((p: any) => {
            const direct = p?.[mappedCol];
            if (direct !== undefined && direct !== null && String(direct) === selVal)
              return true;
            if (
              p.Stock_Info &&
              p.Stock_Info[mappedCol] !== undefined &&
              p.Stock_Info[mappedCol] !== null &&
              String(p.Stock_Info[mappedCol]) === selVal
            )
              return true;
            return false;
          });
          return prodMatch;
        });
      });
    }

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginated = filtered.slice(startIndex, endIndex);

    const totalAmount = filtered.reduce(
      (sum: number, inv: any) => sum + (Number(inv.Total_Invoice_value) || 0),
      0
    );

    return {
      data: paginated,
      totalPages: Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE)),
      totalItems: filtered.length,
      totalRecords: invoiceData.length,
      totalAmount,
    };
  };

  const {
    data: displayData,
    totalPages,
    totalItems,
    totalRecords,
    totalAmount,
  } = getProcessedData();

  const toggleInvoice = (invoiceId: string) => {
    const newExpanded = new Set(expandedInvoices);
    if (newExpanded.has(invoiceId)) newExpanded.delete(invoiceId);
    else newExpanded.add(invoiceId);
    setExpandedInvoices(newExpanded);
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const normalizeFilters = (filters: Record<string, string>) => {
    const result: Record<string, string> = {};
    Object.keys(filters || {}).forEach((key) => {
      const value = filters[key];
      result[key] =
        value === "All" || value === null || value === undefined ? "" : value;
    });
    return result;
  };

  // --------------------- UI Components ---------------------
  const Level2Filter = () => {
    if (!level2TypesOrder || level2TypesOrder.length === 0) return null;

    const type4Cols = level2Columns.filter((c) => c.Type === 4);
    const type5Cols = level2Columns.filter((c) => c.Type === 5);
    const type4Selected = selectedValuesByType[4] || "";

    return (
      <>
        {/* <View style={{ paddingHorizontal: 8, marginVertical: 4 }}>
          <Text style={[styles.brandFilterText, { fontWeight: "700" }]}>Type 4</Text>
        </View> */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.level2FilterContainer}>
          <TouchableOpacity
            style={[styles.brandFilterButton, !type4Selected && styles.brandFilterButtonActive]}
            onPress={() => {
              const newSel = { ...selectedValuesByType };
              delete newSel[4];
              delete newSel[5];
              setSelectedValuesByType(newSel);
            }}
          >
            <Text style={[styles.brandFilterText, !type4Selected && styles.brandFilterTextActive]}>All</Text>
          </TouchableOpacity>
          {activeTypeValuesWithTotals.map(({ value, total }) => {
            const isSelected = type4Selected === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.brandFilterButton, isSelected && styles.brandFilterButtonActive]}
                onPress={() => {
                  const newSel = { ...selectedValuesByType, 4: value };
                  // delete newSel[5];
                  setSelectedValuesByType(newSel);
                }}
              >
                <Text style={[styles.brandFilterText, isSelected && styles.brandFilterTextActive]}>
                  {value} ({total})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {type4Selected && secondLevelValues.length > 0 && (
          <>
            {/* <View style={{ paddingHorizontal: 8, marginVertical: 4 }}>
              <Text style={[styles.brandFilterText, { fontWeight: "700" }]}>Type 5</Text>
            </View> */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.level2FilterContainer}>
              <TouchableOpacity
                style={[styles.brandFilterButton, !selectedValuesByType[5] && styles.brandFilterButtonActive]}
                onPress={() => {
                  const newSel = { ...selectedValuesByType };
                  delete newSel[5];
                  setSelectedValuesByType(newSel);
                }}
              >
                <Text style={[styles.brandFilterText, !selectedValuesByType[5] && styles.brandFilterTextActive]}>All</Text>
              </TouchableOpacity>
              {secondLevelValues.map(({ value, total }) => {
                const isSelected = selectedValuesByType[5] === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[styles.brandFilterButton, isSelected && styles.brandFilterButtonActive]}
                    onPress={() => {
                      const newSel = { ...selectedValuesByType, 5: value };
                      setSelectedValuesByType(newSel);
                    }}
                  >
                    <Text style={[styles.brandFilterText, isSelected && styles.brandFilterTextActive]}>
                      {value} ({total})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}
      </>
    );
  };

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

  const InvoiceCard = ({ invoice }: { invoice: any }) => {
    const isExpanded = expandedInvoices.has(invoice.Do_Id);
    const getFormattedDate = (dateString: string) => {
      try {
        return formatDate(new Date(dateString));
      } catch {
        return "--";
      }
    };

    return (
      <View style={styles.orderCard}>
        <TouchableOpacity
          style={styles.orderHeader}
          onPress={() => toggleInvoice(invoice.Do_Id)}
          activeOpacity={0.8}
        >
          <View style={styles.orderHeaderContent}>
            <View style={styles.leftColumn}>
              <Text style={styles.retailerName} numberOfLines={2}>
                {invoice.Retailer_Name || "--"}
              </Text>
              <View style={styles.dateTimeRow}>
                <View style={styles.dateTimeItem}>
                  <Icon name="event" size={12} color={colors.textSecondary} />
                  <Text style={styles.dateTimeText}>
                    {invoice.Created_on ? getFormattedDate(invoice.Created_on) : "--"}
                  </Text>
                </View>
                <View style={styles.dateTimeItem}>
                  <Icon name="schedule" size={12} color={colors.textSecondary} />
                  <Text style={styles.dateTimeText}>
                    {invoice.Created_on ? formatTime(invoice.Created_on) : "--"}
                  </Text>
                </View>
              </View>
              <View style={styles.invoiceIdRow}>
                <Icon name="receipt" size={14} color={colors.primary} />
                <Text style={styles.invoiceIdText} numberOfLines={1}>
                  {invoice.Do_Inv_No || "--"}
                </Text>
              </View>
              <View style={styles.invoiceIdRow}>
                <Icon name="receipt" size={14} color={colors.primary} />
                <Text style={styles.invoiceIdText} numberOfLines={1}>
                  {invoice.VoucherTypeGet || "--"}
                </Text>
              </View>
            </View>

            <View style={styles.rightColumn}>
              <Text style={styles.totalAmount}>
                {invoice.Total_Invoice_value ? formatCurrency(invoice.Total_Invoice_value) : "--"}
              </Text>
              {invoice.Ref_Brokers ? (
                <View style={styles.refBrokerRow}>
                  <Icon name="groups" size={12} color={colors.textSecondary} />
                  <Text style={styles.refBrokerText} numberOfLines={1}>
                    {invoice.Ref_Brokers}
                  </Text>
                </View>
              ) : (
                <View style={{ height: 18 }} />
              )}
              <View style={styles.createdByRow}>
                <Icon name="person" size={14} color={colors.textSecondary} />
                <Text style={styles.createdByText} numberOfLines={1}>
                  {invoice.Created_BY_Name || "--"}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.orderDetails}>
            <View style={styles.essentialInfo}>
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Icon name="business" size={16} color={colors.primary} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Branch</Text>
                    <Text style={styles.infoValue} numberOfLines={1}>
                      {invoice.Branch_Name}
                    </Text>
                  </View>
                </View>
                <View style={styles.infoItem}>
                  <Icon name="account-balance" size={16} color={colors.success} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Before Tax</Text>
                    <Text style={styles.infoValue}>
                      {formatCurrency(invoice.Total_Before_Tax)}
                    </Text>
                  </View>
                </View>
                <View style={styles.infoItem}>
                  <Icon name="receipt" size={16} color={colors.warning} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Tax</Text>
                    <Text style={styles.infoValue}>{formatCurrency(invoice.Total_Tax)}</Text>
                  </View>
                </View>
              </View>
            </View>

            {invoice.Products_List && invoice.Products_List.length > 0 && (
              <View style={styles.productsTable}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCell, styles.productNameCell]}>Product</Text>
                  <Text style={styles.tableCell}>Qty</Text>
                  <Text style={styles.tableCell}>Rate</Text>
                  <Text style={styles.tableCell}>Amount</Text>
                </View>
                {invoice.Products_List.map((product: any, index: number) => (
                  <View key={index} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.productNameCell]} numberOfLines={4}>
                      {product.Product_Name}
                    </Text>
                    <Text style={styles.tableCell}>{product.Bill_Qty}</Text>
                    <Text style={styles.tableCell}>{formatCurrency(product.Item_Rate).replace("₹", "")}</Text>
                    <Text style={styles.tableCell}>{formatCurrency(product.Final_Amo).replace("₹", "")}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const PaginationControls = () => (
    <View style={styles.paginationContainer}>
      <TouchableOpacity
        style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
        onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
      >
        <Icon name="chevron-left" size={20} color={currentPage === 1 ? colors.textSecondary : colors.primary} />
      </TouchableOpacity>

      <Text style={styles.pageInfo}>
        Page {currentPage} of {totalPages} ({totalItems} invoices, {totalRecords} total records)
      </Text>

      <TouchableOpacity
        style={[styles.pageButton, currentPage === totalPages && styles.pageButtonDisabled]}
        onPress={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
      >
        <Icon name="chevron-right" size={20} color={currentPage === totalPages ? colors.textSecondary : colors.primary} />
      </TouchableOpacity>
    </View>
  );

  const handleCloseModal = () => setModalVisible(false);

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
        reportName="Sales Invoice"
        expectedReportName="Sales Invoice"
        enableDynamicFilter={true}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
        onApply={(filters) => {
          const cleaned = normalizeFilters(filters);
          setSelectedFilters(cleaned);
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {isLoading && <View style={styles.loadingContainer}><Text style={styles.loadingText}>Loading invoices...</Text></View>}

        {!isLoading && error && (
          <View style={styles.errorContainer}>
            <Icon name="error-outline" size={48} color={colors.accent} />
            <Text style={styles.errorText}>Error loading invoices</Text>
            <Text style={styles.errorSubtext}>{(error as any)?.message || "Please try again later"}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
              <Icon name="refresh" size={20} color={colors.white} />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoading && !error && invoiceData.length > 0 && (
          <>
            <SummaryCards />

            {/* LEVEL2 dynamic filter */}
            <Level2Filter />

            {/* Search */}
            <View style={styles.searchContainer}>
              <Icon name="search" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by invoice number, retailer, or branch..."
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

            {displayData.map((invoice, index) => <InvoiceCard key={invoice.Do_Id} invoice={invoice} />)}

            {totalPages > 1 && <PaginationControls />}
          </>
        )}

        {!isLoading && !error && invoiceData.length === 0 && (
          <View style={styles.noDataContainer}>
            <Icon name="receipt" size={48} color={colors.textSecondary} />
            <Text style={styles.noDataText}>No invoices found</Text>
            <Text style={styles.noDataSubtext}>Please select a date range to view invoices</Text>
          </View>
        )}

        {!isLoading && !error && invoiceData.length > 0 && displayData.length === 0 && (
          <View style={styles.noDataContainer}>
            <Icon name="search-off" size={48} color={colors.textSecondary} />
            <Text style={styles.noDataText}>No results found</Text>
            <Text style={styles.noDataSubtext}>Try adjusting your search or filter criteria</Text>
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
      backgroundColor: colors.white,
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
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 6,
      lineHeight: 20,
      flexWrap: 'wrap',
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
    amountWrapper: {
      flexDirection: 'column',
      alignItems: 'flex-end',
    },
    refBrokerSection: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    brokerIcon: {
      marginRight: 4,
      fontSize: 14
    },
    brokerLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      maxWidth: 140,
    },
    dateTimeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 8,
    },
    bottomRowItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 16,
      flexShrink: 1,
    },
    bottomRowText: {
      fontSize: 13,
      color: colors.textPrimary,
      marginLeft: 4,
      fontWeight: '500',
      flexShrink: 1,
    },
    orderHeaderContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    leftColumn: {
      flex: 1,
      paddingRight: 8,
    },
    rightColumn: {
      flex: 1,
      alignItems: 'flex-end',
      paddingLeft: 8,
    },
    dateTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    dateTimeText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginLeft: 4,
    },
    invoiceIdRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    invoiceIdText: {
      fontSize: 13,
      color: colors.textDark,
      marginLeft: 4,
      fontWeight: '500',
    },
    totalAmount: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.success,
      marginBottom: 6,
    },
    refBrokerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    refBrokerText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginLeft: 4,
      maxWidth: 120,
    },
    createdByRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    createdByText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginLeft: 4,
      maxWidth: 120,
    },
    level2FilterContainer: {
      flexDirection: "row",
      paddingVertical: 8,
      paddingHorizontal: 5
    },


  });
