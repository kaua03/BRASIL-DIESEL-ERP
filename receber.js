// JS/modules/receber.js
import { supabase } from './config.js';

window.dadosReceberGerais = [];
window.abaReceberAtual = 'Pendente'; 
window.vigilanciaReceberAtiva = false; 

// Sistema de Memória para Múltiplas Exclusões
window.receberIdsSelecionados = new Set();
window.receberIdsFiltradosTela = []; 

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
        tbody.innerHTML = '<tr><td colspan="8" class="text-center p-8 text-gray-400 font-bold italic">Sincronizando com o cofre...</td></tr>';
    }

    window.ativarVigilanciaReceber(); 

    try {
        // Puxa também a tabela de ordens_servico para mostrar o N° correto da O.S.
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
            tbody.innerHTML = '<tr><td colspan="8" class="text-center p-8 text-red-500 font-bold">Erro ao carregar dados financeiros. Verifique a conexão.</td></tr>';
        }
    }
};

// =========================================================================
// 2. NAVEGAÇÃO E MOTOR DE RENDERIZAÇÃO
// =========================================================================

window.mudarAbaReceber = function(status) {
    window.abaReceberAtual = status;
    window.receberIdsSelecionados.clear(); // Limpa as caixas de seleção ao mudar de aba
    
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

    // Totais Gerais dos Cartões (Ignoram a busca de texto)
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

    // Filtragem para a Tabela
    let dadosFiltrados = window.dadosReceberGerais.filter(conta => {
        const bateAba = conta.status === window.abaReceberAtual;
        const bateConta = (contaFiltro === 'TODAS' || conta.conta_destino === contaFiltro);
        
        let bateTexto = true;
        if (textoBusca) {
            const cliente = String(conta.cliente || '').toLowerCase();
            const placa = String(conta.placa || '').toLowerCase();
            const osReal = conta.ordens_servico?.numero_os || conta.os_id || '';
            const osIdStr = String(osReal).padStart(4, '0').toLowerCase();
            
            bateTexto = cliente.includes(textoBusca) || placa.includes(textoBusca) || osIdStr.includes(textoBusca);
        }

        return bateAba && bateConta && bateTexto;
    });

    // Atualiza a memória de seleção para o checkbox "Selecionar Todos"
    window.receberIdsFiltradosTela = dadosFiltrados.map(c => c.id);
    window.atualizarInterfaceExclusaoMassa();

    if (dadosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center p-8 text-gray-400 font-bold italic">Nenhum lançamento ${window.abaReceberAtual.toLowerCase()} encontrado.</td></tr>`;
        return;
    }

    // Desenha as Linhas
    tbody.innerHTML = dadosFiltrados.map(conta => {
        
        const numeroRealOs = conta.ordens_servico?.numero_os || conta.os_id || '---';
        const numOs = String(numeroRealOs).padStart(4, '0');
        const placaFmt = String(conta.placa || '---');
        const clienteFmt = String(conta.cliente || 'CLIENTE AVULSO');
        const valorFmt = Number(conta.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2});
        
        // 🔴 MOTOR VISUAL DE ALERTAS DE VENCIMENTO 🔴
        let dataFormatada = '---';
        let statusVencimentoVisual = '<span class="text-gray-600 dark:text-gray-400">---</span>';

        if (conta.vencimento) {
            const hoje = new Date();
            hoje.setHours(0,0,0,0);
            
            const [anoVenc, mesVenc, diaVenc] = conta.vencimento.split('-');
            const dataVenc = new Date(anoVenc, mesVenc - 1, diaVenc); 
            
            dataFormatada = dataVenc.toLocaleDateString('pt-BR');
            
            if (conta.status === 'Pendente') {
                const diffTime = dataVenc.getTime() - hoje.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 0) {
                    statusVencimentoVisual = `<span class="text-red-600 dark:text-red-400 font-black animate-pulse flex items-center justify-center gap-1">🚨 ${dataFormatada}</span><span class="text-[9px] text-red-500 block uppercase">Atrasado</span>`;
                } else if (diffDays === 0) {
                    statusVencimentoVisual = `<span class="text-orange-600 dark:text-orange-500 font-black flex items-center justify-center gap-1">⚠️ ${dataFormatada}</span><span class="text-[9px] text-orange-500 block uppercase">Vence Hoje</span>`;
                } else if (diffDays <= 3) {
                    statusVencimentoVisual = `<span class="text-amber-500 dark:text-amber-400 font-bold flex items-center justify-center gap-1">⚠️ ${dataFormatada}</span><span class="text-[9px] text-amber-500 block uppercase">Vence em ${diffDays} d</span>`;
                } else {
                    statusVencimentoVisual = `<span class="text-gray-700 dark:text-gray-300 font-bold">${dataFormatada}</span>`;
                }
            } else {
                statusVencimentoVisual = `<span class="text-gray-500 font-bold">${dataFormatada}</span>`;
            }
        }

        // Botoes Táticos (Baixa e Exclusão)
        let btnBaixa = '';
        if (conta.status === 'Pendente') {
            btnBaixa = `<button onclick="window.darBaixaReceber(${conta.id}, '${numOs}', this)" class="px-3 py-1.5 bg-[#00b87c] hover:bg-emerald-600 text-white text-[10px] font-black uppercase rounded shadow-sm transition-all duration-150">Dar Baixa</button>`;
        } else {
            btnBaixa = `<button onclick="window.estornarReceber(${conta.id}, this)" class="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white text-[10px] font-black uppercase rounded shadow-sm transition-all duration-150">Estornar</button>`;
        }

        const btnExcluirIndiv = `
            <button onclick="window.excluirContaReceberIndividual(${conta.id}, '${numOs}', this)" class="px-2 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-800/50 text-red-600 dark:text-red-400 rounded transition-all duration-150" title="Apagar Parcela">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        `;

        const isChecked = window.receberIdsSelecionados.has(conta.id) ? 'checked' : '';

        // border-b garante a linha separadora
        return `
            <tr class="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#0f172a] transition-all duration-150">
                <td class="p-4 text-center border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#0f172a]/50">
                    <input type="checkbox" value="${conta.id}" onchange="window.toggleCheckContaReceber(${conta.id}, this)" class="w-4 h-4 rounded border-gray-300 text-[#1a428a] focus:ring-[#1a428a] cursor-pointer bg-white dark:bg-gray-700" ${isChecked}>
                </td>
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
                <td class="p-4 text-right font-mono font-black text-[#00b87c] text-sm">R$ ${valorFmt}</td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-2">
                        ${btnBaixa}
                        ${btnExcluirIndiv}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

// =========================================================================
// 3. SISTEMA DE SELEÇÃO E EXCLUSÃO (NOVO)
// =========================================================================

window.toggleCheckContaReceber = function(id, el) {
    if (el.checked) window.receberIdsSelecionados.add(id);
    else window.receberIdsSelecionados.delete(id);
    window.atualizarInterfaceExclusaoMassa();
};

window.toggleCheckAllReceber = function(el) {
    if (el.checked) {
        window.receberIdsFiltradosTela.forEach(id => window.receberIdsSelecionados.add(id));
    } else {
        window.receberIdsSelecionados.clear();
    }
    window.renderizarReceber(); 
};

window.atualizarInterfaceExclusaoMassa = function() {
    const checkAll = document.getElementById('check-all-receber');
    const btnMassa = document.getElementById('btn-excluir-massa');
    const spanQtd = document.getElementById('qtd-selecionadas');

    const totalSelecionado = window.receberIdsSelecionados.size;

    if (checkAll) {
        checkAll.checked = window.receberIdsFiltradosTela.length > 0 && 
                           window.receberIdsFiltradosTela.every(id => window.receberIdsSelecionados.has(id));
    }

    if (btnMassa && spanQtd) {
        spanQtd.innerText = totalSelecionado;
        if (totalSelecionado > 0) btnMassa.classList.remove('hidden');
        else btnMassa.classList.add('hidden');
    }
};

window.excluirContaReceberIndividual = async function(id, numOs, btnElement) {
    const confirmou = await window.abrirConfirmacao("Excluir Parcela", `Deseja apagar definitivamente a parcela da O.S #${numOs}? Ação irreversível.`, "perigo");
    if (!confirmou) return;

    if (btnElement) {
        btnElement.innerHTML = `<svg class="animate-spin h-4 w-4 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        const tr = btnElement.closest('tr');
        if (tr) tr.classList.add('bg-red-50', 'dark:bg-red-900/20', 'opacity-50');
    }

    try {
        const { error } = await supabase.from('contas_receber').delete().eq('id', id);
        if (error) throw error;
        
        window.receberIdsSelecionados.delete(id);
        if (window.mostrarToast) window.mostrarToast("Parcela eliminada!", "sucesso");
        setTimeout(() => window.carregarContasReceber(true), 600);
    } catch (err) {
        console.error("ERRO AO EXCLUIR:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao excluir parcela.", "erro");
        window.carregarContasReceber(true); 
    }
};

window.excluirContasMassa = async function() {
    const total = window.receberIdsSelecionados.size;
    if (total === 0) return;

    const confirmou = await window.abrirConfirmacao("Exclusão em Massa", `Deseja apagar DEFINITIVAMENTE as ${total} parcelas selecionadas?`, "perigo");
    if (!confirmou) return;

    const btnMassa = document.getElementById('btn-excluir-massa');
    if (btnMassa) {
        btnMassa.innerHTML = `<svg class="animate-spin h-4 w-4 text-white inline-block mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> EXCLUINDO...`;
        btnMassa.disabled = true;
        btnMassa.classList.add('opacity-70', 'cursor-not-allowed');
    }

    try {
        const idsArray = Array.from(window.receberIdsSelecionados);
        const { error } = await supabase.from('contas_receber').delete().in('id', idsArray);
        if (error) throw error;
        
        window.receberIdsSelecionados.clear();
        if (window.mostrarToast) window.mostrarToast(`${total} parcelas eliminadas!`, "sucesso");
        setTimeout(() => window.carregarContasReceber(true), 800);
    } catch (err) {
        console.error("ERRO NA EXCLUSÃO EM MASSA:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao excluir parcelas.", "erro");
        window.carregarContasReceber(true); 
    }
};

