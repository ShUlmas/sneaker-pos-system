import * as React from "react";
import { supabase } from "@/lib/supabase";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";

import {
    ResponsiveContainer,
    LineChart,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
} from "recharts";

type OrderRow = {
    id: string;
    order_no: string;
    payment_type: "cash" | "card";
    subtotal: number;
    total: number;
    created_at: string;
};

type Flash = { type: "error" | "success"; title: string; desc?: string } | null;

function money(n: number) {
    return n.toLocaleString("ru-RU");
}
function pad2(n: number) {
    return String(n).padStart(2, "0");
}
function hourLabel(h: number) {
    return `${pad2(h)}:00`;
}
function startOfTodayLocalISO() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
}
function buildHourSeries(dataHours: number[], startDefault = 8, endDefault = 22) {
    const minData = dataHours.length ? Math.min(...dataHours) : startDefault;
    const maxData = dataHours.length ? Math.max(...dataHours) : endDefault;
    const start = Math.min(startDefault, minData);
    const end = Math.max(endDefault, maxData);
    const hours: number[] = [];
    for (let h = start; h <= end; h++) hours.push(h);
    return hours;
}
function formatCompactUZS(v: number) {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    if (n >= 1_000_000) return `${Math.round(n / 1_000_000)} mln`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
    return String(n);
}

