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

const formatApiDate = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

const buildUrlWithFilters = (
    baseUrl: string,
    from: string,
    to: string | null,
    filters: Record<string, string>,
) => {
    const params: string[] = [];

    if (from) {
        params.push(`Fromdate=${encodeURIComponent(from)}`);
    }

    if (to) {
        params.push(`Todate=${encodeURIComponent(to)}`);
    }

    Object.keys(filters || {}).forEach(k => {
        const v = filters[k];
        const value =
            v !== undefined && v !== null && String(v).trim() !== ""
                ? String(v)
                : "";
        params.push(`${encodeURIComponent(k)}=${encodeURIComponent(value)}`);
    });

    return `${baseUrl}?${params.join("&")}`;
};

const OpeningStockItemWise = () => {
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { colors, typography } = useTheme();
    const styles = getStyles(typography, colors);

    const [fromDate, setFromDate] = React.useState<Date>(new Date());
    const [toDate, setToDate] = React.useState<Date>(new Date());
    const [modalVisible, setModalVisible] = React.useState(false);

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
    const [dynamicFilters, setDynamicFilters] = React.useState<
        Record<string, string>
    >({});
    const [externalFilterTemplate, setExternalFilterTemplate] = React.useState<
        any[] | null
    >(null);

    // --- LEVEL-2 states ---
    const [level2Columns, setLevel2Columns] = React.useState<any[]>([]);
    const [level2TypesOrder, setLevel2TypesOrder] = React.useState<number[]>(
        [],
    );
    const [selectedValuesByType, setSelectedValuesByType] = React.useState<
        Record<number, string>
    >({});
    const [activeTypeValuesWithTotals, setActiveTypeValuesWithTotals] =
        React.useState<{ value: string; total: number }[]>([]);
    const [secondLevelValues, setSecondLevelValues] = React.useState<
        { value: string; total: number }[]
    >([]);
    const [groupByColumn, setGroupByColumn] =
        React.useState<string>("Stock_Group");
    const [groupLevels, setGroupLevels] = React.useState<any[]>([]);

    const fromStr = React.useMemo(() => formatApiDate(fromDate), [fromDate]);
    const toStr = React.useMemo(() => formatApiDate(toDate), [toDate]);
    const REPORT_NAME = "StockInhand";

    // --- fetch ItemWise stock
    const {
        data: itemWiseStockData = [],
        isLoading: isItemWiseLoading,
        error: itemWiseError,
        refetch: refetchItemWise,
    } = useQuery({
        queryKey: ["itemWiseStock", fromStr, toStr, dynamicFilters],
        queryFn: async () => {
            const base = API.itemWiseStock(fromStr, toStr);
            const url = buildUrlWithFilters(
                base.split("?")[0],
                fromStr,
                toStr,
                dynamicFilters,
            );
            const resp = await fetch(url);
            const json = await resp.json();
            return Array.isArray(json) ? json : json.data || [];
        },
        enabled: !!fromStr && !!toStr,
    });

    // ---- Load external filters for FilterModal (same as before) ----
    const loadExternalFilters = React.useCallback(async () => {
        try {
            const url = API.getReportFilters(REPORT_NAME);
            const res = await fetch(url);
            const json = await res.json();
            setExternalFilterTemplate(
                Array.isArray(json?.data) ? json.data : [],
            );
        } catch (err) {
            console.error("Failed to load report filters:", err);
            setExternalFilterTemplate([]);
        }
    }, []);

    const getGroupIcon = () => {
        if (groupByColumn.toLowerCase().includes("brand"))
            return "branding-watermark";
        if (groupByColumn.toLowerCase().includes("bag")) return "inventory";
        if (groupByColumn.toLowerCase().includes("grade")) return "layers";
        if (groupByColumn.toLowerCase().includes("group")) return "category";
        return "label";
    };

    React.useEffect(() => {
        if (modalVisible) loadExternalFilters();
    }, [modalVisible, loadExternalFilters]);

    // --- Helper: normalize column names to match API result keys ---
    const normalizeColumnKey = (colName: string) => {
        if (!colName) return colName;
        const key = colName.toLowerCase().replace(/\s+/g, "_");
        if (key.includes("brand")) return "Brand";
        if (key.includes("group_st")) return "Group_ST";
        if (key.includes("product") || key.includes("product_name"))
            return "Product_Name";
        if (key.includes("item") && key.includes("name"))
            return "stock_item_name";
        if (key.includes("stock_group")) return "Stock_Group";
        if (key.includes("grade") && key.includes("item"))
            return "Grade_Item_Group";
        if (key.includes("s_sub") || key.includes("sub_group"))
            return "S_Sub_Group_1";
        if (key.includes("bag")) return "Bag";
        return colName;
    };

    // --- compute totals for a column from itemWiseStockData (sums Bal_Qty or OB_Bal_Qty fallback) ---
    const computeValuesWithTotals = (
        columnName: string,
        parentPair?: { column: string; value: string } | undefined,
    ) => {
        const totals = new Map<string, number>();
        const qtyFieldCandidates = [
            "Bal_Qty",
            "Act_Bal_Qty",
            "OB_Bal_Qty",
            "OB_Act_Qty",
        ];

        (itemWiseStockData || []).forEach((it: any) => {
            // If parentPair exists, check parent's presence either on item or group
            if (parentPair) {
                const itemParentVal = it?.[parentPair.column];
                if (
                    itemParentVal === undefined ||
                    itemParentVal === null ||
                    String(itemParentVal) === ""
                )
                    return;
                if (String(itemParentVal) !== parentPair.value) return;
            }

            let v = it?.[columnName];
            if (v === undefined || v === null || String(v).trim() === "")
                return;
            const valStr = String(v);
            // choose a qty to sum: Bal_Qty preferred
            let qty = 0;
            for (const f of qtyFieldCandidates) {
                const candidate = it[f];
                if (
                    candidate !== undefined &&
                    candidate !== null &&
                    candidate !== ""
                ) {
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
        if (!externalFilterTemplate?.length) return;

        const groupFilters = (externalFilterTemplate || [])
            .filter(
                (f: any) =>
                    f.filterType === "GROUP_FILTER" || f.isGroupFilter === true,
            )
            .sort((a: any, b: any) => Number(a.Level_Id) - Number(b.Level_Id));

        if (!groupFilters.length) {
            setGroupLevels([{ columnName: "Stock_Group", Level_Id: 1 }]);
            setGroupByColumn("Stock_Group");
            return;
        }

        const normalized = groupFilters.map((g: any) => ({
            ...g,
            columnName: normalizeColumnKey(g.columnName),

            // ✅ Sort options alphabetically
            options: (g.options || []).sort((a: any, b: any) =>
                a.label.localeCompare(b.label),
            ),
        }));

        setGroupLevels(normalized);
        setGroupByColumn(normalized[0].columnName);
    }, [externalFilterTemplate]);

    React.useEffect(() => {
        loadExternalFilters();
    }, []);

    // --- Load level2 columns metadata from filter API (same endpoint used by SalesInvoice) ---
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
                    Number(f?.Filterlevel) === 2,
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
                        .filter((t: number) => !isNaN(t)),
                ),
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

    // Load level2 columns on mount and whenever dynamicFilters change (because Level-1 is dynamic from modal)
    React.useEffect(() => {
        loadLevel2Columns();
        // On level-1 (dynamicFilters) change we reset selected level2s (Option 1)
        setSelectedValuesByType({});
        // reset pagination / expanded groups
        setCurrentPage(1);
        setExpandedGroups(new Set());
    }, [loadLevel2Columns, JSON.stringify(dynamicFilters)]);

    // When the data or selectedValuesByType changes we may recompute some helper lists (optional)
    React.useEffect(() => {
        // Example: compute values for the first available type to show on load
        if (!level2TypesOrder || level2TypesOrder.length === 0) {
            setActiveTypeValuesWithTotals([]);
            setSecondLevelValues([]);
            return;
        }

        const firstType = level2TypesOrder[0];
        const colsForType = level2Columns.filter(c => c.Type === firstType);
        if (!colsForType.length) {
            setActiveTypeValuesWithTotals([]);
            setSecondLevelValues([]);
            return;
        }
        const primaryCol = colsForType[0].Column_Name;
        // find parent if exists
        const idx = level2TypesOrder.indexOf(firstType);
        let parentPair: { column: string; value: string } | undefined;
        if (idx > 0) {
            const parentType = level2TypesOrder[idx - 1];
            const selectedParentValue = selectedValuesByType[parentType];
            if (selectedParentValue) {
                const parentCols = level2Columns.filter(
                    c => c.Type === parentType,
                );
                if (parentCols.length > 0) {
                    parentPair = {
                        column: parentCols[0].Column_Name,
                        value: selectedParentValue,
                    };
                }
            }
        }

        const mappedCol = normalizeColumnKey(primaryCol);
        const parentForCompute = parentPair
            ? {
                  column: normalizeColumnKey(parentPair.column),
                  value: parentPair.value,
              }
            : undefined;
        const newVals = computeValuesWithTotals(mappedCol, parentForCompute);
        setActiveTypeValuesWithTotals(newVals);

        // if the firstType === 4 compute secondLevel (type 5) same as SalesInvoice
        if (firstType === 4) {
            const type5Cols = level2Columns.filter(c => c.Type === 5);
            if (type5Cols.length && selectedValuesByType[4]) {
                const type5ColName = normalizeColumnKey(
                    type5Cols[0].Column_Name,
                );
                const secondLevel = computeValuesWithTotals(type5ColName, {
                    column: normalizeColumnKey(primaryCol),
                    value: selectedValuesByType[4],
                });
                setSecondLevelValues(secondLevel);
            } else {
                setSecondLevelValues([]);
            }
        } else {
            setSecondLevelValues([]);
        }
    }, [
        itemWiseStockData,
        level2Columns,
        level2TypesOrder,
        JSON.stringify(selectedValuesByType),
    ]);

    // ---- Filtering pipeline (grouping & search & level2 filter application) ----

    const groupDataMultiLevel = (data: any[], levelIndex = 0) => {
        if (!groupLevels.length) return [];

        const column = groupLevels[levelIndex]?.columnName;

        const grouped = data.reduce((acc: any, item: any) => {
            const rawValue = item?.[column];
            const key =
                rawValue !== undefined &&
                rawValue !== null &&
                String(rawValue).trim() !== ""
                    ? String(rawValue)
                    : "Others";

            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
        }, {});

        const groups = Object.keys(grouped).map(key => {
            const items = grouped[key];

            const totalBalance = items.reduce(
                (sum: number, it: any) =>
                    sum + (it.Bal_Qty || it.Act_Bal_Qty || it.OB_Bal_Qty || 0),
                0,
            );

            const node: any = {
                groupName: key,
                count: items.length,
                totalBalance,
            };

            if (levelIndex < groupLevels.length - 1) {
                node.children = groupDataMultiLevel(items, levelIndex + 1);
            } else {
                node.items = items;
            }

            return node;
        });

        return groups;
    };

    const applyLevel2FiltersToRaw = (rawData: any[]) => {
        if (!level2TypesOrder || level2TypesOrder.length === 0) return rawData;
        let filtered = [...rawData];

        // For each type in order, if selected value exists, filter accordingly
        level2TypesOrder.forEach(t => {
            const selVal = selectedValuesByType[t];
            if (!selVal) return;
            const cols = level2Columns.filter(c => c.Type === t);
            if (!cols || cols.length === 0) return;
            const colName = cols[0].Column_Name;
            const mappedCol = normalizeColumnKey(colName);

            filtered = filtered.filter((it: any) => {
                // direct field match
                if (
                    it &&
                    it[mappedCol] !== undefined &&
                    it[mappedCol] !== null
                ) {
                    if (String(it[mappedCol]) === selVal) return true;
                }
                // fallback: no nested product list in itemWise data; so return false
                return false;
            });
        });

        return filtered;
    };

    const filterData = (groups: any[]) => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return groups;

        const filterGroup = (group: any): any | null => {
            // Check group name
            const groupMatch = String(group.groupName)
                .toLowerCase()
                .includes(q);

            // Check items
            let matchedItems = [];
            if (group.items) {
                matchedItems = group.items.filter((item: any) =>
                    Object.values(item || {}).some(
                        val =>
                            typeof val === "string" &&
                            val.toLowerCase().includes(q),
                    ),
                );
            }

            // Check children recursively
            let matchedChildren: any[] = [];
            if (group.children) {
                matchedChildren = group.children
                    .map((child: any) => filterGroup(child))
                    .filter(Boolean);
            }

            // If any match exists keep the group
            if (
                groupMatch ||
                matchedItems.length > 0 ||
                matchedChildren.length > 0
            ) {
                return {
                    ...group,
                    items: matchedItems.length ? matchedItems : group.items,
                    children: matchedChildren.length
                        ? matchedChildren
                        : group.children,
                };
            }

            return null;
        };

        return groups.map(g => filterGroup(g)).filter(Boolean);
    };

    const getCurrentData = () => {
        const rawData = Array.isArray(itemWiseStockData)
            ? itemWiseStockData
            : [];
        // Apply level2 client-side filters on raw data before grouping
        const afterLevel2 = applyLevel2FiltersToRaw(rawData);
        const grouped = groupDataMultiLevel(afterLevel2);
        const filtered = filterData(grouped);
        const totalItems = filtered.length;
        const totalRecords = rawData.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const paginated = filtered.slice(
            startIndex,
            startIndex + ITEMS_PER_PAGE,
        );
        return { data: paginated, totalPages, totalItems, totalRecords };
    };

    const {
        data: displayData = [],
        totalPages,
        totalItems,
        totalRecords,
    } = getCurrentData();

    const toggleGroup = (groupName: string) => {
        const s = new Set(expandedGroups);
        if (s.has(groupName)) s.delete(groupName);
        else s.add(groupName);
        setExpandedGroups(s);
    };

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        try {
            await refetchItemWise();
        } finally {
            setRefreshing(false);
        }
    }, [refetchItemWise]);

    React.useEffect(() => {
        setCurrentPage(1);
        setExpandedGroups(new Set());
    }, [
        searchQuery,
        sortBy,
        sortOrder,
        JSON.stringify(dynamicFilters),
        JSON.stringify(selectedValuesByType),
    ]);

    // --- Level2 Chip UI ---
    const Level2Filter = () => {
        if (!level2TypesOrder || level2TypesOrder.length === 0) return null;

        return (
            <>
                {level2TypesOrder.map(typeNum => {
                    const cols = level2Columns.filter(c => c.Type === typeNum);
                    if (!cols || cols.length === 0) return null;
                    const primaryCol = cols[0];
                    const colName = primaryCol.Column_Name;
                    // parent type
                    const idx = level2TypesOrder.indexOf(typeNum);
                    let parentPair:
                        | { column: string; value: string }
                        | undefined;
                    if (idx > 0) {
                        const parentType = level2TypesOrder[idx - 1];
                        const selParent = selectedValuesByType[parentType];
                        if (!selParent) {
                            // if parent is not selected, we won't show this child's options (cascading)
                            return null;
                        }
                        const parentCols = level2Columns.filter(
                            c => c.Type === parentType,
                        );
                        if (parentCols.length > 0) {
                            parentPair = {
                                column: parentCols[0].Column_Name,
                                value: selParent,
                            };
                        }
                    }

                    // compute options and totals for this type
                    const mappedCol = normalizeColumnKey(colName);
                    const parentForCompute = parentPair
                        ? {
                              column: normalizeColumnKey(parentPair.column),
                              value: parentPair.value,
                          }
                        : undefined;
                    const valuesWithTotals = computeValuesWithTotals(
                        mappedCol,
                        parentForCompute,
                    );

                    const selectedForThisType =
                        selectedValuesByType[typeNum] || "";

                    return (
                        <View
                            key={`lvl2-type-${typeNum}`}
                            style={{ marginVertical: 6 }}
                        >
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.level2FilterContainer}
                            >
                                <TouchableOpacity
                                    style={[
                                        styles.brandFilterButton,
                                        !selectedForThisType &&
                                            styles.brandFilterButtonActive,
                                    ]}
                                    onPress={() => {
                                        // clear this type and downstream types
                                        const newSel = {
                                            ...selectedValuesByType,
                                        };
                                        delete newSel[typeNum];
                                        // delete downstream
                                        level2TypesOrder.forEach(t => {
                                            if (t > typeNum) delete newSel[t];
                                        });
                                        setSelectedValuesByType(newSel);
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.brandFilterText,
                                            !selectedForThisType &&
                                                styles.brandFilterTextActive,
                                        ]}
                                    >
                                        All
                                    </Text>
                                </TouchableOpacity>

                                {valuesWithTotals.map(({ value, total }) => {
                                    const isSelected =
                                        selectedForThisType === value;
                                    return (
                                        <TouchableOpacity
                                            key={`${typeNum}-${value}`}
                                            style={[
                                                styles.brandFilterButton,
                                                isSelected &&
                                                    styles.brandFilterButtonActive,
                                            ]}
                                            onPress={() => {
                                                const newSel: Record<
                                                    number,
                                                    string
                                                > = {
                                                    ...selectedValuesByType,
                                                    [typeNum]: value,
                                                };
                                                // clear downstream
                                                level2TypesOrder.forEach(t => {
                                                    if (t > typeNum)
                                                        delete newSel[t];
                                                });
                                                setSelectedValuesByType(newSel);
                                            }}
                                        >
                                            <Text
                                                style={[
                                                    styles.brandFilterText,
                                                    isSelected &&
                                                        styles.brandFilterTextActive,
                                                ]}
                                            >
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
        if (Math.abs(num) >= 10000000)
            return `${(num / 10000000).toFixed(1)}Cr`;
        if (Math.abs(num) >= 100000) return `${(num / 100000).toFixed(1)}L`;
        if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return String(num);
    };

    const COL_WIDTH = 80;

    const COLS = {
        date: COL_WIDTH * 0.6,
        name: COL_WIDTH * 2,
        cls: COL_WIDTH * 1.5,
        ob: COL_WIDTH * 0.8,
        in: COL_WIDTH * 0.8,
        out: COL_WIDTH * 0.8,
    };

    const formatDateDDMM = (dateStr?: string) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        return `${dd}-${mm}`;
    };

    const getBagCount = (qty?: number, bag?: string) => {
        if (!qty || !bag) return null;

        const bagSize = parseInt(bag.replace(/[^0-9]/g, ""), 10);
        if (!bagSize) return null;

        return Math.floor(qty / bagSize);
    };

    // --- Row components (unchanged) ---
    const ItemWiseHeader = () => {
        return (
            <View style={[styles.tableRow, { backgroundColor: "#eee" }]}>
                <View style={styles.rowContainer}>
                    <Text
                        style={[
                            styles.rowCell,
                            { width: COLS.name, fontWeight: "bold" },
                        ]}
                    >
                        Name
                    </Text>
                    <Text
                        style={[
                            styles.rowCell,
                            { width: COLS.cls, fontWeight: "bold" },
                        ]}
                    >
                        Cls
                    </Text>
                    <Text
                        style={[
                            styles.rowCell,
                            { width: COLS.ob, fontWeight: "bold" },
                        ]}
                    >
                        OB
                    </Text>
                    <Text
                        style={[
                            styles.rowCell,
                            { width: COLS.in, fontWeight: "bold" },
                        ]}
                    >
                        In
                    </Text>
                    <Text
                        style={[
                            styles.rowCell,
                            { width: COLS.out, fontWeight: "bold" },
                        ]}
                    >
                        Out
                    </Text>
                </View>
            </View>
        );
    };

    const ItemWiseRow = ({ item }: { item: any }) => {
        return (
            <View style={styles.tableRow}>
                <TouchableOpacity
                    style={styles.rowContainer}
                    onPress={() =>
                        navigation.navigate("transactionlistitem", {
                            ProductId: item.Product_Id,
                            productName: item.stock_item_name,
                            fromDate,
                            toDate,
                        })
                    }
                >
                    <Text
                        style={[styles.rowCell, { width: COLS.name }]}
                        numberOfLines={2}
                    >
                        {item.stock_item_name}
                    </Text>

                    <Text
                        style={[
                            styles.rowCell,
                            {
                                width: COLS.cls,
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

                            return bagCount ? `${qty} (${bagCount} nos)` : qty;
                        })()}
                    </Text>

                    <Text style={[styles.rowCell, { width: COLS.ob }]}>
                        {item.OB_Bal_Qty ?? item.OB_Act_Qty}
                    </Text>

                    <Text style={[styles.rowCell, { width: COLS.in }]}>
                        {item.Pur_Qty}
                    </Text>

                    <Text style={[styles.rowCell, { width: COLS.out }]}>
                        {item.Sal_Qty}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderGroup = (groups: any[], level = 0) => {
        return groups.map((grp: any) => {
            const key = `${level}-${grp.groupName}`;
            const expanded = expandedGroups.has(key);

            return (
                <View
                    key={key}
                    style={{ marginLeft: level * 10, marginBottom: 10 }}
                >
                    {/* LEVEL 1 HEADER (Original Style) */}
                    {level === 0 ? (
                        <TouchableOpacity
                            style={styles.groupHeader}
                            onPress={() => toggleGroup(key)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.groupHeaderLeft}>
                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                    }}
                                >
                                    <Icon
                                        name={
                                            expanded
                                                ? "expand-less"
                                                : "expand-more"
                                        }
                                        size={20}
                                        style={{ marginRight: 4 }}
                                    />

                                    <Text style={styles.groupName}>
                                        {grp.groupName}
                                    </Text>
                                </View>

                                <View style={styles.groupStats}>
                                    <Text style={styles.groupCount}>
                                        Items: {grp.count}
                                    </Text>

                                    <Text style={styles.groupBalance}>
                                        Balance:{" "}
                                        {formatNumber(grp.totalBalance)}
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ) : (
                        /* NESTED LEVEL HEADER (Godown Style) */

                        <TouchableOpacity
                            style={styles.brandHeader}
                            onPress={() => toggleGroup(key)}
                        >
                            <Icon
                                name={expanded ? "expand-less" : "expand-more"}
                                size={20}
                            />

                            <Text style={styles.brandName}>
                                {grp.groupName}
                            </Text>

                            <Text style={styles.brandBalance}>
                                {formatNumber(grp.totalBalance)}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* CHILD GROUPS */}
                    {expanded &&
                        grp.children &&
                        renderGroup(grp.children, level + 1)}

                    {/* ITEMS TABLE */}
                    {expanded && grp.items && (
                        <ScrollView horizontal>
                            <View>
                                <ItemWiseHeader />

                                {grp.items.map((item: any, i: number) => (
                                    <ItemWiseRow key={i} item={item} />
                                ))}
                            </View>
                        </ScrollView>
                    )}
                </View>
            );
        });
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <AppHeader
                title="Stock - Item Wise"
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
                onApply={selected => {
                    const mapped: Record<string, string> = {};
                    let index = 1;
                    Object.keys(selected || {}).forEach(key => {
                        let value = selected[key];
                        if (
                            value === "All" ||
                            value === null ||
                            value === undefined
                        )
                            value = "";
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
                reportName="StockInhand"
                expectedReportName="StockInhand"
                enableDynamicFilter={true}
                externalFilters={externalFilterTemplate || undefined}
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
                showsVerticalScrollIndicator={false}
            >
                {/* LEVEL2 chips (before search) */}
                <Level2Filter />

                {/* Search */}
                <View style={styles.searchContainer}>
                    <Icon
                        name="search"
                        size={20}
                        color={colors.textSecondary}
                    />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by group or item name..."
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

                {/* Sort controls */}
                <View style={styles.sortContainer}>
                    <View style={styles.sortButtons}>
                        <TouchableOpacity
                            style={[
                                styles.sortButton,
                                sortBy === "name" && styles.sortButtonActive,
                            ]}
                            onPress={() => {
                                if (sortBy === "name")
                                    setSortOrder(prev =>
                                        prev === "asc" ? "desc" : "asc",
                                    );
                                else {
                                    setSortBy("name");
                                    setSortOrder("asc");
                                }
                            }}
                        >
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
                                ]}
                            >
                                Name
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.sortButton,
                                sortBy === "count" && styles.sortButtonActive,
                            ]}
                            onPress={() => {
                                if (sortBy === "count")
                                    setSortOrder(prev =>
                                        prev === "asc" ? "desc" : "asc",
                                    );
                                else {
                                    setSortBy("count");
                                    setSortOrder("desc");
                                }
                            }}
                        >
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
                                ]}
                            >
                                Count
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.sortButton,
                                sortBy === "balance" && styles.sortButtonActive,
                            ]}
                            onPress={() => {
                                if (sortBy === "balance")
                                    setSortOrder(prev =>
                                        prev === "asc" ? "desc" : "asc",
                                    );
                                else {
                                    setSortBy("balance");
                                    setSortOrder("desc");
                                }
                            }}
                        >
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
                                ]}
                            >
                                Balance
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Loading / Error / Content */}
                {isItemWiseLoading && (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>
                            Loading stock data...
                        </Text>
                    </View>
                )}

                {!isItemWiseLoading && itemWiseError && (
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
                            {(itemWiseError as any)?.message ||
                                "Please try again later"}
                        </Text>
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={onRefresh}
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

                {!isItemWiseLoading &&
                    !itemWiseError &&
                    displayData.length > 0 && (
                        <>
                            <View style={styles.summaryContainer}>
                                <Text style={styles.summaryText}>
                                    Showing {displayData.length} groups (
                                    {totalItems} total groups, {totalRecords}{" "}
                                    total records)
                                </Text>
                            </View>

                            {renderGroup(displayData)}

                            {totalPages > 1 && (
                                <PaginationControls
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    totalItems={totalItems}
                                    totalRecords={totalRecords}
                                    onPageChange={p => setCurrentPage(p)}
                                />
                            )}
                        </>
                    )}

                {!isItemWiseLoading &&
                    !itemWiseError &&
                    displayData.length === 0 && (
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

export default OpeningStockItemWise;

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
            overflow: "hidden",
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
            color: "#000",
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
        level2FilterContainer: {
            flexDirection: "row",
            paddingVertical: 8,
            paddingHorizontal: 5,
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
    });
