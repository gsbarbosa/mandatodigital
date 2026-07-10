-- Vincula feedback de produto ao dono da conta (Firebase owner_user_id).

alter table if exists product_feedback
  add column if not exists owner_user_id text not null default '';

create index if not exists product_feedback_owner_user_id_idx
  on product_feedback(owner_user_id);
