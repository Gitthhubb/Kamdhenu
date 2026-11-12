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