// =========================================================================
// 4. AÇÕES DE TESOURARIA COM FEEDBACK VISUAL (CONGELAMENTO)
// =========================================================================

window.darBaixaReceber = async function(id, numOs, btnElement) {
    const confirmou = await window.abrirConfirmacao("Confirmar Recebimento", `Deseja dar baixa na parcela da O.S #${numOs}?`, "sucesso");
    if (!confirmou) return;

    if (btnElement) {
        btnElement.innerHTML = `<svg class="animate-spin h-3 w-3 text-white inline-block mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> AGUARDE`;
        btnElement.classList.add('opacity-70', 'cursor-not-allowed');
        btnElement.disabled = true;
        const tr = btnElement.closest('tr');
        if (tr) tr.classList.add('bg-emerald-50', 'dark:bg-emerald-900/20');
    }

    try {
        const { error } = await supabase.from('contas_receber').update({ status: 'Recebido' }).eq('id', id);
        if (error) throw error;
        
        if (window.mostrarToast) window.mostrarToast("Recebimento confirmado!", "sucesso");
        setTimeout(() => window.carregarContasReceber(true), 800);
    } catch (err) {
        console.error("ERRO AO DAR BAIXA:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao confirmar recebimento.", "erro");
        window.carregarContasReceber(true); 
    }
};

window.estornarReceber = async function(id, btnElement) {
    const confirmou = await window.abrirConfirmacao("Estornar Parcela", "Deseja remover do cofre e voltar a parcela para PENDENTE?", "perigo");
    if (!confirmou) return;

    if (btnElement) {
        btnElement.innerHTML = `<svg class="animate-spin h-3 w-3 text-white inline-block mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> AGUARDE`;
        btnElement.classList.add('opacity-70', 'cursor-not-allowed');
        btnElement.disabled = true;
        const tr = btnElement.closest('tr');
        if (tr) tr.classList.add('bg-red-50', 'dark:bg-red-900/20');
    }

    try {
        const { error } = await supabase.from('contas_receber').update({ status: 'Pendente' }).eq('id', id);
        if (error) throw error;
        
        if (window.mostrarToast) window.mostrarToast("Estorno realizado com sucesso!", "info");
        setTimeout(() => window.carregarContasReceber(true), 800);
    } catch (err) {
        console.error("ERRO AO ESTORNAR:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao realizar o estorno.", "erro");
        window.carregarContasReceber(true);
    }
};
