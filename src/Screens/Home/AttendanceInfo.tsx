import {
    ScrollView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
} from "react-native";
import React from "react";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import Icon from "react-native-vector-icons/MaterialIcons";
import AppHeader from "../../Components/AppHeader";
import { useTheme } from "../../Context/ThemeContext";
import { RootStackParamList } from "../../Navigation/types";
import { getEmpDeptWiseAttendance } from "../../Api/EmpAttendance";
import DatePickerButton from "../../Components/DatePickerButton";
import { responsiveWidth, responsiveHeight } from "../../constants/helper";
import { SafeAreaView } from "react-native-safe-area-context";
import FilterModal from "../../Components/FilterModal";

const AttendanceInfo = () => {
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { colors, typography } = useTheme();
    const styles = getStyles(typography, colors);
    const [modalVisible, setModalVisible] = React.useState(false);

    const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
    const [expandedDepartment, setExpandedDepartment] = React.useState<
        string | null
    >(null);

    const {
        data: attendanceData,
        isLoading,
        error,
    } = useQuery({
        queryKey: ["attendanceData", selectedDate],
        queryFn: async () => {
            if (!selectedDate) return null;
            return await getEmpDeptWiseAttendance(selectedDate, selectedDate);
        },
        enabled: !!selectedDate,
    });

    // Parse department wise data from JSON string
    const parseDepartmentData = (departmentWiseCounts: string) => {
        try {
            return JSON.parse(departmentWiseCounts);
        } catch (error) {
            console.error("Error parsing department data:", error);
            return [];
        }
    };

    // Calculate attendance percentage
    const calculateAttendancePercentage = (present: number, total: number) => {
        return total > 0 ? Math.round((present / total) * 100) : 0;
    };

    const mainData = attendanceData?.[0];
    const departmentData = mainData
        ? parseDepartmentData(mainData.DepartmentWiseCounts || "[]")
        : [];

    // Summary Card Component
    const SummaryCard = ({
        title,
        value,
        subtitle,
        icon,
        color,
    }: {
        title: string;
        value: string | number;
        subtitle?: string;
        icon: string;
        color: string;
    }) => (
        <View style={[styles.summaryCard, { borderLeftColor: color }]}>
            <View style={styles.summaryCardContent}>
                <View style={styles.summaryCardLeft}>
                    <Text style={styles.summaryCardTitle}>{title}</Text>
                    <Text style={styles.summaryCardValue}>{value}</Text>
                    {subtitle && (
                        <Text style={styles.summaryCardSubtitle}>
                            {subtitle}
                        </Text>
                    )}
                </View>
                <View
                    style={[
                        styles.summaryCardIcon,
                        { backgroundColor: color + "20" },
                    ]}>
                    <Icon name={icon} size={24} color={color} />
                </View>
            </View>
        </View>
    );

    // Department Card Component
    const DepartmentCard = ({ department }: { department: any }) => {
        const isExpanded = expandedDepartment === department.Department;
        const attendancePercentage = calculateAttendancePercentage(
            department.TotalPresentToday,
            department.TotalEmployees,
        );

        return (
            <View style={styles.departmentCard}>
                <TouchableOpacity
                    style={styles.departmentHeader}
                    onPress={() =>
                        setExpandedDepartment(
                            isExpanded ? null : department.Department,
                        )
                    }>
                    <View style={styles.departmentHeaderLeft}>
                        <Text style={styles.departmentName}>
                            {department.Department}
                        </Text>
                        <Text style={styles.departmentStats}>
                            {department.TotalPresentToday}/
                            {department.TotalEmployees} Present (
                            {attendancePercentage}%)
                        </Text>
                    </View>
                    <Icon
                        name={isExpanded ? "expand-less" : "expand-more"}
                        size={24}
                        color={colors.textSecondary}
                    />
                </TouchableOpacity>

                {/* Progress Bar */}
                <View style={styles.progressBarContainer}>
                    <View style={styles.progressBarBackground}>
                        <View
                            style={[
                                styles.progressBarFill,
                                {
                                    width: `${attendancePercentage}%`,
                                    backgroundColor:
                                        attendancePercentage >= 75
                                            ? colors.primary
                                            : attendancePercentage >= 50
                                            ? "#FF9800"
                                            : colors.accent,
                                },
                            ]}
                        />
                    </View>
                    <Text style={styles.progressBarText}>
                        {attendancePercentage}%
                    </Text>
                </View>

                {/* Gender Breakdown */}
                <View style={styles.genderBreakdown}>
                    <View style={styles.genderItem}>
                        <Icon name="male" size={16} color={colors.primary} />
                        <Text style={styles.genderText}>
                            Male: {department.TotalMalePresentToday || 0}/
                            {department.TotalMaleEmployees}
                        </Text>
                    </View>
                    <View style={styles.genderItem}>
                        <Icon name="female" size={16} color={colors.accent} />
                        <Text style={styles.genderText}>
                            Female: {department.TotalFemalePresentToday || 0}/
                            {department.TotalFemaleEmployees}
                        </Text>
                    </View>
                </View>

                {/* Expanded Employee List */}
                {isExpanded && (
                    <View style={styles.employeeList}>
                        <Text style={styles.employeeListTitle}>Employees:</Text>
                        {department.Employees?.map(
                            (employee: any, index: number) => (
                                <View key={index} style={styles.employeeItem}>
                                    <Icon
                                        name="person"
                                        size={16}
                                        color={
                                            employee.Sex === "Male"
                                                ? colors.primary
                                                : colors.accent
                                        }
                                    />
                                    <Text style={styles.employeeName}>
                                        {employee.Emp_Name}
                                    </Text>
                                    <Text style={styles.employeeDesignation}>
                                        Designation: {employee.Designation}
                                    </Text>
                                </View>
                            ),
                        )}
                    </View>
                )}
            </View>
        );
    };

    const handleCloseModal = () => {
        setModalVisible(false);
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <AppHeader
                title="Attendance Info"
                showDrawer={true}
                navigation={navigation}
                showRightIcon={true}
                rightIconLibrary="MaterialIcon"
                rightIconName="filter-list"
                onRightPress={() => setModalVisible(true)}
            />

            <FilterModal
                visible={modalVisible}
                fromDate={selectedDate}
                onFromDateChange={setSelectedDate}
                onApply={() => setModalVisible(false)}
                onClose={handleCloseModal}
                title="Filter Options"
                fromLabel="From Date"
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.scrollViewContainer}>
                {/* Loading State */}
                {isLoading && (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>
                            Loading attendance data...
                        </Text>
                    </View>
                )}

                {/* Error State */}
                {error && (
                    <View style={styles.errorContainer}>
                        <Icon name="error" size={24} color={colors.accent} />
                        <Text style={styles.errorText}>
                            Failed to load attendance data
                        </Text>
                    </View>
                )}

                {/* Data Display */}
                {mainData && (
                    <>
                        {/* Summary Cards */}
                        <View style={styles.summarySection}>
                            <Text style={styles.sectionTitle}>
                                Overall Summary
                            </Text>
                            <View style={styles.summaryGrid}>
                                <SummaryCard
                                    title="Total Employees"
                                    value={mainData.TotalEmployees}
                                    subtitle={`${mainData.TotalMaleEmployees} Male, ${mainData.TotalFemaleEmployees} Female`}
                                    icon="people"
                                    color={colors.primary}
                                />
                                <SummaryCard
                                    title="Present Today"
                                    value={mainData.TotalPresentToday || 0}
                                    subtitle={`${calculateAttendancePercentage(
                                        mainData.TotalPresentToday || 0,
                                        mainData.TotalEmployees,
                                    )}% Attendance`}
                                    icon="check-circle"
                                    color={colors.primary}
                                />
                                <SummaryCard
                                    title="Departments"
                                    value={mainData.TotalDepartments}
                                    subtitle={`${
                                        mainData.TotalDepartmentsPresentToday ||
                                        0
                                    } Present Today`}
                                    icon="business"
                                    color={colors.accent}
                                />
                            </View>
                        </View>

                        {/* Department Wise Data */}
                        <View style={styles.departmentSection}>
                            <Text style={styles.sectionTitle}>
                                Department Wise Attendance
                            </Text>
                            {departmentData.map(
                                (department: any, index: number) => (
                                    <DepartmentCard
                                        key={index}
                                        department={department}
                                    />
                                ),
                            )}
                        </View>
                    </>
                )}

                {/* No Data State */}
                {!isLoading && !error && !mainData && (
                    <View style={styles.noDataContainer}>
                        <Icon
                            name="info"
                            size={48}
                            color={colors.textSecondary}
                        />
                        <Text style={styles.noDataText}>
                            No attendance data available
                        </Text>
                        <Text style={styles.noDataSubtext}>
                            Please select a date range to view data
                        </Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default AttendanceInfo;

const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.primary,
        },
        scrollViewContainer: {
            backgroundColor: colors.background,
        },

        sectionTitle: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "600",
            marginBottom: responsiveHeight(2),
        },
        // Summary Section
        summarySection: {
            padding: responsiveWidth(4),
        },
        summaryGrid: {
            gap: responsiveWidth(3),
        },
        summaryCard: {
            backgroundColor: colors.white,
            borderRadius: 12,
            padding: responsiveWidth(4),
            marginBottom: responsiveHeight(2),
            borderLeftWidth: 4,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        summaryCardContent: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        summaryCardLeft: {
            flex: 1,
        },
        summaryCardTitle: {
            ...typography.body2,
            color: colors.textSecondary,
            marginBottom: 4,
        },
        summaryCardValue: {
            ...typography.h4,
            color: colors.text,
            fontWeight: "700",
            marginBottom: 4,
        },
        summaryCardSubtitle: {
            ...typography.caption,
            color: colors.textSecondary,
        },
        summaryCardIcon: {
            width: responsiveWidth(12),
            height: responsiveWidth(12),
            borderRadius: responsiveWidth(6),
            alignItems: "center",
            justifyContent: "center",
        },

        // Department Section
        departmentSection: {
            paddingHorizontal: responsiveWidth(4),
            paddingBottom: responsiveHeight(4),
        },
        departmentCard: {
            backgroundColor: colors.white,
            borderRadius: 12,
            marginBottom: responsiveHeight(2),
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
            overflow: "hidden",
        },
        departmentHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: responsiveWidth(4),
        },
        departmentHeaderLeft: {
            flex: 1,
        },
        departmentName: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "600",
            marginBottom: 4,
        },
        departmentStats: {
            ...typography.body2,
            color: colors.textSecondary,
        },

        // Progress Bar
        progressBarContainer: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: responsiveWidth(4),
            paddingBottom: responsiveWidth(2),
            gap: responsiveWidth(2),
        },
        progressBarBackground: {
            flex: 1,
            height: 8,
            backgroundColor: colors.grey,
            borderRadius: 4,
            overflow: "hidden",
        },
        progressBarFill: {
            height: "100%",
            borderRadius: 4,
        },
        progressBarText: {
            ...typography.caption,
            color: colors.text,
            fontWeight: "600",
            minWidth: responsiveWidth(10),
            textAlign: "right",
        },

        // Gender Breakdown
        genderBreakdown: {
            flexDirection: "row",
            justifyContent: "space-around",
            paddingHorizontal: responsiveWidth(4),
            paddingVertical: responsiveWidth(2),
            borderTopWidth: 1,
            borderTopColor: colors.borderColor,
        },
        genderItem: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(1),
        },
        genderText: {
            ...typography.caption,
            color: colors.textSecondary,
        },

        // Employee List
        employeeList: {
            paddingHorizontal: responsiveWidth(4),
            paddingBottom: responsiveWidth(2),
            borderTopWidth: 1,
            borderTopColor: colors.borderColor,
        },
        employeeListTitle: {
            ...typography.body1,
            color: colors.text,
            fontWeight: "600",
            marginVertical: responsiveWidth(2),
        },
        employeeItem: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: responsiveWidth(1.5),
            paddingHorizontal: responsiveWidth(2),
            backgroundColor: colors.background,
            borderRadius: 6,
            marginBottom: responsiveWidth(1),
            gap: responsiveWidth(2),
        },
        employeeName: {
            ...typography.body2,
            color: colors.text,
            flex: 1,
        },
        employeeDesignation: {
            ...typography.caption,
            color: colors.textSecondary,
        },

        // State Components
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
            gap: responsiveWidth(2),
        },
        errorText: {
            ...typography.body1,
            color: colors.accent,
            textAlign: "center",
        },
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
