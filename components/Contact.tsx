import React, { useState } from 'react';
import { Send, MessageSquare } from 'lucide-react';

const Contact: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = `Olá! Me chamo *${formData.name}*.\nTelefone: ${formData.phone}\n\nMensagem: ${formData.message}\n\n_Enviado pelo site CM CRED._`;
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/5579998627907?text=${encoded}`, '_blank');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <section id="contato" className="py-20 bg-black-950 relative z-10 border-t border-amber-500/10">
      <div className="container mx-auto px-4 md:px-8">
        <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          
          <div>
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1 rounded-full text-amber-300 text-xs font-bold uppercase tracking-wider mb-4">
              <MessageSquare size={14} className="text-yellow-400" /> Atendimento Dedicado
            </div>
            <h2 className="text-3xl md:text-5xl font-orbitron font-black text-white mb-6 leading-tight">
              AINDA TEM <span className="text-gradient-gold">DÚVIDAS?</span>
            </h2>
            <p className="text-gray-400 mb-8 text-base md:text-lg leading-relaxed">
              Fale diretamente com nossa equipe especializada da <strong>CM CRED</strong>. Estamos prontos para te ajudar a conseguir o crédito que você precisa com as menores taxas.
            </p>
            <div className="bg-black-900 p-6 rounded-2xl border-l-4 border-amber-500 border border-amber-500/20 shadow-xl space-y-2">
              <h4 className="text-white font-bold mb-1 font-orbitron text-base text-gradient-gold">Informações de Atendimento</h4>
              <p className="text-gray-300 text-sm">📍 <strong>Loja Física:</strong> Rua Dr. Laudelino Freire, nº 243A — Centro, Lagarto/SE</p>
              <p className="text-gray-300 text-sm">🕒 <strong>Horário:</strong> Seg. a Sex. 08h às 18h | Sáb. 08h às 13h</p>
              <p className="text-amber-400 font-bold text-sm">📱 <strong>WhatsApp Oficial:</strong> (79) 99862-7907</p>
              <p className="text-pink-400 font-bold text-sm">📸 <strong>Instagram:</strong> @cmcred_lagarto</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-black-900 p-8 rounded-3xl border border-amber-500/20 shadow-2xl">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-amber-400 mb-2 uppercase tracking-widest">Nome Completo</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Seu nome"
                  className="w-full bg-black-950 border border-amber-500/20 rounded-xl px-5 py-4 text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder-gray-700 shadow-xl"
                  style={{ backgroundColor: '#050608', color: 'white' }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-amber-400 mb-2 uppercase tracking-widest">WhatsApp / Telefone</label>
                <input
                  type="tel"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="(79) 99862-7907"
                  className="w-full bg-black-950 border border-amber-500/20 rounded-xl px-5 py-4 text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder-gray-700 shadow-xl"
                  style={{ backgroundColor: '#050608', color: 'white' }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-amber-400 mb-2 uppercase tracking-widest">Sua Mensagem</label>
                <textarea
                  name="message"
                  rows={4}
                  required
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Como podemos te ajudar hoje?"
                  className="w-full bg-black-950 border border-amber-500/20 rounded-xl px-5 py-4 text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder-gray-700 shadow-xl resize-none"
                  style={{ backgroundColor: '#050608', color: 'white' }}
                ></textarea>
              </div>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-black-950 font-black py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] flex items-center justify-center gap-2 uppercase tracking-wider text-sm cursor-pointer"
              >
                <Send size={18} />
                FALAR COM A CM CRED NO WHATSAPP
              </button>
            </div>
          </form>

        </div>
      </div>
    </section>
  );
};

export default Contact;



