-- =========================
-- Sneaker POS - DB Schema
-- =========================

-- PRODUCTS
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null,
  sku_base text,
  sell_price numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists products_name_brand_unique
on public.products (lower(name), lower(brand));

-- PRODUCT VARIANTS
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size int not null,
  color text not null,
  sku text unique,
  sell_price numeric(12,2),
  stock int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, size, color)
);

create index if not exists idx_variants_product on public.product_variants(product_id);
create index if not exists idx_variants_active on public.product_variants(is_active);

-- ORDERS
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  payment_type text not null check (payment_type in ('cash','card')),
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_created_at on public.orders(created_at);

-- ORDER ITEMS
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id),
  qty int not null check (qty > 0),
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_items_order on public.order_items(order_id);
