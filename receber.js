// JS/modules/receber.js
import { supabase } from './config.js';

window.dadosReceberGerais = [];
window.abaReceberAtual = 'Pendente'; 
window.vigilanciaReceberAtiva = false; 

// Sistema de Memória para Seleção
window.receberIdsSelecionados = new Set();
window.receberIdsFiltradosTela = []; 

// Função auxiliar para remover acentos e normalizar a busca (Ex: "crédito" = "credito")
const removerAcentos = (str) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

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
                console.log('📡 [Tesouraria] Sincronizando modificação no cofre...');
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
        const { data, error } = await supabase
            .from('contas_receber')
            .select('*, ordens_servico(numero_os)')
            .order('vencimento', { ascending: true }); 

        if (error) throw error;
        
        window.dadosReceberGerais = data || [];
        window.renderizarReceber();

    } catch (err) {
        console.error("ERRO AO CARREGAR FINANCEIRO:", err);
        if (!isSilencioso) tbody.innerHTML = '<tr><td colspan="8" class="text-center p-8 text-red-500 font-bold">Erro de conexão ao banco financeiro.</td></tr>';
    }
};

// =========================================================================
// 2. NAVEGAÇÃO E MOTOR DE RENDERIZAÇÃO
// =========================================================================

window.mudarAbaReceber = function(status) {
    window.abaReceberAtual = status;
    window.receberIdsSelecionados.clear(); 
    
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

    const textoBuscaBruto = (document.getElementById('filtro-busca-receber')?.value || '').trim();
    const textoBusca = removerAcentos(textoBuscaBruto);
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
            const cliente = removerAcentos(String(conta.cliente || ''));
            const placa = removerAcentos(String(conta.placa || ''));
            const operacao = removerAcentos(String(conta.operacao || ''));
            const contaDestino = removerAcentos(String(conta.conta_destino || ''));
            const osReal = conta.ordens_servico?.numero_os || conta.os_id || '';
            const osIdStr = removerAcentos(String(osReal).padStart(4, '0'));
            
            bateTexto = cliente.includes(textoBusca) || 
                        placa.includes(textoBusca) || 
                        operacao.includes(textoBusca) || 
                        contaDestino.includes(textoBusca) || 
                        osIdStr.includes(textoBusca);
        }
        return bateAba && bateConta && bateTexto;
    });

    window.receberIdsFiltradosTela = dadosFiltrados.map(c => c.id);
    window.atualizarInterfaceExclusaoMassa();

    if (dadosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center p-8 text-gray-400 font-bold italic">Nenhum lançamento ${window.abaReceberAtual.toLowerCase()} encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = dadosFiltrados.map(conta => {
        const numeroRealOs = conta.ordens_servico?.numero_os || conta.os_id || '---';
        const numOs = String(numeroRealOs).padStart(4, '0');
        const placaFmt = String(conta.placa || '---');
        const clienteFmt = String(conta.cliente || 'CLIENTE AVULSO');
        const valorFmt = Number(conta.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2});
        
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
                    statusVencimentoVisual = `<span class="text-red-600 dark:text-red-400 font-black animate-pulse flex items-center justify-center gap-1">🚨 ${dataFormatada}</span><span class="text-[9px] text-red-500 block uppercase mt-0.5">Atrasado</span>`;
                } else if (diffDays === 0) {
                    statusVencimentoVisual = `<span class="text-orange-600 dark:text-orange-500 font-black flex items-center justify-center gap-1">⚠️ ${dataFormatada}</span><span class="text-[9px] text-orange-500 block uppercase mt-0.5">Vence Hoje</span>`;
                } else if (diffDays <= 3) {
                    statusVencimentoVisual = `<span class="text-amber-500 dark:text-amber-400 font-bold flex items-center justify-center gap-1">⚠️ ${dataFormatada}</span><span class="text-[9px] text-amber-500 block uppercase mt-0.5">Vence em ${diffDays} d</span>`;
                } else {
                    statusVencimentoVisual = `<span class="text-gray-700 dark:text-gray-300 font-bold">${dataFormatada}</span>`;
                }
            } else {
                statusVencimentoVisual = `<span class="text-gray-500 font-bold">${dataFormatada}</span>`;
            }
        }

        // Botoes Táticos (Baixa e Estorno) - Agora em formato quadrado igual Editar/Excluir
        let btnBaixa = '';
        if (conta.status === 'Pendente') {
            btnBaixa = `
                <button onclick="window.darBaixaReceber(${conta.id}, '${numOs}', this)" class="w-8 h-8 flex items-center justify-center bg-[#00b87c] hover:bg-emerald-600 text-white rounded transition-all duration-150" title="Dar Baixa">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
                </button>
            `;
        } else {
            btnBaixa = `
                <button onclick="window.estornarReceber(${conta.id}, this)" class="w-8 h-8 flex items-center justify-center bg-gray-500 hover:bg-gray-600 text-white rounded transition-all duration-150" title="Estornar">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                </button>
            `;
        }

        const btnEditarIndiv = `
            <button onclick="window.abrirModalEditarReceber(${conta.id})" class="w-8 h-8 flex items-center justify-center bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-800/50 text-amber-600 dark:text-amber-400 rounded transition-all duration-150" title="Editar Parcela">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
        `;

        const btnExcluirIndiv = `
            <button onclick="window.iniciarExclusaoReceber(${conta.id}, '${numOs}', ${conta.os_id || 'null'}, this)" class="w-8 h-8 flex items-center justify-center bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-800/50 text-red-600 dark:text-red-400 rounded transition-all duration-150" title="Apagar Parcela">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        `;

        const isChecked = window.receberIdsSelecionados.has(conta.id) ? 'checked' : '';

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
                <td class="p-4 text-right font-mono font-black text-[#00b87c] text-sm whitespace-nowrap">R$ ${valorFmt}</td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        ${btnBaixa}
                        ${btnEditarIndiv}
                        ${btnExcluirIndiv}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

