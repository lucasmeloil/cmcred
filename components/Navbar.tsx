import React, { useState, useEffect } from 'react';
import { Home, CreditCard, Calculator, MapPin, Phone } from 'lucide-react';

const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const targetElement = document.querySelector(targetId);
    if (targetElement) {
      const offset = 80;
      const elementPosition = targetElement.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const navLinks = [
    { name: 'Início', href: '#inicio', icon: <Home size={18} /> },
    { name: 'Serviços', href: '#servicos-oficiais', icon: <CreditCard size={18} /> },
    { name: 'Como Funciona', href: '#como-funciona', icon: <CreditCard size={18} /> },
    { name: 'Simulação', href: '#simulador', icon: <Calculator size={18} /> },
    { name: 'Unidades', href: '#unidades', icon: <MapPin size={18} /> },
    { name: 'Contato', href: '#contato', icon: <Phone size={18} /> },
  ];

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 border-b ${
        isScrolled
          ? 'bg-black-900/95 border-amber-500/30 py-2.5 shadow-[0_4px_25px_rgba(0,0,0,0.9)] backdrop-blur-md'
          : 'bg-black-900/80 backdrop-blur-md border-amber-500/10 py-3.5'
      }`}
    >
      <div className="container mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-center md:justify-between items-center gap-3">
        {/* Logo */}
        <a 
          href="#inicio" 
          className="group cursor-pointer relative flex items-center gap-3" 
          onClick={(e) => handleScroll(e, '#inicio')}
        >
          {/* Logo Glow */}
          <div className="absolute -inset-2 bg-amber-500/15 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          
          <img 
            src="/cmcred-logo.png" 
            alt="CMCred Soluções Financeiras" 
            className="h-10 md:h-12 w-auto object-contain transition-all transform group-hover:scale-105 drop-shadow-[0_0_12px_rgba(245,158,11,0.35)]"
          />
        </a>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center space-x-7">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={(e) => handleScroll(e, link.href)}
              className="text-xs font-semibold text-gray-300 hover:text-amber-400 transition-colors uppercase tracking-wider flex items-center gap-1.5 relative group cursor-pointer"
            >
              {link.name}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-amber-400 to-yellow-500 transition-all group-hover:w-full"></span>
            </a>
          ))}
          <a
            href="#simulador"
            onClick={(e) => handleScroll(e, '#simulador')}
            className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-black-950 font-black text-xs uppercase tracking-wider py-2.5 px-6 rounded-full transition-all transform hover:scale-105 shadow-[0_0_18px_rgba(245,158,11,0.45)] hover:shadow-[0_0_28px_rgba(245,158,11,0.7)] cursor-pointer"
          >
            SIMULAR AGORA
          </a>
        </div>

        {/* Mobile Spacer */}
        <div className="md:hidden h-1"></div>
      </div>
    </nav>
  );
};

export default Navbar;



