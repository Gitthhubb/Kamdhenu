import React,{useEffect,useRef,useState}from'react';
import{createRoot}from'react-dom/client';
import'./style.css';
import{getCloudLoadingError}from'./cloud-error';
import{getGuestSignInError,getGuestLinkError,getGoogleSignInError}from'./guest-auth-errors';
import{validateBackupPayload}from'./backup-validation';
import{getMilkSaveFeedback}from'./milk-save-feedback';
import{trackLedgerTabView}from'./analytics-events';
import{getMonthDateRange}from'./ledger-query';
import{isFirebaseConfigured,auth,googleProvider,db}from'./firebase';
import{onAuthStateChanged,signInWithPopup,signInAnonymously,linkWithPopup,signOut}from'firebase/auth';
import{normalizeMilkRecord,normalizeTransactionRecord,planRestoreMerge}from'./restore-merge';
import{collection,doc,setDoc,addDoc,deleteDoc,getDocFromCache,getDocFromServer,getDocsFromCache,getDocsFromServer,query,where,orderBy,serverTimestamp,waitForPendingWrites}from'firebase/firestore';
import{DEFAULT_SETTINGS,normalizeSettings,SUPPORTED_CURRENCIES}from'./app-settings';

const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const number=n=>new Intl.NumberFormat('hi-IN',{maximumFractionDigits:2}).format(Number(n)||0);
const catalogueLabel=(items,key,fallback='')=>items?.find(item=>item.value===key)?.label||fallback||key;
const historicalCatalogueLabel=(items,key,fallback='')=>{const item=items?.find(entry=>entry.value===key);return item?.historicalLabel||item?.label||fallback||key};
const milkLabel=(k,catalogues)=>catalogueLabel(catalogues?.milkTypes,k,k==='cow'?'गाय':k==='buffalo'?'भैंस':k);
const shiftLabel=(k,catalogues)=>catalogueLabel(catalogues?.shifts,k,k==='morning'?'सुबह':k==='evening'?'शाम':'समय दर्ज नहीं');
const DEFAULT_STATE={rows:[],transactions:[],rates:{cow_rate:0,buffalo_rate:0},buyers:[],settings:{...DEFAULT_SETTINGS}};
const blankForm=(rates=null)=>({sale_date:today(),shift:'morning',buyer:'',milk_type:'cow',quantity:'',rate:rates?String(rates.cow_rate??0):'',remarks:''});
const configuredMilkForm=(settings,rates)=>{
 const base={...blankForm(rates),shift:settings.catalogues.shifts.find(item=>item.active)?.value||'morning',milk_type:settings.catalogues.milkTypes.find(item=>item.active)?.value||'cow'};
 return settings.quickEntryEnabled?{...base,buyer:settings.defaultMilkman,milk_type:settings.defaultMilkType,rate:String(settings.defaultRate||rates[settings.defaultMilkType+'_rate']||'')}:base;
};
const configuredTransactionForm=settings=>({...blankTransaction(),kind:settings.catalogues.transactionKinds.find(item=>item.active)?.value||'received',category:settings.catalogues.expenseCategories.find(item=>item.active)?.value||'others'});
const blankTransaction=()=>({date:today(),kind:'received',amount:'',party:'',category:'paddy_stalk',remarks:''});
const sortNewest=(a,b)=>{
 const ad=a.sale_date||a.date||'',bd=b.sale_date||b.date||'';
 return bd.localeCompare(ad)||String(b.created_at||'').localeCompare(String(a.created_at||''));
};
function changeLedgerTab(value,setTab){
 setTab(value);
 const url=new URL(window.location.href);
 url.searchParams.set('tab',value==='Transactions'?'transactions':'milk');
 window.history.replaceState({},'',url);
}
function RadioChoices({value,onChange,options,name}){
 return <div className="radio-group" role="radiogroup">{options.map(o=><label className={'radio-choice '+(value===o.value?'chosen':'')} key={o.value}><input type="radio" name={name} value={o.value} checked={value===o.value} onChange={()=>onChange(o.value)}/><span>{o.label}</span></label>)}</div>;
}
function CatalogueEditor({title,items,onChange,onAdd,showEffects=false}){
 return <fieldset className="catalogue-editor"><legend>{title}</legend>
  {items.map((item,index)=><div className="catalogue-option" key={item.value}>
   <input aria-label={title+' का नाम'} maxLength="60" value={item.label} onChange={e=>onChange(items.map(x=>x.value===item.value?{...x,historicalLabel:x.historicalLabel||x.label,label:e.target.value}:x))}/>
   {showEffects&&<select aria-label={title+' का लेखा प्रभाव'} value={item.effect||'received'} onChange={e=>onChange(items.map(x=>x.value===item.value?{...x,effect:e.target.value}:x))}><option value="received">जमा</option><option value="remained">बाकी</option><option value="advance">अग्रिम</option><option value="expense">खर्च</option></select>}
   <label><input type="checkbox" checked={item.active} disabled={item.active&&items.filter(x=>x.active).length===1} onChange={e=>onChange(items.map(x=>x.value===item.value?{...x,active:e.target.checked}:x))}/> सक्रिय</label>
   <div className="catalogue-order"><button type="button" disabled={index===0} aria-label="ऊपर करें" onClick={()=>{const next=[...items];[next[index-1],next[index]]=[next[index],next[index-1]];onChange(next)}}>↑</button><button type="button" disabled={index===items.length-1} aria-label="नीचे करें" onClick={()=>{const next=[...items];[next[index+1],next[index]]=[next[index],next[index+1]];onChange(next)}}>↓</button></div>
  </div>)}
  <button type="button" className="secondary" onClick={onAdd}>विकल्प जोड़ें</button>
 </fieldset>;
}
function LedgerApp({user,installPrompt,isInstalled,onInstall,installHelp}){
 const initial=DEFAULT_STATE;
 const [store,setStore]=useState(initial);
 const [tab,setTab]=useState(()=>new URLSearchParams(window.location.search).get('tab')==='transactions'?'Transactions':'Milk');
 const [month,setMonth]=useState(today().slice(0,7));
 const monthRef=useRef(month);
 const syncVersionRef=useRef(0);
 useEffect(()=>{monthRef.current=month},[month]);
 const [periodPage,setPeriodPage]=useState(Math.min(3,Math.ceil(Number(today().slice(8,10))/10)));
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [form,setForm]=useState(()=>blankForm(initial.rates));
 const [txForm,setTxForm]=useState(blankTransaction());
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [settingsDraft,setSettingsDraft]=useState({...initial.settings});
 const [syncStatus,setSyncStatus]=useState('loading');
 const [syncBusy,setSyncBusy]=useState(false);
 const [profileReady,setProfileReady]=useState(false);
 const [settingsReady,setSettingsReady]=useState(false);
 const [driveBusy,setDriveBusy]=useState(false);
 const [backupBusy,setBackupBusy]=useState(false);
 const money=n=>new Intl.NumberFormat('hi-IN',{style:'currency',currency:store.settings.currency||'INR',maximumFractionDigits:2}).format(Number(n)||0);
 const currencySymbol=new Intl.NumberFormat('hi-IN',{style:'currency',currency:store.settings.currency||'INR',maximumFractionDigits:0}).formatToParts(0).find(part=>part.type==='currency')?.value||store.settings.currency||'INR';

 useEffect(()=>{trackLedgerTabView(window.dataLayer,tab)},[tab]);
 useEffect(()=>{
  if(!user?.uid)return;
  let active=true;
  const cacheVersion=syncVersionRef.current;
  setSyncStatus(navigator.onLine?'loading':'offline');
  setProfileReady(false);
  setSettingsReady(false);
  setStore(current=>({...current,rows:[],transactions:[]}));
  const {startDate,endDateExclusive}=getMonthDateRange(month);
  const milkQuery=query(collection(db,'users',user.uid,'milk'),where('date','>=',startDate),where('date','<',endDateExclusive),orderBy('date','desc'));
  const transactionQuery=query(collection(db,'users',user.uid,'transactions'),where('date','>=',startDate),where('date','<',endDateExclusive),orderBy('date','desc'));
  const loadCached=async()=>{
   try{
   const [profileSnap,milkSnap,txSnap]=await Promise.all([
     getDocFromCache(doc(db,'users',user.uid)).catch(()=>null),
     getDocsFromCache(milkQuery).catch(()=>null),
     getDocsFromCache(transactionQuery).catch(()=>null)
    ]);
    if(!active||syncVersionRef.current!==cacheVersion)return;
    const profile=profileSnap?.exists()?profileSnap.data():{};
    const next={...DEFAULT_STATE,...profile,
     rows:(milkSnap?.docs||[]).map(d=>({id:d.id,...d.data(),sale_date:d.data().date,buyer:d.data().milkman,milk_type:d.data().milkType,created_at:d.data().createdAt?.toDate?.()?.toISOString?.()||''})),
     transactions:(txSnap?.docs||[]).map(d=>({id:d.id,...d.data(),created_at:d.data().createdAt?.toDate?.()?.toISOString?.()||''})),
     rates:{...DEFAULT_STATE.rates,...(profile.rates||{})},
     settings:normalizeSettings(profile.settings||{},profile.rates||{}),
     buyers:Array.isArray(profile.buyers)?profile.buyers:[]
    };
    setStore(next);
    setSettingsDraft(next.settings);
    setSettingsReady(Boolean(profileSnap));
    setForm(configuredMilkForm(next.settings,next.rates));
    setTxForm(configuredTransactionForm(next.settings));
    setProfileReady(true);
    setSyncStatus(navigator.onLine?'cached':'offline');
   }catch(err){if(active){report(err);setSyncStatus(navigator.onLine?'error':'offline');setProfileReady(true)}}
  };
  loadCached();
  return()=>{active=false};
 },[user?.uid,month]);
 useEffect(()=>{
  const online=()=>setSyncStatus('cached');
  const offline=()=>setSyncStatus('offline');
  window.addEventListener('online',online);
  window.addEventListener('offline',offline);
  return()=>{window.removeEventListener('online',online);window.removeEventListener('offline',offline)};
 },[]);


 async function syncNow(){
  if(syncBusy)return;
  if(!navigator.onLine){setSyncStatus('offline');return}
  const syncMonth=month;
  const syncVersion=++syncVersionRef.current;
  setSyncBusy(true);setSyncStatus('syncing');
  try{
   const {startDate,endDateExclusive}=getMonthDateRange(syncMonth);
   const milkQuery=query(collection(db,'users',user.uid,'milk'),where('date','>=',startDate),where('date','<',endDateExclusive),orderBy('date','desc'));
   const transactionQuery=query(collection(db,'users',user.uid,'transactions'),where('date','>=',startDate),where('date','<',endDateExclusive),orderBy('date','desc'));
   await waitForPendingWrites(db);
   const [profileSnap,milkSnap,txSnap]=await Promise.all([
    getDocFromServer(doc(db,'users',user.uid)),
    getDocsFromServer(milkQuery),
    getDocsFromServer(transactionQuery)
   ]);
   if(!auth.currentUser||auth.currentUser.uid!==user.uid||monthRef.current!==syncMonth||syncVersionRef.current!==syncVersion)return;
   const profile=profileSnap.exists()?profileSnap.data():{};
   const [cachedMilk,cachedTx]=await Promise.all([getDocsFromCache(milkQuery).catch(()=>null),getDocsFromCache(transactionQuery).catch(()=>null)]);
   const milkById=new Map(milkSnap.docs.map(d=>[d.id,{id:d.id,...d.data(),sale_date:d.data().date,buyer:d.data().milkman,milk_type:d.data().milkType,created_at:d.data().createdAt?.toDate?.()?.toISOString?.()||''}]));
   const txById=new Map(txSnap.docs.map(d=>[d.id,{id:d.id,...d.data(),created_at:d.data().createdAt?.toDate?.()?.toISOString?.()||''}]));
   (cachedMilk?.docs||[]).filter(d=>d.metadata.hasPendingWrites).forEach(d=>milkById.set(d.id,{id:d.id,...d.data(),sale_date:d.data().date,buyer:d.data().milkman,milk_type:d.data().milkType,created_at:d.data().createdAt?.toDate?.()?.toISOString?.()||''}));
   (cachedTx?.docs||[]).filter(d=>d.metadata.hasPendingWrites).forEach(d=>txById.set(d.id,{id:d.id,...d.data(),created_at:d.data().createdAt?.toDate?.()?.toISOString?.()||''}));
   const next={...DEFAULT_STATE,...profile,rows:[...milkById.values()],transactions:[...txById.values()],rates:{...DEFAULT_STATE.rates,...(profile.rates||{})},settings:normalizeSettings(profile.settings||{},profile.rates||{}),buyers:Array.isArray(profile.buyers)?profile.buyers:[]};
   setStore(next);setSettingsDraft(next.settings);setForm(configuredMilkForm(next.settings,next.rates));setTxForm(configuredTransactionForm(next.settings));
   setProfileReady(true);setSettingsReady(true);setSyncStatus('synced');success('सर्वर से डेटा अपडेट हो गया।');
  }catch(err){report(err);setSyncStatus(navigator.onLine?'error':'offline')}
  finally{setSyncBusy(false)}
 }

 function addCatalogueOption(field){
  setSettingsDraft(current=>({...current,catalogues:{...current.catalogues,[field]:[...current.catalogues[field],{value:'custom_'+Date.now().toString(36),label:'नया विकल्प',active:true,...(field==='transactionKinds'?{effect:'received'}:{})}]}}));
 }

 async function saveAccountSettings(e){
  e.preventDefault();
  if(!settingsReady)return report('सेटिंग्स बदलने से पहले Sync Now चलाकर सर्वर प्रोफ़ाइल प्राप्त करें।');
  const settings=normalizeSettings(settingsDraft,store.rates);
  if(!settingsDraft.ledgerName.trim())return report('लेजर या व्यवसाय का नाम दर्ज करें।');
  if(settings.quickEntryEnabled&&(!settings.defaultMilkman.trim()||!settings.defaultRate.trim()||!Number.isFinite(Number(settings.defaultRate))||Number(settings.defaultRate)<=0||!settings.catalogues.milkTypes.some(item=>item.value===settings.defaultMilkType&&item.active))){
   return report('त्वरित प्रविष्टि के लिए सप्लायर का नाम और शून्य से अधिक डिफ़ॉल्ट दर दर्ज करें।');
  }
  const next={...store,settings};
  if(await persist(next)){
   setSettingsDraft(settings);
   setForm(configuredMilkForm(settings,next.rates));
   setTxForm(configuredTransactionForm(settings));
   setSettingsOpen(false);
   success('आपकी लेजर प्रोफ़ाइल और प्रविष्टि सेटिंग्स सुरक्षित हो गईं।');
  }
 }
 function report(err){setError(getCloudLoadingError(err)||'यह कार्य पूरा नहीं हो सका।');setNotice('')}
 function success(msg){setNotice(msg);setError('')}
 async function signOutAccount(){
  try{await signOut(auth)}catch(err){report(err)}
 }
 async function linkGuestAccount(){
  setError('');
  try{
   await linkWithPopup(auth.currentUser,googleProvider);
   window.location.reload();
  }catch(err){report(getGuestLinkError(err))}
 }
 async function leaveGuestSession(){
  if(!window.confirm('अतिथि सत्र छोड़ने पर इस ब्राउज़र से अतिथि खाते की पहुँच हट जाएगी। पहले Google खाते से जोड़ें या JSON बैकअप लें। क्या सत्र छोड़ना है?'))return;
  try{await signOut(auth)}catch(err){report(err)}
 }
 function persist(next,includeSettings=settingsReady){
  try{
   const profilePatch={rates:next.rates,buyers:next.buyers,updatedAt:serverTimestamp()};
   if(includeSettings)profilePatch.settings=next.settings;
   const write=setDoc(doc(db,'users',user.uid),profilePatch,{merge:true});
   write.catch(report);
   setStore(next);
   return true;
  }catch(err){report(err);return false}
 }
 async function deleteMilk(id){
  if(!window.confirm('क्या इस दूध प्रविष्टि को स्थायी रूप से हटाना है?'))return;
  try{
   const previous=store.rows.find(row=>row.id===id);
   const deletion=deleteDoc(doc(db,'users',user.uid,'milk',id));deletion.catch(err=>{if(previous)setStore(current=>({...current,rows:[...current.rows,previous]}));setSyncStatus('error');report(err)});
   setStore(current=>({...current,rows:current.rows.filter(row=>row.id!==id)}));
   success(navigator.onLine?'दूध प्रविष्टि हटाने का अनुरोध भेजा गया।':'प्रविष्टि स्थानीय रूप से हटाई गई; ऑनलाइन होने पर समन्वय होगा।');
  }catch(err){report(err)}
 }
 async function deleteTransaction(id){
  if(!window.confirm('क्या इस लेन-देन को स्थायी रूप से हटाना है?'))return;
  try{
   const previous=store.transactions.find(row=>row.id===id);
   const deletion=deleteDoc(doc(db,'users',user.uid,'transactions',id));deletion.catch(err=>{if(previous)setStore(current=>({...current,transactions:[...current.transactions,previous]}));setSyncStatus('error');report(err)});
   setStore(current=>({...current,transactions:current.transactions.filter(row=>row.id!==id)}));
   success(navigator.onLine?'लेन-देन हटाने का अनुरोध भेजा गया।':'लेन-देन स्थानीय रूप से हटाया गया; ऑनलाइन होने पर समन्वय होगा।');
  }catch(err){report(err)}
 }
 function selectPeriodPage(page,targetMonth=month){
  const y=Number(targetMonth.slice(0,4)),m=Number(targetMonth.slice(5,7));
  const days=new Date(y,m,0).getDate(),start=(page-1)*10+1,end=Math.min(page*10,days);
  const now=today(),nowDay=Number(now.slice(8,10));
  const selectedDate=targetMonth===now.slice(0,7)&&nowDay>=start&&nowDay<=end?now:targetMonth+'-'+String(start).padStart(2,'0');
  setPeriodPage(page);
  setForm(current=>({...current,sale_date:selectedDate}));
  setTxForm(current=>({...current,date:selectedDate}));
 }
 function changeMonth(value){
  if(!value)return;
  const current=today().slice(0,7);
  const page=value===current?Math.min(3,Math.ceil(Number(today().slice(8,10))/10)):value<current?3:1;
  setMonth(value);
  selectPeriodPage(page,value);
 }
 async function loadCompleteLedgerData(){
  await waitForPendingWrites(db);
  const milkCollection=collection(db,'users',user.uid,'milk');
  const transactionCollection=collection(db,'users',user.uid,'transactions');
  const [milkSnapshot,transactionSnapshot]=await Promise.all([
   getDocsFromServer(query(milkCollection,orderBy('date','desc'))),
   getDocsFromServer(query(transactionCollection,orderBy('date','desc')))
  ]);
  return {
   ...store,
   rows:milkSnapshot.docs.map(d=>({id:d.id,...d.data(),sale_date:d.data().date,buyer:d.data().milkman,milk_type:d.data().milkType,created_at:d.data().createdAt?.toDate?.()?.toISOString?.()||''})),
   transactions:transactionSnapshot.docs.map(d=>({id:d.id,...d.data(),created_at:d.data().createdAt?.toDate?.()?.toISOString?.()||''})),
  };
 }
 async function exportBackup(){
  setBackupBusy(true);
  try{
   const fullLedger = await loadCompleteLedgerData();
   const blob=new Blob([JSON.stringify({schema:5,exportedAt:new Date().toISOString(),...fullLedger},null,2)],{type:'application/json'});
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='kamdhenu-backup-'+today()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);success('बैकअप डाउनलोड हो गया।');
  }catch(err){report(err)}
  finally{setBackupBusy(false)}
 }
 async function restoreBackupData(d){
  const backup=validateBackupPayload(d);
  if(!window.confirm('क्या बैकअप की केवल नई प्रविष्टियाँ जोड़नी हैं? मौजूदा प्रविष्टियाँ बदली या हटाई नहीं जाएँगी।'))return;
  await waitForPendingWrites(db);
  const milkCollection=collection(db,'users',user.uid,'milk');
  const transactionCollection=collection(db,'users',user.uid,'transactions');
  const [milkSnapshot,transactionSnapshot]=await Promise.all([getDocsFromServer(query(milkCollection,orderBy('date','desc'))),getDocsFromServer(query(transactionCollection,orderBy('date','desc')))]);
  const milkExisting=milkSnapshot.docs.map(snapshot=>({id:snapshot.id,...snapshot.data()}));
  const transactionExisting=transactionSnapshot.docs.map(snapshot=>({id:snapshot.id,...snapshot.data()}));
  const milkAdditions=planRestoreMerge(backup.rows,milkExisting,normalizeMilkRecord);
  const transactionAdditions=planRestoreMerge(backup.transactions,transactionExisting,normalizeTransactionRecord);
  for(const item of milkAdditions){
   const payload={...item.record,createdAt:serverTimestamp()};
   if(item.id)await setDoc(doc(milkCollection,item.id),payload);
   else await addDoc(milkCollection,payload);
  }
  for(const item of transactionAdditions){
   const payload={...item.record,createdAt:serverTimestamp()};
   if(item.id)await setDoc(doc(transactionCollection,item.id),payload);
   else await addDoc(transactionCollection,payload);
  }
  const profileSnapshot=await getDocFromServer(doc(db,'users',user.uid));
  const remoteProfile=profileSnapshot.exists()?profileSnapshot.data():{};
  const restoreBase={...store,
   rates:{...store.rates,...(remoteProfile.rates||{})},
   buyers:[...new Set([...store.buyers,...(Array.isArray(remoteProfile.buyers)?remoteProfile.buyers:[])])],
   settings:normalizeSettings(remoteProfile.settings||store.settings,remoteProfile.rates||store.rates),
  };
  const profileSaved=await persist({
   ...restoreBase,
   rates:{...restoreBase.rates,...backup.rates},
   buyers:[...new Set([...restoreBase.buyers,...backup.buyers])],
   settings:{...restoreBase.settings,...backup.settings},
  },true);
  setSettingsReady(true);
  if(!profileSaved){
   throw new Error('बैकअप की प्रविष्टियाँ जोड़ी गई हैं, लेकिन दरें और सेटिंग्स सुरक्षित नहीं हो सकीं। JSON बैकअप दोबारा पुनर्स्थापित करें; जो प्रविष्टियाँ पहले जुड़ चुकी हैं वे दोहराई नहीं जाएँगी।');
  }
  success(`बैकअप से ${milkAdditions.length} दूध और ${transactionAdditions.length} लेन-देन की नई प्रविष्टियाँ जोड़ी गईं।`);
 }
 function importBackup(e){
  const file=e.target.files?.[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=async()=>{
   try{await restoreBackupData(JSON.parse(String(reader.result)))}
   catch(err){report(err)}finally{e.target.value=''}
  };
  reader.readAsText(file);
 }
 async function backupToDrive(accessToken){
  const fullLedger = await loadCompleteLedgerData();
  const payload={schema:5,exportedAt:new Date().toISOString(),...fullLedger};
  const find=await fetch("https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27kamdhenu-backup.json%27%20and%20trashed%3Dfalse&fields=files(id,name)",{headers:{Authorization:'Bearer '+accessToken}});
  if(!find.ok)throw new Error('Google Drive में बैकअप फ़ाइल की जाँच नहीं हो सकी।');
  const matches=(await find.json()).files||[];
  const existing=matches[0];
  const boundary='kamdhenu_drive_boundary_2026';
  const metadata=existing?{name:'kamdhenu-backup.json'}:{name:'kamdhenu-backup.json',mimeType:'application/json',parents:['appDataFolder']};
  const body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+JSON.stringify(payload)+'\r\n--'+boundary+'--';
  const url=existing?'https://www.googleapis.com/upload/drive/v3/files/'+existing.id+'?uploadType=multipart':'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const response=await fetch(url,{method:existing?'PATCH':'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'multipart/related; boundary='+boundary},body});
  if(!response.ok)throw new Error('Google Drive में बैकअप सुरक्षित नहीं हो सका।');
  success('Google Drive में बैकअप सुरक्षित हो गया।');
 }
 async function restoreFromDrive(accessToken){
  const find=await fetch("https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27kamdhenu-backup.json%27%20and%20trashed%3Dfalse&fields=files(id,name)",{headers:{Authorization:'Bearer '+accessToken}});
  if(!find.ok)throw new Error('Google Drive बैकअप की जाँच नहीं हो सकी।');
  const matches=(await find.json()).files||[];
  if(!matches.length)throw new Error('Google Drive में कामधेनु का बैकअप नहीं मिला।');
  const response=await fetch('https://www.googleapis.com/drive/v3/files/'+matches[0].id+'?alt=media',{headers:{Authorization:'Bearer '+accessToken}});
  if(!response.ok)throw new Error('Google Drive बैकअप डाउनलोड नहीं हो सका।');
  await restoreBackupData(await response.json());
 }
 function requestDriveAccess(action){
  const clientId=import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if(!clientId)return report('Drive बैकअप के लिए Render पर VITE_GOOGLE_CLIENT_ID निर्धारित करें।');
  if(!window.google?.accounts?.oauth2)return report('Google Drive अनुमति सेवा लोड नहीं हुई। इंटरनेट कनेक्शन जाँचें।');
  setDriveBusy(true);
  try{
   const client=window.google.accounts.oauth2.initTokenClient({
    client_id:clientId,
    scope:'https://www.googleapis.com/auth/drive.appdata',
    callback:async response=>{
     try{
      if(response.error||!response.access_token)throw new Error(response.error_description||'Google Drive अनुमति नहीं मिली।');
      await action(response.access_token);
     }catch(err){report(err)}finally{setDriveBusy(false)}
    },
    error_callback:err=>{setDriveBusy(false);report(err?.message||'Google Drive अनुमति विफल रही।')}
   });
   client.requestAccessToken({hint:user.email||undefined});
  }catch(err){setDriveBusy(false);report(err)}
 }

 async function saveMilk(e){
  e.preventDefault();
  if(!profileReady)return report('खाता सेटिंग्स अभी उपलब्ध नहीं हैं। समन्वय पूरा होने तक प्रतीक्षा करें।');
  const quantity=Number(form.quantity),quickEntry=store.settings.quickEntryEnabled,rate=Number(quickEntry&&store.settings.lockDefaultRate?store.settings.defaultRate:form.rate),milkman=(quickEntry?store.settings.defaultMilkman:form.buyer).trim(),milkType=quickEntry?store.settings.defaultMilkType:form.milk_type;
  if(form.sale_date<periodStart||form.sale_date>periodEnd)return report('दिनांक चुने हुए पृष्ठ की अवधि में होनी चाहिए।');
  if(!form.sale_date||!milkman||!String(form.quantity).trim()||!String(form.rate).trim()||!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(rate)||rate<0)return report('दिनांक, दूधवाले का नाम, शून्य से अधिक मात्रा और वैध दर दर्ज करें।');
  try{
   const record={date:form.sale_date,shift:form.shift||'morning',shiftLabel:shiftLabel(form.shift||'morning',store.settings.catalogues),milkman,milkType,milkTypeLabel:milkLabel(milkType,store.settings.catalogues),quantity,rate,amount:Math.round(quantity*rate*100)/100,remarks:form.remarks.trim(),createdAt:serverTimestamp()};
   const ref=doc(collection(db,'users',user.uid,'milk'));
   const milkWrite=setDoc(ref,record);milkWrite.catch(err=>{setStore(current=>({...current,rows:current.rows.filter(item=>item.id!==ref.id)}));setSyncStatus('error');report(err)});
   const row={id:ref.id,...record,sale_date:record.date,buyer:milkman,milk_type:milkType,created_at:new Date().toISOString()};
   const next={...store,rows:[...store.rows,row],buyers:[...new Set([...store.buyers,milkman])],rates:{...store.rates,[milkType+'_rate']:rate}};
   const profileSaved=await persist(next);
   setForm(configuredMilkForm(next.settings,next.rates));
   const feedback=getMilkSaveFeedback(profileSaved);
   if(profileSaved)success(navigator.onLine?'प्रविष्टि स्थानीय रूप से सुरक्षित; सर्वर से समन्वय जारी है।':'प्रविष्टि स्थानीय रूप से सुरक्षित; इंटरनेट उपलब्ध होने पर समन्वय होगा।');else report(feedback.message);
  }catch(err){report(err)}
 }
 async function saveTransaction(e){
  e.preventDefault();
  if(!profileReady)return report('खाता सेटिंग्स अभी उपलब्ध नहीं हैं। समन्वय पूरा होने तक प्रतीक्षा करें।');
  const amount=Number(txForm.amount);
  if(txForm.date<periodStart||txForm.date>periodEnd)return report('दिनांक चुने हुए पृष्ठ की अवधि में होनी चाहिए।');
  if(!txForm.date||!String(txForm.amount).trim()||!Number.isFinite(amount)||amount<=0)return report('वैध दिनांक और शून्य से अधिक राशि दर्ज करें।');
  const transactionEffect=store.settings.catalogues.transactionKinds.find(item=>item.value===txForm.kind)?.effect||txForm.kind;
  if(transactionEffect==='expense'&&!txForm.category)return report('खर्च का मद चुनें।');
  try{
   const record={date:txForm.date,kind:txForm.kind,kindLabel:catalogueLabel(store.settings.catalogues.transactionKinds,txForm.kind),kindEffect:transactionEffect,amount,party:txForm.party.trim(),category:transactionEffect==='expense'?txForm.category:'',categoryLabel:catalogueLabel(store.settings.catalogues.expenseCategories,txForm.category),remarks:txForm.remarks.trim(),createdAt:serverTimestamp()};
   const ref=doc(collection(db,'users',user.uid,'transactions'));
   const transactionWrite=setDoc(ref,record);transactionWrite.catch(err=>{setStore(current=>({...current,transactions:current.transactions.filter(item=>item.id!==ref.id)}));setSyncStatus('error');report(err)});
   setStore(current=>({...current,transactions:[...current.transactions,{id:ref.id,...record,created_at:new Date().toISOString()}]}));
   setTxForm(configuredTransactionForm(store.settings));success(navigator.onLine?'लेन-देन स्थानीय रूप से सुरक्षित; सर्वर से समन्वय जारी है।':'लेन-देन स्थानीय रूप से सुरक्षित; इंटरनेट उपलब्ध होने पर समन्वय होगा।');
  }catch(err){report(err)}
 }
 function exportCsv(){
  const data=store.rows.filter(x=>x.sale_date.startsWith(month)).sort(sortNewest);
  const lines=[['दिनांक','दूधवाला','समय','दूध का प्रकार','मात्रा (लीटर)','दर','राशि','टिप्पणी'],...data.map(x=>[x.sale_date,x.buyer,x.shiftLabel||historicalCatalogueLabel(store.settings.catalogues.shifts,x.shift,'समय दर्ज नहीं'),x.milkTypeLabel||historicalCatalogueLabel(store.settings.catalogues.milkTypes,x.milk_type),x.quantity,x.rate,x.amount,x.remarks||''])];
  const csv=lines.map(row=>row.map(x=>{let v=String(x??'');if(/^[\\t\\r ]*[=+@-]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"'}).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\\ufeff'+csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='kamdhenu-doodh-'+month+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }

 const year=Number(month.slice(0,4)),monthNumber=Number(month.slice(5,7));
 const daysInMonth=new Date(year,monthNumber,0).getDate();
 const currentMonth=today().slice(0,7);
 const monthCutoff=month===currentMonth?today():month<currentMonth?month+'-'+String(daysInMonth).padStart(2,'0'):month+'-00';
 const monthMilk=store.rows.filter(x=>x.sale_date.startsWith(month)&&x.sale_date<=monthCutoff);
 const monthTransactions=store.transactions.filter(x=>x.date.startsWith(month)&&x.date<=monthCutoff);
 const periodStartDay=(periodPage-1)*10+1;
 const periodEndDay=Math.min(periodPage*10,daysInMonth);
 const dateKey=day=>month+'-'+String(day).padStart(2,'0');
 const periodStart=dateKey(periodStartDay),periodEnd=dateKey(periodEndDay);
 const periodMilk=store.rows.filter(x=>x.sale_date>=periodStart&&x.sale_date<=periodEnd).sort(sortNewest);
 const periodTransactions=store.transactions.filter(x=>x.date>=periodStart&&x.date<=periodEnd).sort(sortNewest);
 const todayMilk=store.rows.filter(x=>x.sale_date===today());
 const total=xs=>xs.reduce((sum,x)=>sum+Number(x.amount||0),0);
 const qty=xs=>xs.reduce((sum,x)=>sum+Number(x.quantity||0),0);
 const received=monthTransactions.filter(x=>x.kind==='received');
 const remained=monthTransactions.filter(x=>x.kind==='remained');
 const advanced=monthTransactions.filter(x=>x.kind==='advance');
 const expenses=monthTransactions.filter(x=>x.kind==='expense');
 const receivedTotal=total(received),remainedTotal=total(remained),advancedTotal=total(advanced),expenseTotal=total(expenses);
 const milkSalesTotal=total(monthMilk);
 const netAmount=milkSalesTotal+receivedTotal-advancedTotal-expenseTotal;
 const milkToday=qty(todayMilk),milkToDate=qty(monthMilk);
 const periodEntryCount=tab==='Milk'?periodMilk.length:periodTransactions.length;
 const rangeLabel=periodStartDay+'–'+periodEndDay;
 const periodLabel=periodPage===1?'पहला पृष्ठ':periodPage===2?'दूसरा पृष्ठ':'तीसरा पृष्ठ';

 const syncMessages={loading:'स्थानीय डेटा तैयार हो रहा है…',cached:'स्थानीय डेटा · सर्वर से सिंक आवश्यक',syncing:'सर्वर से समन्वय जारी…',synced:'सर्वर से डेटा अपडेट हुआ',offline:'ऑफ़लाइन · उपलब्ध स्थानीय डेटा',pending:'परिवर्तन सिंक होने की प्रतीक्षा में',error:'सर्वर से समन्वय में समस्या'};
 return <div className="app">
  <header>
   <div className="brand-mark">क</div>
   <div className="brand-copy"><b>{store.settings.ledgerName}</b><small>{store.settings.tagline}</small></div>
   {!isInstalled&&<button className="install-action" onClick={onInstall}>{installPrompt?'ऐप इंस्टॉल करें':'इंस्टॉल करें'}</button>}
   {isInstalled&&<span className="installed-label">ऐप मोड</span>}
   <label className="backup-label">बैकअप पुनर्स्थापित करें<input type="file" accept="application/json,.json" onChange={importBackup}/></label>
   <button className="header-action" onClick={exportBackup} disabled={backupBusy}>{backupBusy?'बैकअप तैयार हो रहा है…':'बैकअप लें'}</button>
  </header>
  {installHelp&&<div className="storage-notice">Chrome के ⋮ मेनू से “ऐप इंस्टॉल करें” या “होम स्क्रीन पर जोड़ें” चुनें।</div>}
  <div className={'sync-status sync-'+syncStatus} role="status" aria-live="polite">{syncMessages[syncStatus]||syncMessages.loading}</div>
  <div className="sync-action-row"><button type="button" className="sync-now" onClick={syncNow} disabled={syncBusy||!navigator.onLine}>{syncBusy?'समन्वय जारी…':'अभी सिंक करें'}</button></div>
  <div className="account-bar"><span title={user?.email||'अतिथि खाता'}>{user?.isAnonymous?'अतिथि सत्र · इसी ब्राउज़र पर':user?.email}</span>{user?.isAnonymous?<><button type="button" onClick={linkGuestAccount}>Google खाते से जोड़ें</button><button type="button" onClick={leaveGuestSession}>सत्र छोड़ें</button></>:<button type="button" onClick={signOutAccount}>साइन आउट</button>}</div>
  <div className="drive-actions">
   <button type="button" className="secondary" onClick={()=>requestDriveAccess(backupToDrive)} disabled={driveBusy}>{driveBusy?'प्रक्रिया जारी है…':'Drive में बैकअप'}</button>
   <button type="button" className="secondary" onClick={()=>requestDriveAccess(restoreFromDrive)} disabled={driveBusy}>Drive से पुनर्स्थापित करें</button>
  </div>
  <div className="storage-notice">परीक्षण संस्करण · प्रविष्टियाँ आपके Firebase खाते (Google या अतिथि) के साथ Firestore में सिंक होती हैं। अतिथि डेटा को दूसरे डिवाइस पर सुरक्षित रखने के लिए Google खाते से जोड़ें। वास्तविक हिसाब Version 2.0 के स्थिर विमोचन के बाद दर्ज करें।</div>
  <section className="mode-strip">
   <div><b>लेजर प्रोफ़ाइल और सेटिंग्स</b><small>{store.settings.quickEntryEnabled?store.settings.quickEntryLabel+' · '+store.settings.defaultMilkman:'सामान्य प्रविष्टि · '+store.settings.currency}</small></div>
   <button type="button" className="mode-settings" aria-expanded={settingsOpen} disabled={!settingsReady} onClick={()=>setSettingsOpen(v=>!v)}>{settingsOpen?'बंद करें':'कॉन्फ़िगर करें'}</button>
  </section>
  {settingsOpen&&<form className="account-settings-panel" onSubmit={saveAccountSettings}>
   <b>लेजर और खाता सेटिंग्स</b>
   <label>लेजर / व्यवसाय का नाम<input className="text-input full-text" maxLength="60" value={settingsDraft.ledgerName} onChange={e=>setSettingsDraft({...settingsDraft,ledgerName:e.target.value})} placeholder="उदाहरण: शिव डेयरी" required/></label>
   <label>विवरण / उपशीर्षक<input className="full-text" maxLength="100" value={settingsDraft.tagline} onChange={e=>setSettingsDraft({...settingsDraft,tagline:e.target.value})} placeholder="उदाहरण: दैनिक दूध एवं नकद हिसाब"/></label>
   <label>मुद्रा<select value={settingsDraft.currency} onChange={e=>setSettingsDraft({...settingsDraft,currency:e.target.value})}>{SUPPORTED_CURRENCIES.map(code=><option key={code} value={code}>{code}</option>)}</select></label><small>मुद्रा बदलने से केवल प्रदर्शन प्रारूप बदलता है; पुरानी राशियों का विनिमय-दर रूपांतरण नहीं होता।</small>
   <label className="setting-check"><input type="checkbox" checked={settingsDraft.quickEntryEnabled} onChange={e=>setSettingsDraft({...settingsDraft,quickEntryEnabled:e.target.checked})}/> त्वरित प्रविष्टि प्रोफ़ाइल सक्षम करें</label>
   {settingsDraft.quickEntryEnabled&&<>
    <label>प्रोफ़ाइल का नाम<input className="full-text" maxLength="50" value={settingsDraft.quickEntryLabel} onChange={e=>setSettingsDraft({...settingsDraft,quickEntryLabel:e.target.value})} placeholder="उदाहरण: सुबह की सप्लाई"/></label>
    <label>निश्चित सप्लायर / दूधवाला<input className="full-text" maxLength="80" value={settingsDraft.defaultMilkman} onChange={e=>setSettingsDraft({...settingsDraft,defaultMilkman:e.target.value})} placeholder="नाम दर्ज करें" required/></label>
    <label>डिफ़ॉल्ट दूध का प्रकार<RadioChoices name="quick-profile-milk-type" value={settingsDraft.defaultMilkType} onChange={v=>setSettingsDraft({...settingsDraft,defaultMilkType:v})} options={settingsDraft.catalogues.milkTypes.filter(item=>item.active)}/></label>
    <label>डिफ़ॉल्ट दर ({currencySymbol}/लीटर)<input className="number-input" type="number" min=".01" step=".01" inputMode="decimal" value={settingsDraft.defaultRate} onChange={e=>setSettingsDraft({...settingsDraft,defaultRate:e.target.value})} placeholder="उदाहरण: 70" required/></label>
    <label className="setting-check"><input type="checkbox" checked={settingsDraft.lockDefaultRate} onChange={e=>setSettingsDraft({...settingsDraft,lockDefaultRate:e.target.checked})}/> प्रविष्टि में डिफ़ॉल्ट दर स्थिर रखें</label>
    <small>सक्षम होने पर सप्लायर और दूध का प्रकार स्वतः भरे जाएँगे। दर स्थिर न रखने पर प्रत्येक प्रविष्टि में उसे बदला जा सकेगा।</small>
   </>}
   <div className="catalogue-settings">
    <b>पूर्वनिर्धारित विकल्प</b>
    <small>नाम बदले या विकल्प निष्क्रिय करें। पुराने लेन-देन और दूध प्रविष्टियाँ यथावत रहेंगी।</small>
    <CatalogueEditor title="दूध के प्रकार" items={settingsDraft.catalogues.milkTypes} onChange={items=>setSettingsDraft({...settingsDraft,catalogues:{...settingsDraft.catalogues,milkTypes:items}})} onAdd={()=>addCatalogueOption('milkTypes')}/>
    <CatalogueEditor title="दूध देने का समय" items={settingsDraft.catalogues.shifts} onChange={items=>setSettingsDraft({...settingsDraft,catalogues:{...settingsDraft.catalogues,shifts:items}})} onAdd={()=>addCatalogueOption('shifts')}/>
    <CatalogueEditor title="लेन-देन के प्रकार" items={settingsDraft.catalogues.transactionKinds} showEffects onChange={items=>setSettingsDraft({...settingsDraft,catalogues:{...settingsDraft.catalogues,transactionKinds:items}})} onAdd={()=>addCatalogueOption('transactionKinds')}/>
    <CatalogueEditor title="खर्च के मद" items={settingsDraft.catalogues.expenseCategories} onChange={items=>setSettingsDraft({...settingsDraft,catalogues:{...settingsDraft.catalogues,expenseCategories:items}})} onAdd={()=>addCatalogueOption('expenseCategories')}/>
   </div>
   <label>फुटर नोट (वैकल्पिक)<input className="full-text" maxLength="120" value={settingsDraft.footerNote} onChange={e=>setSettingsDraft({...settingsDraft,footerNote:e.target.value})} placeholder="शाखा, संस्था या संपर्क विवरण"/></label>
   <button type="submit" disabled={!settingsReady}>सेटिंग्स सुरक्षित करें</button>
  </form>}
  <section className="hero">
   <div className="hero-top"><span>मासिक सारांश</span><label className="hero-month"><input aria-label="माह चुनें" type="month" value={month} onChange={e=>changeMonth(e.target.value)}/></label></div>
   <div className="hero-metrics">
    <div className="hero-milk"><small>दूध आज तक</small><strong>{number(milkToDate)}<i>लीटर</i></strong><span>{store.settings.catalogues.milkTypes.filter(item=>item.active).map(item=>item.label+' '+number(qty(monthMilk.filter(x=>x.milk_type===item.value)))+' L').join(' · ')}</span></div>
    <div className="hero-net"><small>शुद्ध राशि</small><strong>{money(netAmount)}</strong><span>बिक्री + प्राप्ति − अग्रिम − खर्च</span></div>
   </div>
   <div className="hero-foot"><span>आज का दूध</span><b>{number(milkToday)} लीटर</b><span>आज की बिक्री</span><b>{money(total(todayMilk))}</b></div>
  </section>
  <nav aria-label="मुख्य मेनू">
   <button className={tab==='Milk'?'active':''} onClick={()=>{changeLedgerTab('Milk',setTab);setError('');setNotice('')}}>दूध</button>
   <button className={tab==='Transactions'?'active':''} onClick={()=>{changeLedgerTab('Transactions',setTab);setError('');setNotice('')}}>लेन-देन</button>
  </nav>
  <main>
   <div className="heading-row">
    <h1>{tab==='Milk'?'दूध दर्ज करें':'लेन-देन दर्ज करें'}</h1>
    <span className="period-count">{periodEntryCount} प्रविष्टियाँ</span>
   </div>
   <section className="period-panel" aria-label="मासिक पृष्ठ चयन">
    <div className="period-heading"><b>{periodLabel}</b><small>लगभग 10 दिन · करीब 20 प्रविष्टियाँ प्रति पृष्ठ</small></div>
    <div className="period-buttons">
     {[1,2,3].map(page=><button key={page} className={periodPage===page?'selected':''} aria-current={periodPage===page?'page':undefined} onClick={()=>selectPeriodPage(page)}>
      <span>{page}</span><small>{page===1?'1–10':page===2?'11–20':'21–'+daysInMonth}</small>
     </button>)}
    </div>
    <div className="period-range">{rangeLabel} तारीख · {periodEntryCount} {tab==='Milk'?'दूध प्रविष्टियाँ':'लेन-देन'}</div>
   </section>
   {error&&<p className="error" role="alert">{error}</p>}
   {notice&&<p className="notice" role="status">{notice}</p>}
   {tab==='Milk'&&<>
    <form className="entry-form" onSubmit={saveMilk}>
     <label>दूधवाला (Milkman)<input className="text-input full-text" value={store.settings.quickEntryEnabled?store.settings.defaultMilkman:form.buyer} onChange={e=>setForm({...form,buyer:e.target.value})} placeholder="नाम लिखें" readOnly={store.settings.quickEntryEnabled} required/></label>
     <div className="field-pair">
      <label>दिनांक<input className="date-input" type="date" value={form.sale_date} onChange={e=>setForm({...form,sale_date:e.target.value})} required/></label>
      <label>समय<RadioChoices name="milk-shift" value={form.shift} onChange={v=>setForm({...form,shift:v})} options={store.settings.catalogues.shifts.filter(item=>item.active)}/></label>
     </div>
     <div className="field-triple">
      <label>मात्रा (लीटर)<input className="number-input" type="number" min=".01" step=".01" inputMode="decimal" placeholder="0" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} required/></label>
      <label>दर ({currencySymbol})<input className="number-input" type="number" min="0" step=".01" inputMode="decimal" placeholder="0" value={form.rate} onChange={e=>setForm({...form,rate:e.target.value})} readOnly={store.settings.quickEntryEnabled&&store.settings.lockDefaultRate} required/></label>
      <label>प्रकार{store.settings.quickEntryEnabled?<span className="fixed-value">{milkLabel(store.settings.defaultMilkType,store.settings.catalogues)} · प्रोफ़ाइल</span>:<RadioChoices name="milk-type" value={form.milk_type} onChange={v=>setForm({...form,milk_type:v,rate:String(store.rates[v+'_rate']??0)})} options={store.settings.catalogues.milkTypes.filter(item=>item.active)}/>}</label>
     </div>
     <label>टिप्पणी<textarea className="comment-input" rows="2" value={form.remarks} onChange={e=>setForm({...form,remarks:e.target.value})} placeholder="वैकल्पिक टिप्पणी"/></label>
     <b className="amount-preview">कुल राशि: {money(Number(form.quantity)*Number(form.rate))}</b>
     <p className="append-note">प्रविष्टि सुरक्षित होने के बाद बदली नहीं जा सकती; आवश्यकता हो तो हटाई जा सकती है।</p>
     <div className="form-actions"><button disabled={!profileReady}>नई दूध प्रविष्टि सुरक्षित करें</button></div>
    </form>
    <div className="list-heading"><h2>इस अवधि की दूध प्रविष्टियाँ</h2><button className="secondary small-action" onClick={exportCsv}>मासिक CSV</button></div>
    <div className="record-list">{periodMilk.map(row=><article className="record" key={row.id}>
     <div><b>{row.buyer}</b><small>{row.sale_date} · {row.shiftLabel||historicalCatalogueLabel(store.settings.catalogues.shifts,row.shift,'समय दर्ज नहीं')} · {row.milkTypeLabel||historicalCatalogueLabel(store.settings.catalogues.milkTypes,row.milk_type)} · {number(row.quantity)} लीटर × {money(row.rate)}</small>{row.remarks&&<small>{row.remarks}</small>}</div>
     <strong>{money(row.amount)}</strong><div className="record-actions"><button type="button" className="delete-record" onClick={()=>deleteMilk(row.id)}>हटाएँ</button></div>
    </article>)}{!periodMilk.length&&<p className="empty">इस अवधि में कोई दूध प्रविष्टि नहीं है।</p>}</div>
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
     <label>लेन-देन का प्रकार<RadioChoices name="transaction-kind" value={txForm.kind} onChange={v=>setTxForm({...txForm,kind:v})} options={store.settings.catalogues.transactionKinds.filter(item=>item.active)}/></label>
     <label>राशि ({currencySymbol})<input className="number-input" type="number" min=".01" step=".01" inputMode="decimal" placeholder="0" value={txForm.amount} onChange={e=>setTxForm({...txForm,amount:e.target.value})} required/></label>
     <label>किससे / किसे (To Whom)<input className="text-input full-text" value={txForm.party} onChange={e=>setTxForm({...txForm,party:e.target.value})} placeholder="व्यक्ति या पार्टी का नाम"/></label>
     {(store.settings.catalogues.transactionKinds.find(item=>item.value===txForm.kind)?.effect||txForm.kind)==='expense'&&<label>खर्च का मद<RadioChoices name="expense-category" value={txForm.category} onChange={v=>setTxForm({...txForm,category:v})} options={store.settings.catalogues.expenseCategories.filter(item=>item.active)}/></label>}
     <label>टिप्पणी<textarea className="comment-input" rows="2" value={txForm.remarks} onChange={e=>setTxForm({...txForm,remarks:e.target.value})} placeholder="वैकल्पिक टिप्पणी"/></label>
     <p className="append-note">हर लेन-देन नई प्रविष्टि है। इसे बदला नहीं जा सकता; आवश्यकता होने पर हटाया जा सकता है।</p>
     <div className="form-actions"><button disabled={!profileReady}>नया लेन-देन सुरक्षित करें</button></div>
    </form>
    <h2 className="section-title">इस अवधि के लेन-देन</h2>
    <div className="record-list">{periodTransactions.map(t=>{
     const kindLabel=t.kind==='received'?'प्राप्त':t.kind==='remained'?'बाकी':t.kind==='advance'?'अग्रिम':'खर्च';
     const cat=expenseCategories.find(c=>c.value===t.category)?.label||'अन्य';
     return <article className="record" key={t.id}>
      <div><b>{kindLabel}{(t.kindEffect||store.settings.catalogues.transactionKinds.find(item=>item.value===t.kind)?.effect||t.kind)==='expense'?' · '+cat:''}</b><small>{t.date}{t.party?' · '+t.party:''}{t.remarks?' · '+t.remarks:''}</small></div>
      <strong>{money(t.amount)}</strong><div className="record-actions"><button type="button" className="delete-record" onClick={()=>deleteTransaction(t.id)}>हटाएँ</button></div>
     </article>
    })}{!periodTransactions.length&&<p className="empty">इस अवधि में कोई लेन-देन दर्ज नहीं है।</p>}</div>
   </>}
  </main>
  <footer className="app-footer"><b>{store.settings.footerNote||store.settings.ledgerName}</b>{store.settings.tagline&&<i>{store.settings.tagline}</i>}<small>इस खाते की प्रविष्टियाँ केवल प्रमाणित खाते से जुड़ी हैं।</small><span>होम स्क्रीन पर जोड़ें: ब्राउज़र मेनू → ऐप इंस्टॉल करें</span></footer>
 </div>;
}

function AuthGate(){
 const [user,setUser]=useState(null),[ready,setReady]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [installPrompt,setInstallPrompt]=useState(null);
 const [isInstalled,setIsInstalled]=useState(()=>window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true);
 const [installHelp,setInstallHelp]=useState(false);
 useEffect(()=>{
  if('serviceWorker' in navigator){
   navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(err=>console.warn('PWA offline registration failed:',err));
  }
  const onPrompt=e=>{e.preventDefault();setInstallPrompt(e);setInstallHelp(false)};
  const onInstalled=()=>{setIsInstalled(true);setInstallPrompt(null);setInstallHelp(false)};
  window.addEventListener('beforeinstallprompt',onPrompt);
  window.addEventListener('appinstalled',onInstalled);
  return()=>{window.removeEventListener('beforeinstallprompt',onPrompt);window.removeEventListener('appinstalled',onInstalled)};
 },[]);
 useEffect(()=>{if(!isFirebaseConfigured){setReady(true);return}return onAuthStateChanged(auth,next=>{setUser(next);setReady(true)},authError=>{setError(getGoogleSignInError(authError));setReady(true)})},[]);
 async function installApp(){
  setInstallHelp(false);
  if(!installPrompt){setInstallHelp(true);return}
  try{
   await installPrompt.prompt();
   const choice=await installPrompt.userChoice;
   if(choice?.outcome!=='accepted')setInstallHelp(true);
  }catch(err){setInstallHelp(true)}
  finally{setInstallPrompt(null)}
 }
 async function login(){setError('');setBusy(true);try{await signInWithPopup(auth,googleProvider)}catch(err){setError(getGoogleSignInError(err))}finally{setBusy(false)}}
 async function loginAsGuest(){setError('');setBusy(true);try{await signInAnonymously(auth)}catch(err){setError(getGuestSignInError(err))}finally{setBusy(false)}}
 if(!isFirebaseConfigured)return <div className="auth-shell"><section className="auth-card"><div className="brand-mark">क</div><h1>कामधेनु</h1><p>Firebase config अभी Render पर निर्धारित नहीं है।</p></section></div>;
 if(!ready)return <div className="auth-shell"><section className="auth-card"><div className="brand-mark">क</div><h1>कामधेनु</h1><p>Google खाते की जाँच हो रही है…</p></section></div>;
 if(user)return <LedgerApp user={user} installPrompt={installPrompt} isInstalled={isInstalled} onInstall={installApp} installHelp={installHelp}/>;
 return <div className="auth-shell"><section className="auth-card"><div className="brand-mark">क</div><h1>कामधेनु</h1><p className="auth-subtitle">दूध एवं दैनिक हिसाब</p>{!isInstalled&&<button className="install-action auth-install" type="button" onClick={installApp}>{installPrompt?'Android ऐप इंस्टॉल करें':'Android पर इंस्टॉल करें'}</button>}{installHelp&&<p className="auth-install-help">Chrome के ⋮ मेनू से “ऐप इंस्टॉल करें” या “होम स्क्रीन पर जोड़ें” चुनें।</p>}<button className="google-auth-button" type="button" disabled={busy} onClick={login}>{busy?'कृपया प्रतीक्षा करें…':'Google से साइन इन करें'}</button><div className="auth-divider">या</div><button className="guest-auth-button" type="button" disabled={busy} onClick={loginAsGuest}>{busy?'कृपया प्रतीक्षा करें…':'अतिथि के रूप में जारी रखें'}</button>{error&&<p className="error" role="alert">{error}</p>}<p className="auth-note">अतिथि मोड में खाता इसी ब्राउज़र से जुड़ा रहेगा। दूसरे डिवाइस पर डेटा पाने और सुरक्षित रखने के लिए ऐप में Google खाते से जोड़ें।</p><p className="auth-footnote">परीक्षण संस्करण · वास्तविक हिसाब Version 2.0 के स्थिर विमोचन के बाद।</p></section></div>;
}
function App(){return <AuthGate/>;}
createRoot(document.getElementById('root')).render(<App/>);
