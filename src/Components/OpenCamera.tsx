import React, { useState, useRef, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Linking,
    Dimensions,
} from "react-native";
import {
    Camera,
    useCameraDevice,
    useCameraPermission,
} from "react-native-vision-camera";
import { useNavigation } from "@react-navigation/native";
import FeatherIcon from "react-native-vector-icons/Feather";
import {
    customColors,
    spacing,
} from "../constants/helper";
import ImageResizer from "@bam.tech/react-native-image-resizer";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../Context/ThemeContext";

const { width } = Dimensions.get("window");

const OpenCamera = ({ onPhotoCapture, enableCompression = true, onClose }: any) => {
    const navigation = useNavigation();
    const { colors } = useTheme();
    const device = useCameraDevice("back");
    const camera = useRef<Camera>(null);
    const { hasPermission, requestPermission } = useCameraPermission();

    const [photoPath, setPhotoPath] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const compressImage = async (imagePath: string) => {
        try {
            const result = await ImageResizer.createResizedImage(
                imagePath,
                1024, // Max width
                1024, // Max height
                "JPEG",
                80, // Quality (0-100)
                0, // Rotation angle
            );
            return result.uri;
        } catch (error) {
            console.log("Image compression error: ", error);
            return imagePath;
        }
    };

    useEffect(() => {
        checkPermission();
    }, []);

    const checkPermission = async () => {
        try {
            const permission = await requestPermission();
            if (!permission) {
                setError("Camera permission denied");
                Alert.alert(
                    "Camera Access Required",
                    "Please enable camera access in settings to take photos.",
                    [
                        {
                            text: "Open Settings",
                            onPress: () => Linking.openSettings(),
                        },
                        { text: "Cancel", style: "cancel", onPress: () => onClose?.() },
                    ],
                );
            }
        } catch (err) {
            console.error("Camera Permission Error:", err);
            setError("Failed to get camera permission");
        }
    };

    const takePhoto = async () => {
        if (!camera.current) {
            setError("Camera not initialized");
            return;
        }

        setIsCapturing(true);
        setError(null);

        try {
            const photo = await camera.current.takePhoto({
                flash: "off",
                enableShutterSound: true,
            });

            let finalPhotoPath = photo.path;

            // Compress image if enabled
            if (enableCompression) {
                finalPhotoPath = await compressImage(`file://${photo.path}`);
            }

            setPhotoPath(finalPhotoPath);
        } catch (err) {
            console.error("Photo Capture Error:", err);
            setError("Failed to capture photo");
        } finally {
            setIsCapturing(false);
        }
    };

    const savePhoto = async () => {
        if (!photoPath) {
            setError("No photo to save");
            return;
        }

        setIsSaving(true);
        try {
            if (onPhotoCapture) {
                await onPhotoCapture(photoPath);
                if (onClose) {
                    onClose();
                }
            } else {
                // Default behavior if no callback
                navigation.goBack();
            }
        } catch (err) {
            console.error("Save Photo Error:", err);
            setError("Failed to save photo");
        } finally {
            setIsSaving(false);
        }
    };

    const retakePhoto = () => {
        setPhotoPath(null);
        setError(null);
    };

    if (!device) {
        return (
            <View style={styles.loadingContainer}>
                <View style={styles.loadingContent}>
                    <ActivityIndicator
                        size="large"
                        color={colors.primary}
                    />
                    <Text style={styles.loadingText}>Initializing camera...</Text>
                </View>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
            {/* Camera View */}
            <Camera
                ref={camera}
                photo={true}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={!photoPath}
            />

            {/* Header with close button */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => onClose?.()}
                    activeOpacity={0.8}>
                    <FeatherIcon
                        name="x"
                        size={28}
                        color={customColors.light.white}
                    />
                </TouchableOpacity>
            </View>

            {/* Error Toast */}
            {error && (
                <View style={styles.errorContainer}>
                    <FeatherIcon
                        name="alert-circle"
                        size={20}
                        color={customColors.light.error}
                    />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {/* Photo Preview */}
            {photoPath ? (
                <View style={styles.previewOverlay}>
                    <Image
                        style={styles.previewImage}
                        source={{ uri: photoPath.startsWith('file://') ? photoPath : "file://" + photoPath }}
                        resizeMode="contain"
                    />

                    {/* Preview Actions */}
                    <View style={styles.previewActions}>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={retakePhoto}
                            activeOpacity={0.8}>
                            <View
                                style={[
                                    styles.actionIconBg,
                                    { backgroundColor: "rgba(0,0,0,0.5)" },
                                ]}>
                                <FeatherIcon
                                    name="refresh-cw"
                                    size={24}
                                    color={customColors.light.white}
                                />
                            </View>
                            <Text style={styles.actionText}>Retake</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={savePhoto}
                            disabled={isSaving}
                            activeOpacity={0.8}>
                            <View
                                style={[
                                    styles.actionIconBg,
                                    styles.saveIconBg,
                                    isSaving && styles.actionDisabled,
                                ]}>
                                {isSaving ? (
                                    <ActivityIndicator
                                        size="small"
                                        color={customColors.light.white}
                                    />
                                ) : (
                                    <FeatherIcon
                                        name="check"
                                        size={24}
                                        color={customColors.light.white}
                                    />
                                )}
                            </View>
                            <Text style={styles.actionText}>
                                {isSaving ? "Saving..." : "Use Photo"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                /* Capture Controls */
                <View style={styles.captureControls}>
                    <TouchableOpacity
                        style={[
                            styles.captureButton,
                            isCapturing && styles.captureButtonActive,
                        ]}
                        onPress={takePhoto}
                        disabled={isCapturing}
                        activeOpacity={0.9}>
                        <View style={styles.captureButtonOuter}>
                            <View
                                style={[
                                    styles.captureButtonInner,
                                    isCapturing && styles.captureButtonInnerActive,
                                ]}
                            />
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.captureHint}>
                        {isCapturing ? "Capturing..." : "Tap to capture"}
                    </Text>
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#000",
    },
    loadingContent: {
        alignItems: "center",
    },
    loadingText: {
        marginTop: spacing.md,
        color: "#FFF",
        fontSize: 16,
    },
    header: {
        position: "absolute",
        top: 40,
        left: 20,
        zIndex: 10,
    },
    closeButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    errorContainer: {
        position: "absolute",
        top: 100,
        left: 20,
        right: 20,
        backgroundColor: "rgba(255, 0, 0, 0.8)",
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        borderRadius: 8,
        zIndex: 10,
    },
    errorText: {
        color: "#FFF",
        marginLeft: 8,
        fontSize: 14,
    },
    captureControls: {
        position: "absolute",
        bottom: 50,
        width: "100%",
        alignItems: "center",
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: "center",
        alignItems: "center",
    },
    captureButtonActive: {
        transform: [{ scale: 0.9 }],
    },
    captureButtonOuter: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 4,
        borderColor: "#FFF",
        justifyContent: "center",
        alignItems: "center",
    },
    captureButtonInner: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: "#FFF",
    },
    captureButtonInnerActive: {
        backgroundColor: "rgba(255,255,255,0.7)",
    },
    captureHint: {
        color: "#FFF",
        marginTop: 12,
        fontSize: 14,
        fontWeight: "500",
        textShadowColor: "rgba(0,0,0,0.5)",
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    previewOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "#000",
        justifyContent: "center",
    },
    previewImage: {
        flex: 1,
        width: width,
    },
    previewActions: {
        flexDirection: "row",
        justifyContent: "space-around",
        paddingBottom: 50,
        paddingTop: 20,
        backgroundColor: "rgba(0,0,0,0.8)",
    },
    actionButton: {
        alignItems: "center",
    },
    actionIconBg: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 8,
    },
    saveIconBg: {
        backgroundColor: "#2E7D32",
    },
    actionDisabled: {
        opacity: 0.5,
    },
    actionText: {
        color: "#FFF",
        fontSize: 14,
        fontWeight: "600",
    },
});

export default OpenCamera;
