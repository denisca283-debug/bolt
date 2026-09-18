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


test('Industry hubs expose six roots without fake counters; events persist the selected actor context',async({page})=>{
 await setup(page,{signedIn:true});await page.goto('/#/industry');await expect(page.getByRole('heading',{name:'Индустрия',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'События Календарь встреч, фестивалей и мастер-классов'}).click();
 await expect(page.getByRole('heading',{name:'События',exact:true})).toBeVisible();
 let payload;await page.route('**/rest/v1/industry_events*',r=>{if(r.request().method()==='POST'){payload=r.request().postDataJSON();return r.fulfill({json:{id:'event'}});}return r.fulfill({json:[]});});
 await page.getByRole('button',{name:'Добавить событие',exact:true}).click();
 await page.getByLabel('Название',{exact:true}).fill('Школа кино: встреча');
 await page.getByLabel('Начало (ваш часовой пояс)').fill('2027-01-10T12:00');await page.getByLabel('Окончание',{exact:true}).fill('2027-01-10T14:00');
 await page.getByRole('button',{name:'Опубликовать',exact:true}).click();await expect(page.getByText('Публикация сохранена.')).toBeVisible();
 expect(payload.organizer_type).toBe('user');expect(payload.user_id).toBe(user.id);expect(payload.status).toBe('published');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('Young Talent rejects unreviewed account and does not index protected discovery',async({page})=>{
 await setup(page,{signedIn:true});await page.route('**/rest/v1/rpc/young_talent_search',r=>r.fulfill({status:403,json:{message:'reviewed_professional_access_required',code:'42501'}}));
 await page.goto('/#/young-talent');await expect(page.getByRole('alert')).toContainText('PRO не открывает детские профили');
 await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex,nofollow');
 await expect(page.getByRole('button',{name:'Связаться с представителем'})).toHaveCount(0);
});
test('Young Talent contact goes to guardian canonical room; no direct child account',async({page})=>{
 await setup(page,{signedIn:true});await page.route('**/rest/v1/rpc/young_talent_search',r=>r.fulfill({json:[{id:'child',casting_subject_id:'subject',display_name:'Young performer',city:'Москва'}]}));
 let contact;await page.route('**/rest/v1/rpc/minor_contact',r=>{contact=r.request().postDataJSON();return r.fulfill({json:'guardian-room'});});
 await page.goto('/#/young-talent');await page.getByRole('button',{name:'Связаться с представителем'}).click();await expect(page).toHaveURL(/#\/messages\/guardian-room$/);expect(contact).toEqual({p_subject:'subject'});
});
test('Education requires school context, and failed event save never claims success',async({page})=>{
 await setup(page,{signedIn:true});await page.goto('/#/education');await page.getByRole('button',{name:'Добавить программу'}).click();await expect(page.getByText(/Для программы выберите киношколу/)).toBeVisible();
 await page.goto('/#/events');await page.route('**/rest/v1/industry_events*',r=>r.request().method()==='POST'?r.fulfill({status:403,json:{code:'42501'}}):r.fulfill({json:[]}));
 await page.getByRole('button',{name:'Добавить событие'}).click();await page.getByLabel('Название',{exact:true}).fill('Failing event');await page.getByLabel('Начало (ваш часовой пояс)').fill('2027-01-10T12:00');await page.getByLabel('Окончание',{exact:true}).fill('2027-01-10T14:00');await page.getByRole('button',{name:'Опубликовать',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Не удалось сохранить');await expect(page.getByText('Публикация сохранена.')).toHaveCount(0);
});
