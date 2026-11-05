-- Excel içe aktarma senaryoları ve kullanıcı izolasyonu (RLS) testi.
-- Supabase SQL Editor'de çalıştırın. İki geçici kullanıcı oluşturur, senaryoları çalıştırır ve
-- sonunda kasıtlı olarak hata fırlatır; böylece tüm test verileri geri alınır.
-- Sonuç, hata mesajında "TEST_RESULT" başlığıyla görünür.
do $$
declare
  ua uuid := gen_random_uuid();
  ub uuid := gen_random_uuid();
  b1 uuid; b2 uuid; b3 uuid;
  r1 jsonb; r2 jsonb; r3 jsonb;
  rec record;
  out text := '';
  vis int;
begin
  insert into auth.users (id, email, aud, role) values
    (ua, 'test-a@example.invalid', 'authenticated', 'authenticated'),
    (ub, 'test-b@example.invalid', 'authenticated', 'authenticated');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);

  -- 1. yükleme: üç yeni istek ve bir hatalı satır
  insert into public.import_batches (owner_id, file_name, file_hash, file_size) values (ua, 't1.xlsx', repeat('a', 64), 1) returning id into b1;
  insert into public.import_batch_rows (owner_id, batch_id, row_number, external_no, data, source_hash, content_hash, action) values
    (ua, b1, 3, '1001', '{"subject":"S1","description":"D1"}', 'a1', 'c1', 'new'),
    (ua, b1, 4, '1002', '{"subject":"S2","description":"D2"}', 'a2', 'c2', 'new'),
    (ua, b1, 5, '1003', '{"subject":"S3","description":"D3"}', 'a3', 'c3', 'new'),
    (ua, b1, 6, null, '{}', null, null, 'invalid');
  r1 := public.apply_import_batch(b1);

  update public.requests set ai_status = 'done', user_notes = 'notum' where external_no = '1001';
  update public.requests set status = 'completed', completed_at = now(), closing_message = 'bitti' where external_no = '1002';
  update public.requests set deleted_at = now() where external_no = '1003';

  -- 2. yükleme: içerik güncellemesi, tamamlanmış istekte değişiklik, silinmiş isteğin geri gelmesi, yeni istek
  insert into public.import_batches (owner_id, file_name, file_hash, file_size) values (ua, 't2.xlsx', repeat('b', 64), 1) returning id into b2;
  insert into public.import_batch_rows (owner_id, batch_id, row_number, external_no, data, source_hash, content_hash, action) values
    (ua, b2, 3, '1001', '{"subject":"S1","description":"D1 degisti"}', 'a1x', 'c1x', 'update'),
    (ua, b2, 4, '1002', '{"subject":"S2","description":"D2","tracked_by":"X"}', 'a2x', 'c2', 'update'),
    (ua, b2, 5, '1003', '{"subject":"S3","description":"D3"}', 'a3', 'c3', 'restore'),
    (ua, b2, 6, '1004', '{"subject":"S4","description":"D4"}', 'a4', 'c4', 'new');
  r2 := public.apply_import_batch(b2);

  -- 3. yükleme: aynı içerik tekrar → hepsi değişmemiş
  insert into public.import_batches (owner_id, file_name, file_hash, file_size) values (ua, 't3.xlsx', repeat('b', 64), 1) returning id into b3;
  insert into public.import_batch_rows (owner_id, batch_id, row_number, external_no, data, source_hash, content_hash, action)
    select ua, b3, v.row_number, v.external_no, v.data, v.source_hash, v.content_hash, 'unchanged' from (values
      (3, '1001', '{"subject":"S1","description":"D1 degisti"}'::jsonb, 'a1x', 'c1x'),
      (4, '1002', '{"subject":"S2","description":"D2","tracked_by":"X"}'::jsonb, 'a2x', 'c2'),
      (5, '1003', '{"subject":"S3","description":"D3"}'::jsonb, 'a3', 'c3'),
      (6, '1004', '{"subject":"S4","description":"D4"}'::jsonb, 'a4', 'c4')) v(row_number, external_no, data, source_hash, content_hash);
  r3 := public.apply_import_batch(b3);

  out := 'R1=' || r1::text || E'\nR2=' || r2::text || E'\nR3=' || r3::text;
  for rec in select external_no, status, ai_status, user_notes, deleted_at is null as active, closing_message from public.requests order by external_no loop
    out := out || E'\n' || rec.external_no || ' status=' || rec.status || ' ai=' || rec.ai_status
      || ' notes=' || coalesce(rec.user_notes, '-') || ' active=' || rec.active || ' closing=' || coalesce(rec.closing_message, '-');
  end loop;
  out := out || E'\nevents=' || (select string_agg(event_type, ',' order by event_type) from public.request_events);
  out := out || E'\nleftover_batch_rows=' || (select count(*) from public.import_batch_rows);

  -- Kullanıcı B, A'nın hiçbir kaydını göremez ve değiştiremez.
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  select count(*) into vis from public.requests;
  out := out || E'\nB_visible_requests=' || vis;
  begin
    perform public.apply_import_batch(b2);
    out := out || ' B_apply=ALLOWED';
  exception when others then
    out := out || ' B_apply_blocked=' || sqlerrm;
  end;
  update public.requests set status = 'open' where external_no = '1002';
  get diagnostics vis = row_count;
  out := out || ' B_update_rows=' || vis;
  begin
    insert into public.requests (owner_id, external_no, source_hash, content_hash) values (ua, '9999', 'x', 'y');
    out := out || ' B_insert_as_A=ALLOWED';
  exception when others then
    out := out || ' B_insert_as_A_blocked=' || sqlerrm;
  end;

  raise exception 'TEST_RESULT%', E'\n' || out;
end $$;

-- Beklenen sonuç:
-- R1: new=3            R2: new=1, updated=2, restored=1, completed_changed=1      R3: unchanged=4
-- 1001 status=open ai=stale notes=notum     (içerik değişti, analiz güncelliğini yitirdi, not korundu)
-- 1002 status=completed closing=bitti       (tamamlanmış istek otomatik açılmadı)
-- 1003 status=open active=true              (silinmiş istek geri getirildi)
-- leftover_batch_rows=0
-- B_visible_requests=0 B_apply_blocked=batch_not_found B_update_rows=0 B_insert_as_A_blocked=...row-level security...
