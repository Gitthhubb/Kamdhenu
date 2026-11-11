import React,{useEffect,useState} from 'react';
import{createRoot}from'react-dom/client';
import'./style.css';

const STORE_KEY='kamdhenu-point-local-v1';
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(n)||0);
const DEFAULT_STATE={rows:[],rates:{cow_rate:0,buffalo_rate:0},buyers:['Milkman 1','Milkman 2','Milkman 3']};
const blankForm=(rates=null)=>({sale_date:today(),buyer:'Milkman 1',milk_type:'cow',quantity:'',rate:rates?String(rates.cow_rate??0):'',remarks:''});
function readStore(){
  try{
    const raw=localStorage.getItem(STORE_KEY);
    if(!raw)return structuredClone(DEFAULT_STATE);
    const parsed=JSON.parse(raw);
    if(!parsed||!Array.isArray(parsed.rows)||!parsed.rates||!Array.isArray(parsed.buyers))throw new Error('Stored ledger has an invalid format.');
    return {...DEFAULT_STATE,...parsed,rates:{...DEFAULT_STATE.rates,...parsed.rates}};
  }catch(err){console.error(err);return structuredClone(DEFAULT_STATE)}
}
function App(){
  const [store,setStore]=useState(readStore),[rows,R]=useState(store.rows),
    [rates,T]=useState(store.rates),[buyers,B]=useState(store.buyers),
    [tab,V]=useState('Sales'),[month,M]=useState(today().slice(0,7)),
    [error,E]=useState(''),[notice,N]=useState(''),[form,F]=useState(blankForm(store.rates)),
    [edit,X]=useState(null),[loading,L]=useState(false),[busy,Z]=useState(false);

  function report(err){E(String(err?.message||err||'Unable to complete this operation.'));N('')}
  function success(text){N(text);E('')}
  function persist(next){
    try{localStorage.setItem(STORE_KEY,JSON.stringify(next))}
    catch(err){report('Browser storage is full or unavailable. Download a backup and free storage space.');return false}
    setStore(next);R(next.rows);T(next.rates);B(next.buyers);return true;
  }
  function load(){L(true);const next=readStore();setStore(next);R(next.rows);T(next.rates);B(next.buyers);L(false)}
  function exportBackup(){
    const blob=new Blob([JSON.stringify({schema:1,exportedAt:new Date().toISOString(),...store},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='kamdhenu-backup-'+today()+'.json';document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);success('Backup downloaded.');
  }
  function importBackup(e){
    const file=e.target.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const data=JSON.parse(String(reader.result));
        if(!data||!Array.isArray(data.rows)||!data.rates||!Array.isArray(data.buyers))throw new Error('This file is not a valid Kamdhenu backup.');
        const next={rows:data.rows,rates:{cow_rate:Number(data.rates.cow_rate)||0,buffalo_rate:Number(data.rates.buffalo_rate)||0},buyers:data.buyers.map(String)};
        if(!window.confirm('Import this backup and replace the current records in this browser? Download a backup first if needed.'))return;
        if(persist(next))success('Backup restored.');
      }catch(err){report(err)}
      finally{e.target.value=''}
    };
    reader.onerror=()=>report('The backup file could not be read.');
    reader.readAsText(file);
  }
  async function save(e){
    e.preventDefault();E('');N('');
    const q=Number(form.quantity),rate=Number(form.rate);
    if(!form.sale_date||!form.buyer.trim())return report('Select a date and buyer.');
    if(!String(form.quantity).trim()||!String(form.rate).trim()||!Number.isFinite(q)||q<=0||!Number.isFinite(rate)||rate<0)return report('Enter a quantity greater than zero and a valid non-negative rate.');
    const payload={sale_date:form.sale_date,buyer:form.buyer.trim(),milk_type:form.milk_type,quantity:q,rate,amount:Math.round(q*rate*100)/100,remarks:form.remarks.trim()||null,updated_at:new Date().toISOString()};
    const next={...store,rows:edit?store.rows.map(x=>x.id===edit?{...x,...payload}:x):[{...payload,id:crypto.randomUUID(),created_at:new Date().toISOString()},...store.rows]};
    if(!persist(next))return;
    X(null);F(blankForm(next.rates));success(edit?'Sale updated.':'Sale recorded.');
  }
  async function remove(id){
    if(!window.confirm('Delete this entry? This cannot be undone.'))return;
    if(persist({...store,rows:store.rows.filter(x=>x.id!==id)}))success('Entry deleted.');
  }
  function beginEdit(entry){
    X(entry.id);F({sale_date:entry.sale_date,buyer:entry.buyer,milk_type:entry.milk_type,quantity:String(entry.quantity),rate:String(entry.rate),remarks:entry.remarks||''});V('Sales');window.scrollTo({top:0,behavior:'smooth'});
  }
  function cancelEdit(){X(null);F(blankForm(rates));E('');N('')}
  function exportCsv(){
    const data=rows.filter(x=>x.sale_date.startsWith(month));
    const lines=[['Date','Buyer','Milk','Litres','Rate','Amount','Remarks'],...data.map(x=>[x.sale_date,x.buyer,x.milk_type,x.quantity,x.rate,x.amount,x.remarks||''])];
    const csv=lines.map(row=>row.map(x=>{let value=String(x??'');if(/^[\t\r ]*[=+@-]/.test(value))value="'"+value;return '"'+value.replaceAll('"','""')+'"'}).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='kamdhenu-'+month+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function saveRates(){
    const cow=Number(rates.cow_rate),buffalo=Number(rates.buffalo_rate);
    if(!String(rates.cow_rate).trim()||!String(rates.buffalo_rate).trim()||!Number.isFinite(cow)||!Number.isFinite(buffalo)||cow<0||buffalo<0)return report('Enter valid non-negative rates for both milk types.');
    if(persist({...store,rates:{cow_rate:cow,buffalo_rate:buffalo}}))success('Milk rates saved.');
  }
  async function saveBuyers(){
    const clean=[...new Set(buyers.map(x=>x.trim()).filter(Boolean))];
    if(!clean.length)return report('At least one buyer is required.');
    if(persist({...store,buyers:clean}))success('Buyer list saved.');
  }

  const filtered=rows.filter(x=>x.sale_date.startsWith(month));
  const total=xs=>xs.reduce((a,x)=>a+Number(x.amount||0),0),qty=xs=>xs.reduce((a,x)=>a+Number(x.quantity||0),0);
  const todayRows=rows.filter(x=>x.sale_date===today());
  return <div className="app">
    <header><b>कामधेनु Point</b><span>स्थानीय भंडारण · इस डिवाइस पर</span><label className="backup-label">Restore backup<input type="file" accept="application/json,.json" onChange={importBackup}/></label><button onClick={exportBackup}>Download backup</button></header>
    <div className="storage-notice">यह ledger केवल इसी browser और device में सुरक्षित है। दूसरे users/devices के साथ data साझा नहीं होता। नियमित रूप से backup डाउनलोड करें।</div>
    <nav>{['Sales','Ledger','Rates','Buyers'].map(x=><button key={x} className={tab===x?'active':''} onClick={()=>V(x)}>{x}</button>)}</nav>
    <main><div className="heading-row"><h1>{tab}</h1><button className="secondary" onClick={load} disabled={loading||busy}>{loading?'Refreshing…':'Refresh'}</button></div>
      {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
      {loading&&<p className="muted">Updating records…</p>}
      {tab==='Sales'&&<><section className="stats"><article><small>Milk today</small><h2>{qty(todayRows).toFixed(2)} L</h2></article><article><small>Sales today</small><h2>{money(total(todayRows))}</h2></article></section>
        <h2>{edit?'Edit sale':'Record a sale'}</h2><SaleForm form={form} setForm={F} buyers={buyers} rates={rates} save={save} busy={busy} editing={Boolean(edit)} cancel={cancelEdit}/>
        <h2>Recent entries</h2><Rows rows={rows.slice(0,10)} admin={true} edit={beginEdit} remove={remove}/>
      </>}
      {tab==='Ledger'&&<><label className="month-picker">Month <input type="month" value={month} onChange={e=>M(e.target.value)}/></label><button onClick={exportCsv}>Export CSV</button><h2>{qty(filtered).toFixed(2)} litres · {money(total(filtered))}</h2><Rows rows={filtered} admin={true} edit={beginEdit} remove={remove}/></>}
      {tab==='Rates'&&<section className="panel"><h2>Rates per litre</h2>{['cow_rate','buffalo_rate'].map(k=><label key={k}>{k==='cow_rate'?'Cow':'Buffalo'} ₹ <input type="number" min="0" step=".01" value={rates[k]??0} onChange={e=>T({...rates,[k]:e.target.value})}/></label>)}<button disabled={busy} onClick={saveRates}>Save rates</button><p>Historical entries retain the rate applied when they were recorded.</p></section>}
      {tab==='Buyers'&&<section className="panel"><h2>Buyers</h2><textarea rows="6" value={buyers.join('\n')} onChange={e=>B(e.target.value.split('\n'))}/><button disabled={busy} onClick={saveBuyers}>Save buyers</button></section>}
    </main>
  </div>;
}
function SaleForm({form,setForm,buyers,rates,save,busy,editing,cancel}){
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const changeMilk=type=>setForm(f=>({...f,milk_type:type,rate:String(rates[type+'_rate']??0)}));
  return <form className="sale-form" onSubmit={save}>
    <label>Date<input type="date" required value={form.sale_date} onChange={e=>set('sale_date',e.target.value)}/></label>
    <label>Buyer<select required value={form.buyer} onChange={e=>set('buyer',e.target.value)}>{buyers.map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Milk<select value={form.milk_type} onChange={e=>changeMilk(e.target.value)}><option value="cow">Cow</option><option value="buffalo">Buffalo</option></select></label>
    <label>Litres<input type="number" min=".01" step=".01" required value={form.quantity} onChange={e=>set('quantity',e.target.value)}/></label>
    <label>Rate ₹/L<input type="number" min="0" step=".01" required value={form.rate} onChange={e=>set('rate',e.target.value)}/></label>
    <label>Remarks<input value={form.remarks||''} onChange={e=>set('remarks',e.target.value)}/></label>
    <b>Amount: {money(Number(form.quantity)*Number(form.rate))}</b>
    <div className="form-actions"><button disabled={busy}>{busy?'Saving…':editing?'Update sale':'Save sale'}</button>{editing&&<button className="secondary" type="button" onClick={cancel}>Cancel</button>}</div>
  </form>;
}
function Rows({rows,admin,edit,remove}){
  return <div className="table-wrap"><table><thead><tr><th>Date</th><th>Buyer</th><th>Milk</th><th>Qty</th><th>Rate</th><th>Amount</th><th>Actions</th></tr></thead><tbody>
    {rows.map(e=><tr key={e.id}><td>{e.sale_date}</td><td>{e.buyer}</td><td>{e.milk_type}</td><td>{e.quantity} L</td><td>{money(e.rate)}</td><td>{money(e.amount)}</td><td><button onClick={()=>edit(e)}>Edit</button><button className="danger" onClick={()=>remove(e.id)}>Delete</button></td></tr>)}
  </tbody></table>{!rows.length&&<p className="empty">No entries for this period.</p>}</div>;
}
createRoot(document.getElementById('root')).render(<App/>);
