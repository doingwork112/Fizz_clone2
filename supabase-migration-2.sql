-- Allow users to delete their own sent messages (for recall feature)
create policy "messages_delete" on public.messages for delete using (auth.uid() = from_user_id);
