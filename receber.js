// JS/modules/receber.js
import { supabase } from './config.js';

window.dadosReceberGerais = [];
window.abaReceberAtual = 'Pendente'; 
window.vigilanciaReceberAtiva = false; 

// =========================================================================
// 1. CARREGAMENTO E VIGILÂNCIA REALTIME
// =========================================================================

window.ativarVigilanciaReceber = function() {
    if (window.vigilanciaReceberAtiva) return;
    window.vigilanciaReceberAtiva = true;

    supabase.channel('vigilancia-receber')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'contas_receber' }, payload => {
            const tbody = document.getElementById('tabela-dados-receber');
            if (tbody) {
                console.log('📡 [Tesouraria] Atualização detectada! Atualizando painel...');
                window.carregarContasReceber(true); 
            }
        })
        .subscribe();
};

window.carregarContasReceber = async function(isSilencioso = false) {
    const tbody = document.getElementById('tabela-dados-receber');
    if (!tbody) return;

    if (!isSilencioso) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-gray-400 font-bold italic">Sincronizando com o cofre...</td></tr>';
    }

    window.ativarVigilanciaReceber(); 

    try {
        // A Mágica da Ref. OS: Puxamos a tabela ordens_servico junto para pegar o numero_os real
        const { data, error } = await supabase
            .from('contas_receber')
            .select('*, ordens_servico(numero_os)')
            .order('vencimento', { ascending: true }); 

        if (error) throw error;
        
        window.dadosReceberGerais = data || [];
        window.renderizarReceber();

    } catch (err) {
        console.error("ERRO AO CARREGAR FINANCEIRO:", err);
        if (!isSilencioso) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-red-500 font-bold">Erro ao carregar dados financeiros. Verifique a conexão.</td></tr>';
        }
    }
};

// =========================================================================
// 2. NAVEGAÇÃO E MOTOR DE RENDERIZAÇÃO
// =========================================================================

window.mudarAbaReceber = function(status) {
    window.abaReceberAtual = status;
    const btnPendente = document.getElementById('btn-tab-pendente');
    const btnRecebido = document.getElementById('btn-tab-recebido');

    if (status === 'Pendente') {
        btnPendente.className = "flex-1 sm:flex-initial px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 bg-[#1a428a] text-white shadow-sm";
        btnRecebido.className = "flex-1 sm:flex-initial px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white bg-transparent";
    } else {
        btnRecebido.className = "flex-1 sm:flex-initial px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 bg-[#1a428a] text-white shadow-sm";
        btnPendente.className = "flex-1 sm:flex-initial px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white bg-transparent";
    }
    
    window.renderizarReceber();
};

