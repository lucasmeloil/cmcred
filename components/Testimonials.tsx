import React from 'react';
import { Quote, Star } from 'lucide-react';

const testimonials = [
  {
    id: 1,
    name: 'Carla Santos',
    location: 'Lagarto / SE',
    text: 'Recebi na hora via PIX e parcelei em 21x no cartão. O atendimento da CM CRED foi excelente, me explicaram tudo direitinho. Recomendo muito!',
    rating: 5
  },
  {
    id: 2,
    name: 'João Oliveira',
    location: 'Lagarto / SE',
    text: 'Fui na loja no centro de Lagarto e saí com o dinheiro na conta em 5 minutos. Cobriram a oferta de outra empresa e as taxas foram as menores!',
    rating: 5
  },
  {
    id: 3,
    name: 'Mariana Lima',
    location: 'Sergipe',
    text: 'Melhor taxa e suporte que encontrei. O processo é 100% seguro e transparente, o dinheiro cai na conta em minutos mesmo.',
    rating: 5
  }
];

const Testimonials: React.FC = () => {
  return (
    <section className="py-20 bg-black-900 relative border-t border-amber-500/10">
      <div className="container mx-auto px-4 md:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-orbitron font-black text-white mb-4">
            QUEM JÁ USOU, <span className="text-gradient-gold">APROVA</span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto text-sm md:text-base">
            Mais de centenas de clientes satisfeitos com o atendimento rápido e seguro da CM CRED.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t) => (
            <div key={t.id} className="bg-black-850 p-8 rounded-3xl border border-amber-500/15 relative hover:border-amber-500/40 hover:shadow-[0_5px_25px_rgba(245,158,11,0.15)] transition-all">
              <div className="absolute -top-4 left-8 bg-gradient-to-r from-amber-500 to-yellow-500 text-black-950 p-2.5 rounded-xl shadow-lg">
                <Quote size={20} fill="currentColor" />
              </div>

              <div className="flex gap-1 mb-4 mt-2">
                {[...Array(t.rating)].map((_, i) => (
                  <Star key={i} size={16} className="text-amber-400" fill="currentColor" />
                ))}
              </div>

              <p className="text-gray-300 mb-6 italic leading-relaxed text-sm">
                "{t.text}"
              </p>

              <div className="border-t border-white/5 pt-4">
                <p className="font-bold text-white font-orbitron text-sm">{t.name}</p>
                <p className="text-xs text-amber-400 font-semibold">{t.location}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;



