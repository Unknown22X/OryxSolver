-- Add extraction quality columns to solve_runs for Admin Monitoring
ALTER TABLE public.solve_runs 
ADD COLUMN IF NOT EXISTS extraction_qa_warnings text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS original_question text;

-- Add comment for documentation
COMMENT ON COLUMN public.solve_runs.extraction_qa_warnings IS 'List of QA warnings from mathCleanup utility';
COMMENT ON COLUMN public.solve_runs.original_question IS 'The raw question before normalization';
