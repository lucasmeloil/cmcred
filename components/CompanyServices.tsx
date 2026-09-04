import React from 'react';
import {
  Users,
  RefreshCw,
  TrendingUp,
  HeartHandshake,
  MapPin,
  Phone,
  MessageCircle,
  Building2,
  BadgeCheck
} from 'lucide-react';

const CompanyServices: React.FC = () => {
  const services = [
    {
      id: 'cartao',
      title: 'Troca de Limite por Dinheiro',
      description: 'Transforme o limite do seu cartão de crédito em dinheiro na sua conta via PIX em até 21x.',
      icon: <TrendingUp size={28} className="text-amber-400" />,
      badge: 'Na Hora via PIX'
    },
    {
      id: 'consignado',
      title: 'Empréstimo Consignado INSS',
      description: 'As menores taxas do mercado com desconto direto no benefício para aposentados e pensionistas.',
      icon: <Users size={28} className="text-amber-400" />,
      badge: 'Menores Taxas'
    },
    {
      id: 'fgts',
      title: 'Saque Aniversário FGTS',
      description: 'Antecipe parcelas do seu FGTS retido sem consulta ao SPC/Serasa e receba via PIX em minutos.',
      icon: <RefreshCw size={28} className="text-amber-400" />,
      badge: 'Sem Burocracia'
    },
    {
      id: 'bpc-loas',
      title: 'Crédito BPC / LOAS',
      description: 'Linha exclusiva e facilitada para beneficiários do BPC/LOAS com agilidade e aprovação rápida.',
      icon: <HeartHandshake size={28} className="text-amber-400" />,
      badge: 'Aprovação Fácil'
    }
  ];

  return (
    <section id="servicos-oficiais" className="py-20 bg-gradient-to-b from-black-900 via-black-950 to-black-900 relative overflow-hidden border-t border-amber-500/10">
      {/* Glow Backdrops */}
      <div className="absolute top-1/3 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-0 w-96 h-96 bg-yellow-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="container mx-auto px-4 md:px-8 relative z-10">

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-4 py-1.5 rounded-full text-amber-300 text-xs font-black uppercase tracking-widest mb-4 backdrop-blur-sm shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <BadgeCheck size={16} className="text-yellow-400" /> Soluções Financeiras Oficiais
          </div>
          <h2 className="text-3xl md:text-5xl font-orbitron font-black text-white leading-tight mb-4">
            A Solução que Você Precisa, <br className="hidden sm:inline" />
            <span className="text-gradient-gold">
              com a Confiança que Você Merece!
            </span>
          </h2>
          <p className="text-gray-400 text-base md:text-lg">
            A <strong className="text-white">CM CRED</strong> é especialista em crédito rápido, liberação no cartão de crédito, consignado e antecipação com taxas justas e atendimento ágil.
          </p>
        </div>

        {/* Content Grid: Facade Showcase + Core Service Cards */}
        <div className="grid lg:grid-cols-12 gap-8 items-center max-w-6xl mx-auto mb-16">

          {/* Left Column: Official Transparent Logo Card */}
          <div className="lg:col-span-5 relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 rounded-3xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
            <div className="relative rounded-3xl overflow-hidden border border-amber-500/30 bg-black-950 p-8 shadow-2xl flex flex-col items-center justify-center text-center">
              <div className="relative w-full max-w-[280px] flex items-center justify-center mb-6 py-4">
                <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-2xl"></div>
                <img
                  src="/cmcred-logo.png"
                  alt="CMCred Soluções Financeiras"
                  className="w-full h-auto object-contain drop-shadow-[0_0_25px_rgba(245,158,11,0.5)] transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <h3 className="text-xl font-orbitron font-black text-gradient-gold mb-1">
                Dinheiro com o Limite do Cartão
              </h3>
              <p className="text-gray-300 text-xs uppercase tracking-widest font-semibold mb-4">
                Temos as Melhores Taxas da Região!
              </p>
              <div className="w-full bg-black-900 border border-amber-500/20 rounded-xl p-3 text-center space-y-1">
                <p className="text-amber-400 text-xs font-bold flex items-center justify-center gap-1.5">
                  <Phone size={14} /> Atendimento Oficial: (79) 99862-7907
                </p>
                <p className="text-gray-400 text-[11px]">
                  Rua Dr. Laudelino Freire, 243A — Centro, Lagarto/SE
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: 4 Featured Services */}
          <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
            {services.map((item) => (
              <div
                key={item.id}
                className="bg-black-900/90 hover:bg-black-850 border border-amber-500/20 hover:border-amber-500/50 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 group relative overflow-hidden shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 group-hover:bg-amber-500/20 transition-colors">
                      {item.icon}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-full">
                      {item.badge}
                    </span>
                  </div>

                  <h3 className="text-base font-orbitron font-bold text-white mb-2 group-hover:text-amber-400 transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-gray-400 text-xs leading-relaxed mb-4">
                    {item.description}
                  </p>
                </div>

                <a
                  href={`https://wa.me/5579998627907?text=${encodeURIComponent(`Olá! Gostaria de mais informações sobre ${item.title} na CM CRED.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 hover:text-yellow-300 uppercase tracking-wider pt-2 border-t border-white/5"
                >
                  <MessageCircle size={14} /> Simular no WhatsApp →
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Contact Banner */}
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-black-950 via-black-900 to-black-950 border border-amber-500/30 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-center md:text-left">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mx-auto md:mx-0 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
              <Phone size={28} className="text-yellow-400" />
            </div>
            <div>
              <h4 className="text-white font-orbitron font-bold text-lg text-gradient-gold">Central de Atendimento Oficial</h4>
              <p className="text-gray-400 text-xs md:text-sm">Fale diretamente com a equipe CM CRED pelo WhatsApp:</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 w-full md:w-auto">
            <a
              href="https://wa.me/5579998627907"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-black-950 font-black px-6 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] flex items-center gap-2 text-xs md:text-sm uppercase tracking-wider"
            >
              <MessageCircle size={18} /> (79) 99862-7907
            </a>
          </div>
        </div>

      </div>
    </section>
  );
};

export default CompanyServices;

