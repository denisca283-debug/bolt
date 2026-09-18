import { test, expect } from '@playwright/test';

const user={ id:'00000000-0000-4000-8000-000000000001', aud:'authenticated',role:'authenticated',email:'fixture@example.test',user_metadata:{full_name:'Test Actor'},app_metadata:{provider:'email'},created_at:'2026-01-01T00:00:00Z' };
function session(){
  const exp=Math.floor(Date.now()/1000)+3600;
  const access_token=[{alg:'HS256',typ:'JWT'},{sub:user.id,exp,iat:exp-3600,role:'authenticated',aud:'authenticated'},'fixture'].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
  return {access_token,refresh_token:'test-refresh-token',expires_at:exp,expires_in:3600,token_type:'bearer',user};
}
async function setup(page,{signedIn=false,validation='ok',profileError=false}={}){
  const state={validation};
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='127.0.0.1') return route.continue();
    // Entire browser suite is isolated from real services and user data.
    if(url.hostname!=='filmverse-test.supabase.co') return route.abort();
    if(url.pathname==='/auth/v1/user'){
      if(state.validation==='network') return route.abort('internetdisconnected');
      if(state.validation==='invalid') return route.fulfill({status:401,json:{code:'bad_jwt',message:'invalid token'}});
      return route.fulfill({json:user});
    }
    if(url.pathname==='/auth/v1/logout') return route.fulfill({status:204});
    if(url.pathname==='/auth/v1/token') return route.fulfill({json:session()});
    if(url.pathname==='/rest/v1/profiles'){
      if(profileError) return route.fulfill({status:500,json:{code:'XX000',message:'fixture db error'}});
      return route.fulfill({json:{id:user.id,full_name:'Test Actor',public_slug:'test-actor',city:'Москва',availability_status:'available'}});
    }
    if(url.pathname.includes('/rpc/')) return route.fulfill({json:false});
    return route.fulfill({json:[]});
  });
  if(signedIn) await page.addInitScript(s=>localStorage.setItem('sb-filmverse-test-auth-token',JSON.stringify(s)),session());
  return state;
}

test('unlisted company and content resolve directly, but discovery excludes them',async({page})=>{
 await setup(page);
 await page.route('**/rest/v1/rpc/company_search',r=>r.fulfill({json:[]}));
 await page.route('**/rest/v1/rpc/company_public',r=>r.fulfill({json:{id:'hidden',name:'Unlisted studio',organization_type:'studio'}}));
 await page.route('**/rest/v1/rpc/company_team',r=>r.fulfill({json:[]}));
 await page.goto('/#/companies');await expect(page.getByText('По этим условиям компаний не найдено.')).toBeVisible();
 await page.goto('/#/company/unlisted');await expect(page.getByRole('heading',{name:'Unlisted studio'})).toBeVisible();
 await page.route('**/rest/v1/projects*',r=>r.fulfill({json:new URL(r.request().url()).pathname.endsWith('_discovery')?[]:{title:'Direct project',description:'Link only'}}));
 await page.goto('/#/projects');await expect(page.getByText('Direct project')).toHaveCount(0);
 await page.goto('/#/project/hidden');await expect(page.getByRole('heading',{name:'Direct project'})).toBeVisible();
});
test('Resume bearer link uses explicit RPC token; plain id cannot open link-only publication',async({page})=>{
 await setup(page);const token='a'.repeat(64);
 await page.route('**/rest/v1/rpc/resume_read',r=>r.fulfill({json:r.request().postDataJSON().p_token===token?{id:'resume',user_id:user.id,display_name:'Resume identity',headline:'Independent resume',custom_professions:[],cities:[],description:'Public professional data'}:null}));
 await page.goto('/#/resume/resume');await expect(page.getByText('Резюме не опубликовано или недоступно.')).toBeVisible();
 await page.goto('/#/resume-share/resume/'+token);await expect(page.getByRole('heading',{name:'Independent resume'})).toBeVisible();
 await expect(page.getByText('Resume identity')).toBeVisible();
 await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex,nofollow');
});
test('invitation names company and admin cannot offer privileged roles',async({page})=>{
 await setup(page,{signedIn:true});
 const company={id:'company-a',name:'Managed Studio',slug:'managed',organization_type:'studio'};
 await page.route('**/rest/v1/organizations*',r=>r.fulfill({json:[company]}));
 await page.route('**/rest/v1/organization_members*',r=>r.fulfill({json:[{organization_id:company.id,user_id:user.id,role:'admin',active:true}]}));
 await page.route('**/rest/v1/organization_role_permissions*',r=>r.fulfill({json:[{role_key:'admin',permission:'manage_members'}]}));
 await page.route('**/rest/v1/organization_roles*',r=>r.fulfill({json:['owner','admin','finance','producer','member'].map(key=>({key,label:key}))}));
 await page.route('**/rest/v1/rpc/organization_invitation_cards',r=>r.fulfill({json:[{id:'invite',organization_id:'private-company-id',organization_name:'Inviting Film School',organization_type:'education',role_key:'member',status:'pending',is_recipient:true,expires_at:'2027-01-01'}]}));
 await page.goto('/#/organizations');await expect(page.getByText(/Inviting Film School/)).toBeVisible();
 await expect(page.getByText(/private-company-id/)).toHaveCount(0);
 await page.getByRole('button',{name:/Managed Studio/}).click();
 const options=page.getByLabel('Роль приглашённого').locator('option');await expect(options).toHaveCount(2);
 expect(await options.allTextContents()).toEqual(['producer','member']);
 await expect(page.getByLabel('Роль '+user.id,{exact:true})).toBeDisabled();
});

