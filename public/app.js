const S=[['todo','ยังไม่ได้ทำ'],['doing','กำลังทำ'],['testing','กำลังทดสอบ'],['done','เสร็จแล้ว']];
const $=x=>document.getElementById(x);
let all=[],sel=new Set(),fsSel=new Set(),editId=null,dResolve=null;
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const esc=s=>{let d=document.createElement('div');d.textContent=s||'';return d.innerHTML};
const label=k=>S.find(x=>x[0]===k)?.[1]||k;

// Custom dialog: ใช้แทน native confirm()/alert()
function showDialog({mode='alert',title,msg='',okText='ตกลง',cancelText='ยกเลิก',danger=false}={}){
  return new Promise(resolve=>{
    if(dResolve)dResolve(false);
    dResolve=resolve;
    $('dTitle').textContent=title||(mode==='confirm'?'ยืนยัน':'แจ้งเตือน');
    $('dMsg').textContent=msg;
    $('dOk').textContent=okText;
    $('dCancel').textContent=cancelText;
    $('dCancel').style.display=mode==='confirm'?'':'none';
    $('dOk').className=danger?'del':'';
    $('dialog').classList.remove('hidden');
    setTimeout(()=>$('dOk').focus(),50);
  });
}
function closeDialog(result){
  $('dialog').classList.add('hidden');
  const r=dResolve;dResolve=null;
  if(r)r(result);
}
const confirmDialog=(msg,opts={})=>showDialog({mode:'confirm',msg,...opts});
const alertDialog=(msg,opts={})=>showDialog({mode:'alert',msg,...opts}).then(()=>{});

$('dOk').onclick=()=>closeDialog(true);
$('dCancel').onclick=()=>closeDialog(false);
$('dialog').onclick=e=>{if(e.target===$('dialog'))closeDialog(false)};

async function load(){
  all=await fetch('/api/tasks').then(r=>r.json());
  const ids=new Set(all.map(x=>x.id));
  sel=new Set([...sel].filter(id=>ids.has(id)));
  render();
}

function view(){
  const f=$('from').value,t=$('to').value;
  return all.filter(x=>(!f||x.date>=f)&&(!t||x.date<=t)&&(fsSel.size===0||fsSel.has(x.status)));
}

function render(){
  const a=view();
  $('total').textContent=`แสดง ${a.length} จาก ${all.length} รายการ`;
  $('sum').innerHTML=S.map(([k,n])=>`<div class="card"><span class="pill ${k}">${n}</span><strong>${a.filter(x=>x.status===k).length}</strong></div>`).join('');

  const visIds=a.map(x=>x.id);
  const selVis=[...sel].filter(id=>visIds.includes(id));
  if(selVis.length){
    $('bulk').classList.remove('hidden');
    $('bulkCount').textContent=selVis.length;
  }else{
    $('bulk').classList.add('hidden');
  }

  const allChecked=a.length>0&&a.every(x=>sel.has(x.id));
  $('selAll').checked=allChecked;
  $('selAll').indeterminate=selVis.length>0&&!allChecked;

  $('tasks').innerHTML=a.length?a.map(t=>`<div class="task row-${t.status}">
    <input type="checkbox" class="chk" ${sel.has(t.id)?'checked':''} onchange="tog('${t.id}')">
    <div class="info">
      <div class="title"><b>${esc(t.name)}</b><span class="pill ${t.status}">${label(t.status)}</span></div>
      ${t.detail?`<p>${esc(t.detail)}</p>`:''}
      <small>วันที่สร้าง: ${esc(t.date)}</small>
    </div>
    <select onchange="chg('${t.id}',this.value)">${S.map(([k,n])=>`<option value="${k}" ${t.status===k?'selected':''}>${n}</option>`).join('')}</select>
    <button class="edit" onclick="openEdit('${t.id}')">แก้ไข</button>
    <button class="del" onclick="del('${t.id}')">ลบ</button>
  </div>`).join(''):'<div class="empty">ไม่พบงาน</div>';
}

