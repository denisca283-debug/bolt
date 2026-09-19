import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('production network: full replay, casting, guardians, graph, education and referral security',async t=>{
 const db=new PGlite();const q=async(s,a=[]) => { if(process.env.FILMVERSE_SQL_TRACE)console.error(s.slice(0,140));return (await db.query(s,a)).rows; };
 const scalar=async(s,a=[])=>Object.values((await q(s,a))[0])[0];
 const as=async(id,role='authenticated')=>{await db.exec('RESET ROLE');await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('SET ROLE '+role);};
 const denied=(s,a=[])=>assert.rejects(q(s,a),e=>e.code==='42501');
 const [a,b,c,d]=[1,2,3,4].map(n=>'40000000-0000-4000-8000-00000000000'+n);
 try{
 await db.exec(`CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN BYPASSRLS;
 CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);CREATE TABLE storage.objects(id uuid PRIMARY KEY,name text,bucket_id text);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;GRANT USAGE ON SCHEMA storage TO anon,authenticated;GRANT SELECT,INSERT,DELETE ON storage.objects TO anon,authenticated;
 CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1,'/') $$;
 GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;CREATE PUBLICATION supabase_realtime;`);
 const dir=new URL('../supabase/migrations/',import.meta.url);for(const f of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort()){if(process.env.FILMVERSE_SQL_TRACE)console.error(f);await db.exec(await readFile(new URL(f,dir),'utf8'));}
 for(const id of [a,b,c,d]){await q('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[id,id+'@test.invalid']);await q("INSERT INTO profiles(id,full_name,public_slug,city) VALUES($1,$2,$3,'Москва')",[id,'Person '+id,'person-'+id]);}

 let minor,subject,guardian,org,project,role,candidate,minorWork;
 const grant=async(id,names)=>{await db.exec('RESET ROLE');await q('INSERT INTO user_permissions(user_id,permission_id) SELECT $1,id FROM permissions WHERE name=ANY($2) ON CONFLICT DO NOTHING',[id,names]);};
 await t.test('Young Talent is not an account; pending guardian cannot publish; neither guest nor PRO buys access',async()=>{
  await as(a);minor=await scalar("SELECT minor_create('Young performer','parent')");subject=await scalar('SELECT id FROM casting_subjects WHERE minor_talent_id=$1',[minor]);guardian=await scalar('SELECT id FROM minor_guardians WHERE minor_talent_id=$1',[minor]);
  assert.equal(await scalar('SELECT count(*)::int FROM profiles'),4);
  assert.equal((await q("UPDATE minor_talent_profiles SET bio='Private draft details' WHERE id=$1 RETURNING id",[minor])).length,1);
  await denied('UPDATE minor_talent_profiles SET discoverable=true WHERE id=$1 RETURNING id',[minor]);
  await denied('SELECT created_by FROM minor_talent_profiles');
  await denied("UPDATE minor_guardians SET status='approved' WHERE id=$1",[guardian]);
  await denied('SELECT * FROM filmverse_private.minor_talent_private');
  await denied("INSERT INTO minor_media(minor_talent_id,object_path,media_type,sanitized_at) VALUES($1,'fake-sanitized.jpg','image',now())",[minor]);
  await as(b);await denied('SELECT young_talent_search()');
  await as(null,'anon');await denied('SELECT id FROM minor_talent_profiles');await denied('SELECT young_talent_search()');
  await grant(a,['review_guardianship']);await as(a);await denied("SELECT guardianship_review($1,true,'Examined original authority',now()+interval '1 month')",[guardian]);
  await grant(d,['review_guardianship','search_minor_talent','publish_minor_opportunity','review_minor_opportunity']);await as(d);
  await q("SELECT guardianship_review($1,true,'Examined original authority',now()+interval '1 month')",[guardian]);
  await as(a);await q('UPDATE minor_talent_profiles SET discoverable=true WHERE id=$1',[minor]);
  await as(d);assert.equal((await scalar('SELECT young_talent_search()'))[0].id,minor);
  assert.equal('created_by' in (await scalar('SELECT young_talent_search()'))[0],false);
  await denied("INSERT INTO storage.objects(id,name,bucket_id) VALUES($1,'unsafe-exif.jpg','minor-media')",[crypto.randomUUID()]);
 });
 await t.test('canonical application keeps child subject separate; consent cannot be borrowed; opportunity requires independent review',async()=>{
  await grant(b,['publish_minor_opportunity','search_minor_talent']);
  await as(b);project=await scalar("INSERT INTO projects(title) VALUES('Network film') RETURNING id");
  await denied("INSERT INTO work_opportunities(title,type,audience,project_id,minor_opportunity,minor_responsible_adult) VALUES('Unaccepted role','casting','actors',$1,true,$2)",[project,b]);
  await db.exec('RESET ROLE');
  await q("INSERT INTO minor_project_responsibilities(project_id,adult_user_id,policy_version,reviewed_by,valid_until) VALUES($1,$2,'v1',$3,now()+interval '1 month')",[project,b,d]);
  await as(b);await q("SELECT minor_responsibility_accept($1,'v1')",[project]);
  const work=await scalar("INSERT INTO work_opportunities(title,type,audience,project_id,minor_opportunity,minor_responsible_adult) VALUES('Young role','casting','actors',$1,true,$2) RETURNING id",[project,b]);
  minorWork=work;
  await as(a);await denied('INSERT INTO work_applications(work_id,casting_subject_id) VALUES($1,$2)',[work,subject]);
  await as(d);await q('SELECT minor_opportunity_review($1)',[work]);
  await as(a);await q("INSERT INTO minor_project_consents(casting_subject_id,project_id,scope,terms_version,expires_at) VALUES($1,$2,'application','v1',now()+interval '1 week')",[subject,project]);
  const application=await scalar('INSERT INTO work_applications(work_id,casting_subject_id) VALUES($1,$2) RETURNING id',[work,subject]);
  assert.equal(await scalar('SELECT submitted_by FROM work_applications WHERE id=$1',[application]),a);
  await as(c);await denied('INSERT INTO work_applications(work_id,casting_subject_id) VALUES($1,$2)',[work,subject]);
  await as(b);role=await scalar("INSERT INTO casting_roles(project_id,title) VALUES($1,'Lead') RETURNING id",[project]);
  candidate=await scalar("INSERT INTO role_candidates(role_id,casting_subject_id,application_id,source) VALUES($1,$2,$3,'application') RETURNING id",[role,subject,application]);
  await denied("SELECT casting_share_create($1,$2,now()+interval '1 day')",[project,[candidate]]);
  await as(a);await q('UPDATE minor_project_consents SET revoked_at=now() WHERE casting_subject_id=$1',[subject]);
  await as(b);const role2=await scalar("INSERT INTO casting_roles(project_id,title) VALUES($1,'Second role') RETURNING id",[project]);
  await denied("INSERT INTO role_candidates(role_id,casting_subject_id,source) VALUES($1,$2,'search')",[role2,subject]);
 });
 await t.test('casting scopes notes, roles, ensembles and selected-only expiring share without contacts',async()=>{
  await as(b);const adult=await scalar('SELECT id FROM casting_subjects WHERE adult_user_id=$1',[c]);
  const adultCandidate=await scalar("INSERT INTO role_candidates(role_id,casting_subject_id,source) VALUES($1,$2,'search') RETURNING id",[role,adult]);
  await q("INSERT INTO casting_reviewer_notes(candidate_id,body) VALUES($1,'Private reasoning')",[adultCandidate]);
  await q("INSERT INTO casting_comments(candidate_id,body) VALUES($1,'Shared casting context')",[adultCandidate]);
  const shared=await scalar("SELECT casting_share_create($1,$2,now()+interval '1 day')",[project,[adultCandidate]]);
  await as(null,'anon');const rows=await scalar('SELECT casting_share_read($1)',[shared.token]);assert.equal(rows.length,1);assert.equal(rows[0].candidate_id,adultCandidate);assert.deepEqual(Object.keys(rows[0]).sort(),['candidate_id','name','role']);
  await denied('SELECT * FROM casting_comments');await denied('SELECT * FROM filmverse_private.casting_share_keys');
  await as(c);assert.equal(await scalar('SELECT count(*)::int FROM casting_reviewer_notes'),0);assert.equal(await scalar('SELECT count(*)::int FROM casting_roles'),0);
  await denied("INSERT INTO casting_roles(project_id,title) VALUES($1,'Unrelated')",[project]);
  await as(b);await q('SELECT casting_share_revoke($1)',[shared.id]);
  await as(null,'anon');assert.equal((await scalar('SELECT casting_share_read($1)',[shared.token])).length,0);
 });
 await t.test('reviewed search is not contact authority; contextual guardian invitation precedes candidate activation',async()=>{
  await as(d);await denied('SELECT minor_contact($1)',[subject]);await denied('SELECT minor_contact($1,$2,$3)',[subject,role,minorWork]);
  await as(b);const inviteRole=await scalar("INSERT INTO casting_roles(project_id,title) VALUES($1,'Invitation role') RETURNING id",[project]);
  const invitation=await scalar('SELECT minor_contact($1,$2,$3)',[subject,inviteRole,minorWork]);
  assert.equal(await scalar('SELECT count(*)::int FROM role_candidates WHERE role_id=$1',[inviteRole]),0);
  await denied("INSERT INTO role_candidates(role_id,casting_subject_id,source) VALUES($1,$2,'invitation')",[inviteRole,subject]);
  await as(c);await denied("SELECT minor_invitation_respond($1,true,'invite-v2',now()+interval '1 week')",[invitation]);
  await as(a);await q("SELECT minor_invitation_respond($1,true,'invite-v2',now()+interval '1 week')",[invitation]);
  await as(b);await q("INSERT INTO role_candidates(role_id,casting_subject_id,source) VALUES($1,$2,'invitation')",[inviteRole,subject]);
  await db.exec('RESET ROLE');await q("INSERT INTO project_members(project_id,user_id,status) VALUES($1,$2,'active')",[project,c]);
  await as(c);await denied("INSERT INTO casting_roles(project_id,title) VALUES($1,'Unrelated member')",[project]);
  await db.exec('RESET ROLE');await q("INSERT INTO project_casting_authorities(project_id,user_id,permission,granted_by) VALUES($1,$2,'manage_candidates',$3)",[project,c,b]);
  await as(c);assert.equal(await scalar("SELECT filmverse_private.project_casting_can($1,'manage_candidates')",[project]),true);
  assert.equal(await scalar("SELECT filmverse_private.project_casting_can($1,'approve_cast')",[project]),false);
  const visibleCandidate=await scalar('SELECT id FROM role_candidates WHERE casting_subject_id=(SELECT id FROM casting_subjects WHERE adult_user_id=$1)',[c]);
  await denied("UPDATE role_candidates SET status='approved' WHERE id=$1",[visibleCandidate]);
  await denied("SELECT casting_share_create($1,$2,now()+interval '1 day')",[project,[candidate]]);
  await denied('SELECT minor_contact($1,$2,$3)',[subject,role,minorWork]);
 });
 await t.test('minor invitations expire and revalidate role, original context, guardian and responsibility before acceptance',async()=>{
  const scenarios=[
   ['expired',async(id)=>q("UPDATE minor_casting_invitations SET created_at=created_at-interval '31 days',expires_at=expires_at-interval '31 days',responded_at=responded_at-interval '31 days' WHERE id=$1",[id])],
   ['closed role',async(id,r)=>q("UPDATE casting_roles SET status='closed' WHERE id=$1",[r])],
   ['revoked guardian',async()=>q("UPDATE minor_guardians SET status='revoked' WHERE id=$1",[guardian])],
   ['changed opportunity',async()=>q("UPDATE work_opportunities SET title='Changed safeguards' WHERE id=$1",[minorWork])],
   ['removed review',async()=>q('DELETE FROM filmverse_private.minor_opportunity_reviews WHERE work_id=$1',[minorWork])],
   ['revoked responsible adult',async()=>q('UPDATE minor_project_responsibilities SET revoked_at=now() WHERE project_id=$1',[project])],
   ['changed role project',async(id,r)=>{const other=await scalar("INSERT INTO projects(user_id,title) VALUES($1,'Different project') RETURNING id",[b]);await q('UPDATE casting_roles SET project_id=$1 WHERE id=$2',[other,r]);}],
  ];
  for(const [label,mutate] of scenarios){
   await as(b);const r=await scalar('INSERT INTO casting_roles(project_id,title) VALUES($1,$2) RETURNING id',[project,'Invitation '+label]);
   const id=await scalar('SELECT minor_contact($1,$2,$3)',[subject,r,minorWork]);
   assert.equal(await scalar("SELECT expires_at IS NOT NULL AND expires_at<=created_at+interval '30 days' FROM minor_casting_invitations WHERE id=$1",[id]),true);
   await db.exec('RESET ROLE; BEGIN');
   try{await mutate(id,r);await as(a);await denied("SELECT minor_invitation_respond($1,true,'v3',now()+interval '1 week')",[id]);}
   finally{await db.exec('ROLLBACK; RESET ROLE');}
   assert.equal(await scalar('SELECT status FROM minor_casting_invitations WHERE id=$1',[id]),'pending',label);
  }
  await as(b);const r=await scalar("INSERT INTO casting_roles(project_id,title) VALUES($1,'Current invitation') RETURNING id",[project]);
  const id=await scalar('SELECT minor_contact($1,$2,$3)',[subject,r,minorWork]);
  await denied("UPDATE minor_casting_invitations SET expires_at=now()+interval '1 year' WHERE id=$1",[id]);
  await db.exec('RESET ROLE');await assert.rejects(q("UPDATE minor_casting_invitations SET expires_at=created_at+interval '31 days' WHERE id=$1",[id]),e=>e.code==='23514');
  await as(a);await denied("SELECT minor_invitation_respond($1,true,'v3',now()+interval '91 days')",[id]);
  await q("SELECT minor_invitation_respond($1,true,'v3',now()+interval '1 week')",[id]);
  for(const [label,mutate] of scenarios){
   await as(b);
   await db.exec('RESET ROLE; BEGIN');
   try{
    await mutate(id,r);await as(b);
    if(label==='expired')assert.equal((await q("INSERT INTO role_candidates(role_id,casting_subject_id,source) VALUES($1,$2,'invitation') RETURNING id",[r,subject])).length,1);
    else await denied("INSERT INTO role_candidates(role_id,casting_subject_id,source) VALUES($1,$2,'invitation')",[r,subject]);
   }
   finally{await db.exec('ROLLBACK; RESET ROLE');}
  }
  await as(b);await q("INSERT INTO role_candidates(role_id,casting_subject_id,source) VALUES($1,$2,'invitation')",[r,subject]);
 });
 await t.test('expired pending invitation reissues a new episode, preserves immutable history and never bypasses a decline',async()=>{
  await as(b);const r=await scalar("INSERT INTO casting_roles(project_id,title) VALUES($1,'Reissue role') RETURNING id",[project]);
  const first=await scalar('SELECT minor_contact($1,$2,$3)',[subject,r,minorWork]);
  await db.exec('RESET ROLE');await q("UPDATE minor_casting_invitations SET created_at=created_at-interval '31 days',expires_at=expires_at-interval '31 days' WHERE id=$1",[first]);
  const prior=(await q('SELECT * FROM minor_casting_invitations WHERE id=$1',[first]))[0];
  await as(a);await denied("SELECT minor_invitation_respond($1,true,'reissue-v1',now()+interval '1 week')",[first]);
  await as(b);const second=await scalar('SELECT minor_contact($1,$2,$3)',[subject,r,minorWork]);assert.notEqual(first,second);
  assert.equal(await scalar('SELECT minor_contact($1,$2,$3)',[subject,r,minorWork]),second);
  assert.equal(await scalar("SELECT count(*)::int FROM minor_casting_invitations WHERE role_id=$1 AND status='pending'",[r]),1);
  assert.deepEqual((await q('SELECT * FROM minor_casting_invitations WHERE id=$1',[first]))[0],{...prior,status:'expired'});
  await db.exec('RESET ROLE');
  await assert.rejects(q('DELETE FROM minor_casting_invitations WHERE id=$1',[first]),e=>e.code==='23514');
  await assert.rejects(q("UPDATE minor_casting_invitations SET status='pending' WHERE id=$1",[first]),e=>e.code==='23514');
  await as(a);await q("SELECT minor_invitation_respond($1,false,NULL,NULL)",[second]);
  const declined=(await q('SELECT * FROM minor_casting_invitations WHERE id=$1',[second]))[0];
  await as(b);await denied('SELECT minor_contact($1,$2,$3)',[subject,r,minorWork]);await denied('SELECT minor_contact($1,$2,$3)',[subject,r,minorWork]);
  assert.equal(await scalar('SELECT count(*)::int FROM minor_casting_invitations WHERE role_id=$1',[r]),2);
  assert.deepEqual((await q('SELECT * FROM minor_casting_invitations WHERE id=$1',[second]))[0],declined);
 });
 await t.test('accepted candidate outlives invitation deadline but every later mutation revalidates consent, guardian and context',async()=>{
  await as(b);const r=await scalar("INSERT INTO casting_roles(project_id,title) VALUES($1,'Long lived candidate') RETURNING id",[project]);
  const invitation=await scalar('SELECT minor_contact($1,$2,$3)',[subject,r,minorWork]);
  await as(a);await q("SELECT minor_invitation_respond($1,true,'long-lived',now()+interval '60 days')",[invitation]);
  await db.exec('RESET ROLE');await q("UPDATE minor_casting_invitations SET created_at=created_at-interval '31 days',expires_at=expires_at-interval '31 days',responded_at=responded_at-interval '31 days' WHERE id=$1",[invitation]);
  await as(b);assert.equal(await scalar('SELECT minor_contact($1,$2,$3)',[subject,r,minorWork]),invitation);
  const id=await scalar("INSERT INTO role_candidates(role_id,casting_subject_id,source) VALUES($1,$2,'invitation') RETURNING id",[r,subject]);
  assert.equal((await q("UPDATE role_candidates SET status='shortlist' WHERE id=$1 RETURNING id",[id])).length,1);
  const changes=[
   async()=>q('UPDATE minor_project_consents SET revoked_at=now() WHERE casting_subject_id=$1 AND project_id=$2',[subject,project]),
   async()=>q("UPDATE minor_project_consents SET granted_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE casting_subject_id=$1 AND project_id=$2",[subject,project]),
   async()=>q("UPDATE minor_guardians SET status='revoked' WHERE id=$1",[guardian]),
   async()=>q("UPDATE work_opportunities SET title='Changed long-lived terms' WHERE id=$1",[minorWork]),
   async()=>q('DELETE FROM filmverse_private.minor_opportunity_reviews WHERE work_id=$1',[minorWork]),
   async()=>q('UPDATE minor_project_responsibilities SET revoked_at=now() WHERE project_id=$1',[project]),
   async()=>q("UPDATE casting_roles SET status='closed' WHERE id=$1",[r]),
   async()=>{const other=await scalar("INSERT INTO projects(user_id,title) VALUES($1,'Moved role project') RETURNING id",[b]);await q('UPDATE casting_roles SET project_id=$1 WHERE id=$2',[other,r]);},
  ];
  for(const mutate of changes){
   await as(b);await db.exec('RESET ROLE; BEGIN');
   try{
    await mutate();await as(b);
    // Historical visibility never authorizes active progression after authority loss.
    await db.exec('SAVEPOINT pipeline');
    try{assert.equal((await q("UPDATE role_candidates SET status='audition' WHERE id=$1 RETURNING id",[id])).length,0);}
    catch(e){if(e.code!=='42501')throw e;await db.exec('ROLLBACK TO pipeline');}
    await db.exec('SAVEPOINT tags');
    try{assert.equal((await q("UPDATE role_candidates SET project_tags=ARRAY['forbidden'] WHERE id=$1 RETURNING id",[id])).length,0);}
    catch(e){if(e.code!=='42501')throw e;await db.exec('ROLLBACK TO tags');}
    await db.exec('RESET ROLE');assert.equal(await scalar('SELECT status FROM role_candidates WHERE id=$1',[id]),'shortlist');
    assert.deepEqual(await scalar('SELECT project_tags FROM role_candidates WHERE id=$1',[id]),[]);
   }finally{await db.exec('ROLLBACK; RESET ROLE');}
  }
  await as(b);assert.equal((await q("UPDATE role_candidates SET project_tags=ARRAY['current consent'] WHERE id=$1 RETURNING id",[id])).length,1);
 });
 await t.test('all minor candidate sources revalidate active authority while retaining private history and safe closure',async sub=>{
  const activeStatuses=['review','shortlist','audition','hold','approved','backup'];
  for(const source of ['application','invitation','search']){
   await as(b);let id=candidate;let r=role;
   if(source!=='application'){
    r=await scalar('INSERT INTO casting_roles(project_id,title) VALUES($1,$2) RETURNING id',[project,'Safety '+source]);
    const invitation=await scalar('SELECT minor_contact($1,$2,$3)',[subject,r,minorWork]);
    await as(a);await q("SELECT minor_invitation_respond($1,true,$2,now()+interval '1 week')",[invitation,'safety-'+source]);
    await as(b);id=await scalar('INSERT INTO role_candidates(role_id,casting_subject_id,source) VALUES($1,$2,$3) RETURNING id',[r,subject,source]);
   }
   await sub.test(source+': valid current authority permits the pipeline',async()=>{
    for(const status of activeStatuses)assert.equal((await q('UPDATE role_candidates SET status=$2 WHERE id=$1 RETURNING id',[id,status])).length,1);
    await q("UPDATE role_candidates SET status='review' WHERE id=$1",[id]);
    await denied('UPDATE role_candidates SET minor_application_project_id=$2 WHERE id=$1',[id,project]);
    await denied("UPDATE role_candidates SET source='search',application_id=NULL WHERE id=$1",[id]);
    await denied('SELECT filmverse_private.minor_casting_consent_current($1,$2,$3)',[subject,project,a]);
   });
   const changes=[
    ['guardian revokes project consent',async()=>{await as(a);await q('UPDATE minor_project_consents SET revoked_at=now() WHERE casting_subject_id=$1 AND project_id=$2',[subject,project]);}],
    ['expired consent',async()=>q("UPDATE minor_project_consents SET granted_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE casting_subject_id=$1 AND project_id=$2",[subject,project])],
    ['revoked guardian',async()=>{await as(d);await q("SELECT guardianship_review($1,false,'Authority is no longer valid',NULL)",[guardian]);}],
    ['expired guardian',async()=>q("UPDATE minor_guardians SET reviewed_at=now()-interval '2 days',valid_until=now()-interval '1 day' WHERE id=$1",[guardian])],
    ['removed opportunity review',async()=>q('DELETE FROM filmverse_private.minor_opportunity_reviews WHERE work_id=$1',[minorWork])],
    ['changed opportunity even after independent re-review',async()=>{await q("UPDATE work_opportunities SET title='Different reviewed safety terms' WHERE id=$1",[minorWork]);await as(d);await q('SELECT minor_opportunity_review($1)',[minorWork]);}],
    ['revoked responsible adult',async()=>q('UPDATE minor_project_responsibilities SET revoked_at=now() WHERE project_id=$1',[project])],
    ['expired responsible adult',async()=>q("UPDATE minor_project_responsibilities SET reviewed_at=now()-interval '2 days',valid_until=now()-interval '1 day' WHERE project_id=$1",[project])],
    ['closed role',async()=>q("UPDATE casting_roles SET status='closed' WHERE id=$1",[r])],
    ['changed role project',async()=>{const other=await scalar("INSERT INTO projects(user_id,title) VALUES($1,'Unrelated safety context') RETURNING id",[b]);await q('UPDATE casting_roles SET project_id=$1 WHERE id=$2',[other,r]);}],
   ];
   // Capture the application ID in the casting context; the guardian has no candidate SELECT grant.
   const applicationId=await scalar('SELECT application_id FROM role_candidates WHERE id=$1',[id]);
   if(source==='application')changes.push(['withdrawn application',async()=>{await as(a);await q("UPDATE work_applications SET status='withdrawn' WHERE id=$1",[applicationId]);}]);
   for(const [label,mutate] of changes)await sub.test(source+': '+label+' denies progression but allows status-only rejection',async()=>{
    await db.exec('RESET ROLE; BEGIN');
    try{
     await mutate();await as(b);
     const before=(await q('SELECT * FROM role_candidates WHERE id=$1',[id]))[0];assert.ok(before,'authorized historical candidate remains readable');
     if(applicationId)assert.equal((await q('SELECT id FROM work_applications WHERE id=$1',[applicationId])).length,1);
     for(const status of [...activeStatuses,'new']){
      await db.exec('SAVEPOINT denied_progress');
      await denied('UPDATE role_candidates SET status=$2 WHERE id=$1 RETURNING id',[id,status]);
      await db.exec('ROLLBACK TO denied_progress');
     }
     await db.exec('SAVEPOINT denied_tags');
     await denied("UPDATE role_candidates SET status='rejected',project_tags=ARRAY['not closure'] WHERE id=$1 RETURNING id",[id]);
     await db.exec('ROLLBACK TO denied_tags');
     await db.exec('RESET ROLE');const consents=await q('SELECT * FROM minor_project_consents WHERE casting_subject_id=$1 ORDER BY id',[subject]);
     await as(b);assert.equal((await q("UPDATE role_candidates SET status='rejected' WHERE id=$1 RETURNING id",[id])).length,1);
     assert.deepEqual((await q('SELECT * FROM role_candidates WHERE id=$1',[id]))[0],{...before,status:'rejected'});
     await db.exec('SAVEPOINT denied_reopen');await denied("UPDATE role_candidates SET status='review' WHERE id=$1 RETURNING id",[id]);await db.exec('ROLLBACK TO denied_reopen');
     await db.exec('RESET ROLE');assert.deepEqual(await q('SELECT * FROM minor_project_consents WHERE casting_subject_id=$1 ORDER BY id',[subject]),consents,'rejection never fabricates or revives consent');
     await as(d);assert.equal((await q('SELECT id FROM role_candidates WHERE id=$1',[id])).length,0,'search permission is not historical casting authority');
     assert.equal((await q("UPDATE role_candidates SET status='rejected' WHERE id=$1 RETURNING id",[id])).length,0);
    }finally{await db.exec('ROLLBACK; RESET ROLE');}
   });
  }
 });
 await t.test('revoked minor history is available only to authorized casting context; guardian can still withdraw',async()=>{
  await db.exec('RESET ROLE; BEGIN');
  try{
   await q("UPDATE minor_guardians SET status='revoked' WHERE id=$1",[guardian]);
   await q("UPDATE project_casting_authorities SET revoked_at=now() WHERE project_id=$1 AND user_id=$2",[project,c]);
   await q("INSERT INTO project_casting_authorities(project_id,user_id,permission,granted_by) VALUES($1,$2,'view_casting',$3)",[project,c,b]);
   await as(c);const row=(await q('SELECT * FROM role_candidates WHERE id=$1',[candidate]))[0];assert.ok(row);
   assert.equal((await q('SELECT id FROM work_applications WHERE id=$1',[row.application_id])).length,1,'view-only casting can read the historical application');
   assert.equal((await q('SELECT id FROM minor_talent_profiles WHERE id=$1',[minor])).length,0,'history does not restore discovery');
   assert.equal((await q('SELECT id FROM minor_media WHERE minor_talent_id=$1',[minor])).length,0);
   assert.equal((await q("UPDATE role_candidates SET status='shortlist' WHERE id=$1 RETURNING id",[candidate])).length,0,'view-only cannot progress');
   assert.equal((await q("UPDATE role_candidates SET status='rejected' WHERE id=$1 RETURNING id",[candidate])).length,0,'view-only cannot close');
   await as(a);assert.equal((await q("UPDATE work_applications SET status='withdrawn' WHERE id=$1 RETURNING id",[row.application_id])).length,1);
   await as(b);assert.equal((await q("UPDATE role_candidates SET status='rejected' WHERE id=$1 RETURNING id",[candidate])).length,1);
   await db.exec('RESET ROLE');await q("UPDATE project_members SET status='removed' WHERE project_id=$1 AND user_id=$2",[project,c]);
   await as(c);assert.equal((await q('SELECT id FROM role_candidates WHERE id=$1',[candidate])).length,0);
   assert.equal((await q('SELECT id FROM work_applications WHERE id=$1',[row.application_id])).length,0);
   await as(null,'anon');await denied('SELECT id FROM role_candidates');
  }finally{await db.exec('ROLLBACK; RESET ROLE');}
 });
 await t.test('legacy application history without original context fails closed and can still be rejected',async()=>{
  await db.exec('RESET ROLE; BEGIN');
  try{
   await as(b);const r=await scalar("INSERT INTO casting_roles(project_id,title) VALUES($1,'Historical role') RETURNING id",[project]);
   const application=await scalar('SELECT application_id FROM role_candidates WHERE id=$1',[candidate]);
   // Trusted fixture simulates a pre-correction record, never a browser bypass.
   await db.exec('RESET ROLE; ALTER TABLE role_candidates DISABLE TRIGGER minor_candidate_source');
   const id=await scalar("INSERT INTO role_candidates(role_id,casting_subject_id,application_id,source) VALUES($1,$2,$3,'application') RETURNING id",[r,subject,application]);
   await db.exec('ALTER TABLE role_candidates ENABLE TRIGGER minor_candidate_source');
   await as(b);assert.equal(await scalar('SELECT minor_application_project_id FROM role_candidates WHERE id=$1',[id]),null);
   await db.exec('SAVEPOINT active');await denied("UPDATE role_candidates SET status='review' WHERE id=$1 RETURNING id",[id]);await db.exec('ROLLBACK TO active');
   assert.equal((await q("UPDATE role_candidates SET status='rejected' WHERE id=$1 RETURNING id",[id])).length,1);
   assert.equal(await scalar('SELECT minor_application_work_hash FROM role_candidates WHERE id=$1',[id]),null,'no fabricated historical evidence');
  }finally{await db.exec('ROLLBACK; RESET ROLE');}
 });
 await t.test('safe closure of an approved minor still requires approval authority, never renewed consent',async()=>{
  await db.exec('RESET ROLE; BEGIN');
  try{
   await as(b);await q("UPDATE role_candidates SET status='approved' WHERE id=$1",[candidate]);
   await as(a);await q('UPDATE minor_project_consents SET revoked_at=now() WHERE casting_subject_id=$1 AND project_id=$2',[subject,project]);
   await as(c);await db.exec('SAVEPOINT approval');await denied("UPDATE role_candidates SET status='rejected' WHERE id=$1 RETURNING id",[candidate]);await db.exec('ROLLBACK TO approval');
   await as(b);assert.equal((await q("UPDATE role_candidates SET status='rejected' WHERE id=$1 RETURNING id",[candidate])).length,1);
   await db.exec('RESET ROLE');assert.equal(await scalar('SELECT count(*)::int FROM minor_project_consents WHERE casting_subject_id=$1 AND revoked_at IS NULL',[subject]),0);
  }finally{await db.exec('ROLLBACK; RESET ROLE');}
 });
 await t.test('unrelated responsible adult cannot accept even a reviewed row; browser cannot manufacture review',async()=>{
  await db.exec('RESET ROLE');await q("INSERT INTO minor_project_responsibilities(project_id,adult_user_id,policy_version,reviewed_by,valid_until) VALUES($1,$2,'v1',$3,now()+interval '1 month')",[project,d,b]);
  await as(d);await denied("SELECT minor_responsibility_accept($1,'v1')",[project]);
  await denied('UPDATE minor_project_responsibilities SET accepted_at=now() WHERE project_id=$1',[project]);
 });
 let relation;
 await t.test('graph is bilateral, nonexclusive, private until individual opts in; ended relation disappears',async()=>{
  await as(b);org=await scalar("SELECT organization_create('Cinema school','network-school','education')");
  relation=await scalar("SELECT relationship_request($1,$2,'instructor','Directing mentor')",[org,c]);
  await q("SELECT relationship_respond($1,'confirm',true,true)",[relation]);
  assert.equal((await scalar('SELECT professional_graph($1,NULL)',[org])).length,0);
  await as(c);await q("SELECT relationship_respond($1,'confirm',true,true)",[relation]);
  await denied("UPDATE organization_professional_relationships SET status='active'");
  await as(null,'anon');const graph=await scalar('SELECT professional_graph($1,NULL)',[org]);assert.equal(graph.length,1);assert.equal(graph[0].full_name,'Person '+c);assert.equal('email' in graph[0],false);
 });
 await t.test('private graph operates without public discoverability; company and person independently control display',async()=>{
  await as(a);await q("INSERT INTO profile_privacy_settings(user_id,profile_visibility) VALUES($1,'private') ON CONFLICT(user_id) DO UPDATE SET profile_visibility='private'",[a]);
  await as(b);const privateRelation=await scalar("SELECT relationship_request($1,$2,'regular_freelancer','Private collaborator')",[org,a]);
  await as(a);await q("SELECT relationship_respond($1,'confirm',true,true)",[privateRelation]);
  await as(null,'anon');assert.equal((await scalar('SELECT professional_graph($1,NULL)',[org])).length,1);
  await as(c);await q("SELECT relationship_respond($1,'confirm',false,true)",[relation]);
  await as(null,'anon');assert.equal((await scalar('SELECT professional_graph($1,NULL)',[org])).length,0);
  assert.equal((await scalar('SELECT professional_graph(NULL,$1)',[c])).length,1);
  await as(b);await q("SELECT relationship_respond($1,'confirm',false,false)",[relation]);
  await as(c);await q("SELECT relationship_respond($1,'confirm',true,true)",[relation]);
  await as(null,'anon');assert.equal((await scalar('SELECT professional_graph($1,NULL)',[org])).length,0);
  await as(b);await q("SELECT relationship_respond($1,'confirm',true,false)",[relation]);
 });
 await t.test('authorized private company relationship stays operational and absent from public graph',async()=>{
  await as(b);const privateOrg=await scalar("SELECT organization_create('Private studio','private-graph-studio','education')");
  await q("UPDATE organizations SET visibility='members_only' WHERE id=$1",[privateOrg]);
  const privateRelation=await scalar("SELECT relationship_request($1,$2,'preferred_crew','Private team')",[privateOrg,c]);
  await q("SELECT relationship_respond($1,'confirm',true,false)",[privateRelation]);
  await as(c);await q("SELECT relationship_respond($1,'confirm',true,true)",[privateRelation]);
  assert.equal(await scalar('SELECT status FROM organization_professional_relationships WHERE id=$1',[privateRelation]),'active');
  await as(null,'anon');assert.deepEqual(await scalar('SELECT professional_graph($1,NULL)',[privateOrg]),[]);
 });
 await t.test('education/events public discovery excludes drafts; unrelated editor denied; organization type enforced',async()=>{
  await as(b);const program=await scalar("INSERT INTO education_programs(organization_id,title,program_type,format,price_type) VALUES($1,'Directing course','course','online','free') RETURNING id",[org]);
  await as(null,'anon');assert.equal(await scalar('SELECT count(*)::int FROM education_programs'),0);
  await as(c);await denied("INSERT INTO education_programs(organization_id,title,program_type,format,price_type) VALUES($1,'Spoof course','course','online','free')",[org]);
  await as(b);await q("UPDATE education_programs SET status='published' WHERE id=$1",[program]);
  await q("INSERT INTO education_program_instructors(program_id,user_id,role_title) VALUES($1,$2,'Mentor')",[program,c]);
  const event=await scalar("INSERT INTO industry_events(organizer_type,organization_id,title,event_type,format,price_type,starts_at,ends_at) VALUES('organization',$1,'School open day','open_day','online','free',now()+interval '1 day',now()+interval '2 days') RETURNING id",[org]);
  await as(null,'anon');assert.equal(await scalar('SELECT count(*)::int FROM education_programs'),1);assert.equal(await scalar('SELECT count(*)::int FROM industry_events'),0);
  await as(b);await q("UPDATE industry_events SET status='published' WHERE id=$1",[event]);await denied("UPDATE industry_events SET moderation_status='hidden' WHERE id=$1",[event]);
  await as(null,'anon');assert.equal(await scalar('SELECT count(*)::int FROM industry_events'),1);
  await as(c);await q("SELECT relationship_respond($1,'end')",[relation]);
  assert.equal((await scalar('SELECT professional_graph($1,NULL)',[org])).length,0);
  await as(null,'anon');assert.equal(await scalar('SELECT count(*)::int FROM education_program_instructors'),0);
 });
 await t.test('relationship episodes preserve ended, declined and expired history; only one current episode can be public',async()=>{
  for(const terminal of ['ended','declined','expired']){
   await as(b);const first=await scalar("SELECT relationship_request($1,$2,'technical_partner','Returning collaborator')",[org,c]);
   assert.equal(await scalar("SELECT relationship_request($1,$2,'technical_partner','Retry')",[org,c]),first);
   await q("SELECT relationship_respond($1,'confirm',true,false)",[first]);
   await as(c);await q("SELECT relationship_respond($1,'confirm',true,true)",[first]);
   await db.exec('RESET ROLE');
   await assert.rejects(q("INSERT INTO organization_professional_relationships(organization_id,user_id,relationship_type,initiated_by,status,organization_confirmed_at,professional_confirmed_at) VALUES($1,$2,'technical_partner','organization','active',now(),now())",[org,c]),e=>e.code==='23505');
   if(terminal==='expired')await q("UPDATE organization_professional_relationships SET status='expired',ended_at=now() WHERE id=$1",[first]);
   else{await as(c);await q('SELECT relationship_respond($1,$2)',[first,terminal==='ended'?'end':'decline']);}
   const historical=(await q('SELECT * FROM organization_professional_relationships WHERE id=$1',[first]))[0];
   await as(b);const next=await scalar("SELECT relationship_request($1,$2,'technical_partner','New engagement')",[org,c]);assert.notEqual(next,first);
   assert.equal(await scalar('SELECT status FROM organization_professional_relationships WHERE id=$1',[next]),'pending');
   await q("SELECT relationship_respond($1,'confirm',true,false)",[next]);
   await as(c);await q("SELECT relationship_respond($1,'confirm',true,true)",[next]);
   await assert.rejects(q("SELECT relationship_respond($1,'end')",[first]),e=>e.code==='23514');
   await as(null,'anon');assert.deepEqual((await scalar('SELECT professional_graph($1,NULL)',[org])).map(r=>r.id),[next]);
   await db.exec('RESET ROLE');
   assert.deepEqual((await q('SELECT * FROM organization_professional_relationships WHERE id=$1',[first]))[0],historical);
   await assert.rejects(q('DELETE FROM organization_professional_relationships WHERE id=$1',[first]),e=>e.code==='23514');
   await assert.rejects(q("UPDATE organization_professional_relationships SET ended_at=now() WHERE id=$1",[first]),e=>e.code==='23514');
   await as(c);await q("SELECT relationship_respond($1,'end')",[next]);
  }
 });
 await t.test('referral qualification is server-only, no self referral/minor bounty, ledger replay and cancellation safe',async()=>{
  await db.exec('RESET ROLE');
  const partner=await scalar("INSERT INTO growth_partners(partner_subject_type,user_id,partner_type,status) VALUES('user',$1,'individual','active') RETURNING id",[a]);
  const rule=await scalar("INSERT INTO referral_reward_rules(reward_type,partner_value,new_user_value,qualifying_event,enabled) VALUES('ai_credits',10,5,'first_application',true) RETURNING id");
  const campaign=await scalar("INSERT INTO referral_campaigns(partner_id,name,campaign_type,destination_path,reward_rule_id,ends_at,status) VALUES($1,'Test cohort','cohort','/students',$2,now()+interval '1 week','active') RETURNING id",[partner,rule]);
  const code=await scalar('INSERT INTO referral_codes(campaign_id) VALUES($1) RETURNING code',[campaign]);
  await as(a);await denied('SELECT referral_attribute($1)',[code]);
  await as(c);await q('SELECT referral_attribute($1)',[code]);await q('SELECT referral_attribute($1)',[code]);
  await denied('SELECT * FROM referral_reward_ledger');await denied("SELECT filmverse_private.referral_qualify($1,'first_application','verified-application')",[crypto.randomUUID()]);
  await db.exec('RESET ROLE');const attr=await scalar('SELECT id FROM referral_attributions WHERE new_user_id=$1',[c]);
  await assert.rejects(q("SELECT filmverse_private.referral_qualify($1,'minor_created','child-bounty')",[attr]),e=>e.code==='23514');
  const event=await scalar("SELECT filmverse_private.referral_qualify($1,'first_application','verified-application')",[attr]);
  assert.equal(await scalar("SELECT filmverse_private.referral_qualify($1,'first_application','verified-application')",[attr]),event);
  assert.equal(await scalar('SELECT count(*)::int FROM referral_reward_ledger'),2);
  await denied("UPDATE referral_reward_ledger SET value=999");await q('SELECT filmverse_private.referral_reverse($1)',[event]);await q('SELECT filmverse_private.referral_reverse($1)',[event]);assert.equal(Number(await scalar('SELECT sum(value) FROM referral_reward_ledger')),0);
  await assert.rejects(q("SELECT filmverse_private.referral_qualify($1,'first_application','verified-application')",[attr]),e=>e.code==='23514');
  await as(a);const dash=await scalar('SELECT referral_dashboard($1)',[partner]);assert.equal(dash.signups,1);assert.equal(await scalar('SELECT student_badge($1)',[c]),false);assert.equal('new_user_id' in dash,false);
  await as(d);await denied('SELECT referral_dashboard($1)',[partner]);
 });
 await t.test('typed referral routes cannot encode external redirects or arbitrary payloads',async()=>{
  await db.exec('RESET ROLE');
  assert.equal(await scalar("SELECT filmverse_private.referral_destination('work',$1,'{}')",[project]),'/work/'+project);
  assert.equal(await scalar("SELECT filmverse_private.referral_destination('other_supported_internal',NULL,'{\"page\":\"https://evil.test\"}')"),null);
  await assert.rejects(q("SELECT filmverse_private.referral_destination('work',NULL,'{\"redirect\":\"//evil.test\"}')"),e=>e.code==='22023');
  await assert.rejects(q("SELECT filmverse_private.referral_destination('other_supported_internal',NULL,'{\"page\":\"students\",\"url\":\"//evil.test\"}')"),e=>e.code==='22023');
 });
 await t.test('every new relation has RLS and all definers fix search_path',async()=>{
  await db.exec('RESET ROLE');assert.equal(await scalar("SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity"),0);
  assert.equal(await scalar("SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='filmverse_private' AND p.prosecdef AND NOT coalesce(p.proconfig@>ARRAY['search_path=\"\"'],false)"),0);
 });
 }finally{await db.close();}
});
