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


test('canonical Project Need persists manual casting route; minors never resolve to auction',async({page})=>{
 await setup(page,{signedIn:true});await page.route('**/rest/v1/projects*',r=>r.fulfill({json:{title:'Production film',user_id:user.id,organization_id:null,visibility:'private',student_project:false}}));
 let needs=[];let payload;
 await page.route('**/rest/v1/project_needs*',r=>{if(r.request().method()==='POST'){payload=r.request().postDataJSON();needs=[{id:'need',...payload,status:'open'}];return r.fulfill({json:{id:'need'}});}return r.fulfill({json:needs});});
 await page.goto('/#/project/00000000-0000-4000-8000-000000000099');
 await page.getByLabel('Что нужно',{exact:true}).fill('Детская роль');
 await page.getByLabel('Тип потребности').selectOption('casting_subject');await page.getByLabel('Несовершеннолетний — только защищённый кастинг').check();
 await page.getByRole('button',{name:'Сохранить потребность'}).click();await expect(page.getByRole('heading',{name:'Детская роль × 1'})).toBeVisible();
 expect(payload.target_type).toBe('casting_subject');expect(payload.resolution_route).toBe('young_talent_casting');expect(payload.project_id).toBe('00000000-0000-4000-8000-000000000099');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.reload();await expect(page.getByRole('heading',{name:'Детская роль × 1'})).toBeVisible();
});
test('Project Need failure stays visible, no optimistic fake need or automatic invitation',async({page})=>{
 await setup(page,{signedIn:true});await page.route('**/rest/v1/projects*',r=>r.fulfill({json:{title:'Private film',user_id:user.id,organization_id:null,visibility:'private',student_project:false}}));
 await page.route('**/rest/v1/project_needs*',r=>r.request().method()==='POST'?r.fulfill({status:403,json:{code:'42501'}}):r.fulfill({json:[]}));
 await page.goto('/#/project/00000000-0000-4000-8000-000000000099');await page.getByLabel('Что нужно',{exact:true}).fill('Camera');await page.getByRole('button',{name:'Сохранить потребность'}).click();
 await expect(page.getByRole('alert')).toContainText('Потребность не сохранена');await expect(page.getByRole('heading',{name:'Camera × 1'})).toHaveCount(0);
});
