CREATE TABLE public.telegram_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id bigint NOT NULL UNIQUE,
  chat_id bigint,
  chat_title text,
  chat_type text,
  message_thread_id bigint,
  from_id bigint,
  from_name text,
  from_username text,
  text text,
  kind text NOT NULL DEFAULT 'message',
  status text NOT NULL DEFAULT 'new',
  raw jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_updates_created_at ON public.telegram_updates (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_updates TO anon, authenticated;
GRANT ALL ON public.telegram_updates TO service_role;
ALTER TABLE public.telegram_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workbench can read updates" ON public.telegram_updates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Workbench can update updates" ON public.telegram_updates FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Workbench can delete updates" ON public.telegram_updates FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE public.telegram_api_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method text NOT NULL,
  request jsonb,
  response jsonb,
  ok boolean NOT NULL DEFAULT false,
  status_code int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_api_log_created_at ON public.telegram_api_log (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_api_log TO anon, authenticated;
GRANT ALL ON public.telegram_api_log TO service_role;
ALTER TABLE public.telegram_api_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workbench can read api log" ON public.telegram_api_log FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Workbench can delete api log" ON public.telegram_api_log FOR DELETE TO anon, authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.telegram_updates;