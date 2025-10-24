// Cloudflare Worker لإنشاء Custom Domain لتطبيق Kueue RSVP
// استخدم هذا الكود في Cloudflare Workers

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // تحديد المسارات المختلفة للتطبيق
  const routes = {
    '/': 'https://[figma-make-domain]/app/[your-project-id]',
    '/admin': 'https://[figma-make-domain]/app/[your-project-id]?view=admin',
    '/vendor': 'https://[figma-make-domain]/app/[your-project-id]?view=vendor', 
    '/reserve': 'https://[figma-make-domain]/app/[your-project-id]?view=public',
    '/api': `https://yeytxxbofwyqjmrjjbhs.supabase.co/functions/v1/make-server-a344fe62`,
  }
  
  // إعادة توجيه API calls
  if (url.pathname.startsWith('/api')) {
    const apiUrl = new URL(request.url)
    apiUrl.hostname = 'yeytxxbofwyqjmrjjbhs.supabase.co'
    apiUrl.pathname = apiUrl.pathname.replace('/api', '/functions/v1/make-server-a344fe62')
    
    const apiRequest = new Request(apiUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body
    })
    
    const response = await fetch(apiRequest)
    const modifiedResponse = new Response(response.body, response)
    
    // إضافة CORS headers
    modifiedResponse.headers.set('Access-Control-Allow-Origin', '*')
    modifiedResponse.headers.set('Access-Control-Allow-Methods', 'GET,HEAD,POST,OPTIONS,PUT,DELETE')
    modifiedResponse.headers.set('Access-Control-Allow-Headers', '*')
    
    return modifiedResponse
  }
  
  // إعادة توجيه التطبيق الرئيسي
  const targetUrl = routes[url.pathname] || routes['/']
  
  const modifiedRequest = new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body
  })
  
  const response = await fetch(modifiedRequest)
  
  // تعديل الاستجابة لتغيير المراجع الداخلية
  let body = await response.text()
  
  // استبدال URLs في الكود
  body = body.replace(
    /https:\/\/yeytxxbofwyqjmrjjbhs\.supabase\.co/g,
    `https://${url.hostname}/api`
  )
  
  const modifiedResponse = new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  })
  
  return modifiedResponse
}

// خطوات الإعداد:
// 1. إنشاء Cloudflare Worker جديد
// 2. لصق هذا الكود وتعديل URLs
// 3. ربط Worker بـ Custom Domain في Cloudflare
// 4. إعداد DNS Records: kueue-rsvp.com → worker-subdomain.workers.dev