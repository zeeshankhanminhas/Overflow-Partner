'use client';
import {useFormStatus} from 'react-dom';
export default function LoginSubmit(){const {pending}=useFormStatus();return <button type="submit" disabled={pending} className="op-cta w-full rounded-sm disabled:cursor-wait disabled:opacity-60" aria-disabled={pending}>{pending?'Signing in…':'Enter workspace →'}</button>}
