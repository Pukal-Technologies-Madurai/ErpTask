import { StyleSheet, Text, View, TouchableOpacity, Modal } from "react-native";
import React, { FC } from "react";
import DatePickerButton from "./DatePickerButton";
import EnhancedDropdown from "./EnhancedDropdown";
import { useTheme } from "../Context/ThemeContext";
import { shadows, spacing } from "../constants/helper";
import { fetchSalesInvoiceFilters } from "../Api/Sales";
import { Dropdown } from "react-native-element-dropdown";


// Define interfaces for dropdown items
interface DropdownItem {
    label: string;
    value: string;
}

type FilterModalProps = {
    // Required props
    visible: boolean;
    fromDate: Date;
    fromLabel: string;
    onFromDateChange: (date: Date) => void;
    onApply: (selectedFilters: Record<string, string>) => void;
    onClose: () => void;
    title: string;

    // Optional To Date props
    showToDate?: boolean;
    toDate?: Date;
    onToDateChange?: (date: Date) => void;
    toLabel?: string;

    // Optional Sales Person props
    showSalesPerson?: boolean;
    salesPersonData?: DropdownItem[];
    selectedSalesPerson?: DropdownItem | null;
    onSalesPersonChange?: (salesPerson: DropdownItem | null) => void;
    salesPersonLabel?: string;
    brand?: boolean;
    brandlabel?: string;

    // Optional Payment Option props
    showPaymentOption?: boolean;
    paymentOptionData?: DropdownItem[];
    selectedPaymentOption?: DropdownItem | null;
    onPaymentOptionChange?: (paymentOption: DropdownItem | null) => void;
    paymentOptionLabel?: string;
    salesinvoiceFilter?: (salesinvoicefilter1: DropdownItem | null) => void;
    enableDynamicFilter?: boolean;
};

