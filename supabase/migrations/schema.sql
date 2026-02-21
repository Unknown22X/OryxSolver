-- Function to find similar questions using vector similarity
create or replace function match_questions (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  question_text text,
  answer text,
  similarity float
)
language sql stable
as $$
select
    questions_cache.id,
    questions_cache.question_text,
    questions_cache.answer,
    1 - (questions_cache.embedding <=> query_embedding) as similarity
from questions_cache
where 1 - (questions_cache.embedding <=> query_embedding) > match_threshold
order by similarity desc
    limit match_count;
$$;
-- Function to increment daily question count
create or replace function increment_questions_asked(target_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
update public.profiles
set questions_asked_today = questions_asked_today + 1
where id = target_user_id;
end;
$$;