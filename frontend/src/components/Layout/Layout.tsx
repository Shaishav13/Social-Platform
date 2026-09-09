import { useLocation } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { AdminLayout } from './AdminLayout';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  if (location.pathname.startsWith('/admin')) {
    return <AdminLayout>{children}</AdminLayout>;
  }

  return <AppLayout>{children}</AppLayout>;
};

export default Layout;