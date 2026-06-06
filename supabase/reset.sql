-- Zera dados da aplicacao (mantem schema, buckets e politicas).
-- Rode no SQL Editor do Supabase com cuidado: operacao destrutiva.

truncate table
  evaluation_scores,
  evaluation_candidates,
  evaluation_runs,
  content_feedback,
  generated_contents,
  content_requests,
  product_feedback,
  avatar_video_generations,
  profile_avatar_trainings,
  profile_training_assets,
  mandate_workflow_configs,
  politician_profiles
restart identity cascade;

-- Opcional: remover usuarios de autenticacao (descomente se quiser estado "primeiro deploy").
-- delete from auth.users;
