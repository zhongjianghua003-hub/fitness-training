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
  const presets = ['公安专项入门：2轮，每轮摸高2次、折返1趟、跑200米', '公安专项标准：3轮，每轮摸高2次、折返1趟，分段跑300／300／400米', '100个波比跳（熟练者摸底）', '自定义'];
  for (const name of presets) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    $('wod-plan').append(option);
  }
  const descriptions = {
    [presets[0]]: '共 2 轮，每 6 分钟开始一轮。每轮原地摸高 2 次，10 米×4 折返 1 趟，走 20–30 秒后跑 200 米。余下时间走动恢复。',
    [presets[1]]: '共 3 轮，每 6 分钟开始一轮。每轮原地摸高 2 次，10 米×4 折返 1 趟，走 20–30 秒后分轮跑 300、300、400 米。余下时间走动恢复。',
    [presets[2]]: '完成 100 个波比跳并记录用时。按自己熟悉的动作标准完成，保持动作稳定。',
  };
  function renderSelectedPlan() {
    const selected = $('wod-plan').value;
    $('custom-field').hidden = selected !== '自定义';
    $('current-plan-content').textContent = selected === '自定义'
      ? selectedDetail || $('custom-plan').value.trim() || '填写训练名称和总量，或在下方选择生成的计划。'
      : descriptions[selected] || '请选择训练版本。';
  }
  const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,10); };
  const format = (seconds) => `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
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
    renderSelectedPlan();
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
    const plans = [...new Set(records.filter(r => (r.person||'')===person.value).map(r=>r.plan))];
    const select = $('compare-plan');
    const previous = select.value;
    select.replaceChildren();
    if (!plans.length) option(select,'','暂无记录');
    plans.forEach(name => option(select,name,name));
    select.value = plans.includes(previous) ? previous : (plans[0] || '');
    const matching = records.filter(r => (r.person||'')===person.value && r.plan===select.value)
      .sort((a,b)=>a.date.localeCompare(b.date)||a.created-b.created);
    const full = matching.filter(r=>r.complete==='full');
    const first=full[0], last=full.at(-1);
    const stats = [
      ['完成用时', last ? format(last.seconds) : '—', first && last && full.length>1 ? `首次 ${format(first.seconds)}，${last.seconds<first.seconds?'快了':'差值'} ${format(Math.abs(last.seconds-first.seconds))}` : '完整完成两次后可比较'],
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
      const sub=document.createElement('span'); sub.className='record-title'; sub.textContent=`${r.person||'本人'} · ${r.plan}`; title.append(sub);
      values.className='scores';
      [format(r.seconds),r.breath?`恢复 ${r.breath} 秒`:'',r.pace,r.control,r.complete==='full'?'完成规定总量':'有减量或未完成'].filter(Boolean).forEach(text=>{const item=document.createElement('span');item.className='score';item.textContent=text;values.append(item);});
      actions.className='record-actions';
      const change=document.createElement('button');change.type='button';change.textContent='修改';change.onclick=()=>{
        edit=r.id; $('wod-date').value=r.date; $('person').value=r.person||'';
        $('wod-plan').value=presets.includes(r.plan)?r.plan:'自定义'; $('custom-field').hidden=$('wod-plan').value!=='自定义';
        $('custom-plan').value=presets.includes(r.plan)?'':r.plan; $('wod-time').value=format(r.seconds); $('wod-breath').value=r.breath||'';
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
    const plan=$('wod-plan').value==='自定义'?$('custom-plan').value.trim():$('wod-plan').value;
    if(!seconds||!plan||(raw&&(!breath||breath<1))){$('wod-status').textContent='请填写训练名称、用时，以及有效的恢复秒数。';return;}
    const old=records.find(r=>r.id===edit), created=old?.created||Date.now();
    const record={id:old?.id||`${created}-${Math.random()}`,created,date:$('wod-date').value,person:$('person').value.trim(),plan,planDetail:selectedDetail,seconds,breath,pace:$('wod-pace').value,control:$('wod-control').value,complete:$('wod-complete').value};
    if(save(old?records.map(r=>r.id===edit?record:r):[...records,record])){reset();render();$('compare-person').value=record.person;render();$('compare-plan').value=record.plan;render();$('wod-status').textContent='训练记录已保存。';}
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
    const csv=[['日期','学员代号','训练版本','用时秒','恢复秒','后程','动作','完成情况'],...records.map(r=>[r.date,r.person,r.plan,r.seconds,r.breath,r.pace,r.control,r.complete])].map(row=>row.map(quote).join(',')).join('\r\n');
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
    const rounds=light?2:advance?4:regular?3:2;
    const scene=$('scene').value;
    const title=`${scene==='home'?'居家':'户外'} · ${light?'调整版':advance?'进阶版':'基础版'} · ${rounds} 轮`;
    const steps=scene==='home'?
      ['热身 6–8 分钟：原地踏步、活动肩髋踝、徒手深蹲。',`主训练 ${rounds} 轮：原地快步 90 秒，坐站深蹲 8 次，靠墙俯卧撑 8 次，原地交替抬膝 20 次。每轮休息 60–90 秒。`,'收操 5 分钟：慢走、自然呼吸和轻柔活动。']:
      ['热身 6–8 分钟：慢走慢跑，活动肩髋踝，逐步加快。',`主训练 ${rounds} 轮：轻松跑或快走 2 分钟，徒手深蹲 8 次，站姿提踵 12 次，原地抬膝 20 次。每轮休息 60–90 秒。`,'收操 5 分钟：走路，逐步放慢并恢复呼吸。'];
    $('plan-name').textContent=title;
    $('plan-reason').textContent=(light?'依据最近一课的体感、恢复、动作表现或波比跳摸底，先降低训练量。':advance?'近期训练规律、动作稳定且恢复快，可在基础版上多做一轮。':'先用基础训练量建立可重复的记录。')+(burpeeTime!==null?' 波比跳分组为带训经验参考，公安体测以岗位公告和实测为准。':'');
    $('plan-steps').replaceChildren(); steps.forEach(text=>{const li=document.createElement('li');li.textContent=text;$('plan-steps').append(li);});
    $('plan-status').textContent='';$('plan-result').hidden=false;planName=title;
  };
  $('use-plan').onclick=()=>{$('wod-plan').value='自定义';$('custom-plan').value=planName;selectedDetail=[...$('plan-steps').children].map(item=>item.textContent).join('\n');renderSelectedPlan();$('workout').scrollIntoView();};
  const start = Date.UTC(2026,10,11);
  const end = Date.UTC(2027,0,30);
  const activities = [
    ['有氧间歇','每轮快步或慢跑 2 分钟，再慢走 1 分钟。居家用原地快步替换跑步。'],
    ['轻松恢复','快走或居家原地走 20–30 分钟，能说完整句子。'],
    ['基础力量','每轮坐站深蹲 10 次、靠墙俯卧撑 8 次、臀桥 10 次、站姿提踵 12 次。轮间休息 60–90 秒。'],
    ['有氧耐力','连续快走或轻松跑 20–30 分钟。居家改为 5 组原地踏步 4 分钟，组间慢走 1 分钟。'],
    ['综合 WOD','每轮原地快步 90 秒、徒手深蹲 8 次、靠墙俯卧撑 8 次、交替抬膝 20 次。轮间休息 60–90 秒。'],
    ['动作与力量','每轮反向箭步蹲左右各 6 次、臀桥 10 次、站姿提踵 12 次。动作平稳，轮间休息 60–90 秒。'],
    ['恢复日','休息，或轻松走 15–20 分钟并做舒适范围的肩髋踝活动。'],
  ];
  let dailyRounds=2;
  function dayInfo(ms) {
    const index=Math.round((ms-start)/86400000), week=Math.floor(index/7), activity=activities[index%7];
    const deload=week%4===3;
    const rounds=deload?Math.min(dailyRounds,2):dailyRounds;
    const isRounds=[0,2,4,5].includes(index%7);
    return {date:new Date(ms).toISOString().slice(0,10),name:activity[0],body:activity[1],scale:isRounds?`今天做 ${rounds} 轮${deload?'，本周减量':''}。体感过重或动作变形时减一轮。`:'按当天体感调整速度。'};
  }
  function renderDay() {
    const ms=Date.parse(`${$('daily-date').value}T00:00:00Z`);
    if(!Number.isFinite(ms)||ms<start||ms>end){$('daily-title').textContent='请选择计划范围内的日期';$('daily-body').textContent='';$('daily-scale').textContent='';return;}
    const d=dayInfo(ms);$('daily-title').textContent=`${d.date} · ${d.name}`;$('daily-body').textContent=d.body;$('daily-scale').textContent=d.scale;
  }
  $('daily-date').value=today()>='2026-11-11'&&today()<='2027-01-30'?today():'2026-11-11';
  $('daily-date').onchange=renderDay;
  for(let ms=start;ms<=end;ms+=86400000){const d=dayInfo(ms),p=document.createElement('p');p.textContent=`${d.date}  ${d.name}。 ${d.body}`; $('daily-list').append(p);}
  $('plan-form').addEventListener('submit',()=>{const text=$('plan-name').textContent;dailyRounds=text.includes('调整版')?2:text.includes('进阶版')?4:3;renderDay();});
  $('daily-use').onclick=()=>{const ms=Date.parse(`${$('daily-date').value}T00:00:00Z`);if(!Number.isFinite(ms)||ms<start||ms>end)return;const d=dayInfo(ms);$('wod-plan').value='自定义';$('custom-plan').value=`${d.name} · ${d.scale}`;selectedDetail=`${d.name}\n${d.body}\n${d.scale}`;renderSelectedPlan();$('wod-date').value=d.date;$('workout').scrollIntoView();};
  renderDay();
  $('feedback-form').onsubmit=(event)=>{event.preventDefault();const subject=encodeURIComponent(`体能训练网页·${$('feedback-kind').value}`),body=encodeURIComponent($('feedback-text').value);location.href=`mailto:411515586@qq.com?subject=${subject}&body=${body}`;$('feedback-status').textContent='请在邮件应用中确认并发送。';};
  $('feedback-copy').onclick=async()=>{try{await navigator.clipboard.writeText(`【${$('feedback-kind').value}】\n${$('feedback-text').value}`);$('feedback-status').textContent='已复制，可粘贴到邮件发送。';}catch{$('feedback-status').textContent='请选中文字复制，发送到下方邮箱。';}};
  reset();render();
})();