// =========================================================================
// 3. SISTEMA DE SELEÇÃO E EXCLUSÃO INTELIGENTE
// =========================================================================

window.toggleCheckContaReceber = function(id, el) {
    if (el.checked) window.receberIdsSelecionados.add(id);
    else window.receberIdsSelecionados.delete(id);
    window.atualizarInterfaceExclusaoMassa();
};

window.atualizarInterfaceExclusaoMassa = function() {
    const btnMassa = document.getElementById('btn-excluir-massa');
    const spanQtd = document.getElementById('qtd-selecionadas');
    const totalSelecionado = window.receberIdsSelecionados.size;

    if (btnMassa && spanQtd) {
        spanQtd.innerText = totalSelecionado;
        if (totalSelecionado > 0) btnMassa.classList.remove('hidden');
        else btnMassa.classList.add('hidden');
    }
};

window.excluirContasMassa = async function() {
    const total = window.receberIdsSelecionados.size;
    if (total === 0) return;

    const confirmou = await window.abrirConfirmacao("Exclusão em Massa", `Deseja apagar DEFINITIVAMENTE as ${total} parcelas marcadas?`, "perigo");
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
    } catch (err) {
        console.error("ERRO NA EXCLUSÃO EM MASSA:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao excluir parcelas.", "erro");
        window.carregarContasReceber(true); 
    }
};

window.iniciarExclusaoReceber = function(id, numOs, osId, btnElement) {
    if (!osId) {
        window.excluirContaReceberDireto([id]);
        return;
    }

    const parcelasDaOs = window.dadosReceberGerais.filter(c => c.os_id === osId);
    
    if (parcelasDaOs.length > 1) {
        window.exclusaoInteligenteTemp = { id, numOs, osId };
        document.getElementById('texto-exclusao-inteligente').innerHTML = `Esta parcela faz parte da <b>O.S #${numOs}</b> que possui um total de <b>${parcelasDaOs.length} parcelas</b>.<br><br>Deseja limpar todo o financeiro desta O.S de uma só vez?`;
        
        document.getElementById('modal-exclusao-inteligente').classList.remove('hidden');
        document.getElementById('modal-exclusao-inteligente').classList.add('flex');
    } else {
        window.excluirContaReceberDireto([id]);
    }
};

