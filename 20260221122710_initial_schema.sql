-- Enable the pgvector extension to work with embeddings
create extension if not exists vector;

-- Set up the profiles table to manage user info and limits
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  subscription_tier text default 'free', -- 'free' or 'pro'
  subscription_status text default 'inactive', -- 'active', 'canceled', etc.
  polar_customer_id text, -- To link with Polar.sh
  questions_asked_today int default 0,
  credits_balance int default 0,
  last_question_date date default CURRENT_DATE,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS) for profiles
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using ( auth.uid() = id );

create policy "Users can update own profile"
  on public.profiles for update
  using ( auth.uid() = id );

-- Function to handle new user creation from Auth
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

-- Trigger to automatically create profile when auth.user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Set up the questions_cache table
create table public.questions_cache (
  id uuid default gen_random_uuid() primary key,
  question_text text not null,
  embedding vector(768), -- Dimensions depend on your embedding model, 768 is common
  answer text,
  steps jsonb, -- Storing step-by-step as JSON array
  hit_count int default 1, -- How many times this was asked
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_accessed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for cache (everyone can read, only service role can write)
alter table public.questions_cache enable row level security;

create policy "Anyone can view cached questions"
  on public.questions_cache for select
  using ( true );

-- Function to update last_accessed_at and hit_count
create function update_cache_hit(cache_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.questions_cache
  set hit_count = hit_count + 1,
      last_accessed_at = now()
  where id = cache_id;
end;
$$;

-- Subscriptions table (optional, if you want a detailed log, but profiles usually enough for status)
create table public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  polar_subscription_id text not null,
  status text,
  current_period_end timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.subscriptions enable row level security;

create policy "Users can view own subscriptions"
  on public.subscriptions for select
  using ( auth.uid() = user_id );