window.renderizarReceber = function() {
    const tbody = document.getElementById('tabela-dados-receber');
    if (!tbody) return;

    const textoBusca = (document.getElementById('filtro-busca-receber')?.value || '').toLowerCase().trim();
    const contaFiltro = document.getElementById('filtro-conta-receber')?.value || 'TODAS';

    let totalPendente = 0;
    let totalRecebido = 0;

    window.dadosReceberGerais.forEach(conta => {
        if (contaFiltro === 'TODAS' || conta.conta_destino === contaFiltro) {
            if (conta.status === 'Pendente') totalPendente += Number(conta.valor);
            if (conta.status === 'Recebido') totalRecebido += Number(conta.valor);
        }
    });

    const elPendente = document.getElementById('card-total-pendente');
    const elRecebido = document.getElementById('card-total-recebido');
    if(elPendente) elPendente.innerText = `R$ ${totalPendente.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    if(elRecebido) elRecebido.innerText = `R$ ${totalRecebido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

    let dadosFiltrados = window.dadosReceberGerais.filter(conta => {
        const bateAba = conta.status === window.abaReceberAtual;
        const bateConta = (contaFiltro === 'TODAS' || conta.conta_destino === contaFiltro);
        
        let bateTexto = true;
        if (textoBusca) {
            const cliente = String(conta.cliente || '').toLowerCase();
            const placa = String(conta.placa || '').toLowerCase();
            // Resolve busca pelo número real da OS ou ID
            const osReal = conta.ordens_servico?.numero_os || conta.os_id || '';
            const osIdStr = String(osReal).toLowerCase();
            
            bateTexto = cliente.includes(textoBusca) || placa.includes(textoBusca) || osIdStr.includes(textoBusca);
        }

        return bateAba && bateConta && bateTexto;
    });

    if (dadosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-gray-400 font-bold italic">Nenhum lançamento ${window.abaReceberAtual.toLowerCase()} encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = dadosFiltrados.map(conta => {
        
        // Puxa o número oficial da O.S (se existir) ou cai para o ID
        const numeroRealOs = conta.ordens_servico?.numero_os || conta.os_id || '---';
        const numOs = String(numeroRealOs).padStart(4, '0');
        
        const placaFmt = String(conta.placa || '---');
        const clienteFmt = String(conta.cliente || 'CLIENTE AVULSO');
        const valorFmt = Number(conta.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2});
        
        // Inteligência Visual de Vencimentos
        let dataFormatada = '---';
        let statusVencimentoVisual = '<span class="text-gray-600 dark:text-gray-400">---</span>';

        if (conta.vencimento) {
            const hoje = new Date();
            hoje.setHours(0,0,0,0);
            
            const dataVenc = new Date(conta.vencimento);
            dataVenc.setMinutes(dataVenc.getMinutes() + dataVenc.getTimezoneOffset());
            dataVenc.setHours(0,0,0,0);
            
            dataFormatada = dataVenc.toLocaleDateString('pt-BR');
            
            if (conta.status === 'Pendente') {
                const diffTime = dataVenc - hoje;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 0) {
                    statusVencimentoVisual = `<span class="text-red-600 dark:text-red-400 font-black animate-pulse flex items-center justify-center gap-1">🚨 ${dataFormatada}</span><span class="text-[9px] text-red-500 block uppercase">Atrasado</span>`;
                } else if (diffDays === 0) {
                    statusVencimentoVisual = `<span class="text-amber-600 dark:text-amber-500 font-black flex items-center justify-center gap-1">⚠️ ${dataFormatada}</span><span class="text-[9px] text-amber-500 block uppercase">Vence Hoje</span>`;
                } else if (diffDays <= 3) {
                    statusVencimentoVisual = `<span class="text-orange-500 dark:text-orange-400 font-bold flex items-center justify-center gap-1">⚠️ ${dataFormatada}</span><span class="text-[9px] text-orange-400 block uppercase">Vence em ${diffDays} dias</span>`;
                } else {
                    statusVencimentoVisual = `<span class="text-gray-700 dark:text-gray-300 font-bold">${dataFormatada}</span>`;
                }
            } else {
                statusVencimentoVisual = `<span class="text-gray-500 font-bold">${dataFormatada}</span>`;
            }
        }

        // Lógica de Botão de Ação Tática
        let btnAcao = '';
        if (conta.status === 'Pendente') {
            // Repare no "this" passado na função. É a chave do efeito de congelamento.
            btnAcao = `
                <button onclick="window.darBaixaReceber(${conta.id}, '${numOs}', this)" class="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black uppercase rounded-lg shadow-sm transition-all duration-150 flex items-center justify-center gap-1">
                    Dar Baixa
                </button>
            `;
        } else {
            btnAcao = `
                <button onclick="window.estornarReceber(${conta.id}, this)" class="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-[11px] font-black uppercase rounded-lg shadow-sm transition-all duration-150 flex items-center justify-center gap-1">
                    Estornar
                </button>
            `;
        }

        return `
            <tr class="hover:bg-gray-50 dark:hover:bg-[#0f172a] transition-all duration-150 border-b border-gray-200 dark:border-gray-800">
                <td class="p-4 text-center">
                    <span class="text-sm font-black text-gray-500 dark:text-gray-400">#${numOs}</span>
                    <span class="block text-[9px] font-bold text-gray-400 uppercase mt-0.5">Parc: ${conta.numero_parcela}</span>
                </td>
                <td class="p-4">
                    <span class="font-bold text-gray-800 dark:text-white text-xs uppercase block truncate max-w-[200px]" title="${clienteFmt}">${clienteFmt}</span>
                </td>
                <td class="p-4 text-center font-black text-[#1a428a] dark:text-blue-400 text-sm tracking-widest">${placaFmt}</td>
                <td class="p-4 text-center font-mono">
                    ${statusVencimentoVisual}
                </td>
                <td class="p-4 text-center">
                    <span class="block text-xs font-black text-gray-700 dark:text-gray-300 uppercase">${conta.operacao}</span>
                    <span class="block text-[10px] text-gray-500 mt-0.5">${conta.conta_destino}</span>
                </td>
                <td class="p-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">R$ ${valorFmt}</td>
                <td class="p-4 text-center align-middle">${btnAcao}</td>
            </tr>
        `;
    }).join('');
};

