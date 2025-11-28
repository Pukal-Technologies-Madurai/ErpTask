import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  Pressable,
  Modal,
} from "react-native";
import React from "react";
import { MMKV } from "react-native-mmkv";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import AppHeader from "../../Components/AppHeader";
import DatePickerButton from "../../Components/DatePickerButton";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useTheme } from "../../Context/ThemeContext";
import { RootStackParamList } from "../../Navigation/types";
import { itemStockInfo, itemWiseStock } from "../../Api/OpeningStock";
import { fetchReceiptList } from "../../Api/receipt";
import { responsiveHeight, responsiveWidth } from "../../constants/helper";
import { salesInvoice, salesOrderInvoice, salesOrderPendingList } from "../../Api/Sales";
import { getpurchaseInvoiceEntry, getPurchaseOrderEntry, getPurchaseReport } from "../../Api/Purchase";
import { API } from "../../constants/api";
import { fetchPaymentList } from "../../Api/payment";
import { DeliveryPendingList } from "../../Api/Sales";

type Branch = {
  id: number;
  BranchName: string;
  HasAccess?: number;
  Created_by?: number;
  Created_at?: string;
};

const storage = new MMKV();

const BranchItem = React.memo(function BranchItem({
  branch,
  onPress,
  isSelected,
  colors,
  styles,
}: {
  branch: Branch;
  onPress: (b: Branch) => void;
  isSelected: boolean;
  colors: any;
  styles: any;
}) {
  return (
    <TouchableOpacity
      key={branch.id}
      style={styles.branchItem}
      activeOpacity={0.8}
      onPress={() => onPress(branch)}
    >
      <View style={styles.checkboxContainer}>
        <Icon
          name={isSelected ? "check-box" : "check-box-outline-blank"}
          size={24}
          color={colors.primary}
        />
        <Text style={styles.branchName}>{branch.BranchName}</Text>
      </View>
    </TouchableOpacity>
  );
});

