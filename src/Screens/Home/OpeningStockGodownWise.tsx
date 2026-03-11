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
import { responsiveWidth, responsiveHeight } from "../../constants/helper";
import AppHeader from "../../Components/AppHeader";
import FilterModal from "../../Components/FilterModal";
import PaginationControls from "../../Components/PaginationControls";
import { API } from "../../constants/api";

const ITEMS_PER_PAGE = 20;

const buildUrlWithFilters = (baseUrl: string, from: string, to: string | null, filters: Record<string, string>) => {
  const params = new URLSearchParams();
  if (from) params.append("Fromdate", from);
  if (to) params.append("Todate", to || "");
  Object.keys(filters || {}).forEach((k) => {
    const v = filters[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      params.append(k, String(v));
    } else {
      params.append(k, "");
    }
  });
  return `${baseUrl}?${params.toString()}`;
};

const formatApiDate = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const OpeningStockGodownWise = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, typography } = useTheme();
  const styles = getStyles(typography, colors);

  const [fromDate, setFromDate] = React.useState<Date>(new Date());
  const [toDate, setToDate] = React.useState<Date>(new Date());
  const [modalVisible, setModalVisible] = React.useState(false);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());
  const [expandedBrands, setExpandedBrands] = React.useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = React.useState(1);
  const [refreshing, setRefreshing] = React.useState(false);
  const [sortBy, setSortBy] = React.useState<"name" | "count" | "balance">("name");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");
  const [dynamicFilters, setDynamicFilters] = React.useState<Record<string, string>>({});
  const [externalFilterTemplate, setExternalFilterTemplate] = React.useState<any[] | null>(null);

  // --- LEVEL-2 states ---
  const [level2Columns, setLevel2Columns] = React.useState<any[]>([]);
  const [level2TypesOrder, setLevel2TypesOrder] = React.useState<number[]>([]);
  const [selectedValuesByType, setSelectedValuesByType] = React.useState<Record<number, string>>({});
  const [activeTypeValuesWithTotals, setActiveTypeValuesWithTotals] = React.useState<{ value: string; total: number }[]>([]);
  const [secondLevelValues, setSecondLevelValues] = React.useState<{ value: string; total: number }[]>([]);
  const [groupLevels, setGroupLevels] = React.useState<any[]>([]);

  const fromStr = React.useMemo(() => formatApiDate(fromDate), [fromDate]);
  const toStr = React.useMemo(() => formatApiDate(toDate), [toDate]);
  const REPORT_NAME = "stockInhand-Godown";

  const dynamicFiltersKey = React.useMemo(
    () => JSON.stringify(dynamicFilters),
    [dynamicFilters]
  );


  // Fetch GodownWise stock
  const {
    data: goDownWiseStockData = [],
    isLoading: isGodownWiseLoading,
    error: godownWiseError,
    refetch: refetchGodownWise,
  } = useQuery({
    queryKey: ["godownWiseStock", fromStr, toStr, dynamicFiltersKey],
    queryFn: async () => {
      const base = API.godownWiseStock(fromStr, toStr);
      const url = buildUrlWithFilters(
        base.split("?")[0],
        fromStr,
        toStr,
        dynamicFilters
      );
      const resp = await fetch(url);
      const json = await resp.json();
      return Array.isArray(json) ? json : (json.data || []);
    },
    enabled: !!fromStr && !!toStr,
  });
  const loadExternalFilters = React.useCallback(async () => {
    try {
      const url = API.getReportFilters(REPORT_NAME);
      const res = await fetch(url);
      const json = await res.json();
      setExternalFilterTemplate(Array.isArray(json?.data) ? json.data : []);
    } catch (err) {
      console.error("Failed to load report filters:", err);
      setExternalFilterTemplate([]);
    }
  }, []);

  React.useEffect(() => {
    if (modalVisible) loadExternalFilters();
  }, [modalVisible, loadExternalFilters]);

  // --- Helper: normalize column names to match API result keys ---
  const normalizeColumnKey = (colName: string) => {
    if (!colName) return colName;
    const key = colName.toLowerCase().replace(/\s+/g, "_");
    if (key.includes("brand")) return "Brand";
    if (key.includes("group_st")) return "Group_ST";
    if (key.includes("product") || key.includes("product_name")) return "Product_Name";
    if (key.includes("stock_item") && key.includes("name")) return "stock_item_name";
    if (key.includes("stock_group")) return "Stock_Group";
    if (key.includes("grade") && key.includes("item")) return "Grade_Item_Group";
    if (key.includes("s_sub") || key.includes("sub_group")) return "S_Sub_Group_1";
    if (key.includes("bag")) return "Bag";
    if (key.includes("item_name_modified")) return "Item_Name_Modified"
    return colName;
  };

  // --- compute totals for a column from itemWiseStockData 
  const computeValuesWithTotals = (columnName: string, parentPair?: { column: string; value: string } | undefined) => {
    const totals = new Map<string, number>();
    const qtyFieldCandidates = ["Bal_Qty", "Act_Bal_Qty", "OB_Bal_Qty", "OB_Act_Qty"];

    (goDownWiseStockData || []).forEach((it: any) => {
      if (parentPair) {
        const itemParentVal = it?.[parentPair.column];
        if (itemParentVal === undefined || itemParentVal === null || String(itemParentVal) === "") return;
        if (String(itemParentVal) !== parentPair.value) return;
      }

      let v = it?.[columnName];
      if (v === undefined || v === null || String(v).trim() === "") return;
      const valStr = String(v);
      let qty = 0;
      for (const f of qtyFieldCandidates) {
        const candidate = it[f];
        if (candidate !== undefined && candidate !== null && candidate !== "") {
          qty = Number(candidate) || 0;
          break;
        }
      }
      const prev = totals.get(valStr) || 0;
      totals.set(valStr, prev + qty);
    });

    return Array.from(totals.entries())
      .map(([value, total]) => ({ value, total }))
      .sort((a, b) => b.total - a.total);
  };

  React.useEffect(() => {
    loadExternalFilters();
  }, []);

  // --- Load level2 columns metadata from filter API 
  const loadLevel2Columns = React.useCallback(async () => {
    try {
      let resJson: any = null;

      if (!API.getReportFilters) {
        console.error("API.getReportFilters is not defined");
        setLevel2Columns([]);
        setLevel2TypesOrder([]);
        return;
      }

      const url = API.getReportFilters(REPORT_NAME);
      const resp = await fetch(url);
      const txt = await resp.text();

      try {
        resJson = JSON.parse(txt);
      } catch {
        console.warn("Level2 filter API returned non-JSON");
        resJson = [];
      }

      const arr = Array.isArray(resJson) ? resJson : resJson?.data || [];

      const lvl2Raw = arr.filter(
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
          f?.Type ??
          f?.type ??
          f?.filterType ??
          f?.FilterType ??
          f?.filter_type;

        const typeNum = rawType !== undefined ? Number(rawType) : NaN;

        return {
          ...f,
          Column_Name: String(columnName),
          Type: Number.isNaN(typeNum) ? null : typeNum,
          options: Array.isArray(f?.options) ? f.options : [],
        };
      });

      setLevel2Columns(lvl2);

      const uniqTypes = Array.from(
        new Set(
          lvl2
            .map((x: any) => Number(x.Type))
            .filter((t: number) => !isNaN(t))
        )
      ) as number[];

      uniqTypes.sort((a, b) => a - b);
      setLevel2TypesOrder(uniqTypes);

      setActiveTypeValuesWithTotals([]);
      setSecondLevelValues([]);
    } catch (err) {
      console.error("loadLevel2Columns error:", err);
      setLevel2Columns([]);
      setLevel2TypesOrder([]);
      setActiveTypeValuesWithTotals([]);
      setSecondLevelValues([]);
    }
  }, []);

  // Load level2 columns on mount and whenever dynamicFilters change 
  React.useEffect(() => {
    loadLevel2Columns();
    setSelectedValuesByType({});
    setCurrentPage(1);
    setExpandedGroups(new Set());
  }, [loadLevel2Columns, JSON.stringify(dynamicFilters)]);

  React.useEffect(() => {
    if (!level2TypesOrder.length) return;

    const firstType = level2TypesOrder[0];
    const colsForType = level2Columns.filter(c => c.Type === firstType);
    if (!colsForType.length) return;

    const mappedCol = normalizeColumnKey(colsForType[0].Column_Name);
    const newVals = computeValuesWithTotals(mappedCol);

    setActiveTypeValuesWithTotals(prev =>
      JSON.stringify(prev) === JSON.stringify(newVals) ? prev : newVals
    );

    setSecondLevelValues(prev =>
      JSON.stringify(prev) === JSON.stringify([]) ? prev : []
    );
  }, [
    goDownWiseStockData,
    level2Columns,
    level2TypesOrder,
    selectedValuesByType
  ]);


  React.useEffect(() => {
    if (!externalFilterTemplate?.length) return;

    const groupFilters = externalFilterTemplate
      .filter((f: any) => f.filterType === "GROUP_FILTER" || f.isGroupFilter)
      .sort((a: any, b: any) => Number(a.Level_Id) - Number(b.Level_Id));

    if (!groupFilters.length) {
      setGroupLevels([{ columnName: "Brand", Level_Id: 1 }]);
      return;
    }

    const normalized = groupFilters.map((g: any) => ({
      ...g,
      columnName: normalizeColumnKey(g.columnName),
    }));

    setGroupLevels(normalized);

  }, [externalFilterTemplate]);


  // ---- Filtering pipeline 
  const applyLevel2FiltersToRaw = (rawData: any[]) => {
    if (!level2TypesOrder || level2TypesOrder.length === 0) return rawData;
    let filtered = [...rawData];
    level2TypesOrder.forEach((t) => {
      const selVal = selectedValuesByType[t];
      if (!selVal) return;
      const cols = level2Columns.filter((c) => c.Type === t);
      if (!cols || cols.length === 0) return;
      const colName = cols[0].Column_Name;
      const mappedCol = normalizeColumnKey(colName);

      filtered = filtered.filter((it: any) => {
        if (it && it[mappedCol] !== undefined && it[mappedCol] !== null) {
          if (String(it[mappedCol]) === selVal) return true;
        }
        return false;
      });
    });

    return filtered;
  };

  const searchRecursive = (groups: any[]): any[] => {
    const q = searchQuery?.trim().toLowerCase();
    if (!q) return groups;

    return groups
      .map((grp) => {
        const nameMatch = grp.groupName?.toLowerCase().includes(q);

        if (!Array.isArray(grp.children)) return null;

        if (grp.children[0]?.Product_Id) {
          const filteredItems = grp.children.filter((it: any) =>
            Object.values(it).some(
              (v) =>
                typeof v === "string" &&
                v.toLowerCase().includes(q)
            )
          );

          if (nameMatch || filteredItems.length)
            return { ...grp, children: filteredItems };

          return null;
        }

        const nested = searchRecursive(grp.children);

        if (nameMatch || nested.length)
          return { ...grp, children: nested };

        return null;
      })
      .filter(Boolean);
  };

  // --- Level2 Chip UI ---
  const Level2Filter = () => {
    if (!level2TypesOrder || level2TypesOrder.length === 0) return null;

    return (
      <>
        {level2TypesOrder.map((typeNum, idx) => {

          // Show next level only if previous level selected
          if (idx > 0) {
            const prevType = level2TypesOrder[idx - 1];
            const prevSelected = selectedValuesByType[prevType];

            if (!prevSelected) return null;
          }

          const cols = level2Columns.filter((c) => c.Type === typeNum);
          if (!cols || cols.length === 0) return null;

          const primaryCol = cols[0];
          const colName = primaryCol.Column_Name;

          let parentPair: { column: string; value: string } | undefined;

          if (idx > 0) {
            const parentType = level2TypesOrder[idx - 1];
            const selParent = selectedValuesByType[parentType];

            if (selParent) {
              const parentCols = level2Columns.filter((c) => c.Type === parentType);
              if (parentCols.length > 0) {
                parentPair = {
                  column: parentCols[0].Column_Name,
                  value: selParent
                };
              }
            }
          }

          const mappedCol = normalizeColumnKey(colName);
          const valuesWithTotals = computeValuesWithTotals(mappedCol, parentPair);

          const selectedForThisType = selectedValuesByType[typeNum] || "";

          return (
            <View key={`lvl2-type-${typeNum}`} style={{ marginVertical: 6 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.level2FilterContainer}>

                <TouchableOpacity
                  style={[styles.brandFilterButton, !selectedForThisType && styles.brandFilterButtonActive]}
                  onPress={() => {
                    const newSel = { ...selectedValuesByType };
                    delete newSel[typeNum];

                    level2TypesOrder.forEach((t) => {
                      if (t > typeNum) delete newSel[t];
                    });

                    setSelectedValuesByType(newSel);
                  }}
                >
                  <Text style={[styles.brandFilterText, !selectedForThisType && styles.brandFilterTextActive]}>
                    All
                  </Text>
                </TouchableOpacity>

                {valuesWithTotals.map(({ value, total }) => {
                  const isSelected = selectedForThisType === value;

                  return (
                    <TouchableOpacity
                      key={`${typeNum}-${value}`}
                      style={[styles.brandFilterButton, isSelected && styles.brandFilterButtonActive]}
                      onPress={() => {
                        const newSel: Record<number, string> = {
                          ...selectedValuesByType,
                          [typeNum]: value
                        };

                        level2TypesOrder.forEach((t) => {
                          if (t > typeNum) delete newSel[t];
                        });

                        setSelectedValuesByType(newSel);
                      }}
                    >
                      <Text style={[styles.brandFilterText, isSelected && styles.brandFilterTextActive]}>
                        {value} ({formatNumber(total)})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          );
        })}

      </>
    );
  };

  const formatNumber = (num: number) => {
    if (Math.abs(num) >= 10000000) return `${(num / 10000000).toFixed(1)}Cr`;
    if (Math.abs(num) >= 100000) return `${(num / 100000).toFixed(1)}L`;
    if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return String(num);
  };

  const handleApplyFiltersFromModal = (selected: Record<string, string>) => {
    const mapped: Record<string, string> = {};
    let index = 1;
    Object.keys(selected || {}).forEach((key) => {
      let value = selected[key];
      if (value === "All" || value === null || value === undefined) value = "";
      mapped[`filter${index}`] = value;
      index++;
    });
    setDynamicFilters(mapped);
    setModalVisible(false);
  };

  type GroupNode = {
    groupName: string;
    count: number;
    totalBalance: number;
    children: GroupNode[] | any[];
  };

  // Grouping function for godown wise
  const groupItemsRecursive = (
    items: any[],
    levelIndex: number = 0
  ): GroupNode[] | any[] => {
    if (levelIndex >= groupLevels.length) {
      return items;
    }

    const column = groupLevels[levelIndex]?.columnName;

    const grouped: Record<string, any[]> = {};

    items.forEach((item: any) => {
      const key = item?.[column] || "Others";

      if (!grouped[key]) grouped[key] = [];

      grouped[key].push(item);
    });

    return Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((key: string) => {
        const groupItems = grouped[key];

        const totalBalance = groupItems.reduce(
          (sum: number, it: any) => sum + (Number(it?.Bal_Qty) || 0),
          0
        );

        return {
          groupName: key,
          count: groupItems.length,
          totalBalance,
          children: groupItemsRecursive(groupItems, levelIndex + 1),
        };
      });
  };

  const toggleGodown = (godownName: string) => {
    const s = new Set(expandedGroups);

    if (s.has(godownName)) {
      s.delete(godownName);

      // collapse all brands under this godown
      const bs = new Set(expandedBrands);
      [...bs].forEach(k => {
        if (k.startsWith(godownName + "|")) bs.delete(k);
      });
      setExpandedBrands(bs);
    } else {
      s.add(godownName);
    }

    setExpandedGroups(s);
  };

  const toggleBrand = (key: string) => {
    const s = new Set(expandedBrands);

    if (s.has(key)) s.delete(key);
    else s.add(key);

    setExpandedBrands(s);
  };


  const getCurrentData = () => {
    const rawData = Array.isArray(goDownWiseStockData) ? goDownWiseStockData : [];
    const afterLevel2 = applyLevel2FiltersToRaw(rawData);
    const godownMap: Record<string, any[]> = {};
    afterLevel2.forEach((item: any) => {
      const godown = item?.Godown_Name || "Unknown";

      if (!godownMap[godown]) godownMap[godown] = [];

      godownMap[godown].push(item);
    });
    const grouped = Object.keys(godownMap).map((godown) => {
      const items = godownMap[godown];
      const totalBalance = items.reduce(
        (sum: number, it: any) =>
          sum + (Number(it?.Bal_Qty) || 0),
        0
      );
      return {
        groupName: godown,
        totalBalance,
        count: items.length,
        children: groupItemsRecursive(items, 0),
      };
    });
    const filtered = searchRecursive(grouped);
    const totalItems = filtered.length;
    const totalRecords = rawData.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginated = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    return { data: paginated, totalPages, totalItems, totalRecords };
  };

  const memoizedData = React.useMemo(() => {
    return getCurrentData();
  }, [
    goDownWiseStockData,
    searchQuery,
    sortBy,
    sortOrder,
    currentPage,
    selectedValuesByType,
    expandedGroups
  ]);

  const { data: displayData, totalPages, totalItems, totalRecords } = memoizedData;

  // Toggle group
  const toggleGroup = (groupName: string) => {
    const s = new Set(expandedGroups);
    if (s.has(groupName)) s.delete(groupName);
    else s.add(groupName);
    setExpandedGroups(s);
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchGodownWise();
    } finally {
      setRefreshing(false);
    }
  }, [refetchGodownWise]);

  React.useEffect(() => {
    setCurrentPage(1);
    setExpandedGroups(new Set());
  }, [searchQuery, sortBy, sortOrder, dynamicFilters]);

  const getBagCount = (qty?: number, bag?: string) => {
    if (!qty || !bag) return null;

    const bagSize = parseInt(bag.replace(/[^0-9]/g, ""), 10);
    if (!bagSize) return null;

    return Math.floor(qty / bagSize);
  };



  // Row components
  const GodownWiseHeader = () => {
    const COL_WIDTH = 90;
    return (
      <View style={[styles.tableRow, { backgroundColor: "#eee", paddingVertical: 6 }]}>
        <Text style={[styles.rowCell, { width: COL_WIDTH * 2, fontWeight: "bold" }]}>Name</Text>
        <Text style={[styles.rowCell, { width: COL_WIDTH, fontWeight: "bold" }]}>Cls</Text>
        <Text style={[styles.rowCell, { width: COL_WIDTH, fontWeight: "bold" }]}>OB</Text>
        <Text style={[styles.rowCell, { width: COL_WIDTH, fontWeight: "bold" }]}>In</Text>
        <Text style={[styles.rowCell, { width: COL_WIDTH, fontWeight: "bold" }]}>Out</Text>
        <Text style={[styles.rowCell, { width: COL_WIDTH, fontWeight: "bold" }]}>Unit</Text>
      </View>
    );
  };

  const GodownWiseRow = ({ item }: { item: any }) => {
    const COL_WIDTH = 90;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.tableRow}
        onPress={() =>
          navigation.navigate("transactionlistgodownitem", {
            ProductId: item.Product_Id,
            GodownId: item.Godown_Id,
            productName: item.stock_item_name,
            fromDate,
            toDate,
          })
        }
      >
        <Text style={[styles.rowCell, { width: COL_WIDTH * 2 }]} numberOfLines={2}>
          {item.Group_Name || item.stock_item_name}
        </Text>

        <Text
          style={[
            styles.rowCell,
            {
              width: COL_WIDTH,
              color:
                (item.Bal_Act_Qty ?? item.Act_Bal_Qty) >= 0
                  ? colors.primary
                  : colors.accent,
            },
          ]}
        >
          {(() => {
            const qty = item.Bal_Act_Qty ?? item.Act_Bal_Qty;
            const bagCount = getBagCount(qty, item.Bag);

            return bagCount
              ? `${qty} (${bagCount} nos)`
              : qty;
          })()}
        </Text>

        <Text style={[styles.rowCell, { width: COL_WIDTH }]}>
          {item.OB_Bal_Qty ?? item.OB_Act_Qty}
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
      </TouchableOpacity>
    );
  };

  const renderGroupLevel = (groups: any[], godown: string, level = 0) => {

    return groups.map((grp: any) => {

      const key = `${godown}-${level}-${grp.groupName}`;

      const expanded = expandedBrands.has(key);

      return (
        <View key={key} style={{ marginLeft: level * 10, marginBottom: 10 }}>

          <TouchableOpacity
            style={styles.brandHeader}
            onPress={() => toggleBrand(key)}
          >
            <Icon
              name={expanded ? "expand-less" : "expand-more"}
              size={20}
            />

            <Text style={styles.brandName}>{grp.groupName}</Text>

            <Text style={styles.brandBalance}>
              {formatNumber(grp.totalBalance)}
            </Text>
          </TouchableOpacity>

          {expanded && Array.isArray(grp.children) && (() => {

            const isItemLevel =
              grp.children.length > 0 &&
              grp.children[0]?.Product_Id !== undefined;

            return isItemLevel ? (
              <ScrollView horizontal>
                <View>
                  <GodownWiseHeader />
                  {grp.children.map((item: any, i: number) => (
                    <GodownWiseRow key={i} item={item} />
                  ))}
                </View>
              </ScrollView>
            ) : (
              renderGroupLevel(grp.children, godown, level + 1)
            );

          })()}

        </View>
      );
    });
  };


  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <AppHeader
        title="Stock - Godown Wise"
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
        onApply={(selected) => {
          const mapped: Record<string, string> = {};
          let index = 1;
          Object.keys(selected || {}).forEach((key) => {
            let value = selected[key];
            if (value === "All" || value === null || value === undefined) value = "";
            mapped[`filter${index}`] = value;
            index++;
          });
          setDynamicFilters(mapped);
          setModalVisible(false);
        }}
        onClose={() => setModalVisible(false)}
        showToDate={true}
        title="Filter Options"
        fromLabel="From Date"
        toLabel="To Date"
        reportName="stockInhand-Godown"
        expectedReportName="stockInhand-Godown"
        enableDynamicFilter={true}
        externalFilters={externalFilterTemplate || undefined}
      />

      <ScrollView
        style={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* LEVEL2 chips (before search) */}
        <Level2Filter />

        {/* Search */}
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color={colors.textSecondary} />
          <TextInput style={styles.searchInput} placeholder="Search by godown or item name..." placeholderTextColor={colors.textSecondary} value={searchQuery} onChangeText={setSearchQuery} />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Icon name="clear" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Sort controls */}
        <View style={styles.sortContainer}>
          <View style={styles.sortButtons}>
            <TouchableOpacity style={[styles.sortButton, sortBy === "name" && styles.sortButtonActive]} onPress={() => { if (sortBy === "name") setSortOrder(prev => prev === "asc" ? "desc" : "asc"); else { setSortBy("name"); setSortOrder("asc"); } }}>
              <Icon name={sortBy === "name" && sortOrder === "desc" ? "arrow-downward" : "arrow-upward"} size={16} color={sortBy === "name" ? colors.white : colors.text} />
              <Text style={[styles.sortButtonText, sortBy === "name" && styles.sortButtonTextActive]}>Name</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sortButton, sortBy === "count" && styles.sortButtonActive]} onPress={() => { if (sortBy === "count") setSortOrder(prev => prev === "asc" ? "desc" : "asc"); else { setSortBy("count"); setSortOrder("desc"); } }}>
              <Icon name={sortBy === "count" && sortOrder === "desc" ? "arrow-downward" : "arrow-upward"} size={16} color={sortBy === "count" ? colors.white : colors.text} />
              <Text style={[styles.sortButtonText, sortBy === "count" && styles.sortButtonTextActive]}>Count</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sortButton, sortBy === "balance" && styles.sortButtonActive]} onPress={() => { if (sortBy === "balance") setSortOrder(prev => prev === "asc" ? "desc" : "asc"); else { setSortBy("balance"); setSortOrder("desc"); } }}>
              <Icon name={sortBy === "balance" && sortOrder === "desc" ? "arrow-downward" : "arrow-upward"} size={16} color={sortBy === "balance" ? colors.white : colors.text} />
              <Text style={[styles.sortButtonText, sortBy === "balance" && styles.sortButtonTextActive]}>Balance</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Loading / Error / Content */}
        {isGodownWiseLoading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading stock data...</Text>
          </View>
        )}

        {!isGodownWiseLoading && godownWiseError && (
          <View style={styles.errorContainer}>
            <Icon name="error-outline" size={48} color={colors.accent} />
            <Text style={styles.errorText}>Error loading stock data</Text>
            <Text style={styles.errorSubtext}>{(godownWiseError as any)?.message || "Please try again later"}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
              <Icon name="refresh" size={20} color={colors.white} />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isGodownWiseLoading && !godownWiseError && displayData.length > 0 && (
          <>
            <View style={styles.summaryContainer}>
              <Text style={styles.summaryText}>
                Showing {displayData.length} godowns ({totalItems} total godowns, {totalRecords} total records)
              </Text>
            </View>

            {displayData.map((group: any, idx: number) => (
              <View key={group.groupName} style={styles.groupCard}>
                <TouchableOpacity style={styles.groupHeader} onPress={() => toggleGodown(group.groupName)}
                  activeOpacity={0.8}>
                  <View style={styles.groupHeaderLeft}>
                    <View style={styles.groupNameContainer}>
                      <Icon name="store" size={18} color={colors.primary} />
                      <Text style={styles.groupName}>{group.groupName}</Text>
                    </View>
                    <View style={styles.groupStats}>
                      <Text style={styles.groupCount}>Items: {group.count}</Text>
                      <Text style={[styles.groupBalance, { color: group.totalBalance >= 0 ? colors.primary : colors.accent }]}>Balance: {formatNumber(group.totalBalance)}</Text>
                    </View>
                  </View>
                  <Icon name={expandedGroups.has(group.groupName) ? "expand-less" : "expand-more"} size={24} color={colors.textSecondary} />
                </TouchableOpacity>

                {expandedGroups.has(group.groupName) && (
                  <View style={{ marginTop: 8 }}>

                    {renderGroupLevel(group.children, group.groupName)}

                  </View>
                )}


              </View>
            ))}

            {totalPages > 1 && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                totalRecords={totalRecords}
                onPageChange={(p) => setCurrentPage(p)}
              />
            )}
          </>
        )}

        {!isGodownWiseLoading && !godownWiseError && displayData.length === 0 && (
          <View style={styles.noDataContainer}>
            <Icon name="inventory" size={48} color={colors.textSecondary} />
            <Text style={styles.noDataText}>No stock data found</Text>
            <Text style={styles.noDataSubtext}>{searchQuery ? "Try adjusting your search terms" : "Please select a date range to view data"}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default OpeningStockGodownWise;

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
      marginTop: responsiveWidth(2),
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
      borderRightWidth: 1,
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
    brandHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 6,
      paddingHorizontal: 8,
      backgroundColor: "#f2f2f2",
      borderRadius: 6,
      marginBottom: 6,
    },
    brandName: {
      fontSize: 14,
      fontWeight: "600",
      flex: 1,
    },
    brandBalance: {
      fontSize: 13,
      fontWeight: "600",
    },
    level2FilterContainer: {
      flexDirection: "row",
      paddingVertical: 8,
      paddingHorizontal: 5
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
    rowContainer: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: responsiveHeight(1.2),
      paddingHorizontal: responsiveWidth(4),
    },

  });

