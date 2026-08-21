import { Link } from 'react-router-dom'

export function StatusPage({ forbidden = false }: { forbidden?: boolean }) {
  return <main className="status-page"><span className="eyebrow">{forbidden ? 'Access restricted' : 'Not found'}</span>
    <h1>{forbidden ? 'This area needs another role.' : 'This page does not exist.'}</h1>
    <p>{forbidden ? 'Frontend role checks improve navigation only; the backend remains authoritative.' : 'The address may have changed or the page has not been built yet.'}</p>
    <Link className="button button-primary" to="/">Return home</Link></main>
}