const Home = () => {
  const { colors, typography } = useTheme();
  const styles = getStyles(typography, colors);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();

  // --- Read initial storage synchronously to avoid race with queries ---
  const initialCompanyId = storage.getString("companyId") ?? "";
  const initialUserId = storage.getString("userId") ?? "";
  const initialUserTypeId = storage.getString("userTypeId") ?? "";
  const ADMIN_USER_TYPES = ["0", "1", "2"];
  const isAdmin = ADMIN_USER_TYPES.includes(initialUserTypeId);

  const initialBranchId = storage.getString("branchId") ?? "";

  const [companyId, setCompanyId] = React.useState(initialCompanyId);
  const [userId, setUserId] = React.useState(initialUserId);
  const [branchId, setBranchId] = React.useState<string | number>(initialBranchId);
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
  const [toDate, setToDate] = React.useState<Date>(new Date());
  const [refreshing, setRefreshing] = React.useState(false);
  const [getBranch, setGetBranch] = React.useState<Branch[]>([]);
  const [selectedBranches, setSelectedBranches] = React.useState<Branch[]>([]);
  const [branchModalVisible, setBranchModalVisible] = React.useState(false);

  // Additional state to prevent overlapping loads
  const [branchLoading, setBranchLoading] = React.useState(false);

  // Helper: convert qty + unit => tons
  const qtyToTons = React.useCallback((qty: number, unit?: string) => {
    const u = (unit || "").toLowerCase();
    if (u.includes("kg") || u.includes("kilogram")) return qty / 1000;
    if (u.includes("ton") || u.includes("tonne")) return qty;
    if (u.includes("g") && !u.includes("kg")) return qty / 1000000;
    return qty / 1000;
  }, []);

  // --- Branch fetch on mount (unchanged, but cancellable) ---
  React.useEffect(() => {
    const controller = new AbortController();

    const fetchBranches = async () => {
      const uId = storage.getString("userId");
      if (!uId) return;

      const url = API.getUserBranch(parseInt(uId, 10));
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error("Network response not ok");
        const json = await res.json();

        if (json.success && Array.isArray(json.data)) {
          const accessibleBranches: Branch[] = json.data.filter(
            (branch: Branch) => branch.HasAccess === 1
          );
          setGetBranch(accessibleBranches);
        } else {
          setGetBranch([]);
        }
      } catch (error: any) {
        if (error.name === "AbortError") {
          // ignore
        } else {
          console.error("Error fetching branches:", error);
          setGetBranch([]);
        }
      }
    };

    fetchBranches();

    return () => controller.abort();
  }, []);

  const {
    data: saleOrderData = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["saleOrder", selectedDate, toDate, userId, branchId],
    queryFn: () => salesOrderInvoice(selectedDate, toDate, userId, branchId),
    enabled: !!selectedDate && !!toDate && !!userId && !!branchId,
  });

  const { data: invoiceData = [],
    refetch: refetchSalesinvoice
   } = useQuery({
    queryKey: ["invoiceData", selectedDate, toDate, userId, branchId],
    queryFn: () => salesInvoice(selectedDate, toDate, userId, branchId),
    enabled: !!selectedDate && !!toDate && !!userId && !!branchId,
  });

  const { data: purchaseData = [], refetch: refetchPurchase } = useQuery({
    queryKey: ["purchaseData", selectedDate, toDate],
    queryFn: () => getPurchaseReport(selectedDate, toDate, companyId),
    enabled: !!selectedDate && !!toDate,
  });

  const {
    data: purchaseOrderEntryData = [],
    refetch: refetchPurchaseOrderEntry,
  } = useQuery({
    queryKey: ["purchaseOrderEntryData", selectedDate, toDate, userId, branchId],
   queryFn: () => salesOrderInvoice(selectedDate, toDate, userId, Number(branchId)),
    enabled: !!selectedDate && !!toDate && !!userId && !!branchId,
  });

  const {
    data: purchaseInvoiceEntryData = [],
    refetch: refetchPurchaseInvoiceEntry,
  } = useQuery({
    queryKey: ["purchaseInvoiceEntryData", selectedDate, toDate, userId, branchId],
    queryFn: () => getpurchaseInvoiceEntry(selectedDate, toDate, userId, branchId),
    enabled: !!selectedDate && !!toDate && !!userId && !!branchId,
  });

  const { data: itemStockValue = [], refetch: refetchItemStockValue } =
    useQuery({
      queryKey: ["itemStackValue", selectedDate],
      queryFn: () => itemStockInfo(selectedDate),
      enabled: !!selectedDate,
    });

  const { data: receiptList = [], refetch: refetchReceiptList } = useQuery({
    queryKey: ["receiptList", selectedDate, toDate, userId, branchId],
    queryFn: () => fetchReceiptList(selectedDate, toDate, userId, branchId),
    enabled: !!selectedDate && !!toDate && !!userId && !!branchId,
  });

  const { data: paymentList = [], refetch: refetchPaymentList } = useQuery({
    queryKey: ["paymentList", selectedDate, toDate, userId, branchId],
    queryFn: () => fetchPaymentList(selectedDate, toDate, userId, branchId),
    enabled: !!selectedDate && !!toDate && !!userId && !!branchId,
  });

  const {
    data: DeliveryPendingData = [],
    refetch: refetchDeliveryPendingList,
  } = useQuery({
    queryKey: ["deliveryPendingList", selectedDate, toDate, userId, branchId],
    queryFn: () => DeliveryPendingList(selectedDate, toDate, userId, branchId),
    enabled: !!selectedDate && !!toDate && !!userId && !!branchId,
  });

  const {
    data: SaleorderPendingData = [],
    refetch: refetchsalesOrderPendingList,
  } = useQuery({
    queryKey: ["salesorderPendingList", selectedDate, toDate, userId, branchId],
    queryFn: ()=> salesOrderPendingList(selectedDate, toDate, userId, branchId),
    enabled: !!selectedDate && !!toDate && !!userId && !! branchId,
  });

  const { data: itemWiseStockData = [], refetch: refetchItemWise } = useQuery(
    {
      queryKey: ["itemWiseStock", selectedDate, toDate],
      queryFn: () => itemWiseStock(selectedDate, toDate),
      enabled: !!selectedDate && !!toDate,
    },
  );

  const totalSales = React.useMemo(() => {
    return (saleOrderData || []).reduce(
      (acc: number, item: { Total_Invoice_value?: number }) =>
        acc + (item.Total_Invoice_value || 0),
      0,
    );
  }, [saleOrderData]);

  const totaldelPend = React.useMemo(() => {
    return (DeliveryPendingData || []).reduce(
      (acc: number, item: { Total_Invoice_value?: number }) =>
        acc + (item.Total_Invoice_value || 0),
      0,
    );
  }, [DeliveryPendingData]);

  const totalSalesPend = React.useMemo( () => {
    return (SaleorderPendingData || []).reduce(
      (acc: number, item: { Total_Invoice_value?:number})=>
        acc + (item.Total_Invoice_value || 0),
      0,
    );
  },[SaleorderPendingData]);
  console.log("total:",totalSalesPend);

  const totalReceipt = React.useMemo(() => {
    return (receiptList || []).reduce(
      (acc: number, item: { credit_amount?: number }) =>
        acc + (item.credit_amount || 0),
      0,
    );
  }, [receiptList]);

  const totalPayment = React.useMemo(() => {
    return (paymentList || []).reduce(
      (acc: number, item: { credit_amount?: number }) =>
        acc + (item.credit_amount || 0),
      0,
    );
  }, [paymentList]);

  const totalInvoices = React.useMemo(() => {
    return (invoiceData || []).reduce(
      (acc: number, item: { Total_Invoice_value?: number }) =>
        acc + (item.Total_Invoice_value || 0),
      0,
    );
  }, [invoiceData]);

  const totalPurchaseInvoice = React.useMemo(() => {
    return (purchaseInvoiceEntryData || []).reduce(
      (acc: number, item: { Total_Invoice_value?: number }) =>
        acc + (item.Total_Invoice_value || 0),
      0,
    );
  }, [purchaseInvoiceEntryData]);

  const totalPurchase = React.useMemo(() => {
    return (purchaseData || []).reduce((acc: number, stockGroup: any) => {
      if (!stockGroup.product_details || !Array.isArray(stockGroup.product_details)) {
        return acc;
      }
      const productDetailsTotal = stockGroup.product_details.reduce(
        (productAcc: number, product: any) => {
          if (!product.product_details_1 || !Array.isArray(product.product_details_1)) {
            return productAcc;
          }
          const productDetail1Total = product.product_details_1.reduce(
            (detailAcc: number, detail: any) => {
              return detailAcc + (detail.amount || 0);
            },
            0,
          );

          return productAcc + productDetail1Total;
        },
        0,
      );
      return acc + productDetailsTotal;
    }, 0);
  }, [purchaseData]);

  const totalStockValue = React.useMemo(() => {
    return (itemStockValue || []).reduce(
      (acc: number, item: { CL_Value?: number }) => acc + (item.CL_Value || 0),
      0,
    );
  }, [itemStockValue]);

  const totalItemWise = React.useMemo(() => {
    return (itemWiseStockData || []).reduce(
      (acc: number, item: { Product_Rate?: number }) =>
        acc + (item.Product_Rate || 0),
      0,
    );
  }, [itemWiseStockData]);

  const totalSalesTonnage = React.useMemo(() => {
    return (saleOrderData || []).reduce((acc: number, item: any) => {
      if (!item.Products_List || !Array.isArray(item.Products_List)) return acc;
      const productsTotal = item.Products_List.reduce((productAcc: number, product: any) => {
        const qty = Number(product.Total_Qty || 0);
        const unit = product.Unit_Name || "";
        return productAcc + qtyToTons(qty, unit);
      }, 0);
      return acc + productsTotal;
    }, 0);
  }, [saleOrderData, qtyToTons]);

  const totaldeliveryPendingTonnage = React.useMemo(() => {
    return (DeliveryPendingData || []).reduce((acc: number, item: any) => {
      if (!item.Products_List || !Array.isArray(item.Products_List)) return acc;
      const productsTotal = item.Products_List.reduce((productAcc: number, product: any) => {
        const qty = Number(product.Total_Qty || 0);
        const unit = product.Unit_Name || "";
        return productAcc + qtyToTons(qty, unit);
      }, 0);
      return acc + productsTotal;
    }, 0);
  }, [DeliveryPendingData, qtyToTons]);

  const totalsalesPendingTonnage = React.useMemo(()=> {
    return (SaleorderPendingData || []).reduce((acc: number, item: any) =>{
      if (!item.Products_List || !Array.isArray(item.Products_List)) return acc;
      const productsTotal = item.Products_List.reduce((productAcc: number, product: any) => {
        const qty = Number(product.Total_Qty || 0);
        const unit = product.Unit_Name || "";
        return productAcc + qtyToTons(qty,unit);
      }, 0);
      return acc+ productsTotal;
    }, 0);
  }, [SaleorderPendingData, qtyToTons]);

  const totalInvoicesTonnage = React.useMemo(() => {
    return (invoiceData || []).reduce((acc: number, item: any) => {
      if (!item.Products_List || !Array.isArray(item.Products_List)) return acc;
      const productsTotal = item.Products_List.reduce((productAcc: number, product: any) => {
        const qty = Number(product.Total_Qty || 0);
        const unit = product.Unit_Name || "";
        return productAcc + qtyToTons(qty, unit);
      }, 0);
      return acc + productsTotal;
    }, 0);
  }, [invoiceData, qtyToTons]);

  const totalTonnage = React.useMemo(() => {
    return (purchaseData || []).reduce((acc: number, stockGroup: any) => {
      if (!stockGroup.product_details || !Array.isArray(stockGroup.product_details)) {
        return acc;
      }
      const productDetailsTotal = stockGroup.product_details.reduce((productAcc: number, product: any) => {
        if (!product.product_details_1 || !Array.isArray(product.product_details_1)) {
          return productAcc;
        }
        const productDetail1Total = product.product_details_1.reduce((detailAcc: number, detail: any) => {
          const quantityInKg = detail.bill_qty || 0;
          const quantityInTons = quantityInKg / 1000;
          return detailAcc + quantityInTons;
        }, 0);
        return productAcc + productDetail1Total;
      }, 0);

      return acc + productDetailsTotal;
    }, 0);
  }, [purchaseData]);

  const totalPurchaseOrderEntry = React.useMemo(() => {
    return (purchaseOrderEntryData || []).reduce((acc: number, current: any) => {
      if (!current.ItemDetails || !Array.isArray(current.ItemDetails)) return acc;
      const itemsSum = current.ItemDetails.reduce((itemAcc: number, item: any) => {
        return itemAcc + ((item.Weight || 0) * (item.Rate || 0));
      }, 0);
      return acc + itemsSum;
    }, 0);
  }, [purchaseOrderEntryData]);

  const totalPurchaseOrderEntryTonnage = React.useMemo(() => {
    return (purchaseOrderEntryData || []).reduce((acc: number, current: any) => {
      if (!current.ItemDetails || !Array.isArray(current.ItemDetails)) return acc;
      const itemsTotal = current.ItemDetails.reduce((itemAcc: number, item: any) => {
        const weightInKg = item.Weight || 0;
        const weightInTons = weightInKg / 1000;
        return itemAcc + weightInTons;
      }, 0);
      return acc + itemsTotal;
    }, 0);
  }, [purchaseOrderEntryData]);

  const totalPurchaseInvoiceEntryTonnage = React.useMemo(() => {
    return (purchaseInvoiceEntryData || []).reduce((acc: number, item: any) => {
      if (!item.ItemDetails || !Array.isArray(item.ItemDetails)) return acc;
      const itemsTotal = item.ItemDetails.reduce((itemAcc: number, product: any) => {
        const qty = Number(product.Total_Qty || 0);
        const unit = product.Unit_Name || "";
        return itemAcc + qtyToTons(qty, unit);
      }, 0);
      return acc + itemsTotal;
    }, 0);
  }, [purchaseInvoiceEntryData, qtyToTons]);

  const totalStockTonnage = React.useMemo(() => {
    return (itemStockValue || []).reduce((acc: number, item: { Bal_Qty?: number }) => {
      const balQtyInKg = Number(item.Bal_Qty || 0);
      return acc + qtyToTons(balQtyInKg, "kg");
    }, 0);
  }, [itemStockValue, qtyToTons]);

  const totalItemWiseTonnage = React.useMemo(() => {
  return (itemWiseStockData || []).reduce((acc: number, item: { Bal_Qty?: number }) => {
    const balQtyInKg = Number(item.Bal_Qty || 0);
    return acc + qtyToTons(balQtyInKg, "kg");
  }, 0); 
}, [itemWiseStockData, qtyToTons]);

  const formatNumber = React.useCallback((num: number) => {
    if (num >= 10000000) return `${(num / 10000000).toFixed(1)}Cr`;
    if (num >= 100000) return `${(num / 100000).toFixed(1)}L`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  }, []);

  const formatTonnage = React.useCallback((tons: number) => {
    if (tons >= 1000) return `${(tons / 1000).toFixed(1)}K`;
    return tons.toFixed(1);
  }, []);

  const toggleBranchSelection = React.useCallback((branch: Branch) => {
    setSelectedBranches(prev => {
      const exists = prev.some(b => b.id === branch.id);
      if (exists) {
        return prev.filter(b => b.id !== branch.id);
      } else {
        return [...prev, branch];
      }
    });
  }, []);

 const applySelectedBranchesAndLoad = React.useCallback(async () => {
  setBranchModalVisible(false);
  let newBranchId = "";

  if (selectedBranches.length === 0 || selectedBranches.length === getBranch.length) {
    newBranchId = "";
  } else {
    newBranchId = selectedBranches.map(b => b.id).join(",");
  }

  setBranchId(newBranchId);

  if (newBranchId) {
    storage.set("branchId", newBranchId);
  } else {
    storage.delete("branchId");
  }

  if (branchLoading) return;
  setBranchLoading(true);

  try {
    // Refetch all queries
    const promises: Promise<any>[] = [];
    if (typeof refetch === "function") promises.push(refetch());
    if (typeof refetchSalesinvoice === "function") promises.push(refetchSalesinvoice());
    if (typeof refetchPurchase === "function") promises.push(refetchPurchase());
    if (typeof refetchPurchaseOrderEntry === "function") promises.push(refetchPurchaseOrderEntry());
    if (typeof refetchPurchaseInvoiceEntry === "function") promises.push(refetchPurchaseInvoiceEntry());
    if (typeof refetchItemStockValue === "function") promises.push(refetchItemStockValue());
    if (typeof refetchItemWise === "function") promises.push(refetchItemWise());
    if (typeof refetchReceiptList === "function") promises.push(refetchReceiptList());
    if (typeof refetchPaymentList === "function") promises.push(refetchPaymentList());
    if (typeof refetchDeliveryPendingList === "function") promises.push(refetchDeliveryPendingList());
    if (typeof refetchsalesOrderPendingList === "function") promises.push(refetchsalesOrderPendingList());

    await Promise.all(promises);
  } finally {
    setBranchLoading(false);
  }
}, [
  selectedBranches,
  branchLoading,
  getBranch,
  refetch,
  refetchSalesinvoice,
  refetchPurchase,
  refetchPurchaseOrderEntry,
  refetchPurchaseInvoiceEntry,
  refetchItemStockValue,
  refetchItemWise,
  refetchReceiptList,
  refetchPaymentList,
  refetchDeliveryPendingList,
  refetchsalesOrderPendingList,
]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const p: Promise<any>[] = [];
      if (typeof refetch === "function") p.push(refetch());
      if (typeof refetchSalesinvoice === "function") p.push(refetchSalesinvoice());
      if (typeof refetchPurchase === "function") p.push(refetchPurchase());
      if (typeof refetchPurchaseOrderEntry === "function") p.push(refetchPurchaseOrderEntry());
      if (typeof refetchPurchaseInvoiceEntry === "function") p.push(refetchPurchaseInvoiceEntry());
      if (typeof refetchItemStockValue === "function") p.push(refetchItemStockValue());
      if (typeof refetchItemWise === "function") p.push(refetchItemWise());
      if (typeof refetchReceiptList === "function") p.push(refetchReceiptList());
      if (typeof refetchPaymentList === "function") p.push(refetchPaymentList());
      if (typeof refetchDeliveryPendingList === "function") p.push(refetchDeliveryPendingList());
      if (typeof refetchsalesOrderPendingList === "function") p.push(refetchsalesOrderPendingList());
      await Promise.all(p);
    } finally {
      setRefreshing(false);
    }
  }, [
    refetch,
    refetchSalesinvoice,
    refetchPurchase,
    refetchPurchaseOrderEntry,
    refetchPurchaseInvoiceEntry,
    refetchItemStockValue,
    refetchItemWise,
    refetchReceiptList,
    refetchPaymentList,
    refetchDeliveryPendingList,
    refetchsalesOrderPendingList,
  ]);

  
  return (
    <SafeAreaView style={[styles.container]} edges={["top"]}>
      <AppHeader
        navigation={navigation}
        showDrawer={true}
        name={storage.getString("name")}
        subtitle={storage.getString("companyName")}
        showRightIcon={isAdmin}
        rightIconLibrary="MaterialIcon"
        rightIconName="compare-arrows"
        onRightPress={() => navigation.navigate("CompanySwitch")}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, backgroundColor: colors.background }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Date Picker Section */}
        <View style={styles.datePickerContainer}>
          <View style={styles.datePickerRow}>
            <View style={styles.dateWrapper}>
              <DatePickerButton
                title="From Date"
                date={selectedDate}
                style={styles.datePicker}
                containerStyle={styles.datePickerContainerStyle}
                titleStyle={styles.datePickerTitle}
                onDateChange={(date: Date) => setSelectedDate(date)}
              />
            </View>

            <View style={styles.dateWrapper}>
              <DatePickerButton
                title="To Date"
                date={toDate}
                style={styles.datePicker}
                containerStyle={styles.datePickerContainerStyle}
                titleStyle={styles.datePickerTitle}
                onDateChange={(date: Date) => setToDate(date)}
              />
            </View>

            <TouchableOpacity
              style={styles.refreshButtonSmall}
              onPress={onRefresh}
            >
              <Icon name="refresh" size={22} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Branch Selection Section */}
        <View style={styles.branchSection}>
          <Text style={styles.sectionTitle}>Branches</Text>

          {/* Full Width Branch Card */}
          <Pressable onPress={() => setBranchModalVisible(true)}>
            <View style={styles.branchCardFull}>
              <Icon name="store" size={36} color={colors.info} />
              <View style={styles.branchCardTextContainer}>
                <Text style={styles.branchCardTitle}>Branches</Text>
                <Text style={styles.branchCardValue}>
                  {selectedBranches.length > 0
                    ? (selectedBranches as Branch[]).map(b => b.BranchName).join(", ")
                    : "Select Branches"}
                </Text>
              </View>
            </View>
          </Pressable>

          {/* Branch Selection Modal */}
          <Modal
            visible={branchModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setBranchModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <Text style={styles.modalTitle}>Select Branches</Text>

                <ScrollView style={styles.branchList}>
                  {getBranch.map((branch) => {
                    const isSelected = selectedBranches.some(b => b.id === branch.id);
                    return (
                      <BranchItem
                        key={branch.id}
                        branch={branch}
                        onPress={toggleBranchSelection}
                        isSelected={isSelected}
                        colors={colors}
                        styles={styles}
                      />
                    );
                  })}
                </ScrollView>

                {/* Done Button */}
                <TouchableOpacity
                  style={[styles.doneButton, branchLoading && { opacity: 0.6 }]}
                  onPress={applySelectedBranchesAndLoad}
                  disabled={branchLoading}
                >
                  <Text style={styles.doneButtonText}>{branchLoading ? "Loading..." : "Done"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading dashboard data...</Text>
          </View>
        )}

        {/* Summary Section */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Quick Summary</Text>
          <View style={styles.summaryCards}>
            {/* First Row */}
            <View style={styles.summaryRow}>
              <Pressable
                onPress={() =>
                  navigation.navigate("saleOrderInvoice", {
                    branchId: branchId
                  })
                }
              >
                <View style={styles.summaryCard}>
                  <Icon name="shopping-cart" size={32} color={colors.primary} />
                  <Text style={styles.summaryCardTitle}>Sale Orders</Text>
                  <Text style={styles.summaryCardValue}>₹{formatNumber(totalSales)}</Text>
                  <View style={[styles.tonnageContainer, { backgroundColor: colors.primary + "15" }]}>
                    <Icon name="scale" size={16} color={colors.primary} />
                    <Text style={[styles.tonnageText, { color: colors.primary }]}>
                      {formatTonnage(totalSalesTonnage)} Tons
                    </Text>
                  </View>
                </View>
              </Pressable>

              <Pressable
                onPress={() =>
                  navigation.navigate("invoiceSale", {
                    branchId: branchId
                  })
                }
              >
                <View style={styles.summaryCard}>
                  <Icon name="source" size={32} color={colors.accent} />
                  <Text style={styles.summaryCardTitle}>Sale Invoices</Text>
                  <Text style={styles.summaryCardValue}>₹{formatNumber(totalInvoices)}</Text>
                  <View style={[styles.tonnageContainer, { backgroundColor: colors.accent + "15" }]}>
                    <Icon name="scale" size={16} color={colors.accent} />
                    <Text style={[styles.tonnageText, { color: colors.accent }]}>
                      {formatTonnage(totalInvoicesTonnage)} Tons
                    </Text>
                  </View>
                </View>
              </Pressable>
            </View>

            {/* Second Row */}
            <View style={styles.summaryRow}>
              <Pressable
                onPress={() =>
                  navigation.navigate("purchaseOrder", {
                    branchId: branchId
                  })
                }
              >
                <View style={styles.summaryCard}>
                  <Icon name="assignment" size={32} color={colors.info} />
                  <Text style={styles.summaryCardTitle}>Purchase Orders</Text>
                  <Text style={styles.summaryCardValue}>₹{formatNumber(totalPurchaseOrderEntry)}</Text>
                  <View style={[styles.tonnageContainer, { backgroundColor: colors.info + "15" }]}>
                    <Icon name="scale" size={16} color={colors.info} />
                    <Text style={[styles.tonnageText, { color: colors.info }]}>
                      {formatTonnage(totalPurchaseOrderEntryTonnage)} Tons
                    </Text>
                  </View>
                </View>
              </Pressable>

              <Pressable
                onPress={() =>
                  navigation.navigate("purchaseInvoice",
                    { branchId: branchId })
                }
              >
                <View style={styles.summaryCard}>
                  <Icon name="shopping-bag" size={32} color={colors.warning} />
                  <Text style={styles.summaryCardTitle}>Purchase Invoices</Text>
                  <Text style={styles.summaryCardValue}>₹{formatNumber(totalPurchaseInvoice)}</Text>
                  <View style={[styles.tonnageContainer, { backgroundColor: colors.warning + "15" }]}>
                    <Icon name="scale" size={16} color={colors.warning} />
                    <Text style={[styles.tonnageText, { color: colors.warning }]}>
                      {formatTonnage(totalPurchaseInvoiceEntryTonnage)} Tons
                    </Text>
                  </View>
                </View>
              </Pressable>
            </View>

            <View style={styles.summaryRow}>
              <Pressable onPress={() => navigation.navigate("ItemStack")}>
                <View style={styles.summaryCard}>
                  <Icon name="inventory" size={32} color={colors.success} />
                  <Text style={styles.summaryCardTitle}>Item Stock Value</Text>
                  <Text style={styles.summaryCardValue}>₹{formatNumber(totalStockValue)}</Text>
                  <View style={[styles.tonnageContainer, { backgroundColor: colors.success + "15" }]}>
                    <Icon name="scale" size={16} color={colors.success} />
                    <Text style={[styles.tonnageText, { color: colors.success }]}>
                      {formatTonnage(totalStockTonnage)} Tons
                    </Text>
                  </View>
                </View>
              </Pressable>

              <Pressable onPress={() => navigation.navigate("Stock")}>
                <View style={styles.summaryCard}>
                  <Icon name="warehouse" size={32} color={colors.sih} />
                  <Text style={styles.summaryCardTitle}>Stock in Hand</Text>
                  <Text style={styles.summaryCardValue}>₹{formatNumber(totalItemWise)}</Text>
                  <View style={[styles.tonnageContainer, { backgroundColor: colors.sih + "15" }]}>
                    <Icon name="scale" size={16} color={colors.sih} />
                    <Text style={[styles.tonnageText, { color: colors.sih }]}>
                      {formatTonnage(totalItemWiseTonnage)} Tons
                    </Text>
                  </View>
                </View>
              </Pressable>
            </View>

            <View style={styles.summaryRow}>
              <Pressable
                onPress={() =>
                  navigation.navigate("receiptList",
                    { branchId: branchId })
                }
              >
                <View style={styles.summaryCard}>
                  <Icon name="receipt" size={32} color={colors.rec} />
                  <Text style={styles.summaryCardTitle}>Receipt</Text>
                  <Text style={styles.summaryCardValue}>₹{formatNumber(totalReceipt)}</Text>
                  <View style={[styles.tonnageContainer, { backgroundColor: colors.success + "15" }]}>
                    <Icon name="scale" size={16} color={colors.success} />
                  </View>
                </View>
              </Pressable>

              <Pressable onPress={() => navigation.navigate("paymentList", { branchId: branchId })}>
                <View style={styles.summaryCard}>
                  <Icon name="payment" size={32} color={colors.pay} />
                  <Text style={styles.summaryCardTitle}>Payment</Text>
                  <Text style={styles.summaryCardValue}>₹{formatNumber(totalPayment)}</Text>
                  <View style={[styles.tonnageContainer, { backgroundColor: colors.success + "15" }]}>
                    <Icon name="scale" size={16} color={colors.success} />
                  </View>
                </View>
              </Pressable>
            </View>

            <View style={styles.summaryRow}>
              <Pressable onPress={() => navigation.navigate("deliveryPend", { branchId: branchId })}>
                <View style={styles.summaryCard}>
                  <Icon name="delivery-dining" size={32} color={colors.del} />
                  <Text style={styles.summaryCardTitle}>Delivery</Text>
                  <Text style={styles.summaryCardValue}>₹{formatNumber(totaldelPend)}</Text>
                  <View style={[styles.tonnageContainer, { backgroundColor: colors.del + "15" }]}>
                    <Icon name="scale" size={16} color={colors.del} />
                    <Text style={[styles.tonnageText, { color: colors.del }]}>
                      {formatTonnage(totaldeliveryPendingTonnage)} Tons
                    </Text>
                  </View>
                </View>
              </Pressable>

               <Pressable onPress={() => navigation.navigate("saleorderpend", { branchId: branchId })}>
                <View style={styles.summaryCard}>
                  <Icon name="shopping-cart" size={32} color={colors.pen} />
                  <Text style={styles.summaryCardTitle}>Pending Sale Order</Text>
                  <Text style={styles.summaryCardValue}>₹{formatNumber(totalSalesPend)}</Text>
                  <View style={[styles.tonnageContainer, { backgroundColor: colors.pen + "15" }]}>
                    <Icon name="scale" size={16} color={colors.pen} />
                    <Text style={[styles.tonnageText, { color: colors.pen }]}>
                      {formatTonnage(totalsalesPendingTonnage)} Tons
                    </Text>
                  </View>
                </View>
              </Pressable>
            </View>

          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Home;


const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.primary,
        },

        // Date Picker Section
        datePickerContainer: {
            paddingHorizontal: responsiveWidth(4),
            paddingVertical: responsiveWidth(2),
            backgroundColor: colors.white,
            borderRadius: 12,
            marginHorizontal: responsiveWidth(4),
            marginTop: responsiveWidth(4),
            marginBottom: responsiveWidth(2),
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        sectionTitle: {
            ...typography.h6,
            color: colors.text,
            fontWeight: "600",
            marginHorizontal: responsiveWidth(4),
            marginVertical: responsiveWidth(2),
        },
        datePickerRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: responsiveWidth(3),
            justifyContent: "space-between",
        },
        dateInfoContainer: {
            marginTop: responsiveWidth(2),
            alignItems: "center",
        },
        dateInfoText: {
            ...typography.caption,
            color: colors.textSecondary,
            fontStyle: "italic",
        },
        datePickerContainerStyle: {
            flex: 1,
        },
        datePickerTitle: {
            ...typography.body1,
            color: colors.text,
            marginBottom: 8,
        },
        datePicker: {
            backgroundColor: colors.primary + "30",
            padding: responsiveWidth(3),
            borderRadius: 8,
            alignItems: "center",
            flex: 1
        },
        refreshButton: {
            backgroundColor: colors.primary,
            padding: responsiveWidth(3),
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            minWidth: responsiveWidth(12),
            minHeight: responsiveWidth(12),
        },

        // Loading State
        loadingContainer: {
            alignItems: "center",
            justifyContent: "center",
            padding: responsiveHeight(4),
        },
        loadingText: {
            ...typography.body1,
            color: colors.textSecondary,
        },

        // Summary Section
        summarySection: {
            paddingHorizontal: responsiveWidth(2),
            paddingVertical: responsiveWidth(1),
        },
        summaryCards: {
            gap: responsiveWidth(2),
        },
        summaryRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: responsiveWidth(2),
            marginHorizontal: responsiveWidth(2),
            gap: responsiveWidth(3),
            paddingHorizontal: responsiveWidth(1),
        },
        summaryCard: {
            width: (responsiveWidth(100) - responsiveWidth(15)) / 2,
            backgroundColor: colors.white,
            borderRadius: 12,
            paddingHorizontal: responsiveWidth(2),
            paddingVertical: responsiveWidth(2),
            alignItems: "center",
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 8,
            elevation: 6,
            minHeight: responsiveHeight(16),
            justifyContent: "space-between",
        },
        summaryCardTitle: {
            ...typography.body2,
            color: colors.textSecondary,
            textAlign: "center",
            marginTop: responsiveWidth(0.5),
            marginBottom: responsiveWidth(1),
            fontWeight: "600",
            lineHeight: responsiveWidth(3.5),
        },
        summaryCardValue: {
            ...typography.h4,
            color: colors.textDark,
            fontWeight: "800",
            textAlign: "center",
            marginBottom: responsiveWidth(1),
            letterSpacing: 0.25,
        },
        changeContainer: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: responsiveWidth(3),
            gap: responsiveWidth(1.5),
            backgroundColor: colors.surface,
            borderRadius: 20,
            paddingHorizontal: responsiveWidth(3),
            paddingVertical: responsiveWidth(1.5),
            shadowColor: colors.black + "50",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 2,
            elevation: 2,
        },
        changeText: {
            ...typography.body2,
            fontWeight: "700",
        },
        tonnageContainer: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: responsiveWidth(1),
            gap: responsiveWidth(0.5),
            borderRadius: 8,
            paddingHorizontal: responsiveWidth(1.5),
            paddingVertical: responsiveWidth(0.5),
        },
        tonnageText: {
            ...typography.caption,
            fontWeight: "600",
            fontSize: 11,
        },
        branchSection: {
            marginVertical: 12,
            paddingHorizontal: 10,
        },

        branchCardFull: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.cardBackground || "#fff",
            borderRadius: 16,
            padding: 16,
            elevation: 3,
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            width: "100%", // full width
            marginBottom: 10,
        },

        branchCardTextContainer: {
            flex: 1,
            marginLeft: 12,
        },

        branchCardTitle: {
            fontSize: 16,
            color: colors.text,
            fontWeight: "600",
            marginBottom: 4,
        },

        branchCardValue: {
            fontSize: 15,
            color: colors.primary,
            flexWrap: "wrap",
        },

        modalOverlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
        },

        modalContainer: {
            width: "90%",
            maxHeight: "80%",
            backgroundColor: colors.cardBackground || "#fff",
            borderRadius: 16,
            padding: 20,
        },

        modalTitle: {
            fontSize: 18,
            fontWeight: "600",
            marginBottom: 10,
            color: colors.text,
        },

        branchList: {
            marginVertical: 10,
        },

        branchItem: {
            paddingVertical: 10,
            borderBottomWidth: 0.5,
            borderColor: colors.border || "#ddd",
        },

        checkboxContainer: {
            flexDirection: "row",
            alignItems: "center",
        },

        branchName: {
            marginLeft: 10,
            fontSize: 16,
            color: colors.text,
        },

        doneButton: {
            backgroundColor: colors.primary,
            paddingVertical: 12,
            borderRadius: 10,
            alignItems: "center",
            marginTop: 12,
        },

        doneButtonText: {
            color: colors.white,
            fontWeight: "600",
            fontSize: 16,
        },
        dateWrapper: {
            flex: 1,
            marginRight: 8,
        },

        refreshButtonSmall: {
            backgroundColor: colors.primary,
            padding: 10,
            borderRadius: 8,
            justifyContent: "center",
            alignItems: "center",
        },

    });
