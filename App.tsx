import React from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import CompanyServices from './components/CompanyServices';
import HowItWorks from './components/HowItWorks';
import Simulator from './components/Simulator';
import Locations from './components/Locations';
import Testimonials from './components/Testimonials';
import Contact from './components/Contact';
import Footer from './components/Footer';
import WhatsAppFloating from './components/WhatsAppFloating';
import BottomNav from './components/BottomNav';
import AdminPanel from './admin/AdminPanel';
import './lib/connectionManager';

const App: React.FC = () => {
  const [currentPath, setCurrentPath] = React.useState(
    window.location.pathname.toLowerCase() + window.location.hash.toLowerCase()
  );

  React.useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname.toLowerCase() + window.location.hash.toLowerCase());
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Route to admin / consultant panel if URL starts with or contains admin/consultor/login/painel/acesso or has active user session
  const hasUserSession = () => {
    try {
      if (typeof window === 'undefined') return false;
      let hasSbToken = false;
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
          hasSbToken = !!window.localStorage.getItem(k);
          if (hasSbToken) break;
        }
      }
      return (
        hasSbToken ||
        !!localStorage.getItem('cmcred_active_user_session') ||
        !!localStorage.getItem('cmcred_cached_user_profile') ||
        !!localStorage.getItem('cmcred_auth_token')
      );
    } catch {
      return false;
    }
  };

  const adminSections = [
    '#admin', '#login', '#painel', '#consultor', '#dashboard', 
    '#financeiro', '#solicitacoes', '#relatorios', '#pessoas', 
    '#maquininhas', '#taxas_simulador', '#usuarios', 
    '#tutoriais', '#simulador', '#novo_emprestimo', '#bandeiras'
  ];

  const isExplicitHome = currentPath.includes('#site') || currentPath.includes('#home');

  const isPanel = 
    (!isExplicitHome && hasUserSession()) ||
    currentPath.startsWith('/admin') || 
    currentPath.startsWith('/consultor') || 
    currentPath.startsWith('/login') || 
    currentPath.startsWith('/painel') || 
    currentPath.startsWith('/acesso') ||
    adminSections.some(sec => currentPath.includes(sec));

  if (isPanel) {
    return <AdminPanel />;
  }

  return (
    <div className="min-h-screen bg-black-900 font-roboto text-gray-100 overflow-x-hidden">
      <Navbar />
      <main>
        <Hero />
        <CompanyServices />
        <HowItWorks />
        <Simulator />
        <Locations />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
      <WhatsAppFloating />
      <BottomNav />
    </div>
  );
};

export default App;