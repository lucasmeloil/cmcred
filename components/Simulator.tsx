import React, { useState, useEffect, useMemo } from 'react';
import { Send, Calculator, TrendingUp, Wallet, AlertCircle, Edit3, CheckCircle2 } from 'lucide-react';
import {
  getCustomCardFlags,
  calculateLoanSimulation,
  fetchRatesFromDatabase,
  buildWhatsAppSimulationMessage,
  type CardFlagOption,
  type RateTableType
} from '../lib/rates';

const Simulator: React.FC = () => {
  const [flags, setFlags] = useState<CardFlagOption[]>(getCustomCardFlags());
  const tabelaTaxa: RateTableType = 'tabela_2';
  const [tipoCalculo, setTipoCalculo] = useState<'Valor Líquido' | 'Valor Bruto'>('Valor Líquido');
  const [service, setService] = useState<string>('troca-limite');
  const [amount, setAmount] = useState<number>(1000);
  const [installments, setInstallments] = useState<number>(10);
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [selectedFlagKey, setSelectedFlagKey] = useState<string>('VISA_MASTER');

  useEffect(() => {
    fetchRatesFromDatabase().then(({ flags: dbFlags }) => {
      if (dbFlags && dbFlags.length > 0) {
        setFlags(dbFlags);
      }
    });

    const handleUpdate = () => {
      setFlags(getCustomCardFlags());
    };
    window.addEventListener('cmcred_rates_updated', handleUpdate);
    window.addEventListener('cmcred_flags_updated', handleUpdate);
    window.addEventListener('bonuscred_rates_updated', handleUpdate);
    window.addEventListener('bonuscred_flags_updated', handleUpdate);
    return () => {
      window.removeEventListener('cmcred_rates_updated', handleUpdate);
      window.removeEventListener('cmcred_flags_updated', handleUpdate);
      window.removeEventListener('bonuscred_rates_updated', handleUpdate);
      window.removeEventListener('bonuscred_flags_updated', handleUpdate);
    };
  }, []);

  // Cálculos dinâmicos com base na matriz de taxas CM CRED
  const simulation = useMemo(() => {
    return calculateLoanSimulation({
      valorDesejado: amount,
      parcelas: installments,
      tipoCalculo: tipoCalculo,
      bandeiraCartao: selectedFlagKey,
      tableType: tabelaTaxa
    });
  }, [amount, installments, selectedFlagKey, tipoCalculo, tabelaTaxa, flags]);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const selectedFlagObj = flags.find(f => f.key === selectedFlagKey) || flags[0] || { name: 'VISA / MASTER' };

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();

    let message = buildWhatsAppSimulationMessage({
      valorSolicitado: simulation.valorSolicitado,
      valorTotal: simulation.valorTotal,
      parcelas: installments,
      valorParcela: simulation.valorParcela,
      bandeira: selectedFlagObj.name
    });

    if (name || phone) {
      message += `\n\n` +
        (name ? `👤 *Cliente:* ${name}\n` : '') +
        (phone ? `📱 *WhatsApp:* ${phone}\n` : '') +
        `Olá! Gostaria de dar andamento nessa simulação com a CM CRED.`;
    }

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=5579998627907&text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');
  };

  return (
    <section id="simulador" className="py-20 bg-black-950 relative overflow-hidden scroll-mt-20 z-10">
      {/* Background Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[100%] bg-amber-500/5 rotate-12 blur-[120px] pointer-events-none"></div>

      <div className="container mx-auto px-4 md:px-8 relative z-10">
        <div className="max-w-6xl mx-auto bg-black-850 border border-amber-500/20 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-amber-500/10">
          <div className="grid lg:grid-cols-2">

            {/* Left Side: Result Card */}
            <div className="p-6 md:p-10 bg-gradient-to-br from-black-950 via-black-900 to-black-850 flex flex-col justify-center relative border-b lg:border-b-0 lg:border-r border-amber-500/15 order-1">

              <div className="flex items-center gap-3 mb-6 text-amber-400">
                <div className="bg-amber-500/15 p-2.5 rounded-xl border border-amber-500/30">
                  <Calculator size={24} className="text-yellow-400" />
                </div>
                <span className="font-orbitron font-bold text-xs md:text-sm tracking-widest uppercase text-gradient-gold">
                  Simulador Oficial CM CRED
                </span>
              </div>

              <h2 className="text-2xl md:text-4xl font-bold text-white mb-2 font-orbitron leading-tight">
                Simule seu <span className="text-gradient-gold">Empréstimo</span>
              </h2>
              <p className="text-gray-400 mb-8 text-sm md:text-base leading-relaxed">
                Veja exatamente quanto você recebe no PIX e quanto vai pagar. Transparência total.
              </p>

              {/* Live Result Card */}
              <div className="relative group">
                {/* Glow Effect */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 rounded-2xl opacity-30 blur transition duration-500 group-hover:opacity-50"></div>

                <div className="relative bg-black-950 rounded-2xl p-6 md:p-8 border border-amber-500/30">

                  {/* Badge */}
                  <div className="absolute -top-3 right-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-black-950 text-[10px] md:text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider shadow-lg ring-2 ring-black flex items-center gap-1.5">
                    <CheckCircle2 size={12} /> {tipoCalculo} (Tabela Flex)
                  </div>

                  <div className="space-y-6">
                    {/* Valor a Receber */}
                    <div className="border-b border-white/10 pb-6">
                      <span className="text-gray-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2 mb-2">
                        <Wallet size={16} className="text-amber-400" />
                        Valor no seu PIX (Liberado na Hora)
                      </span>
                      <p className="text-3xl sm:text-4xl md:text-5xl font-black text-white font-orbitron tracking-tight truncate text-gradient-gold">
                        {formatCurrency(simulation.valorSolicitado)}
                      </p>
                      <p className="text-emerald-400 text-xs font-bold mt-1 uppercase tracking-wider flex items-center gap-1">
                        ✓ Disponível em Minutos na sua conta
                      </p>
                    </div>

                    {/* Parcelas */}
                    <div>
                      <span className="text-gray-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2 mb-3">
                        <TrendingUp size={16} className="text-amber-400" />
                        Parcelamento no Cartão
                      </span>

                      <div className="bg-black-900 p-4 rounded-xl border border-amber-500/20 flex flex-col items-center text-center">
                        <p className="text-xs text-gray-400 mb-1 font-medium">Você pagará na fatura:</p>
                        <p className="text-2xl md:text-3xl font-black text-white font-orbitron">
                          <span className="text-amber-400">{installments}x</span> de <span className="text-white">{formatCurrency(simulation.valorParcela)}</span>
                        </p>
                      </div>

                      <div className="mt-4 flex items-start gap-3 text-[11px] md:text-xs text-gray-400 bg-black-900/60 p-3 rounded-lg border border-white/5">
                        <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-400" />
                        <p>Total a ser passado no cartão: <span className="text-gray-200 font-bold">{formatCurrency(simulation.valorTotal)}</span>.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side: Form */}
            <div className="p-6 md:p-10 bg-black-900/70 backdrop-blur-sm flex flex-col justify-center order-2">
              <form onSubmit={handleSimulate} className="space-y-5 md:space-y-6">


                {/* Tipo de Cálculo: Líquido ou Bruto */}
                <div>
                  <label className="block text-xs font-black text-amber-400 mb-2 uppercase tracking-widest">
                    Tipo de Cálculo
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-black-950 p-1.5 rounded-xl border border-amber-500/30">
                    <button
                      type="button"
                      onClick={() => setTipoCalculo('Valor Líquido')}
                      className={`py-3 px-3 rounded-lg font-bold text-xs md:text-sm tracking-wide transition-all ${tipoCalculo === 'Valor Líquido'
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black-950 shadow-md font-black'
                          : 'text-gray-400 hover:text-white'
                        }`}
                    >
                      💵 Valor Desejado
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoCalculo('Valor Bruto')}
                      className={`py-3 px-3 rounded-lg font-bold text-xs md:text-sm tracking-wide transition-all ${tipoCalculo === 'Valor Bruto'
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black-950 shadow-md font-black'
                          : 'text-gray-400 hover:text-white'
                        }`}
                    >
                      💳 Valor no Cartão
                    </button>
                  </div>
                </div>

                {/* Service Selection */}
                <div>
                  <label className="block text-xs font-black text-amber-400 mb-2 uppercase tracking-widest">Tipo de Serviço</label>
                  <select
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    className="w-full bg-black-950 border border-amber-500/30 rounded-xl px-5 py-3 text-white text-base md:text-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all appearance-none cursor-pointer shadow-2xl"
                    style={{ backgroundColor: '#050608', color: 'white' }}
                  >
                    <option value="troca-limite">Trocar Limite por Dinheiro (Cartão de Crédito)</option>
                    <option value="fgts">Antecipação Saque-Aniversário FGTS</option>
                    <option value="consignado">Empréstimo Consignado (INSS / Servidores)</option>
                    <option value="outros">Outras Soluções Financeiras</option>
                  </select>
                </div>

                {/* Bandeira Selection */}
                {service === 'troca-limite' && (
                  <div className="animate-fade-in">
                    <label className="block text-xs font-black text-amber-400 mb-2 uppercase tracking-widest">Bandeira do Cartão</label>
                    <select
                      value={selectedFlagKey}
                      onChange={(e) => setSelectedFlagKey(e.target.value)}
                      className="w-full bg-black-950 border border-amber-500/30 rounded-xl px-5 py-3.5 text-white text-base md:text-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all appearance-none cursor-pointer shadow-2xl"
                      style={{ backgroundColor: '#050608', color: 'white' }}
                    >
                      {flags.map(f => (
                        <option key={f.key} value={f.key} className="bg-black text-white">
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Input Amount Section */}
                <div className="bg-black-950 p-5 md:p-6 rounded-2xl border border-amber-500/20 shadow-inner">
                  <label className="flex items-center justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">
                    <span>{tipoCalculo === 'Valor Líquido' ? 'Valor Desejado (Passar no Cartão)' : 'Valor Desejado (Receber no PIX)'}</span>
                    <Edit3 size={14} className="text-amber-400" />
                  </label>

                  {/* Manual Input */}
                  <div className="relative mb-6">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-amber-400 font-bold text-xl md:text-2xl z-10">R$</span>
                    <input
                      type="number"
                      min="0"
                      max="100000"
                      step="10"
                      value={amount === 0 ? '' : amount}
                      onChange={(e) => {
                        let val = parseFloat(e.target.value);
                        if (isNaN(val)) val = 0;
                        if (val > 100000) val = 100000;
                        setAmount(val);
                      }}
                      className="w-full bg-black-900 border border-amber-500/30 rounded-xl pl-16 pr-4 py-4 md:py-4 text-[#ffffff] text-2xl md:text-3xl font-orbitron font-black focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder-gray-800 shadow-2xl"
                      style={{ backgroundColor: '#0a0b0e', color: 'white' }}
                      placeholder="0,00"
                    />
                  </div>

                  {/* Slider */}
                  <div className="px-1">
                    <input
                      type="range"
                      min="100"
                      max="100000"
                      step="100"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="w-full h-2 bg-black-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500 mt-3 font-bold uppercase tracking-wider">
                      <span>Min: R$ 100</span>
                      <span>Max: R$ 100.000</span>
                    </div>
                  </div>
                </div>

                {/* Installments Select (Only for Troca de Limite) */}
                {service === 'troca-limite' && (
                  <div className="animate-fade-in">
                    <label className="block text-xs font-black text-amber-400 mb-2 uppercase tracking-widest">Número de Parcelas (1 a 21x)</label>
                    <div className="relative">
                      <select
                        value={installments}
                        onChange={(e) => setInstallments(Number(e.target.value))}
                        className="w-full bg-black-950 border border-amber-500/30 rounded-xl px-5 py-3.5 text-white text-base md:text-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all appearance-none cursor-pointer shadow-2xl"
                        style={{ backgroundColor: '#050608', color: 'white' }}
                      >
                        {Array.from({ length: 18 }, (_, i) => i + 1).map((inst) => {
                          const calc = calculateLoanSimulation({
                            valorDesejado: amount,
                            parcelas: inst,
                            tipoCalculo: tipoCalculo,
                            bandeiraCartao: selectedFlagKey,
                            tableType: tabelaTaxa
                          });
                          return (
                            <option key={inst} value={inst} className="bg-black text-white">
                              {inst}x de {formatCurrency(calc.valorParcela)}
                            </option>
                          );
                        })}
                      </select>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-amber-400">
                        <TrendingUp size={22} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Personal Data */}
                <div className="space-y-4 pt-3 border-t border-white/5">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Seu Nome Completo (Opcional)</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nome Completo"
                      className="w-full bg-black-950 border border-white/10 rounded-xl px-5 py-3.5 text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder-gray-700"
                      style={{ backgroundColor: '#050608', color: 'white' }}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">WhatsApp com DDD (Opcional)</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(79) 99862-7907"
                      className="w-full bg-black-950 border border-white/10 rounded-xl px-5 py-3.5 text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder-gray-700"
                      style={{ backgroundColor: '#050608', color: 'white' }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-black-950 font-black py-4 md:py-4.5 rounded-xl shadow-[0_0_25px_rgba(245,158,11,0.45)] hover:shadow-[0_0_35px_rgba(245,158,11,0.7)] transition-all transform active:scale-95 flex items-center justify-center gap-3 uppercase tracking-wider text-base md:text-lg group mt-3 cursor-pointer"
                >
                  <Send size={20} strokeWidth={3} className="group-hover:-translate-y-0.5 group-hover:translate-x-1 transition-transform" />
                  SIMULAR NO WHATSAPP
                </button>
              </form>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};

export default Simulator;

