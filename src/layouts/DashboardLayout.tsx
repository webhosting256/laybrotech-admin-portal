import { useEffect, useState } from 'react';
import { FiBookOpen, FiGrid, FiInbox, FiLogOut, FiMenu, FiMoon, FiSun, FiX } from 'react-icons/fi';
import { NavLink, Outlet } from 'react-router-dom';

import logo from '../assets/LaybroTech-Logo.png';
import darkLogo from '../assets/LaybroTech-Logo-Dark.png';
import { useAuth } from '../hooks/useAuth';
import { countNewEnquiries } from '../lib/enquiryService';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: FiGrid },
  { label: 'Blog', href: '/blog', icon: FiBookOpen },
  { label: 'Enquiries', href: '/enquiries', icon: FiInbox },
];

function Sidebar({ darkMode, newEnquiryCount, onNavigate }: { darkMode: boolean; newEnquiryCount: number; onNavigate?: () => void }) {
  const { signOut } = useAuth();

  return (
    <aside className="flex h-full flex-col border-r border-brand-border bg-white">
      <div className="flex h-16 items-center border-b border-brand-border px-5">
        <img src={darkMode ? darkLogo : logo} alt="Laybrotech" className="h-10 w-auto object-contain" />
      </div>
      <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Admin navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.href} to={item.href} onClick={onNavigate} className={({ isActive }) => `flex h-[42px] items-center gap-3 rounded-[10px] px-3 text-sm font-semibold transition ${isActive ? 'bg-brand-orange !text-white hover:bg-brand-orange hover:!text-white [&_svg]:!text-white' : 'text-brand-charcoal hover:bg-brand-muted hover:text-brand-charcoal'}`}>
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
              {item.href === '/enquiries' && newEnquiryCount > 0 ? <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-extrabold leading-4 text-white ring-2 ring-white" aria-label={`${newEnquiryCount} unopened enquiries`}>{newEnquiryCount > 99 ? '99+' : newEnquiryCount}</span> : null}
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-brand-border p-3">
        <button onClick={() => void signOut()} className="flex h-[42px] w-full items-center gap-3 rounded-[10px] px-3 text-left text-sm font-semibold text-brand-charcoal hover:bg-brand-muted hover:text-brand-charcoal">
          <FiLogOut className="size-4" aria-hidden="true" />
          Logout
        </button>
      </div>
    </aside>
  );
}

export function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [newEnquiryCount, setNewEnquiryCount] = useState(0);
  const [darkMode, setDarkMode] = useState(() => window.localStorage.getItem('laybrotech-admin-theme') === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light';
    window.localStorage.setItem('laybrotech-admin-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);
  useEffect(() => {
    let mounted = true;
    async function refreshCount() {
      try {
        const count = await countNewEnquiries();
        if (mounted) setNewEnquiryCount(count);
      } catch {
        // The badge must never prevent navigation from working.
      }
    }
    const handleUpdate = () => { void refreshCount(); };
    void refreshCount();
    const interval = window.setInterval(refreshCount, 30000);
    window.addEventListener('enquiries-updated', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener('enquiries-updated', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white text-brand-charcoal">
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block lg:w-[17rem]"><Sidebar darkMode={darkMode} newEnquiryCount={newEnquiryCount} /></div>
      {mobileOpen ? <div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 bg-black/35" aria-label="Close menu" onClick={() => setMobileOpen(false)} /><div className="relative h-full w-72 max-w-[86vw] bg-white shadow-soft"><button className="absolute right-4 top-4 rounded-lg p-2 text-brand-softText hover:bg-brand-muted" aria-label="Close menu" onClick={() => setMobileOpen(false)}><FiX className="size-5" /></button><Sidebar darkMode={darkMode} newEnquiryCount={newEnquiryCount} onNavigate={() => setMobileOpen(false)} /></div></div> : null}
      <div className="lg:pl-[17rem]">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-brand-border bg-white/95 px-4 backdrop-blur md:px-6 lg:hidden">
          <button className="rounded-[10px] border border-brand-border bg-white p-2 text-brand-charcoal" aria-label="Open menu" onClick={() => setMobileOpen(true)}><FiMenu className="size-5" /></button>
          <img src={darkMode ? darkLogo : logo} alt="Laybrotech Admin" className="h-8 w-auto object-contain" />
        </header>
        <main className="min-h-screen px-4 py-5 md:px-6 lg:px-7"><Outlet /></main>
      </div>
      <button type="button" onClick={() => setDarkMode((current) => !current)} className="fixed bottom-5 right-5 z-50 grid size-12 place-items-center rounded-full border border-brand-border bg-white text-brand-charcoal shadow-[0_10px_30px_rgba(0,0,0,0.18)] hover:-translate-y-0.5 hover:text-brand-orange" aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} title={darkMode ? 'Light mode' : 'Dark mode'}>{darkMode ? <FiSun className="size-5" /> : <FiMoon className="size-5" />}</button>
    </div>
  );
}