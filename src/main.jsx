import React,{useEffect,useState}from'react';
import{createRoot}from'react-dom/client';
import'./style.css';
import{getCloudLoadingError}from'./cloud-error';
import{getGuestSignInError,getGuestLinkError}from'./guest-auth-errors';
import{validateBackupPayload}from'./backup-validation';
import{getMilkSaveFeedback}from'./milk-save-feedback';
import{isFirebaseConfigured,auth,googleProvider,db}from'./firebase';
import{onAuthStateChanged,signInWithPopup,signInAnonymously,linkWithPopup,signOut}from'firebase/auth';
import{normalizeMilkRecord,normalizeTransactionRecord,planRestoreMerge}from'./restore-merge';
import{collection,doc,setDoc,addDoc,deleteDoc,getDocs,query,orderBy,onSnapshot,serverTimestamp}from'firebase/firestore';

const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const money=n=>'₹'+new Intl.NumberFormat('hi-IN',{maximumFractionDigits:2}).format(Number(n)||0);
const number=n=>new Intl.NumberFormat('hi-IN',{maximumFractionDigits:2}).format(Number(n)||0);
const milkLabel=k=>k==='cow'?'गाय':'भैंस';
const shiftLabel=k=>k==='evening'?'शाम':k==='morning'?'सुबह':'समय दर्ज नहीं';
const DEFAULT_STATE={rows:[],transactions:[],rates:{cow_rate:0,buffalo_rate:0},buyers:[],settings:{personalMode:false,milkman:'',buffaloRate:''}};
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
const sortNewest=(a,b)=>{
 const ad=a.sale_date||a.date||'',bd=b.sale_date||b.date||'';
 return bd.localeCompare(ad)||String(b.created_at||'').localeCompare(String(a.created_at||''));
};
function RadioChoices({value,onChange,options,name}){
 return <div className="radio-group" role="radiogroup">{options.map(o=><label className={'radio-choice '+(value===o.value?'chosen':'')} key={o.value}><input type="radio" name={name} value={o.value} checked={value===o.value} onChange={()=>onChange(o.value)}/><span>{o.label}</span></label>)}</div>;
}
function LedgerApp({user}){
 const initial=DEFAULT_STATE;
 const [store,setStore]=useState(initial);
 const [tab,setTab]=useState('Milk');
 const [month,setMonth]=useState(today().slice(0,7));
 const [periodPage,setPeriodPage]=useState(Math.min(3,Math.ceil(Number(today().slice(8,10))/10)));
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [form,setForm]=useState(()=>initial.settings.personalMode?{...blankForm(initial.rates),milk_type:'buffalo',buyer:initial.settings.milkman||'',rate:String(initial.settings.buffaloRate??'')}:blankForm(initial.rates));
 const [txForm,setTxForm]=useState(blankTransaction());
 const [personalMode,setPersonalMode]=useState(Boolean(initial.settings.personalMode));
 const [cloudReady,setCloudReady]=useState(false);
 const [driveBusy,setDriveBusy]=useState(false);
 const [personalSetupOpen,setPersonalSetupOpen]=useState(false);
 const [personalSetup,setPersonalSetup]=useState(()=>({milkman:initial.settings.milkman||'',buffaloRate:String(initial.settings.buffaloRate??initial.rates.buffalo_rate??'')}));
 const [installPrompt,setInstallPrompt]=useState(null);
 const [isInstalled,setIsInstalled]=useState(()=>window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true);

 useEffect(()=>{
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(err=>console.warn('PWA offline registration failed:',err));
  const onPrompt=e=>{e.preventDefault();setInstallPrompt(e)};
  const onInstalled=()=>{setIsInstalled(true);setInstallPrompt(null);setNotice('कामधेनु ऐप इंस्टॉल हो गया।');setError('')};
  window.addEventListener('beforeinstallprompt',onPrompt);
  window.addEventListener('appinstalled',onInstalled);
  return()=>{window.removeEventListener('beforeinstallprompt',onPrompt);window.removeEventListener('appinstalled',onInstalled)};
 },[]);
 useEffect(()=>{
  if(!user?.uid)return;
  let rootLoaded=false,milkLoaded=false,txLoaded=false,profile={},milkRows=[],txRows=[];
  const apply=()=>{
   if(!rootLoaded||!milkLoaded||!txLoaded)return;
   const next={...DEFAULT_STATE,...profile,rows:milkRows,transactions:txRows,rates:{...DEFAULT_STATE.rates,...(profile.rates||{})},settings:{...DEFAULT_STATE.settings,...(profile.settings||{})},buyers:Array.isArray(profile.buyers)?profile.buyers:[]};
   setStore(next);setPersonalMode(Boolean(next.settings.personalMode));
   setPersonalSetup({milkman:next.settings.milkman||'',buffaloRate:String(next.settings.buffaloRate??'')});
   setForm(next.settings.personalMode?{...blankForm(next.rates),milk_type:'buffalo',buyer:next.settings.milkman||'',rate:String(next.settings.buffaloRate??'')}:blankForm(next.rates));
   setCloudReady(true);
  };
  const a=onSnapshot(doc(db,'users',user.uid),snap=>{profile=snap.exists()?snap.data():{};rootLoaded=true;apply()},report);
  const b=onSnapshot(query(collection(db,'users',user.uid,'milk'),orderBy('date','desc')),snap=>{milkRows=snap.docs.map(d=>({id:d.id,...d.data(),sale_date:d.data().date,buyer:d.data().milkman,milk_type:d.data().milkType,created_at:d.data().createdAt?.toDate?.()?.toISOString?.()||''}));milkLoaded=true;apply()},report);
  const d=onSnapshot(query(collection(db,'users',user.uid,'transactions'),orderBy('date','desc')),snap=>{txRows=snap.docs.map(d=>({id:d.id,...d.data(),created_at:d.data().createdAt?.toDate?.()?.toISOString?.()||''}));txLoaded=true;apply()},report);
  return()=>{a();b();d()};
 },[user?.uid]);

 async function savePersonalSettings(e){
  e.preventDefault();
  const milkman=personalSetup.milkman.trim();
  const rateText=String(personalSetup.buffaloRate).trim();
  const rate=Number(rateText);
  if(!milkman||!rateText||!Number.isFinite(rate)||rate<=0)return report('माँ के मोड के लिए दूधवाले का नाम और शून्य से अधिक निश्चित दर दर्ज करें।');
  const settings={...store.settings,milkman,buffaloRate:rateText,personalMode};
  const next={...store,settings,rates:{...store.rates,buffalo_rate:rate},buyers:[...new Set([...(store.buyers||[]),milkman])]};
  if(await persist(next)){
   if(personalMode)setForm(current=>({...current,milk_type:'buffalo',buyer:milkman,rate:rateText}));
   setPersonalSetup({milkman,buffaloRate:rateText});
   setPersonalSetupOpen(false);
   success(personalMode?'माँ के मोड की नई सेटिंग लागू हो गई।':'माँ के मोड की सेटिंग सुरक्षित हो गई।');
  }
 }
 async function togglePersonalMode(){
  if(personalMode){
   const settings={...store.settings,personalMode:false};
   if(await persist({...store,settings})){
    setPersonalMode(false);
    setForm(current=>({...current,milk_type:'cow',rate:String(store.rates.cow_rate??0)}));
    success('माँ का मोड बंद हो गया।');
   }
   return;
  }
  const milkman=personalSetup.milkman.trim();
  const rateText=String(personalSetup.buffaloRate).trim();
  const rate=Number(rateText);
  if(!milkman||!rateText||!Number.isFinite(rate)||rate<=0){
   setPersonalSetupOpen(true);
   report('पहले माँ के मोड में दूधवाले का नाम और निश्चित भैंस-दर दर्ज करें।');
   return;
  }
  const settings={...store.settings,personalMode:true,milkman,buffaloRate:rateText};
  const next={...store,settings,rates:{...store.rates,buffalo_rate:rate},buyers:[...new Set([...(store.buyers||[]),milkman])]};
  if(await persist(next)){
   setPersonalMode(true);
   setForm(current=>({...current,milk_type:'buffalo',buyer:milkman,rate:rateText}));
   setPersonalSetupOpen(false);
   success('माँ का मोड चालू है। नई दूध प्रविष्टियाँ निर्धारित दूधवाले, भैंस और निश्चित दर से बनेंगी।');
  }
 }
 function report(err){setError(getCloudLoadingError(err)||'यह कार्य पूरा नहीं हो सका।');setNotice('')}
 function success(msg){setNotice(msg);setError('')}
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
 async function persist(next){
  try{await setDoc(doc(db,'users',user.uid),{rates:next.rates,buyers:next.buyers,settings:next.settings,updatedAt:serverTimestamp()},{merge:true});setStore(next);return true}
  catch(err){report(err);return false}
 }
 async function deleteMilk(id){
  if(!window.confirm('क्या इस दूध प्रविष्टि को स्थायी रूप से हटाना है?'))return;
  try{await deleteDoc(doc(db,'users',user.uid,'milk',id));success('दूध प्रविष्टि हटा दी गई।')}catch(err){report(err)}
 }
 async function deleteTransaction(id){
  if(!window.confirm('क्या इस लेन-देन को स्थायी रूप से हटाना है?'))return;
  try{await deleteDoc(doc(db,'users',user.uid,'transactions',id));success('लेन-देन हटा दिया गया।')}catch(err){report(err)}
 }
 async function installApp(){
  if(!installPrompt){success('ब्राउज़र मेनू से “ऐप इंस्टॉल करें” या “होम स्क्रीन पर जोड़ें” चुनें।');return}
  try{
   await installPrompt.prompt();
   const choice=await installPrompt.userChoice;
   if(choice?.outcome==='accepted')success('कामधेनु इंस्टॉल किया जा रहा है।');
  }catch(err){report('ऐप इंस्टॉल करने का अनुरोध पूरा नहीं हुआ।')}
  finally{setInstallPrompt(null)}
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
 function exportBackup(){
  const blob=new Blob([JSON.stringify({schema:4,exportedAt:new Date().toISOString(),...store},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='kamdhenu-backup-'+today()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);success('बैकअप डाउनलोड हो गया।');
 }
 async function restoreBackupData(d){
  const backup=validateBackupPayload(d);
  if(!window.confirm('क्या बैकअप की केवल नई प्रविष्टियाँ जोड़नी हैं? मौजूदा प्रविष्टियाँ बदली या हटाई नहीं जाएँगी।'))return;
  const milkCollection=collection(db,'users',user.uid,'milk');
  const transactionCollection=collection(db,'users',user.uid,'transactions');
  const [milkSnapshot,transactionSnapshot]=await Promise.all([getDocs(milkCollection),getDocs(transactionCollection)]);
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
  const profileSaved=await persist({
   ...store,
   rates:{...store.rates,...backup.rates},
   buyers:[...new Set([...store.buyers,...backup.buyers])],
   settings:{...store.settings,...backup.settings},
  });
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
  const payload={schema:4,exportedAt:new Date().toISOString(),...store};
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
  const quantity=Number(form.quantity),rate=Number(personalMode?store.settings.buffaloRate:form.rate),milkman=(personalMode?store.settings.milkman:form.buyer).trim(),milkType=personalMode?'buffalo':form.milk_type;
  if(form.sale_date<periodStart||form.sale_date>periodEnd)return report('दिनांक चुने हुए पृष्ठ की अवधि में होनी चाहिए।');
  if(!form.sale_date||!milkman||!String(form.quantity).trim()||!String(form.rate).trim()||!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(rate)||rate<0)return report('दिनांक, दूधवाले का नाम, शून्य से अधिक मात्रा और वैध दर दर्ज करें।');
  try{
   await addDoc(collection(db,'users',user.uid,'milk'),{date:form.sale_date,shift:form.shift||'morning',milkman,milkType,quantity,rate,amount:Math.round(quantity*rate*100)/100,remarks:form.remarks.trim(),createdAt:serverTimestamp()});
   const profileSaved=await persist({...store,buyers:[...new Set([...store.buyers,milkman])],rates:{...store.rates,[milkType+'_rate']:rate}});
   setForm(personalMode?{...blankForm(store.rates),milk_type:'buffalo',buyer:store.settings.milkman,rate:String(store.settings.buffaloRate)}:blankForm(store.rates));
   const feedback=getMilkSaveFeedback(profileSaved);
   if(profileSaved)success(feedback.message);else report(feedback.message);
  }catch(err){report(err)}
 }
 async function saveTransaction(e){
  e.preventDefault();
  const amount=Number(txForm.amount);
  if(txForm.date<periodStart||txForm.date>periodEnd)return report('दिनांक चुने हुए पृष्ठ की अवधि में होनी चाहिए।');
  if(!txForm.date||!String(txForm.amount).trim()||!Number.isFinite(amount)||amount<=0)return report('वैध दिनांक और शून्य से अधिक राशि दर्ज करें।');
  if(txForm.kind==='expense'&&!txForm.category)return report('खर्च का मद चुनें।');
  try{
   await addDoc(collection(db,'users',user.uid,'transactions'),{date:txForm.date,kind:txForm.kind,amount,party:txForm.party.trim(),category:txForm.kind==='expense'?txForm.category:'',remarks:txForm.remarks.trim(),createdAt:serverTimestamp()});
   setTxForm(blankTransaction());success('नया लेन-देन सुरक्षित हो गया।');
  }catch(err){report(err)}
 }
 function exportCsv(){
  const data=store.rows.filter(x=>x.sale_date.startsWith(month)).sort(sortNewest);
  const lines=[['दिनांक','दूधवाला','समय','दूध का प्रकार','मात्रा (लीटर)','दर','राशि','टिप्पणी'],...data.map(x=>[x.sale_date,x.buyer,shiftLabel(x.shift),milkLabel(x.milk_type),x.quantity,x.rate,x.amount,x.remarks||''])];
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

 if(!cloudReady)return <div className="auth-shell"><section className="auth-card"><div className="brand-mark">क</div><h1>कामधेनु</h1><p>Firestore से आपका बही-खाता लोड हो रहा है…</p>{error&&<><p className="error" role="alert">{error}</p><button type="button" onClick={()=>window.location.reload()}>फिर प्रयास करें</button></>}</section></div>;
 return <div className="app">
  <header>
   <div className="brand-mark">क</div>
   <div className="brand-copy"><b>कामधेनु</b><small>दूध एवं दैनिक हिसाब</small></div>
   {!isInstalled&&<button className="install-action" onClick={installApp}>{installPrompt?'ऐप इंस्टॉल करें':'होम स्क्रीन'}</button>}
   {isInstalled&&<span className="installed-label">ऐप मोड</span>}
   <label className="backup-label">बैकअप पुनर्स्थापित करें<input type="file" accept="application/json,.json" onChange={importBackup}/></label>
   <button className="header-action" onClick={exportBackup}>बैकअप लें</button>
  </header>
  <div className="account-bar"><span title={user?.email||'अतिथि खाता'}>{user?.isAnonymous?'अतिथि सत्र · इसी ब्राउज़र पर':user?.email}</span>{user?.isAnonymous?<><button type="button" onClick={linkGuestAccount}>Google खाते से जोड़ें</button><button type="button" onClick={leaveGuestSession}>सत्र छोड़ें</button></>:<button type="button" onClick={()=>signOut(auth)}>साइन आउट</button>}</div>
  <div className="drive-actions">
   <button type="button" className="secondary" onClick={()=>requestDriveAccess(backupToDrive)} disabled={driveBusy}>{driveBusy?'प्रक्रिया जारी है…':'Drive में बैकअप'}</button>
   <button type="button" className="secondary" onClick={()=>requestDriveAccess(restoreFromDrive)} disabled={driveBusy}>Drive से पुनर्स्थापित करें</button>
  </div>
  <div className="storage-notice">परीक्षण संस्करण · प्रविष्टियाँ आपके Firebase खाते (Google या अतिथि) के साथ Firestore में सिंक होती हैं। अतिथि डेटा को दूसरे डिवाइस पर सुरक्षित रखने के लिए Google खाते से जोड़ें। वास्तविक हिसाब Version 2.0 के स्थिर विमोचन के बाद दर्ज करें।</div>
  <section className="mode-strip">
   <div><b>माँ का व्यक्तिगत मोड</b><small>केवल भैंस · निश्चित दर · तय दूधवाला</small></div>
   <button type="button" className={personalMode?'mode-on':'mode-off'} aria-pressed={personalMode} onClick={togglePersonalMode}>{personalMode?'चालू':'बंद'}</button>
   <button type="button" className="mode-settings" onClick={()=>setPersonalSetupOpen(v=>!v)}>सेटिंग</button>
  </section>
  {personalSetupOpen&&<form className="personal-setup" onSubmit={savePersonalSettings}>
   <b>माँ के मोड का सेटअप</b>
   <label>दूधवाला का नाम<input className="text-input full-text" value={personalSetup.milkman} onChange={e=>setPersonalSetup({...personalSetup,milkman:e.target.value})} placeholder="निश्चित दूधवाले का नाम" required/></label>
   <label>भैंस के दूध की निश्चित दर (₹/लीटर)<input className="number-input" type="number" min=".01" step=".01" inputMode="decimal" value={personalSetup.buffaloRate} onChange={e=>setPersonalSetup({...personalSetup,buffaloRate:e.target.value})} placeholder="उदाहरण: 70" required/></label>
   <small>यह दर और दूधवाले का नाम माँ के मोड में नई प्रविष्टियों पर स्वतः लागू होंगे। पुरानी प्रविष्टियाँ अपरिवर्तित रहेंगी।</small>
   <button type="submit">सेटिंग सुरक्षित करें</button>
  </form>}
  <section className="hero">
   <div className="hero-top"><span>मासिक सारांश</span><label className="hero-month"><input aria-label="माह चुनें" type="month" value={month} onChange={e=>changeMonth(e.target.value)}/></label></div>
   <div className="hero-metrics">
    <div className="hero-milk"><small>दूध आज तक</small><strong>{number(milkToDate)}<i>लीटर</i></strong><span>गाय {number(qty(monthMilk.filter(x=>x.milk_type==='cow')))} L · भैंस {number(qty(monthMilk.filter(x=>x.milk_type==='buffalo')))} L</span></div>
    <div className="hero-net"><small>शुद्ध राशि</small><strong>{money(netAmount)}</strong><span>बिक्री + प्राप्ति − अग्रिम − खर्च</span></div>
   </div>
   <div className="hero-foot"><span>आज का दूध</span><b>{number(milkToday)} लीटर</b><span>आज की बिक्री</span><b>{money(total(todayMilk))}</b></div>
  </section>
  <nav aria-label="मुख्य मेनू">
   <button className={tab==='Milk'?'active':''} onClick={()=>{setTab('Milk');setError('');setNotice('')}}>दूध</button>
   <button className={tab==='Transactions'?'active':''} onClick={()=>{setTab('Transactions');setError('');setNotice('')}}>लेन-देन</button>
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
     <label>दूधवाला (Milkman)<input className="text-input full-text" value={personalMode?store.settings.milkman:form.buyer} onChange={e=>setForm({...form,buyer:e.target.value})} placeholder="नाम लिखें" readOnly={personalMode} required/></label>
     <div className="field-pair">
      <label>दिनांक<input className="date-input" type="date" value={form.sale_date} onChange={e=>setForm({...form,sale_date:e.target.value})} required/></label>
      <label>समय<RadioChoices name="milk-shift" value={form.shift} onChange={v=>setForm({...form,shift:v})} options={[{value:'morning',label:'सुबह'},{value:'evening',label:'शाम'}]}/></label>
     </div>
     <div className="field-triple">
      <label>मात्रा (लीटर)<input className="number-input" type="number" min=".01" step=".01" inputMode="decimal" placeholder="0" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} required/></label>
      <label>दर (₹)<input className="number-input" type="number" min="0" step=".01" inputMode="decimal" placeholder="0" value={personalMode?store.settings.buffaloRate:form.rate} onChange={e=>setForm({...form,rate:e.target.value})} readOnly={personalMode} required/></label>
      <label>प्रकार{personalMode?<span className="fixed-value">भैंस · निश्चित</span>:<RadioChoices name="milk-type" value={form.milk_type} onChange={v=>setForm({...form,milk_type:v,rate:String(store.rates[v+'_rate']??0)})} options={[{value:'cow',label:'गाय'},{value:'buffalo',label:'भैंस'}]}/>}</label>
     </div>
     <label>टिप्पणी<textarea className="comment-input" rows="2" value={form.remarks} onChange={e=>setForm({...form,remarks:e.target.value})} placeholder="वैकल्पिक टिप्पणी"/></label>
     <b className="amount-preview">कुल राशि: {money(Number(form.quantity)*Number(form.rate))}</b>
     <p className="append-note">प्रविष्टि सुरक्षित होने के बाद बदली नहीं जा सकती; आवश्यकता हो तो हटाई जा सकती है।</p>
     <div className="form-actions"><button>नई दूध प्रविष्टि सुरक्षित करें</button></div>
    </form>
    <div className="list-heading"><h2>इस अवधि की दूध प्रविष्टियाँ</h2><button className="secondary small-action" onClick={exportCsv}>मासिक CSV</button></div>
    <div className="record-list">{periodMilk.map(row=><article className="record" key={row.id}>
     <div><b>{row.buyer}</b><small>{row.sale_date} · {shiftLabel(row.shift)} · {milkLabel(row.milk_type)} · {number(row.quantity)} लीटर × {money(row.rate)}</small>{row.remarks&&<small>{row.remarks}</small>}</div>
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
     <label>लेन-देन का प्रकार<RadioChoices name="transaction-kind" value={txForm.kind} onChange={v=>setTxForm({...txForm,kind:v})} options={[{value:'received',label:'प्राप्त'},{value:'remained',label:'बाकी'},{value:'advance',label:'अग्रिम'},{value:'expense',label:'खर्च'}]}/></label>
     <label>राशि (₹)<input className="number-input" type="number" min=".01" step=".01" inputMode="decimal" placeholder="0" value={txForm.amount} onChange={e=>setTxForm({...txForm,amount:e.target.value})} required/></label>
     <label>किससे / किसे (To Whom)<input className="text-input full-text" value={txForm.party} onChange={e=>setTxForm({...txForm,party:e.target.value})} placeholder="व्यक्ति या पार्टी का नाम"/></label>
     {txForm.kind==='expense'&&<label>खर्च का मद<RadioChoices name="expense-category" value={txForm.category} onChange={v=>setTxForm({...txForm,category:v})} options={expenseCategories}/></label>}
     <label>टिप्पणी<textarea className="comment-input" rows="2" value={txForm.remarks} onChange={e=>setTxForm({...txForm,remarks:e.target.value})} placeholder="वैकल्पिक टिप्पणी"/></label>
     <p className="append-note">हर लेन-देन नई प्रविष्टि है। इसे बदला नहीं जा सकता; आवश्यकता होने पर हटाया जा सकता है।</p>
     <div className="form-actions"><button>नया लेन-देन सुरक्षित करें</button></div>
    </form>
    <h2 className="section-title">इस अवधि के लेन-देन</h2>
    <div className="record-list">{periodTransactions.map(t=>{
     const kindLabel=t.kind==='received'?'प्राप्त':t.kind==='remained'?'बाकी':t.kind==='advance'?'अग्रिम':'खर्च';
     const cat=expenseCategories.find(c=>c.value===t.category)?.label||'अन्य';
     return <article className="record" key={t.id}>
      <div><b>{kindLabel}{t.kind==='expense'?' · '+cat:''}</b><small>{t.date}{t.party?' · '+t.party:''}{t.remarks?' · '+t.remarks:''}</small></div>
      <strong>{money(t.amount)}</strong><div className="record-actions"><button type="button" className="delete-record" onClick={()=>deleteTransaction(t.id)}>हटाएँ</button></div>
     </article>
    })}{!periodTransactions.length&&<p className="empty">इस अवधि में कोई लेन-देन दर्ज नहीं है।</p>}</div>
   </>}
  </main>
  <footer className="dedication"><b>माँ को समर्पित</b><i>I dedicate this space to my mother.</i><small>~ i/arpit</small><span>होम स्क्रीन पर जोड़ें: ब्राउज़र मेनू → ऐप इंस्टॉल करें</span></footer>
 </div>;
}

function AuthGate(){
 const [user,setUser]=useState(null),[ready,setReady]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(!isFirebaseConfigured){setReady(true);return}return onAuthStateChanged(auth,next=>{setUser(next);setReady(true)})},[]);
 async function login(){setError('');setBusy(true);try{await signInWithPopup(auth,googleProvider)}catch(err){setError(err?.message||'Google sign-in पूरा नहीं हो सका।')}finally{setBusy(false)}}
 async function loginAsGuest(){setError('');setBusy(true);try{await signInAnonymously(auth)}catch(err){setError(getGuestSignInError(err))}finally{setBusy(false)}}
 if(!isFirebaseConfigured)return <div className="auth-shell"><section className="auth-card"><div className="brand-mark">क</div><h1>कामधेनु</h1><p>Firebase config अभी Render पर निर्धारित नहीं है।</p></section></div>;
 if(!ready)return <div className="auth-shell"><section className="auth-card"><div className="brand-mark">क</div><h1>कामधेनु</h1><p>Google खाते की जाँच हो रही है…</p></section></div>;
 if(user)return <LedgerApp user={user}/>;
 return <div className="auth-shell"><section className="auth-card"><div className="brand-mark">क</div><h1>कामधेनु</h1><p className="auth-subtitle">दूध एवं दैनिक हिसाब</p><button className="google-auth-button" type="button" disabled={busy} onClick={login}>{busy?'कृपया प्रतीक्षा करें…':'Google से साइन इन करें'}</button><div className="auth-divider">या</div><button className="guest-auth-button" type="button" disabled={busy} onClick={loginAsGuest}>{busy?'कृपया प्रतीक्षा करें…':'अतिथि के रूप में जारी रखें'}</button>{error&&<p className="error" role="alert">{error}</p>}<p className="auth-note">अतिथि मोड में खाता इसी ब्राउज़र से जुड़ा रहेगा। दूसरे डिवाइस पर डेटा पाने और सुरक्षित रखने के लिए ऐप में Google खाते से जोड़ें।</p><p className="auth-footnote">परीक्षण संस्करण · वास्तविक हिसाब Version 2.0 के स्थिर विमोचन के बाद।</p></section></div>;
}
function App(){return <AuthGate/>;}
createRoot(document.getElementById('root')).render(<App/>);
