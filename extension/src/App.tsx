import { useState } from 'react'

function App() {
  const [step, setStep] = useState<'welcome' | 'auth' | 'setup' | 'ready'>('welcome')

  return (
    <main className="popup-shell">
      <p className="brand-kicker">OryxSolver</p>
      <h1 className="popup-title">First-run setup</h1>

      <div className="card">
        {step === 'welcome' && (
          <section className="stack-sm">
            <p className="text-body">Welcome to your first-run setup.</p>
            <button onClick={() => setStep('auth')} className="btn-primary">
              Get started
            </button>
          </section>
        )}

        {step === 'auth' && (
          <section className="stack-md">
            <div>
              <h2 className="section-title">Sign in to continue</h2>
              <p className="text-body">Sign in to sync your usage, subscription, and saved history.</p>
            </div>

            <div className="note-box">
              Clerk integration comes next. For now, this is the styled placeholder state.
            </div>

            <button className="btn-secondary">Continue with Clerk</button>

            <button onClick={() => setStep('setup')} className="btn-primary">
              I signed in
            </button>

            <button onClick={() => setStep('welcome')} className="btn-secondary">
              Back
            </button>
          </section>
        )}

        {step === 'setup' && (
          <section className="stack-sm">
            <p className="text-body">Setup screen coming next.</p>
            <button onClick={() => setStep('auth')} className="btn-secondary">
              Back
            </button>
          </section>
        )}
      </div>

      <p className="text-caption">Step: {step}</p>
    </main>
  )
}

export default App
