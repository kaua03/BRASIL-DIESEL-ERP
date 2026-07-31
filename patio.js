// JS/modules/patio.js
import { supabase } from './config.js';

// Memória local do Pátio para reatividade rápida
window.dadosPatio = [];
window.osPatioAbertaId = null;
window.patioSubscription = null;
window.tamanhoGradeAtual = 0; // 0: Padrão, 1: Médio, 2: Compacto

// =========================================================================
// 1. CARREGAMENTO E RENDERIZAÇÃO DO RADAR (CARDS)
// =========================================================================
window.carregarPatio = async function() {
    const grid = document.getElementById('grid-patio');
    if (!grid) return;

    // VERIFICAÇÃO DE CARGO TELA (Exibe o Botão de Ajuste de Layout)
    const userStr = sessionStorage.getItem('bdp_user');
    if (userStr) {
        const cargo = JSON.parse(userStr).cargo;
        const btnGrade = document.getElementById('btn-grade-tv');
        if (cargo === 'Tela' && btnGrade) {
            btnGrade.classList.remove('hidden');
            btnGrade.classList.add('flex');
        }
    }

    try {
        const { data: ordens, error } = await supabase
            .from('ordens_servico')
            .select(`
                *,
                itens_orcamento(*),
                comentarios_os(*)
            `)
            .neq('situacao', 'Recusado')
            .order('id', { ascending: false });

        if (error) throw error;

        window.dadosPatio = (ordens || []).map(os => {
            const clienteUpper = String(os.cliente || '---').trim().toUpperCase();
            const modeloUpper = String(os.modelo || '---').trim().toUpperCase();
            const anoStr = String(os.ano || '').trim();
            const veiculoFormatado = anoStr ? `${modeloUpper} - ${anoStr}` : modeloUpper;
            const placaFormatada = window.formatarPlaca ? window.formatarPlaca(os.placa) : String(os.placa || '').toUpperCase();

            return {
                ...os,
                cliente: clienteUpper,
                modelo: veiculoFormatado,
                placa: placaFormatada
            };
        });

        if (window.dadosPatio.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center p-12 text-gray-400 font-bold bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-200 dark:border-gray-700">Pátio limpo. Nenhuma O.S. em andamento.</div>';
        } else {
            grid.innerHTML = window.dadosPatio.map(os => window.gerarCardPatio(os)).join('');
        }

        if (window.osPatioAbertaId) {
            window.renderizarConteudoModalPatio();
        }

        window.iniciarSincronizacaoPatio();

    } catch (err) {
        console.error("Erro ao carregar Pátio:", err);
        grid.innerHTML = '<div class="col-span-full text-center p-12 text-red-500 font-bold bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-200 dark:border-gray-700">Erro de comunicação com o servidor.</div>';
    }
};

// =========================================================================
// 2. MOTO DE LAYOUT DE TV (Redimensionamento Proporcional)
// =========================================================================
window.mudarGradeTV = function() {
    window.tamanhoGradeAtual = (window.tamanhoGradeAtual + 1) % 3;
    const grid = document.getElementById('grid-patio');
    const textoBtn = document.getElementById('texto-grade-tv');

    if (!grid) return;

    // Reseta as classes para a base limpa
    grid.className = "grid gap-4 origin-top transition-all duration-300"; 

    // Aplica as classes Tailwind de Colunas + Escalamento CSS Proporcional (Zoom)
    if (window.tamanhoGradeAtual === 0) {
        // PADRÃO (Max 5 Colunas)
        grid.classList.add('grid-cols-1', 'sm:grid-cols-2', 'md:grid-cols-3', 'xl:grid-cols-4', '2xl:grid-cols-5');
        grid.style.zoom = "1"; // Tamanho Real
        if(textoBtn) textoBtn.innerText = "Layout: Padrão";
    } else if (window.tamanhoGradeAtual === 1) {
        // MÉDIO (Max 8 Colunas)
        grid.classList.add('grid-cols-2', 'sm:grid-cols-3', 'md:grid-cols-4', 'xl:grid-cols-6', '2xl:grid-cols-8');
        grid.style.zoom = "0.75"; // Encolhe em 25%
        if(textoBtn) textoBtn.innerText = "Layout: Médio";
    } else {
        // COMPACTO (Max 10 Colunas)
        grid.classList.add('grid-cols-3', 'sm:grid-cols-4', 'md:grid-cols-6', 'xl:grid-cols-8', '2xl:grid-cols-10');
        grid.style.zoom = "0.55"; // Encolhe quase pela metade para ecrãs massivos
        if(textoBtn) textoBtn.innerText = "Layout: Compacto";
    }
};

