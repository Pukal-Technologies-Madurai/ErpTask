import { StyleSheet, Text, View, TouchableOpacity, Modal } from "react-native";
import React, { FC } from "react";
import DatePickerButton from "./DatePickerButton";
import EnhancedDropdown from "./EnhancedDropdown";
import { useTheme } from "../Context/ThemeContext";
import { shadows, spacing } from "../constants/helper";
import { fetchSalesInvoiceFilters } from "../Api/Sales";
import MultiSelectDropdown from "./MultiSelectDropdown";

export interface DropdownItem {
    label: string;
    value: string;
}

export type FilterModalProps = {
    visible: boolean;
    title?: string;

    // Date filters
    fromDate: Date;
    fromLabel?: string;
    onFromDateChange: (date: Date) => void;

    showToDate?: boolean;
    toDate?: Date;
    toLabel?: string;
    onToDateChange?: (date: Date) => void;

    // Apply + Close
    onApply: (selectedFilters: Record<string, string>) => void;
    onClose: () => void;

    enableDynamicFilter?: boolean;
    fetchFiltersFn?: (date: Date) => Promise<any[]>;
    externalFilters?: any[];

    // Sales Person Filter
    showSalesPerson?: boolean;
    salesPersonLabel?: string;
    salesPersonData?: DropdownItem[];
    selectedSalesPerson?: DropdownItem | null;
    onSalesPersonChange?: (item: DropdownItem | null) => void;

    // Payment Option Filter
    showPaymentOption?: boolean;
    paymentOptionLabel?: string;
    paymentOptionData?: DropdownItem[];
    selectedPaymentOption?: DropdownItem | null;
    onPaymentOptionChange?: (item: DropdownItem | null) => void;

    defaultLabel?: string;
    reportName?: string;
    expectedReportName?: string;

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
    defaultLabel = "All",
    fetchFiltersFn,
    externalFilters,
    reportName,
    expectedReportName,
}) => {
    const { colors, typography } = useTheme();
    const styles = getStyles(typography, colors);

    const [filterOptions, setFilterOptions] = React.useState<any[]>([]);
    const [selectedFilters, setSelectedFilters] = React.useState<Record<string, string>>({});
    const [filterDynamicMapping, setFilterDynamicMapping] = React.useState<Record<string, string>>({});

    //  -------------------------
    //  LOAD FILTERS (ONLY LEVEL 1)
    //  -------------------------
    React.useEffect(() => {
        const loadFilters = async () => {
            try {
                let res: any[] | null = null;

                if (externalFilters?.length) {
                    res = externalFilters;
                } else if (fetchFiltersFn) {
                    res = await fetchFiltersFn(fromDate);
                } else {
                    res = await fetchSalesInvoiceFilters();
                }

                if (!res || !Array.isArray(res)) {
                    setFilterOptions([]);
                    return;
                }

                //  ✅ FILTER ONLY LEVEL 1
                const LEVEL1 = res.filter((item) => item.FilterLevel === 1);

                const mapping: Record<string, string> = {};
                LEVEL1.forEach((f: any, idx: number) => {
                    mapping[f.columnName] = `filter${idx + 1}`;
                });

                setFilterDynamicMapping(mapping);

                const enhanced = LEVEL1.map((f: any) => ({
                    ...f,
                    searchQuery: "",
                    filteredOptions: f.options ?? [],
                }));

                setFilterOptions(enhanced);
            } catch (err) {
                console.error("Error loading filters", err);
                setFilterOptions([]);
            }
        };

        // NEW: Dynamic filter should load ONLY when report names match
        const canLoadDynamic =
            visible &&
            enableDynamicFilter &&
            reportName &&
            expectedReportName &&
            reportName.toLowerCase() === expectedReportName.toLowerCase();

        if (canLoadDynamic) {
            loadFilters();
        } else {
            // Prevent loading dynamic filters for non-matching pages
            setFilterOptions([]);
        }


    }, [visible, enableDynamicFilter, fromDate, fetchFiltersFn, externalFilters]);

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{title}</Text>
                    </View>

                    <View style={styles.modalBody}>
                        {/* Date Pickers */}
                        <View style={{ flexDirection: "row", marginTop: 8, marginBottom: -10, gap: 12 }}>
                            <View style={[styles.datePickerContainer, { flex: 1 }]}>
                                <Text style={styles.dateLabel}>{fromLabel}</Text>
                                <DatePickerButton title="" date={fromDate} onDateChange={onFromDateChange} />
                            </View>

                            {showToDate && toDate && onToDateChange && (
                                <View style={[styles.datePickerContainer, { flex: 1 }]}>
                                    <Text style={styles.dateLabel}>{toLabel}</Text>
                                    <DatePickerButton title="" date={toDate} onDateChange={onToDateChange} />
                                </View>
                            )}
                        </View>

                        {/* Sales Person Dropdown */}
                        {showSalesPerson && (
                            <View style={styles.dropdownContainer}>
                                <Text style={styles.dateLabel}>{salesPersonLabel}</Text>
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

                        {/*  -------------------------
                            DYNAMIC FILTERS (LEVEL 1 ONLY)
                            --------------------------- */}
                        {filterOptions.length > 0 && (
                            <View style={{ marginTop: 16 }}>
                                {filterOptions.map((filter: any) => {
                                    const mappedKey = filterDynamicMapping[filter.columnName];
                                    const selectedList: string[] =
                                        selectedFilters[mappedKey]?.split(",").filter(Boolean) || [];

                                    const options =
                                        filter.options?.map((o: any) => ({
                                            label: o.label,
                                            value: o.value,
                                        })) || [];

                                    return (
                                        <MultiSelectDropdown
                                            key={filter.columnName}
                                            label={filter.columnName.replace(/_/g, " ")}
                                            selected={selectedList}
                                            options={options}
                                            onChange={(values) => {
                                                setSelectedFilters((prev) => ({
                                                    ...prev,
                                                    [mappedKey]: values.join(","),
                                                }));
                                            }}
                                        />
                                    );
                                })}
                            </View>
                        )}

                        {/* Payment Option Dropdown */}
                        {showPaymentOption && (
                            <View style={styles.dropdownContainer}>
                                <Text style={styles.dateLabel}>{paymentOptionLabel}</Text>
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
                    </View>

                    <View style={styles.modalFooter}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.7}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.applyButton}
                            onPress={() => {
                                onApply(selectedFilters);
                                onClose();
                            }}
                        >
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
            fontWeight: "600",
            marginBottom: 6,
            color: "#333",
        },
    });
