import React from "react";
import { AuthProvider } from "./src/context/AuthContext";
import { ToastProvider } from "./src/components/primitives";
import AppNavigator from "./src/navigation/AppNavigator";

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppNavigator />
      </ToastProvider>
    </AuthProvider>
  );
}
