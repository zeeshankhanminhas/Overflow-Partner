'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Application error', error); }, [error]);
  return <html lang="en"><body>
    <main role="alert" aria-live="assertive" style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24,background:'#0b0f0d',color:'#f4f5f3',fontFamily:'Arial,Helvetica,sans-serif'}}>
      <section style={{width:'min(680px,100%)'}}>
        <p>Overflow Partner</p>
        <h1>Something went wrong.</h1>
        <p>The current view could not be completed. Retry before assuming any change was saved.</p>
        {error.digest ? <p>Reference: {error.digest}</p> : null}
        <button type="button" onClick={() => reset()}>Retry</button>
      </section>
    </main>
  </body></html>;
}
