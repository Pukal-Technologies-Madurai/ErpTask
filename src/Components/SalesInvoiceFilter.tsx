import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import axios from "axios";

const baseURL = "http://192.168.3.125:9001/"; 

interface FilterOption {
  value: string;
  label: string;
}

interface Filter {
  filterType: string;
  tableId: number;
  columnName: string;
  tableName: string;
  valueColumn: string;
  options: FilterOption[];
}

interface Props {
  onFilterChange?: (selected: Record<string, string>) => void;
}

const SalesInvoiceFilter: React.FC<Props> = ({ onFilterChange }) => {
  const [filters, setFilters] = useState<Filter[]>([]);
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>(
    {}
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        setLoading(true);
        const res = await axios.get(
          `${baseURL}api/sales/salesFilterDropdown?reportName=Sales Invoice`
        );
        if (res.data.success && Array.isArray(res.data.data)) {
          setFilters(res.data.data);
        }
      } catch (error) {
        console.error("❌ Error fetching filter data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchFilters();
  }, []);

  const handleSelect = (columnName: string, value: string) => {
    const updated = { ...selectedValues, [columnName]: value };
    setSelectedValues(updated);
    onFilterChange && onFilterChange(updated);
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="small" color="#007bff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {filters.map((filter) => (
        <View key={filter.columnName} style={styles.filterSection}>
          <Text style={styles.filterTitle}>{filter.columnName}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {filter.options.map((opt) => {
              const isSelected = selectedValues[filter.columnName] === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionButton,
                    isSelected && styles.optionButtonActive,
                  ]}
                  onPress={() => {
                    
                    handleSelect(filter.columnName, opt.value)}
                }
                >
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.optionTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {opt.label || "(empty)"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ))}
    </View>
  );
};

export default SalesInvoiceFilter;

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
  },
  filterSection: {
    marginBottom: 15,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
  },
  optionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ccc",
    marginRight: 8,
    backgroundColor: "#fff",
  },
  optionButtonActive: {
    backgroundColor: "#007bff20",
    borderColor: "#007bff",
  },
  optionText: {
    fontSize: 13,
    color: "#333",
  },
  optionTextActive: {
    color: "#007bff",
    fontWeight: "bold",
  },
  loaderContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
});
