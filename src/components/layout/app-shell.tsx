import * as React from "react";
import { Outlet } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import Sidebar from "@/components/layout/sidebar";

type AppShellProps = {
    title?: string;
    rightSlot?: React.ReactNode;
};

export default function AppShell({ title = "Dashboard", rightSlot }: AppShellProps) {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="grid min-h-screen grid-cols-[260px_1fr]">
                {/* Sidebar */}
                <aside className="border-r">
                    <Sidebar />
                </aside>

                {/* Main */}
                <div className="flex min-h-screen flex-col">
                    {/* Topbar */}
                    <header className="sticky top-0 z-10 bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
                        <div className="flex h-14 items-center justify-between px-6">
                            <h1 className="text-sm font-semibold">{title}</h1>
                            <div className="flex items-center gap-2">{rightSlot ?? null}</div>
                        </div>
                        <Separator />
                    </header>

                    {/* Content */}
                    <main className="flex-1 p-6">
                        <div className="mx-auto w-full max-w-6xl">
                            <Outlet />
                        </div>
                    </main>

                    {/* Footer */}
                    <footer className="px-6 pb-6 text-xs text-muted-foreground">
                        <Separator className="mb-4" />
                        <div className="flex items-center justify-between">
                            <span>© {new Date().getFullYear()} Sneaker Shop</span>
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    );
}
