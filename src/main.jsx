import React,{useState}from'react';
import{createRoot}from'react-dom/client';
import'./style.css';

const STORE_KEY='kamdhenu-point-local-v1';
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const money=n=>'₹'+new Intl.NumberFormat('hi-IN',{maximumFractionDigits:2}).format(Number(n)||0);
const number=n=>new Intl.NumberFormat('hi-IN',{maximumFractionDigits:2}).format(Number(n)||0);
const milkLabel=k=>k==='cow'?'गाय':'भैंस';
const shiftLabel=k=>k==='evening'?'शाम':'सुबह';
const DEFAULT_STATE={rows:[],transactions:[],rates:{cow_rate:0,buffalo_rate:0},buyers:[]};
const blankForm=(rates=null)=>({sale_date:today(),shift:'morning',buyer:'',milk_type:'cow',quantity:'',rate:rates?String(rates.cow_rate??0):'',remarks:''});
const blankTransaction=()=>({date:today(),kind:'received',amount:'',party:'',category:'paddy_stalk',remarks:''});
const expenseCategories=[
 {value:'paddy_stalk',label:'धान का पुआल'},
 {value:'cattle_feed',label:'पशु आहार'},
 {value:'khali',label:'खली'},
 {value:'chokar',label:'चोकर'},
 {value:'wheat_straw',label:'गेहूँ का भूसा'},
 {value:'others',label:'अन्य'}
];
function readStore(){
 try{
  const raw=localStorage.getItem(STORE_KEY);
  if(!raw)return structuredClone(DEFAULT_STATE);
  const p=JSON.parse(raw);
  if(!p||!Array.isArray(p.rows)||!p.rates||!Array.isArray(p.buyers))throw new Error('सहेजे गए बही-खाते का प्रारूप अमान्य है।');
  return {...DEFAULT_STATE,...p,transactions:Array.isArray(p.transactions)?p.transactions:[],rates:{...DEFAULT_STATE.rates,...p.rates}};
 }catch(err){console.error(err);return structuredClone(DEFAULT_STATE)}
}
function RadioChoices({value,onChange,options,name}){
 return <div className="radio-group" role="radiogroup">{options.map(o=><label className={'radio-choice '+(value===o.value?'chosen':'')} key={o.value}><input type="radio" name={name} value={o.value} checked={value===o.value} onChange={()=>onChange(o.value)}/><span>{o.label}</span></label>)}</div>;
}
function App(){
 const [store,setStore]=useState(readStore),[tab,setTab]=useState('Milk'),[month,setMonth]=useState(today().slice(0,7));
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [form,setForm]=useState(()=>blankForm(readStore().rates)),[edit,setEdit]=useState(null);
 const [txForm,setTxForm]=useState(blankTransaction()),[txEdit,setTxEdit]=useState(null);

 function report(err){setError(String(err?.message||err||'यह कार्य पूरा नहीं हो सका।'));setNotice('')}
 function success(msg){setNotice(msg);setError('')}
 function persist(next){
  try{localStorage.setItem(STORE_KEY,JSON.stringify(next))}catch(err){report('ब्राउज़र में संग्रहण स्थान उपलब्ध नहीं है। बैकअप लेकर कुछ स्थान खाली करें।');return false}
  setStore(next);return true;
 }
 function exportBackup(){
  const blob=new Blob([JSON.stringify({schema:3,exportedAt:new Date().toISOString(),...store},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='kamdhenu-backup-'+today()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);success('बैकअप डाउनलोड हो गया।');
 }
 function importBackup(e){
  const file=e.target.files?.[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
   try{
    const d=JSON.parse(String(reader.result));
    if(!d||!Array.isArray(d.rows)||!d.rates||!Array.isArray(d.buyers))throw new Error('यह कामधेनु का वैध बैकअप नहीं है।');
    const next={rows:d.rows,transactions:Array.isArray(d.transactions)?d.transactions:[],rates:{cow_rate:Number(d.rates.cow_rate)||0,buffalo_rate:Number(d.rates.buffalo_rate)||0},buyers:d.buyers.map(String)};
    if(window.confirm('क्या वर्तमान बही-खाते को चुने गए बैकअप से बदलना है?')&&persist(next))success('बैकअप पुनर्स्थापित हो गया।');
   }catch(err){report(err)}finally{e.target.value=''}
  };
  reader.onerror=()=>report('बैकअप फ़ाइल पढ़ी नहीं जा सकी।');
  reader.readAsText(file);
 }
 function saveMilk(e){
  e.preventDefault();
  const quantity=Number(form.quantity),rate=Number(form.rate),milkman=form.buyer.trim();
  if(!form.sale_date||!milkman||!String(form.quantity).trim()||!String(form.rate).trim()||!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(rate)||rate<0)return report('दिनांक, दूधवाले का नाम, शून्य से अधिक मात्रा और वैध दर दर्ज करें।');
  const payload={sale_date:form.sale_date,shift:form.shift||'morning',buyer:milkman,milk_type:form.milk_type,quantity,rate,amount:Math.round(quantity*rate*100)/100,remarks:form.remarks.trim()||null,updated_at:new Date().toISOString()};
  const next={
   ...store,
   rows:edit?store.rows.map(x=>x.id===edit?{...x,...payload}:x):[{...payload,id:crypto.randomUUID(),created_at:new Date().toISOString()},...store.rows],
   buyers:[...new Set([...(store.buyers||[]),milkman])],
   rates:{...store.rates,[form.milk_type+'_rate']:rate}
  };
  if(persist(next)){setEdit(null);setForm(blankForm(next.rates));success(edit?'दूध की प्रविष्टि संशोधित हुई।':'दूध दर्ज हो गया।')}
 }
 function beginMilkEdit(row){
  setEdit(row.id);
  setForm({sale_date:row.sale_date,shift:row.shift||'morning',buyer:row.buyer||'',milk_type:row.milk_type,quantity:String(row.quantity),rate:String(row.rate),remarks:row.remarks||''});
  setTab('Milk');
 }
 function removeMilk(id){if(window.confirm('क्या यह दूध प्रविष्टि हटाएँ?')&&persist({...store,rows:store.rows.filter(x=>x.id!==id)}))success('दूध प्रविष्टि हटा दी गई।')}
 function saveTransaction(e){
  e.preventDefault();
  const amount=Number(txForm.amount);
  if(!txForm.date||!String(txForm.amount).trim()||!Number.isFinite(amount)||amount<=0)return report('वैध दिनांक और शून्य से अधिक राशि दर्ज करें।');
  if(txForm.kind==='expense'&&!txForm.category)return report('खर्च का मद चुनें।');
  const payload={...txForm,amount,party:txForm.party.trim(),remarks:txForm.remarks.trim(),updated_at:new Date().toISOString()};
  const next={...store,transactions:txEdit?store.transactions.map(x=>x.id===txEdit?{...x,...payload}:x):[{...payload,id:crypto.randomUUID(),created_at:new Date().toISOString()},...store.transactions]};
  if(persist(next)){setTxEdit(null);setTxForm(blankTransaction());success(txEdit?'लेन-देन संशोधित हुआ।':'लेन-देन दर्ज हो गया।')}
 }
 function beginTransactionEdit(t){setTxEdit(t.id);setTxForm({...t,amount:String(t.amount)});setTab('Transactions')}
 function removeTransaction(id){if(window.confirm('क्या यह लेन-देन हटाएँ?')&&persist({...store,transactions:store.transactions.filter(x=>x.id!==id)}))success('लेन-देन हटा दिया गया।')}
 function exportCsv(){
  const data=store.rows.filter(x=>x.sale_date.startsWith(month));
  const lines=[['दिनांक','दूधवाला','समय','दूध का प्रकार','मात्रा (लीटर)','दर','राशि','टिप्पणी'],...data.map(x=>[x.sale_date,x.buyer,shiftLabel(x.shift),milkLabel(x.milk_type),x.quantity,x.rate,x.amount,x.remarks||''])];
  const csv=lines.map(row=>row.map(x=>{let v=String(x??'');if(/^[\t\r ]*[=+@-]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"'}).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='kamdhenu-doodh-'+month+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 const monthEndDay=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();
 const monthEnd=month===today().slice(0,7)?today():month+'-'+monthEndDay;
 const cutoff=month>today().slice(0,7)?month+'-01':monthEnd;
 const monthMilk=store.rows.filter(x=>x.sale_date.startsWith(month)&&x.sale_date<=cutoff);
 const monthTransactions=store.transactions.filter(x=>x.date.startsWith(month)&&x.date<=cutoff);
 const todayMilk=store.rows.filter(x=>x.sale_date===today());
 const total=xs=>xs.reduce((sum,x)=>sum+Number(x.amount||0),0);
 const qty=xs=>xs.reduce((sum,x)=>sum+Number(x.quantity||0),0);
 const received=monthTransactions.filter(x=>x.kind==='received');
 const remained=monthTransactions.filter(x=>x.kind==='remained');
 const advanced=monthTransactions.filter(x=>x.kind==='advance');
 const expenses=monthTransactions.filter(x=>x.kind==='expense');
 const receivedTotal=total(received),remainedTotal=total(remained),advancedTotal=total(advanced),expenseTotal=total(expenses);
 const netAmount=receivedTotal-advancedTotal-expenseTotal;
 const milkToday=qty(todayMilk),milkToDate=qty(monthMilk);
 const milkmanLabel='दूधवाला (Milkman)';

 return <div className="app">
  <header>
   <div className="brand-mark">क</div>
   <div className="brand-copy"><b>कामधेनु</b><small>दूध एवं दैनिक हिसाब</small></div>
   <label className="backup-label">बैकअप पुनर्स्थापित करें<input type="file" accept="application/json,.json" onChange={importBackup}/></label>
   <button className="header-action" onClick={exportBackup}>बैकअप लें</button>
  </header>
  <div className="storage-notice">हिसाब इसी डिवाइस के ब्राउज़र में सुरक्षित रहता है। नियमित रूप से बैकअप लें।</div>
  <section className="hero">
   <div className="hero-top"><span>मासिक सारांश</span><label className="hero-month"><input aria-label="माह चुनें" type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label></div>
   <div className="hero-metrics">
    <div className="hero-milk"><small>दूध आज तक</small><strong>{number(milkToDate)}<i>लीटर</i></strong><span>गाय {number(qty(monthMilk.filter(x=>x.milk_type==='cow')))} L · भैंस {number(qty(monthMilk.filter(x=>x.milk_type==='buffalo')))} L</span></div>
    <div className="hero-net"><small>शुद्ध राशि</small><strong>{money(netAmount)}</strong><span>प्राप्ति − अग्रिम − खर्च</span></div>
   </div>
   <div className="hero-foot"><span>आज का दूध</span><b>{number(milkToday)} लीटर</b><span>आज की बिक्री</span><b>{money(total(todayMilk))}</b></div>
  </section>
  <nav aria-label="मुख्य मेनू">
   <button className={tab==='Milk'?'active':''} onClick={()=>{setTab('Milk');setError('');setNotice('')}}>दूध</button>
   <button className={tab==='Transactions'?'active':''} onClick={()=>{setTab('Transactions');setError('');setNotice('')}}>लेन-देन</button>
  </nav>
  <main>
   <div className="heading-row"><h1>{tab==='Milk'?'दूध दर्ज करें':'लेन-देन दर्ज करें'}</h1></div>
   {error&&<p className="error" role="alert">{error}</p>}
   {notice&&<p className="notice" role="status">{notice}</p>}
   {tab==='Milk'&&<>
    <form className="entry-form" onSubmit={saveMilk}>
     <label>{milkmanLabel}<input className="text-input full-text" value={form.buyer} onChange={e=>setForm({...form,buyer:e.target.value})} placeholder="नाम लिखें" required/></label>
     <div className="field-pair">
      <label>दिनांक<input className="date-input" type="date" value={form.sale_date} onChange={e=>setForm({...form,sale_date:e.target.value})} required/></label>
      <label>समय<RadioChoices name="milk-shift" value={form.shift} onChange={v=>setForm({...form,shift:v})} options={[{value:'morning',label:'सुबह'},{value:'evening',label:'शाम'}]}/></label>
     </div>
     <div className="field-triple">
      <label>मात्रा (लीटर)<input className="number-input" type="number" min=".01" step=".01" inputMode="decimal" placeholder="0" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} required/></label>
      <label>दर (₹)<input className="number-input" type="number" min="0" step=".01" inputMode="decimal" placeholder="0" value={form.rate} onChange={e=>setForm({...form,rate:e.target.value})} required/></label>
      <label>प्रकार<RadioChoices name="milk-type" value={form.milk_type} onChange={v=>setForm({...form,milk_type:v,rate:String(store.rates[v+'_rate']??0)})} options={[{value:'cow',label:'गाय'},{value:'buffalo',label:'भैंस'}]}/></label>
     </div>
     <label>टिप्पणी<textarea className="comment-input" rows="2" value={form.remarks} onChange={e=>setForm({...form,remarks:e.target.value})} placeholder="वैकल्पिक टिप्पणी"/></label>
     <b className="amount-preview">कुल राशि: {money(Number(form.quantity)*Number(form.rate))}</b>
     <div className="form-actions"><button>{edit?'प्रविष्टि अपडेट करें':'दूध दर्ज करें'}</button>{edit&&<button type="button" className="secondary" onClick={()=>{setEdit(null);setForm(blankForm(store.rates))}}>रद्द करें</button>}</div>
    </form>
    <div className="list-heading"><h2>दूध की प्रविष्टियाँ</h2><button className="secondary small-action" onClick={exportCsv}>मासिक CSV</button></div>
    <div className="record-list">{store.rows.slice(0,12).map(row=><article className="record" key={row.id}>
     <div><b>{row.buyer}</b><small>{row.sale_date} · {shiftLabel(row.shift)} · {milkLabel(row.milk_type)} · {number(row.quantity)} लीटर × {money(row.rate)}</small>{row.remarks&&<small>{row.remarks}</small>}</div>
     <strong>{money(row.amount)}</strong>
     <div className="record-actions"><button onClick={()=>beginMilkEdit(row)}>बदलें</button><button className="danger" onClick={()=>removeMilk(row.id)}>हटाएँ</button></div>
    </article>)}{!store.rows.length&&<p className="empty">अभी कोई दूध प्रविष्टि नहीं है।</p>}</div>
   </>}
   {tab==='Transactions'&&<>
    <section className="stats transaction-stats">
     <article><small>प्राप्त</small><h2>{money(receivedTotal)}</h2></article>
     <article><small>बाकी</small><h2>{money(remainedTotal)}</h2></article>
     <article><small>अग्रिम</small><h2>{money(advancedTotal)}</h2></article>
     <article><small>खर्च</small><h2>{money(expenseTotal)}</h2></article>
     <article className="net-stat"><small>शुद्ध राशि</small><h2>{money(netAmount)}</h2></article>
    </section>
    <form className="entry-form" onSubmit={saveTransaction}>
     <label>दिनांक<input className="date-input" type="date" value={txForm.date} onChange={e=>setTxForm({...txForm,date:e.target.value})} required/></label>
     <label>लेन-देन का प्रकार<RadioChoices name="transaction-kind" value={txForm.kind} onChange={v=>setTxForm({...txForm,kind:v})} options={[{value:'received',label:'प्राप्त'},{value:'remained',label:'बाकी'},{value:'advance',label:'अग्रिम'},{value:'expense',label:'खर्च'}]}/></label>
     <label>राशि (₹)<input className="number-input" type="number" min=".01" step=".01" inputMode="decimal" placeholder="0" value={txForm.amount} onChange={e=>setTxForm({...txForm,amount:e.target.value})} required/></label>
     <label>किसे / किससे (To Whom)<input className="text-input full-text" value={txForm.party} onChange={e=>setTxForm({...txForm,party:e.target.value})} placeholder="व्यक्ति या पार्टी का नाम"/></label>
     {txForm.kind==='expense'&&<label>खर्च का मद<RadioChoices name="expense-category" value={txForm.category} onChange={v=>setTxForm({...txForm,category:v})} options={expenseCategories}/></label>}
     <label>टिप्पणी<textarea className="comment-input" rows="2" value={txForm.remarks} onChange={e=>setTxForm({...txForm,remarks:e.target.value})} placeholder="वैकल्पिक टिप्पणी"/></label>
     <div className="form-actions"><button>{txEdit?'लेन-देन अपडेट करें':'लेन-देन दर्ज करें'}</button>{txEdit&&<button type="button" className="secondary" onClick={()=>{setTxEdit(null);setTxForm(blankTransaction())}}>रद्द करें</button>}</div>
    </form>
    <h2 className="section-title">लेन-देन का विवरण</h2>
    <div className="record-list">{monthTransactions.map(t=>{
     const kindLabel=t.kind==='received'?'प्राप्त':t.kind==='remained'?'बाकी':t.kind==='advance'?'अग्रिम':'खर्च';
     const cat=expenseCategories.find(c=>c.value===t.category)?.label||'अन्य';
     return <article className="record" key={t.id}>
      <div><b>{kindLabel}{t.kind==='expense'?' · '+cat:''}</b><small>{t.date}{t.party?' · '+t.party:''}{t.remarks?' · '+t.remarks:''}</small></div>
      <strong>{money(t.amount)}</strong>
      <div className="record-actions"><button onClick={()=>beginTransactionEdit(t)}>बदलें</button><button className="danger" onClick={()=>removeTransaction(t.id)}>हटाएँ</button></div>
     </article>
    })}{!monthTransactions.length&&<p className="empty">इस माह कोई लेन-देन दर्ज नहीं है।</p>}</div>
   </>}
  </main>
  <footer className="dedication"><b>माँ को समर्पित</b><i>I dedicate this space to my mother.</i><small>~ i/arpit</small></footer>
 </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
