(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const key = 'fitness-wod.v1';
  let records = [];
  let edit = null;
  let clockStart = null;
  let clockMode = 'idle';
  let clockInterval = null;
  let planName = '';
  let selectedDetail = '';
  let unreadable = false;
  try {
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(data)) throw new Error();
    records = data.filter((entry) => entry && entry.id && entry.date && entry.plan);
  } catch {
    unreadable = true;
    $('wod-status').textContent = '无法读取本地训练记录，请检查浏览器存储。';
  }
  const presets = ['公安专项入门：2轮，每轮摸高2次、折返1趟、跑200米', '公安专项标准：3轮，每轮摸高2次、折返1趟，分段跑300／300／400米', '100个波比跳（熟练者摸底）', '自定义', '公安专项熟练版：3轮，每轮摸高2次、折返1趟、跑400米'];
  for (const name of presets) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    $('wod-plan').append(option);
  }
  const descriptions = {
    [presets[0]]: '公安专项入门\n每 6 分钟开始一轮 · 2 轮\n\n原地摸高 2 次\n10 米×4 折返 1 趟\n走 20–30 秒\n跑 200 米\n\n余下时间走动恢复\n记录：每轮完成用时',
    [presets[1]]: '公安专项标准\n每 6 分钟开始一轮 · 3 轮\n\n原地摸高 2 次\n10 米×4 折返 1 趟\n走 20–30 秒\n分轮跑 300、300、400 米\n\n余下时间走动恢复\n记录：每轮完成用时',
    [presets[2]]: '波比跳摸底\n计时完成\n\n100 个波比跳\n\n按自己熟悉的动作标准完成，保持动作稳定。\n记录：完成用时',
    [presets[4]]: '公安专项熟练版\n每 6 分钟开始一轮 · 3 轮\n\n原地摸高 2 次\n10 米×4 折返 1 趟\n走 20–30 秒\n跑 400 米\n\n余下时间走动恢复\n记录：每轮完成用时',
  };
  function renderSelectedPlan() {
    const selected = $('wod-plan').value;
    $('custom-field').hidden = selected !== '自定义' || $('plan-kind').value !== 'custom';
    $('current-plan-content').textContent = selected === '自定义'
      ? selectedDetail || $('custom-plan').value.trim() || '填写训练名称和总量，或在下方选择生成的计划。'
      : descriptions[selected] || '请选择训练版本。';
  }
  const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,10); };
  const format = (seconds) => `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  const displayPlanName = (name) => name
    .replace(' · 基础版 · ', ' · 简单版 · ')
    .replace(' · 标准版 · ', ' · 加强版 · ')
    .replace(' · 进阶版 · ', ' · 熟练版 · ');
  function parse(raw) {
    const s = raw.trim().replace('：', ':');
    const m = /^(\d+):([0-5]\d)$/.exec(s);
    const n = m ? Number(m[1])*60+Number(m[2]) : /^\d+$/.test(s) ? Number(s) : NaN;
    return n > 0 ? n : null;
  }
  function save(next) {
    try {
      if (unreadable) throw new Error();
      localStorage.setItem(key, JSON.stringify(next));
      records = next;
      return true;
    } catch {
      $('wod-status').textContent = '保存失败，请检查浏览器存储权限。';
      return false;
    }
  }
  function reset() {
    edit = null;
    $('wod-form').reset();
    $('wod-date').value = today();
    $('custom-field').hidden = true;
    $('wod-cancel').hidden = true;
    selectedDetail = '';
    $('wod-form-title').textContent = '本次训练计划';
    $('plan-kind').value = 'daily';
    loadSelectedWorkout();
  }
  function option(select, value, label) {
    const o = document.createElement('option'); o.value=value; o.textContent=label; select.append(o);
  }
  function render() {
    const people = [...new Set(records.map(r => r.person || ''))];
    const person = $('compare-person');
    const oldPerson = person.value;
    person.replaceChildren();
    option(person, '', '本人');
    people.filter(Boolean).sort().forEach(name => option(person,name,name));
    person.value = people.includes(oldPerson) ? oldPerson : '';
    $('people').replaceChildren();
    people.filter(Boolean).forEach(name => option($('people'),name,name));
    const plans = [...new Set(records.filter(r => (r.person||'')===person.value).map(r=>displayPlanName(r.plan)))];
    const select = $('compare-plan');
    const previous = select.value;
    select.replaceChildren();
    if (!plans.length) option(select,'','暂无记录');
    plans.forEach(name => option(select,name,name));
    select.value = plans.includes(previous) ? previous : (plans[0] || '');
    const matching = records.filter(r => (r.person||'')===person.value && displayPlanName(r.plan)===select.value)
      .sort((a,b)=>a.date.localeCompare(b.date)||a.created-b.created);
    const full = matching.filter(r=>r.complete==='full');
    const first=full[0], last=full.at(-1);
    const stats = [
      Number.isInteger(last?.rounds) ? ['完成轮数', `${last.rounds} 轮${last.extra ? ` + ${last.extra} 次` : ''}`, Number.isInteger(first?.rounds) && full.length>1 ? `首次 ${first.rounds} 轮${first.extra ? ` + ${first.extra} 次` : ''}` : '同一限时循环再次完成后可比较'] : ['完成用时', last ? format(last.seconds) : '—', first && last && full.length>1 ? `首次 ${format(first.seconds)}，${last.seconds<first.seconds?'快了':'差值'} ${format(Math.abs(last.seconds-first.seconds))}` : '完整完成两次后可比较'],
      ['呼吸恢复', last?.breath ? `${last.breath} 秒` : '—', first?.breath && last?.breath && full.length>1 ? `首次 ${first.breath} 秒` : '末轮结束到能说整句'],
      ['后程耐力', last?.pace || '—', '同版本训练的主观记录'],
      ['动作掌控', last?.control || '—', '记录落地、转身和动作稳定性'],
    ];
    $('wod-stats').replaceChildren();
    stats.forEach(([title,value,note]) => {
      const box=document.createElement('div'); box.className='wod-stat';
      for (const [tag,content] of [['span',title],['strong',value],['small',note]]) { const el=document.createElement(tag); el.textContent=content; box.append(el); }
      $('wod-stats').append(box);
    });
    $('wod-compare-hint').textContent = matching.length ? `此版本共 ${matching.length} 条，完整完成 ${full.length} 次。` : '保存一次 WOD，建立自己的起点。';
    const list=$('wod-records'); list.replaceChildren();
    $('wod-empty').hidden=records.length>0;
    $('wod-export').disabled=!records.length;
    [...records].sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created).forEach(r=>{
      const li=document.createElement('li'), title=document.createElement('div'), values=document.createElement('div'), actions=document.createElement('div');
      const time=document.createElement('time'); time.textContent=r.date; title.append(time);
      const sub=document.createElement('span'); sub.className='record-title'; sub.textContent=`${r.person||'本人'} · ${displayPlanName(r.plan)}`; title.append(sub);
      values.className='scores';
      [format(r.seconds),Number.isInteger(r.rounds)?`${r.rounds} 轮${r.extra?` + ${r.extra} 次`:''}`:'',r.breath?`恢复 ${r.breath} 秒`:'',r.pace,r.control,r.complete==='full'?'完成规定总量':'有减量或未完成'].filter(Boolean).forEach(text=>{const item=document.createElement('span');item.className='score';item.textContent=text;values.append(item);});
      actions.className='record-actions';
      const change=document.createElement('button');change.type='button';change.textContent='修改';change.onclick=()=>{
        edit=r.id; $('wod-date').value=r.date; $('person').value=r.person||'';
        $('wod-plan').value=presets.includes(r.plan)?r.plan:'自定义'; $('custom-field').hidden=$('wod-plan').value!=='自定义';
        $('custom-plan').value=presets.includes(r.plan)?'':r.plan; $('wod-time').value=format(r.seconds); $('wod-breath').value=r.breath||''; $('wod-rounds').value=r.rounds??''; $('wod-extra').value=r.extra??'';
        $('plan-kind').value = r.plan===presets[2] ? 'burpee' : [presets[0],presets[1],presets[4]].includes(r.plan) ? 'police' : 'custom';
        $('plan-tier').value = r.plan===presets[0] ? '简单版' : r.plan===presets[4] ? '熟练版' : '加强版';
        syncPlanControls();
        $('wod-pace').value=r.pace||''; $('wod-control').value=r.control||''; $('wod-complete').value=r.complete;
        selectedDetail=r.planDetail||''; renderSelectedPlan();
        $('wod-cancel').hidden=false; $('wod-form-title').textContent='修改训练记录'; $('wod-date').focus();
      };
      const del=document.createElement('button');del.type='button';del.textContent='删除';del.onclick=()=>{if(confirm('删除这条训练记录？')&&save(records.filter(x=>x.id!==r.id))){if(edit===r.id)reset();render();}};
      actions.append(change,del);li.append(title,values,actions);list.append(li);
    });
  }
  $('compare-person').onchange=render; $('compare-plan').onchange=render;
  $('wod-plan').onchange=()=>{selectedDetail='';renderSelectedPlan();};
  $('custom-plan').addEventListener('input',()=>{selectedDetail='';renderSelectedPlan();});
  $('wod-cancel').onclick=reset;
  $('wod-form').onsubmit=(event)=>{
    event.preventDefault();
    const seconds=parse($('wod-time').value), raw=$('wod-breath').value.trim();
    const breath=raw && /^\d+$/.test(raw) ? Number(raw) : null;
    const rawRounds=$('wod-rounds').value.trim();
    const rounds=rawRounds&&/^\d+$/.test(rawRounds)?Number(rawRounds):null;
    const rawExtra=$('wod-extra').value.trim();
    const extra=rawExtra&&/^\d+$/.test(rawExtra)?Number(rawExtra):null;
    const plan=$('wod-plan').value==='自定义'?$('custom-plan').value.trim():$('wod-plan').value;
    if(!seconds||!plan||(raw&&(!breath||breath<1))||(rawRounds&&rounds===null)||(rawExtra&&extra===null)||(rawExtra&&!rawRounds)){$('wod-status').textContent='请填写训练名称、用时，以及有效的恢复秒数和轮数。填写额外次数时也请填写整轮数。';return;}
    const old=records.find(r=>r.id===edit), created=old?.created||Date.now();
    const record={id:old?.id||`${created}-${Math.random()}`,created,date:$('wod-date').value,person:$('person').value.trim(),plan,planDetail:selectedDetail,seconds,rounds,extra,breath,pace:$('wod-pace').value,control:$('wod-control').value,complete:$('wod-complete').value};
    if(save(old?records.map(r=>r.id===edit?record:r):[...records,record])){reset();render();$('compare-person').value=record.person;render();$('compare-plan').value=displayPlanName(record.plan);render();$('wod-status').textContent='训练记录已保存。';}
  };
  function tick(){const seconds=Math.floor((Date.now()-clockStart)/1000);$('timer-display').textContent=format(seconds);}
  $('timer-action').onclick=()=>{
    if(clockMode==='idle'){clockMode='work';clockStart=Date.now();$('timer-caption').textContent='WOD 计时中';$('timer-action').textContent='完成 WOD';$('timer-reset').hidden=false;clockInterval=setInterval(tick,250);tick();}
    else if(clockMode==='work'){$('wod-time').value=format(Math.max(1,Math.floor((Date.now()-clockStart)/1000)));clockMode='recovery';clockStart=Date.now();$('timer-caption').textContent='恢复计时中';$('timer-action').textContent='能说整句了';tick();}
    else {$('wod-breath').value=String(Math.max(1,Math.floor((Date.now()-clockStart)/1000)));clearInterval(clockInterval);clockMode='idle';$('timer-caption').textContent='计时已填入';$('timer-action').textContent='开始 WOD';}
  };
  $('timer-reset').onclick=()=>{clearInterval(clockInterval);clockMode='idle';$('timer-caption').textContent='现场秒表';$('timer-display').textContent='00:00';$('timer-action').textContent='开始 WOD';$('timer-reset').hidden=true;};
  $('wod-export').onclick=()=>{
    const quote=(value)=>`"${String(value??'').replaceAll('"','""')}"`;
    const csv=[['日期','学员代号','训练版本','用时秒','完成整轮数','额外次数','恢复秒','后程','动作','完成情况'],...records.map(r=>[r.date,r.person,r.plan,r.seconds,r.rounds,r.extra,r.breath,r.pace,r.control,r.complete])].map(row=>row.map(quote).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='WOD训练记录.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $('effort-mode').onchange=()=>{$('feel-field').hidden=$('effort-mode').value!=='feel';$('rpe-field').hidden=$('effort-mode').value!=='rpe';};
  $('baseline-type').onchange=()=>{const type=$('baseline-type').value;$('baseline-value').disabled=!type;$('baseline-value').placeholder=type==='walk'?'距离（米）':type==='step'?'连续完成／有停顿':'用时，如 6:00';};
  $('plan-form').onsubmit=(event)=>{
    event.preventDefault();
    const rpe=$('rpe').value, mode=$('effort-mode').value;
    if(mode==='rpe'&&(rpe===''||Number(rpe)<0||Number(rpe)>10)){ $('plan-status').textContent='请填写 0–10 的 RPE。'; return; }
    const feel=mode==='rpe'?(Number(rpe)>=8?'hard':Number(rpe)<=4?'easy':'steady'):$('feel').value;
    const recover=$('recovery').value, control=$('control').value, regular=$('experience').value==='regular';
    const baseline=$('baseline-type').value;
    const baselineValue=$('baseline-value').value.trim();
    const burpeeTime=baseline==='burpee'&&baselineValue?parse(baselineValue):null;
    if(baseline==='burpee'&&baselineValue&&!burpeeTime){$('plan-status').textContent='波比跳用时请填分:秒或整数秒。';return;}
    const light=feel==='hard'||recover==='slow'||control==='variable'||(burpeeTime!==null&&burpeeTime>=600);
    const advance=!light&&regular&&feel==='easy'&&recover==='fast'&&control==='stable';
    const scene=$('scene').value;
    const tier=light||!regular?'简单版':advance?'熟练版':'加强版';
    $('daily-tier').value=tier;
    $('daily-scene').value=scene;
    const day=dayInfo(Date.parse(`${$('daily-date').value}T00:00:00Z`));
    $('plan-name').textContent=`${scene==='home'?'居家':'户外'} · ${day.level} · ${day.name}`;
    $('plan-reason').textContent=(light?'依据最近一课的体感、恢复、动作表现或波比跳摸底，先降低训练量。':advance?'近期训练规律、动作稳定且恢复快，可以尝试熟练版。':'根据近期训练基础选择当前版本。')+(burpeeTime!==null?' 波比跳分组为带训经验参考，公安体测以岗位公告和实测为准。':'');
    $('plan-steps').textContent=day.body;
    $('plan-status').textContent='';$('plan-result').hidden=false;planName=`${day.name} · ${day.level} · ${scene==='home'?'居家':'户外'}`;
    renderDay();
  };
  $('use-plan').onclick=()=>{$('plan-kind').value='daily';$('plan-tier').value=$('daily-tier').value;$('plan-scene').value=$('daily-scene').value;$('wod-date').value=$('daily-date').value;$('wod-plan').value='自定义';$('custom-plan').value=planName;selectedDetail=$('plan-steps').textContent;syncPlanControls();renderSelectedPlan();$('workout').scrollIntoView();};
  const start = Date.UTC(2026,10,11);
  const end = Date.UTC(2027,0,30);
  function dayInfo(ms) {
    const index=Math.round((ms-start)/86400000);
    return {date:new Date(ms).toISOString().slice(0,10),...window.fitnessWorkout(index,$('daily-tier').value,$('daily-scene').value)};
  }
  function renderDay() {
    const ms=Date.parse(`${$('daily-date').value}T00:00:00Z`);
    if(!Number.isFinite(ms)||ms<start||ms>end){$('daily-title').textContent='请选择计划范围内的日期';$('daily-body').textContent='';return;}
    const d=dayInfo(ms);$('daily-title').textContent=d.date;$('daily-body').textContent=d.body;
    $('daily-list').replaceChildren();
    for(let day=start;day<=end;day+=86400000){const item=dayInfo(day),p=document.createElement('p');p.textContent=`${item.date}\n${item.body}`; $('daily-list').append(p);}
  }
  $('daily-date').value=today()>='2026-11-11'&&today()<='2027-01-30'?today():'2026-11-11';
  $('daily-date').onchange=renderDay;
  $('daily-tier').onchange=renderDay;
  $('daily-scene').onchange=renderDay;
  function syncPlanControls() {
    const kind=$('plan-kind').value;
    $('plan-tier-field').hidden=kind==='burpee'||kind==='custom';
    $('plan-scene-field').hidden=kind!=='daily';
  }
  function loadSelectedWorkout() {
    syncPlanControls();
    const kind=$('plan-kind').value;
    selectedDetail='';
    if(kind==='daily') {
      const ms=Date.parse(`${$('wod-date').value}T00:00:00Z`);
      $('wod-plan').value='自定义';
      if(!Number.isFinite(ms)||ms<start||ms>end) {
        $('custom-plan').value='';
        selectedDetail='请把训练日期设在 2026 年 11 月 11 日至 2027 年 1 月 30 日，或选择自定义训练。';
      } else {
        $('daily-date').value=$('wod-date').value;
        $('daily-tier').value=$('plan-tier').value;
        $('daily-scene').value=$('plan-scene').value;
        const d=dayInfo(ms);
        $('custom-plan').value=`${d.name} · ${d.level} · ${$('plan-scene').value==='home'?'居家':'户外'}`;
        selectedDetail=d.body;
        renderDay();
      }
    } else if(kind==='police') {
      const tier=$('plan-tier').value;
      $('wod-plan').value=tier==='简单版'?presets[0]:tier==='熟练版'?presets[4]:presets[1];
    } else if(kind==='burpee') {
      $('wod-plan').value=presets[2];
    } else {
      $('wod-plan').value='自定义';
      $('custom-plan').value='';
    }
    renderSelectedPlan();
  }
  $('plan-kind').onchange=loadSelectedWorkout;
  $('plan-tier').onchange=loadSelectedWorkout;
  $('plan-scene').onchange=loadSelectedWorkout;
  $('wod-date').onchange=()=>{if(!edit&&$('plan-kind').value==='daily')loadSelectedWorkout();};
  $('daily-use').onclick=()=>{const ms=Date.parse(`${$('daily-date').value}T00:00:00Z`);if(!Number.isFinite(ms)||ms<start||ms>end)return;const d=dayInfo(ms);$('plan-kind').value='daily';$('plan-tier').value=$('daily-tier').value;$('plan-scene').value=$('daily-scene').value;$('wod-date').value=d.date;loadSelectedWorkout();$('workout').scrollIntoView();};
  renderDay();
  $('feedback-form').onsubmit=(event)=>{event.preventDefault();const subject=encodeURIComponent(`体能训练网页·${$('feedback-kind').value}`),body=encodeURIComponent($('feedback-text').value);location.href=`mailto:411515586@qq.com?subject=${subject}&body=${body}`;$('feedback-status').textContent='请在邮件应用中确认并发送。';};
  $('feedback-copy').onclick=async()=>{try{await navigator.clipboard.writeText(`【${$('feedback-kind').value}】\n${$('feedback-text').value}`);$('feedback-status').textContent='已复制，可粘贴到邮件发送。';}catch{$('feedback-status').textContent='请选中文字复制，发送到下方邮箱。';}};
  reset();render();
})();
