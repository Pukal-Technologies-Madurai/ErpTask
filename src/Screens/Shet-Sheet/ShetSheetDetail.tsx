import React, { useState, useEffect, useRef } from "react";
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    Image,
    Alert,
    ActivityIndicator,
    Modal,
    Platform,
    Linking,
} from "react-native";
import RNShare from "react-native-share";
import ReactNativeBlobUtil from "react-native-blob-util";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { MMKV } from "react-native-mmkv";
import { RootStackParamList } from "../../Navigation/types";
import { useTheme } from "../../Context/ThemeContext";
import AppHeader from "../../Components/AppHeader";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import dayjs from "dayjs";
import ImageResizer from "@bam.tech/react-native-image-resizer";
import { useCameraPermission } from "react-native-vision-camera";
import OpenCamera from "../../Components/OpenCamera";
import { API } from "../../constants/api";

type DetailRouteProp = RouteProp<RootStackParamList, "ShetSheetDetail">;

const ShetSheetDetail = () => {
    const storage = new MMKV();
    const route = useRoute<DetailRouteProp>();
    const navigation = useNavigation();
    const { item } = route.params;
    const { typography, colors } = useTheme();
    const styles = getStyles(typography, colors);

    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isCameraVisible, setIsCameraVisible] = useState(false);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const { hasPermission, requestPermission } = useCameraPermission();

    useEffect(() => {
        const checkPermission = async () => {
            if (!hasPermission) {
                await requestPermission();
            }
        };
        checkPermission();
    }, [hasPermission]);

    const handleSubmit = async () => {
        if (!capturedImage) {
            Alert.alert(
                "Required",
                "Please capture the LR report image first.",
            );
            return;
        }

        setIsUploading(true);
        try {
            const userId = storage.getString("userId");

            // Determine if it's an update or separate insert
            const isUpdate = item.imageStatus === "uploaded";
            const url = isUpdate
                ? API.putIrReportUpdate()
                : API.postIrReportUpload();

            const formData = new FormData();

            // File attachment
            const fileName = capturedImage.split("/").pop();
            formData.append("LRReport", {
                uri:
                    Platform.OS === "android"
                        ? capturedImage
                        : capturedImage.replace("file://", ""),
                name: fileName || "lr_report.jpg",
                type: "image/jpeg",
            } as any);

            // Common Body parameters
            formData.append("Do_Id", item.Do_Id);
            formData.append("Do_Inv_No", item.Do_Inv_No);
            if (userId) {
                formData.append("Uploaded_By", userId);
            }

            if (isUpdate) {
                // PUT specific parameters
                // Try multiple common ID field names as we need the ID from tbl_LrReport
                const lrReportId =
                    item.Lr_Id || item.Id || item.lr_id || item.LR_Id;
                if (lrReportId) {
                    formData.append("Id", lrReportId);
                }
            } else {
                // POST specific parameters
                // formData.append(
                //     "involvedStaffs",
                //     JSON.stringify(item.involvedStaffs || []),
                // );
                // formData.append(
                //     "staffInvolvedStatus",
                //     item.staffInvolvedStatus?.toString() || "0",
                // );
            }

            // console.log("Form Data Debug:", {
            //     URL: url,
            //     Method: isUpdate ? "PUT" : "POST",
            //     Do_Id: item.Do_Id,
            //     LR_Report_Id: item.Lr_Id || item.Id || item.lr_id || item.LR_Id,
            //     Uploaded_By: userId,
            //     FileKey: "LRReport",
            //     fileName: fileName,
            // });

            const response = await fetch(url, {
                method: isUpdate ? "PUT" : "POST",
                body: formData,
                headers: {
                    accept: "application/json",
                },
            });

            const responseText = await response.text();
            let responseData;
            try {
                responseData = JSON.parse(responseText);
            } catch (e) {
                console.error("RAW SERVER RESPONSE:", responseText);
                throw new Error(
                    `Server returned HTML instead of JSON (Status: ${response.status}). Check the console for details.`,
                );
            }

            // console.log("API Response:", responseData);

            if (response.ok && responseData.success) {
                setIsUploading(false);
                // console.log("Upload Response:", responseData);
                Alert.alert(
                    "Success",
                    responseData.message || "LR Report processed successfully",
                    [
                        {
                            text: "OK",
                            onPress: () => navigation.replace("MainDrawer"),
                        },
                    ],
                );
            } else {
                throw new Error(
                    responseData.message || "Failed to process request",
                );
            }
        } catch (err: any) {
            setIsUploading(false);
            console.error("Submission Error:", err);
            Alert.alert(
                "Error",
                err.message || "Failed to process image. Please try again.",
            );
        }
    };

    const isUploaded = item.imageStatus === "uploaded";

    const getImageUrl = (url: string) => {
        if (!url || url.includes("imageNotFound")) return null;
        if (url.startsWith("http")) return url;
        if (url.includes("uploads")) {
            const parts = url.split("uploads");
            return `https://erpsmt.in/uploads${parts[1].replace(/\\/g, "/")}`;
        }
        return url;
    };

    const displayUri = capturedImage || getImageUrl(item.Imageurl);

    const handleWhatsAppShare = async () => {
        if (!displayUri) {
            Alert.alert("No Image", "Please capture or upload an image first.");
            return;
        }

        try {
            let shareUri = displayUri;

            // If it's a remote URL, download it first to share the actual file
            if (displayUri.startsWith("http")) {
                const res = await ReactNativeBlobUtil.config({
                    fileCache: true,
                    appendExt: "jpg",
                }).fetch("GET", displayUri);

                shareUri = res.path();
            }

            // Ensure Android has file:// prefix
            if (
                Platform.OS === "android" &&
                !shareUri.startsWith("file://") &&
                !shareUri.startsWith("content://")
            ) {
                shareUri = `file://${shareUri}`;
            }

            const shareOptions = {
                url: shareUri,
                type: "image/jpeg",
                social: RNShare.Social.WHATSAPP,
                failOnCancel: false,
            };

            await RNShare.open(shareOptions);
        } catch (error: any) {
            console.error("Sharing Error:", error);

            // If direct WhatsApp fails, fallback to general share sheet
            try {
                await RNShare.open({
                    url: displayUri.startsWith("http")
                        ? displayUri
                        : `file://${displayUri}`,
                    failOnCancel: false,
                });
            } catch (fallbackError) {
                console.error("Fallback Sharing Error:", fallbackError);
            }
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <AppHeader title="Invoice Preview" navigation={navigation} />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header Section */}
                <View style={styles.headerCard}>
                    <View style={styles.badgeRow}>
                        <View
                            style={[
                                styles.statusBadge,
                                {
                                    backgroundColor: isUploaded
                                        ? "#1A237E"
                                        : "#FBC02D",
                                },
                            ]}>
                            <Text style={styles.statusText}>
                                {item.imageStatus.toUpperCase()}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.invNo}>{item.Do_Inv_No}</Text>
                    <View style={styles.dateRow}>
                        <MaterialIcons
                            name="calendar-today"
                            size={16}
                            color={colors.textSecondary}
                        />
                        <Text style={styles.dateText}>
                            {dayjs(item.Do_Date).format("DD MMM YYYY")}
                        </Text>
                    </View>
                </View>

                {/* Retailer Section */}
                <View style={styles.retailerSection}>
                    <View style={styles.retailerHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.retailerTitle}>
                                {item.retailerNameGet.split(",")[0]}
                            </Text>
                            <Text style={styles.retailerSub}>
                                {item.retailerNameGet.split(",")[1] || ""}
                            </Text>
                        </View>
                        <View
                            style={[
                                styles.uploadedTag,
                                {
                                    backgroundColor: isUploaded
                                        ? "#E8F5E9"
                                        : "#FFF9C4",
                                },
                            ]}>
                            <Text
                                style={[
                                    styles.uploadedTagText,
                                    {
                                        color: isUploaded
                                            ? "#2E7D32"
                                            : "#941108",
                                    },
                                ]}>
                                {item.imageStatus.toUpperCase()}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.previewContainer}
                        onPress={() =>
                            (capturedImage || item.Imageurl) &&
                            setIsPreviewVisible(true)
                        }
                        activeOpacity={0.9}>
                        <View style={styles.previewHeader}>
                            <MaterialIcons
                                name="image"
                                size={20}
                                color={colors.primary}
                            />
                            <Text style={styles.previewTitle}>
                                LR Report Copy
                            </Text>
                        </View>
                        <View style={styles.previewBox}>
                            {displayUri ? (
                                <Image
                                    source={{ uri: displayUri }}
                                    style={styles.previewImage}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={styles.emptyPreview}>
                                    <Text style={styles.emptyText}>
                                        {isUploaded
                                            ? "Uploaded"
                                            : "Pending Capture"}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.previewFilename}>
                                <Text style={styles.filenameText}>
                                    {capturedImage
                                        ? "captured.jpg"
                                        : isUploaded
                                        ? "lr_copy.jpg"
                                        : "none"}
                                </Text>
                            </View>
                        </View>
                    </TouchableOpacity>

                    <View style={styles.actionRow}>
                        {!isUploaded || capturedImage ? (
                            <TouchableOpacity
                                style={[styles.viewImageButton, { flex: 1 }]}
                                onPress={() => setIsCameraVisible(true)}>
                                <Text style={styles.viewImageText}>
                                    {capturedImage
                                        ? "RE-CAPTURE IMAGE"
                                        : isUploaded
                                        ? "UPDATE LR COPY"
                                        : "CAPTURE LR COPY"}
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[
                                    styles.viewImageButton,
                                    {
                                        backgroundColor: colors.primary,
                                        flex: 1,
                                    },
                                ]}
                                onPress={() => setIsCameraVisible(true)}>
                                <Text style={styles.viewImageText}>
                                    RE-UPLOAD LR COPY
                                </Text>
                            </TouchableOpacity>
                        )}

                        {(isUploaded || capturedImage) && (
                            <TouchableOpacity
                                style={styles.whatsappBtn}
                                onPress={handleWhatsAppShare}>
                                <FontAwesome
                                    name="whatsapp"
                                    size={24}
                                    color="#FFF"
                                />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Godown & Driver Summary */}
                <View style={styles.infoCard}>
                    <Text style={styles.cardTitle}>Order Summary</Text>
                    <View style={styles.infoGrid}>
                        <View style={styles.infoCol}>
                            <View style={styles.infoBox}>
                                <Text style={styles.infoLabel}>Godown</Text>
                                <Text style={styles.infoValue}>
                                    {item.stockDetails?.[0]?.Godown_Name ||
                                        "Main Location"}
                                </Text>
                            </View>
                            <View style={styles.iconInfoRow}>
                                <MaterialIcons
                                    name="business"
                                    size={16}
                                    color={colors.textSecondary}
                                />
                                <Text style={styles.iconInfoText}>
                                    {item.branchNameGet}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.infoCol}>
                            <View style={styles.infoBox}>
                                <Text style={styles.infoLabel}>Driver</Text>
                                <Text style={styles.infoValue}>
                                    {item.involvedStaffs?.find(
                                        (s: any) =>
                                            s.Involved_Emp_Type === "Load Man",
                                    )?.Emp_Name || "Not Assigned"}
                                </Text>
                            </View>
                            <View style={styles.iconInfoRow}>
                                <MaterialIcons
                                    name="account-circle"
                                    size={16}
                                    color={colors.textSecondary}
                                />
                                <Text style={styles.iconInfoText}>
                                    {isUploaded
                                        ? `By ${
                                              item.LR_Uploaded_By_Name ||
                                              "Admin"
                                          }`
                                        : `By ${
                                              item.Created_BY_Name || "System"
                                          }`}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Items Table */}
                <View style={styles.infoCard}>
                    <Text style={styles.cardTitle}>Order Summary Details</Text>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.th, { width: 40 }]}>S. No</Text>
                        <Text style={[styles.th, { flex: 1 }]}>Item</Text>
                        <Text
                            style={[
                                styles.th,
                                { width: 50, textAlign: "center" },
                            ]}>
                            Qty
                        </Text>
                        <Text
                            style={[
                                styles.th,
                                { width: 90, textAlign: "right" },
                            ]}>
                            Amount
                        </Text>
                    </View>

                    {item.stockDetails.map((stock: any, index: number) => (
                        <View key={index} style={styles.tableRow}>
                            <Text
                                style={[
                                    styles.td,
                                    { width: 40, textAlign: "center" },
                                ]}>
                                {stock.S_No}
                            </Text>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.tdItem}>
                                    {stock.Product_Name}
                                </Text>
                                <Text style={styles.tdSub}>
                                    UOM: {stock.UOM}
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.td,
                                    { width: 50, textAlign: "center" },
                                ]}>
                                {stock.Bill_Qty}
                            </Text>
                            <Text style={[styles.tdAmount, { width: 90 }]}>
                                ₹
                                {(
                                    stock.Bill_Qty * stock.itemRate
                                ).toLocaleString()}
                            </Text>
                        </View>
                    ))}

                    {/* Totals Breakdown */}
                    <View style={styles.breakdown}>
                        <View style={styles.grandTotalContainer}>
                            <Text style={styles.grandTotalLabel}>
                                Grand Total
                            </Text>
                            <Text style={styles.grandTotalValue}>
                                ₹{item.Total_Invoice_value.toLocaleString()}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Actions */}
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => navigation.goBack()}>
                        <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>

                    {!isUploaded || capturedImage ? (
                        <TouchableOpacity
                            style={[
                                styles.submitButton,
                                (isUploading || !capturedImage) &&
                                    styles.disabledButton,
                            ]}
                            onPress={handleSubmit}
                            disabled={isUploading || !capturedImage}>
                            {isUploading ? (
                                <ActivityIndicator color="#2E7D32" />
                            ) : (
                                <>
                                    <MaterialIcons
                                        name={
                                            isUploaded
                                                ? "system-update"
                                                : "check-circle"
                                        }
                                        size={18}
                                        color="#2E7D32"
                                    />
                                    <Text
                                        style={[
                                            styles.submitButtonText,
                                            { color: "#2E7D32" },
                                        ]}>
                                        {isUploaded ? "Update" : "Submit"}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <View style={[styles.submitButton, { opacity: 1 }]}>
                            <MaterialIcons
                                name="done-all"
                                size={20}
                                color="#2E7D32"
                            />
                            <Text
                                style={[
                                    styles.submitButtonText,
                                    { color: "#2E7D32" },
                                ]}>
                                COMPLETED
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Camera Modal */}
            <Modal
                visible={isCameraVisible}
                animationType="fade"
                onRequestClose={() => setIsCameraVisible(false)}>
                <OpenCamera
                    onPhotoCapture={(path: string) => setCapturedImage(path)}
                    onClose={() => setIsCameraVisible(false)}
                />
            </Modal>

            {/* Image Preview Modal */}
            <Modal
                visible={isPreviewVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsPreviewVisible(false)}>
                <View style={styles.fullPreviewOverlay}>
                    <TouchableOpacity
                        style={styles.fullPreviewClose}
                        onPress={() => setIsPreviewVisible(false)}>
                        <MaterialIcons name="close" size={30} color="#FFF" />
                    </TouchableOpacity>
                    {displayUri && (
                        <Image
                            source={{ uri: displayUri }}
                            style={styles.fullPreviewImage}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
};

export default ShetSheetDetail;

const getStyles = (typography: any, colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.primary,
        },
        scrollContent: {
            padding: 16,
            backgroundColor: colors.background,
        },
        headerCard: {
            backgroundColor: colors.white,
            padding: 20,
            borderRadius: 16,
            marginBottom: 16,
        },
        badgeRow: {
            marginBottom: 8,
        },
        statusBadge: {
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 6,
            alignSelf: "flex-start",
        },
        statusText: {
            color: "#FFF",
            fontSize: 10,
            fontWeight: "bold",
        },
        invNo: {
            fontSize: 24,
            fontWeight: "bold",
            color: "#1A237E",
            marginBottom: 8,
        },
        dateRow: {
            flexDirection: "row",
            alignItems: "center",
        },
        dateText: {
            fontSize: 14,
            color: colors.textSecondary,
            marginLeft: 8,
        },
        retailerSection: {
            backgroundColor: colors.white,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
        },
        retailerHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 16,
        },
        retailerTitle: {
            fontSize: 18,
            fontWeight: "bold",
            color: colors.text,
        },
        retailerSub: {
            fontSize: 14,
            color: colors.textSecondary,
        },
        uploadedTag: {
            backgroundColor: "#E8F5E9",
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 6,
            alignSelf: "flex-start",
        },
        uploadedTagText: {
            color: "#2E7D32",
            fontSize: 10,
            fontWeight: "bold",
        },
        uploadBox: {
            flexDirection: "row",
            backgroundColor: "#F8FAFF",
            borderRadius: 12,
            padding: 12,
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
        },
        uploadInfo: {
            flexDirection: "row",
            alignItems: "center",
        },
        uploadLabel: {
            fontSize: 14,
            fontWeight: "600",
            color: colors.textSecondary,
            marginLeft: 10,
        },
        previewContainer: {
            alignItems: "center",
        },
        previewHeader: {
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
        },
        previewTitle: {
            fontSize: 16,
            fontWeight: "600",
            color: colors.text,
            marginLeft: 6,
        },
        previewBox: {
            width: 120,
            height: 120,
            borderRadius: 12,
            backgroundColor: "#F5F7FA",
            justifyContent: "center",
            alignItems: "center",
        },
        previewFilename: {
            marginTop: 6,
        },
        filenameText: {
            fontSize: 12,
            color: colors.textSecondary,
        },
        previewImage: {
            width: 80,
            height: 80,
            borderRadius: 8,
        },
        emptyPreview: {
            width: 80,
            height: 80,
            borderRadius: 8,
            backgroundColor: "#EEE",
            justifyContent: "center",
            alignItems: "center",
        },
        emptyText: {
            fontSize: 8,
            color: colors.textSecondary,
        },
        fileName: {
            fontSize: 10,
            color: colors.textSecondary,
            marginTop: 4,
        },
        viewImageButton: {
            backgroundColor: "#3F51B5",
            paddingVertical: 10,
            borderRadius: 8,
            alignItems: "center",
        },
        viewImageText: {
            color: colors.white,
            fontSize: 14,
            fontWeight: "700",
            letterSpacing: 0.5,
        },
        actionRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 8,
            gap: 12,
            paddingBottom: 24,
        },
        whatsappBtn: {
            width: 56,
            height: 50,
            backgroundColor: "#25D366",
            borderRadius: 12,
            justifyContent: "center",
            alignItems: "center",
            elevation: 2,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.2,
            shadowRadius: 2,
        },
        infoCard: {
            backgroundColor: colors.white,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
        },
        cardTitle: {
            fontSize: 16,
            fontWeight: "bold",
            color: colors.text,
            marginBottom: 16,
        },
        infoGrid: {
            flexDirection: "row",
        },
        infoCol: {
            flex: 1,
        },
        infoBox: {
            backgroundColor: "#F5F7FA",
            padding: 12,
            borderRadius: 8,
            marginHorizontal: 4,
            marginBottom: 8,
        },
        infoLabel: {
            fontSize: 12,
            color: colors.textSecondary,
            marginBottom: 4,
        },
        infoValue: {
            fontSize: 14,
            fontWeight: "bold",
            color: colors.text,
        },
        iconInfoRow: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 8,
        },
        iconInfoText: {
            fontSize: 11,
            color: colors.textSecondary,
            marginLeft: 4,
            flex: 1,
        },
        tableHeader: {
            flexDirection: "row",
            backgroundColor: "#EBEEFF",
            paddingVertical: 10,
            paddingHorizontal: 8,
            borderRadius: 8,
            marginBottom: 8,
        },
        th: {
            fontSize: 12,
            fontWeight: "bold",
            color: "#1A237E",
        },
        tableRow: {
            flexDirection: "row",
            paddingVertical: 12,
            paddingHorizontal: 8,
            borderBottomWidth: 0.5,
            borderBottomColor: "#EEE",
        },
        td: {
            fontSize: 13,
            color: colors.text,
        },
        tdItem: {
            fontSize: 13,
            fontWeight: "bold",
            color: colors.text,
        },
        tdSub: {
            fontSize: 11,
            color: colors.textSecondary,
        },
        tdAmount: {
            fontSize: 14,
            fontWeight: "bold",
            color: colors.text,
            textAlign: "right",
        },
        breakdown: {
            paddingHorizontal: 8,
        },
        grandTotalContainer: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#EBEEFF",
            padding: 12,
            borderRadius: 8,
            marginTop: 16,
        },
        grandTotalLabel: {
            fontSize: 16,
            fontWeight: "bold",
            color: "#1A237E",
        },
        grandTotalValue: {
            fontSize: 20,
            fontWeight: "bold",
            color: "#1A237E",
        },
        closeButton: {
            flex: 1,
            backgroundColor: "#3F51B5",
            paddingVertical: 16,
            borderRadius: 12,
            alignItems: "center",
            marginRight: 8,
        },
        closeButtonText: {
            color: "#FFF",
            fontSize: 16,
            fontWeight: "bold",
        },
        submitButton: {
            flex: 1,
            flexDirection: "row",
            backgroundColor: "#E8F5E9",
            paddingVertical: 16,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            marginLeft: 8,
            borderWidth: 1,
            borderColor: "#C8E6C9",
        },
        submitButtonText: {
            fontSize: 16,
            fontWeight: "bold",
            marginLeft: 8,
        },
        disabledButton: {
            opacity: 0.6,
        },
        fullPreviewOverlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.9)",
            justifyContent: "center",
            alignItems: "center",
        },
        fullPreviewClose: {
            position: "absolute",
            top: 50,
            right: 20,
            zIndex: 10,
            padding: 10,
            backgroundColor: "rgba(0,0,0,0.5)",
            borderRadius: 25,
        },
        fullPreviewImage: {
            width: "100%",
            height: "80%",
        },
    });