['from','to'].forEach(x=>$(x).onchange=render);
$('fs').addEventListener('click',e=>{
  const s=e.target.dataset.status;
  if(!s)return;
  if(fsSel.has(s)){fsSel.delete(s);e.target.classList.remove('active')}
  else{fsSel.add(s);e.target.classList.add('active')}
  render();
});
$('clear').onclick=()=>{
  $('from').value=$('to').value='';
  fsSel.clear();
  document.querySelectorAll('#fs .pill-btn.active').forEach(b=>b.classList.remove('active'));
  render();
};

$('form').onsubmit=async e=>{
  e.preventDefault();
  const r=await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('name').value,detail:$('detail').value,status:$('status').value,date:today()})});
  if(r.ok){$('name').value=$('detail').value='';$('status').value='todo';load()}
};

async function chg(id,status){
  await fetch('/api/tasks/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});
  load();
}

async function del(id){
  const t=all.find(x=>x.id===id);
  if(!await confirmDialog(`ลบงาน "${t?.name||''}" ?`,{title:'ยืนยันการลบ',okText:'ลบ',danger:true}))return;
  try{
    const r=await fetch('/api/tasks/'+id,{method:'DELETE'});
    if(!r.ok){alertDialog(`ลบไม่สำเร็จ (HTTP ${r.status})`);return}
    sel.delete(id);load();
  }catch(e){alertDialog('ลบไม่สำเร็จ: '+e.message)}
}

function tog(id){
  if(sel.has(id))sel.delete(id);
  else sel.add(id);
  render();
}

$('selAll').onchange=e=>{
  const a=view();
  if(e.target.checked)a.forEach(x=>sel.add(x.id));
  else a.forEach(x=>sel.delete(x.id));
  render();
};

$('bulkClear').onclick=()=>{sel.clear();render()};

$('bulkDel').onclick=async()=>{
  const a=view();
  const ids=[...sel].filter(id=>a.some(x=>x.id===id));
  if(!ids.length)return;
  if(!await confirmDialog(`ลบ ${ids.length} รายการที่เลือกใช่หรือไม่?`,{title:'ยืนยันการลบ',okText:'ลบทั้งหมด',danger:true}))return;
  try{
    const r=await fetch('/api/tasks/bulk-delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})});
    if(!r.ok){alertDialog(`ลบไม่สำเร็จ (HTTP ${r.status})\nกรุณารีสตาร์ท server เพื่อโหลด endpoint ใหม่`);return}
    sel.clear();load();
  }catch(e){alertDialog('ลบไม่สำเร็จ: '+e.message)}
};

function openEdit(id){
  const t=all.find(x=>x.id===id);
  if(!t)return;
  editId=id;
  $('eName').value=t.name;
  $('eDetail').value=t.detail||'';
  $('editModal').classList.remove('hidden');
  setTimeout(()=>$('eName').focus(),50);
}

function closeEdit(){
  editId=null;
  $('editModal').classList.add('hidden');
}

$('eCancel').onclick=closeEdit;
$('editModal').onclick=e=>{if(e.target===$('editModal'))closeEdit()};
$('eName').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('eSave').click()}};

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(!$('dialog').classList.contains('hidden'))closeDialog(false);
    else if(!$('editModal').classList.contains('hidden'))closeEdit();
  }else if(e.key==='Enter'&&!$('dialog').classList.contains('hidden')){
    e.preventDefault();closeDialog(true);
  }
});

$('eSave').onclick=async()=>{
  if(!editId)return;
  const name=$('eName').value.trim();
  const detail=$('eDetail').value.trim();
  if(!name){await alertDialog('กรุณากรอกชื่องาน');$('eName').focus();return}
  try{
    const r=await fetch('/api/tasks/'+editId,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,detail})});
    if(!r.ok){alertDialog(`บันทึกไม่สำเร็จ (HTTP ${r.status})`);return}
    closeEdit();load();
  }catch(e){alertDialog('บันทึกไม่สำเร็จ: '+e.message)}
};

load();
