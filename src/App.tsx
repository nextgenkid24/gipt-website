import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { SiteProvider, useSite } from './context/SiteContext';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { HomePage } from './pages/HomePage';
import { InsightsPage } from './pages/InsightsPage';
import { ProgramsPage } from './pages/ProgramsPage';
import { SinglePostPage } from './pages/SinglePostPage';
import { WhyChooseUsPage } from './pages/WhyChooseUsPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminLogin } from './pages/admin/AdminLogin';
import { CategoriesManager } from './pages/admin/CategoriesManager';
import { InquiriesSubscribersManager } from './pages/admin/InquiriesSubscribersManager';
import { PostsManager } from './pages/admin/PostsManager';
import { ProgramsManager } from './pages/admin/ProgramsManager';
import { ResourcesManager } from './pages/admin/ResourcesManager';
import { SettingsManager } from './pages/admin/SettingsManager';
import { ProfileManager, UsersManager } from './pages/admin/UsersManager';

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, authLoading } = useSite();
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] text-sm text-slate-600">
        Verifying session...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}

function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const { user, authLoading } = useSite();
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] text-sm text-slate-600">
        Verifying permissions...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }
  if (user.role !== 'super_admin') {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <SiteProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          {/* Public Institutional Website */}
          <Route path="/" element={<PublicRoute><HomePage /></PublicRoute>} />
          <Route path="/about" element={<PublicRoute><AboutPage /></PublicRoute>} />
          <Route path="/why-choose-us" element={<PublicRoute><WhyChooseUsPage /></PublicRoute>} />
          <Route path="/programs" element={<PublicRoute><ProgramsPage /></PublicRoute>} />
          <Route path="/insights" element={<PublicRoute><InsightsPage /></PublicRoute>} />
          <Route path="/insights/:slug" element={<PublicRoute><SinglePostPage /></PublicRoute>} />
          <Route path="/contact" element={<PublicRoute><ContactPage /></PublicRoute>} />

          {/* Admin CMS Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
          <Route path="/admin/posts" element={<RequireAuth><PostsManager /></RequireAuth>} />
          <Route path="/admin/profile" element={<RequireAuth><ProfileManager /></RequireAuth>} />
          <Route
            path="/admin/categories"
            element={<RequireSuperAdmin><CategoriesManager /></RequireSuperAdmin>}
          />
          <Route
            path="/admin/programs"
            element={<RequireSuperAdmin><ProgramsManager /></RequireSuperAdmin>}
          />
          <Route
            path="/admin/resources"
            element={<RequireSuperAdmin><ResourcesManager /></RequireSuperAdmin>}
          />
          <Route
            path="/admin/inbox"
            element={<RequireSuperAdmin><InquiriesSubscribersManager /></RequireSuperAdmin>}
          />
          <Route
            path="/admin/users"
            element={<RequireSuperAdmin><UsersManager /></RequireSuperAdmin>}
          />
          <Route
            path="/admin/settings"
            element={<RequireSuperAdmin><SettingsManager /></RequireSuperAdmin>}
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SiteProvider>
  );
}
