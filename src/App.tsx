import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView, Text } from "react-native-gesture-handler";
import { baseurl } from "./constants/api";
import { ThemeProvider } from "./Context/ThemeContext";
import Navigation from "./Navigation/Navigation";
import "react-native-gesture-handler";
import { storage } from "./constants/storage";
import { View } from "react-native";

const queryClient = new QueryClient();

const App = () => {
    useEffect(() => {
        const storedBaseURL = storage.getString("baseURL");
        if (storedBaseURL) {
            baseurl(storedBaseURL);
        }
    }, []);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider>
                    <Navigation />
                </ThemeProvider>
            </QueryClientProvider>
        </GestureHandlerRootView>
    );
};

// const App = () => {
//     return (
//         <View
//             style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
//         >
//             <Text>App started</Text>
//         </View>
//     );
// };

export default App;
