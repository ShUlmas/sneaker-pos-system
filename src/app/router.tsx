import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";

import AppShell from "@/components/layout/app-shell";
import POSPage from "@/pages/pos";
import InventoryPage from "@/pages/inventory";
import ReportsPage from "@/pages/reports";
import LoginPage from "@/pages/login";

import { isAuthed } from "@/app/auth";

function RequireAuth() {
    return isAuthed() ? <Outlet /> : <Navigate to="/login" replace />;
}

function LoginGate() {
    return isAuthed() ? <Navigate to="/pos" replace /> : <LoginPage />;
}

function RootRedirect() {
    return isAuthed() ? <Navigate to="/pos" replace /> : <Navigate to="/login" replace />;
}

export const router = createBrowserRouter([
    { path: "/", element: <RootRedirect /> },

    // ✅ bu endi dynamic: logout/login bo‘lganda to‘g‘ri ishlaydi
    { path: "/login", element: <LoginGate /> },

    {
        element: <RequireAuth />,
        children: [
            {
                element: <AppShell />,
                children: [
                    { path: "/pos", element: <POSPage /> },
                    { path: "/inventory", element: <InventoryPage /> },
                    { path: "/reports", element: <ReportsPage /> },
                ],
            },
        ],
    },

    { path: "*", element: <Navigate to="/" replace /> },
]);
