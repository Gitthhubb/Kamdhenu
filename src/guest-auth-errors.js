function messageOf(error) {
  if (error && typeof error === 'object') return error.message || error.code || 'Unknown error';
  return String(error || 'Unknown error');
}

export function getGuestSignInError(error) {
  const code = error?.code || '';

  if (code === 'auth/operation-not-allowed') {
    return 'अतिथि लॉगिन अभी सक्षम नहीं है। Firebase Console → Authentication → Sign-in method → Anonymous को Enable करें।';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'यह वेबसाइट Firebase में अधिकृत नहीं है। Authentication → Settings → Authorized domains में mymilk.onrender.com जोड़ें।';
  }

  return messageOf(error);
}

export function getGuestLinkError(error) {
  const code = error?.code || '';

  if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
    return 'यह Google खाता पहले से किसी दूसरे Kamdhenu खाते से जुड़ा है। अतिथि खाते के रिकॉर्ड स्वतः उस खाते में नहीं मिलेंगे। पहले अतिथि खाते से JSON बैकअप लें; फिर Google खाते में लॉगिन करके बैकअप पुनर्स्थापित करें।';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google से जोड़ने के लिए Firebase Console → Authentication → Sign-in method में Google provider को Enable करें।';
  }
  if (code === 'auth/provider-already-linked') {
    return 'इस अतिथि खाते से Google पहले ही जुड़ा हुआ है।';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'यह वेबसाइट Firebase में अधिकृत नहीं है। Authentication → Settings → Authorized domains में mymilk.onrender.com जोड़ें।';
  }

  return messageOf(error);
}

export function getGoogleSignInError(error) {
  const code = error?.code || '';

  if (code === 'auth/unauthorized-domain') {
    return 'यह वेबसाइट Firebase में अधिकृत नहीं है। Authentication → Settings → Authorized domains में mymilk.onrender.com जोड़ें।';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Firebase Console → Authentication → Sign-in method में Google provider को Enable करें।';
  }
  if (code === 'auth/popup-blocked') {
    return 'ब्राउज़र ने Google sign-in popup रोक दिया। इस वेबसाइट के लिए popups की अनुमति दें और फिर प्रयास करें।';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Google sign-in popup बंद हो गया। साइन-इन पूरा करने के लिए पुनः प्रयास करें।';
  }
  if (code === 'auth/network-request-failed') {
    return 'Google sign-in के दौरान नेटवर्क अनुरोध विफल हुआ। इंटरनेट कनेक्शन जाँचकर पुनः प्रयास करें।';
  }

  const details = [
    error?.message,
    error?.customData?.originalError?.message,
  ].filter(value => typeof value === 'string').join(' ');
  if (/Database is closing\/hidden/i.test(details)) {
    return 'इस ब्राउज़र में Firebase का पुराना authentication code चल रहा है। पृष्ठ को पूरी तरह refresh करें; यदि समस्या बनी रहे तो साइट का cached data हटाकर दोबारा खोलें।';
  }

  return messageOf(error);
}
