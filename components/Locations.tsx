import React from 'react';
import { MapPin, Phone, Navigation, MessageCircle, Instagram, CheckCircle2, ShieldCheck, Clock, CreditCard, Sparkles } from 'lucide-react';

const Locations: React.FC = () => {
  return (
    <section id="unidades" className="py-20 bg-black-900 border-t border-amber-500/10 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-1/2 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-yellow-500/10 rounded-full blur-[140px] pointer-events-none"></div>

      <div className="container mx-auto px-4 md:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-4 py-1.5 rounded-full text-amber-300 text-xs font-black uppercase tracking-widest mb-4 backdrop-blur-sm shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <MapPin size={16} className="text-yellow-400" /> Loja Física Oficial
          </div>
          <h2 className="text-3xl md:text-5xl font-orbitron font-black text-white leading-tight mb-4">
            VENHA VISITAR <span className="text-gradient-gold">NOSSA LOJA</span>
          </h2>
          <p className="text-gray-400 text-sm md:text-base max-w-2xl mx-auto">
            Estamos de portas abertas no coração de <strong className="text-amber-400">Lagarto/SE</strong> prontos para te receber com conforto, segurança e a melhor taxa da região!
          </p>
        </div>

        {/* Master Showcase: Store Photo + Store Card Details */}
        <div className="grid lg:grid-cols-12 gap-8 items-center max-w-6xl mx-auto">
          
          {/* Left Column: Real Store Banner / Photo */}
          <div className="lg:col-span-6 relative group">
            <div className="absolute -inset-1.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 rounded-3xl blur-lg opacity-40 group-hover:opacity-75 transition duration-500"></div>
            <div className="relative rounded-3xl overflow-hidden border border-amber-500/40 bg-black-950 shadow-2xl">
              <img 
                src="/cmcred-loja.jpg" 
                alt="Fachada Loja CM CRED Lagarto SE" 
                className="w-full h-auto object-cover max-h-[520px] transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black-950 via-black-950/80 to-transparent p-6 text-center">
                <span className="inline-block bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-black uppercase tracking-widest px-3.5 py-1 rounded-full mb-1 shadow-lg">
                  📍 Rua Dr. Laudelino Freire, 243A — Centro
                </span>
                <p className="text-white font-orbitron font-bold text-sm">Lagarto / Sergipe</p>
              </div>
            </div>
          </div>

          {/* Right Column: Store Details & Action Cards */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* Main Location Box */}
            <div className="bg-black-850 p-6 md:p-8 rounded-3xl border border-amber-500/25 shadow-xl space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full mb-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Aberto para Atendimento
                  </div>
                  <h3 className="text-xl md:text-2xl font-orbitron font-black text-white">
                    CMCred Soluções Financeiras
                  </h3>
                  <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider">
                    Dinheiro com o limite do seu cartão
                  </p>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/30 text-amber-400 shrink-0">
                  <Sparkles size={24} className="text-yellow-400" />
                </div>
              </div>

              {/* Address Details */}
              <div className="space-y-3.5 pt-2 border-t border-white/5">
                <div className="flex items-start gap-3 text-gray-300 text-sm">
                  <div className="p-2 bg-black-900 rounded-xl border border-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                    <Navigation size={16} />
                  </div>
                  <div>
                    <p className="font-bold text-white">Endereço Completo:</p>
                    <p className="text-gray-300 text-xs md:text-sm">Rua Dr. Laudelino Freire, nº 243A — Centro</p>
                    <p className="text-amber-400 text-xs font-semibold">Lagarto / SE — CEP: 49400-000</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-gray-300 text-sm">
                  <div className="p-2 bg-black-900 rounded-xl border border-amber-500/20 text-amber-400 shrink-0">
                    <Phone size={16} />
                  </div>
                  <div>
                    <p className="font-bold text-white">WhatsApp & Ligação:</p>
                    <p className="text-amber-400 font-bold text-sm">(79) 99862-7907</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-gray-300 text-sm">
                  <div className="p-2 bg-black-900 rounded-xl border border-amber-500/20 text-pink-400 shrink-0">
                    <Instagram size={16} />
                  </div>
                  <div>
                    <p className="font-bold text-white">Instagram Oficial:</p>
                    <a 
                      href="https://instagram.com/cmcred_lagarto" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-pink-400 hover:text-pink-300 font-bold text-xs underline"
                    >
                      @cmcred_lagarto
                    </a>
                  </div>
                </div>
              </div>

              {/* Key Store Highlights Pills */}
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <div className="bg-black-900 p-2.5 rounded-xl border border-amber-500/15 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span className="text-[11px] font-bold text-gray-200">Cobrimos Qualquer Oferta</span>
                </div>
                <div className="bg-black-900 p-2.5 rounded-xl border border-amber-500/15 flex items-center gap-2">
                  <CreditCard size={16} className="text-yellow-400 shrink-0" />
                  <span className="text-[11px] font-bold text-gray-200">Em até 21x no Cartão</span>
                </div>
                <div className="bg-black-900 p-2.5 rounded-xl border border-amber-500/15 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-amber-400 shrink-0" />
                  <span className="text-[11px] font-bold text-gray-200">Segurança & Confiança</span>
                </div>
                <div className="bg-black-900 p-2.5 rounded-xl border border-amber-500/15 flex items-center gap-2">
                  <Clock size={16} className="text-blue-400 shrink-0" />
                  <span className="text-[11px] font-bold text-gray-200">PIX Liberado na Hora</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <a 
                  href="https://wa.me/5579998627907?text=Olá!%20Vi%20a%20loja%20da%20CM%20CRED%20no%20site%20e%20gostaria%20de%20fazer%20uma%20simulação."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-black-950 font-black py-3.5 px-6 rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] text-xs uppercase tracking-wider cursor-pointer"
                >
                  <MessageCircle size={18} /> Chamar no WhatsApp
                </a>
                <a 
                  href="https://www.google.com/maps/search/?api=1&query=Rua+Dr.+Laudelino+Freire,+243A+-+Centro,+Lagarto+-+SE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-black-900 border border-amber-500/30 hover:border-amber-400 text-white font-bold py-3.5 px-6 rounded-xl transition-all text-xs uppercase tracking-wider hover:bg-amber-500/10 cursor-pointer"
                >
                  <Navigation size={16} className="text-amber-400" /> Ver no Mapa
                </a>
              </div>

            </div>

          </div>

        </div>
      </div>
    </section>
  );
};

export default Locations;



