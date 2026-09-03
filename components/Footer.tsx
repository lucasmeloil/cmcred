import React from 'react';
import { Instagram, Facebook, Phone } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-black-950 border-t border-amber-500/15 pt-12 pb-8 text-sm">
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
          <div className="mb-6 md:mb-0 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-3">
              <img
                src="/cmcred-logo.png"
                alt="CMCred Soluções Financeiras"
                className="h-10 md:h-12 w-auto object-contain drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]"
              />
            </div>
            <p className="text-gray-300 text-xs font-semibold">📍 Rua Dr. Laudelino Freire, nº 243A — Centro, Lagarto / SE</p>
            <p className="text-gray-400 text-xs mt-1">Dinheiro com o limite do seu cartão • Cobrimos qualquer oferta!</p>
            <p className="text-amber-400 text-xs font-bold mt-1">WhatsApp: (79) 99862-7907 • Instagram: @cmcred_lagarto</p>
          </div>

          <div className="flex gap-4">
            <a
              href="https://wa.me/5579998627907"
              target="_blank"
              rel="noopener noreferrer"
              title="Falar no WhatsApp"
              className="text-gray-400 hover:text-amber-400 transition-colors p-3 bg-black-900 hover:bg-amber-500/10 rounded-xl border border-amber-500/20 shadow-lg"
            >
              <Phone size={20} />
            </a>
            <a
              href="https://instagram.com/cmcred_lagarto"
              target="_blank"
              rel="noopener noreferrer"
              title="Siga @cmcred_lagarto no Instagram"
              className="text-gray-400 hover:text-pink-400 transition-colors p-3 bg-black-900 hover:bg-pink-500/10 rounded-xl border border-amber-500/20 shadow-lg"
            >
              <Instagram size={20} />
            </a>
          </div>
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-gray-500 text-xs">
          <div className="text-center md:text-left">
            <p>&copy; {new Date().getFullYear()} CM CRED — Soluções Financeiras. Todos os direitos reservados.</p>
          </div>
          <div className="flex items-center gap-6 text-gray-400">
            <a href="/admin" className="hover:text-amber-400 transition-colors">Acesso Restrito</a>
            <a href="#" className="hover:text-amber-400 transition-colors">Política de Privacidade</a>
            <a href="#" className="hover:text-amber-400 transition-colors">Termos de Uso</a>
          </div>
        </div>

        {/* Developer Credit */}
        <div className="mt-6 pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-gray-500 text-[11px]">Desenvolvido por</span>
            <a
              href="https://www.nexussofttech.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-yellow-300 font-black tracking-wider transition-colors hover:underline"
            >
              NEXUS SOFT TECH
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;



