export function getDeviceInfo() {
  const ua = navigator.userAgent
  let device = 'Unknown Device'
  let browser = 'Unknown Browser'

  // Detect device
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Opera Mini/i.test(ua)) {
    if (/iPhone/i.test(ua)) device = 'iPhone'
    else if (/iPad/i.test(ua)) device = 'iPad'
    else if (/Android/i.test(ua)) device = 'Android Mobile'
    else device = 'Mobile Device'
  } else if (/Tablet|iPad/i.test(ua)) {
    device = 'Tablet'
  } else {
    if (/Windows/i.test(ua)) device = 'Windows PC'
    else if (/Macintosh/i.test(ua)) device = 'Mac'
    else if (/Linux/i.test(ua)) device = 'Linux PC'
    else if (/CrOS/i.test(ua)) device = 'Chromebook'
    else device = 'Desktop'
  }

  // Detect browser
  if (/Edg/i.test(ua)) browser = 'Edge'
  else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome'
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari'
  else if (/Firefox/i.test(ua)) browser = 'Firefox'
  else if (/Opera|OPR/i.test(ua)) browser = 'Opera'

  return {
    device,
    browser,
    platform: navigator.platform || 'Unknown',
    userAgent: ua,
  }
}

export function getDeviceDisplayName() {
  const info = getDeviceInfo()
  return `${info.device} (${info.browser})`
}
