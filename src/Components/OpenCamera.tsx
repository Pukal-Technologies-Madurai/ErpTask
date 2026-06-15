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
    CameraRef,
    useCameraDevice,
    useCameraPermission,
    usePhotoOutput,
} from "react-native-vision-camera";
import { useNavigation } from "@react-navigation/native";
import FeatherIcon from "react-native-vector-icons/Feather";
import {
    customColors,
    spacing,
} from "../constants/helper";
import ImagePicker from "react-native-image-crop-picker";
import ImageResizer from "@bam.tech/react-native-image-resizer";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../Context/ThemeContext";

const { width } = Dimensions.get("window");

const OpenCamera = ({ onPhotoCapture, enableCompression = true, onClose }: any) => {
    const navigation = useNavigation();
    const { colors } = useTheme();
    const device = useCameraDevice("back");
    const camera = useRef<CameraRef>(null);
    const photoOutput = usePhotoOutput();
    const { hasPermission, requestPermission } = useCameraPermission();

    const [photoPath, setPhotoPath] = useState<string | null>(null);
    const [rawPhotoPath, setRawPhotoPath] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const normalizeLocalPath = (imagePath: string) =>
        decodeURIComponent(
            imagePath.startsWith("file://")
                ? imagePath.replace(/^file:\/\//, "")
                : imagePath,
        );

    const toFileUri = (imagePath: string) => {
        const localPath = normalizeLocalPath(imagePath);
        return `file://${localPath}`;
    };

    const rotateImage = async (imagePath: string, rotation: number) => {
        const localPath = normalizeLocalPath(imagePath);
        const uri = `file://${localPath}`;
        const { width: imageWidth, height: imageHeight } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
            Image.getSize(uri, (imgWidth, imgHeight) => resolve({ width: imgWidth, height: imgHeight }), reject);
        });

        const result = await ImageResizer.createResizedImage(
            uri,
            imageWidth,
            imageHeight,
            "JPEG",
            90,
            rotation,
        );

        return result.uri;
    };

    const updatePhoto = async (transformer: (currentPath: string) => Promise<string>) => {
        if (!photoPath) return;

        setIsEditing(true);
        setError(null);

        try {
            const nextPath = await transformer(photoPath);
            setPhotoPath(nextPath);
        } catch (err) {
            console.error("Image edit error:", err);
            setError("Failed to edit photo");
        } finally {
            setIsEditing(false);
        }
    };

    const cropPhoto = async () => {
        const cropSource = rawPhotoPath || photoPath;
        if (!cropSource) return;

        setIsEditing(true);
        setError(null);

        try {
            const pickerResult = await ImagePicker.openCropper({
                path: toFileUri(cropSource),
                mediaType: "photo",
                width: 1024,
                height: 1280,
                cropping: true,
                freeStyleCropEnabled: true,
                enableRotationGesture: true,
                cropperToolbarTitle: "Adjust Photo",
                cropperToolbarColor: "#000000",
                cropperToolbarWidgetColor: "#FFFFFF",
                hideBottomControls: false,
                forceJpg: true,
            });

            setPhotoPath(
                pickerResult.path.startsWith("file://")
                    ? pickerResult.path
                    : `file://${pickerResult.path}`,
            );
            setRawPhotoPath(
                pickerResult.path.startsWith("file://")
                    ? pickerResult.path
                    : `file://${pickerResult.path}`,
            );
        } catch (err) {
            console.error("Cropper Error:", err);
            setError("Failed to crop photo");
        } finally {
            setIsEditing(false);
        }
    };

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
            const photo = await photoOutput.capturePhotoToFile({
                flashMode: "off",
                enableShutterSound: true,
            }, {});

            const capturedPath = photo.filePath;
            setRawPhotoPath(toFileUri(capturedPath));

            let finalPhotoPath = capturedPath;

            // Compress image if enabled
            if (enableCompression) {
                finalPhotoPath = await compressImage(`file://${capturedPath}`);
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
        setRawPhotoPath(null);
        setError(null);
    };

    const rotateLeft = () => updatePhoto(currentPath => rotateImage(currentPath, 270));

    const rotateRight = () => updatePhoto(currentPath => rotateImage(currentPath, 90));

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
                style={StyleSheet.absoluteFill}
                device={device}
                outputs={[photoOutput]}
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
                        <View style={styles.editActions}>
                            <TouchableOpacity
                                style={[styles.editButton, isEditing && styles.actionDisabled]}
                                onPress={rotateLeft}
                                disabled={isEditing}
                                activeOpacity={0.8}>
                                <FeatherIcon
                                    name="rotate-ccw"
                                    size={20}
                                    color={customColors.light.white}
                                />
                                <Text style={styles.editButtonText}>Rotate Left</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.editButton, isEditing && styles.actionDisabled]}
                                onPress={cropPhoto}
                                disabled={isEditing}
                                activeOpacity={0.8}>
                                <FeatherIcon
                                    name="crop"
                                    size={20}
                                    color={customColors.light.white}
                                />
                                <Text style={styles.editButtonText}>Crop</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.editButton, isEditing && styles.actionDisabled]}
                                onPress={rotateRight}
                                disabled={isEditing}
                                activeOpacity={0.8}>
                                <FeatherIcon
                                    name="rotate-cw"
                                    size={20}
                                    color={customColors.light.white}
                                />
                                <Text style={styles.editButtonText}>Rotate Right</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.primaryActionsRow}>
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
                            disabled={isSaving || isEditing}
                            activeOpacity={0.8}>
                            <View
                                style={[
                                    styles.actionIconBg,
                                    styles.saveIconBg,
                                    (isSaving || isEditing) && styles.actionDisabled,
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
                                {isSaving
                                    ? "Saving..."
                                    : isEditing
                                        ? "Processing..."
                                        : "Use Photo"}
                            </Text>
                        </TouchableOpacity>
                        </View>
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
        ...StyleSheet.absoluteFill,
        backgroundColor: "#000",
        justifyContent: "center",
    },
    previewImage: {
        flex: 1,
        width: width,
    },
    previewActions: {
        paddingBottom: 36,
        paddingTop: 14,
        backgroundColor: "rgba(0,0,0,0.8)",
    },
    primaryActionsRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        width: "100%",
        paddingTop: 10,
    },
    editActions: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
        paddingHorizontal: 12,
        paddingBottom: 8,
        paddingTop: 2,
        flexWrap: "wrap",
    },
    editButton: {
        minWidth: 92,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.12)",
        alignItems: "center",
        justifyContent: "center",
    },
    editButtonText: {
        color: "#FFF",
        fontSize: 11,
        fontWeight: "600",
        marginTop: 4,
        textAlign: "center",
    },
    actionButton: {
        minWidth: 96,
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
