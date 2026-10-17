import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Account from './pages/Account';
import ScrollManager from './components/ScrollManager';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ApplyResearcher from './pages/auth/ApplyResearcher';
import Landing from './pages/Landing';
import LegalPage from './pages/LegalPage';
import RiceDiseases from './pages/RiceDiseases';
import ResearchStudy from './pages/ResearchStudy';
import Feedback from './pages/Feedback';
import TryScan from './pages/TryScan';

import Scan from './pages/farmer/Scan';
import History from './pages/farmer/History';
import Wiki from './pages/farmer/Wiki';
import Outbreak from './pages/farmer/Outbreak';
import Profile from './pages/farmer/Profile';

import ResearchDashboard from './pages/researcher/ResearchDashboard';
import RiskMap from './pages/researcher/RiskMap';
import DataExplorer from './pages/researcher/DataExplorer';

import AdminDashboard from './pages/admin/AdminDashboard';
import AllReports from './pages/admin/AllReports';
import LiveFeed from './pages/admin/LiveFeed';
import Users from './pages/admin/Users';
import PendingResearchers from './pages/admin/PendingResearchers';
import WikiManage from './pages/admin/WikiManage';
import AuditLogs from './pages/admin/AuditLogs';
import ReviewQueue from './pages/admin/ReviewQueue';
import ModelQuality from './pages/admin/ModelQuality';
import OutbreakAlerts from './pages/admin/OutbreakAlerts';
import MonthlyReport from './pages/admin/MonthlyReport';
import SystemSettings from './pages/admin/SystemSettings';
import FeedbackInbox from './pages/admin/FeedbackInbox';

import PublicRiskMap from './pages/PublicRiskMap';
import MaintenancePage from './pages/MaintenancePage';
import { useSettings } from './lib/settings';
import { useAuth } from './lib/AuthContext';

function MaintenanceGate({ children }) {
  const { settings, loaded } = useSettings();
  const { user } = useAuth();
  const location = useLocation();

  // Keep sign-in and the private portal reachable so an administrator can disable maintenance.
  const isPrivateArea = ['/admin', '/research', '/app'].some((prefix) => location.pathname.startsWith(prefix));
  if (location.pathname === '/login' || (user?.role === 'admin' && isPrivateArea)) return children;
  if (!loaded) {
    return <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] text-sm font-semibold text-[var(--color-muted)]">กำลังตรวจสอบสถานะระบบ…</div>;
  }
  if (settings.maintenance?.active) return <MaintenancePage maintenance={settings.maintenance} />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <AuthProvider>
        <MaintenanceGate>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/apply-researcher" element={<ApplyResearcher />} />
          <Route path="/terms" element={<LegalPage type="terms" />} />
          <Route path="/privacy" element={<LegalPage type="privacy" />} />
          <Route path="/rice-diseases" element={<RiceDiseases />} />
          <Route path="/research-study" element={<ResearchStudy />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/try-scan" element={<TryScan />} />          <Route path="/risk-map" element={<PublicRiskMap />} />

          <Route path="/app/scan" element={<ProtectedRoute roles={['farmer', 'researcher', 'admin']}><Scan /></ProtectedRoute>} />
          <Route path="/app/history" element={<ProtectedRoute roles={['farmer', 'researcher', 'admin']}><History /></ProtectedRoute>} />
          <Route path="/app/wiki" element={<ProtectedRoute roles={['farmer', 'researcher', 'admin']}><Wiki /></ProtectedRoute>} />
          <Route path="/app/outbreak" element={<ProtectedRoute roles={['farmer', 'researcher', 'admin']}><Outbreak /></ProtectedRoute>} />
          <Route path="/app/profile" element={<ProtectedRoute roles={['farmer', 'researcher', 'admin']}><Profile /></ProtectedRoute>} />

          <Route path="/research/dashboard" element={<ProtectedRoute roles={['researcher']}><ResearchDashboard /></ProtectedRoute>} />
          <Route path="/research/risk-map" element={<ProtectedRoute roles={['researcher']}><RiskMap /></ProtectedRoute>} />
          <Route path="/research/explorer" element={<ProtectedRoute roles={['researcher']}><DataExplorer /></ProtectedRoute>} />
          <Route path="/research/scan" element={<ProtectedRoute roles={['researcher', 'admin']}><Scan /></ProtectedRoute>} />
          <Route path="/research/wiki" element={<ProtectedRoute roles={['researcher', 'admin']}><Wiki /></ProtectedRoute>} />
          <Route path="/research/account" element={<ProtectedRoute roles={['researcher']}><Account /></ProtectedRoute>} />

          <Route path="/admin/dashboard" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute roles={['admin']}><AllReports /></ProtectedRoute>} />
          <Route path="/admin/live-feed" element={<ProtectedRoute roles={['admin']}><LiveFeed /></ProtectedRoute>} />
          <Route path="/admin/explorer" element={<ProtectedRoute roles={['admin']}><DataExplorer /></ProtectedRoute>} />
          <Route path="/admin/approvals" element={<ProtectedRoute roles={['admin']}><PendingResearchers /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><Users /></ProtectedRoute>} />
          <Route path="/admin/wiki" element={<ProtectedRoute roles={['admin']}><WikiManage /></ProtectedRoute>} />
          <Route path="/admin/risk-map" element={<ProtectedRoute roles={['admin']}><RiskMap /></ProtectedRoute>} />
          <Route path="/admin/alerts" element={<ProtectedRoute roles={['admin']}><OutbreakAlerts /></ProtectedRoute>} />
          <Route path="/admin/review" element={<ProtectedRoute roles={['admin']}><ReviewQueue /></ProtectedRoute>} />
          <Route path="/admin/model" element={<ProtectedRoute roles={['admin']}><ModelQuality /></ProtectedRoute>} />
          <Route path="/admin/report" element={<ProtectedRoute roles={['admin']}><MonthlyReport /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute roles={['admin']}><SystemSettings /></ProtectedRoute>} />
          <Route path="/admin/feedback" element={<ProtectedRoute roles={['admin']}><FeedbackInbox /></ProtectedRoute>} />
          <Route path="/admin/logs" element={<ProtectedRoute roles={['admin']}><AuditLogs /></ProtectedRoute>} />
          <Route path="/admin/account" element={<ProtectedRoute roles={['admin']}><Account /></ProtectedRoute>} />

          <Route path="/" element={<Landing />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </MaintenanceGate>
      </AuthProvider>
    </BrowserRouter>
  );
}



