create table if not exists public.video_render_analytics (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  user_email text,
  client_name text,
  object_type text,
  scene_description text,
  resolution text,
  duration_seconds integer,
  inspiration_used boolean default false,
  status text not null,
  error_message text,
  generation_time_ms integer,
  video_url text,
  poster_url text,
  downloaded boolean default false,
  saved_to_library boolean default false,
  saved_asset_id uuid
);

create index if not exists video_render_analytics_user_created_idx
  on public.video_render_analytics (user_id, created_at desc);

create or replace function public.handle_video_render_analytics_updated()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists video_render_analytics_updated on public.video_render_analytics;

create trigger video_render_analytics_updated
before update on public.video_render_analytics
for each row
execute function public.handle_video_render_analytics_updated();

