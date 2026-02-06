import { NavLink, useNavigate } from "react-router-dom";
import { logoutDemo } from "@/app/auth";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import {
    ShoppingCart,
    Boxes,
    BarChart3,
    LogOut,
} from "lucide-react";

export default function Sidebar() {
    const nav = useNavigate();

    function handleLogout() {
        logoutDemo();
        toast.success("Chiqildi");
        nav("/login", { replace: true });
    }

    const linkClass = (isActive: boolean) =>
        `flex items-center gap-2 rounded px-3 py-2 text-sm transition ${isActive
            ? "bg-muted font-medium"
            : "hover:bg-muted text-muted-foreground"
        }`;

    return (
        <aside className="flex h-full w-60 flex-col border-r bg-background">
            {/* TOP */}
            <div className="p-4 border-b">
                <div className="text-lg font-semibold">Sneaker Shop</div>
                <div className="text-xs text-muted-foreground">Demo sotuv tizim</div>
            </div>

            {/* NAV */}
            <nav className="flex-1 p-2 flex flex-col gap-1">
                <NavLink to="/pos">
                    {({ isActive }) => (
                        <div className={linkClass(isActive)}>
                            <ShoppingCart className="h-4 w-4" />
                            <span>Kassa</span>
                        </div>
                    )}
                </NavLink>

                <NavLink to="/inventory">
                    {({ isActive }) => (
                        <div className={linkClass(isActive)}>
                            <Boxes className="h-4 w-4" />
                            <span>Ombor</span>
                        </div>
                    )}
                </NavLink>

                <NavLink to="/reports">
                    {({ isActive }) => (
                        <div className={linkClass(isActive)}>
                            <BarChart3 className="h-4 w-4" />
                            <span>Hisobotlar</span>
                        </div>
                    )}
                </NavLink>
            </nav>

            {/* LOGOUT */}
            <div className="p-3 border-t">
                <Button
                    variant="outline"
                    className="w-full flex items-center gap-2"
                    onClick={handleLogout}
                >
                    <LogOut className="h-4 w-4" />
                    <span>Chiqish</span>
                </Button>
            </div>
        </aside>
    );
}
