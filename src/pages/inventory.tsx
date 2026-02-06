import * as React from "react";
import { supabase } from "@/lib/supabase";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { MoreHorizontal } from "lucide-react";

type InventoryRow = {
    variant_id: string;
    size: number;
    color: string;
    stock: number;
    variant_sell_price: number | null;

    product_id: string;
    product_name: string;
    brand: string;
    product_sell_price: number;
};

function numOrNaN(v: string) {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
}

function formatMoney(n: number) {
    return n.toLocaleString("ru-RU");
}

export default function InventoryPage() {
    const [rows, setRows] = React.useState<InventoryRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [err, setErr] = React.useState<string | null>(null);

    // filters
    const [query, setQuery] = React.useState("");
    const [onlyLow, setOnlyLow] = React.useState(false);

    // add dialog state
    const [open, setOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);

    // kirim form fields (SKU YO‘Q)
    const [name, setName] = React.useState("");
    const [brand, setBrand] = React.useState("");
    const [size, setSize] = React.useState("");
    const [color, setColor] = React.useState("");
    const [qty, setQty] = React.useState("");
    const [sellPrice, setSellPrice] = React.useState("");

    // edit/archive state
    const [editOpen, setEditOpen] = React.useState(false);
    const [archiveOpen, setArchiveOpen] = React.useState(false);
    const [selected, setSelected] = React.useState<InventoryRow | null>(null);

    const [editSize, setEditSize] = React.useState("");
    const [editColor, setEditColor] = React.useState("");
    const [editStock, setEditStock] = React.useState("");
    const [editVariantPrice, setEditVariantPrice] = React.useState(""); // optional

    async function loadInventory() {
        setLoading(true);
        setErr(null);

        // ✅ faqat is_active=true bo‘lgan variantlar
        const { data, error } = await supabase
            .from("product_variants")
            .select(
                `
        id,
        size,
        color,
        stock,
        sell_price,
        is_active,
        product:products (
          id,
          name,
          brand,
          sell_price
        )
      `
            )
            .eq("is_active", true)
            .order("created_at", { ascending: false });

        if (error) {
            setErr(error.message);
            setRows([]);
            setLoading(false);
            return;
        }

        const mapped: InventoryRow[] =
            (data ?? []).map((v: any) => ({
                variant_id: v.id,
                size: v.size,
                color: v.color,
                stock: v.stock ?? 0,
                variant_sell_price: v.sell_price ?? null,

                product_id: v.product?.id,
                product_name: v.product?.name ?? "Unknown",
                brand: v.product?.brand ?? "-",
                product_sell_price: v.product?.sell_price ?? 0,
            })) ?? [];

        setRows(mapped);
        setLoading(false);
    }

    React.useEffect(() => {
        loadInventory();
    }, []);

    const filtered = React.useMemo(() => {
        const q = query.trim().toLowerCase();
        return rows.filter((r) => {
            if (onlyLow && !(r.stock > 0 && r.stock <= 2)) return false;
            if (!q) return true;

            const hay = [r.product_name, r.brand, r.color, String(r.size)]
                .join(" ")
                .toLowerCase();

            return hay.includes(q);
        });
    }, [rows, query, onlyLow]);

    async function handleAddIncoming() {
        setErr(null);

        const nameV = name.trim();
        const brandV = brand.trim();
        const colorV = color.trim();

        const sizeN = numOrNaN(size);
        const qtyN = numOrNaN(qty);
        const priceN = numOrNaN(sellPrice);

        if (!nameV) return setErr("Model nomini kiriting.");
        if (!brandV) return setErr("Brand kiriting.");
        if (!Number.isFinite(sizeN) || sizeN <= 0) return setErr("O'lcham noto‘g‘ri.");
        if (!colorV) return setErr("Rang kiriting.");
        if (!Number.isFinite(qtyN) || qtyN <= 0)
            return setErr("Miqdor (qty) 0 dan katta bo‘lishi kerak.");
        if (!Number.isFinite(priceN) || priceN < 0)
            return setErr("Sotuv narx noto‘g‘ri.");

        setSaving(true);

        // 1) product find
        const { data: existingProd, error: prodFindErr } = await supabase
            .from("products")
            .select("id")
            .eq("name", nameV)
            .eq("brand", brandV)
            .maybeSingle();

        if (prodFindErr) {
            setSaving(false);
            setErr(prodFindErr.message);
            return;
        }

        let productId: string;

        if (!existingProd) {
            // create product
            const { data: newProd, error: prodInsertErr } = await supabase
                .from("products")
                .insert({
                    name: nameV,
                    brand: brandV,
                    sell_price: priceN,
                    is_active: true,
                })
                .select("id")
                .single();

            if (prodInsertErr || !newProd) {
                setSaving(false);
                setErr(prodInsertErr?.message ?? "Product yaratishda xato.");
                return;
            }

            productId = newProd.id;
        } else {
            productId = existingProd.id;

            // update product price (MVP)
            const { error: prodUpdErr } = await supabase
                .from("products")
                .update({ sell_price: priceN })
                .eq("id", productId);

            if (prodUpdErr) {
                setSaving(false);
                setErr(prodUpdErr.message);
                return;
            }
        }

        // 2) variant find (✅ is_active=true bo‘lsa update qilamiz,
        // yo‘q bo‘lsa (oldin arxivlangan bo‘lsa) uni qayta aktiv qilamiz)
        const { data: existingVar, error: varFindErr } = await supabase
            .from("product_variants")
            .select("id, stock, is_active")
            .eq("product_id", productId)
            .eq("size", sizeN)
            .eq("color", colorV)
            .maybeSingle();

        if (varFindErr) {
            setSaving(false);
            setErr(varFindErr.message);
            return;
        }

        if (!existingVar) {
            // create variant (stock = qty)
            const { error: varInsertErr } = await supabase
                .from("product_variants")
                .insert({
                    product_id: productId,
                    size: sizeN,
                    color: colorV,
                    stock: qtyN,
                    is_active: true,
                });

            if (varInsertErr) {
                setSaving(false);
                setErr(varInsertErr.message);
                return;
            }
        } else {
            // variant bor → stock += qty, agar arxiv bo‘lsa qayta aktiv qilamiz
            const newStock = (existingVar.stock ?? 0) + qtyN;

            const { error: varUpdErr } = await supabase
                .from("product_variants")
                .update({ stock: newStock, is_active: true })
                .eq("id", existingVar.id);

            if (varUpdErr) {
                setSaving(false);
                setErr(varUpdErr.message);
                return;
            }
        }

        await loadInventory();

        // reset + close
        setName("");
        setBrand("");
        setSize("");
        setColor("");
        setQty("");
        setSellPrice("");

        setSaving(false);
        setOpen(false);
    }

    function openEdit(row: InventoryRow) {
        setErr(null);
        setSelected(row);
        setEditSize(String(row.size));
        setEditColor(row.color);
        setEditStock(String(row.stock));
        setEditVariantPrice(row.variant_sell_price === null ? "" : String(row.variant_sell_price));
        setEditOpen(true);
    }

    function openArchive(row: InventoryRow) {
        setErr(null);
        setSelected(row);
        setArchiveOpen(true);
    }

    async function handleUpdateVariant() {
        if (!selected) return;
        setErr(null);

        const sizeN = numOrNaN(editSize);
        const stockN = numOrNaN(editStock);
        const colorV = editColor.trim();

        if (!Number.isFinite(sizeN) || sizeN <= 0) return setErr("O'lcham noto‘g‘ri.");
        if (!colorV) return setErr("Rang kiriting.");
        if (!Number.isFinite(stockN) || stockN < 0) return setErr("Stock noto‘g‘ri.");

        let variantPrice: number | null = null;
        if (editVariantPrice.trim() !== "") {
            const p = numOrNaN(editVariantPrice);
            if (!Number.isFinite(p) || p < 0) return setErr("Variant narxi noto‘g‘ri.");
            variantPrice = p;
        }

        const { error } = await supabase
            .from("product_variants")
            .update({
                size: sizeN,
                color: colorV,
                stock: stockN,
                sell_price: variantPrice,
            })
            .eq("id", selected.variant_id);

        if (error) return setErr(error.message);

        setEditOpen(false);
        setSelected(null);
        await loadInventory();
    }

    // ✅ DELETE emas, ARXIVLASH
    async function handleArchiveVariant() {
        if (!selected) return;
        setErr(null);

        const { error } = await supabase
            .from("product_variants")
            .update({ is_active: false })
            .eq("id", selected.variant_id);

        if (error) return setErr(error.message);

        setArchiveOpen(false);
        setSelected(null);
        await loadInventory();
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Do'kon</h1>
                    <p className="text-sm text-muted-foreground">
                        Do‘kondagi sotiladigan tovarlar (do'konda mavjud tovarlar va ularning miqdori).
                        Tovar qo‘shish uchun "+ Tovar qo‘shish" tugmasini bosing.
                    </p>
                </div>

                <div className="flex gap-2">
                    {/* Add product/variant */}
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button>+ Tovar qo‘shish</Button>
                        </DialogTrigger>

                        <DialogContent className="sm:max-w-lg">
                            <DialogHeader>
                                <DialogTitle>Tovar qo‘shish</DialogTitle>
                                <DialogDescription>
                                    Model | brend | o'lcham | rang | miqdor | narxni kiriting.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-3">
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium">Model nomi</label>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Masalan: Air Max 90"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <label className="text-sm font-medium">Brand</label>
                                    <Input
                                        value={brand}
                                        onChange={(e) => setBrand(e.target.value)}
                                        placeholder="Masalan: Nike"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium">O'lcham</label>
                                        <Input
                                            value={size}
                                            onChange={(e) => setSize(e.target.value)}
                                            placeholder="38"
                                            inputMode="numeric"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium">Rang</label>
                                        <Input
                                            value={color}
                                            onChange={(e) => setColor(e.target.value)}
                                            placeholder="Black"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium">Miqdor (qty)</label>
                                        <Input
                                            value={qty}
                                            onChange={(e) => setQty(e.target.value)}
                                            placeholder="5"
                                            inputMode="numeric"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium">Sotuv narx</label>
                                        <Input
                                            value={sellPrice}
                                            onChange={(e) => setSellPrice(e.target.value)}
                                            placeholder="650000"
                                            inputMode="numeric"
                                        />
                                    </div>
                                </div>

                                {err && <div className="text-sm text-destructive">{err}</div>}

                                <Button className="w-full" onClick={handleAddIncoming} disabled={saving}>
                                    {saving ? "Saqlanmoqda..." : "Saqlash"}
                                </Button>

                                <p className="text-xs text-muted-foreground">
                                    Eslatma: Bir xil product chiqib ketmasligi uchun model/brandni bir xil formatda yozing.
                                </p>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Button variant="outline" onClick={loadInventory}>
                        Yangilash
                    </Button>
                </div>
            </div>

            {/* Search / Filters */}
            <Card>
                <CardHeader>
                    <CardTitle>Qidiruv</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Model / brand / rang / size bo‘yicha qidiring..."
                    />
                    <Button
                        variant={onlyLow ? "secondary" : "outline"}
                        onClick={() => setOnlyLow((v) => !v)}
                    >
                        Kam qolganlar
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => {
                            setQuery("");
                            setOnlyLow(false);
                        }}
                    >
                        Reset
                    </Button>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Qoldiq ro‘yxati</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? <div className="text-sm text-muted-foreground">Yuklanmoqda...</div> : null}
                    {!loading && err ? <div className="text-sm text-destructive">Xato: {err}</div> : null}

                    {!loading && !err ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Model</TableHead>
                                    <TableHead>Brand</TableHead>
                                    <TableHead>Rang</TableHead>
                                    <TableHead>Size</TableHead>
                                    <TableHead className="text-right">Qoldiq</TableHead>
                                    <TableHead className="text-right">Narx</TableHead>
                                    <TableHead className="text-right">Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {filtered.map((row) => {
                                    const low = row.stock > 0 && row.stock <= 2;
                                    const out = row.stock === 0;

                                    const price =
                                        row.variant_sell_price !== null ? row.variant_sell_price : row.product_sell_price;

                                    return (
                                        <TableRow key={row.variant_id}>
                                            <TableCell className="font-medium">{row.product_name}</TableCell>
                                            <TableCell>{row.brand}</TableCell>
                                            <TableCell>{row.color}</TableCell>
                                            <TableCell>{row.size}</TableCell>
                                            <TableCell className="text-right">{row.stock}</TableCell>
                                            <TableCell className="text-right">{formatMoney(price)}</TableCell>
                                            <TableCell className="text-right">
                                                {out ? (
                                                    <Badge variant="destructive">Tugagan</Badge>
                                                ) : low ? (
                                                    <Badge variant="secondary">Kam qoldi</Badge>
                                                ) : (
                                                    <Badge variant="outline">Yaxshi</Badge>
                                                )}
                                            </TableCell>

                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => openEdit(row)}>Edit</DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-muted-foreground"
                                                            onClick={() => openArchive(row)}
                                                        >
                                                            Arxivlash
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}

                                {filtered.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                                            Natija topilmadi
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    ) : null}
                </CardContent>
            </Card>

            {/* EDIT dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Variantni tahrirlash</DialogTitle>
                        <DialogDescription>
                            O'lcham / rang / stock (va ixtiyoriy variant narx)ni yangilang.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-3">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">O'lcham</label>
                            <Input value={editSize} onChange={(e) => setEditSize(e.target.value)} inputMode="numeric" />
                        </div>

                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Rang</label>
                            <Input value={editColor} onChange={(e) => setEditColor(e.target.value)} />
                        </div>

                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Stock</label>
                            <Input value={editStock} onChange={(e) => setEditStock(e.target.value)} inputMode="numeric" />
                        </div>

                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Variant narxi (ixtiyoriy)</label>
                            <Input
                                value={editVariantPrice}
                                onChange={(e) => setEditVariantPrice(e.target.value)}
                                inputMode="numeric"
                                placeholder="bo‘sh qoldirsangiz product narxi ishlaydi"
                            />
                        </div>

                        {err && <div className="text-sm text-destructive">{err}</div>}

                        <Button className="w-full" onClick={handleUpdateVariant}>
                            Saqlash
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ARCHIVE confirm */}
            <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Arxivlashni tasdiqlaysizmi?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu variant inventory va kassadan olib tashlanadi, lekin sotuv tarixi (hisobotlar) saqlanadi.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {err && <div className="text-sm text-destructive">{err}</div>}

                    <AlertDialogFooter>
                        <AlertDialogCancel>Bekor</AlertDialogCancel>
                        <AlertDialogAction onClick={handleArchiveVariant}>
                            Arxivlash
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
