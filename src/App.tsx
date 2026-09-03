import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { useAuth } from './hooks/useAuth';

const BlogListPage = lazy(() => import('./pages/blog/BlogListPage').then((module) => ({ default: module.BlogListPage })));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const EnquiriesPage = lazy(() => import('./pages/enquiries/EnquiriesPage').then((module) => ({ default: module.EnquiriesPage })));
const PostEditorPage = lazy(() => import('./pages/blog/PostEditorPage').then((module) => ({ default: module.PostEditorPage })));
const PostPreviewPage = lazy(() => import('./pages/blog/PostPreviewPage').then((module) => ({ default: module.PostPreviewPage })));

function PageLoader() {
  return <div className="grid min-h-[50vh] place-items-center text-sm font-semibold text-brand-softText">Loading page...</div>;
}

function LegacyBlogRedirect({ panel }: { panel: string }) {
  const location = useLocation();
  return <Navigate to={`/blog?panel=${panel}${location.search ? `&from=${encodeURIComponent(location.pathname)}` : ''}`} replace />;
}

function RootRedirect() {
  const { session, isAdmin, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center bg-brand-muted text-sm font-semibold text-brand-softText">Loading admin...</div>;
  return <Navigate to={session && isAdmin ? '/dashboard' : '/login'} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RootRedirect />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
          <Route path="/blog" element={<Suspense fallback={<PageLoader />}><BlogListPage /></Suspense>} />
          <Route path="/enquiries" element={<Suspense fallback={<PageLoader />}><EnquiriesPage /></Suspense>} />
          <Route path="/blog/new" element={<Suspense fallback={<PageLoader />}><PostEditorPage mode="new" /></Suspense>} />
          <Route path="/blog/:id/edit" element={<Suspense fallback={<PageLoader />}><PostEditorPage mode="edit" /></Suspense>} />
          <Route path="/blog/:id/preview" element={<Suspense fallback={<PageLoader />}><PostPreviewPage /></Suspense>} />
          <Route path="/categories" element={<LegacyBlogRedirect panel="categories" />} />
          <Route path="/tags" element={<LegacyBlogRedirect panel="tags" />} />
          <Route path="/media" element={<LegacyBlogRedirect panel="media" />} />
          <Route path="/comments" element={<LegacyBlogRedirect panel="comments" />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

