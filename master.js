// JS/modules/PainelMaster.js
import { supabase } from './config.js';

window.auditoriaSubscription = null;

window.carregarPainelMaster = async function() {
    const tbody = document.getElementById('tabela-logs');
    if (!tbody) {
        setTimeout(window.carregarPainelMaster, 100);
        return;
    }

    tbody.innerHTML = '<tr><td colspan="4" class="text-center p-8 text-gray-500 font-bold">A ler ficheiros de auditoria...</td></tr>';

    try {
        // Puxa os últimos 100 logs para não travar a tela
        const { data, error } = await supabase
            .from('auditoria_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        
        window.renderizarLogs(data || []);
        window.iniciarSincronizacaoLogs();

    } catch (err) {
        console.error("ERRO AO CARREGAR LOGS:", err);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center p-8 text-red-500 font-bold">Erro de conexão com a base de dados central.</td></tr>';
    }
};

window.renderizarLogs = function(logs) {
    const tbody = document.getElementById('tabela-logs');
    if (!tbody) return;

    if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center p-12 text-gray-400 font-bold italic">O sistema está completamente silencioso. Nenhum registo encontrado.</td></tr>`;
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
                <td class="p-4 whitespace-nowrap">
                    <span class="block font-mono text-xs font-black text-gray-600 dark:text-gray-300">${dataFormatada}</span>
                    <span class="block font-mono text-[10px] text-gray-400">${horaFormatada}</span>
                </td>
                <td class="p-4 font-black text-[#1a428a] dark:text-[#3b82f6] text-xs uppercase tracking-wide">
                    ${log.usuario}
                </td>
                <td class="p-4">
                    <span class="px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${corModulo}">
                        ${log.modulo}
                    </span>
                </td>
                <td class="p-4">
                    <span class="block text-sm font-bold text-gray-800 dark:text-gray-200">${log.acao}</span>
                    ${log.detalhes ? `<span class="block text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-lg group-hover:whitespace-normal group-hover:text-clip transition-all duration-300">${log.detalhes}</span>` : ''}
                </td>
            </tr>
        `;
    }).join('');
};

window.iniciarSincronizacaoLogs = function() {
    if (window.auditoriaSubscription) return;

    window.auditoriaSubscription = supabase.channel('logs-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'auditoria_logs' }, payload => {
            // Recarrega de forma silenciosa para mostrar o novo log no topo
            window.carregarPainelMaster();
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
