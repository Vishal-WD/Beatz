/** 404 — reachable inside the APK via a stale deep link. */
export default function NotFound() {
  return (
    <div style={{ minHeight:'100dvh', background:'var(--stage-black)', color:'var(--ink)',
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  padding:28, textAlign:'center', gap:14 }}>
      <div style={{ font:"400 10px/1 var(--font-tele)", letterSpacing:'.24em', color:'var(--neon-cyan)' }}>
        NOTHING QUEUED HERE
      </div>
      <h1 style={{ font:"400 clamp(52px,16vw,96px)/.9 var(--font-title)",
                   textTransform:'uppercase', margin:0 }}>404</h1>
      <p style={{ font:"400 14px/1.6 var(--font-body)",
                  color:'var(--ink-60)', maxWidth:340, margin:0 }}>
        That room does not exist, or the reign already ended.
      </p>
      <a href="/" style={{ marginTop:8, padding:'14px 22px', borderRadius:10, background:'var(--neon-cyan)',
                           color:'var(--ink-on-neon)', textDecoration:'none',
                           font:"700 10px/1 var(--font-tele)", letterSpacing:'.16em' }}>
        BACK TO START
      </a>
    </div>
  );
}
