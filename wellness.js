(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const key = 'fitness-wellness.v1';
  const labels = {sleep:['','较差','一般','良好'],energy:['','低','一般','充足'],soreness:['','明显','轻微','没有']};
  let entries = [];
  let available = true;
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(parsed)) throw new Error('Invalid data');
    entries = parsed.filter(r => r && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && ['sleep','energy','soreness'].every(k => [1,2,3].includes(r[k])));
  } catch {
    available = false;
    $('well-status').textContent = '无法读取浏览器中的状态记录，请检查存储设置。';
  }
  const now = new Date();
  $('well-date').value = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,10);
  function render(person) {
    const items = entries.filter(r => (r.person||'')===person).sort((a,b)=>a.date.localeCompare(b.date));
    const last=items.at(-1), previous=items.at(-2);
    $('well-summary').replaceChildren();
    for (const [key,title] of [['sleep','睡眠'],['energy','精力'],['soreness','酸痛']]) {
      const box=document.createElement('div');box.className='wod-stat';
      const a=document.createElement('span');a.textContent=title;
      const b=document.createElement('strong');b.textContent=last?labels[key][last[key]]:'—';
      const c=document.createElement('small');c.textContent=previous?`上次 ${labels[key][previous[key]]}`:'再记录一天即可对比';
      box.append(a,b,c);$('well-summary').append(box);
    }
    $('well-note').textContent=last?`${person||'本人'} · 最近记录 ${last.date}。睡眠与精力越高、酸痛越少，通常说明当天主观状态更好。`:'填写两天后可比较状态。每天保存一次，同一天再次保存会更新。';
    $('well-history').replaceChildren();
    [...items].reverse().forEach(r=>{const p=document.createElement('p');p.textContent=`${r.date} · 睡眠 ${labels.sleep[r.sleep]} · 精力 ${labels.energy[r.energy]} · 酸痛 ${labels.soreness[r.soreness]}`;$('well-history').append(p);});
  }
  $('wellness-form').addEventListener('submit', event => {
    event.preventDefault();
    const record={date:$('well-date').value,person:$('well-person').value.trim(),sleep:Number($('well-sleep').value),energy:Number($('well-energy').value),soreness:Number($('well-soreness').value)};
    const next=entries.filter(r=>r.date!==record.date||(r.person||'')!==record.person).concat(record);
    try {if(!available)throw new Error('Storage unavailable');localStorage.setItem(key,JSON.stringify(next));entries=next;render(record.person);$('well-status').textContent='今日状态已保存。';}
    catch {$('well-status').textContent='保存失败，请检查浏览器是否允许本地存储。';}
  });
  $('well-person').addEventListener('change',()=>render($('well-person').value.trim()));
  render('');
})();
