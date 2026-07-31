// JS/modules/master.js
import { supabase } from './config.js';

window.auditoriaSubscription = null;
window.radarChannel = null;

// =========================================================================
// 1. CARREGAMENTO INICIAL DO PAINEL MASTER
// =========================================================================
window.carregarPainelMaster = async function() {
    const tbody = document.getElementById('tabela-logs');
    if (!tbody) {
        setTimeout(window.carregarPainelMaster, 100);
        return;
    }

    tbody.innerHTML = '<tr><td colspan="4" class="text-center p-8 text-gray-500 font-bold">A ler ficheiros de auditoria...</td></tr>';

    try {
        // Puxa os últimos 100 logs
        const { data, error } = await supabase
            .from('auditoria_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        
        window.renderizarLogs(data || []);
        
        // Ativa os dois radares
        window.iniciarSincronizacaoLogs();
        window.iniciarRadarAoVivo();

    } catch (err) {
        console.error("ERRO AO CARREGAR LOGS:", err);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center p-8 text-red-500 font-bold">Erro de conexão com a base de dados central.</td></tr>';
    }
};

// =========================================================================
// 2. RENDERIZAÇÃO DA TABELA DE LOGS
// =========================================================================
window.renderizarLogs = function(logs) {
    const tbody = document.getElementById('tabela-logs');
    if (!tbody) return;

    if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center p-12 text-gray-400 font-bold italic">O sistema está silencioso. Nenhum registo encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = logs.map(log => {
        const dataLocal = new Date(log.created_at);
        const dataFormatada = dataLocal.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const horaFormatada = dataLocal.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // Cores táticas para Módulos
        let corModulo = 'text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-gray-800';
        if (log.modulo === 'Autenticação') corModulo = 'text-purple-700 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30';
        else if (log.modulo === 'Ordem de Serviço') corModulo = 'text-sky-700 bg-sky-100 dark:text-sky-400 dark:bg-sky-900/30';
        else if (log.modulo === 'Pátio') corModulo = 'text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30';

        return `
            <tr class="hover:bg-gray-50 dark:hover:bg-[#0f172a] transition-all group">
                <td class="p-4 whitespace-nowrap align-top">
                    <span class="block font-mono text-xs font-black text-gray-600 dark:text-gray-300">${dataFormatada}</span>
                    <span class="block font-mono text-[10px] text-gray-400">${horaFormatada}</span>
                </td>
                <td class="p-4 font-black text-[#1a428a] dark:text-[#3b82f6] text-xs uppercase tracking-wide align-top">
                    ${log.usuario}
                </td>
                <td class="p-4 align-top">
                    <span class="px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest inline-block ${corModulo}">
                        ${log.modulo}
                    </span>
                </td>
                <td class="p-4 align-top">
                    <span class="block text-sm font-bold text-gray-800 dark:text-gray-200">${log.acao}</span>
                    ${log.detalhes ? `<span class="block text-xs text-gray-500 dark:text-gray-400 mt-1 truncate max-w-sm md:max-w-lg lg:max-w-2xl group-hover:whitespace-normal group-hover:text-clip transition-all duration-300">${log.detalhes}</span>` : ''}
                </td>
            </tr>
        `;
    }).join('');
};

window.iniciarSincronizacaoLogs = function() {
    if (window.auditoriaSubscription) return;

    window.auditoriaSubscription = supabase.channel('logs-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'auditoria_logs' }, payload => {
            window.carregarPainelMaster(); // Atualiza a tela quando entra um log novo
        })
        .subscribe();
};

window.limparLogsAntigos = async function() {
    const confirmou = await window.abrirConfirmacao("Limpeza de Banco", "Deseja eliminar definitivamente os logs com mais de 30 dias? Esta ação não tem retorno.", "perigo");
    if (!confirmou) return;

    try {
        const trintaDiasAtras = new Date();
        trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
        
        const { error } = await supabase
            .from('auditoria_logs')
            .delete()
            .lt('created_at', trintaDiasAtras.toISOString());

        if (error) throw error;
        
        if(window.mostrarToast) window.mostrarToast("Limpeza concluída!", "sucesso");
        window.carregarPainelMaster();
    } catch (e) {
        console.error(e);
        if(window.mostrarToast) window.mostrarToast("Erro ao limpar logs.", "erro");
    }
};

// =========================================================================
// 3. RADAR DE PRESENÇA AO VIVO (SUPABASE PRESENCE)
// =========================================================================
window.iniciarRadarAoVivo = function() {
    // Só o Master precisa ouvir todos. Mas na verdade, o auth.js é que transmite.
    // Aqui nós configuramos a sala de escuta.
    
    if (window.radarChannel) return; // Já está a escutar
    
    window.radarChannel = supabase.channel('radar_global');

    window.radarChannel
        .on('presence', { event: 'sync' }, () => {
            const estadoAtual = window.radarChannel.presenceState();
            window.renderizarUsuariosOnline(estadoAtual);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
            console.log('📡 Alguém entrou no radar', newPresences);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            console.log('🔴 Alguém saiu do radar', leftPresences);
        })
        .subscribe();
};

window.renderizarUsuariosOnline = function(estadoPresence) {
    const container = document.getElementById('radar-usuarios');
    if (!container) return;

    // Converte o objeto complexo do Presence num array plano de usuários
    let usuariosConectados = [];
    for (const id in estadoPresence) {
        // Cada ID pode ter várias abas abertas, pegamos a mais recente (index 0)
        usuariosConectados.push(estadoPresence[id][0]); 
    }

    if (usuariosConectados.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center p-6 text-gray-400 font-medium text-xs border border-dashed border-gray-300 dark:border-gray-600 rounded-xl">Nenhum utilizador online no momento.</div>';
        return;
    }

    // Desenha o Crachá Visual
    container.innerHTML = usuariosConectados.map(user => {
        // Formatar nomes amigáveis para a tela
        let nomeAmigavelTela = user.tela;
        if(user.tela === 'patio') nomeAmigavelTela = 'Pátio de Execução';
        if(user.tela === 'ordem') nomeAmigavelTela = 'Ordem de Serviço';
        if(user.tela === 'master') nomeAmigavelTela = 'Painel Master';
        
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

// Limpa a inscrição se sairmos do Painel Master
window.pararSincronizacaoMaster = function() {
    if (window.auditoriaSubscription) {
        supabase.removeChannel(window.auditoriaSubscription);
        window.auditoriaSubscription = null;
    }
    if (window.radarChannel) {
        supabase.removeChannel(window.radarChannel);
        window.radarChannel = null;
    }
};
