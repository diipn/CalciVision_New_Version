import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUnsavedStore } from "../store/useUnsavedStore";

export default function Navbar() {
  return (
    <nav className="no-scrollbar w-80 h-[var(--content-height)] p-5 bg-green-light border-r-gray-medium border-r-[1px] overflow-auto">
      <ul className="flex flex-col" role='navigation'>
        <ul className="flex flex-col gap-2">
          <NavItem name="Home" url="/">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 19v-8.5a1 1 0 0 0-.4-.8l-7-5.25a1 1 0 0 0-1.2 0l-7 5.25a1 1 0 0 0-.4.8V19a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1" /></svg>
          </NavItem>

          <NavItem name="Patients" url="/patients">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none"><circle cx="10" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" /><path fill="currentColor" d="m18.043 12.366l.444-.605zM19 8.69l-.519.542a.75.75 0 0 0 1.038 0zm.957 3.675l-.444-.605zm-.957.462v.75zm-.514-1.067c-.417-.307-.878-.69-1.227-1.093c-.368-.426-.509-.757-.509-.971h-1.5c0 .77.441 1.45.875 1.952c.453.525 1.014.984 1.474 1.321zM16.75 9.697c0-.576.263-.827.492-.907c.25-.088.714-.06 1.24.443l1.037-1.083c-.825-.79-1.861-1.096-2.773-.776c-.933.327-1.496 1.226-1.496 2.323zm3.65 3.273c.46-.337 1.022-.796 1.475-1.32c.434-.502.875-1.183.875-1.953h-1.5c0 .214-.141.545-.51.971c-.348.403-.809.786-1.226 1.093zm2.35-3.273c0-1.097-.562-1.996-1.496-2.323c-.912-.32-1.948-.014-2.773.776l1.038 1.083c.525-.503.989-.531 1.24-.443c.228.08.491.33.491.907zM17.6 12.97c.368.27.782.608 1.4.608v-1.5c-.024 0-.04 0-.094-.03a4 4 0 0 1-.42-.287zm1.913-1.21a4 4 0 0 1-.42.289c-.053.029-.069.029-.093.029v1.5c.618 0 1.032-.337 1.4-.608z" /><path stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" d="M17.998 18q.002-.246.002-.5c0-2.485-3.582-4.5-8-4.5s-8 2.015-8 4.5S2 22 10 22c2.231 0 3.84-.157 5-.437" /></g></svg>
          </NavItem>

          <NavItem name="Painel Temporal" url="/painel_temporal">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2m1 11h5v-2h-4V6h-2v7z"/>
            </svg>
          </NavItem>

          <NavItem name="Records" url="/records">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 16 16"><path fill="currentColor" d="M4 9h4v2H4z" /><path fill="currentColor" d="M16 2h-1V0H5v2H3v1.25L2.4 4H1v1.75L0 7v9h12l4-5zM2 5h8v2H2zm9 10H1V8h10zm1-8h-1V4H4V3h8zm2-2.5l-1 1.25V2H6V1h8z" /></svg>
          </NavItem>

          <div className='flex items-center mt-4 pl-2'>
            <small className='text-gray-medium mr-2'>Analysis</small>
            <div className='inline-block w-full border-t-[1px] border-gray-medium' />
          </div>

          <ul className='flex flex-col gap-2'>
            <NavItem name="AI Classification" url="/select_echo" highlight={true}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48"><path fill="currentColor" d="M20 6h4v2.644c1.273-.078 2.506-.004 3.614.23c-4.7 1.85-6.863 6.605-7.217 7.383l-.022.048c-1.149-.174-2.393-.32-3.57-.309c-1.214.104-2.391.283-4.33 1.375c-.274.194-.642.51-1.143.994c-.036-.027-.075-.05-.126-.083l-.151-.096a12 12 0 0 0-1.174-.67c-1.016-.504-2.262-.933-3.483-.933v-3.879c2.111 0 4.01.717 5.305 1.36c.449.223.843.445 1.17.643a7.5 7.5 0 0 1 1.125-1.717L11.8 9.543l3.521-2.287l2.027 3.18a16 16 0 0 1 2.651-1.068zm10.757 8.691c-1.458.676-2.72 1.786-3.857 3.924c0 0-2.524-1.154-4.572-1.754c1.572-3.186 3.4-4.978 6.097-6.228c2.609-1.21 5.72-1.52 9.418-1.391L37.667 14c-3.41-.118-5.365-.025-6.91.691" /><path fill="currentColor" d="M13.281 19.22c-7.263 6.478 3.112 22.673 11.413 22.673s19.73-16.181 11.413-23.599a47 47 0 0 1-.516-.468c-.688-.63-1.145-1.05-2.414-1.804c-2.552 0-4.09 2.553-4.79 4.109a1.2 1.2 0 0 1-.13.22l-1.615 4.49l-.581 2.089a1 1 0 0 0 .045.665l.68 1.57l3.517-.408l.231 1.986l-3.309.385l.215 3.151l-1.995.136l-.268-3.931l-.906-2.095a3 3 0 0 1-.137-1.996l.017-.062l-2.034.92l-1.33 3.361l-1.86-.736l1.054-2.662l-3.21-.756l.458-1.947l4.006.944L24.89 23.8l1.23-3.42c-3.168-1.489-9.674-3.985-12.84-1.162" /></svg>
            </NavItem>

            <NavItem name="Analysis Review" url="/analysis_review">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 16 16"><path fill="currentColor" fillRule="evenodd" d="M1.75 1a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5zM1 4.75A.75.75 0 0 1 1.75 4H7a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 4.75m9 7.75a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5m0 1.5c.834 0 1.607-.255 2.248-.691l1.472 1.471a.75.75 0 1 0 1.06-1.06l-1.471-1.472A4 4 0 1 0 10 14M1.75 7a.75.75 0 0 0 0 1.5H4A.75.75 0 0 0 4 7z" clipRule="evenodd"></path></svg>
            </NavItem>
          </ul>
        </ul>

        <div className='flex items-center mt-4 mb-3 pl-2'>
          <small className='text-gray-medium mr-2'>Utilities</small>
          <div className='inline-block w-full border-t-[1px] border-gray-medium' />
        </div>

        <ul className='flex flex-col gap-2'>
          <NavItem name="AI Reports" url="/reports">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48"><g fill="currentColor" fillRule="evenodd" clipRule="evenodd"><path d="M21 10a2 2 0 0 0-2 2h-3a2 2 0 0 0-2 2v22a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V14a2 2 0 0 0-2-2h-3a2 2 0 0 0-2-2zm0 2h6v2h-6zm3.557 16l-2.493 6.649a1 1 0 1 0 1.872.702l1.259-3.355h2.61l1.259 3.355a1 1 0 1 0 1.872-.702L28.444 28h2.858a1 1 0 1 0 0-2h-10.3a1 1 0 0 0 0 2zM31 19.24H17v-2h14zM17 23.4h5v-2h-5zm11.5-.4a2 2 0 1 1-4 0a2 2 0 0 1 4 0" /><path d="M39 8H9a1 1 0 0 0-1 1v30a1 1 0 0 0 1 1h30a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1M9 6a3 3 0 0 0-3 3v30a3 3 0 0 0 3 3h30a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3z" /></g></svg>
          </NavItem>

          <NavItem name="Backoffice" url="/backoffice">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M17 22q-2.075 0-3.537-1.463T12 17t1.463-3.537T17 12t3.538 1.463T22 17t-1.463 3.538T17 22m-5 0q-3.475-.875-5.738-3.988T4 11.1V5l8-3l8 3v5.675q-.65-.325-1.463-.5T17 10q-2.9 0-4.95 2.05T10 17q0 1.55.588 2.8t1.487 2.175q-.025 0-.037.013T12 22m5-5q.625 0 1.063-.437T18.5 15.5t-.437-1.062T17 14t-1.062.438T15.5 15.5t.438 1.063T17 17m0 3q.775 0 1.425-.363t1.05-.962q-.55-.325-1.175-.5T17 18t-1.3.175t-1.175.5q.4.6 1.05.963T17 20" /></svg>
          </NavItem>

          <NavItem name="Settings" url="">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" fillRule="evenodd" d="M14.279 2.152C13.909 2 13.439 2 12.5 2s-1.408 0-1.779.152a2 2 0 0 0-1.09 1.083c-.094.223-.13.484-.145.863a1.62 1.62 0 0 1-.796 1.353a1.64 1.64 0 0 1-1.579.008c-.338-.178-.583-.276-.825-.308a2.03 2.03 0 0 0-1.49.396c-.318.242-.553.646-1.022 1.453c-.47.807-.704 1.21-.757 1.605c-.07.526.074 1.058.4 1.479c.148.192.357.353.68.555c.477.297.783.803.783 1.361s-.306 1.064-.782 1.36c-.324.203-.533.364-.682.556a2 2 0 0 0-.399 1.479c.053.394.287.798.757 1.605s.704 1.21 1.022 1.453c.424.323.96.465 1.49.396c.242-.032.487-.13.825-.308a1.64 1.64 0 0 1 1.58.008c.486.28.774.795.795 1.353c.015.38.051.64.145.863c.204.49.596.88 1.09 1.083c.37.152.84.152 1.779.152s1.409 0 1.779-.152a2 2 0 0 0 1.09-1.083c.094-.223.13-.483.145-.863c.02-.558.309-1.074.796-1.353a1.64 1.64 0 0 1 1.579-.008c.338.178.583.276.825.308c.53.07 1.066-.073 1.49-.396c.318-.242.553-.646 1.022-1.453c.47-.807.704-1.21.757-1.605a2 2 0 0 0-.4-1.479c-.148-.192-.357-.353-.68-.555c-.477-.297-.783-.803-.783-1.361s.306-1.064.782-1.36c.324-.203.533-.364.682-.556a2 2 0 0 0 .399-1.479c-.053-.394-.287-.798-.757-1.605s-.704-1.21-1.022-1.453a2.03 2.03 0 0 0-1.49-.396c-.242.032-.487.13-.825.308a1.64 1.64 0 0 1-1.58-.008a1.62 1.62 0 0 1-.795-1.353c-.015-.38-.051-.64-.145-.863a2 2 0 0 0-1.09-1.083M12.5 15c1.67 0 3.023-1.343 3.023-3S14.169 9 12.5 9s-3.023 1.343-3.023 3s1.354 3 3.023 3" clipRule="evenodd" /></svg>
          </NavItem>
        </ul>
      </ul>
    </nav>
  );
}

