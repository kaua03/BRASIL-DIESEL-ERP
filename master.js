// JS/modules/master.js
import { supabase } from './config.js';

// =========================================================================
// 1. CARREGAMENTO INICIAL DO PAINEL MASTER E DOS LOGS
// =========================================================================
window.carregarPainelMaster = async function() {
    // 🔴 TÁTICA DE ELITE: Atraso cirúrgico de 150ms para garantir que o HTML 
    // terminou de carregar na tela antes do Javascript tentar preencher a tabela.
    setTimeout(async () => {
        const tbody = document.getElementById('tabela-logs');
        
        // Se mesmo após 150ms a tabela não estiver lá, o utilizador saiu da tela. Aborta.
        if (!tbody) return; 

        tbody.innerHTML = '<tr><td colspan="4" class="text-center p-8 text-gray-500 font-bold">A ler ficheiros de auditoria...</td></tr>';

        // Garante que o Radar Visual está ligado
        window.iniciarRadarAoVivo();

        try {
            // Busca a auditoria na base de dados
            const { data, error } = await supabase
                .from('auditoria_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            
            window.renderizarLogs(data || []);
            
            // Garante que os ouvidos de novos logs estão ativos (só liga uma vez)
            window.iniciarSincronizacaoLogs();

        } catch (err) {
            console.error("ERRO AO CARREGAR LOGS:", err);
            const tb = document.getElementById('tabela-logs');
            if(tb) tb.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center p-8 text-red-500 font-bold">
                        Aviso: Tabela 'auditoria_logs' não encontrada ou sem permissão.<br>
                        <span class="text-xs text-gray-500 font-normal mt-2 block">Verifique no Supabase se a tabela existe com as colunas: created_at, usuario, modulo, acao, detalhes.</span>
                    </td>
                </tr>`;
        }
    }, 150);
};

// =========================================================================
// 2. CONSTRUTOR DE HTML E ANIMAÇÕES (LOGS DE AUDITORIA)
// =========================================================================
window.gerarHtmlLinhaLog = function(log) {
    const dataLocal = new Date(log.created_at);
    const dataFormatada = dataLocal.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const horaFormatada = dataLocal.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    let corModulo = 'text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-gray-800';
    if (log.modulo === 'Autenticação') corModulo = 'text-purple-700 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30';
    else if (log.modulo === 'Ordem de Serviço') corModulo = 'text-sky-700 bg-sky-100 dark:text-sky-400 dark:bg-sky-900/30';
    else if (log.modulo === 'Pátio') corModulo = 'text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30';
    else if (log.modulo === 'Clientes') corModulo = 'text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30';

    return `
        <td class="p-4 whitespace-nowrap align-top">
            <span class="block font-mono text-xs font-black text-gray-600 dark:text-gray-300">${dataFormatada}</span>
            <span class="block font-mono text-[10px] text-gray-400">${horaFormatada}</span>
        </td>
        <td class="p-4 font-black text-[#1a428a] dark:text-[#3b82f6] text-xs uppercase tracking-wide align-top">
            ${log.usuario || 'SISTEMA'}
        </td>
        <td class="p-4 align-top">
            <span class="px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest inline-block ${corModulo}">
                ${log.modulo || 'Geral'}
            </span>
        </td>
        <td class="p-4 align-top">
            <span class="block text-sm font-bold text-gray-800 dark:text-gray-200">${log.acao || 'Ação Registada'}</span>
            ${log.detalhes ? `<span class="block text-xs text-gray-500 dark:text-gray-400 mt-1 truncate max-w-sm md:max-w-lg lg:max-w-2xl group-hover:whitespace-normal group-hover:text-clip transition-all duration-300">${log.detalhes}</span>` : ''}
        </td>
    `;
};

window.renderizarLogs = function(logs) {
    const tbody = document.getElementById('tabela-logs');
    if (!tbody) return;

    if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center p-12 text-gray-400 font-bold italic" id="msg-sem-logs">O sistema está silencioso. Nenhum registo encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = logs.map(log => {
        return `<tr class="hover:bg-gray-50 dark:hover:bg-[#0f172a] transition-all group border-b border-gray-100 dark:border-gray-800/50">${window.gerarHtmlLinhaLog(log)}</tr>`;
    }).join('');
};

window.iniciarSincronizacaoLogs = function() {
    if (window.auditoriaLigada) return; // Evita ligar dois rádios ao mesmo tempo

    window.auditoriaLigada = true;
    
    supabase.channel('logs-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'auditoria_logs' }, payload => {
            window.adicionarLogAnimado(payload.new);
        })
        .subscribe();
};

window.adicionarLogAnimado = function(novoLog) {
    const tbody = document.getElementById('tabela-logs');
    if (!tbody) return;

    // Limpa a mensagem de "silencioso" caso exista
    const msgVazia = document.getElementById('msg-sem-logs');
    if (msgVazia) msgVazia.remove();

    const tr = document.createElement('tr');
    
    // ANIMAÇÃO DE ELITE: Inicia com fundo Azul que desvanece lentamente
    tr.className = "hover:bg-gray-50 dark:hover:bg-[#0f172a] transition-all duration-[2000ms] ease-out group bg-blue-100 dark:bg-blue-900/40 anima-fade border-b border-gray-100 dark:border-gray-800/50";
    tr.innerHTML = window.gerarHtmlLinhaLog(novoLog);

    // Insere exatamente no topo (index 0)
    tbody.insertBefore(tr, tbody.firstChild);

    // Limite de desempenho: Mantém apenas 100 linhas na tela
    if (tbody.children.length > 100) {
        tbody.removeChild(tbody.lastChild);
    }

    // Após 2 segundos, remove a classe azul, fundindo com o fundo normal da tela
    setTimeout(() => {
        tr.classList.remove('bg-blue-100', 'dark:bg-blue-900/40');
    }, 2000);
};

// =========================================================================
// 3. RADAR DE PRESENÇA AO VIVO (SUPABASE PRESENCE)
// =========================================================================
window.radarLigado = false;

window.iniciarRadarAoVivo = function() {
    if (!window.canalTransmissaoGeral) {
        setTimeout(window.iniciarRadarAoVivo, 500);
        return;
    }

    if (!window.radarLigado) {
        window.canalTransmissaoGeral
            .on('presence', { event: 'sync' }, () => {
                if (typeof window.renderizarUsuariosOnline === 'function') {
                    const estadoAtual = window.canalTransmissaoGeral.presenceState();
                    window.renderizarUsuariosOnline(estadoAtual);
                }
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                console.log('📡 [Master] Alguém entrou no radar', newPresences);
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                console.log('🔴 [Master] Alguém saiu do radar', leftPresences);
            });
            
        window.radarLigado = true;
    }

    const estadoAtual = window.canalTransmissaoGeral.presenceState();
    window.renderizarUsuariosOnline(estadoAtual);
};

window.renderizarUsuariosOnline = function(estadoPresence) {
    const container = document.getElementById('radar-usuarios');
    if (!container) return; 

    let usuariosConectados = [];
    if (estadoPresence) {
        for (const id in estadoPresence) {
            if (estadoPresence[id] && estadoPresence[id].length > 0) {
                usuariosConectados.push(estadoPresence[id][0]); 
            }
        }
    }

    if (usuariosConectados.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center p-6 text-gray-400 font-medium text-xs border border-dashed border-gray-300 dark:border-gray-600 rounded-xl">Nenhum utilizador online no momento.</div>';
        return;
    }

    container.innerHTML = usuariosConectados.map(user => {
        let nomeAmigavelTela = user.tela;
        if(user.tela === 'patio') nomeAmigavelTela = 'Pátio de Execução';
        else if(user.tela === 'ordem') nomeAmigavelTela = 'Ordem de Serviço';
        else if(user.tela === 'master' || user.tela === 'PainelMaster') nomeAmigavelTela = 'Painel Master';
        else if(user.tela === 'lab') nomeAmigavelTela = 'Laboratório';
        else if(user.tela === 'itens') nomeAmigavelTela = 'Itens (Catálogo)';
        else if(user.tela === 'estoque') nomeAmigavelTela = 'Estoque';
        else if(user.tela === 'cliente') nomeAmigavelTela = 'Clientes';
        else if(user.tela === 'veiculo') nomeAmigavelTela = 'Veículos';
        else if(user.tela === 'funcionario') nomeAmigavelTela = 'Equipe';
        else if(user.tela === 'receber') nomeAmigavelTela = 'Contas a Receber';
        else if(user.tela === 'pagar') nomeAmigavelTela = 'Contas a Pagar';
        else if(user.tela === 'dashboard') nomeAmigavelTela = 'Dashboard Financeiro';
        else if(user.tela === 'configuracoes') nomeAmigavelTela = 'Configurações';
        else nomeAmigavelTela = user.tela;
        
        return `
            <div class="bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-xl p-3 flex items-start gap-3 shadow-sm anima-fade">
                <div class="relative shrink-0">
                    <div class="w-10 h-10 rounded-full bg-[#1a428a] dark:bg-blue-900 text-white flex items-center justify-center font-black shadow-inner text-lg">
                        ${String(user.nome).charAt(0).toUpperCase()}
                    </div>
                    <div class="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-[#0f172a] rounded-full animate-pulse"></div>
                </div>
                <div class="overflow-hidden">
                    <p class="text-xs font-black text-gray-800 dark:text-white truncate" title="${user.nome}">${user.nome}</p>
                    <p class="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 truncate">${user.cargo}</p>
                    <div class="flex items-center gap-1 text-[10px] text-[#1a428a] dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded w-max">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" /></svg>
                        <span class="truncate max-w-[90px]" title="${nomeAmigavelTela}">${nomeAmigavelTela}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
};
