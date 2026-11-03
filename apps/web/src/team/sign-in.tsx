// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState } from "react";
import { auth } from "./auth";
import { TeamDialog } from "./dialog";
import { authError, words } from "./notices";

export function SignIn({ gate = false, home = false, close, notice = "" }: { gate?: boolean; home?: boolean; close: () => void; notice?: string }) {
  const [email, setEmail] = useState("");
  const [codeStep, setCodeStep] = useState(false);
  const [digits, setDigits] = useState(Array<string>(6).fill(""));
  const [busy, setBusy] = useState(false), [error, setError] = useState(notice);
  const [sentAt, setSentAt] = useState(0), [now, setNow] = useState(Date.now());
  const fields = useRef<(HTMLInputElement | null)[]>([]);
  const emailField = useRef<HTMLInputElement>(null);
  const wait = Math.max(0, Math.ceil((sentAt + 60000 - now) / 1000));
  useEffect(() => {
    if (!sentAt) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [sentAt]);
  useEffect(() => { if (codeStep) fields.current[0]?.focus(); else emailField.current?.focus(); }, [codeStep]);
  async function requestCode() {
    if (busy || !email.trim()) return;
    setBusy(true); setError("");
    try {
      const { error } = await auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
      if (error) setError(authError(error, false));
      else { setSentAt(Date.now()); setNow(Date.now()); setDigits(Array(6).fill("")); setCodeStep(true); }
    } catch { setError(words.signInFailed); }
    finally { setBusy(false); }
  }
  async function verify() {
    if (busy || !digits.every((digit) => /^\d$/.test(digit))) return;
    setBusy(true); setError("");
    try {
      const { error } = await auth.verifyOtp({ email: email.trim(), token: digits.join(""), type: "email" });
      if (error) setError(authError(error, true)); else close();
    } catch { setError(words.signInFailed); }
    finally { setBusy(false); }
  }
  function fill(index: number, value: string) {
    const numbers = value.replace(/\D/g, "").slice(0, 6 - index);
    setDigits((old) => { const next = [...old]; if (!numbers) next[index] = "";
      else [...numbers].forEach((number, offset) => { next[index + offset] = number; }); return next; });
    if (numbers) fields.current[Math.min(5, index + numbers.length)]?.focus();
  }
  const content = <>
    {!gate && <button className="team-close" aria-label="Close sign in" onClick={close}>×</button>}
    {codeStep && <button aria-label="Change email" onClick={() => { setCodeStep(false); setError(""); }}>‹</button>}
    <h1>{codeStep ? words.codeTitle : words.signInTitle}</h1>
    <p>{codeStep ? words.codeHelper(email.trim()) : words.signInHelper}</p>
    <form onSubmit={(event) => { event.preventDefault(); void (codeStep ? verify() : requestCode()); }}>
      {codeStep ? <div className="team-digits">{digits.map((digit, index) =>
        <input key={index} ref={(node) => { fields.current[index] = node; }} aria-label={`Digit ${index + 1}`}
          onFocus={(event) => event.currentTarget.select()} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} value={digit}
          onChange={(event) => fill(index, event.target.value)}
          onPaste={(event) => { event.preventDefault(); fill(index, event.clipboardData.getData("text")); }}
          onKeyDown={(event) => { if (event.key === "Backspace" && !digit && index) {
            event.preventDefault(); fields.current[index - 1]?.focus();
          } }} />)}</div>
        : <><label htmlFor="team-email">EMAIL</label><input ref={emailField} id="team-email" type="email"
          placeholder="you@example.com" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></>}
      <button className="primary team-submit" disabled={busy || (codeStep ? !digits.every((digit) => /^\d$/.test(digit)) : !email.trim())}>
        {codeStep ? "Sign in" : "Continue with email"}
      </button>
    </form>
    {codeStep ? <p>{wait ? words.resendWait(wait) : <>{words.resendPrompt}<button disabled={busy}
      onClick={() => { void requestCode(); }}>{words.resendCode}</button>.</>}</p> : <p>{words.signInFooter}</p>}
    {error && <p role="alert">{error}</p>}
  </>;
  return gate ? <main className="team-page"><section className="team-card">
    <b className="brand" aria-hidden="true">N</b><h1>{home ? "Sign in to see your boards" : words.gateTitle}</h1>{!home && <p>{words.gateHelper}</p>}{content}
  </section></main> : <TeamDialog title={codeStep ? words.codeTitle : words.signInTitle} className="team-sign-in" close={close}>{content}</TeamDialog>;
}
