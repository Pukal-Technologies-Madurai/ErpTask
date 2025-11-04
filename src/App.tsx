import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MMKV } from "react-native-mmkv";
import { baseurl } from "./constants/api";
import { ThemeProvider } from "./Context/ThemeContext";
import Navigation from "./Navigation/Navigation";
import 'react-native-gesture-handler';

const queryClient = new QueryClient();

const App = () => {
    useEffect(() => {
        const storage = new MMKV();
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

export default App;
