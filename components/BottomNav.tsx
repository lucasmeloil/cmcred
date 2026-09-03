import React from 'react';
import { Home, CreditCard, Calculator, MapPin, Phone } from 'lucide-react';

const BottomNav: React.FC = () => {
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

  const links = [
    { name: 'Início', href: '#inicio', icon: <Home size={22} /> },
    { name: 'Serviços', href: '#servicos-oficiais', icon: <CreditCard size={22} /> },
    { name: 'Simular', href: '#simulador', icon: <Calculator size={22} /> },
    { name: 'Unidades', href: '#unidades', icon: <MapPin size={22} /> },
    { name: 'Contato', href: '#contato', icon: <Phone size={22} /> },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 w-full z-50">
      <nav className="relative bg-black-950/95 backdrop-blur-2xl border-t border-amber-500/30 rounded-t-2xl shadow-[0_-10px_30px_rgba(0,0,0,0.8)] overflow-hidden pb-safe">
        {/* Glow Line Top */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/60 to-transparent"></div>
        
        <div className="flex justify-around items-center px-2 py-3">
          {links.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={(e) => handleScroll(e, link.href)}
              className="group relative flex flex-col items-center gap-1 transition-all duration-300 flex-1 py-1"
            >
              <div className="relative z-10 text-gray-400 group-hover:text-amber-400 group-active:text-yellow-300 group-active:scale-110 transition-all">
                {link.icon}
              </div>
              
              <span className="relative z-10 text-[9px] font-orbitron font-bold text-gray-400 group-hover:text-amber-400 group-active:text-yellow-300 uppercase tracking-tight transition-all">
                {link.name}
              </span>

              {/* Active Indicator Dot */}
              <div className="h-1 w-1 bg-amber-400 rounded-full opacity-0 group-active:opacity-100 shadow-[0_0_8px_rgba(245,158,11,1)] transition-opacity"></div>
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default BottomNav;

