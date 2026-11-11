function AuthGate(){
 const [user,setUser]=useState(null);
 const [ready,setReady]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  if(!isFirebaseConfigured){setReady(true);return}
  return onAuthStateChanged(auth,next=>{setUser(next);setReady(true)});
 },[]);
 async function login(){
  setError('');
  try{await signInWithPopup(auth,googleProvider)}
  catch(err){setError(err?.message||'Google sign-in पूरा नहीं हो सका।')}
 }
 if(!isFirebaseConfigured)return <div className="auth-shell"><section className="auth-card"><div className="brand-mark">क</div><h1>कामधेनु</h1><p>Firebase सेटअप अधूरा है। Render पर Firebase Web Config और Google Client ID जोड़ें।</p></section></div>;
 if(!ready)return <div className="auth-shell"><section className="auth-card"><div className="brand-mark">क</div><h1>कामधेनु</h1><p>Google खाते की जाँच हो रही है…</p></section></div>;
 if(user)return <LedgerApp user={user}/>;
 return <div className="auth-shell"><section className="auth-card">
  <div className="brand-mark">क</div><h1>कामधेनु</h1><p className="auth-subtitle">दूध एवं दैनिक हिसाब</p>
  <button className="google-auth-button" type="button" onClick={login}>
   <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.9c-.58 2.96-2.26 5.48-4.73 7.18l7.66 5.95c4.47-4.13 7.15-10.2 7.15-17.6z"/><path fill="#FBBC05" d="M10.54 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.85l-7.66-5.95c-2.13 1.43-4.86 2.28-8.25 2.28-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
   Google से साइन इन करें
  </button>
  {error&&<p className="error" role="alert">{error}</p>}
  <p className="auth-note">एक Google खाता ही आपका कामधेनु खाता होगा। कोई अलग पासवर्ड बनाने की आवश्यकता नहीं।</p>
  <p className="auth-footnote">परीक्षण संस्करण · वास्तविक हिसाब स्थिर Version 2.0 के बाद।</p>
 </section></div>;
}
function App(){return <AuthGate/>;}
createRoot(document.getElementById('root')).render(<App/>);
