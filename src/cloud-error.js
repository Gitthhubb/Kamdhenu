export function getCloudLoadingError(error) {
  if (!error) return '';

  const code = typeof error === 'object' ? error.code || '' : '';
  const detail = typeof error === 'object' ? error.message || '' : String(error);

  if (code === 'permission-denied') {
    return 'Firestore ने पहुँच अस्वीकार की। Firebase Console → Firestore Database → Rules में Kamdhenu के सुरक्षा नियम प्रकाशित करें। मूल त्रुटि: ' + detail;
  }
  if (code === 'not-found') {
    return 'Firestore database बनाया नहीं गया है। Firebase Console → Build → Firestore Database में (default) database बनाएँ। मूल त्रुटि: ' + detail;
  }
  if (code === 'unavailable') {
    return 'Firestore अभी उपलब्ध नहीं है। नेटवर्क और Firebase सेवा की स्थिति जाँचें। मूल त्रुटि: ' + detail;
  }

  return code ? `${code}: ${detail}` : detail;
}