window.escolherExclusaoInteligente = function(tipo) {
    document.getElementById('modal-exclusao-inteligente').classList.add('hidden');
    document.getElementById('modal-exclusao-inteligente').classList.remove('flex');
    
    const { id, osId } = window.exclusaoInteligenteTemp;
    
    if (tipo === 'unica') {
        window.excluirContaReceberDireto([id]);
    } else if (tipo === 'todas') {
        const idsParaExcluir = window.dadosReceberGerais.filter(c => c.os_id === osId).map(c => c.id);
        window.excluirContaReceberDireto(idsParaExcluir);
    }
};

window.excluirContaReceberDireto = async function(idsArray) {
    const total = idsArray.length;
    let msgConfirm = total > 1 ? `Apagar DEFINITIVAMENTE as ${total} parcelas vinculadas a esta O.S?` : `Apagar definitivamente esta parcela isolada?`;
    
    const confirmou = await window.abrirConfirmacao("Atenção Total", msgConfirm, "perigo");
    if (!confirmou) return;

    if (window.mostrarToast) window.mostrarToast("Processando exclusão no cofre...", "aviso");

    try {
        const { error } = await supabase.from('contas_receber').delete().in('id', idsArray);
        if (error) throw error;
        
        idsArray.forEach(id => window.receberIdsSelecionados.delete(id));
        window.atualizarInterfaceExclusaoMassa();
        
        if (window.mostrarToast) window.mostrarToast("Exclusão concluída com sucesso!", "sucesso");
    } catch (err) {
        console.error("ERRO AO EXCLUIR:", err);
        if (window.mostrarToast) window.mostrarToast("Falha técnica ao excluir.", "erro");
        window.carregarContasReceber(true);
    }
};

// =========================================================================
// 4. EDIÇÃO DIRETA DE PARCELA (BANCO DE DADOS)
// =========================================================================

window.abrirModalEditarReceber = function(id) {
    const conta = window.dadosReceberGerais.find(c => c.id === id);
    if (!conta) return;

    document.getElementById('edit-receber-id').value = conta.id;
    document.getElementById('edit-receber-vencimento').value = conta.vencimento;
    document.getElementById('edit-receber-valor').value = Number(conta.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2});
    document.getElementById('edit-receber-conta').value = conta.conta_destino;
    document.getElementById('edit-receber-operacao').value = conta.operacao;
    document.getElementById('edit-receber-nsu').value = conta.nsu_doc || '';
    
    document.getElementById('modal-editar-receber').classList.remove('hidden');
    document.getElementById('modal-editar-receber').classList.add('flex');
};

window.salvarEdicaoReceber = async function(event) {
    if (event) event.preventDefault();
    
    const id = document.getElementById('edit-receber-id').value;
    const venc = document.getElementById('edit-receber-vencimento').value;
    const valStr = document.getElementById('edit-receber-valor').value;
    const valNum = parseFloat(valStr.replace(/\./g, '').replace(',', '.')) || 0;
    const contaDest = document.getElementById('edit-receber-conta').value;
    const op = document.getElementById('edit-receber-operacao').value;
    const nsu = document.getElementById('edit-receber-nsu').value;

    if (window.mostrarToast) window.mostrarToast("Injetando edição no banco de dados...", "info");

    try {
        const { error } = await supabase.from('contas_receber').update({
            vencimento: venc,
            valor: valNum,
            conta_destino: contaDest,
            operacao: op,
            nsu_doc: nsu
        }).eq('id', id);

        if (error) throw error;
        
        if (window.mostrarToast) window.mostrarToast("Parcela atualizada no cofre!", "sucesso");
        
        document.getElementById('modal-editar-receber').classList.add('hidden');
        document.getElementById('modal-editar-receber').classList.remove('flex');
    } catch (e) {
        console.error("FALHA AO EDITAR:", e);
        if (window.mostrarToast) window.mostrarToast("Erro crítico ao salvar edição.", "erro");
    }
};

// =========================================================================
// 5. AÇÕES DE TESOURARIA COM FEEDBACK VISUAL (CONGELAMENTO)
// =========================================================================

window.darBaixaReceber = async function(id, numOs, btnElement) {
    const confirmou = await window.abrirConfirmacao("Confirmar Recebimento", `Deseja dar baixa na parcela da O.S #${numOs}?`, "sucesso");
    if (!confirmou) return;

    if (btnElement) {
        btnElement.innerHTML = `<svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
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
        btnElement.innerHTML = `<svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
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