// =========================================================================
// 3. AÇÕES DE TESOURARIA COM FEEDBACK VISUAL (CONGELAMENTO)
// =========================================================================

window.darBaixaReceber = async function(id, numOs, btnElement) {
    const confirmou = await window.abrirConfirmacao("Confirmar Recebimento", `Deseja dar baixa na parcela da O.S #${numOs}?`, "sucesso");
    if (!confirmou) return;

    // 🔴 O SUPERPODER DO CONGELAMENTO VISUAL 🔴
    if (btnElement) {
        // Muda o botão para estado de processamento
        btnElement.innerHTML = `<svg class="animate-spin h-3 w-3 text-white inline-block mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> AGUARDE...`;
        btnElement.classList.add('opacity-70', 'cursor-not-allowed');
        btnElement.disabled = true;
        
        // Pinta a linha inteira de verde para confirmar a ação no cérebro do usuário
        const tr = btnElement.closest('tr');
        if (tr) tr.classList.add('bg-emerald-50', 'dark:bg-emerald-900/20');
    }

    try {
        const { error } = await supabase.from('contas_receber').update({ status: 'Recebido' }).eq('id', id);
        if (error) throw error;
        
        if (window.mostrarToast) window.mostrarToast("Recebimento confirmado!", "sucesso");
        
        // Mantém a tela "congelada" por 800ms antes de recarregar e remover a linha
        setTimeout(() => {
            window.carregarContasReceber(true); 
        }, 800);

    } catch (err) {
        console.error("ERRO AO DAR BAIXA:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao confirmar recebimento.", "erro");
        
        // Reverte o visual se der erro
        if (btnElement) {
            btnElement.innerHTML = 'Dar Baixa';
            btnElement.disabled = false;
            btnElement.classList.remove('opacity-70', 'cursor-not-allowed');
            const tr = btnElement.closest('tr');
            if (tr) tr.classList.remove('bg-emerald-50', 'dark:bg-emerald-900/20');
        }
    }
};

window.estornarReceber = async function(id, btnElement) {
    const confirmou = await window.abrirConfirmacao("Estornar Parcela", "Deseja remover do cofre e voltar a parcela para PENDENTE?", "perigo");
    if (!confirmou) return;

    if (btnElement) {
        btnElement.innerHTML = `<svg class="animate-spin h-3 w-3 text-white inline-block mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> AGUARDE...`;
        btnElement.classList.add('opacity-70', 'cursor-not-allowed');
        btnElement.disabled = true;
        const tr = btnElement.closest('tr');
        if (tr) tr.classList.add('bg-red-50', 'dark:bg-red-900/20');
    }

    try {
        const { error } = await supabase.from('contas_receber').update({ status: 'Pendente' }).eq('id', id);
        if (error) throw error;
        
        if (window.mostrarToast) window.mostrarToast("Estorno realizado com sucesso!", "info");
        
        setTimeout(() => {
            window.carregarContasReceber(true); 
        }, 800);

    } catch (err) {
        console.error("ERRO AO ESTORNAR:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao realizar o estorno.", "erro");
        
        if (btnElement) {
            btnElement.innerHTML = 'Estornar';
            btnElement.disabled = false;
            btnElement.classList.remove('opacity-70', 'cursor-not-allowed');
            const tr = btnElement.closest('tr');
            if (tr) tr.classList.remove('bg-red-50', 'dark:bg-red-900/20');
        }
    }
};
