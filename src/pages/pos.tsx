import * as React from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Variant = {
    variant_id: string;
    product_name: string;
    brand: string;
    size: number;
    color: string;
    stock: number;
    price: number;
};

type CartItem = Variant & {
    qty: number;
};

function money(n: number) {
    return n.toLocaleString("ru-RU");
}

export default function POSPage() {
    const [query, setQuery] = React.useState("");
    const [results, setResults] = React.useState<Variant[]>([]);
    const [cart, setCart] = React.useState<CartItem[]>([]);
    const [loading, setLoading] = React.useState(false);

    const [payment, setPayment] = React.useState<"cash" | "card">("cash");

    // =====================
    // SEARCH PRODUCTS
    // =====================
    async function searchProducts(q: string) {
        setQuery(q);
        if (q.trim().length < 2) {
            setResults([]);
            return;
        }

        const { data, error } = await supabase
            .from("product_variants")
            .select(`
        id,
        size,
        color,
        stock,
        sell_price,
        product:products (
          name,
          brand,
          sell_price
        )
      `)
            .gt("stock", 0)
            .ilike("product.name", `%${q}%`)
            .limit(5);

        if (error) {
            toast.error("Mahsulot qidirishda xato");
            return;
        }

        const mapped: Variant[] =
            data?.map((v: any) => ({
                variant_id: v.id,
                product_name: v.product.name,
                brand: v.product.brand,
                size: v.size,
                color: v.color,
                stock: v.stock,
                price: v.sell_price ?? v.product.sell_price,
            })) ?? [];

        setResults(mapped);
    }

    // =====================
    // ADD TO CART
    // =====================
    function addToCart(v: Variant) {
        setResults([]);
        setQuery("");

        setCart((prev) => {
            const found = prev.find((p) => p.variant_id === v.variant_id);
            if (found) {
                if (found.qty + 1 > v.stock) {
                    toast.error("Bu variantning qoldig‘i yetarli emas");
                    return prev;
                }
                return prev.map((p) =>
                    p.variant_id === v.variant_id ? { ...p, qty: p.qty + 1 } : p
                );
            }
            return [...prev, { ...v, qty: 1 }];
        });
    }

    // =====================
    // CART CONTROLS
    // =====================
    function inc(item: CartItem) {
        if (item.qty + 1 > item.stock) {
            toast.error("Bu variantning qoldig‘i tugab qoladi");
            return;
        }
        setCart((c) =>
            c.map((i) =>
                i.variant_id === item.variant_id ? { ...i, qty: i.qty + 1 } : i
            )
        );
    }

    function dec(item: CartItem) {
        setCart((c) =>
            c.map((i) =>
                i.variant_id === item.variant_id
                    ? { ...i, qty: Math.max(1, i.qty - 1) }
                    : i
            )
        );
    }

    function remove(item: CartItem) {
        setCart((c) => c.filter((i) => i.variant_id !== item.variant_id));
    }

    // =====================
    // TOTAL
    // =====================
    const total = cart.reduce((acc, i) => acc + i.qty * i.price, 0);

    // =====================
    // SELL
    // =====================
    async function sell() {
        if (cart.length === 0) {
            toast.error("Savat bo‘sh");
            return;
        }

        setLoading(true);

        try {
            // 1️⃣ create order
            const orderNo = `A-${Date.now()}`;

            const { data: order, error: orderErr } = await supabase
                .from("orders")
                .insert({
                    order_no: orderNo,
                    payment_type: payment,
                    subtotal: total,
                    total: total,
                })
                .select("id")
                .single();

            if (orderErr || !order) throw orderErr;

            // 2️⃣ order items + stock update
            for (const item of cart) {
                // insert order item
                const { error: itemErr } = await supabase
                    .from("order_items")
                    .insert({
                        order_id: order.id,
                        variant_id: item.variant_id,
                        qty: item.qty,
                        unit_price: item.price,
                        line_total: item.qty * item.price,
                    });

                if (itemErr) throw itemErr;

                // update stock
                const { error: stockErr } = await supabase
                    .from("product_variants")
                    .update({ stock: item.stock - item.qty })
                    .eq("id", item.variant_id);

                if (stockErr) throw stockErr;
            }

            toast.success("Sotuv muvaffaqiyatli yakunlandi");
            setCart([]);
            setPayment("cash");
        } catch (e: any) {
            toast.error("Sotishda xato yuz berdi");
        } finally {
            setLoading(false);
        }
    }

    // =====================
    // UI
    // =====================
    return (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            {/* LEFT */}
            <div className="space-y-4">
                {/* SEARCH */}
                <Card>
                    <CardHeader>
                        <CardTitle>Mahsulot qidirish</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Input
                            value={query}
                            onChange={(e) => searchProducts(e.target.value)}
                            placeholder="Mahsulot nomini yozing..."
                        />

                        {results.length > 0 && (
                            <div className="rounded-md border">
                                {results.map((r) => (
                                    <button
                                        key={r.variant_id}
                                        onClick={() => addToCart(r)}
                                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted"
                                    >
                                        <div>
                                            <div className="font-medium">
                                                {r.product_name} ({r.brand})
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Size: {r.size} · Rang: {r.color} · Stock: {r.stock}
                                            </div>
                                        </div>
                                        <div className="font-semibold">{money(r.price)}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* CART */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Savat</CardTitle>
                        {cart.length > 0 && (
                            <Button variant="ghost" onClick={() => setCart([])}>
                                Tozalash
                            </Button>
                        )}
                    </CardHeader>

                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Mahsulot</TableHead>
                                    <TableHead>Size</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                    <TableHead className="text-right">Narx</TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {cart.map((i) => (
                                    <TableRow key={i.variant_id}>
                                        <TableCell>
                                            <div className="font-medium">
                                                {i.product_name} ({i.brand})
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {i.color}
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => remove(i)}
                                            >
                                                O‘chirish
                                            </Button>
                                        </TableCell>

                                        <TableCell>{i.size}</TableCell>

                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button size="icon" variant="outline" onClick={() => dec(i)}>
                                                    −
                                                </Button>
                                                <span className="w-6 text-center">{i.qty}</span>
                                                <Button size="icon" variant="outline" onClick={() => inc(i)}>
                                                    +
                                                </Button>
                                            </div>
                                        </TableCell>

                                        <TableCell className="text-right">
                                            {money(i.qty * i.price)}
                                        </TableCell>
                                    </TableRow>
                                ))}

                                {cart.length === 0 && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={4}
                                            className="text-center text-muted-foreground"
                                        >
                                            Savat bo‘sh
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* RIGHT */}
            <div className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Jami</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between text-sm">
                            <span>Mahsulotlar</span>
                            <span>{money(total)}</span>
                        </div>

                        <div className="flex justify-between text-lg font-semibold">
                            <span>To‘lash</span>
                            <span>{money(total)} UZS</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant={payment === "cash" ? "default" : "secondary"}
                                onClick={() => setPayment("cash")}
                            >
                                Naqd
                            </Button>
                            <Button
                                variant={payment === "card" ? "default" : "secondary"}
                                onClick={() => setPayment("card")}
                            >
                                Karta
                            </Button>
                        </div>

                        <Button
                            className="w-full"
                            onClick={sell}
                            disabled={loading}
                        >
                            {loading ? "Sotilmoqda..." : "Sotish"}
                        </Button>

                        <p className="text-xs text-muted-foreground">
                            Sotish: orders + order_items yoziladi va ombordagi stock kamayadi.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