export default function ReportsPage() {
    const [orders, setOrders] = React.useState<OrderRow[]>([]);
    const [itemsCountByOrder, setItemsCountByOrder] = React.useState<Record<string, number>>({});
    const [loading, setLoading] = React.useState(true);
    const [flash, setFlash] = React.useState<Flash>(null);

    const [revenueByHour, setRevenueByHour] = React.useState<{ hour: string; revenue: number }[]>([]);
    const [qtyByHour, setQtyByHour] = React.useState<{ hour: string; qty: number }[]>([]);
    const [paySplit, setPaySplit] = React.useState<{ name: "Naqd" | "Karta"; value: number }[]>([
        { name: "Naqd", value: 0 },
        { name: "Karta", value: 0 },
    ]);

    const totals = React.useMemo(() => {
        const revenue = orders.reduce((acc, o) => acc + (o.total ?? 0), 0);
        const ordersCount = orders.length;
        const itemsCount = Object.values(itemsCountByOrder).reduce((acc, n) => acc + n, 0);
        return { revenue, ordersCount, itemsCount };
    }, [orders, itemsCountByOrder]);

    async function loadToday() {
        setLoading(true);
        setFlash(null);

        const fromISO = startOfTodayLocalISO();

        const { data: ord, error: ordErr } = await supabase
            .from("orders")
            .select("id,order_no,payment_type,subtotal,total,created_at")
            .gte("created_at", fromISO)
            .order("created_at", { ascending: false });

        if (ordErr) {
            setLoading(false);
            setOrders([]);
            setItemsCountByOrder({});
            setFlash({ type: "error", title: "Orderlarni olishda xato", desc: ordErr.message });
            return;
        }

        const ordersMapped: OrderRow[] = (ord ?? []).map((o: any) => ({
            id: o.id,
            order_no: o.order_no,
            payment_type: o.payment_type,
            subtotal: Number(o.subtotal ?? 0),
            total: Number(o.total ?? 0),
            created_at: o.created_at,
        }));
        setOrders(ordersMapped);

        if (ordersMapped.length === 0) {
            const hours = buildHourSeries([], 8, 22);
            setRevenueByHour(hours.map((h) => ({ hour: hourLabel(h), revenue: 0 })));
            setQtyByHour(hours.map((h) => ({ hour: hourLabel(h), qty: 0 })));
            setPaySplit([
                { name: "Naqd", value: 0 },
                { name: "Karta", value: 0 },
            ]);
            setItemsCountByOrder({});
            setLoading(false);
            return;
        }

        const orderIds = ordersMapped.map((o) => o.id);

        const { data: items, error: itemsErr } = await supabase
            .from("order_items")
            .select("order_id, qty")
            .in("order_id", orderIds);

        if (itemsErr) {
            setLoading(false);
            setItemsCountByOrder({});
            setFlash({ type: "error", title: "Order itemlarni olishda xato", desc: itemsErr.message });
            return;
        }

        const countMap: Record<string, number> = {};
        (items ?? []).forEach((it: any) => {
            const id = it.order_id as string;
            const q = Number(it.qty ?? 0);
            countMap[id] = (countMap[id] ?? 0) + q;
        });
        setItemsCountByOrder(countMap);

        const orderHourMap = new Map<string, number>();
        const revenueMap = new Map<number, number>();
        const qtyMap = new Map<number, number>();

        let cashSum = 0;
        let cardSum = 0;

        ordersMapped.forEach((o) => {
            const d = new Date(o.created_at);
            const h = d.getHours();
            orderHourMap.set(o.id, h);
            revenueMap.set(h, (revenueMap.get(h) ?? 0) + (o.total ?? 0));
            if (o.payment_type === "cash") cashSum += o.total ?? 0;
            if (o.payment_type === "card") cardSum += o.total ?? 0;
        });

        (items ?? []).forEach((it: any) => {
            const oid = it.order_id as string;
            const q = Number(it.qty ?? 0);
            const h = orderHourMap.get(oid);
            if (h === undefined) return;
            qtyMap.set(h, (qtyMap.get(h) ?? 0) + q);
        });

        const dataHours = Array.from(new Set<number>([...revenueMap.keys(), ...qtyMap.keys()]));
        const hours = buildHourSeries(dataHours, 8, 22);

        setRevenueByHour(hours.map((h) => ({ hour: hourLabel(h), revenue: revenueMap.get(h) ?? 0 })));
        setQtyByHour(hours.map((h) => ({ hour: hourLabel(h), qty: qtyMap.get(h) ?? 0 })));

        setPaySplit([
            { name: "Naqd", value: cashSum },
            { name: "Karta", value: cardSum },
        ]);

        setLoading(false);
    }

    React.useEffect(() => {
        loadToday();
    }, []);

    // Chart configs (ChartTooltipContent context uchun)
    const revenueConfig = {
        revenue: { label: "Tushum", color: "hsl(var(--chart-1))" },
    } as const;

    const qtyConfig = {
        qty: { label: "Sotilgan (qty)", color: "hsl(var(--chart-2))" },
    } as const;

    const payConfig = {
        cash: { label: "Naqd", color: "hsl(var(--chart-1))" },
        card: { label: "Karta", color: "hsl(var(--chart-2))" },
    } as const;

    // Pie colors (aniq, har xil)
    const CASH_COLOR = "hsl(142.1 70.6% 45.3%)"; // green
    const CARD_COLOR = "hsl(221.2 83.2% 53.3%)"; // blue

    return (
        <div className="space-y-6">
            {flash ? (
                <Alert className="border-destructive/50 bg-destructive/10">
                    <AlertTitle>{flash.title}</AlertTitle>
                    {flash.desc ? <AlertDescription>{flash.desc}</AlertDescription> : null}
                </Alert>
            ) : null}

            {/* KPI */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>Bugungi tushum</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                        {loading ? "..." : `${money(totals.revenue)} UZS`}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Buyurtmalar soni</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                        {loading ? "..." : totals.ordersCount}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Sotilgan itemlar</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                        {loading ? "..." : totals.itemsCount}
                    </CardContent>
                </Card>
            </div>

            {/* CHARTS */}
            <div className="grid gap-4 lg:grid-cols-3">
                {/* 1) Line */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Bugungi tushum vaqt bo‘yicha</CardTitle>
                    </CardHeader>
                    <CardContent className="h-72">
                        <ChartContainer config={revenueConfig} className="h-full w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={revenueByHour} margin={{ left: 26, right: 10, top: 10, bottom: 22 }}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis
                                        dataKey="hour"
                                        tickLine={false}
                                        axisLine={false}
                                        height={30}
                                        interval="preserveStartEnd"
                                        minTickGap={18}
                                    />
                                    <YAxis
                                        tickLine={false}
                                        axisLine={false}
                                        width={72}
                                        tickFormatter={(v) => formatCompactUZS(Number(v))}
                                    />
                                    <ChartTooltip
                                        content={
                                            <ChartTooltipContent
                                                formatter={(value) => `${money(Number(value))} UZS`}
                                            />
                                        }
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="revenue"
                                        stroke="hsl(var(--chart-1))"
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* 2) Pie (IMPORTANT: inside ChartContainer!) */}
                <Card>
                    <CardHeader>
                        <CardTitle>Naqd vs Karta</CardTitle>
                    </CardHeader>
                    <CardContent className="h-72">
                        <ChartContainer config={payConfig} className="h-full w-full">
                            <div className="h-[78%]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <ChartTooltip
                                            content={
                                                <ChartTooltipContent
                                                    formatter={(value, _name, props: any) => {
                                                        const label = props?.payload?.name ?? "";
                                                        return `${label}: ${money(Number(value))} UZS`;
                                                    }}
                                                />
                                            }
                                        />
                                        <Pie
                                            data={[
                                                { name: "Naqd", value: paySplit[0]?.value ?? 0 },
                                                { name: "Karta", value: paySplit[1]?.value ?? 0 },
                                            ]}
                                            dataKey="value"
                                            nameKey="name"
                                            innerRadius={55}
                                            outerRadius={85}
                                            strokeWidth={1}
                                        >
                                            <Cell fill={CASH_COLOR} />
                                            <Cell fill={CARD_COLOR} />
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* legend */}
                            <div className="mt-2 space-y-2 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="flex items-center gap-2 text-muted-foreground">
                                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CASH_COLOR }} />
                                        Naqd
                                    </span>
                                    <span className="font-medium tabular-nums">
                                        {money(paySplit[0]?.value ?? 0)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="flex items-center gap-2 text-muted-foreground">
                                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CARD_COLOR }} />
                                        Karta
                                    </span>
                                    <span className="font-medium tabular-nums">
                                        {money(paySplit[1]?.value ?? 0)}
                                    </span>
                                </div>
                            </div>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* 3) Bar */}
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Sotilgan itemlar soat bo‘yicha</CardTitle>
                    </CardHeader>
                    <CardContent className="h-72">
                        <ChartContainer config={qtyConfig} className="h-full w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={qtyByHour} margin={{ left: 18, right: 10, top: 10, bottom: 22 }}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis
                                        dataKey="hour"
                                        tickLine={false}
                                        axisLine={false}
                                        height={30}
                                        interval="preserveStartEnd"
                                        minTickGap={18}
                                    />
                                    <YAxis tickLine={false} axisLine={false} width={44} />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Bar
                                        dataKey="qty"
                                        fill="hsl(var(--chart-2))"
                                        radius={[6, 6, 0, 0]}
                                        maxBarSize={36}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>

            {/* TABLE */}
            <Card>
                <CardHeader>
                    <CardTitle>Bugungi sotuvlar</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? <div className="text-sm text-muted-foreground">Yuklanmoqda...</div> : null}
                    {!loading && orders.length === 0 ? (
                        <div className="text-sm text-muted-foreground">Bugun sotuv yo‘q</div>
                    ) : null}

                    {!loading && orders.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order</TableHead>
                                    <TableHead>Vaqt</TableHead>
                                    <TableHead className="text-right">Items</TableHead>
                                    <TableHead>To‘lov</TableHead>
                                    <TableHead className="text-right">Jami</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.map((o) => {
                                    const d = new Date(o.created_at);
                                    const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
                                    const items = itemsCountByOrder[o.id] ?? 0;
                                    const pay = o.payment_type === "cash" ? "Naqd" : "Karta";

                                    return (
                                        <TableRow key={o.id}>
                                            <TableCell className="font-medium">{o.order_no}</TableCell>
                                            <TableCell>{time}</TableCell>
                                            <TableCell className="text-right">{items}</TableCell>
                                            <TableCell>{pay}</TableCell>
                                            <TableCell className="text-right">{money(o.total)}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    );
}
