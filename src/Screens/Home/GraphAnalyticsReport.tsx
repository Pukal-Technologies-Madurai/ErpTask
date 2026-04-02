import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ScrollView,
    RefreshControl,
    Dimensions,
} from "react-native";
import React, { useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import AppHeader from "../../Components/AppHeader";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../Context/ThemeContext";
import { responsiveHeight, responsiveWidth } from "../../constants/helper";
import Icon from "react-native-vector-icons/MaterialIcons";
import { BarChart } from "react-native-chart-kit";
import FilterModal from "../../Components/FilterModal";
import dayjs from "dayjs";
import { fetchGraphicalAnalysis, GraphRow } from "../../Api/graphAnalytics";

const screenWidth = Dimensions.get("window").width;

const GraphicalAnalysisReport = () => {
    const { typography, colors } = useTheme();
    const styles = getStyles(typography, colors);
    const navigation = useNavigation();

    const [type, setType] = useState<"SALES" | "PURCHASE" | "STOCK">("SALES");
    const [data, setData] = useState<GraphRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [showGraph, setShowGraph] = useState(false);
    const [graphType, setGraphType] = useState<"VALUE" | "COUNT" | "TONNAGE">("VALUE");
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [modalVisible, setModalVisible] = useState(false);

    // ✅ Month-wise filter state
    const [fromDate, setFromDate] = useState(
        dayjs().startOf("month").toDate()
    );
    const [toDate, setToDate] = useState(
        dayjs().endOf("month").toDate()
    );

    // ✅ Any dynamic filters
    const [dynamicFilters, setDynamicFilters] = useState<Record<string, string>>({});
    const todayStr = dayjs().format("YYYY-MM-DD");

    const todayData = data.find(d => d.Date === todayStr);

    /* ================= FETCH ================= */

    const loadData = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const res = await fetchGraphicalAnalysis(
            type,
            fromDate,
            toDate
        );
        setData(res);

        setLoading(false);
        setRefreshing(false);
    };

    useEffect(() => {
        loadData();
    }, [type, fromDate, toDate]);

    /* ================= KPI ================= */

    const totals = useMemo(() => {
        const totalValue = data.reduce((a, b) => a + b.Invoice_Value, 0);
        const totalCount = data.reduce((a, b) => a + b.Invoice_Count, 0);
        const totalTonnage = data.reduce((a, b) => a + b.Tonnage, 0);

        return {
            totalValue,
            avgValue: data.length ? totalValue / data.length : 0,
            totalCount,
            avgCount: data.length ? totalCount / data.length : 0,
            totalTonnage,
            avgTonnage: data.length ? totalTonnage / data.length : 0,
        };
    }, [data]);

    const formatINR = (num: number | undefined | null) => {
        if (!num) return "0.00";

        return Number(num).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    const sortedData = useMemo(() => {
        return [...data].sort(
            (a, b) => dayjs(b.Date).valueOf() - dayjs(a.Date).valueOf()
        );
    }, [data]);

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Graphical Analysis"
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

                        if (value === "All" || value === null || value === undefined) {
                            value = "";
                        }

                        mapped[`filter${index}`] = value;
                        index++;
                    });

                    // ✅ IMPORTANT: Auto set full month
                    const start = dayjs(selected.fromDate || new Date())
                        .startOf("month")
                        .toDate();

                    const end = dayjs(selected.fromDate || new Date())
                        .endOf("month")
                        .toDate();

                    setFromDate(start);
                    setToDate(end);

                    setDynamicFilters(mapped);
                    setModalVisible(false);
                }}
                onClose={() => setModalVisible(false)}
                showToDate={false}
                title="Filter Options"
                fromLabel="From Date"
                toLabel="To Date"
            />

            <ScrollView
                style={styles.scrollContainer}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => loadData(true)}
                        colors={[colors.primary]}
                    />
                }
            >

                {/* 🔥 TOGGLE */}
                <View style={styles.toggleCenter}>
                    {["SALES", "PURCHASE", "STOCK"].map(t => (
                        <TouchableOpacity
                            key={t}
                            style={[
                                styles.toggleBtn,
                                type === t && styles.toggleActive,
                            ]}
                            onPress={() => setType(t as any)}
                        >
                            <Text
                                style={[
                                    styles.toggleText,
                                    type === t && styles.toggleTextActive,
                                ]}
                            >
                                {t === "SALES"
                                    ? "Sales"
                                    : t === "PURCHASE"
                                        ? "Purchase"
                                        : "Stock Value"}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* 🔥 KPI CARDS */}
                <View style={styles.kpiRow}>
                    {type === "STOCK" ? (
                        <>
                            {/* STOCK VALUE */}
                            <View style={styles.kpiCard}>
                                <Text style={styles.kpiTitle}>Stock Value</Text>
                                <Text style={styles.kpiValue}>
                                    ₹{formatINR(todayData?.Invoice_Value)}
                                </Text>
                                <Text style={styles.kpiSub}>
                                    Avg ₹{formatINR(totals.avgValue)}
                                </Text>
                            </View>

                            {/* TONNAGE */}
                            <View style={styles.kpiCard}>
                                <Text style={styles.kpiTitle}>Tonnage</Text>
                                <Text style={styles.kpiValue}>
                                    {formatINR(todayData?.Tonnage)}
                                </Text>
                                <Text style={styles.kpiSub}>
                                    Avg {formatINR(totals.avgTonnage)}
                                </Text>
                            </View>
                        </>
                    ) : (
                        <>
                            {/* SALES or PURCHASE → 3 KPI cards */}
                            <View style={styles.kpiCard}>
                                <Text style={styles.kpiTitle}>Invoice Value</Text>
                                <Text style={styles.kpiValue}>₹{formatINR(totals.totalValue)}</Text>
                                <Text style={styles.kpiSub}>
                                    Avg ₹{formatINR(totals.avgValue)}
                                </Text>
                            </View>

                            <View style={styles.kpiCard}>
                                <Text style={styles.kpiTitle}>Invoice Count</Text>
                                <Text style={styles.kpiValue}>{totals.totalCount}</Text>
                                <Text style={styles.kpiSub}>Avg {totals.avgCount.toFixed(2)}</Text>
                            </View>

                            <View style={styles.kpiCard}>
                                <Text style={styles.kpiTitle}>Tonnage</Text>
                                <Text style={styles.kpiValue}>{formatINR(totals.totalTonnage)}</Text>
                                <Text style={styles.kpiSub}>
                                    Avg {formatINR(totals.avgTonnage)}
                                </Text>
                            </View>
                        </>
                    )}
                </View>

                {/* 🔥 GRAPH BUTTON */}
                <TouchableOpacity
                    style={styles.graphBtn}
                    onPress={() => setShowGraph(!showGraph)}
                >
                    <Icon name="bar-chart" size={18} color="#FFF" />
                    <Text style={styles.graphBtnText}>
                        {showGraph ? "Show Abstract Table" : "Show Graph"}
                    </Text>
                </TouchableOpacity>

                {/* 🔥 TABLE */}
                {!showGraph && (
                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <Text style={styles.tableHeaderText}>Date</Text>
                            {type !== "STOCK" && (
                                <Text style={styles.tableHeaderText}>Count</Text>
                            )}
                            <Text style={styles.tableHeaderText}>Tonnage</Text>
                            <Text style={styles.tableHeaderText}>Value</Text>
                        </View>

                        {sortedData.map((item, i) => (
                            <View key={item.Date || i} style={styles.tableRow}>
                                <Text style={styles.tableCell}>
                                    {dayjs(item.Date).format("DD-MMM")}
                                </Text>

                                {type !== "STOCK" && (
                                    <Text style={styles.tableCell}>
                                        {item.Invoice_Count}
                                    </Text>
                                )}

                                <Text style={styles.tableCell}>
                                    {formatINR(item.Tonnage)}
                                </Text>

                                <Text style={styles.tableCell}>
                                    ₹{formatINR(item.Invoice_Value)}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* 🔥 GRAPH */}
                {showGraph && data.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <BarChart
                            data={{
                                labels: data.map(item =>
                                    dayjs(item.Date).format("DD")
                                ),
                                datasets: [
                                    {
                                        data: data.map(d => d.Invoice_Value),
                                        color: () => "#007bff",
                                    },
                                    {
                                        data: data.map(d => d.Tonnage),
                                        color: () => "#28a745",
                                    },
                                ],
                            }}
                            width={Math.max(screenWidth, data.length * 50)}
                            height={280}
                            yAxisLabel="₹"
                            yAxisSuffix=""
                            fromZero
                            showValuesOnTopOfBars
                            chartConfig={{
                                backgroundGradientFrom: "#ffffff",
                                backgroundGradientTo: "#ffffff",
                                decimalPlaces: 0,

                                color: (opacity = 1) => `rgba(0,0,0,${opacity})`,
                                labelColor: () => "#666",

                                propsForBackgroundLines: {
                                    stroke: "#eee",
                                },

                                propsForLabels: {
                                    fontSize: 8, // 👈 reduce for mobile
                                },

                                barPercentage: 0.9,
                            }}
                            verticalLabelRotation={-30}
                            style={{
                                marginVertical: 12,
                                borderRadius: 10,
                                paddingRight: 60,
                            }}
                        />
                    </ScrollView>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default GraphicalAnalysisReport;

/* ================= STYLES ================= */

const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.primary,
        },
        scrollContainer: {
            backgroundColor: colors.white,
        },

        toggleCenter: {
            flexDirection: "row",
            justifyContent: "center",
            marginVertical: responsiveHeight(2),
        },

        toggleBtn: {
            borderWidth: 1,
            borderColor: colors.primary,
            paddingVertical: 6,
            paddingHorizontal: 14,
            marginHorizontal: 5,
            borderRadius: 4,
        },
        toggleActive: {
            backgroundColor: colors.primary,
        },
        toggleText: {
            color: colors.primary,
            fontWeight: "600",
        },
        toggleTextActive: {
            color: "#FFF",
        },

        kpiRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: 10,
        },

        kpiCard: {
            flex: 1,
            backgroundColor: colors.white,
            marginHorizontal: 4,
            padding: 10,
            borderRadius: 8,
            elevation: 2,
        },

        kpiTitle: {
            fontSize: 12,
            color: colors.textSecondary,
        },

        kpiValue: {
            fontSize: 13,
            fontWeight: "700",
            color: colors.text,
        },

        kpiSub: {
            fontSize: 11,
            color: colors.textSecondary,
        },

        graphBtn: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primary,
            margin: 12,
            padding: 10,
            borderRadius: 6,
        },

        graphBtnText: {
            color: "#FFF",
            marginLeft: 6,
            fontWeight: "600",
        },

        table: {
            marginHorizontal: 10,
            borderWidth: 1,
            borderColor: colors.borderColor,
            borderRadius: 6,
            overflow: "hidden",
        },

        tableHeader: {
            flexDirection: "row",
            backgroundColor: colors.background,
            padding: 8,
        },

        tableRow: {
            flexDirection: "row",
            padding: 8,
            borderTopWidth: 1,
            borderColor: colors.borderColor,
        },

        tableHeaderText: {
            flex: 1,
            textAlign: "center",
            fontWeight: "600",
            fontSize: 12,
        },

        tableCell: {
            flex: 1,
            textAlign: "center",
            fontSize: 12,
            color: colors.text,
        },
    });