export function createMailer({ key=process.env.RESEND_API_KEY, from=process.env.MAIL_FROM, origin=process.env.PUBLIC_ORIGIN, fetcher=fetch }={}) {
  let base;
  try {
    const url=new URL(origin);
    if ((url.protocol==='https:' || (url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname))) && !url.username && !url.password && url.pathname==='/' && !url.search && !url.hash) base=url.origin;
  } catch { /* Missing config disables outbound mail. */ }
  return {
    configured:!!(key && from && base && !/[\r\n]/.test(from)),
    async send({to,purpose,token,id}) {
      if(!this.configured)throw new Error('Mail is not configured');
      const reset=purpose==='reset';
      // Fragment stays out of proxy access logs and HTTP referrers.
      const url=`${base}/account/${reset?'reset-password':'verify-email'}#token=${token}`;
      const subject=reset?'Swipe şifreni yenile':'Swipe e-posta adresini doğrula';
      const text=`${subject}\n\n${url}\n\nBu bağlantı ${reset?'30 dakika':'24 saat'} geçerlidir ve bir kez kullanılabilir. Bu isteği sen yapmadıysan e-postayı dikkate alma.`;
      const response=await fetcher('https://api.resend.com/emails',{
        method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':id},
        body:JSON.stringify({from,to:[to],subject,text}),signal:AbortSignal.timeout(10000),
      });
      // Provider responses can contain recipient data; never expose/log their body.
      if(!response.ok)throw new Error('Mail delivery failed');
    },
  };
}
