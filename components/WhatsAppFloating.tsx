import React, { useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

const WhatsAppFloating: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    intent: 'troca-limite',
    value: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const intentMap: Record<string, string> = {
      'troca-limite': 'Troca de limite do cartão de crédito',
      'fgts': 'Antecipação FGTS',
      'consignado': 'Empréstimo Consignado',
      'duvida': 'Tirar dúvidas',
      'parceria': 'Parceria comercial'
    };

    const message = `✨ *ATENDIMENTO CM CRED* ✨\n\n👤 *Nome:* ${formData.name}\n🎯 *Interesse:* ${intentMap[formData.intent]}\n💰 *Valor Estimado:* ${formData.value || 'A combinar'}\n\n_Olá! Gostaria de iniciar minha simulação com a CM CRED._`;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/5579998627907?text=${encoded}`, '_blank');
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-24 right-6 z-[60] flex flex-col items-end pointer-events-none">
      {/* Form Popup */}
      <div 
        className={`mb-4 w-72 bg-black-950 border border-amber-500/30 rounded-3xl shadow-[0_0_35px_rgba(245,158,11,0.25)] overflow-hidden transition-all duration-300 transform origin-bottom-right pointer-events-auto ${
          isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-0 opacity-0 translate-y-10 pointer-events-none'
        }`}
      >
        <div className="bg-black-900 p-5 flex flex-col border-b border-amber-500/15">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src="/cmcred-logo.png" alt="CMCred" className="w-12 h-auto object-contain" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm font-orbitron text-gradient-gold">CMCred</h4>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                  <span className="text-[10px] text-amber-300 font-semibold tracking-wider">Lagarto/SE • Online</span>
                </div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white transition-colors p-1">
              <X size={18} />
            </button>
          </div>
          <p className="text-gray-400 text-[11px] leading-relaxed">
            Olá! Somos especialistas em transformar limite de cartão em dinheiro na hora via PIX. Como podemos te ajudar?
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Seu Nome</label>
              <input
                type="text"
                placeholder="Ex: Carlos Mendes"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full bg-black-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-700 focus:ring-1 focus:ring-amber-500 outline-none transition-all text-xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">O que você precisa?</label>
              <select
                value={formData.intent}
                onChange={(e) => setFormData({...formData, intent: e.target.value})}
                className="w-full bg-black-900 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:ring-1 focus:ring-amber-500 outline-none transition-all text-xs appearance-none cursor-pointer"
              >
                <option value="troca-limite">Trocar Limite por Dinheiro (Cartão)</option>
                <option value="fgts">Saque Aniversário FGTS</option>
                <option value="consignado">Empréstimo Consignado</option>
                <option value="duvida">Tirar uma dúvida</option>
              </select>
            </div>

            {formData.intent === 'troca-limite' && (
              <div className="animate-fade-in">
                <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Valor aproximado (R$)</label>
                <input
                  type="text"
                  placeholder="Ex: 2.000,00"
                  value={formData.value}
                  onChange={(e) => setFormData({...formData, value: e.target.value})}
                  className="w-full bg-black-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-700 focus:ring-1 focus:ring-amber-500 outline-none transition-all text-xs"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-black-950 font-black py-3 rounded-xl transition-all shadow-[0_4px_15px_rgba(245,158,11,0.3)] hover:shadow-[0_6px_20px_rgba(245,158,11,0.5)] flex items-center justify-center gap-2 uppercase text-xs tracking-widest cursor-pointer"
          >
            Iniciar no WhatsApp
            <Send size={14} />
          </button>
        </form>
      </div>

      {/* Floating WhatsApp Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative group flex items-center justify-center w-16 h-16 bg-[#25D366] rounded-full shadow-[0_0_25px_rgba(37,211,102,0.5)] transition-all duration-300 hover:scale-110 active:scale-95 pointer-events-auto cursor-pointer"
        aria-label="WhatsApp CM CRED"
      >
        <div className="absolute inset-0 bg-[#25D366] rounded-full animate-ping opacity-25"></div>
        <div className="absolute inset-0 bg-[#25D366] rounded-full animate-pulse opacity-40"></div>
        
        <MessageCircle 
          size={36} 
          fill="white" 
          className="text-[#25D366] relative z-10" 
        />
        
        {!isOpen && (
          <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-black-900/90 backdrop-blur-sm text-white text-xs font-bold uppercase tracking-wide rounded-lg border border-amber-500/30 opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap shadow-xl">
            WhatsApp CM CRED
          </span>
        )}
      </button>
    </div>
  );
};

export default WhatsAppFloating;

