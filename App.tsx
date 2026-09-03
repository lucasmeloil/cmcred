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

  // Route to admin / consultant panel if URL starts with or contains admin/consultor/login/painel/acesso
  const isPanel = 
    currentPath.startsWith('/admin') || 
    currentPath.startsWith('/consultor') || 
    currentPath.startsWith('/login') || 
    currentPath.startsWith('/painel') || 
    currentPath.startsWith('/acesso') ||
    currentPath.includes('#admin') ||
    currentPath.includes('#login') ||
    currentPath.includes('#painel') ||
    currentPath.includes('#consultor');

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