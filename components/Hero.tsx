import React from 'react';
import { ArrowRight, ShieldCheck, Zap } from 'lucide-react';

const Hero: React.FC = () => {
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

  return (
    <section
      id="inicio"
      className="relative min-h-[100svh] flex items-center justify-center overflow-hidden bg-black-900 pt-16 pb-20 md:pt-24 md:pb-8"
    >
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.12),transparent_70%)]"></div>
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(245,158,11,0.15),rgba(255,255,255,0))]"></div>

      <div className="container mx-auto px-4 md:px-8 relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-12 items-center">
        
        {/* Visual Content: 3D Official CM CRED Mascot Character with Golden Glow */}
        <div className="relative flex justify-center items-center order-1 md:order-2 pt-1 md:pt-0">
            <div className="relative w-full max-w-[190px] sm:max-w-[250px] md:max-w-[460px] flex justify-center items-center">
                {/* Intense Gold Glowing Halo behind mascot */}
                <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/30 via-yellow-400/20 to-amber-600/30 rounded-full blur-[40px] md:blur-[100px] animate-pulse"></div>
                
                {/* Golden rotating ring in background */}
                <div className="absolute w-[95%] aspect-square rounded-full border border-amber-500/25 animate-spin" style={{ animationDuration: '35s' }}></div>
                
                {/* 3D Mascot Character */}
                <div className="relative z-10 w-full flex justify-center items-end animate-float">
                  <img 
                      src="/cmcred-mascote.png" 
                      alt="Mascote Oficial CM CRED" 
                      className="object-contain w-full max-h-[190px] sm:max-h-[250px] md:max-h-[500px] drop-shadow-[0_10px_25px_rgba(245,158,11,0.35)] transition-transform duration-500 hover:scale-105"
                  />
                </div>
                
                {/* Floating Card 1: Dinheiro na Hora PIX */}
                <div className="absolute bottom-1 -left-4 sm:bottom-4 sm:-left-6 md:bottom-10 md:-left-8 bg-black-900/95 backdrop-blur-md border border-amber-500/50 p-1.5 sm:p-2 md:p-3.5 rounded-xl md:rounded-2xl shadow-[0_0_20px_rgba(212,175,55,0.3)] animate-bounce z-20" style={{ animationDuration: '3.5s' }}>
                    <div className="flex items-center gap-1.5 md:gap-3">
                        <div className="bg-amber-500/20 p-1 md:p-2 rounded-lg md:rounded-xl text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]">
                            <Zap size={14} className="md:w-5 md:h-5 text-yellow-400" />
                        </div>
                        <div>
                            <p className="text-[8px] md:text-xs text-gray-400 uppercase tracking-wider font-semibold">Dinheiro</p>
                            <p className="text-white text-[10px] md:text-sm font-black font-orbitron text-gradient-gold">Na Hora PIX</p>
                        </div>
                    </div>
                </div>

                {/* Floating Card 2: Em até 21x */}
                <div className="absolute top-1 -right-4 sm:top-4 sm:-right-6 md:top-12 md:-right-8 bg-black-900/95 backdrop-blur-md border border-amber-500/50 p-1.5 sm:p-2 md:p-3.5 rounded-xl md:rounded-2xl shadow-[0_0_20px_rgba(212,175,55,0.3)] animate-bounce z-20" style={{ animationDuration: '4.5s' }}>
                    <div className="flex items-center gap-1.5 md:gap-3">
                         <div className="bg-gradient-to-r from-amber-500 to-yellow-500 p-1 md:p-2 rounded-lg md:rounded-xl text-black-950 font-black shadow-[0_0_12px_rgba(245,158,11,0.4)]">
                            <span className="text-[9px] md:text-sm font-orbitron">21x</span>
                        </div>
                        <div>
                            <p className="text-[8px] md:text-xs text-gray-400 uppercase tracking-wider font-semibold">Em até</p>
                            <p className="text-white text-[10px] md:text-sm font-black font-orbitron">21x Cartão</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Text Content */}
        <div className="space-y-3 md:space-y-6 text-center md:text-left order-2 md:order-1">
          <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1 text-amber-300 text-[10px] md:text-xs font-semibold backdrop-blur-sm mx-auto md:mx-0 shadow-[0_0_12px_rgba(212,175,55,0.15)]">
            <ShieldCheck size={12} className="md:w-3.5 md:h-3.5 text-yellow-400" />
            <span>Cobrimos Qualquer Oferta • Loja em Lagarto/SE</span>
          </div>
          
          <h1 className="text-xl sm:text-3xl md:text-5xl lg:text-6xl font-orbitron font-black text-white leading-tight drop-shadow-lg">
            DINHEIRO COM O <br/>
            <span className="text-gradient-gold">
              LIMITE DO SEU CARTÃO
            </span>
          </h1>
          
          <p className="text-xs sm:text-sm md:text-lg text-gray-300 max-w-lg mx-auto md:mx-0 font-normal leading-relaxed px-1 md:px-0">
            Troque seu limite do cartão por <strong className="text-amber-400 font-bold">dinheiro na hora</strong> com as menores taxas. 
            Dividimos em <span className="text-yellow-300 font-black">até 21x</span> e cobrimos qualquer oferta!
          </p>

          <div className="flex flex-row gap-2.5 justify-center md:justify-start pt-1 w-full px-1 sm:px-0">
            <a
              href="#simulador"
              onClick={(e) => handleScroll(e, '#simulador')}
              className="flex-1 sm:flex-initial group bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-black-950 font-black py-3 px-5 sm:px-8 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-1.5 cursor-pointer text-xs sm:text-sm uppercase tracking-wider"
            >
              SIMULAR AGORA
              <ArrowRight size={14} className="sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <a
              href="https://wa.me/5579998627907?text=Olá!%20Gostaria%20de%20fazer%20uma%20simulação%20com%20a%20CM%20CRED."
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-initial border border-amber-500/30 bg-black-850/80 hover:bg-amber-500/10 text-white font-semibold py-3 px-4 sm:px-7 rounded-xl hover:border-amber-400 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs sm:text-sm shadow-lg whitespace-nowrap"
            >
              WHATSAPP
            </a>
          </div>

          {/* Quick Features */}
          <div className="pt-2 grid grid-cols-3 gap-2 border-t border-white/5 text-center sm:text-left">
            <div>
              <p className="text-amber-400 font-bold font-orbitron text-xs md:text-base">PIX</p>
              <p className="text-[10px] md:text-[11px] text-gray-400">Na hora</p>
            </div>
            <div>
              <p className="text-amber-400 font-bold font-orbitron text-xs md:text-base">Até 21x</p>
              <p className="text-[10px] md:text-[11px] text-gray-400">No cartão</p>
            </div>
            <div>
              <p className="text-amber-400 font-bold font-orbitron text-xs md:text-base">Centro</p>
              <p className="text-[10px] md:text-[11px] text-gray-400">Lagarto/SE</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
