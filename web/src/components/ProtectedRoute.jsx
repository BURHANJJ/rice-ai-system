import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useSettings } from '../lib/settings';
import { hasTotp } from '../lib/mfa';
import { needs2fa } from '../pages/Account';
import Layout from './Layout';

export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const { settings } = useSettings();
  const location = useLocation();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-[var(--color-muted)]">กำลังโหลด...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  // Admins bypass some status checks, but even admins shouldn't be suspended
  if (user.status === 'suspended') {
    return <Navigate to="/login" replace state={{ error: 'บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' }} />;
  }
  
  if (user.status === 'pending') {
    return <Navigate to="/login" replace state={{ error: 'บัญชีของคุณอยู่ระหว่างรอการอนุมัติจากผู้ดูแลระบบ' }} />;
  }

  // Admins have access to everything, otherwise check if user role is in allowed roles
  const hasAccess = !roles || roles.includes(user.role) || user.role === 'admin';
  if (!hasAccess) return <Navigate to="/login" replace />;

  // 2FA policy (System settings → security): send the user to set it up before anything else
  const accountPath = user.role === 'admin' ? '/admin/account' : '/research/account';
  if (needs2fa(settings.security?.require2fa, user.role) && !hasTotp() && location.pathname !== accountPath) {
    return <Navigate to={`${accountPath}?tab=security`} replace />;
  }
  
  return <Layout>{children}</Layout>;
}
