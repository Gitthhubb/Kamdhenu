import React,{useEffect,useState} from 'react';
import{createRoot}from'react-dom/client';
import{supabase,configured}from'./supabase.js';
import'./style.css';

const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(n)||0);
const blankForm=(rates={cow_rate:0})=>({sale_date:today(),buyer:'Milkman 1',milk_type:'cow',quantity:'',rate:String(rates.cow_rate??0),remarks:''});
const messageFor=(message)=>{
  if(!message)return '';
  if(/provider is not enabled/i.test(message))return 'Google sign-in is not enabled yet. Enable Google in Supabase Authentication → Providers and add the Google OAuth Client ID and Secret.';
  if(/invalid login credentials/i.test(message))return 'Google sign-in could not be completed. Check that the correct Google account is selected.';
  return message;
};

function App(){
  const[user,U]=useState(null),[profile,P]=useState(null),[rows,R]=useState([]),
    [rates,T]=useState({cow_rate:0,buffalo_rate:0}),[buyers,B]=useState(['Milkman 1','Milkman 2','Milkman 3']),
    [allowed,A]=useState([]),[tab,V]=useState('Sales'),[month,M]=useState(today().slice(0,7)),
    [error,E]=useState(''),[notice,N]=useState(''),[email,Q]=useState(''),
    [form,F]=useState(blankForm()),[edit,X]=useState(null),[loading,L]=useState(false),[profileLoading,PL]=useState(false),[profileRetry,PR]=useState(0),
    [busy,Z]=useState(false);

  function report(err){E(messageFor(err?.message||err||''));N('');}
  function success(text){N(text);E('');}

  useEffect(()=>{
    if(!configured)return;
    supabase.auth.getSession().then(({data,error})=>{if(error)report(error);U(data.session?.user||null)});
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>U(session?.user||null));
    return()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    let cancelled=false;
    async function getProfile(){
      P(null);
      if(!user){PL(false);return;}
      PL(true);
      const{data,error}=await supabase.from('profiles').select('*').eq('id',user.id).maybeSingle();
      if(cancelled)return;
      if(error)report(error);
      P(data);PL(false);
    }
    getProfile().catch(err=>{if(!cancelled){report(err);PL(false)}});
    return()=>{cancelled=true};
  },[user,profileRetry]);

  async function load(){
    if(!profile?.active)return;
    L(true);
    try{
      const requests=[
        supabase.from('entries').select('*').order('sale_date',{ascending:false}).order('created_at',{ascending:false}),
        supabase.from('milk_rates').select('*').eq('id',1).single(),
        supabase.from('buyers').select('*').eq('id',1).single(),
        profile.role==='admin'?supabase.from('allowed_emails').select('*').order('email'):Promise.resolve({data:[],error:null})
      ];
      const [sales,r,b,a]=await Promise.all(requests);
      const failures=[sales,r,b,a].filter(x=>x.error);
      if(failures.length)report(failures[0].error);
      if(sales.data)R(sales.data);
      if(r.data){T(r.data);if(!edit)F(f=>({...f,rate:String(r.data[f.milk_type+'_rate']??0)}));}
      if(b.data)B(b.data.names||[]);
      A(a.data||[]);
    }catch(err){report(err)}finally{L(false)}
  }
  useEffect(()=>{if(profile?.active)load()},[profile]);

  async function signIn(){
    E('');N('');Z(true);
    try{
      const{error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin}});
      if(error)report(error);
    }catch(err){report(err)}finally{Z(false)}
  }
  async function save(e){
    e.preventDefault();E('');N('');
    const q=Number(form.quantity),rate=Number(form.rate);
    if(!form.sale_date||!form.buyer)return report('Select a date and buyer.');
    if(!String(form.quantity).trim()||!String(form.rate).trim()||!Number.isFinite(q)||q<=0||!Number.isFinite(rate)||rate<0)return report('Enter a quantity greater than zero and a valid non-negative rate.');
    if(!form.buyer.trim())return report('Buyer name cannot be blank.');
    const payload={sale_date:form.sale_date,buyer:form.buyer,milk_type:form.milk_type,quantity:q,rate,amount:Math.round(q*rate*100)/100,remarks:form.remarks.trim()||null,updated_at:new Date().toISOString()};
    Z(true);
    const res=edit?await supabase.from('entries').update(payload).eq('id',edit):await supabase.from('entries').insert({...payload,created_by:user.id});
    Z(false);
    if(res.error)return report(res.error);
    X(null);F(blankForm(rates));success(edit?'Sale updated.':'Sale recorded.');await load();
  }
  async function remove(id){
    if(!window.confirm('Delete this entry? This cannot be undone.'))return;
    Z(true);const{error}=await supabase.from('entries').delete().eq('id',id);Z(false);
    if(error)report(error);else{success('Entry deleted.');await load()}
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
    const a=document.createElement('a');a.href=url;a.download=`kamdhenu-${month}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function saveRates(){
    const cow=Number(rates.cow_rate),buffalo=Number(rates.buffalo_rate);
    if(!String(rates.cow_rate).trim()||!String(rates.buffalo_rate).trim()||!Number.isFinite(cow)||!Number.isFinite(buffalo)||cow<0||buffalo<0)return report('Enter valid non-negative rates for both milk types.');
    Z(true);const{error}=await supabase.from('milk_rates').update({cow_rate:cow,buffalo_rate:buffalo,updated_at:new Date().toISOString()}).eq('id',1);Z(false);
    if(error)report(error);else{success('Milk rates saved.');await load()}
  }
  async function saveBuyers(){
    const clean=[...new Set(buyers.map(x=>x.trim()).filter(Boolean))];
    if(!clean.length)return report('At least one buyer is required.');
    Z(true);const{error}=await supabase.from('buyers').update({names:clean,updated_at:new Date().toISOString()}).eq('id',1);Z(false);
    if(error)report(error);else{B(clean);success('Buyer list saved.');await load()}
  }
  async function addAccess(e){
    e.preventDefault();const clean=email.trim().toLowerCase();
    if(!clean)return;
    if(clean===user.email.toLowerCase())return report('This account already has administrator access.');
    const existing=allowed.find(a=>a.email.toLowerCase()===clean);
    Z(true);const{error}=await supabase.from('allowed_emails').upsert({email:clean,role:existing?.role==='admin'?'admin':'user',active:true},{onConflict:'email'});Z(false);
    if(error)report(error);else{Q('');success('Account authorised.');await load()}
  }
  async function toggleAccess(a){
    if(a.email.toLowerCase()===user.email.toLowerCase())return report('You cannot revoke the account currently administering this register.');\n    if(a.role==='admin')return report('Administrator access must be changed directly in Supabase, not through the user access list.');
    Z(true);const{error}=await supabase.from('allowed_emails').update({active:!a.active}).eq('email',a.email);Z(false);
    if(error)report(error);else{success(a.active?'Access revoked.':'Access restored.');await load()}
  }

  if(!configured)return <main className="login"><h1>कामधेनु Point</h1><p>Supabase configuration is missing. Check the Render environment variables.</p></main>;
  if(!user)return <main className="login"><h1>कामधेनु Point</h1><p>दूध बिक्री और हिसाब-किताब</p><button disabled={busy} onClick={signIn}>{busy?'Connecting…':'Continue with Google'}</button>{error&&<p className="error" role="alert">{error}</p>}</main>;
  if(profileLoading)return <main className="login"><h1>कामधेनु Point</h1><p>Checking account access…</p>{error&&<p className="error" role="alert">{error}</p>}</main>;
  if(!profile)return <main className="login"><h1>कामधेनु Point</h1><p>Account profile could not be loaded.</p>{error&&<p className="error" role="alert">{error}</p>}<button onClick={()=>PR(n=>n+1)}>Retry</button><button className="secondary" onClick={()=>supabase.auth.signOut()}>Sign out</button></main>;
  if(!profile.active)return <main className="login"><h1>Access pending</h1><p>{user.email} is not authorised yet.</p><p>Ask the administrator to authorise this exact Google email address.</p><button onClick={()=>supabase.auth.signOut()}>Sign out</button>{error&&<p className="error" role="alert">{error}</p>}</main>;

  const admin=profile.role==='admin',filtered=rows.filter(x=>x.sale_date.startsWith(month));
  const total=xs=>xs.reduce((a,x)=>a+Number(x.amount||0),0),qty=xs=>xs.reduce((a,x)=>a+Number(x.quantity||0),0);
  const todayRows=rows.filter(x=>x.sale_date===today());
  return <div className="app">
    <header><b>कामधेनु Point</b><span>{user.email}</span><button onClick={()=>supabase.auth.signOut()}>Sign out</button></header>
    <nav>{['Sales','Ledger','Rates','Buyers',...(admin?['Access']:[])].map(x=><button key={x} className={tab===x?'active':''} onClick={()=>V(x)}>{x}</button>)}</nav>
    <main><div className="heading-row"><h1>{tab}</h1><button className="secondary" onClick={load} disabled={loading||busy}>{loading?'Refreshing…':'Refresh'}</button></div>
      {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
      {loading&&<p className="muted">Updating records…</p>}
      {tab==='Sales'&&<><section className="stats"><article><small>Milk today</small><h2>{qty(todayRows).toFixed(2)} L</h2></article><article><small>Sales today</small><h2>{money(total(todayRows))}</h2></article></section>
        <h2>{edit?'Edit sale':'Record a sale'}</h2><SaleForm form={form} setForm={F} buyers={buyers} rates={rates} save={save} busy={busy} editing={Boolean(edit)} cancel={cancelEdit}/>
        <h2>Recent entries</h2><Rows rows={rows.slice(0,10)} admin={admin} edit={beginEdit} remove={remove}/>
      </>}
      {tab==='Ledger'&&<><label className="month-picker">Month <input type="month" value={month} onChange={e=>M(e.target.value)}/></label><button onClick={exportCsv}>Export CSV</button><h2>{qty(filtered).toFixed(2)} litres · {money(total(filtered))}</h2><Rows rows={filtered} admin={admin} edit={beginEdit} remove={remove}/></>}
      {tab==='Rates'&&<section className="panel"><h2>Rates per litre</h2>{['cow_rate','buffalo_rate'].map(k=><label key={k}>{k==='cow_rate'?'Cow':'Buffalo'} ₹ <input type="number" min="0" step=".01" disabled={!admin} value={rates[k]??0} onChange={e=>T({...rates,[k]:e.target.value})}/></label>)}{admin&&<button disabled={busy} onClick={saveRates}>Save rates</button>}<p>Historical entries retain the rate applied when they were recorded.</p></section>}
      {tab==='Buyers'&&<section className="panel"><h2>Buyers</h2><textarea disabled={!admin} rows="6" value={buyers.join('\n')} onChange={e=>B(e.target.value.split('\n'))}/>{admin&&<button disabled={busy} onClick={saveBuyers}>Save buyers</button>}</section>}
      {tab==='Access'&&admin&&<section className="panel"><h2>Authorised Google accounts</h2><form onSubmit={addAccess}><input type="email" required placeholder="name@gmail.com" value={email} onChange={e=>Q(e.target.value)}/><button disabled={busy}>Authorise account</button></form>{allowed.map(a=><p className="access-row" key={a.email}>{a.email} · {a.active?'Active':'Revoked'} <button disabled={busy||a.email.toLowerCase()===user.email.toLowerCase()} onClick={()=>toggleAccess(a)}>{a.active?'Revoke':'Restore'}</button></p>)}</section>}
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
  return <div className="table-wrap"><table><thead><tr><th>Date</th><th>Buyer</th><th>Milk</th><th>Qty</th><th>Rate</th><th>Amount</th>{admin&&<th>Actions</th>}</tr></thead><tbody>
    {rows.map(e=><tr key={e.id}><td>{e.sale_date}</td><td>{e.buyer}</td><td>{e.milk_type}</td><td>{e.quantity} L</td><td>{money(e.rate)}</td><td>{money(e.amount)}</td>{admin&&<td><button onClick={()=>edit(e)}>Edit</button><button className="danger" onClick={()=>remove(e.id)}>Delete</button></td>}</tr>)}
  </tbody></table>{!rows.length&&<p className="empty">No entries for this period.</p>}</div>;
}
createRoot(document.getElementById('root')).render(<App/>);
