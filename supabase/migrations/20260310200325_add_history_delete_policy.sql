CREATE POLICY "history_entries_delete_own" 
ON public.history_entries FOR DELETE 
USING (user_id = (auth.jwt() ->> 'sub'));;
