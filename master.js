// JS/modules/master.js
import { supabase } from './config.js';

// =========================================================================
// 1. CARREGAMENTO INICIAL DO PAINEL MASTER
// =========================================================================
window.carregarPainelMaster = async function() {
    const tbody = document.getElementById('tabela-logs');
    if (!tbody) return; 

    // O Radar de O.S. (Notificações Globais que você fez)
    window.ativarVigilanciaPainelMaster();

    // Inicia o Radar Visual de Utilizadores
    window.iniciarRadarAoVivo();
    
    // Limpa a tabela de logs porque o foco agora é a auditoria de presença real
    tbody.innerHTML = '<tr><td colspan="4" class="text-center p-12 text-gray-500 font-bold italic" id="msg-sem-logs">Painel Master em modo Radar de Presença.</td></tr>';
};

// =========================================================================
// 2. RADAR DE PRESENÇA AO VIVO (SUPABASE PRESENCE)
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

// =========================================================================
// 3. MOTOR DE VIGILÂNCIA DO PAINEL MASTER (RADAR MULTI-BANDAS)
// =========================================================================
window.vigilanciaMasterAtiva = false;

window.ativarVigilanciaPainelMaster = function() {
    if (window.vigilanciaMasterAtiva) return;
    window.vigilanciaMasterAtiva = true;

    // Apenas escuta as ordens de serviço. Se precisar, desenhamos gráficos no futuro.
    supabase.channel('radar-master-os')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_servico' }, payload => {
            console.log('📡 [Painel Master] O.S. alterada no Supabase!');
        })
        .subscribe();
        
    console.log('🟢 [Painel Master] Radares ligados com sucesso! Operação em Tempo Real.');
};
