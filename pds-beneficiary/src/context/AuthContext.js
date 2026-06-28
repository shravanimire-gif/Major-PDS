import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        AsyncStorage.getItem("token").then((t) => {
            setToken(t);
            setLoading(false);
        });
    }, []);

    const login = async (newToken) => {
        await AsyncStorage.setItem("token", newToken);
        setToken(newToken);
    };

    const logout = async () => {
        await AsyncStorage.removeItem("token");
        setToken(null);
    };

    return (
        <AuthContext.Provider value={{ token, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
