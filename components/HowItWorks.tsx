import React from 'react';
import { DollarSign, CreditCard, Clock, CheckSquare } from 'lucide-react';

const steps = [
  {
    id: 1,
    icon: <DollarSign size={36} />,
    title: 'Escolha o Valor',
    description: 'Defina quanto você precisa retirar do seu limite de crédito disponível.'
  },
  {
    id: 2,
    icon: <CreditCard size={36} />,
    title: 'Passe o Cartão',
    description: 'Realizamos a operação de forma ágil e 100% segura na maquininha ou link de pagamento.'
  },
  {
    id: 3,
    icon: <Clock size={36} />,
    title: 'Receba no PIX',
    description: 'O dinheiro cai direto na sua conta bancária imediatamente após a aprovação.'
  },
  {
    id: 4,
    icon: <CheckSquare size={36} />,
    title: 'Pague em até 18x',
    description: 'A fatura chega depois, parcelada com total controle e comodidade.'
  }
];

const HowItWorks: React.FC = () => {
  return (
    <section id="como-funciona" className="py-20 bg-black-900 relative">
      <div className="container mx-auto px-4 md:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-orbitron font-black text-white mb-4">
            COMO <span className="text-gradient-gold">FUNCIONA</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-sm md:text-base">
            Processo ágil, transparente e 100% seguro para você ter dinheiro na mão quando mais precisa.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step) => (
            <div 
              key={step.id}
              className="group relative bg-black-850/70 border border-amber-500/15 p-8 rounded-3xl hover:border-amber-500/50 transition-all duration-300 hover:-translate-y-2 shadow-xl"
            >
              {/* Number Background */}
              <div className="absolute top-4 right-4 text-5xl font-orbitron font-black text-white/5 group-hover:text-amber-500/10 transition-colors select-none">
                0{step.id}
              </div>

              <div className="mb-6 text-amber-400 group-hover:text-black-950 transition-colors bg-amber-500/10 w-16 h-16 rounded-2xl flex items-center justify-center group-hover:bg-gradient-to-r group-hover:from-amber-500 group-hover:to-yellow-500 group-hover:shadow-[0_0_20px_rgba(245,158,11,0.6)] duration-300 border border-amber-500/20">
                {step.icon}
              </div>

              <h3 className="text-lg font-bold text-white mb-3 font-orbitron group-hover:text-amber-400 transition-colors">
                {step.title}
              </h3>
              <p className="text-gray-400 text-xs md:text-sm leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;



