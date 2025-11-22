import { Dimensions, PixelRatio } from "react-native";

const { width: deviceWidth, height: deviceHeight } = Dimensions.get("window");
const baseWidth = 375;

export const responsiveFontSize = (fontSize: number) => {
    return Math.round(fontSize * (deviceWidth / baseWidth));
};

export const customFonts = {
    poppinsBlack: "Poppins-Black.ttf",
    poppinsBold: "Poppins-Bold.ttf",
    poppinsExtraBold: "Poppins-ExtraBold.ttf",
    poppinsExtraLight: "Poppins-ExtraLight.ttf",
    poppinsLight: "Poppins-Light.ttf",
    poppinsMedium: "Poppins-Medium.ttf",
    poppinsRegular: "Poppins-Regular.ttf",
    poppinsSemiBold: "Poppins-SemiBold.ttf",
    poppinsThin: "Poppins-Thin.ttf",
};

export const customColors = {
    light: {
        background: "#f9f9f9",
        primary: "#2E7D32",
        secondary: "#C8E6C9",
        accent: "#FF7043",
        text: "#263238",
        textSecondary: "#607D8B",
        black: "#000000",
        white: "#ffffff",
        borderColor: "#CFD8DC",
        grey: "#E0E0E0",

        // Grey scale
        grey50: "#FAFAFA",
        grey100: "#F5F5F5",
        grey200: "#EEEEEE",
        grey300: "#E0E0E0",
        grey400: "#BDBDBD",
        grey500: "#9E9E9E",
        grey600: "#757575",
        grey700: "#616161",
        grey800: "#424242",
        grey900: "#212121",

        // Status colors
        success: "#4CAF50",
        error: "#F44336",
        warning: "#a610ccc0",
        sih: "#17ca9dff",
        info: "#2196F3",
        rec: "#9f18c9ff",
        pay: "#01220fd7",
        pen: "#941108d7",
        del: "#ff1a0aff",
    },
    dark: {
        background: "#121212",
        primary: "#66BB6A",
        secondary: "#1E1E1E",
        accent: "#FF8A65",
        text: "#E0E0E0",
        textSecondary: "#9E9E9E",
        textDanger: "#e60909ff",
        black: "#000000",
        white: "#ffffff",
        borderColor: "#2C2C2C",
        grey: "#424242",

        // Grey scale
        grey50: "#FAFAFA",
        grey100: "#F5F5F5",
        grey200: "#EEEEEE",
        grey300: "#E0E0E0",
        grey400: "#BDBDBD",
        grey500: "#9E9E9E",
        grey600: "#757575",
        grey700: "#616161",
        grey800: "#424242",
        grey900: "#212121",

        // Status colors
        success: "#4CAF50",
        error: "#F44336",
        warning: "#FF9800",
        info: "#2196F3",
    },
};

export const typography = (colors: any) => ({
    h1: {
        fontFamily: customFonts.poppinsExtraBold,
        fontSize: responsiveFontSize(32),
        color: colors.text,
    },
    h2: {
        fontFamily: customFonts.poppinsBold,
        fontSize: responsiveFontSize(28),
        color: colors.text,
    },
    h3: {
        fontFamily: customFonts.poppinsSemiBold,
        fontSize: responsiveFontSize(24),
        color: colors.text,
    },
    h4: {
        fontFamily: customFonts.poppinsMedium,
        fontSize: responsiveFontSize(20),
        color: colors.text,
    },
    h5: {
        fontFamily: customFonts.poppinsMedium,
        fontSize: responsiveFontSize(18),
        color: colors.text,
    },
    h6: {
        fontFamily: customFonts.poppinsRegular,
        fontSize: responsiveFontSize(16),
        color: colors.text,
    },
    title: {
        fontFamily: customFonts.poppinsBold,
        fontSize: responsiveFontSize(28),
        color: colors.text,
    },
    subtitle: {
        fontFamily: customFonts.poppinsRegular,
        fontSize: responsiveFontSize(16),
        color: colors.textSecondary,
    },
    body1: {
        fontFamily: customFonts.poppinsRegular,
        fontSize: responsiveFontSize(14),
        color: colors.text,
    },
    body2: {
        fontFamily: customFonts.poppinsRegular,
        fontSize: responsiveFontSize(12),
        color: colors.textSecondary,
    },
    button: {
        fontFamily: customFonts.poppinsBold,
        fontSize: responsiveFontSize(14),
        color: colors.white,
    },
    caption: {
        fontFamily: customFonts.poppinsLight,
        fontSize: responsiveFontSize(12),
        color: colors.textSecondary,
    },
    overline: {
        fontFamily: customFonts.poppinsLight,
        fontSize: responsiveFontSize(10),
        color: colors.textSecondary,
    },
});

export const shadows = {
    small: {
        shadowColor: customColors.dark.black,
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    medium: {
        shadowColor: customColors.dark.black,
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    large: {
        shadowColor: customColors.dark.black,
        shadowOffset: {
            width: 0,
            height: 6,
        },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
};

export const spacing = {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};

// Responsive width function
export const responsiveWidth = (value: number) => {
    return PixelRatio.roundToNearestPixel((deviceWidth * value) / 100);
};

// Responsive height function
export const responsiveHeight = (value: number) => {
    return PixelRatio.roundToNearestPixel((deviceHeight * value) / 100);
};
