import { StyleSheet, Text, View, TouchableOpacity, Modal } from "react-native";
import React, { FC } from "react";
import DatePickerButton from "./DatePickerButton";
import EnhancedDropdown from "./EnhancedDropdown";
import { useTheme } from "../Context/ThemeContext";
import { shadows, spacing } from "../constants/helper";

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
    onApply: () => void;
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

    // Optional Payment Option props
    showPaymentOption?: boolean;
    paymentOptionData?: DropdownItem[];
    selectedPaymentOption?: DropdownItem | null;
    onPaymentOptionChange?: (paymentOption: DropdownItem | null) => void;
    paymentOptionLabel?: string;
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
}) => {
    const { colors, typography } = useTheme();
    const styles = getStyles(typography, colors);

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{title}</Text>
                    </View>

                    <View style={styles.modalBody}>
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
                            onPress={onApply}
                            activeOpacity={0.7}>
                            <Text style={styles.applyButtonText}>
                                Apply Filter
                            </Text>
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
    });
