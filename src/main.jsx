import React,{useState}from'react';
import{createRoot}from'react-dom/client';
import'./style.css';
const STORE_KEY='kamdhenu-point-local-v1';
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(n)||0);
const DEFAULT_STATE={rows:[],transactions:[],rates:{cow_rate:0,buffalo_rate:0},buyers:['Milkman 1','Milkman 2','Milkman 3']};
const blankForm=(rates=null)=>({sale_date:today(),buyer:'Milkman 1',milk_type:'cow',quantity:'',rate:rates?String(rates.cow_rate??0):'',remarks:''});
const blankTransaction=()=>({date:today(),kind:'received',amount:'',party:'',category:'paddy_stalk',remarks:''});
function readStore(){
 try{const raw=localStorage.getItem(STORE_KEY);if(!raw)return structuredClone(DEFAULT_STATE);const p=JSON.parse(raw);if(!p||!Array.isArray(p.rows)||!p.rates||!Array.isArray(p.buyers))throw new Error('Stored ledger has an invalid format.');return {...DEFAULT_STATE,...p,transactions:Array.isArray(p.transactions)?p.transactions:[],rates:{...DEFAULT_STATE.rates,...p.rates}}}
 catch(err){console.error(err);return structuredClone(DEFAULT_STATE)}
}
function RadioChoices({value,onChange,options,name}){
 return <div className="radio-group" role="radiogroup">{options.map(o=><label className={'radio-choice '+(value===o.value?'chosen':'')} key={o.value}><input type="radio" name={name} value={o.value} checked={value===o.value} onChange={()=>onChange(o.value)}/><span>{o.label}</span></label>)}</div>
}
function App(){
 const [store,setStore]=useState(readStore),[rows,R]=useState(store.rows),[rates,T]=useState(store.rates),[buyers,B]=useState(store.buyers),
 [tab,V]=useState('Sales'),[month,M]=useState(today().slice(0,7)),[error,E]=useState(''),[notice,N]=useState(''),
 [form,F]=useState(blankForm(store.rates)),[edit,X]=useState(null),[txForm,TF]=useState(blankTransaction()),[txEdit,TX]=useState(null);
 function report(err){E(String(err?.message||err||'Unable to complete this operation.'));N('')}
 function success(s){N(s);E('')}
 function persist(next){
  try{localStorage.setItem(STORE_KEY,JSON.stringify(next))}catch(err){report('Browser storage is full or unavailable. Download a backup and free storage space.');return false}
  setStore(next);R(next.rows);T(next.rates);B(next.buyers);return true;
 }
 function exportBackup(){
  const blob=new Blob([JSON.stringify({schema:2,exportedAt:new Date().toISOString(),...store},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='kamdhenu-backup-'+today()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);success('Backup downloaded.');
 }
 function importBackup(e){
  const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();
  reader.onload=()=>{try{const d=JSON.parse(String(reader.result));if(!d||!Array.isArray(d.rows)||!d.rates||!Array.isArray(d.buyers))throw new Error('This file is not a valid Kamdhenu backup.');const next={rows:d.rows,transactions:Array.isArray(d.transactions)?d.transactions:[],rates:{cow_rate:Number(d.rates.cow_rate)||0,buffalo_rate:Number(d.rates.buffalo_rate)||0},buyers:d.buyers.map(String)};if(window.confirm('Replace this browser ledger with the selected backup?')&&persist(next))success('Backup restored.')}catch(err){report(err)}finally{e.target.value=''}};reader.onerror=()=>report('Backup file could not be read.');reader.readAsText(file);
 }
 function saveSale(e){
  e.preventDefault();const q=Number(form.quantity),rate=Number(form.rate);
  if(!form.sale_date||!form.buyer.trim()||!String(form.quantity).trim()||!String(form.rate).trim()||!Number.isFinite(q)||q<=0||!Number.isFinite(rate)||rate<0)return report('Enter a date, buyer, positive quantity and valid rate.');
  const payload={sale_date:form.sale_date,buyer:form.buyer.trim(),milk_type:form.milk_type,quantity:q,rate,amount:Math.round(q*rate*100)/100,remarks:form.remarks.trim()||null,updated_at:new Date().toISOString()};
  const next={...store,rows:edit?store.rows.map(x=>x.id===edit?{...x,...payload}:x):[{...payload,id:crypto.randomUUID(),created_at:new Date().toISOString()},...store.rows]};
  if(persist(next)){X(null);F(blankForm(next.rates));success(edit?'Sale updated.':'Sale recorded.')}
 }
 function removeSale(id){if(window.confirm('Delete this sale entry?')&&persist({...store,rows:store.rows.filter(x=>x.id!==id)}))success('Sale deleted.')}
 function beginEdit(e){X(e.id);F({sale_date:e.sale_date,buyer:e.buyer,milk_type:e.milk_type,quantity:String(e.quantity),rate:String(e.rate),remarks:e.remarks||''});V('Sales')}
 function saveTransaction(e){
  e.preventDefault();const amount=Number(txForm.amount);
  if(!txForm.date||!String(txForm.amount).trim()||!Number.isFinite(amount)||amount<=0)return report('Enter a valid date and amount greater than zero.');
  if(txForm.kind==='expense'&&!txForm.category)return report('Select an expenditure category.');
  const payload={...txForm,amount,party:txForm.party.trim(),remarks:txForm.remarks.trim(),updated_at:new Date().toISOString()};
  const next={...store,transactions:txEdit?store.transactions.map(x=>x.id===txEdit?{...x,...payload}:x):[{...payload,id:crypto.randomUUID(),created_at:new Date().toISOString()},...store.transactions]};
  if(persist(next)){TX(null);TF(blankTransaction());success(txEdit?'Transaction updated.':'Transaction recorded.')}
 }
 function beginTxEdit(t){TX(t.id);TF({...t,amount:String(t.amount)});V('Transactions')}
 function removeTx(id){if(window.confirm('Delete this transaction?')&&persist({...store,transactions:store.transactions.filter(x=>x.id!==id)}))success('Transaction deleted.')}
 function saveRates(){
  const c=Number(rates.cow_rate),b=Number(rates.buffalo_rate);
  if(!String(rates.cow_rate).trim()||!String(rates.buffalo_rate).trim()||!Number.isFinite(c)||!Number.isFinite(b)||c<0||b<0)return report('Enter valid non-negative rates.');
  if(persist({...store,rates:{cow_rate:c,buffalo_rate:b}}))success('Rates saved.');
 }
 function saveBuyers(){const clean=[...new Set(buyers.map(x=>x.trim()).filter(Boolean))];if(!clean.length)return report('At least one buyer is required.');if(persist({...store,buyers:clean}))success('Buyers saved.')}
 function exportCsv(){
  const data=rows.filter(x=>x.sale_date.startsWith(month)),lines=[['Date','Buyer','Milk','Litres','Rate','Amount','Remarks'],...data.map(x=>[x.sale_date,x.buyer,x.milk_type,x.quantity,x.rate,x.amount,x.remarks||''])];
  const csv=lines.map(row=>row.map(x=>{let v=String(x??'');if(/^[\t\r ]*[=+@-]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"'}).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='kamdhenu-sales-'+month+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 const filtered=rows.filter(x=>x.sale_date.startsWith(month)),txFiltered=store.transactions.filter(x=>x.date.startsWith(month));
 const total=xs=>xs.reduce((a,x)=>a+Number(x.amount||0),0),qty=xs=>xs.reduce((a,x)=>a+Number(x.quantity||0),0);
 const todayRows=rows.filter(x=>x.sale_date===today()),received=txFiltered.filter(x=>x.kind==='received'),advances=txFiltered.filter(x=>x.kind==='advance'),expenses=txFiltered.filter(x=>x.kind==='expense');
 return <div className="app">
  <header><b>कामधेनु Point</b><span>Mobile ledger · Local storage</span><label className="backup-label">Restore<input type="file" accept="application/json,.json" onChange={importBackup}/></label><button onClick={exportBackup}>Backup</button></header>
  <div className="storage-notice">Data इसी device के browser में रहता है। नियमित backup डाउनलोड करें।</div>
  <nav>{['Sales','Transactions','Ledger','Rates','Buyers'].map(x=><button key={x} className={tab===x?'active':''} onClick={()=>{V(x);E('');N('')}}>{x==='Transactions'?'Accounts':x}</button>)}</nav>
  <main><div className="heading-row"><h1>{tab==='Transactions'?'Accounts':tab}</h1></div>
   {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
   {tab==='Sales'&&<><section className="stats"><article><small>Milk today</small><h2>{qty(todayRows).toFixed(2)} L</h2></article><article><small>Sales today</small><h2>{money(total(todayRows))}</h2></article></section>
    <h2>{edit?'Edit sale':'Record sale'}</h2><SaleForm form={form} setForm={F} buyers={buyers} rates={rates} save={saveSale} editing={Boolean(edit)} cancel={()=>{X(null);F(blankForm(rates))}}/>
    <h2>Recent sales</h2><SalesRows rows={rows.slice(0,8)} edit={beginEdit} remove={removeSale}/>
   </>}
   {tab==='Transactions'&&<><label className="month-picker">Month<input type="month" value={month} onChange={e=>M(e.target.value)}/></label>
    <section className="stats four"><article><small>Received</small><h2>{money(total(received))}</h2></article><article><small>Advance</small><h2>{money(total(advances))}</h2></article><article><small>Expenditure</small><h2>{money(total(expenses))}</h2></article><article><small>Net cash</small><h2>{money(total(received)-total(advances)-total(expenses))}</h2></article></section>
    <h2>{txEdit?'Edit transaction':'Add transaction'}</h2><form className="entry-form" onSubmit={saveTransaction}>
     <label>Date<input className="date-input" type="date" value={txForm.date} onChange={e=>TF({...txForm,date:e.target.value})} required/></label>
     <label>Transaction type<RadioChoices name="tx-kind" value={txForm.kind} onChange={v=>TF({...txForm,kind:v})} options={[{value:'received',label:'Received'},{value:'advance',label:'Advance'},{value:'expense',label:'Expenditure'}]}/></label>
     <label>Amount (₹)<input className="number-input" type="number" min="0.01" step=".01" inputMode="decimal" placeholder="0.00" value={txForm.amount} onChange={e=>TF({...txForm,amount:e.target.value})} required/></label>
     <label>Party / paid to / received from<input className="text-input" value={txForm.party} onChange={e=>TF({...txForm,party:e.target.value})} placeholder="Name (optional)"/></label>
     {txForm.kind==='expense'&&<label>Expenditure head<RadioChoices name="expense-category" value={txForm.category} onChange={v=>TF({...txForm,category:v})} options={[{value:'paddy_stalk',label:'धान का पुआल'},{value:'cattle_feed',label:'पशु आहार'},{value:'khali',label:'खली'},{value:'chokar',label:'चोकर'}]}/></label>}
     <label>Details<textarea className="compact-textarea" rows="2" value={txForm.remarks} onChange={e=>TF({...txForm,remarks:e.target.value})} placeholder="Description (optional)"/></label>
     <div className="form-actions"><button>{txEdit?'Update transaction':'Save transaction'}</button>{txEdit&&<button type="button" className="secondary" onClick={()=>{TX(null);TF(blankTransaction())}}>Cancel</button>}</div>
    </form>
    <h2>Transactions this month</h2><TransactionRows rows={txFiltered} edit={beginTxEdit} remove={removeTx}/>
   </>}
   {tab==='Ledger'&&<><label className="month-picker">Month<input type="month" value={month} onChange={e=>M(e.target.value)}/></label><button onClick={exportCsv}>Export sales CSV</button><h2>{qty(filtered).toFixed(2)} litres · {money(total(filtered))}</h2><SalesRows rows={filtered} edit={beginEdit} remove={removeSale}/></>}
   {tab==='Rates'&&<section className="panel"><h2>Rates per litre</h2>{['cow_rate','buffalo_rate'].map(k=><label key={k}>{k==='cow_rate'?'Cow':'Buffalo'} ₹ <input className="number-input" type="number" min="0" step=".01" value={rates[k]??0} onChange={e=>T({...rates,[k]:e.target.value})}/></label>)}<button onClick={saveRates}>Save rates</button><p>Historical sales retain their original rate.</p></section>}
   {tab==='Buyers'&&<section className="panel"><h2>Buyer list</h2><textarea className="compact-textarea" rows="3" value={buyers.join('\n')} onChange={e=>B(e.target.value.split('\n'))}/><button onClick={saveBuyers}>Save buyers</button><p>One buyer per line. Up to four buyers appear as radio choices; larger lists use a compact text field.</p></section>}
  </main>
 </div>
}
function SaleForm({form,setForm,buyers,rates,save,editing,cancel}){
 const set=(k,v)=>setForm(f=>({...f,[k]:v})),changeMilk=v=>setForm(f=>({...f,milk_type:v,rate:String(rates[v+'_rate']??0)}));
 return <form className="entry-form" onSubmit={save}>
  <label>Date<input className="date-input" type="date" required value={form.sale_date} onChange={e=>set('sale_date',e.target.value)}/></label>
  <label>Buyer{buyers.length<=4?<RadioChoices name="buyer" value={form.buyer} onChange={v=>set('buyer',v)} options={buyers.map(x=>({value:x,label:x}))}/>:<input className="text-input" value={form.buyer} onChange={e=>set('buyer',e.target.value)} placeholder="Enter buyer" required/>}</label>
  <label>Milk type<RadioChoices name="milk-type" value={form.milk_type} onChange={changeMilk} options={[{value:'cow',label:'Cow'},{value:'buffalo',label:'Buffalo'}]}/></label>
  <label>Quantity (litres)<input className="number-input" type="number" min=".01" step=".01" inputMode="decimal" required value={form.quantity} onChange={e=>set('quantity',e.target.value)}/></label>
  <label>Rate (₹/L)<input className="number-input" type="number" min="0" step=".01" inputMode="decimal" required value={form.rate} onChange={e=>set('rate',e.target.value)}/></label>
  <label>Remarks<input className="text-input" value={form.remarks||''} onChange={e=>set('remarks',e.target.value)}/></label>
  <b className="amount-preview">Amount: {money(Number(form.quantity)*Number(form.rate))}</b>
  <div className="form-actions"><button>{editing?'Update sale':'Save sale'}</button>{editing&&<button className="secondary" type="button" onClick={cancel}>Cancel</button>}</div>
 </form>
}
function SalesRows({rows,edit,remove}){return <div className="record-list">{rows.map(e=><article className="record" key={e.id}><div><b>{e.buyer}</b><small>{e.sale_date} · {e.milk_type==='cow'?'Cow':'Buffalo'} · {e.quantity} L × {money(e.rate)}</small></div><strong>{money(e.amount)}</strong><div className="record-actions"><button onClick={()=>edit(e)}>Edit</button><button className="danger" onClick={()=>remove(e.id)}>Delete</button></div></article>)}{!rows.length&&<p className="empty">No sales recorded.</p>}</div>}
function TransactionRows({rows,edit,remove}){
 const label=t=>t.kind==='received'?'Received':t.kind==='advance'?'Advance':'Expenditure',category={paddy_stalk:'धान का पुआल',cattle_feed:'पशु आहार',khali:'खली',chokar:'चोकर'};
 return <div className="record-list">{rows.map(t=><article className="record" key={t.id}><div><b>{label(t)} · {t.kind==='expense'?category[t.category]:t.party||'Unspecified party'}</b><small>{t.date}{t.remarks?' · '+t.remarks:''}</small></div><strong>{money(t.amount)}</strong><div className="record-actions"><button onClick={()=>edit(t)}>Edit</button><button className="danger" onClick={()=>remove(t.id)}>Delete</button></div></article>)}{!rows.length&&<p className="empty">No transactions recorded for this month.</p>}</div>
}
createRoot(document.getElementById('root')).render(<App/>);
