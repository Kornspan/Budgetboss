-- Budgetboss Supabase schema
-- This schema keeps every row scoped by user_id (text) so we can evolve from today's demo identifier to real Supabase auth ids later.

create table if not exists public.profiles (
    id text primary key,
    display_name text not null,
    email text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.profiles is 'App-specific profile that mirrors Supabase auth users.';

create table if not exists public.accounts (
    id text primary key,
    user_id text not null references public.profiles(id) on delete cascade,
    name text not null,
    type text not null check (type in ('checking','savings','credit','investment','other')),
    provider text not null check (provider in ('manual','plaid','teller','other')),
    external_account_id text,
    institution_name text,
    current_balance_cents bigint not null,
    is_closed boolean not null default false,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists accounts_user_id_idx on public.accounts (user_id);

create table if not exists public.categories (
    id text primary key,
    user_id text not null references public.profiles(id) on delete cascade,
    name text not null,
    category_group text,
    created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists categories_user_unique_name on public.categories (user_id, lower(name));

create table if not exists public.category_rules (
    id text primary key,
    user_id text not null references public.profiles(id) on delete cascade,
    pattern text not null,
    category_id text not null references public.categories(id) on delete cascade,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.budget_months (
    id text primary key,
    user_id text not null references public.profiles(id) on delete cascade,
    year smallint not null check (year between 1900 and 2100),
    month smallint not null check (month between 1 and 12),
    created_at timestamptz not null default timezone('utc', now()),
    unique (user_id, year, month)
);

create table if not exists public.budget_entries (
    id text primary key,
    user_id text not null references public.profiles(id) on delete cascade,
    budget_month_id text not null references public.budget_months(id) on delete cascade,
    category_id text not null references public.categories(id) on delete cascade,
    budgeted_cents bigint not null,
    created_at timestamptz not null default timezone('utc', now()),
    unique (budget_month_id, category_id)
);

create index if not exists budget_entries_user_idx on public.budget_entries (user_id);

create table if not exists public.transactions (
    id text primary key,
    user_id text not null references public.profiles(id) on delete cascade,
    account_id text not null references public.accounts(id) on delete cascade,
    category_id text references public.categories(id) on delete set null,
    name text not null,
    amount_cents bigint not null,
    transaction_date date not null,
    notes text,
    source text not null check (source in ('manual','imported')),
    status text not null check (status in ('pending','posted')),
    external_transaction_id text,
    imported_at timestamptz,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists transactions_user_date_idx on public.transactions (user_id, transaction_date desc);
create index if not exists transactions_user_account_idx on public.transactions (user_id, account_id);
create unique index if not exists transactions_user_external_id_idx
    on public.transactions (user_id, external_transaction_id);

create table if not exists public.goals (
    id text primary key,
    user_id text not null references public.profiles(id) on delete cascade,
    name text not null,
    target_cents bigint not null,
    current_cents bigint not null,
    target_year smallint,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists goals_user_idx on public.goals (user_id);

create table if not exists public.fire_configs (
    user_id text primary key references public.profiles(id) on delete cascade,
    current_portfolio_cents bigint not null default 0,
    monthly_contribution_cents bigint not null default 0,
    expected_real_return_percent numeric(5,2) not null default 0,
    annual_spend_cents bigint not null default 0,
    safe_withdrawal_rate_percent numeric(5,2) not null default 4.00,
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.dashboard_widgets (
    id text primary key,
    user_id text not null references public.profiles(id) on delete cascade,
    type text not null,
    label text not null,
    enabled boolean not null default true,
    position integer not null,
    size text not null,
    created_at timestamptz not null default timezone('utc', now()),
    unique (user_id, type)
);

create table if not exists public.app_settings (
    user_id text primary key references public.profiles(id) on delete cascade,
    theme_preference text not null default 'system' check (theme_preference in ('system','light','dark')),
    notifications_enabled boolean not null default true,
    ai_personality text not null default 'friendly' check (ai_personality in ('friendly','direct','playful')),
    ai_search_grounding_enabled boolean not null default true,
    prototype_mode boolean not null default true,
    updated_at timestamptz not null default timezone('utc', now())
);

-- Row Level Security: lock every table to the owning user_id (or profile id).
-- When Supabase auth is wired up, auth.uid() will match profiles.id (which remains text).

alter table public.profiles enable row level security;
drop policy if exists profiles_owner_isolation on public.profiles;
create policy profiles_owner_isolation
    on public.profiles
    using (auth.uid()::text = id)
    with check (auth.uid()::text = id);

alter table public.accounts enable row level security;
drop policy if exists accounts_owner_isolation on public.accounts;
create policy accounts_owner_isolation
    on public.accounts using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

alter table public.categories enable row level security;
drop policy if exists categories_owner_isolation on public.categories;
create policy categories_owner_isolation
    on public.categories using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

alter table public.category_rules enable row level security;
drop policy if exists category_rules_owner_isolation on public.category_rules;
create policy category_rules_owner_isolation
    on public.category_rules using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

alter table public.budget_months enable row level security;
drop policy if exists budget_months_owner_isolation on public.budget_months;
create policy budget_months_owner_isolation
    on public.budget_months using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

alter table public.budget_entries enable row level security;
drop policy if exists budget_entries_owner_isolation on public.budget_entries;
create policy budget_entries_owner_isolation
    on public.budget_entries using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

alter table public.transactions enable row level security;
drop policy if exists transactions_owner_isolation on public.transactions;
create policy transactions_owner_isolation
    on public.transactions using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

alter table public.goals enable row level security;
drop policy if exists goals_owner_isolation on public.goals;
create policy goals_owner_isolation
    on public.goals using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

alter table public.fire_configs enable row level security;
drop policy if exists fire_configs_owner_isolation on public.fire_configs;
create policy fire_configs_owner_isolation
    on public.fire_configs using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

alter table public.dashboard_widgets enable row level security;
drop policy if exists dashboard_widgets_owner_isolation on public.dashboard_widgets;
create policy dashboard_widgets_owner_isolation
    on public.dashboard_widgets using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

alter table public.app_settings enable row level security;
drop policy if exists app_settings_owner_isolation on public.app_settings;
create policy app_settings_owner_isolation
    on public.app_settings using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

create table if not exists public.plaid_items (
    id text primary key,
    user_id text not null references public.profiles(id) on delete cascade,
    item_id text not null,
    access_token text not null,
    institution_name text,
    accounts_last_synced_at timestamptz,
    transactions_last_synced_at timestamptz,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists plaid_items_user_item_idx on public.plaid_items (user_id, item_id);

alter table public.plaid_items enable row level security;
drop policy if exists plaid_items_owner_isolation on public.plaid_items;
create policy plaid_items_owner_isolation
    on public.plaid_items using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

-- Example demo inserts (commented out). Run after replacing the ids with real values.
-- insert into public.profiles (id, display_name, email) values ('demo-user', 'Demo User', 'demo@example.com') on conflict (id) do nothing;
-- insert into public.accounts (id, user_id, name, type, provider, current_balance_cents)
-- values ('acc_1', 'demo-user', 'Main Checking', 'checking', 'manual', 241458)
-- on conflict (id) do nothing;
-- insert into public.categories (id, user_id, name, category_group)
-- values ('cat_1', 'demo-user', 'Groceries', 'Living')
-- on conflict (id) do nothing;
-- insert into public.transactions (
--     id, user_id, account_id, category_id, name, amount_cents, transaction_date, source, status
-- ) values (
--     'tx_1', 'demo-user', 'acc_1', 'cat_1', 'Trader Joes', -8542, current_date, 'manual', 'posted'
-- ) on conflict (id) do nothing;

-- RLS summary:
-- profiles, accounts, categories, category_rules, budget_months, budget_entries,
-- transactions, goals, fire_configs, dashboard_widgets, app_settings, and plaid_items
-- all have owner-isolation policies (auth.uid() must match id/user_id).

-- Helper function: disconnect a Plaid item and delete its related accounts/transactions atomically.
create or replace function public.disconnect_plaid_item(
    p_user_id text,
    p_plaid_item_id text,
    p_account_external_ids text[]
)
returns table(deleted_accounts integer, deleted_transactions integer)
language plpgsql
as $$
declare
    v_account_ids text[] := array[]::text[];
begin
    if p_account_external_ids is not null and array_length(p_account_external_ids, 1) > 0 then
        select coalesce(array_agg(id), array[]::text[])
        into v_account_ids
        from public.accounts
        where user_id = p_user_id
          and provider = 'plaid'
          and external_account_id = any (p_account_external_ids);
    end if;

    deleted_transactions := 0;
    deleted_accounts := 0;

    if array_length(v_account_ids, 1) > 0 then
        delete from public.transactions
        where user_id = p_user_id
          and account_id = any (v_account_ids);
        get diagnostics deleted_transactions = row_count;

        delete from public.accounts
        where user_id = p_user_id
          and id = any (v_account_ids);
        get diagnostics deleted_accounts = row_count;
    end if;

    delete from public.plaid_items
    where user_id = p_user_id
      and id = p_plaid_item_id;

    return query select deleted_accounts, deleted_transactions;
end;
$$;