function NavItem({ name, url, highlight = false, children }) {

  const [active, setActive] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const { hasUnsavedChanges, setUnsavedChanges } = useUnsavedStore();

  const handleClick = (e) => {
    e.preventDefault();
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm("Tens alterações por salvar. Desejas mesmo sair?");
      if (!confirmLeave) return;
      setUnsavedChanges(false);
    }
    navigate(url);
  }

  useEffect(() => {
    setActive(location.pathname === url);
  }, [location, url]);

  return (
    <li className={`nav-link group font-medium p-2 rounded-lg cursor-pointer ${highlight ? 'hover:bg-green-dark' : 'hover:bg-green-pale'} transition-colors duration-250 *:transition-colors *:duration-250 ${highlight ? 'bg-green text-white' : active ? 'bg-green-pale' : 'bg-transparent'}`}>
      <button onClick={handleClick} className='flex items-center w-full h-full' role='link'>
        <div className={`grid place-items-center ml-1 mr-3 ${!highlight ? 'group-hover:fill-green group-hover:text-green' : ''} ${active ? 'fill-green-dark text-green-dark' : 'fill-current text-current'}`}>
          {children}
        </div>
        <span className={`text-lg ${!highlight ? 'group-hover:text-green' : 'text-white'} ${active ? 'text-green-dark' : 'text-gray-dark'}`}>
          {name}
        </span>
      </button>
    </li>
  );
}
