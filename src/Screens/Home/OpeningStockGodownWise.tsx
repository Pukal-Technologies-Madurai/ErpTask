import React from "react";
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    TextInput,
    ActivityIndicator,
    Modal,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";

import { API } from "../../constants/api";
import { responsiveWidth, responsiveHeight } from "../../constants/helper";
import { RootStackParamList } from "../../Navigation/types";
import { useTheme } from "../../Context/ThemeContext";

import AppHeader from "../../Components/AppHeader";
import FilterModal from "../../Components/FilterModal";
import PaginationControls from "../../Components/PaginationControls";

// ─── Constants ────────────────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 15;
const REPORT_NAME = "stockInhand-Godown";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatApiDate = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

const formatNumber = (num: number): string => {
    if (Math.abs(num) >= 10_000_000)
        return `${(num / 10_000_000).toFixed(1)}Cr`;
    if (Math.abs(num) >= 100_000) return `${(num / 100_000).toFixed(1)}L`;
    if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return String(num);
};

const buildFilteredUrl = (
    baseUrl: string,
    from: string,
    to: string,
    filters: Record<string, string>,
) => {
    const params = new URLSearchParams();
    params.append("Fromdate", from);
    params.append("Todate", to);
    Object.entries(filters || {}).forEach(([k, v]) => {
        params.append(k, v ?? "");
    });
    return `${baseUrl}?${params.toString()}`;
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface FilterOption {
    value: string;
    label: string;
}

interface FilterConfig {
    filterType: string;
    columnName: string;
    valueColumn: string;
    options: FilterOption[];
}

interface GodownStockItem {
    Product_Id: string;
    stock_item_name: string;
    Godown_Name: string;
    Godown_Id: string;
    OB_Bal_Qty: number;
    Pur_Qty: number;
    Sal_Qty: number;
    Act_Bal_Qty: number;
    Bal_Qty: number;
    Brand: string;
    Group_ST: string;
    Stock_Group: string;
    Bag: string | null;
    Stock_Item: string;
}

interface GodownGroup {
    godownName: string;
    godownId: string;
    totalBalance: number;
    purchaseQty: number;
    saleQty: number;
    itemCount: number;
    brands: BrandGroup[];
}

interface BrandGroup {
    brandName: string;
    totalBalance: number;
    itemCount: number;
    items: GodownStockItem[];
}

// ─── Component ────────────────────────────────────────────────────────────────
const OpeningStockGodownWise = () => {
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { colors, typography } = useTheme();
    const styles = getStyles(typography, colors);

    // ── Date state (from + to) ─────────────────────────────────────────────
    const [fromDate, setFromDate] = React.useState<Date>(new Date());
    const [toDate, setToDate] = React.useState<Date>(new Date());

    // ── Modal visibility ───────────────────────────────────────────────────
    /** Modal 1 (filter icon): date range + dynamic API filters */
    const [dateFilterVisible, setDateFilterVisible] = React.useState(false);
    /** Modal 2 (broadcast icon): Godown + Group multi-select */
    const [groupFilterVisible, setGroupFilterVisible] = React.useState(false);

    // ── Dynamic API filters (from FilterModal) ─────────────────────────────
    const [dynamicFilters, setDynamicFilters] = React.useState<
        Record<string, string>
    >({});
    const [externalFilterTemplate, setExternalFilterTemplate] = React.useState<
        FilterConfig[] | null
    >(null);

    // ── Multi-select Godown & Group selections ─────────────────────────────
    const [selectedGodowns, setSelectedGodowns] = React.useState<string[]>([]);
    const [selectedGroups, setSelectedGroups] = React.useState<string[]>([]);

    // ── Accordion expansion ────────────────────────────────────────────────
    const [expandedGodowns, setExpandedGodowns] = React.useState<Set<string>>(
        new Set(),
    );
    const [expandedBrands, setExpandedBrands] = React.useState<Set<string>>(
        new Set(),
    );

    // ── Search ─────────────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = React.useState("");
    const [currentPage, setCurrentPage] = React.useState(1);
    const [refreshing, setRefreshing] = React.useState(false);

    const fromStr = React.useMemo(() => formatApiDate(fromDate), [fromDate]);
    const toStr = React.useMemo(() => formatApiDate(toDate), [toDate]);
    const dynamicFiltersKey = React.useMemo(
        () => JSON.stringify(dynamicFilters),
        [dynamicFilters],
    );

    // ── Fetch filter config (single cached call) ───────────────────────────
    const { data: filterConfigs = [] } = useQuery<FilterConfig[]>({
        queryKey: ["reportFilters", REPORT_NAME],
        queryFn: async () => {
            const res = await fetch(API.getReportFilters(REPORT_NAME));
            const json = await res.json();
            const arr: any[] = Array.isArray(json) ? json : json?.data ?? [];
            return arr.map((f: any) => ({
                filterType: String(f.filterType ?? f.FilterType ?? ""),
                columnName: String(f.columnName ?? f.ColumnName ?? ""),
                valueColumn: String(f.valueColumn ?? f.ValueColumn ?? ""),
                options: Array.isArray(f.options) ? f.options : [],
            }));
        },
        staleTime: 5 * 60 * 1000,
    });

    // Derive godown options and group options from filter config
    const godownOptions = React.useMemo<FilterOption[]>(
        () => filterConfigs.find(f => f.filterType === "1")?.options ?? [],
        [filterConfigs],
    );
    const groupOptions = React.useMemo<FilterOption[]>(
        () =>
            (filterConfigs.find(f => f.filterType === "2")?.options ?? []).map(
                o => ({ ...o, label: o.label.trim() }),
            ),
        [filterConfigs],
    );

    // Sync externalFilterTemplate for the date FilterModal
    React.useEffect(() => {
        if (filterConfigs.length > 0) {
            setExternalFilterTemplate(filterConfigs as any);
        }
    }, [filterConfigs]);

    // ── Fetch stock data ───────────────────────────────────────────────────
    const baseStockUrl = API.godownWiseStock(fromStr, toStr).split("?")[0];
    const {
        data: rawStockData = [],
        isLoading,
        error,
        refetch,
    } = useQuery<GodownStockItem[]>({
        queryKey: ["godownWiseStock", fromStr, toStr, dynamicFiltersKey],
        queryFn: async () => {
            const url = buildFilteredUrl(
                baseStockUrl,
                fromStr,
                toStr,
                dynamicFilters,
            );
            const resp = await fetch(url);
            const json = await resp.json();
            return Array.isArray(json) ? json : json?.data ?? [];
        },
        enabled: !!fromStr && !!toStr,
    });

    // ── Client-side multi-select filter ───────────────────────────────────
    const filteredBySelections = React.useMemo(() => {
        let data = rawStockData;
        if (selectedGodowns.length > 0) {
            data = data.filter(it => selectedGodowns.includes(it.Godown_Name));
        }
        if (selectedGroups.length > 0) {
            data = data.filter(it =>
                selectedGroups.includes((it.Group_ST ?? "").trim()),
            );
        }
        return data;
    }, [rawStockData, selectedGodowns, selectedGroups]);

    // ── Search ─────────────────────────────────────────────────────────────
    const searchFiltered = React.useMemo(() => {
        if (!searchQuery.trim()) return filteredBySelections;
        const q = searchQuery.trim().toLowerCase();
        return filteredBySelections.filter(
            it =>
                it.stock_item_name?.toLowerCase().includes(q) ||
                it.Godown_Name?.toLowerCase().includes(q) ||
                it.Brand?.toLowerCase().includes(q) ||
                it.Group_ST?.toLowerCase().includes(q),
        );
    }, [filteredBySelections, searchQuery]);

    // ── Group data: Godown → Brand → Items ────────────────────────────────
    const godownGroups = React.useMemo((): GodownGroup[] => {
        const godownMap = new Map<string, GodownStockItem[]>();
        searchFiltered.forEach(item => {
            const key = item.Godown_Name || "Unknown";
            if (!godownMap.has(key)) godownMap.set(key, []);
            godownMap.get(key)!.push(item);
        });

        return Array.from(godownMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([godownName, items]) => {
                const brandMap = new Map<string, GodownStockItem[]>();
                items.forEach(it => {
                    const b =
                        (it.Group_ST ?? it.Brand ?? "Others").trim() ||
                        "Others";
                    if (!brandMap.has(b)) brandMap.set(b, []);
                    brandMap.get(b)!.push(it);
                });

                const brands: BrandGroup[] = Array.from(brandMap.entries())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([brandName, bis]) => ({
                        brandName,
                        totalBalance: bis.reduce(
                            (s, i) => s + (Number(i.Bal_Qty) || 0),
                            0,
                        ),
                        itemCount: bis.length,
                        items: bis,
                    }));

                return {
                    godownName,
                    godownId: items[0]?.Godown_Id ?? "",
                    totalBalance: items.reduce(
                        (s, i) => s + (Number(i.Bal_Qty) || 0),
                        0,
                    ),
                    purchaseQty: items.reduce(
                        (s, i) => s + (Number(i.Pur_Qty) || 0),
                        0,
                    ),
                    saleQty: items.reduce(
                        (s, i) => s + (Number(i.Sal_Qty) || 0),
                        0,
                    ),
                    itemCount: items.length,
                    brands,
                };
            });
    }, [searchFiltered]);

    // ── Pagination ─────────────────────────────────────────────────────────
    const totalPages = Math.max(
        1,
        Math.ceil(godownGroups.length / ITEMS_PER_PAGE),
    );
    const pagedGroups = godownGroups.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE,
    );

    // ── Totals banner ──────────────────────────────────────────────────────
    const totals = React.useMemo(
        () => ({
            items: searchFiltered.length,
            balance: searchFiltered.reduce(
                (s, i) => s + (Number(i.Bal_Qty) || 0),
                0,
            ),
            purchase: searchFiltered.reduce(
                (s, i) => s + (Number(i.Pur_Qty) || 0),
                0,
            ),
            sale: searchFiltered.reduce(
                (s, i) => s + (Number(i.Sal_Qty) || 0),
                0,
            ),
        }),
        [searchFiltered],
    );

    // How many group-filter selections are active (for badge on header icon)
    const activeGroupFilterCount =
        selectedGodowns.length + selectedGroups.length;

    // ── Event handlers ─────────────────────────────────────────────────────
    const toggleGodown = (name: string) => {
        setExpandedGodowns(prev => {
            const next = new Set(prev);
            if (next.has(name)) {
                next.delete(name);
                setExpandedBrands(pb => {
                    const nb = new Set(pb);
                    [...nb].forEach(k => {
                        if (k.startsWith(name + "|")) nb.delete(k);
                    });
                    return nb;
                });
            } else {
                next.add(name);
            }
            return next;
        });
    };

    const toggleBrand = (key: string) => {
        setExpandedBrands(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        try {
            await refetch();
        } finally {
            setRefreshing(false);
        }
    }, [refetch]);

    const handleApplyDateFilters = (selected: Record<string, string>) => {
        const mapped: Record<string, string> = {};
        let index = 1;
        Object.values(selected || {}).forEach(value => {
            mapped[`filter${index}`] =
                value === "All" || value == null ? "" : value;
            index++;
        });
        setDynamicFilters(mapped);
        setCurrentPage(1);
        setExpandedGodowns(new Set());
        setExpandedBrands(new Set());
        setDateFilterVisible(false);
    };

    // Reset pagination/expansion on filter changes
    React.useEffect(() => {
        setCurrentPage(1);
        setExpandedGodowns(new Set());
        setExpandedBrands(new Set());
    }, [
        searchQuery,
        selectedGodowns.length,
        selectedGroups.length,
        dynamicFiltersKey,
    ]);

    // ── Toggle helpers for multi-select ───────────────────────────────────
    const toggleGodownSelection = (label: string) => {
        setSelectedGodowns(prev =>
            prev.includes(label)
                ? prev.filter(x => x !== label)
                : [...prev, label],
        );
    };

    const toggleGroupSelection = (label: string) => {
        setSelectedGroups(prev =>
            prev.includes(label)
                ? prev.filter(x => x !== label)
                : [...prev, label],
        );
    };

    // ── Sub-components ─────────────────────────────────────────────────────

    const StatsBar = () => (
        <View style={styles.statsBar}>
            <View style={styles.statItem}>
                <Text style={styles.statValue}>{godownGroups.length}</Text>
                <Text style={styles.statLabel}>Godowns</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
                <Text style={styles.statValue}>{totals.items}</Text>
                <Text style={styles.statLabel}>Items</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.success }]}>
                    {formatNumber(totals.purchase)}
                </Text>
                <Text style={styles.statLabel}>Purchase</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.accent }]}>
                    {formatNumber(totals.sale)}
                </Text>
                <Text style={styles.statLabel}>Sale</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>
                    {formatNumber(totals.balance)}
                </Text>
                <Text style={styles.statLabel}>Balance</Text>
            </View>
        </View>
    );

    /**
     * Active filter chips bar — shown below the search bar when there are
     * Godown or Group selections active, for quick visual feedback.
     */
    const ActiveFilterChips = () => {
        if (activeGroupFilterCount === 0) return null;
        return (
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.activeChipsScroll}
                contentContainerStyle={styles.activeChipsContent}>
                {selectedGodowns.map(g => (
                    <TouchableOpacity
                        key={`gd-${g}`}
                        style={styles.activeChip}
                        onPress={() => toggleGodownSelection(g)}>
                        <Icon name="warehouse" size={11} color={colors.white} />
                        <Text style={styles.activeChipText}>{g}</Text>
                        <Icon name="close" size={11} color={colors.white} />
                    </TouchableOpacity>
                ))}
                {selectedGroups.map(g => (
                    <TouchableOpacity
                        key={`gr-${g}`}
                        style={[
                            styles.activeChip,
                            { backgroundColor: colors.info },
                        ]}
                        onPress={() => toggleGroupSelection(g)}>
                        <Icon
                            name="label-outline"
                            size={11}
                            color={colors.white}
                        />
                        <Text style={styles.activeChipText}>{g}</Text>
                        <Icon name="close" size={11} color={colors.white} />
                    </TouchableOpacity>
                ))}
                <TouchableOpacity
                    style={styles.clearAllChip}
                    onPress={() => {
                        setSelectedGodowns([]);
                        setSelectedGroups([]);
                    }}>
                    <Text style={styles.clearAllChipText}>Clear all</Text>
                </TouchableOpacity>
            </ScrollView>
        );
    };

    /**
     * Group Filter Bottom-Sheet Modal (opened by 2nd header icon).
     * Contains multi-select for Godown and Group/Brand.
     */
    const GroupFilterModal = () => {
        // Local draft state — only committed on "Apply"
        const [draftGodowns, setDraftGodowns] =
            React.useState<string[]>(selectedGodowns);
        const [draftGroups, setDraftGroups] =
            React.useState<string[]>(selectedGroups);

        const toggleDraftGodown = (label: string) => {
            setDraftGodowns(prev =>
                prev.includes(label)
                    ? prev.filter(x => x !== label)
                    : [...prev, label],
            );
        };
        const toggleDraftGroup = (label: string) => {
            setDraftGroups(prev =>
                prev.includes(label)
                    ? prev.filter(x => x !== label)
                    : [...prev, label],
            );
        };

        const handleApply = () => {
            setSelectedGodowns(draftGodowns);
            setSelectedGroups(draftGroups);
            setGroupFilterVisible(false);
        };
        const handleReset = () => {
            setDraftGodowns([]);
            setDraftGroups([]);
        };

        const Section = ({
            title,
            options,
            selected,
            onToggle,
        }: {
            title: string;
            options: FilterOption[];
            selected: string[];
            onToggle: (label: string) => void;
        }) => (
            <View style={styles.fmSection}>
                <View style={styles.fmSectionHeader}>
                    <Text style={styles.fmSectionTitle}>{title}</Text>
                    {selected.length > 0 && (
                        <View style={styles.fmBadge}>
                            <Text style={styles.fmBadgeText}>
                                {selected.length}
                            </Text>
                        </View>
                    )}
                </View>
                <View style={styles.fmOptionsWrap}>
                    {options.map(opt => {
                        const isActive = selected.includes(opt.label);
                        return (
                            <TouchableOpacity
                                key={opt.value}
                                style={[
                                    styles.fmOption,
                                    isActive && styles.fmOptionActive,
                                ]}
                                onPress={() => onToggle(opt.label)}
                                activeOpacity={0.7}>
                                <View
                                    style={[
                                        styles.fmCheckbox,
                                        isActive && styles.fmCheckboxActive,
                                    ]}>
                                    {isActive && (
                                        <Icon
                                            name="check"
                                            size={11}
                                            color={colors.white}
                                        />
                                    )}
                                </View>
                                <Text
                                    style={[
                                        styles.fmOptionText,
                                        isActive && styles.fmOptionTextActive,
                                    ]}
                                    numberOfLines={2}>
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        );

        return (
            <Modal
                visible={groupFilterVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setGroupFilterVisible(false)}>
                <TouchableOpacity
                    style={styles.fmOverlay}
                    activeOpacity={1}
                    onPress={() => setGroupFilterVisible(false)}
                />
                <View style={styles.fmSheet}>
                    {/* Handle */}
                    <View style={styles.fmHandle} />

                    {/* Header */}
                    <View style={styles.fmHeader}>
                        <Text style={styles.fmTitle}>
                            Filter by Godown & Group
                        </Text>
                        <TouchableOpacity
                            onPress={handleReset}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={styles.fmResetText}>Reset</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        style={styles.fmBody}>
                        {godownOptions.length > 0 && (
                            <Section
                                title="Godown"
                                options={godownOptions}
                                selected={draftGodowns}
                                onToggle={toggleDraftGodown}
                            />
                        )}
                        {groupOptions.length > 0 && (
                            <Section
                                title="Group / Brand"
                                options={groupOptions}
                                selected={draftGroups}
                                onToggle={toggleDraftGroup}
                            />
                        )}
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.fmFooter}>
                        <TouchableOpacity
                            style={styles.fmCancelBtn}
                            onPress={() => setGroupFilterVisible(false)}>
                            <Text style={styles.fmCancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.fmApplyBtn}
                            onPress={handleApply}>
                            <Text style={styles.fmApplyBtnText}>
                                Apply
                                {draftGodowns.length + draftGroups.length > 0
                                    ? ` (${
                                          draftGodowns.length +
                                          draftGroups.length
                                      })`
                                    : ""}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    };

    const ItemRow = ({
        item,
        godownName,
    }: {
        item: GodownStockItem;
        godownName: string;
    }) => {
        const balance = item.Bal_Qty ?? item.Act_Bal_Qty ?? 0;
        const isNegative = balance < 0;
        return (
            <TouchableOpacity
                style={styles.itemRow}
                activeOpacity={0.7}
                onPress={() =>
                    navigation.navigate("transactionlistgodownitem", {
                        ProductId: Number(item.Product_Id),
                        GodownId: Number(item.Godown_Id),
                        productName: item.stock_item_name,
                        fromDate,
                        toDate,
                    })
                }>
                <View
                    style={[
                        styles.itemAccent,
                        {
                            backgroundColor: isNegative
                                ? colors.accent
                                : colors.primary,
                        },
                    ]}
                />
                <View style={styles.itemRowContent}>
                    <Text style={styles.itemName} numberOfLines={2}>
                        {item.stock_item_name}
                    </Text>
                    <View style={styles.itemRowStats}>
                        <View style={styles.itemStat}>
                            <Text style={styles.itemStatLabel}>OB</Text>
                            <Text style={styles.itemStatValue}>
                                {item.OB_Bal_Qty ?? 0}
                            </Text>
                        </View>
                        <View style={styles.itemStatDivider} />
                        <View style={styles.itemStat}>
                            <Text style={styles.itemStatLabel}>In</Text>
                            <Text
                                style={[
                                    styles.itemStatValue,
                                    { color: colors.success },
                                ]}>
                                {item.Pur_Qty ?? 0}
                            </Text>
                        </View>
                        <View style={styles.itemStatDivider} />
                        <View style={styles.itemStat}>
                            <Text style={styles.itemStatLabel}>Out</Text>
                            <Text
                                style={[
                                    styles.itemStatValue,
                                    { color: colors.accent },
                                ]}>
                                {item.Sal_Qty ?? 0}
                            </Text>
                        </View>
                        <View style={styles.itemStatDivider} />
                        <View style={styles.itemStat}>
                            <Text style={styles.itemStatLabel}>Bal</Text>
                            <Text
                                style={[
                                    styles.itemStatValue,
                                    {
                                        color: isNegative
                                            ? colors.accent
                                            : colors.primary,
                                        fontWeight: "700",
                                    },
                                ]}>
                                {balance}
                            </Text>
                        </View>
                    </View>
                </View>
                <Icon name="chevron-right" size={16} color={colors.grey400} />
            </TouchableOpacity>
        );
    };

    const BrandAccordion = ({
        brand,
        godownName,
    }: {
        brand: BrandGroup;
        godownName: string;
    }) => {
        const key = `${godownName}|${brand.brandName}`;
        const expanded = expandedBrands.has(key);
        return (
            <View style={styles.brandAccordion}>
                <TouchableOpacity
                    style={styles.brandHeader}
                    onPress={() => toggleBrand(key)}
                    activeOpacity={0.7}>
                    <View style={styles.brandHeaderLeft}>
                        <View style={styles.brandDot} />
                        <Text style={styles.brandName} numberOfLines={1}>
                            {brand.brandName}
                        </Text>
                    </View>
                    <View style={styles.brandHeaderRight}>
                        <View style={styles.brandBadge}>
                            <Text style={styles.brandBadgeText}>
                                {brand.itemCount}
                            </Text>
                        </View>
                        <Text style={styles.brandBalance}>
                            {formatNumber(brand.totalBalance)}
                        </Text>
                        <Icon
                            name={
                                expanded
                                    ? "keyboard-arrow-up"
                                    : "keyboard-arrow-down"
                            }
                            size={18}
                            color={colors.textSecondary}
                        />
                    </View>
                </TouchableOpacity>
                {expanded && (
                    <View style={styles.brandItems}>
                        {brand.items.map((item, idx) => (
                            <ItemRow
                                key={`${item.Product_Id}-${idx}`}
                                item={item}
                                godownName={godownName}
                            />
                        ))}
                    </View>
                )}
            </View>
        );
    };

    const GodownCard = ({ group }: { group: GodownGroup }) => {
        const expanded = expandedGodowns.has(group.godownName);
        const balanceColor =
            group.totalBalance >= 0 ? colors.primary : colors.accent;
        return (
            <View style={styles.godownCard}>
                <TouchableOpacity
                    style={styles.godownHeader}
                    onPress={() => toggleGodown(group.godownName)}
                    activeOpacity={0.75}>
                    <View style={styles.godownIconBg}>
                        <Icon
                            name="warehouse"
                            size={18}
                            color={colors.primary}
                        />
                    </View>
                    <View style={styles.godownHeaderMid}>
                        <Text style={styles.godownName} numberOfLines={1}>
                            {group.godownName}
                        </Text>
                        <View style={styles.godownMeta}>
                            <Text style={styles.godownMetaText}>
                                {group.itemCount} items
                            </Text>
                            <Text style={styles.godownMetaDot}>·</Text>
                            <Text style={styles.godownMetaText}>
                                {group.brands.length} groups
                            </Text>
                        </View>
                    </View>
                    <View style={styles.godownHeaderRight}>
                        <Text
                            style={[
                                styles.godownBalance,
                                { color: balanceColor },
                            ]}>
                            {formatNumber(group.totalBalance)}
                        </Text>
                        <Icon
                            name={
                                expanded
                                    ? "keyboard-arrow-up"
                                    : "keyboard-arrow-down"
                            }
                            size={20}
                            color={colors.textSecondary}
                        />
                    </View>
                </TouchableOpacity>

                {/* Collapsed qty bar */}
                {!expanded && (
                    <View style={styles.godownQtyBar}>
                        <View style={styles.qtyBarItem}>
                            <Icon
                                name="arrow-downward"
                                size={11}
                                color={colors.success}
                            />
                            <Text
                                style={[
                                    styles.qtyBarValue,
                                    { color: colors.success },
                                ]}>
                                {formatNumber(group.purchaseQty)}
                            </Text>
                            <Text style={styles.qtyBarLabel}>In</Text>
                        </View>
                        <View style={styles.qtyBarItem}>
                            <Icon
                                name="arrow-upward"
                                size={11}
                                color={colors.accent}
                            />
                            <Text
                                style={[
                                    styles.qtyBarValue,
                                    { color: colors.accent },
                                ]}>
                                {formatNumber(group.saleQty)}
                            </Text>
                            <Text style={styles.qtyBarLabel}>Out</Text>
                        </View>
                        <View style={styles.qtyBarItem}>
                            <Icon
                                name="inventory-2"
                                size={11}
                                color={colors.primary}
                            />
                            <Text
                                style={[
                                    styles.qtyBarValue,
                                    { color: balanceColor },
                                ]}>
                                {formatNumber(group.totalBalance)}
                            </Text>
                            <Text style={styles.qtyBarLabel}>Bal</Text>
                        </View>
                    </View>
                )}

                {/* Expanded brand accordions */}
                {expanded && (
                    <View style={styles.godownBrands}>
                        {group.brands.map(brand => (
                            <BrandAccordion
                                key={brand.brandName}
                                brand={brand}
                                godownName={group.godownName}
                            />
                        ))}
                    </View>
                )}
            </View>
        );
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <AppHeader
                title="Stock - Godown Wise"
                showDrawer
                navigation={navigation}
                // Icon 1: date range + API dynamic filters
                showRightIcon
                rightIconLibrary="MaterialIcon"
                rightIconName="filter-1"
                onRightPress={() => setDateFilterVisible(true)}
                // Icon 2: Godown + Group multi-select (with active badge hint)
                showRightIcon2={true}
                rightIconLibrary2="MaterialIcon"
                rightIconName2="filter-2"
                onRightPress2={() => setGroupFilterVisible(true)}
            />

            {/* ── Date + API Filter Modal ── */}
            <FilterModal
                visible={dateFilterVisible}
                fromDate={fromDate}
                toDate={toDate}
                onFromDateChange={setFromDate}
                onToDateChange={setToDate}
                onApply={handleApplyDateFilters}
                onClose={() => setDateFilterVisible(false)}
                showToDate={true}
                title="Date & Filters"
                fromLabel="From Date"
                toLabel="To Date"
                reportName={REPORT_NAME}
                expectedReportName={REPORT_NAME}
                enableDynamicFilter
                externalFilters={externalFilterTemplate ?? undefined}
            />

            {/* ── Godown & Group Multi-Select Modal ── */}
            <GroupFilterModal />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                        tintColor={colors.primary}
                    />
                }
                showsVerticalScrollIndicator={false}>
                {/* ── Search Bar ── */}
                <View style={styles.searchBar}>
                    <Icon
                        name="search"
                        size={18}
                        color={colors.textSecondary}
                    />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search godown, item, brand…"
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity
                            onPress={() => setSearchQuery("")}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Icon
                                name="clear"
                                size={18}
                                color={colors.textSecondary}
                            />
                        </TouchableOpacity>
                    )}
                </View>

                {/* ── Active selection chips ── */}
                <ActiveFilterChips />

                {/* ── Loading ── */}
                {isLoading && (
                    <View style={styles.stateContainer}>
                        <ActivityIndicator
                            size="large"
                            color={colors.primary}
                        />
                        <Text style={styles.stateText}>
                            Loading stock data…
                        </Text>
                    </View>
                )}

                {/* ── Error ── */}
                {!isLoading && error && (
                    <View style={styles.stateContainer}>
                        <Icon
                            name="error-outline"
                            size={48}
                            color={colors.accent}
                        />
                        <Text
                            style={[
                                styles.stateText,
                                { color: colors.accent, fontWeight: "600" },
                            ]}>
                            Failed to load data
                        </Text>
                        <Text style={styles.stateSubText}>
                            {(error as any)?.message ?? "Please try again"}
                        </Text>
                        <TouchableOpacity
                            style={styles.retryBtn}
                            onPress={onRefresh}>
                            <Icon
                                name="refresh"
                                size={16}
                                color={colors.white}
                            />
                            <Text style={styles.retryBtnText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── Content ── */}
                {!isLoading && !error && (
                    <>
                        {rawStockData.length > 0 && <StatsBar />}

                        {pagedGroups.length === 0 && (
                            <View style={styles.stateContainer}>
                                <Icon
                                    name="inventory"
                                    size={52}
                                    color={colors.grey300}
                                />
                                <Text style={styles.stateText}>
                                    No data found
                                </Text>
                                <Text style={styles.stateSubText}>
                                    {searchQuery
                                        ? "Try a different search term"
                                        : "Pull to refresh or change filters"}
                                </Text>
                            </View>
                        )}

                        {pagedGroups.map(group => (
                            <GodownCard key={group.godownName} group={group} />
                        ))}

                        {totalPages > 1 && (
                            <PaginationControls
                                currentPage={currentPage}
                                totalPages={totalPages}
                                totalItems={godownGroups.length}
                                totalRecords={rawStockData.length}
                                onPageChange={p => setCurrentPage(p)}
                            />
                        )}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default OpeningStockGodownWise;

// ─── Styles ───────────────────────────────────────────────────────────────────
const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.primary,
        },
        scrollView: {
            flex: 1,
            backgroundColor: colors.background,
        },
        scrollContent: {
            paddingBottom: responsiveHeight(4),
        },

        // ── Stats Banner ──────────────────────────────────────────────────
        statsBar: {
            flexDirection: "row",
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(3),
            marginTop: responsiveHeight(1),
            marginBottom: responsiveHeight(0.5),
            borderRadius: 12,
            paddingVertical: responsiveWidth(3),
            paddingHorizontal: responsiveWidth(2),
            alignItems: "center",
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
            elevation: 2,
        },
        statItem: {
            flex: 1,
            alignItems: "center",
        },
        statValue: {
            ...typography.body1,
            fontWeight: "700",
            color: colors.text,
        },
        statLabel: {
            ...typography.overline,
            color: colors.textSecondary,
            marginTop: 1,
        },
        statDivider: {
            width: 1,
            height: responsiveHeight(3.5),
            backgroundColor: colors.borderColor,
        },

        // ── Active Filter Chips Row ────────────────────────────────────────
        activeChipsScroll: {
            flexGrow: 0,
        },
        activeChipsContent: {
            paddingHorizontal: responsiveWidth(3),
            paddingVertical: responsiveHeight(0.5),
            gap: responsiveWidth(2),
            flexDirection: "row",
            alignItems: "center",
        },
        activeChip: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.primary,
            borderRadius: 14,
            paddingHorizontal: responsiveWidth(2.5),
            paddingVertical: responsiveWidth(1),
            gap: 4,
        },
        activeChipText: {
            ...typography.overline,
            color: colors.white,
            fontWeight: "600",
            maxWidth: responsiveWidth(28),
        },
        clearAllChip: {
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.accent,
            paddingHorizontal: responsiveWidth(2.5),
            paddingVertical: responsiveWidth(1),
        },
        clearAllChipText: {
            ...typography.overline,
            color: colors.accent,
            fontWeight: "600",
        },

        // ── Search Bar ────────────────────────────────────────────────────
        searchBar: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(3),
            marginTop: responsiveHeight(1),
            marginBottom: responsiveHeight(0.5),
            borderRadius: 10,
            paddingHorizontal: responsiveWidth(3.5),
            paddingVertical: responsiveWidth(2.5),
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 3,
            elevation: 2,
            gap: responsiveWidth(2),
        },
        searchInput: {
            flex: 1,
            ...typography.body1,
            color: colors.text,
            paddingVertical: 0,
        },

        // ── State Views ───────────────────────────────────────────────────
        stateContainer: {
            alignItems: "center",
            justifyContent: "center",
            padding: responsiveHeight(6),
            gap: responsiveWidth(2),
        },
        stateText: {
            ...typography.h6,
            color: colors.textSecondary,
            textAlign: "center",
        },
        stateSubText: {
            ...typography.body2,
            color: colors.textSecondary,
            textAlign: "center",
        },
        retryBtn: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.primary,
            paddingHorizontal: responsiveWidth(6),
            paddingVertical: responsiveWidth(2.5),
            borderRadius: 8,
            gap: responsiveWidth(2),
            marginTop: responsiveWidth(2),
        },
        retryBtnText: {
            ...typography.body1,
            color: colors.white,
            fontWeight: "600",
        },

        // ── Godown Card ───────────────────────────────────────────────────
        godownCard: {
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(3),
            marginVertical: responsiveHeight(0.5),
            borderRadius: 12,
            overflow: "hidden",
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
            elevation: 2,
        },
        godownHeader: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: responsiveWidth(3.5),
            paddingVertical: responsiveWidth(3),
            gap: responsiveWidth(2.5),
        },
        godownIconBg: {
            width: responsiveWidth(9),
            height: responsiveWidth(9),
            borderRadius: responsiveWidth(4.5),
            backgroundColor: colors.primary + "15",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
        },
        godownHeaderMid: {
            flex: 1,
        },
        godownName: {
            ...typography.body1,
            fontWeight: "700",
            color: colors.text,
        },
        godownMeta: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(1),
            marginTop: 2,
        },
        godownMetaText: {
            ...typography.overline,
            color: colors.textSecondary,
        },
        godownMetaDot: {
            ...typography.overline,
            color: colors.textSecondary,
        },
        godownHeaderRight: {
            alignItems: "flex-end",
            gap: 2,
        },
        godownBalance: {
            ...typography.body1,
            fontWeight: "700",
        },

        godownQtyBar: {
            flexDirection: "row",
            borderTopWidth: 1,
            borderTopColor: colors.borderColor,
            paddingVertical: responsiveWidth(2),
            paddingHorizontal: responsiveWidth(4),
        },
        qtyBarItem: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
        },
        qtyBarValue: {
            ...typography.caption,
            fontWeight: "700",
        },
        qtyBarLabel: {
            ...typography.overline,
            color: colors.textSecondary,
        },

        // ── Brand Accordion ───────────────────────────────────────────────
        godownBrands: {
            borderTopWidth: 1,
            borderTopColor: colors.borderColor,
        },
        brandAccordion: {
            borderBottomWidth: 1,
            borderBottomColor: colors.grey100,
        },
        brandHeader: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: responsiveWidth(3.5),
            paddingVertical: responsiveWidth(2.5),
            backgroundColor: colors.grey50,
            justifyContent: "space-between",
        },
        brandHeaderLeft: {
            flexDirection: "row",
            alignItems: "center",
            flex: 1,
            gap: responsiveWidth(2),
        },
        brandDot: {
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: colors.primary + "80",
        },
        brandName: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "600",
            flex: 1,
        },
        brandHeaderRight: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(2),
        },
        brandBadge: {
            backgroundColor: colors.primary + "15",
            borderRadius: 10,
            paddingHorizontal: 6,
            paddingVertical: 1,
        },
        brandBadgeText: {
            ...typography.overline,
            color: colors.primary,
            fontWeight: "700",
        },
        brandBalance: {
            ...typography.caption,
            color: colors.text,
            fontWeight: "600",
        },

        // ── Item Row ──────────────────────────────────────────────────────
        brandItems: {
            backgroundColor: colors.background,
        },
        itemRow: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.white,
            marginHorizontal: responsiveWidth(2),
            marginVertical: responsiveWidth(1),
            borderRadius: 8,
            overflow: "hidden",
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.04,
            shadowRadius: 2,
            elevation: 1,
        },
        itemAccent: {
            width: 3,
            alignSelf: "stretch",
        },
        itemRowContent: {
            flex: 1,
            paddingHorizontal: responsiveWidth(2.5),
            paddingVertical: responsiveWidth(2),
        },
        itemName: {
            ...typography.body2,
            color: colors.text,
            fontWeight: "600",
            marginBottom: responsiveWidth(1.5),
        },
        itemRowStats: {
            flexDirection: "row",
            alignItems: "center",
        },
        itemStat: {
            flex: 1,
            alignItems: "center",
        },
        itemStatLabel: {
            ...typography.overline,
            color: colors.textSecondary,
        },
        itemStatValue: {
            ...typography.caption,
            color: colors.text,
            fontWeight: "600",
        },
        itemStatDivider: {
            width: 1,
            height: responsiveHeight(2.5),
            backgroundColor: colors.grey200,
        },

        // ── Group Filter Bottom-Sheet ──────────────────────────────────────
        fmOverlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
        },
        fmSheet: {
            backgroundColor: colors.white,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: "80%",
            paddingBottom: responsiveHeight(3),
        },
        fmHandle: {
            alignSelf: "center",
            width: responsiveWidth(10),
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.grey300,
            marginTop: 10,
            marginBottom: 6,
        },
        fmHeader: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: responsiveWidth(5),
            paddingVertical: responsiveWidth(3),
            borderBottomWidth: 1,
            borderBottomColor: colors.borderColor,
        },
        fmTitle: {
            ...typography.h6,
            fontWeight: "700",
            color: colors.text,
        },
        fmResetText: {
            ...typography.body2,
            color: colors.accent,
            fontWeight: "600",
        },
        fmBody: {
            paddingHorizontal: responsiveWidth(4),
        },
        fmSection: {
            marginTop: responsiveHeight(1.5),
            marginBottom: responsiveHeight(1),
        },
        fmSectionHeader: {
            flexDirection: "row",
            alignItems: "center",
            marginBottom: responsiveHeight(0.8),
            gap: responsiveWidth(2),
        },
        fmSectionTitle: {
            ...typography.body1,
            fontWeight: "700",
            color: colors.text,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            fontSize: 11,
        },
        fmBadge: {
            backgroundColor: colors.primary,
            borderRadius: 10,
            minWidth: 18,
            height: 18,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 4,
        },
        fmBadgeText: {
            ...typography.overline,
            color: colors.white,
            fontWeight: "700",
        },
        fmOptionsWrap: {
            flexDirection: "column",
            gap: responsiveWidth(1.5),
        },
        fmOption: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: responsiveWidth(3),
            paddingVertical: responsiveWidth(2.5),
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.borderColor,
            backgroundColor: colors.white,
            gap: responsiveWidth(2),
        },
        fmOptionActive: {
            borderColor: colors.primary,
            backgroundColor: colors.primary + "10",
        },
        fmCheckbox: {
            width: 16,
            height: 16,
            borderRadius: 4,
            borderWidth: 1.5,
            borderColor: colors.grey400,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
        },
        fmCheckboxActive: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        fmOptionText: {
            ...typography.body2,
            color: colors.textSecondary,
            flexShrink: 1,
        },
        fmOptionTextActive: {
            color: colors.primary,
            fontWeight: "600",
        },
        fmFooter: {
            flexDirection: "row",
            paddingHorizontal: responsiveWidth(4),
            paddingTop: responsiveHeight(1.5),
            borderTopWidth: 1,
            borderTopColor: colors.borderColor,
            gap: responsiveWidth(3),
        },
        fmCancelBtn: {
            flex: 1,
            paddingVertical: responsiveWidth(3),
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.borderColor,
            alignItems: "center",
            backgroundColor: colors.grey50,
        },
        fmCancelBtnText: {
            ...typography.body1,
            color: colors.textSecondary,
            fontWeight: "600",
        },
        fmApplyBtn: {
            flex: 2,
            paddingVertical: responsiveWidth(3),
            borderRadius: 10,
            backgroundColor: colors.primary,
            alignItems: "center",
        },
        fmApplyBtnText: {
            ...typography.body1,
            color: colors.white,
            fontWeight: "700",
        },
    });
