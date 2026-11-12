export function getMilkSaveFeedback(profileSaved) {
  if (profileSaved) {
    return {
      kind: 'success',
      message: 'नई दूध प्रविष्टि सुरक्षित हो गई।',
    };
  }

  return {
    kind: 'warning',
    message: 'दूध प्रविष्टि सुरक्षित हो गई, लेकिन दूधवाले और दर की सेटिंग्स सुरक्षित नहीं हो सकीं। अगली प्रविष्टि से पहले दर जाँचें।',
  };
}
