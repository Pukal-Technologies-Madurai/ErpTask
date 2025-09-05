import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MMKV } from "react-native-mmkv";
import { baseurl } from "./constants/api";
import { ThemeProvider } from "./Context/ThemeContext";
import Navigation from "./Navigation/Navigation";

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
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <Navigation />
            </ThemeProvider>
        </QueryClientProvider>
    );
};

export default App;
