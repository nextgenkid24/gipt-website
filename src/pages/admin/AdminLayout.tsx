import React, { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ExternalLink,
  FileText,
  FolderTree,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { useSite } from '../../context/SiteContext';

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  superAdminOnly?: boolean;
  exact?: boolean;
}

const ADMIN_NAV: NavItem[] = [
  { label: 'Overview', to: '/admin', icon: LayoutDashboard, exact: true },
  { label: 'Posts & Insights', to: '/admin/posts', icon: FileText },
  { label: 'Categories', to: '/admin/categories', icon: FolderTree, superAdminOnly: true },
  { label: 'Programs & Trainings', to: '/admin/programs', icon: GraduationCap, superAdminOnly: true },
  { label: 'Publications Hub', to: '/admin/resources', icon: BookOpen, superAdminOnly: true },
  { label: 'Inquiries & Subscribers', to: '/admin/inbox', icon: Inbox, superAdminOnly: true },
  { label: 'Authors & Users', to: '/admin/users', icon: Users, superAdminOnly: true },
  { label: 'Site Settings', to: '/admin/settings', icon: Settings, superAdminOnly: true },
  { label: 'My Profile', to: '/admin/profile', icon: UserCircle },
];

export function AdminLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { user, settings, logout } = useSite();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isSuperAdmin = user?.role === 'super_admin';
  const visibleNav = ADMIN_NAV.filter((item) => !item.superAdminOnly || isSuperAdmin);

  async function handleLogout() {
    await logout();
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Desktop & Mobile Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#181F29] text-slate-200 flex flex-col transform transition-transform lg:translate-x-0 lg:static lg:inset-auto shrink-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-4 py-3.5 flex items-center justify-between gap-2 border-b border-white/10">
          <Link to="/admin" className="inline-flex items-center bg-white px-2.5 py-1.5 rounded">
            <img
              src={settings?.logo_url || '/assets/aistudio/1_8b905cc5.png'}
              alt={settings?.institute_name || 'Global Institute For Postgraduate Training'}
              className="h-8 w-auto object-contain"
            />
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="lg:hidden text-slate-300 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav aria-label="CMS Navigation" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded transition-colors ${
                  active
                    ? 'bg-[#008398] text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="text-xs">
            <p className="font-semibold text-white truncate">{user?.name}</p>
            <p className="text-slate-400 truncate">
              {isSuperAdmin ? 'Super Admin' : 'Editorial Author'} · {user?.email}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-white/10 hover:bg-white/20 rounded transition-colors whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              Public Site
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-200 bg-white/10 hover:bg-red-600/80 rounded transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile sidebar */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      {/* Main Content Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar navigation"
              className="lg:hidden p-2 -ml-2 text-[#181F29] hover:bg-slate-100 rounded"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline">CMS</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-sans text-base sm:text-lg font-semibold text-[#181F29] truncate">
                {title}
              </h1>
            </div>
          </div>

          <Link
            to="/admin/posts?new=1"
            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#008398] hover:bg-[#006B7D] rounded transition-colors whitespace-nowrap shrink-0"
          >
            New Article
          </Link>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