test('guest app load, auth modal close, protected route and invalid recovery route',async({page})=>{
  await setup(page); await page.goto('/');
  const trigger=page.getByRole('button',{name:'Регистрация',exact:true}).last();
  await expect(trigger).toBeVisible(); await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.goto('/#/settings'); await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Чтобы изменить настройки, войдите в FilmVerse.')).toBeVisible();
  await page.getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.goto('/#/reset-password'); await expect(page.getByRole('heading',{name:'Ссылка недействительна'})).toBeVisible();
});

test('model extension saves atomically on same account, reloads measurements and keeps digitals distinct',async({page})=>{
 await setup(page,{signedIn:true});let model=null,measurements=null;let authWrites=0;
 page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/auth/v1/signup'))authWrites++;});
 await page.route('**/rest/v1/model_profiles*',r=>r.fulfill({json:model}));
 await page.route('**/rest/v1/model_measurements*',r=>r.fulfill({json:measurements}));
 await page.route('**/rest/v1/rpc/model_save',r=>{const body=r.request().postDataJSON();model=body.p_model;measurements=body.p_measurements;return r.fulfill({json:null});});
 await page.route('**/rest/v1/rpc/person_representatives',r=>r.fulfill({json:[]}));
 await page.goto('/#/model-settings');await page.getByLabel('Commercial',{exact:true}).check();await page.getByLabel('Рост, см',{exact:true}).fill('178');await page.getByLabel('Видимость параметров').selectOption('members');
 await page.getByRole('button',{name:'Сохранить специализацию'}).click();await expect(page.getByText('Модельная специализация и параметры сохранены.')).toBeVisible();
 expect(model.categories).toEqual(['commercial']);expect(measurements.visibility).toBe('members');expect(authWrites).toBe(0);
 await page.reload();await expect(page.getByLabel('Рост, см',{exact:true})).toHaveValue('178');
 await expect(page.getByText(/Digitals — естественные фотографии/)).toBeVisible();
 await expect(page.getByLabel('Тип медиа').locator('option[value="model_digitals"]')).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
});