window.gerarCardPatio = function(os) {
    const numeroFormatado = String(os.numero_os || os.id).padStart(4, '0');
    const placaFormatada = String(os.placa || '').toUpperCase();
    const clienteUpper = String(os.cliente || '---').toUpperCase();
    const modeloFormatado = String(os.modelo || '---').toUpperCase();

    const totalItens = os.itens_orcamento ? os.itens_orcamento.length : 0;
    const concluidos = os.itens_orcamento ? os.itens_orcamento.filter(i => i.concluido).length : 0;
    const progresso = totalItens === 0 ? 0 : Math.round((concluidos / totalItens) * 100);

    let bgStatus = 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    if (os.situacao === 'Aberto') bgStatus = 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400 border border-transparent dark:border-sky-800';
    else if (os.situacao === 'Aguardando Autorização') bgStatus = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-transparent dark:border-amber-800';
    else if (os.situacao === 'Autorizado') bgStatus = 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400';
    else if (os.situacao === 'Em Execução') bgStatus = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border border-transparent dark:border-indigo-800';

    let corBarra = 'bg-[#1a428a] dark:bg-[#3b82f6]';
    let corTextoProgresso = 'text-[#1a428a] dark:text-[#3b82f6]';
    if (progresso === 100) {
        corBarra = 'bg-emerald-500 dark:bg-emerald-400';
        corTextoProgresso = 'text-emerald-500 dark:text-emerald-400';
    }

    return `
        <div onclick="window.abrirModalPatio(${os.id})" class="bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-300 relative group cursor-pointer flex flex-col h-full min-h-[160px]">
            <div class="flex justify-between items-center mb-3">
                <span class="font-black text-[#1a428a] dark:text-[#3b82f6] text-lg">#${numeroFormatado}</span>
                <span class="${bgStatus} text-[9px] uppercase px-2 py-1 rounded font-bold tracking-wider shadow-sm transition-colors">${os.situacao || 'Aberto'}</span>
            </div>
            <h3 class="text-2xl font-black text-[#0f2757] dark:text-white tracking-wider mb-1">${placaFormatada}</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide mb-4 truncate">${modeloFormatado}</p>
            <div class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-[10px] font-bold mb-5 truncate mt-auto">
                <svg class="h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path></svg>
                <span class="truncate">${clienteUpper}</span>
            </div>
            <div>
                <div class="flex justify-between text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1.5 tracking-wider uppercase">
                    <span>Progresso</span>
                    <span class="${corTextoProgresso}">${progresso}%</span>
                </div>
                <div class="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                    <div class="${corBarra} h-1.5 rounded-full transition-all duration-1000 ease-out" style="width: ${progresso}%"></div>
                </div>
            </div>
        </div>
    `;
};

// =========================================================================
// 3. SINCRONIZAÇÃO EM TEMPO REAL (DevSecOps)
// =========================================================================
window.iniciarSincronizacaoPatio = function() {
    if (window.patioSubscription) return;

    window.patioSubscription = supabase.channel('patio-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_servico' }, payload => {
            window.carregarPatio();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'itens_orcamento' }, payload => {
            window.carregarPatio();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comentarios_os' }, payload => {
            window.carregarPatio();
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log("🟢 Conexão WebSocket estabelecida: Pátio ao vivo!");
            }
        });
};

window.pararSincronizacaoPatio = function() {
    if (window.patioSubscription) {
        supabase.removeChannel(window.patioSubscription);
        window.patioSubscription = null;
        console.log("🔴 Conexão WebSocket encerrada.");
    }
};