const FilterModal: FC<FilterModalProps> = ({
    visible,
    fromDate,
    onFromDateChange,
    onApply,
    onClose,
    title = "Filter",
    fromLabel = "From",
    showToDate = false,
    toDate,
    onToDateChange,
    toLabel = "To",
    showSalesPerson = false,
    salesPersonData = [],
    selectedSalesPerson = null,
    onSalesPersonChange,
    salesPersonLabel = "Sales Person",
    showPaymentOption = false,
    paymentOptionData = [],
    selectedPaymentOption = null,
    onPaymentOptionChange,
    paymentOptionLabel = "Payment Option",
    enableDynamicFilter = false,
}) => {
    const { colors, typography } = useTheme();
    const styles = getStyles(typography, colors);

    const [filterOptions, setFilterOptions] = React.useState<any[]>([]);
    const [selectedFilters, setSelectedFilters] = React.useState<Record<string, string>>({});
    const [filterDynamicMapping, setFilterDynamicMapping] = React.useState<Record<string, string>>({});

    React.useEffect(() => {
        const loadFilters = async () => {
            try {
                // ✅ Keep previous selections so they aren't reset on refresh
                const prevSelectedFilters = { ...selectedFilters };

                console.log("Fetching filters from API...");
                const res = await fetchSalesInvoiceFilters();
                if (!res || !Array.isArray(res)) {
                    console.warn("Invalid response for filters:", res);
                    setFilterOptions([]);
                    return;
                }

                // ✅ Build mapping for dynamic filters
                const filterDynamicMapping: Record<string, string> = {};
                res.forEach((filter: any, index: number) => {
                    filterDynamicMapping[filter.columnName] = `filter${index + 1}`;
                });
                setFilterDynamicMapping(filterDynamicMapping);

                // ✅ Map API data into searchable-friendly format
                const enhancedFilters = res.map((filter: any) => ({
                    ...filter,
                    searchQuery: "", // local search state for dropdown filtering
                    filteredOptions: filter.options || [], // filtered list for UI
                }));

                // ✅ Preserve previous selections
                const updatedSelectedFilters: Record<string, string> = {};
                enhancedFilters.forEach((filter: any) => {
                    const prevValue = prevSelectedFilters[filter.columnName];
                    if (prevValue) {
                        updatedSelectedFilters[filter.columnName] = prevValue;
                    }
                });

                setFilterOptions(enhancedFilters);
                setSelectedFilters(updatedSelectedFilters);

                console.log("✅ Filters loaded successfully:", enhancedFilters.length);
            } catch (err) {
                console.error("❌ Failed to fetch salesinvoiceFilter:", err);
            }
        };

        if (visible && enableDynamicFilter) loadFilters();
        else if (!enableDynamicFilter) setFilterOptions([]);

    }, [visible]);

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{title}</Text>
                    </View>

                    <View style={styles.modalBody}>


                        {/* Sales Person Dropdown */}
                        {showSalesPerson && (
                            <View style={styles.dropdownContainer}>
                                <Text style={styles.dateLabel}>
                                    {salesPersonLabel}
                                </Text>
                                <EnhancedDropdown
                                    data={salesPersonData}
                                    labelField="label"
                                    valueField="value"
                                    placeholder="Select Sales Person"
                                    value={selectedSalesPerson?.value || ""}
                                    onChange={onSalesPersonChange}
                                />
                            </View>
                        )}

                        {/* Brand wise Dropdown */}
                        {/* {brand && (
                            <View style={styles.dropdownContainer}>
                                <Text style={styles.dateLabel}>
                                    {brandlabel}
                                </Text>
                                <EnhancedDropdown
                                    data={salesPersonData}
                                    labelField="label"
                                    valueField="value"
                                    placeholder="Select Filter"
                                    value={selectedSalesPerson?.value || ""}
                                    onChange={salesinvoiceFilter}
                                />
                            </View>
                        )} */}

                        {/* 🔽 Dynamic API-based filters */}
                        {filterOptions.length > 0 && (
                            <View style={{ marginTop: 16 }}>
                                {filterOptions.map((filter: any) => (
                                    <View key={filter.columnName} style={{ marginBottom: 12 }}>
                                        <Text style={[styles.label]}>
                                            {filter.columnName.replace(/_/g, " ")}
                                        </Text>

                                        <Dropdown
                                            style={{
                                                borderColor: "#ccc",
                                                borderWidth: 1,
                                                borderRadius: 8,
                                                paddingHorizontal: 8,
                                                height: 45,
                                            }}
                                            data={[
                                                { label: "All", value: "" },
                                                ...(filter.options?.map((option: any) => ({
                                                    label: option.label,
                                                    value: option.value,
                                                })) || []),
                                            ]}
                                            search
                                            maxHeight={250}
                                            labelField="label"
                                            valueField="value"
                                            placeholder={`Select ${filter.columnName.replace(/_/g, " ")}`}
                                            searchPlaceholder="Search..."
                                            value={selectedFilters[filter.columnName] || ""}
                                            onChange={(item: any) => {
                                                const selectedLabel = item.label;
                                                console.log("Selected:", selectedLabel);

                                                setSelectedFilters((prev: any) => ({
                                                    ...prev,
                                                    [filterDynamicMapping[filter.columnName]]: selectedLabel,
                                                }));
                                            }}
                                        />
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Payment Option Dropdown */}
                        {showPaymentOption && (
                            <View style={styles.dropdownContainer}>
                                <Text style={styles.dateLabel}>
                                    {paymentOptionLabel}
                                </Text>
                                <EnhancedDropdown
                                    data={paymentOptionData}
                                    labelField="label"
                                    valueField="value"
                                    placeholder="Select Payment Option"
                                    value={selectedPaymentOption?.value || ""}
                                    onChange={onPaymentOptionChange}
                                />
                            </View>
                        )}

                        {/* Date Pickers */}
                        <View style={styles.datePickerContainer}>
                            <Text style={styles.dateLabel}>{fromLabel}</Text>
                            <DatePickerButton
                                title=""
                                date={fromDate}
                                onDateChange={onFromDateChange}
                            />
                        </View>

                        {showToDate && toDate && onToDateChange && (
                            <View style={styles.datePickerContainer}>
                                <Text style={styles.dateLabel}>{toLabel}</Text>
                                <DatePickerButton
                                    title=""
                                    date={toDate}
                                    onDateChange={onToDateChange}
                                />
                            </View>
                        )}
                    </View>

                    <View style={styles.modalFooter}>
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={onClose}
                            activeOpacity={0.7}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.applyButton}
                            onPress={() => {
                                onApply(selectedFilters);
                                onClose();
                            }}>
                            <Text style={styles.applyButtonText}>Apply</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default FilterModal;

const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        modalOverlay: {
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: spacing.lg,
        },
        modalContainer: {
            backgroundColor: colors.white || colors.background,
            borderRadius: 16,
            width: "100%",
            maxWidth: 400,
            ...shadows.large,
        },
        modalHeader: {
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.grey200 || colors.border,
        },
        modalTitle: {
            ...typography.h3,
            color: colors.grey900 || colors.text,
            fontWeight: "600",
        },
        modalBody: {
            padding: spacing.lg,
            gap: spacing.lg,
        },
        datePickerContainer: {
            gap: spacing.sm,
        },
        dropdownContainer: {
            gap: spacing.sm,
        },
        dateLabel: {
            ...typography.subtitle2,
            color: colors.grey700 || colors.textSecondary,
            fontWeight: "500",
        },
        modalFooter: {
            flexDirection: "row",
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.lg,
            paddingTop: spacing.md,
            gap: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.grey200 || colors.border,
        },
        cancelButton: {
            flex: 1,
            backgroundColor: colors.grey100 || colors.secondary,
            paddingVertical: spacing.md,
            borderRadius: 8,
            alignItems: "center",
            ...shadows.small,
        },
        cancelButtonText: {
            ...typography.button,
            color: colors.grey700 || colors.text,
            fontWeight: "600",
        },
        applyButton: {
            flex: 1,
            backgroundColor: colors.primary,
            paddingVertical: spacing.md,
            borderRadius: 8,
            alignItems: "center",
            ...shadows.small,
        },
        applyButtonText: {
            ...typography.button,
            color: colors.white,
            fontWeight: "600",
        },
        label: {
            fontSize: 14,
            fontWeight: '600',
            marginBottom: 6,
            color: '#333',
        },
    });