test('models directory sends filters to server and opens dedicated real profile route',async({page})=>{
 await setup(page);const calls=[];
 await page.route('**/rest/v1/rpc/model_search',r=>{calls.push(r.request().postDataJSON());return r.fulfill({json:[{id:'model-person',full_name:'Model Person',city:'Москва',categories:['commercial'],height_cm:null}]});});
 await page.goto('/#/models');await page.getByLabel('Категория модели').selectOption('commercial');await page.getByLabel('Город модели').fill('Москва');
 await expect.poll(()=>calls.at(-1)?.p_filters.city).toBe('Москва');expect(calls.at(-1).p_offset).toBe(0);
 await expect(page.getByRole('button',{name:/Model Person/})).toBeVisible();await page.getByRole('button',{name:/Model Person/}).click();await expect(page).toHaveURL(/model\/model-person/);
});

test('student affiliation is private by default; self-declared project creates no verified badge or Pulse event',async({page})=>{
 await setup(page,{signedIn:true});const affiliations=[];let created;let pulseWrites=0;
 await page.route('**/rest/v1/rpc/company_search',r=>r.fulfill({json:[]}));
 await page.route('**/rest/v1/student_support_preferences*',r=>r.fulfill({json:null}));
 await page.route('**/rest/v1/education_affiliations*',r=>{if(r.request().method()==='POST'){const body=r.request().postDataJSON();affiliations.push({...body,id:'education-fixture'});return r.fulfill({json:{id:'education-fixture'}});}return r.fulfill({json:affiliations});});
 await page.route('**/rest/v1/projects*',r=>{if(r.request().method()==='POST'){created={...r.request().postDataJSON(),id:'student-project',user_id:user.id};return r.fulfill({json:{id:created.id}});}return r.fulfill({json:new URL(r.request().url()).searchParams.has('id')?created:[]});});
 await page.route('**/rest/v1/pulse_feed*',r=>{if(r.request().method()==='POST')pulseWrites++;return r.fulfill({json:[]});});
 await page.goto('/#/students');await page.getByRole('button',{name:'Добавить образование'}).click();let dialog=page.getByRole('dialog');await dialog.getByLabel('Учебное заведение',{exact:true}).fill('Киношкола');await dialog.getByLabel('Ожидаемый год выпуска').fill('2028');await dialog.getByRole('button',{name:'Сохранить образование'}).click();await expect(dialog).toHaveCount(0);expect(affiliations[0].visibility).toBe('private');
 await page.getByRole('button',{name:'Создать студенческий проект'}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Название',{exact:true}).fill('Дипломный фильм');await dialog.getByLabel('Город',{exact:true}).fill('Москва');await dialog.getByLabel('Тип / формат').fill('Короткий метр');await dialog.getByLabel('Кратко о проекте').fill('Учебный фильм');await dialog.getByRole('button',{name:'Сохранить студенческий проект'}).click();
 await expect(page.getByRole('heading',{name:'Дипломный фильм',exact:true})).toBeVisible();await expect(page.getByText('Студенческий проект — самоописание',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Попросить помощь'})).toBeVisible();
 expect(created.student_project).toBe(true);expect(created.visibility).toBe('private');expect(pulseWrites).toBe(0);
});

test('self-declared project offers basic mentorship without irrelevant rights and work never defaults to Model',async({page})=>{
 await setup(page,{signedIn:true});
 await page.route('**/rest/v1/projects*',r=>r.fulfill({json:{id:'basic-project',title:'Basic film',user_id:user.id,student_project:true,visibility:'public',city:'Москва'}}));
 await page.route('**/rest/v1/project_support_requests*',r=>r.fulfill({json:[]}));
 await page.goto('/#/project/basic-project');
 await page.getByRole('button',{name:'Попросить помощь'}).click();
 let dialog=page.getByRole('dialog');await dialog.getByLabel('Что нужно').selectOption('mentorship');
 await expect(dialog.getByLabel('Права использования результата')).toHaveCount(0);
 await expect(dialog.getByLabel('Тема консультации')).toBeVisible();
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Найти модель / актёра / специалиста'}).click();
 dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Тип роли')).toBeVisible();
 await expect(dialog.getByText('Требования к модели — необязательно')).toHaveCount(0);
});

test('verified student project publishes structured help with explicit unpaid terms',async({page})=>{
 await setup(page,{signedIn:true});const rows=[];
 await page.route('**/rest/v1/projects*',r=>r.fulfill({json:{id:'student-project',title:'Verified film',user_id:user.id,student_project:true,visibility:'public',city:'Москва'}}));
 await page.route('**/rest/v1/rpc/student_project_badge',r=>r.fulfill({json:true}));
 await page.route('**/rest/v1/project_support_requests*',r=>r.fulfill({json:rows}));
 await page.route('**/rest/v1/rpc/support_request_create',r=>{const d=r.request().postDataJSON();expect(d.p_project).toBe('student-project');rows.push({...d.p_data,id:'need',status:'open'});return r.fulfill({json:'need'});});
 await page.goto('/#/project/student-project');await page.getByRole('button',{name:'Попросить помощь'}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Кто или что требуется').fill('Нужен 1AC');await dialog.getByLabel('Город',{exact:true}).fill('Москва');await dialog.getByLabel('Начало',{exact:true}).fill('2027-03-01');await dialog.getByLabel('Окончание',{exact:true}).fill('2027-03-02');await dialog.getByLabel('Компенсация').selectOption('unpaid_educational');await dialog.getByLabel('Какие расходы покрываются').fill('Проезд и питание');await dialog.getByLabel('Права использования результата').fill('Фестивальный показ');await dialog.getByLabel('Ожидаемый результат').fill('Две смены');await dialog.getByRole('button',{name:'Сохранить запрос помощи'}).click();
 await expect(dialog).toHaveCount(0);await expect(page.getByText('Неоплачиваемое учебное сотрудничество',{exact:true})).toBeVisible();expect(rows[0].visibility).toBe('private');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
});

test('model work application persists without actor fields; support directory uses explicit filters',async({page})=>{
 await setup(page,{signedIn:true});let application=null;
 await page.route('**/rest/v1/work_opportunities*',r=>r.fulfill({json:[{id:'model-work',user_id:'employer',title:'Fashion film',type:'casting',audience:'Модели',target_kinds:['models'],compensation_type:'tfp',expenses_covered:'Travel',usage_rights:'Portfolio',deliverables:'Ten frames',created_at:new Date().toISOString()}]}));
 await page.route('**/rest/v1/work_applications*',r=>{if(r.request().method()==='POST'){expect(r.request().postDataJSON()).toEqual({work_id:'model-work'});application={id:'application',status:'applied'};}return r.fulfill({json:application});});
 await page.goto('/#/work/model-work');await expect(page.getByText('TFP / портфолио — без оплаты',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Откликнуться',exact:true}).click();await expect(page.getByText(/Отклик сохранён/)).toBeVisible();
 const calls=[];await page.route('**/rest/v1/rpc/support_search',r=>{calls.push(r.request().postDataJSON());return r.fulfill({json:[{id:'rental',name:'Student rental',kind:'company',slug:'rental',description:'Equipment',terms:'By agreement'}]});});
 await page.goto('/#/student-support');await page.getByLabel('Кто помогает').selectOption('company');await page.getByLabel('Тип поддержки').selectOption('rental_discount');await expect.poll(()=>calls.at(-1)?.p_type).toBe('rental_discount');await expect(page.getByText('Поддерживает студентов',{exact:true})).toBeVisible();
});

test('stored session survives network validation failure; retry, refresh and logout',async({page})=>{
  const state=await setup(page,{signedIn:true,validation:'network'}); await page.goto('/#/settings');
  await expect(page.getByRole('button',{name:'Профиль',exact:true})).toBeVisible();
  await expect(page.getByText(/Вход сохранён до истечения сессии/)).toBeVisible();
  await expect(page.getByRole('heading',{name:'Настройки',exact:true})).toBeVisible();
  state.validation='ok'; await page.getByRole('button',{name:'Повторить проверку соединения'}).click();
  await expect(page.getByText(/Вход сохранён до истечения сессии/)).toHaveCount(0);
  await page.reload(); await expect(page.getByRole('heading',{name:'Настройки',exact:true})).toBeVisible();
  // Setting-screen button remains accessible on both viewports.
  await page.getByRole('button',{name:'Выйти',exact:true}).last().click();
  await expect(page.getByRole('button',{name:'Профиль',exact:true})).toHaveCount(0);
});

test('explicit invalid token becomes guest; profile failure does not',async({page})=>{
  await setup(page,{signedIn:true,validation:'invalid'}); await page.goto('/');
  await expect(page.getByRole('button',{name:'Регистрация',exact:true}).last()).toBeVisible();
  await page.unrouteAll(); await setup(page,{signedIn:true,profileError:true}); await page.reload();
  await expect(page.getByRole('button',{name:'Профиль',exact:true})).toBeVisible();
  await expect(page.getByText(/Не удалось загрузить профиль. Вход сохранён/)).toBeVisible();
});

test('recovery token routes to password form (fixture, no email delivery claim)',async({page})=>{
  await setup(page); const s=session();
  await page.goto('/#access_token='+s.access_token+'&refresh_token='+s.refresh_token+'&expires_in=3600&token_type=bearer&type=recovery');
  await expect(page).toHaveURL(/reset-password/);
  await expect(page.locator('input[type="password"]')).toHaveCount(2);
});

test('ModalShell long body: close visible, background locked, overlay/Esc/focus restoration',async({page})=>{
  await setup(page); await page.goto('/tests/modal-harness.html');
  const trigger=page.getByRole('button',{name:'Открыть длинную форму'});
  await trigger.click();
  const dialog=page.getByRole('dialog'); const close=dialog.getByRole('button',{name:'Закрыть',exact:true});
  await dialog.locator('input').last().fill('last field');
  const box=await close.boundingBox(); expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y+box.height).toBeLessThan(page.viewportSize().height);
  expect(await page.evaluate(()=>document.body.style.overflow)).toBe('hidden');
  expect(await dialog.locator('div.overflow-y-auto').evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  await close.click(); await expect(trigger).toBeFocused();
  await trigger.click(); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  await trigger.click(); await page.mouse.click(2,2); await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused(); expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
});

test('real CreateDialog vacancy is viewport-safe at its last field',async({page})=>{
  await setup(page,{signedIn:true}); await page.goto('/');
  await page.getByRole('button',{name:'Разместить',exact:true}).click();
  await page.getByRole('button',{name:/Вакансию/}).click();
  const dialog=page.getByRole('dialog');
  await dialog.locator('textarea').last().fill('Browser regression fixture; never published');
  const close=dialog.getByRole('button',{name:'Закрыть',exact:true});
  const box=await close.boundingBox(); expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y+box.height).toBeLessThan(page.viewportSize().height);
  await close.click(); await expect(dialog).toHaveCount(0);
});

test('Resume opens dedicated creation, persists draft, and shows honest entitlement gate',async({page})=>{
  await setup(page,{signedIn:true}); const rows=[];
  await page.route('**/rest/v1/resume_publications*',route=>route.fulfill({json:rows}));
  await page.route('**/rest/v1/profile_publications*',async route=>{
    const body=route.request().postDataJSON(); rows.push({...body,id:'resume-fixture',status:'draft'});
    await route.fulfill({json:{id:'resume-fixture'}});
  });
  await page.route('**/rest/v1/rpc/resume_publish',route=>route.fulfill({status:403,json:{code:'42501',message:'resume_entitlement_required'}}));
  await page.goto('/'); await page.getByRole('button',{name:'Разместить',exact:true}).click();
  await page.getByRole('button',{name:/Резюме/}).click();
  await expect(page).toHaveURL(/resumes\/new/);
  const dialog=page.getByRole('dialog'); await expect(dialog.getByRole('heading',{name:'Новое резюме'})).toBeVisible();
  await dialog.getByLabel('Заголовок').fill('Оператор — ищу работу');
  await dialog.getByRole('button',{name:'Сохранить',exact:true}).click();
  await expect(dialog).toHaveCount(0); await expect(page.getByText('Черновик',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Опубликовать',exact:true}).click();
  await expect(page.getByRole('dialog').getByText(/Оплата пока не подключена/)).toBeVisible();
  expect(rows).toHaveLength(1); expect(rows[0].status).toBe('draft');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
});

test('multi-company context freezes publication author; payload names company not employee ownership',async({page})=>{
  await setup(page,{signedIn:true});
  const companies=[{id:'company-a',name:'Production A',slug:'production-a',organization_type:'production_company'},{id:'company-b',name:'Agency B',slug:'agency-b',organization_type:'agency'}];
  await page.route('**/rest/v1/organizations*',route=>route.fulfill({json:companies}));
  await page.route('**/rest/v1/organization_members*',route=>route.fulfill({json:companies.map(o=>({organization_id:o.id,role:'owner',active:true}))}));
  await page.route('**/rest/v1/organization_role_permissions*',route=>route.fulfill({json:[{role_key:'owner',permission:'publish_jobs'}]}));
  let sent; let pulseWrites=0;
  await page.route('**/rest/v1/pulse_feed*',route=>{ if(route.request().method()==='POST')pulseWrites++; return route.fulfill({json:[]}); });
  await page.route('**/rest/v1/work_opportunities*',route=>{
    if(route.request().method()==='POST'){sent=route.request().postDataJSON(); return route.fulfill({json:{id:'work-fixture'}});}
    return route.fulfill({json:[]});
  });
  await page.goto('/'); const context=page.getByLabel('Рабочий контекст');
  await expect(context.locator('option')).toHaveCount(4); await context.selectOption('company-b');
  await page.getByRole('button',{name:'Разместить',exact:true}).click(); await page.getByRole('button',{name:/Вакансию/}).click();
  const dialog=page.getByRole('dialog'); await expect(dialog.getByText(/компании «Agency B»/)).toBeVisible();
  await dialog.locator('input').first().fill('Главная роль в фильме');
  await dialog.getByRole('button',{name:/Опубликовать/}).click();
  await expect.poll(()=>sent?.organization_id).toBe('company-b'); expect(sent.user_id).toBe(user.id);
  await expect(dialog).toHaveCount(0); expect(pulseWrites).toBe(0);
});

test('company public page shows only safe projection and approved badge',async({page})=>{
  await setup(page);
  await page.route('**/rest/v1/rpc/company_public',route=>route.fulfill({json:{id:'company',slug:'rental',name:'Rental Test',organization_type:'rental_house',description:'Профессиональная аренда',verified:false,search_engine_indexable:false}}));
  await page.route('**/rest/v1/rpc/company_team',route=>route.fulfill({json:[]}));
  await page.goto('/#/company/rental'); await expect(page.getByRole('heading',{name:'Rental Test'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Оборудование и предложения аренды'})).toBeVisible();
  await expect(page.getByText('Проверена',{exact:false})).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex,nofollow');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
});

test('company content names company, not employee; personal ownership filter and deletion do not inherit creator identity',async({page})=>{
  await setup(page,{signedIn:true});
  await page.route('**/rest/v1/rpc/company_cards',route=>route.fulfill({json:[{id:'company-a',name:'Rental Company',slug:'rental-company'}]}));
  const common={id:'content-a',user_id:user.id,organization_id:'company-a',title:'Company-owned camera',city:'Москва',created_at:new Date().toISOString()};
  await page.route('**/rest/v1/work_opportunities*',route=>route.fulfill({json:[{...common,type:'job',audience:'Специалисты'}]}));
  await page.goto('/#/work'); await page.getByRole('button',{name:/Company-owned camera/}).click();
  await expect(page.getByRole('button',{name:'Rental Company',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/Снять с публикации/})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/Написать/})).toHaveCount(0);
  await page.route('**/rest/v1/marketplace_listings*',route=>route.fulfill({json:[{...common,mode:'Аренда',category:'Камеры'}]}));
  await page.goto('/#/marketplace'); await expect(page.getByText('Rental Company',{exact:true})).toBeVisible();
  await page.getByText('Мои личные объявления',{exact:true}).click();
  await expect(page.getByRole('button',{name:/Company-owned camera/})).toHaveCount(0);
});
