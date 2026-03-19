ALTER TABLE public.history_entries 
ADD COLUMN image_urls text[] DEFAULT '{}',
ADD COLUMN is_bulk boolean DEFAULT false;
;
