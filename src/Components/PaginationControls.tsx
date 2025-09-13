import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useTheme } from "../Context/ThemeContext";
import { responsiveWidth, responsiveHeight } from "../constants/helper";

interface PaginationControlsProps {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    totalRecords: number;
    onPageChange: (page: number) => void;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
    currentPage,
    totalPages,
    totalItems,
    totalRecords,
    onPageChange,
}) => {
    const { typography, colors } = useTheme();
    const styles = getStyles(typography, colors);

    return (
        <View style={styles.paginationContainer}>
            <TouchableOpacity
                style={[
                    styles.pageButton,
                    currentPage === 1 && styles.pageButtonDisabled,
                ]}
                onPress={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}>
                <Icon
                    name="chevron-left"
                    size={20}
                    color={
                        currentPage === 1
                            ? colors.textSecondary
                            : colors.primary
                    }
                />
            </TouchableOpacity>

            <Text style={styles.pageInfo}>
                Page {currentPage} of {totalPages} ({totalItems} items,{" "}
                {totalRecords} total records)
            </Text>

            <TouchableOpacity
                style={[
                    styles.pageButton,
                    currentPage === totalPages && styles.pageButtonDisabled,
                ]}
                onPress={() =>
                    onPageChange(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}>
                <Icon
                    name="chevron-right"
                    size={20}
                    color={
                        currentPage === totalPages
                            ? colors.textSecondary
                            : colors.primary
                    }
                />
            </TouchableOpacity>
        </View>
    );
};

const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        paginationContainer: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: responsiveHeight(2),
            gap: responsiveWidth(2),
        },
        pageButton: {
            padding: responsiveWidth(2),
            borderRadius: responsiveWidth(8),
            backgroundColor: colors.secondary + "80",
        },
        pageButtonDisabled: {
            opacity: 0.5,
        },
        pageInfo: {
            ...typography.caption,
            color: colors.textSecondary,
        },
    });

export default PaginationControls;
