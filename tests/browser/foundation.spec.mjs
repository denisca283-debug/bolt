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
