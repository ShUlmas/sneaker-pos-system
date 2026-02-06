import * as React from "react";
import { useNavigate } from "react-router-dom";
import { loginDemo } from "@/app/auth";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
    const nav = useNavigate();
    const [username, setUsername] = React.useState("admin"); // ✅ auto filled
    const [password, setPassword] = React.useState("1234");  // ✅ auto filled
    const [loading, setLoading] = React.useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        const ok = loginDemo(username.trim(), password);
        if (!ok) {
            toast.error("Login yoki parol noto‘g‘ri");
            setLoading(false);
            return;
        }

        toast.success("Kirish muvaffaqiyatli!");
        nav("/pos", { replace: true });
    }

    return (
        <div className="min-h-[calc(100vh-2rem)] grid place-items-center p-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Kirish</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={onSubmit} className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Login</label>
                            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium">Parol</label>
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <Button className="w-full" disabled={loading} type="submit">
                            {loading ? "Kirilmoqda..." : "Kirish"}
                        </Button>

                        <p className="text-xs text-muted-foreground">
                            Demo: <span className="font-medium">admin</span> /{" "}
                            <span className="font-medium">1234</span>
                        </p>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
