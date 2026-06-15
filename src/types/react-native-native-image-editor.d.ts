declare module "react-native/Libraries/Image/NativeImageEditor" {
    const NativeImageEditor: {
        cropImage: (
            uri: string,
            cropData: {
                offset: { x: number; y: number };
                size: { width: number; height: number };
                displaySize?: { width: number; height: number } | null;
                resizeMode?: string | null;
                allowExternalStorage?: boolean;
            },
            successCallback: (uri: string) => void,
            errorCallback: (error: string) => void,
        ) => void;
    };

    export default NativeImageEditor;
}