// =========================================================================
// 4. MODAL DE EXECUÇÃO (Mestre-Detalhe)
// =========================================================================
window.abrirModalPatio = function(id) {
    window.osPatioAbertaId = id;
    window.renderizarConteudoModalPatio();
    const modal = document.getElementById('modal-patio');
    if(modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.fecharModalPatio = function() {
    window.osPatioAbertaId = null;
    const modal = document.getElementById('modal-patio');
    if(modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

window.renderizarConteudoModalPatio = function() {
    if (!window.osPatioAbertaId) return;

    const os = window.dadosPatio.find(o => o.id === window.osPatioAbertaId);
    if (!os) {
        window.fecharModalPatio();
        return;
    }

    const osNum = String(os.numero_os || os.id).padStart(4, '0');
    const placa = String(os.placa || '---').toUpperCase();
    document.getElementById('modal-patio-titulo').innerText = `O.S. #${osNum} — ${placa}`;
    document.getElementById('modal-patio-subtitulo').innerText = `${(os.modelo || '').toUpperCase()} | ${(os.cliente || '').toUpperCase()}`;

    const itens = os.itens_orcamento || [];
    const totalItens = itens.length;
    const concluidos = itens.filter(i => i.concluido).length;
    const porcentagem = totalItens === 0 ? 0 : Math.round((concluidos / totalItens) * 100);
    
    document.getElementById('modal-patio-progresso-texto').innerText = `${porcentagem}% (${concluidos}/${totalItens})`;
    const barra = document.getElementById('modal-patio-progresso-barra');
    if (barra) {
        barra.style.width = `${porcentagem}%`;
        barra.className = `h-2.5 rounded-full transition-all duration-500 ease-out ${porcentagem === 100 ? 'bg-green-500 dark:bg-green-400' : 'bg-blue-500 dark:bg-blue-600'}`;
    }

    const renderListaItens = (tipo) => {
        const filtro = itens.filter(i => i.tipo === tipo);
        if (filtro.length === 0) return `<p class="text-[11px] text-gray-400 dark:text-gray-500 italic mb-4">Nenhum(a) ${tipo.toLowerCase()} listado.</p>`;
        
        return filtro.map(i => `
            <label class="flex items-start gap-3 p-3 mb-2 bg-white dark:bg-[#0f172a] hover:bg-blue-50 dark:hover:bg-[#1e293b] border ${i.concluido ? 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-900/10' : 'border-gray-100 dark:border-gray-700 shadow-sm'} rounded-xl cursor-pointer transition-all group">
                <input type="checkbox" onchange="window.marcarItemConcluido(${i.id}, this.checked, this)" 
                    ${i.concluido ? 'checked' : ''} 
                    class="mt-0.5 w-5 h-5 text-[#1a428a] dark:text-[#3b82f6] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-[#1a428a] dark:focus:ring-[#3b82f6] cursor-pointer transition-colors">
                <span class="text-sm font-bold text-gray-700 dark:text-gray-200 group-hover:text-[#1a428a] dark:group-hover:text-[#3b82f6] ${i.concluido ? 'line-through text-gray-400 dark:text-gray-500' : ''} transition-all mt-0.5">
                    ${i.quantidade}x - ${i.descricao.toUpperCase()}
                </span>
            </label>
        `).join('') + '<div class="mb-4"></div>';
    };

    document.getElementById('modal-patio-checklist').innerHTML = `
        <h5 class="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 pb-2 mb-3">Serviços</h5>
        ${renderListaItens('Serviço')}
        <h5 class="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 pb-2 mb-3 mt-4">Peças Separadas</h5>
        ${renderListaItens('Peça')}
    `;

    const chatContainer = document.getElementById('modal-patio-chat');
    const comentarios = (os.comentarios_os || []).sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora));
    const isAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop <= chatContainer.clientHeight + 20;

    const htmlChat = comentarios.map(c => {
        const dataFormatada = new Date(c.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' });
        const nomeUsuario = document.getElementById('usuario-logado')?.innerText || '';
        const eu = nomeUsuario === c.autor;
        
        // CORTE SNIPER: Pega apenas a primeira palavra do nome
        const autorPrimeiroNome = c.autor ? String(c.autor).split(' ')[0] : 'SISTEMA';
        
        return `
            <div class="flex flex-col ${eu ? 'items-end' : 'items-start'}">
                <div class="flex items-baseline gap-2 mb-1 px-1">
                    <span class="text-[10px] font-black text-gray-500 dark:text-gray-400">${autorPrimeiroNome}</span>
                    <span class="text-[9px] text-gray-400 dark:text-gray-500 font-mono">${dataFormatada}</span>
                </div>
                <div class="${eu ? 'bg-[#1a428a] dark:bg-[#2563eb] text-white rounded-br-none' : 'bg-white dark:bg-[#1e293b] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-bl-none'} px-4 py-2.5 rounded-2xl max-w-[90%] shadow-sm">
                    <p class="text-xs leading-snug whitespace-pre-wrap">${c.texto}</p>
                </div>
            </div>
        `;
    }).join('');

    chatContainer.innerHTML = htmlChat || `
        <div class="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-2">
            <span class="text-4xl">💬</span>
            <p class="text-xs text-gray-500 dark:text-gray-400 font-medium">Nenhuma observação registada.<br>Seja o primeiro a reportar.</p>
        </div>
    `;

    if (isAtBottom) {
        setTimeout(() => { chatContainer.scrollTop = chatContainer.scrollHeight; }, 50);
    }
};

// =========================================================================
// 5. API DE AÇÕES DO PÁTIO (Com Confirmação e Automação de Diário)
// =========================================================================
window.marcarItemConcluido = async function(itemId, concluido, checkboxElement) {
    const autor = document.getElementById('usuario-logado')?.innerText || 'Mecânico';
    const acaoTexto = concluido ? "marcar como concluído" : "desmarcar";

    const confirmou = await window.abrirConfirmacao(
        "Confirmação de Execução",
        `Tem certeza que deseja ${acaoTexto} este item, ${autor.split(' ')[0]}?`,
        "aviso"
    );

    if (!confirmou) {
        checkboxElement.checked = !concluido;
        return; 
    }

    try {
        let nomeItem = "Item";
        const osAtual = window.dadosPatio.find(o => o.id === window.osPatioAbertaId);
        if (osAtual) {
            const itemReal = osAtual.itens_orcamento.find(i => i.id === itemId);
            if (itemReal) nomeItem = itemReal.descricao;
        }

        const { error } = await supabase.from('itens_orcamento').update({ concluido: concluido }).eq('id', itemId);
        if (error) throw error;

    // AVISA A SALA DE SEGURANÇA QUE UM ITEM FOI MARCADO/DESMARCADO
    if(window.registrarLog) {
        window.registrarLog('Pátio', 'Checklist O.S. #' + window.osPatioAbertaId, `Item: ${nomeItem} | Status: ${concluido ? 'Concluído' : 'Desmarcado'}`);
    }

        const textoDiario = concluido ? `✅ Confirmou a conclusão do item: ${nomeItem.toUpperCase()}` : `❌ Desmarcou o item: ${nomeItem.toUpperCase()}`;
        
        // Grava no BD o NOME COMPLETO para auditoria (segurança)
        await supabase.from('comentarios_os').insert([{
            os_id: window.osPatioAbertaId,
            autor: autor,
            texto: textoDiario
        }]);

        await window.carregarPatio();

    } catch (e) {
        console.error(e);
        checkboxElement.checked = !concluido; 
        if(window.mostrarToast) window.mostrarToast("Erro ao atualizar o item no banco.", "erro");
    }
};

window.enviarComentarioPatioAtual = async function() {
    if (!window.osPatioAbertaId) return;
    
    const input = document.getElementById('modal-patio-input');
    if (!input || !input.value.trim()) return;

    const texto = input.value.trim();
    // Grava no BD o NOME COMPLETO para auditoria (segurança)
    const autor = document.getElementById('usuario-logado')?.innerText || 'Mecânico';

    try {
        input.disabled = true;
        input.classList.add('opacity-50');
        
        const { error } = await supabase.from('comentarios_os').insert([{
            os_id: window.osPatioAbertaId,
            autor: autor,
            texto: texto
        }]);

        if (error) throw error;

    // AVISA A SALA DE SEGURANÇA QUE ALGUÉM COMENTOU NA O.S.
    if(window.registrarLog) {
        window.registrarLog('Pátio', 'Novo Comentário', `Escreveu no Diário da O.S. #${window.osPatioAbertaId}`);
    }
        
        input.value = '';
        input.disabled = false;
        input.classList.remove('opacity-50');
        input.focus();
        
    } catch (e) {
        console.error(e);
        input.disabled = false;
        input.classList.remove('opacity-50');
        if(window.mostrarToast) window.mostrarToast("Erro ao enviar observação.", "erro");
    }
};
